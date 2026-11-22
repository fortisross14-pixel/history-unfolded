/**
 * The great houses of each people. One rules from the start; more rise as the realm grows and
 * the ages turn (see data/dynasties.ts). Each house has a level, 0..10, in every area (the
 * building lines and war): the traits it was born with, the experience of governing settlements
 * that work that line, and the trinkets it holds. Each settlement is governed by a house, whose
 * levels raise its lines there; the ruling house lends half of its levels to the whole realm.
 *
 * Power is the people a house governs and its levels. A house that outweighs the throne grows
 * restless and, at the limit, rises: the realm splits in civil war. The player picks a side and
 * keeps the other houses and the alliances; the other side becomes a realm of its own, at war.
 * After CIVIL_WAR_TURNS the bigger army wins the throne and the realm is one again; armies too
 * evenly matched end in a stalemate, and two realms remain. Under Democracy the houses are
 * parties: the one governing most people leads, reassigning is free, unrest grows far more
 * slowly, and the bonuses are smaller.
 */
import {
  AREAS,
  CIVIL_WAR_TURNS,
  COURT_SHARE,
  DEMOCRACY_BONUS,
  DEMOCRACY_UNREST,
  HONOURS_CALM,
  HONOURS_GOLD,
  HOUSE_COLORS,
  HOUSE_NAMES,
  LEVEL_PCT,
  MAX_DYNASTIES,
  MAX_LEVEL,
  MILITARY_CELLS,
  REVOLT_AT,
  STALEMATE_BAND,
  TRINKET_CHANCE,
  TRINKETS,
  XP_PER_LEVEL,
  type Area,
} from '../data/dynasties.ts';
import { SLOT_TYPES } from '../data/slots.ts';
import { ageOf } from '../data/techs.ts';
import { invalidateMarkets } from './economy.ts';
import { hashSeed, mulberry32 } from './rng.ts';
import type { City, Civ, Dynasty, GameState, Trinket } from './types.ts';
import { power as formationPower } from './units.ts';

type Result = { ok: boolean; msg?: string };
const ok = (msg?: string): Result => ({ ok: true, msg });
const fail = (msg: string): Result => ({ ok: false, msg });

export const isDemocracy = (civ: Civ) => civ.culture.taken.includes('democracy');
/** What the houses are called: dynasties, or parties under Democracy. */
export const houseWord = (civ: Civ) => (isDemocracy(civ) ? 'party' : 'house');

// ---------------------------------------------------------------- houses

/** A new house: two points in one area, one in another. */
function newHouse(s: GameState, civ: Civ, color: string): Dynasty {
  const r = mulberry32(
    hashSeed(s.settings.map.seed, 8100 + civ.id * 37 + (civ.dynasties?.length ?? 0) * 7 + s.turn),
  );
  const a = AREAS[Math.floor(r() * AREAS.length)];
  let b = AREAS[Math.floor(r() * AREAS.length)];
  if (b === a) b = AREAS[(AREAS.indexOf(a) + 3) % AREAS.length];
  return {
    id: s.nextId++,
    name: pickName(s, civ),
    color,
    trinkets: [],
    traits: { [a]: 2, [b]: 1 },
    xp: {},
    unrest: 0,
    founded: s.turn,
  };
}

/** A people's first house. */
export function foundingDynasty(s: GameState, civ: Civ): Dynasty {
  return newHouse(s, civ, HOUSE_COLORS[0]);
}

function pickName(s: GameState, civ: Civ): string {
  const used = new Set(s.civs.flatMap(c => (c.dynasties ?? []).map(d => d.name)));
  const free = HOUSE_NAMES.filter(n => !used.has(n));
  const r = mulberry32(
    hashSeed(s.settings.map.seed, 7000 + civ.id * 31 + (civ.dynasties?.length ?? 0)),
  );
  if (free.length) return free[Math.floor(r() * free.length)];
  return `${HOUSE_NAMES[Math.floor(r() * HOUSE_NAMES.length)]} the Younger`;
}

