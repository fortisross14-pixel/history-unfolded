/**
 * National directions (see data/paths.ts): offered when a people enters the Classical age and
 * the Renaissance, chosen once, kept for the rest of the game. Each brings an edict. Alternate
 * developments are offered only to a people whose own history fits them; the first people to
 * reach an age never decides the path for anyone else.
 */
import { PATH_LIST, PATHS, type NationalPath } from '../data/paths.ts';
import { ERAS } from '../data/techs.ts';
import { gridOf, levy, log, trainSettlers } from './game.ts';
import { neighbors } from './hex.ts';
import { isWater } from '../data/terrain.ts';
import { identity } from './mods.ts';
import { hashSeed, mulberry32 } from './rng.ts';
import type { Civ, GameState } from './types.ts';

export const WEALTH_SHARE = 0.25;

const mine = (s: GameState, civId: number) => s.cities.filter(c => c.civId === civId);
const largest = (s: GameState, civId: number) => mine(s, civId).sort((a, b) => b.pop - a.pop);

/** Does the people's own history open this alternate development? */
export function pathNeedMet(s: GameState, civ: Civ, p: NationalPath): boolean {
  if (p.needs === 'wealth') {
    const world = s.civs.filter(c => c.alive).reduce((a, c) => a + (c.stats?.gdp ?? 0), 0);
    return world > 0 && (civ.stats?.gdp ?? 0) / world >= WEALTH_SHARE;
  }
  if (p.needs === 'conquest') return (civ.captured ?? 0) >= 1;
  return true;
}

/** The directions a people may choose now (empty when none is due). */
export function pathOptions(s: GameState, civ: Civ): NationalPath[] {
  if (!civ.pathDue) return [];
  return PATH_LIST.filter(p => p.age === civ.pathDue && pathNeedMet(s, civ, p));
}

/** The alternate developments of the due age the people does not (yet) qualify for. */
export const lockedOptions = (s: GameState, civ: Civ) =>
  civ.pathDue ? PATH_LIST.filter(p => p.age === civ.pathDue && !pathNeedMet(s, civ, p)) : [];

/** A direction works half again as well for a people that holds its culture tag. */
export const pathStrength = (civ: Civ, p: NationalPath) =>
  identity(civ).some(t => t.tag === p.synergy && t.tier > 0) ? 1.5 : 1;

export function choosePath(s: GameState, civId: number, id: string): { ok: boolean; msg: string } {
  const civ = s.civs[civId];
  const p = PATHS[id];
  if (!p || !pathOptions(s, civ).includes(p))
    return { ok: false, msg: 'That direction is not open to you now.' };
  civ.paths = [...(civ.paths ?? []), id];
  civ.pathDue = undefined;
  log(s, civId, `The ${civ.name} take a new direction: ${p.name}.`);
  return { ok: true, msg: `${p.name}: ${p.effects.join(', ')}.` };
}

/** Called when a people enters a new age. */
export function enterAge(s: GameState, civ: Civ, age: number) {
  if (age === 2 || age === 4) civ.pathDue = age;
  if (civ.isPlayer) s.ageCard = age;
  else if (civ.pathDue) aiChoosePath(s, civ);
}

// ---------------------------------------------------------------- edicts

export function edictProblem(s: GameState, civ: Civ, id: string): string | null {
  const p = PATHS[id];
  if (!p || !civ.paths?.includes(id)) return 'Not your direction.';
  const last = civ.edicts?.[id];
  if (last !== undefined && s.turn - last < p.edict.cooldown)
    return `Ready in ${p.edict.cooldown - (s.turn - last)} turns.`;
  if (civ.gold < p.edict.gold) return `Needs ${p.edict.gold} gold.`;
  if (!mine(s, civ.id).length) return 'Needs a settlement.';
  return null;
}

