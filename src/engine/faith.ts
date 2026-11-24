/**
 * Faiths, kept light. A people with Mysticism and a shrine can found a faith: the world has room
 * for only a few, so founding is a race. A faith then spreads by itself from settlement to
 * settlement; shrines, temples, a cathedral and the holy city push it, roads and trade carry it,
 * a settlement's own faith resists. Nothing to move or manage.
 *
 * - The founder chooses three tenets over the ages: a founding belief that rewards the founder as
 *   the faith spreads (gold, culture, faster spread or braver armies), then a teaching
 *   (Priesthood) and a doctrine (Theology) that help every people whose faith it is.
 * - A people's faith is the one most of its people keep (a third at least).
 * - Sharing a faith warms opinion; keeping different ones cools it, more so for zealous peoples.
 * - A realm split between faiths builds religious tension, which can bring on a schism crisis.
 */
import { TENETS, TENET_SLOTS, faithName, tenetsFor, type TenetSlot } from '../data/faiths.ts';
import { difficultyOf } from './difficulty.ts';
import { cityDistricts } from './economy.ts';
import { log } from './game.ts';
import { distance } from './hex.ts';
import { civMods, pct, tagCounts } from './mods.ts';
import { hashSeed, mulberry32 } from './rng.ts';
import type { City, Civ, Faith, GameState } from './types.ts';

/** how far a settlement's faith reaches, in hexes */
export const FAITH_REACH = 6;
/** turns a faith must be the stronger before a settlement takes it up */
export const CONVERT_TURNS = 5;
/** a share of the realm's people outside its faith above this builds religious tension */
export const DIVIDED_AT = 0.35;
/** religious tension a divided faith alone can build up to (a schism needs 50) */
export const DIVIDED_CAP = 80;

export const faithById = (s: GameState, id: number | undefined): Faith | undefined =>
  id === undefined ? undefined : s.faiths?.find(f => f.id === id);
export const foundedBy = (s: GameState, civId: number): Faith | undefined =>
  s.faiths?.find(f => f.founder === civId);
/** How many faiths the world has room for: one for every two great peoples, two at least. */
export const maxFaiths = (s: GameState) =>
  Math.max(2, Math.ceil(s.civs.filter(c => !c.independent).length / 2));

const built = (s: GameState, c: City, type: string) =>
  cityDistricts(s, c).reduce(
    (a, d) => a + d.slots.filter(x => x.built && x.type === type).length,
    0,
  );

/** How strongly a settlement's faith reaches out (and holds on). */
export function faithScore(s: GameState, c: City): number {
  if (c.faith === undefined) return 0;
  const f = faithById(s, c.faith);
  return (
    1 +
    built(s, c, 'shrine') +
    2 * built(s, c, 'temple') +
    4 * built(s, c, 'cathedral') +
    (f && f.holy === c.id ? 5 : 0)
  );
}

/** How much faster a faith spreads, from its tenets. */
const spreadOf = (f: Faith) => f.tenets.reduce((a, t) => a * (TENETS[t]?.spread ?? 1), 1);

const traders = (s: GameState, a: number, b: number) =>
  s.treaties.some(
    t => t.kind === 'trade' && ((t.a === a && t.b === b) || (t.a === b && t.b === a)),
  );

/** The pull of each faith on a settlement this turn (its own faith counts as resistance). */
export function pressures(s: GameState, c: City): Map<number, number> {
  const g = { w: s.map.w, h: s.map.h };
  const p = new Map<number, number>();
  for (const o of s.cities) {
    if (o === c || o.faith === undefined) continue;
    const d = distance(g, c.hex, o.hex);
    if (d > FAITH_REACH) continue;
    const f = faithById(s, o.faith);
    if (!f) continue;
    let w = (faithScore(s, o) / Math.max(1, d)) * spreadOf(f);
    if (s.roads[o.hex] && s.roads[c.hex]) w *= 1.5;
    if (o.civId === c.civId) w *= 1.5;
    else if (traders(s, o.civId, c.civId)) w *= 1.25;
    p.set(o.faith, (p.get(o.faith) ?? 0) + w);
  }
  if (c.faith !== undefined) {
    const owner = s.civs[c.civId];
    const zealous = (tagCounts(owner).zealous ?? 0) >= 2 ? 1.5 : 1;
    p.set(c.faith, (p.get(c.faith) ?? 0) + faithScore(s, c) * 2 * zealous);
  }
  return p;
}

/** The faith gaining on a settlement, if any: the strongest other one, when strong enough. */
function contender(s: GameState, c: City): number | undefined {
  const p = pressures(s, c);
  const mine = c.faith !== undefined ? (p.get(c.faith) ?? 0) : 0;
  let best: number | undefined,
    bv = 0;
  for (const [f, v] of p) if (f !== c.faith && v > bv) [best, bv] = [f, v];
  if (best === undefined) return undefined;
  return c.faith === undefined ? (bv >= 1 ? best : undefined) : bv > mine * 1.2 ? best : undefined;
}