/** How many houses the realm holds: two more in the second age once it has 3 settlements, then one per age. */
export function dynastyCap(s: GameState, civ: Civ): number {
  const n = s.cities.filter(c => c.civId === civ.id).length;
  if (n < 3) return 1;
  const age = ageOf(civ.techs);
  return Math.min(MAX_DYNASTIES, age >= 4 ? 5 : age >= 3 ? 4 : age >= 2 ? 3 : 1);
}

export const rulerOf = (civ: Civ) =>
  civ.dynasties.find(d => d.id === civ.ruling) ?? civ.dynasties[0];

export function governorOf(s: GameState, c: City): Dynasty | undefined {
  const civ = s.civs[c.civId];
  if (!civ.dynasties?.length) return undefined;
  return civ.dynasties.find(d => d.id === c.governor) ?? rulerOf(civ);
}

/** Trinkets of an area a house holds. */
export const trinketsOf = (d: Dynasty, area: Area) =>
  d.trinkets.filter(t => t.line === area).length;

/** A house's level in an area: traits + experience + trinkets, at most 10. */
export function levelOf(d: Dynasty, area: Area): number {
  return Math.min(
    MAX_LEVEL,
    (d.traits?.[area] ?? 0) + Math.floor((d.xp?.[area] ?? 0) / XP_PER_LEVEL) + trinketsOf(d, area),
  );
}
/** Progress (0..1) to the next level from experience. */
export const xpProgress = (d: Dynasty, area: Area) =>
  ((d.xp?.[area] ?? 0) % XP_PER_LEVEL) / XP_PER_LEVEL;
export const totalLevels = (d: Dynasty) => AREAS.reduce((a, x) => a + levelOf(d, x), 0);

/** Each house's weight in the realm: the people it governs, and 300 for each level it holds. */
export function powerOf(s: GameState, civ: Civ): Map<number, { people: number; share: number }> {
  const out = new Map<number, { people: number; share: number }>();
  for (const d of civ.dynasties) out.set(d.id, { people: 0, share: 0 });
  for (const c of s.cities) {
    if (c.civId !== civ.id) continue;
    const g = governorOf(s, c);
    if (g) out.get(g.id)!.people += c.pop;
  }
  let total = 0;
  const weight = new Map<number, number>();
  for (const d of civ.dynasties) {
    const w = out.get(d.id)!.people + totalLevels(d) * 300;
    weight.set(d.id, w);
    total += w;
  }
  for (const d of civ.dynasties) out.get(d.id)!.share = total ? weight.get(d.id)! / total : 0;
  return out;
}

/** What a settlement teaches its governor, by area: the share of its buildings in each. */
export function settlementAreas(s: GameState, c: City): Partial<Record<Area, number>> {
  const n: Partial<Record<Area, number>> = {};
  let all = 0;
  for (const d of s.districts) {
    if (d.cityId !== c.id) continue;
    for (const x of d.slots) {
      if (!x.type || !x.built) continue;
      const t = SLOT_TYPES[x.type];
      const area: Area | undefined = MILITARY_CELLS.includes(t.id) ? 'military' : t.line;
      if (!area) continue;
      // the War College teaches war three times over
      const w = t.id === 'war-college' ? 3 : 1;
      n[area] = (n[area] ?? 0) + w;
      all += w;
    }
  }
  if (all) for (const k of Object.keys(n) as Area[]) n[k] = n[k]! / all;
  return n;
}

/**
 * The bonus (in %) a settlement's buildings of each line get from the houses: its governor's
 * levels in full, the ruling house's at half (when the ruler does not govern it already).
 */
export function lineBonus(s: GameState, c: City): Partial<Record<Area, number>> {
  const civ = s.civs[c.civId];
  if (!civ.dynasties?.length) return {};
  const gov = governorOf(s, c)!;
  const ruler = rulerOf(civ);
  const k = isDemocracy(civ) ? DEMOCRACY_BONUS : 1;
  const out: Partial<Record<Area, number>> = {};
  for (const area of AREAS) {
    let v = levelOf(gov, area) * LEVEL_PCT;
    if (ruler.id !== gov.id) v += levelOf(ruler, area) * LEVEL_PCT * COURT_SHARE;
    if (v) out[area] = v * k;
  }
  return out;
}