/** Issue a direction's edict. */
export function useEdict(s: GameState, civId: number, id: string): { ok: boolean; msg: string } {
  const civ = s.civs[civId];
  const why = edictProblem(s, civ, id);
  if (why) return { ok: false, msg: why };
  const p = PATHS[id];
  const calm = (n: number) => {
    for (const d of civ.dynasties) d.unrest = Math.max(0, Math.min(100, d.unrest + n));
  };
  const big = largest(s, civId);
  let msg = '';
  switch (id) {
    case 'republic':
      calm(-20);
      msg = 'The Senate meets; the houses are heard.';
      break;
    case 'monarchy': {
      const r = levy(s, big[0].id);
      if (!r.ok) return { ok: false, msg: r.msg ?? 'No levy could be raised.' };
      msg = r.msg ?? 'The royal levy musters.';
      break;
    }
    case 'bureaucracy': {
      const people = mine(s, civId).reduce((a, c) => a + c.pop, 0);
      const gold = Math.floor(people / 1000) * 5;
      civ.gold += gold;
      calm(10);
      msg = `The census is taken: ${gold} gold in taxes.`;
      break;
    }
    case 'companies': {
      const coastal = mine(s, civId).filter(c => isCoastal(s, c.hex));
      civ.gold += coastal.length * 25;
      msg = `${coastal.length} ports charter companies: ${coastal.length * 25} gold.`;
      break;
    }
    case 'colonial': {
      const c = big[0];
      const before = c.pop;
      const r = trainSettlers(s, c.id);
      if (!r.ok) return { ok: false, msg: r.msg ?? 'No settlers could leave.' };
      c.pop = before;
      msg = `Colonists leave ${c.name} under a royal charter.`;
      break;
    }
    case 'reform':
      civ.culture.points += 25;
      calm(-10);
      msg = 'Sermons in the common tongue: +25 culture.';
      break;
    case 'commercial-renaissance':
      civ.gold += 60;
      civ.culture.points += 10;
      msg = 'The Great Fair draws merchants from every coast: +60 gold, +10 culture.';
      break;
    case 'age-of-conquest': {
      const raised = big.slice(0, 2).filter(c => levy(s, c.id).ok).length;
      if (!raised) return { ok: false, msg: 'No settlement is large enough to raise a levy.' };
      msg = `${raised} host${raised > 1 ? 's' : ''} muster.`;
      break;
    }
  }
  civ.gold -= p.edict.gold;
  civ.edicts = { ...(civ.edicts ?? {}), [id]: s.turn };
  log(s, civId, `${p.edict.name}: ${msg}`);
  return { ok: true, msg: `${p.edict.name}: ${msg}` };
}

const isCoastal = (s: GameState, hex: number) =>
  neighbors(gridOf(s), hex).some(k => isWater(s.map.terrain[k]));

// ---------------------------------------------------------------- AI

function aiChoosePath(s: GameState, civ: Civ) {
  const opts = pathOptions(s, civ);
  if (!opts.length) return;
  // an alternate development earned by its history comes first; then the one its culture favours
  const best = opts
    .map(p => ({
      p,
      // each people its own taste, seeded, so peoples diverge
      w:
        (p.needs ? 3 : 1) * pathStrength(civ, p) +
        mulberry32(
          hashSeed(
            s.settings.map.seed,
            civ.id * 31 + ([...p.id].reduce((a, ch) => a * 33 + ch.charCodeAt(0), 7) % 100003),
          ),
        )(),
    }))
    .sort((a, b) => b.w - a.w)[0].p;
  choosePath(s, civ.id, best.id);
}

/** Each turn for an AI people: choose a due direction, issue edicts when they pay. */
export function aiPathTurn(s: GameState, civ: Civ) {
  if (civ.pathDue) aiChoosePath(s, civ);
  for (const id of civ.paths ?? []) {
    const p = PATHS[id];
    if (edictProblem(s, civ, id)) continue;
    if (civ.gold < p.edict.gold + 40) continue;
    // calming edicts only when a house is restless
    if ((id === 'republic' || id === 'reform') && !civ.dynasties.some(d => d.unrest >= 40))
      continue;
    if (id === 'bureaucracy' && civ.dynasties.some(d => d.unrest >= 60)) continue;
    useEdict(s, civ.id, id);
  }
}

export const ageName = (age: number) => ERAS[age] ?? '';