/** The people of a realm by faith (undefined: none), and in all. */
export function realmFaiths(s: GameState, civId: number) {
  const by = new Map<number | undefined, number>();
  let all = 0;
  for (const c of s.cities)
    if (c.civId === civId) {
      by.set(c.faith, (by.get(c.faith) ?? 0) + c.pop);
      all += c.pop;
    }
  return { by, all };
}

/** Settlements keeping a faith, anywhere; and those of other peoples than its founder. */
export function followers(s: GameState, f: Faith) {
  const all = s.cities.filter(c => c.faith === f.id);
  return { all: all.length, foreign: all.filter(c => c.civId !== f.founder).length };
}

/** What the founder gains each turn from its faith. */
export function faithIncome(s: GameState, civId: number) {
  const f = foundedBy(s, civId);
  if (!f) return { gold: 0, culture: 0 };
  const n = followers(s, f);
  let gold = 0,
    culture = 0;
  for (const t of f.tenets) {
    gold += (TENETS[t]?.tithe ?? 0) * n.all;
    culture += (TENETS[t]?.pilgrims ?? 0) * n.foreign;
  }
  return { gold, culture };
}

// ---------------------------------------------------------------- founding and tenets

export function foundProblem(s: GameState, civId: number): string | null {
  const civ = s.civs[civId];
  if (civ.independent) return 'Free peoples keep their own old beliefs.';
  if (foundedBy(s, civId)) return 'Your people have founded a faith already.';
  if ((s.faiths?.length ?? 0) >= maxFaiths(s))
    return `All ${maxFaiths(s)} faiths the world has room for are founded.`;
  if (!civ.techs.includes('mysticism')) return 'Needs Mysticism.';
  if (!s.cities.some(c => c.civId === civId && built(s, c, 'shrine') + built(s, c, 'temple') > 0))
    return 'Needs a shrine built in one of your settlements.';
  return null;
}

/** A name for a new faith nobody uses yet. */
export function suggestName(s: GameState, civId: number) {
  return faithName(
    hashSeed(s.settings.map.seed, civId * 131 + (s.faiths?.length ?? 0)),
    (s.faiths ?? []).map(f => f.name),
  );
}

export function foundFaith(
  s: GameState,
  civId: number,
  tenet: string,
  name?: string,
): { ok: boolean; msg: string } {
  const why = foundProblem(s, civId);
  if (why) return { ok: false, msg: why };
  if (TENETS[tenet]?.slot !== 'founding') return { ok: false, msg: 'Choose a founding belief.' };
  const nm = (name ?? '').trim().slice(0, 40) || suggestName(s, civId);
  if (s.faiths?.some(f => f.name.toLowerCase() === nm.toLowerCase()))
    return { ok: false, msg: 'Another faith has that name.' };
  const mine = s.cities.filter(c => c.civId === civId);
  // the holy city: where worship is strongest, the capital on a tie
  const holy = mine
    .map(c => ({ c, v: built(s, c, 'temple') * 2 + built(s, c, 'shrine') }))
    .sort((a, b) => b.v - a.v || a.c.founded - b.c.founded)[0].c;
  s.faiths ??= [];
  const f: Faith = {
    id: s.faiths.length ? Math.max(...s.faiths.map(x => x.id)) + 1 : 0,
    name: nm,
    founder: civId,
    holy: holy.id,
    founded: s.turn,
    tenets: [tenet],
  };
  s.faiths.push(f);
  // the holy city and the realm's settlements that keep no faith yet take it up at once
  const g = { w: s.map.w, h: s.map.h };
  for (const c of mine)
    if (c === holy || (c.faith === undefined && distance(g, c.hex, holy.hex) <= FAITH_REACH)) {
      c.faith = f.id;
      delete c.conv;
    }
  s.civs[civId].faith = f.id;
  const msg = `The ${s.civs[civId].name} found a new faith, ${nm}, in ${holy.name}.`;
  log(s, civId, msg);
  return { ok: true, msg };
}

/** The tenet the founder may choose now, if any. */
export function tenetDue(s: GameState, civId: number): TenetSlot | null {
  const f = foundedBy(s, civId);
  if (!f) return null;
  const civ = s.civs[civId];
  for (const sl of TENET_SLOTS) {
    if (f.tenets.some(t => TENETS[t]?.slot === sl.slot)) continue;
    if (sl.tech && !civ.techs.includes(sl.tech)) return null;
    return sl.slot;
  }
  return null;
}

export function chooseTenet(s: GameState, civId: number, id: string): { ok: boolean; msg: string } {
  const f = foundedBy(s, civId);
  const due = tenetDue(s, civId);
  const t = TENETS[id];
  if (!f || !due) return { ok: false, msg: 'No tenet to choose now.' };
  if (!t || t.slot !== due) return { ok: false, msg: 'That tenet is not open now.' };
  f.tenets.push(id);
  const msg = `${f.name} takes up a new tenet: ${t.name}.`;
  log(s, civId, msg);
  return { ok: true, msg };
}