/** War levels of the governor: levies raised there start seasoned. */
export const levyXpFrom = (s: GameState, c: City) =>
  Math.floor(levelOf(governorOf(s, c) ?? rulerOf(s.civs[c.civId]), 'military') / 3);

/** The split realms are at war: their settlements make a tenth less. */
export function warPenalty(s: GameState, c: City): number {
  const civ = s.civs[c.civId];
  const w =
    civ.civilWar ?? (civ.splitFrom !== undefined ? s.civs[civ.splitFrom]?.civilWar : undefined);
  return w && !w.pending ? 0.9 : 1;
}

// ---------------------------------------------------------------- actions

export function assignGovernor(s: GameState, civId: number, cityId: number, dynId: number): Result {
  const civ = s.civs[civId];
  const c = s.cities.find(x => x.id === cityId && x.civId === civId);
  const d = civ.dynasties.find(x => x.id === dynId);
  if (!c || !d) return fail('No such settlement or house.');
  const was = governorOf(s, c);
  if (was?.id === d.id) return ok();
  if (civ.civilWar?.pending) return fail('Choose a side in the civil war first.');
  c.governor = d.id;
  // a house stripped of a governorship takes offence (parties shrug)
  if (was && !isDemocracy(civ)) was.unrest = Math.min(REVOLT_AT - 1, was.unrest + 10);
  if (isDemocracy(civ)) civ.ruling = largestParty(s, civ);
  return ok(`House ${d.name} now governs ${c.name}.`);
}

export function giveTrinket(s: GameState, civId: number, trinketId: number, dynId: number): Result {
  const civ = s.civs[civId];
  const t = civ.trinkets.find(x => x.id === trinketId);
  const d = civ.dynasties.find(x => x.id === dynId);
  if (!t || !d) return fail('No such trinket or house.');
  civ.trinkets = civ.trinkets.filter(x => x !== t);
  d.trinkets.push(t);
  // a gift soothes
  d.unrest = Math.max(0, d.unrest - 10);
  return ok(`The ${t.name} goes to House ${d.name}.`);
}

/** Calm a house with honours and gold. */
export function grantHonours(s: GameState, civId: number, dynId: number): Result {
  const civ = s.civs[civId];
  const d = civ.dynasties.find(x => x.id === dynId);
  if (!d) return fail('No such house.');
  const cost = honoursCost(s, civ);
  if (civ.gold < cost) return fail(`Honours cost ${cost} gold.`);
  civ.gold -= cost;
  d.unrest = Math.max(0, d.unrest - HONOURS_CALM);
  return ok(`House ${d.name} is honoured at court (${cost} gold).`);
}
export const honoursCost = (s: GameState, civ: Civ) =>
  HONOURS_GOLD * Math.max(1, s.cities.filter(c => c.civId === civ.id).length);

function largestParty(s: GameState, civ: Civ): number {
  const p = powerOf(s, civ);
  return [...civ.dynasties].sort((a, b) => p.get(b.id)!.people - p.get(a.id)!.people)[0].id;
}

/** A trinket for the treasury. */
export function awardTrinket(s: GameState, civ: Civ, area: Area, salt: number): Trinket {
  const r = mulberry32(hashSeed(s.settings.map.seed, s.turn * 613 + civ.id * 29 + salt));
  const names = TRINKETS[area];
  const t: Trinket = { id: s.nextId++, name: names[Math.floor(r() * names.length)], line: area };
  civ.trinkets.push(t);
  return t;
}

/** A finished building may yield a trinket of its line. */
export function maybeTrinket(s: GameState, civ: Civ, area: Area, salt: number): Trinket | null {
  const r = mulberry32(hashSeed(s.settings.map.seed, s.turn * 977 + civ.id * 53 + salt));
  if (r() >= TRINKET_CHANCE) return null;
  return awardTrinket(s, civ, area, salt);
}

// ---------------------------------------------------------------- civil war

/** The armies of a realm, by fighting strength. */
export function armyStrength(s: GameState, civId: number): number {
  return s.formations
    .filter(f => f.civId === civId && f.kind === 'army')
    .reduce((a, f) => a + formationPower(f), 0);
}

