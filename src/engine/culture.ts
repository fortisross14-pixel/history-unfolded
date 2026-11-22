/**
 * Culture: points, choices, forks, tension and upheavals. See data/culture.ts for the web.
 */
import {
  CULTURE,
  CULTURE_LIST,
  DOMAIN_LIST,
  DOMAINS,
  OPPOSED,
  type CultureNode,
  type Domain,
} from '../data/culture.ts';
import { distance } from './hex.ts';
import { civMods, pct, tagCounts } from './mods.ts';
import type { Civ, CultureState, GameState } from './types.ts';

export const UPHEAVAL_AT = 100;
export const FORCED_AT = 150;
export const UPHEAVAL_TURNS = 8;
export const KEEP_AFTER_UPHEAVAL = 2;

export function newCultureState(): CultureState {
  return {
    points: 0,
    taken: [],
    legacy: [],
    tension: Object.fromEntries(DOMAIN_LIST.map(d => [d, 0])) as Record<Domain, number>,
    upheaval: null,
    choosing: null,
  };
}

export type NodeStatus =
  | { kind: 'taken' }
  | { kind: 'legacy'; adoptable: boolean }
  | { kind: 'available' }
  | { kind: 'locked'; by: string }
  | { kind: 'needs'; missing: string[] }
  | { kind: 'upheaval' };

const has = (c: CultureState, id: string) => c.taken.includes(id) || c.legacy.includes(id);

export function nodeStatus(civ: Civ, node: CultureNode): NodeStatus {
  const c = civ.culture;
  if (c.taken.includes(node.id)) return { kind: 'taken' };
  if (node.fork) {
    const other = c.taken.find(id => id !== node.id && CULTURE[id]?.fork === node.fork);
    if (other) return { kind: 'locked', by: other };
  }
  const missing = [
    ...node.requires.filter(r => !has(c, r)),
    ...(node.requiresAny.length && !node.requiresAny.some(r => has(c, r))
      ? [node.requiresAny.join('|')]
      : []),
  ];
  if (c.legacy.includes(node.id))
    return { kind: 'legacy', adoptable: !missing.length && c.upheaval?.domain !== node.domain };
  if (missing.length) return { kind: 'needs', missing };
  if (c.upheaval?.domain === node.domain) return { kind: 'upheaval' };
  return { kind: 'available' };
}

export function nodeCost(s: GameState, civ: Civ, node: CultureNode): number {
  const m = civMods(s, civ.id);
  return Math.round(node.cost * (1 + civ.culture.taken.length * 0.06) * pct(m.cultureCostPct));
}

export function takeNode(s: GameState, civId: number, id: string): { ok: boolean; msg: string } {
  const civ = s.civs[civId];
  const node = CULTURE[id];
  if (!node) return { ok: false, msg: 'Unknown choice.' };
  const st = nodeStatus(civ, node);
  if (!(st.kind === 'available' || (st.kind === 'legacy' && st.adoptable))) {
    const why =
      st.kind === 'locked'
        ? `Closed by ${CULTURE[st.by].name}.`
        : st.kind === 'needs'
          ? 'Requirements not met.'
          : st.kind === 'upheaval'
            ? `${DOMAINS[node.domain].name} is in upheaval.`
            : 'Already taken.';
    return { ok: false, msg: why };
  }
  const cost = nodeCost(s, civ, node);
  if (civ.culture.points < cost)
    return {
      ok: false,
      msg: `Needs ${cost} culture (you have ${Math.floor(civ.culture.points)}).`,
    };
  civ.culture.points -= cost;
  civ.culture.legacy = civ.culture.legacy.filter(x => x !== id);
  civ.culture.taken.push(id);
  const m = civMods(s, civId);
  civ.culture.tension[node.domain] += node.tension * pct(m.tensionPct);
  s.log.push({ turn: s.turn, civId, text: `The ${civ.name} embraced ${node.name}.` });
  return { ok: true, msg: `${node.name} adopted.` };
}

export function canStartUpheaval(civ: Civ, d: Domain): string | null {
  if (civ.culture.upheaval)
    return `Already in ${DOMAINS[civ.culture.upheaval.domain].upheaval.toLowerCase()}.`;
  if (civ.culture.choosing) return 'Settle the last upheaval first.';
  if (civ.culture.tension[d] < UPHEAVAL_AT) return `Tension must reach ${UPHEAVAL_AT}.`;
  return null;
}