// ---------------------------------------------------------------- the turn

function aiPick(s: GameState, civ: Civ, slot: TenetSlot): string {
  const tags = tagCounts(civ);
  const r = mulberry32(hashSeed(s.settings.map.seed, s.turn * 37 + civ.id * 1009 + 17));
  return tenetsFor(slot)
    .map(t => ({ t, v: (t.tags ?? []).reduce((a, g) => a + (tags[g] ?? 0), 0) + r() * 2 }))
    .sort((a, b) => b.v - a.v)[0].t.id;
}

/** chance per turn that an AI people able to found a faith does, by difficulty */
export const AI_FOUND_CHANCE = { casual: 0.03, normal: 0.05, hard: 0.08 };
/** AI peoples found no faith before this turn, so a player who goes for it can win the race */
export const AI_FOUND_FROM = { casual: 40, normal: 30, hard: 20 };

/**
 * AI peoples found a faith when they can, though not at once, so the race stays open to the
 * player; and they choose their tenets.
 */
function aiFaith(s: GameState, civ: Civ) {
  const d = difficultyOf(s).id;
  if (s.turn >= AI_FOUND_FROM[d] && !foundProblem(s, civ.id)) {
    const r = mulberry32(hashSeed(s.settings.map.seed, s.turn * 53 + civ.id * 211 + 5));
    if (r() < AI_FOUND_CHANCE[d]) foundFaith(s, civ.id, aiPick(s, civ, 'founding'));
  }
  const due = tenetDue(s, civ.id);
  if (due) chooseTenet(s, civ.id, aiPick(s, civ, due));
}

/** Once a turn: faiths spread, peoples settle on a faith, founders collect, divided realms strain. */
export function faithTurn(s: GameState): string[] {
  const out: string[] = [];
  const me = s.civs.find(c => c.isPlayer);
  const before = s.faiths?.length ?? 0;
  for (const civ of s.civs) if (civ.alive && !civ.isPlayer && !civ.independent) aiFaith(s, civ);
  for (const f of (s.faiths ?? []).slice(before)) {
    const who =
      me && me.met.includes(f.founder) ? `The ${s.civs[f.founder].name}` : 'A distant people';
    out.push(
      `${who} founded a new faith, ${f.name} (${s.faiths!.length} of ${maxFaiths(s)} the world has room for).`,
    );
  }
  if (!s.faiths?.length) return out;
  // spreading: decided on this turn's state, then applied
  const changes: [City, number][] = [];
  for (const c of s.cities) {
    const f = contender(s, c);
    if (f === undefined) {
      if (c.conv && --c.conv.n <= 0) delete c.conv;
      continue;
    }
    c.conv = c.conv?.f === f ? { f, n: c.conv.n + 1 } : { f, n: 1 };
    if (c.conv.n >= CONVERT_TURNS) changes.push([c, f]);
  }
  for (const [c, f] of changes) {
    c.faith = f;
    delete c.conv;
    const faith = faithById(s, f)!;
    if (me && (c.civId === me.id || faith.founder === me.id))
      out.push(`${c.name} now keeps ${faith.name}.`);
  }
  for (const civ of s.civs) {
    if (!civ.alive || civ.independent) continue;
    // the people's faith: the one most of them keep, a third at least
    const { by, all } = realmFaiths(s, civ.id);
    let best: number | undefined,
      bv = 0;
    for (const [f, n] of by) if (f !== undefined && n > bv) [best, bv] = [f, n];
    const next = all && bv >= all / 3 ? best : undefined;
    if (next !== civ.faith) {
      const was = faithById(s, civ.faith);
      civ.faith = next;
      const now = faithById(s, next);
      if (now) log(s, civ.id, `The ${civ.name} now keep ${now.name}.`);
      else if (was) log(s, civ.id, `The ${civ.name} drift away from ${was.name}.`);
      if (civ.isPlayer)
        out.push(
          now
            ? `Your people now keep ${now.name}${now.founder === civ.id ? '' : `, the faith of the ${s.civs[now.founder].name}`}.`
            : 'Your people no longer keep one faith.',
        );
    }
    // a realm split between faiths strains: religious tension (the schism crisis needs 50)
    if (civ.faith !== undefined && all) {
      const outside = (all - (by.get(civ.faith) ?? 0)) / all;
      const t = civ.culture.tension.religion ?? 0;
      if (outside > DIVIDED_AT && t < DIVIDED_CAP)
        civ.culture.tension.religion = Math.min(
          DIVIDED_CAP,
          t + 0.8 * pct(civMods(s, civ.id).tensionPct),
        );
    }
    // the founder's rewards
    const inc = faithIncome(s, civ.id);
    civ.gold += inc.gold;
    civ.culture.points += inc.culture;
  }
  return out;
}