/**
 * The realm splits. `side` is the house the player (or the AI throne) stands with: it keeps its
 * settlements, all other houses and theirs, and the alliances. The other house's settlements,
 * with the armies and ships nearest them, become a realm of their own, at war.
 */
export function chooseSide(s: GameState, civId: number, side: number): Result {
  const civ = s.civs[civId];
  const war = civ.civilWar;
  if (!war?.pending) return fail('There is no civil war to choose a side in.');
  const ruler = rulerOf(civ);
  const rebel = civ.dynasties.find(d => d.id === war.rebel);
  if (!rebel) return fail('No such house.');
  if (side !== ruler.id && side !== rebel.id) return fail('Pick the throne or the rebels.');
  const other = side === ruler.id ? rebel : ruler;
  const kept = side === ruler.id ? ruler : rebel;
  const lost = s.cities.filter(c => c.civId === civ.id && governorOf(s, c)?.id === other.id);
  if (!lost.length) {
    // the other house governs nothing: there is no realm to split off; it simply yields
    civ.civilWar = undefined;
    civ.ruling = kept.id;
    for (const d of civ.dynasties) d.unrest = 0;
    return ok(`House ${other.name} holds no settlement and bows to House ${kept.name}.`);
  }
  const g = { w: s.map.w, h: s.map.h };
  const id = s.civs.length;
  const pop = (cs: City[]) => cs.reduce((a, c) => a + c.pop, 0);
  const all = s.cities.filter(c => c.civId === civ.id);
  const shareLost = pop(lost) / Math.max(1, pop(all));
  const used = new Set(s.civs.map(c => c.color));
  const color = [other.color, ...HOUSE_COLORS].find(c => !used.has(c)) ?? other.color;
  const copy = structuredClone({
    techs: civ.techs,
    culture: civ.culture,
    leanings: civ.leanings,
    designs: civ.designs,
    blueprints: civ.blueprints,
    explored: civ.explored,
  });
  const rival: Civ = {
    ...copy,
    id,
    name: `${other.name} ${civ.name}`,
    color,
    isPlayer: false,
    researching: null,
    researchGoal: null,
    science: 0,
    gold: Math.floor(civ.gold * shareLost),
    cityNames: civ.cityNames,
    levies: civ.levies,
    met: [...civ.met, civ.id],
    alive: true,
    kills: 0,
    losses: 0,
    dynasties: [other],
    ruling: other.id,
    trinkets: [],
    splitFrom: civ.id,
  };
  civ.gold -= rival.gold;
  s.civs.push(rival);
  civ.dynasties = civ.dynasties.filter(d => d !== other);
  civ.ruling = kept.id;
  civ.met.push(id);
  for (const o of s.civs) if (o !== rival && o !== civ && o.met.includes(civ.id)) o.met.push(id);
  // the breakaway settlements, and the troops nearest them
  const lostIds = new Set(lost.map(c => c.id));
  const dist = (a: number, b: number) =>
    Math.abs((a % g.w) - (b % g.w)) + Math.abs(Math.floor(a / g.w) - Math.floor(b / g.w));
  const nearest = (hex: number) =>
    all.reduce((best, c) => (dist(hex, c.hex) < dist(hex, best.hex) ? c : best), all[0]);
  const moving = new Set<number>();
  for (const f of s.formations) {
    if (f.civId !== civ.id || f.aboard !== undefined) continue;
    if (lostIds.has(nearest(f.hex).id)) moving.add(f.id);
  }
  for (const f of s.formations)
    if (
      f.civId === civ.id &&
      (moving.has(f.id) || (f.aboard !== undefined && moving.has(f.aboard)))
    ) {
      f.civId = id;
      f.path = [];
    }
  for (const c of lost) {
    c.civId = id;
    c.governor = undefined;
  }
  civ.civilWar = { rebel: other.id, since: s.turn, rival: id };
  for (const d of civ.dynasties) d.unrest = 0;
  s.wars.push({ a: civ.id, b: id, since: s.turn });
  invalidateMarkets();
  return ok(
    `The realm splits. You stand with House ${kept.name}; House ${other.name} holds ${lost.length} settlement${lost.length > 1 ? 's' : ''} as the ${rival.name}. Defeat them within ${CIVIL_WAR_TURNS} turns, or the bigger army takes the throne.`,
  );
}