export function startUpheaval(
  s: GameState,
  civId: number,
  d: Domain,
): { ok: boolean; msg: string } {
  const civ = s.civs[civId];
  const why = canStartUpheaval(civ, d);
  if (why) return { ok: false, msg: why };
  civ.culture.upheaval = { domain: d, turnsLeft: UPHEAVAL_TURNS };
  const msg = `${DOMAINS[d].upheaval} among the ${civ.name}!`;
  s.log.push({ turn: s.turn, civId, text: msg });
  return { ok: true, msg };
}

/**
 * End of an upheaval: up to two current choices in the domain are kept, the rest become legacy
 * (half effect, no tags), and the domain's forks open again.
 */
export function resolveUpheaval(
  s: GameState,
  civId: number,
  keep: string[],
): { ok: boolean; msg: string } {
  const civ = s.civs[civId];
  const d = civ.culture.choosing;
  if (!d) return { ok: false, msg: 'No upheaval to settle.' };
  const k = new Set(keep.slice(0, KEEP_AFTER_UPHEAVAL));
  const moving = civ.culture.taken.filter(id => CULTURE[id]?.domain === d && !k.has(id));
  civ.culture.taken = civ.culture.taken.filter(id => !moving.includes(id));
  civ.culture.legacy.push(...moving.filter(id => !civ.culture.legacy.includes(id)));
  civ.culture.tension[d] = 0;
  civ.culture.choosing = null;
  const msg = `After the ${DOMAINS[d].upheaval.toLowerCase()}, the ${civ.name} keep ${k.size ? [...k].map(id => CULTURE[id].name).join(' and ') : 'nothing of the old ways'}. New paths are open.`;
  s.log.push({ turn: s.turn, civId, text: msg });
  return { ok: true, msg };
}

/** Choices in a domain the player may keep after its upheaval: the current ones. */
export const keepable = (civ: Civ, d: Domain) =>
  civ.culture.taken.filter(id => CULTURE[id]?.domain === d);

/** Once a turn: add points, build tension, run upheavals. Returns messages for the player. */
export function cultureTurn(s: GameState, civ: Civ, points: number): string[] {
  const out: string[] = [];
  const c = civ.culture;
  c.points += points;
  const m = civMods(s, civ.id);
  const k = pct(m.tensionPct);
  // tension grows with how deep the people has gone down each domain
  for (const d of DOMAIN_LIST) {
    const n = c.taken.filter(id => CULTURE[id]?.domain === d).length;
    c.tension[d] += n * 0.13 * k;
  }
  // neighbours with opposed ideas press on each other
  const mine = tagCounts(civ);
  const g = { w: s.map.w, h: s.map.h };
  for (const o of s.civs) {
    if (o.id === civ.id || !o.alive || !civ.met.includes(o.id)) continue;
    const near = s.cities.some(
      a =>
        a.civId === civ.id &&
        s.cities.some(b => b.civId === o.id && distance(g, a.hex, b.hex) <= 10),
    );
    if (!near) continue;
    const theirs = tagCounts(o);
    for (const [a, b, d] of OPPOSED) {
      if (
        ((mine[a] ?? 0) >= 2 && (theirs[b] ?? 0) >= 2) ||
        ((mine[b] ?? 0) >= 2 && (theirs[a] ?? 0) >= 2)
      )
        c.tension[d] += 0.15 * k;
    }
  }
  for (const d of DOMAIN_LIST) c.tension[d] = Math.max(0, c.tension[d]);
  // upheavals run their course
  if (c.upheaval) {
    c.upheaval.turnsLeft--;
    if (c.upheaval.turnsLeft <= 0) {
      const d = c.upheaval.domain;
      c.upheaval = null;
      c.choosing = d;
      if (civ.isPlayer)
        out.push(`The ${DOMAINS[d].upheaval.toLowerCase()} is over. Choose what to keep.`);
      else {
        // the AI keeps its two most advanced choices in the domain
        const keep = keepable(civ, d)
          .sort((a, b) => CULTURE[b].tier - CULTURE[a].tier)
          .slice(0, KEEP_AFTER_UPHEAVAL);
        resolveUpheaval(s, civ.id, keep);
      }
    }
  } else if (!c.choosing) {
    const hot = DOMAIN_LIST.find(d => c.tension[d] >= FORCED_AT);
    if (hot) {
      const r = startUpheaval(s, civ.id, hot);
      if (civ.isPlayer && r.ok)
        out.push(`${r.msg} Tension in ${DOMAINS[hot].name.toLowerCase()} boiled over.`);
    }
  }
  return out;
}

export const CULTURE_COUNT = CULTURE_LIST.length;