/** Give in: the other side takes the throne and the realm is one again. */
export function yieldThrone(s: GameState, civId: number): Result {
  const civ = s.civs[civId];
  const war = civ.civilWar;
  if (!war) return fail('There is no civil war.');
  if (war.pending) {
    // yielding before the split: the rebels simply take the throne
    civ.ruling = war.rebel;
    civ.civilWar = undefined;
    for (const d of civ.dynasties) d.unrest = 0;
    return ok(`House ${rulerOf(civ).name} takes the throne without a fight.`);
  }
  return ok(reunify(s, civ, false));
}

/**
 * The realm is one again. `throneHolds`: the side that stayed (the player's) won; otherwise the
 * breakaway house takes the throne of the whole.
 */
function reunify(s: GameState, civ: Civ, throneHolds: boolean): string {
  const war = civ.civilWar!;
  const rival = s.civs[war.rival!];
  const theirHouse = rival.dynasties.find(d => d.id === rival.ruling) ?? rival.dynasties[0];
  const ours = rulerOf(civ);
  for (const c of s.cities) if (c.civId === rival.id) c.civId = civ.id;
  for (const f of s.formations) if (f.civId === rival.id) f.civId = civ.id;
  civ.gold += rival.gold;
  for (const d of rival.dynasties) if (!civ.dynasties.includes(d)) civ.dynasties.push(d);
  rival.alive = false;
  rival.dynasties = [];
  s.wars = s.wars.filter(w => w.a !== rival.id && w.b !== rival.id);
  s.treaties = s.treaties.filter(t => t.a !== rival.id && t.b !== rival.id);
  s.proposals = s.proposals.filter(p => p.from !== rival.id && p.to !== rival.id);
  civ.civilWar = undefined;
  for (const d of civ.dynasties) d.unrest = 0;
  const winner = throneHolds || !theirHouse ? ours : theirHouse;
  const loser = winner === ours ? theirHouse : ours;
  civ.ruling = winner.id;
  // the loser pays: half its treasures, half its learning
  let taken = 0;
  if (loser && loser !== winner) {
    const t = loser.trinkets.splice(0, Math.ceil(loser.trinkets.length / 2));
    winner.trinkets.push(...t);
    taken = t.length;
    for (const a of AREAS) if (loser.xp?.[a]) loser.xp[a] = Math.floor(loser.xp[a]! / 2);
  }
  invalidateMarkets();
  return `The civil war is over: House ${winner.name} rules the ${civ.name}, and the realm is one again.${loser ? ` House ${loser.name} gives up ${taken} trinket${taken === 1 ? '' : 's'} and half its learning.` : ''}`;
}

function stalemate(s: GameState, civ: Civ): string {
  const war = civ.civilWar!;
  const rival = s.civs[war.rival!];
  s.wars = s.wars.filter(
    w => !((w.a === civ.id && w.b === rival.id) || (w.b === civ.id && w.a === rival.id)),
  );
  civ.civilWar = undefined;
  rival.splitFrom = undefined;
  for (const d of civ.dynasties) d.unrest = 0;
  return `Stalemate: neither side can win. The ${rival.name} stand as a realm of their own, at peace with the ${civ.name}.`;
}

// ---------------------------------------------------------------- the turn

/** Experience, new houses, unrest, civil war. Returns messages for the player. */
export function dynastyTurn(s: GameState, civ: Civ): string[] {
  const out: string[] = [];
  if (!civ.dynasties?.length) return out;
  // governing teaches
  for (const c of s.cities) {
    if (c.civId !== civ.id) continue;
    const g = governorOf(s, c);
    if (!g) continue;
    g.xp ??= {};
    for (const [a, share] of Object.entries(settlementAreas(s, c)) as [Area, number][]) {
      const before = levelOf(g, a);
      g.xp[a] = (g.xp[a] ?? 0) + share;
      if (civ.isPlayer && levelOf(g, a) > before)
        out.push(
          `House ${g.name} grows in ${a === 'military' ? 'war' : a}: level ${levelOf(g, a)}.`,
        );
    }
  }
  // a civil war under way: one side falls, or the war's turns run out
  const war = civ.civilWar;
  if (war && !war.pending && war.rival !== undefined) {
    const rival = s.civs[war.rival];
    const theirs = s.cities.filter(c => c.civId === rival.id).length;
    const ours = s.cities.filter(c => c.civId === civ.id).length;
    if (!rival.alive || !theirs) out.push(reunify(s, civ, true));
    else if (!ours) out.push(reunify(s, civ, false));
    else if (s.turn - war.since >= CIVIL_WAR_TURNS) {
      const ratio = armyStrength(s, civ.id) / Math.max(1, armyStrength(s, rival.id));
      if (ratio >= STALEMATE_BAND[0] && ratio <= STALEMATE_BAND[1]) out.push(stalemate(s, civ));
      else out.push(reunify(s, civ, ratio > 1));
    }
    return out;
  }
  if (war?.pending) return out;
  // a breakaway realm grows no new houses while it fights
  if (civ.splitFrom !== undefined && s.civs[civ.splitFrom]?.civilWar) return out;
  // houses rise with the realm
  while (civ.dynasties.length < dynastyCap(s, civ)) {
    const d = newHouse(s, civ, HOUSE_COLORS[civ.dynasties.length % HOUSE_COLORS.length]);
    civ.dynasties.push(d);
    out.push(
      `A new ${houseWord(civ)} rises among the ${civ.name}: House ${d.name}. Give it settlements to govern and trinkets to make it strong, but not stronger than the throne.`,
    );
  }
  const demo = isDemocracy(civ);
  if (demo) civ.ruling = largestParty(s, civ);
  const power = powerOf(s, civ);
  const ruler = rulerOf(civ);
  const r = power.get(ruler.id)!.share;
  // the throne is weak when it holds less than a third of the realm
  const weak = r < 1 / 3;
  for (const d of civ.dynasties) {
    if (d.id === ruler.id) {
      d.unrest = Math.max(0, d.unrest - 5);
      continue;
    }
    const sh = power.get(d.id)!.share;
    let gain = sh > r ? 4 + (10 * (sh - r)) / Math.max(0.05, r) : sh > 0.75 * r ? 1.5 : -2;
    if (weak && gain > 0) gain += 1;
    gain = Math.min(12, gain);
    if (demo) gain = gain > 0 ? gain * DEMOCRACY_UNREST : gain;
    const before = d.unrest;
    d.unrest = Math.max(0, Math.min(REVOLT_AT, d.unrest + gain));
    if (before < 50 && d.unrest >= 50)
      out.push(
        `House ${d.name} grumbles: it governs as much as the throne. Honour it, or take some of its charge.`,
      );
    if (!civ.civilWar && d.unrest >= REVOLT_AT) {
      civ.civilWar = { rebel: d.id, since: s.turn, pending: true };
      out.push(
        `Civil war! House ${d.name} rises against House ${ruler.name} for the throne. Choose your side: the realm will split.`,
      );
      // an AI throne stands with itself at once
      if (!civ.isPlayer) chooseSide(s, civ.id, ruler.id);
    }
  }
  return out;
}

/** The player left a civil war choice open: they stand with the throne. */
export function settlePending(s: GameState, civ: Civ): string[] {
  if (!civ.civilWar?.pending) return [];
  const r = chooseSide(s, civ.id, rulerOf(civ).id);
  return r.msg ? [r.msg] : [];
}

/** Two realms split by a civil war still fighting it: they make no peace. */
export const inCivilWar = (s: GameState, a: number, b: number) => {
  const x = s.civs[a],
    y = s.civs[b];
  return (
    (x?.civilWar?.rival === b && !x.civilWar.pending) ||
    (y?.civilWar?.rival === a && !y.civilWar.pending)
  );
};
