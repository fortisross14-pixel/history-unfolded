/**
 * The great houses of each people. One rules from the start; more rise as the realm grows and
 * the ages turn (see data/dynasties.ts). Each settlement is governed by a house. A house's
 * trinkets raise its line in the settlements it governs, and the ruling house lends half of
 * its own to the whole realm. Power is the people a house governs (and the trinkets it holds);
 * a house that outweighs the throne grows restless and, at the limit, rises in civil war.
 * Under Democracy the houses are parties: the one governing most people rules, reassigning is
 * free, unrest grows far more slowly, and the bonuses are smaller.
 */
import {
  CIVIL_WAR_TURNS,
  COURT_SHARE,
  DEMOCRACY_BONUS,
  DEMOCRACY_UNREST,
  HONOURS_CALM,
  HONOURS_GOLD,
  HOUSE_COLORS,
  HOUSE_NAMES,
  MAX_DYNASTIES,
  REVOLT_AT,
  TRINKET_CHANCE,
  TRINKET_PCT,
  TRINKETS,
} from '../data/dynasties.ts';
import { ageOf } from '../data/techs.ts';
import type { Line } from '../data/slots.ts';
import { hashSeed, mulberry32 } from './rng.ts';
import type { City, Civ, Dynasty, GameState, Trinket } from './types.ts';

type Result = { ok: boolean; msg?: string };
const ok = (msg?: string): Result => ({ ok: true, msg });
const fail = (msg: string): Result => ({ ok: false, msg });

export const isDemocracy = (civ: Civ) => civ.culture.taken.includes('democracy');
/** What the houses are called: dynasties, or parties under Democracy. */
export const houseWord = (civ: Civ) => (isDemocracy(civ) ? 'party' : 'house');

/** A people's first house, named for the people. */
export function foundingDynasty(s: GameState, civ: Civ): Dynasty {
  return {
    id: s.nextId++,
    name: pickName(s, civ),
    color: HOUSE_COLORS[0],
    trinkets: [],
    unrest: 0,
    founded: s.turn,
  };
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

/** Each house's weight in the realm: the people it governs, and 500 for each trinket it holds. */
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
    const w = out.get(d.id)!.people + d.trinkets.length * 500;
    weight.set(d.id, w);
    total += w;
  }
  for (const d of civ.dynasties) out.get(d.id)!.share = total ? weight.get(d.id)! / total : 0;
  return out;
}

/** Trinkets of a line a house holds. */
export const trinketsOf = (d: Dynasty, line: Line) =>
  d.trinkets.filter(t => t.line === line).length;

/**
 * The bonus (in %) a settlement's buildings of each line get from the houses: its governor's
 * trinkets in full, the ruling house's at half (when the ruler does not govern it already).
 */
export function lineBonus(s: GameState, c: City): Partial<Record<Line, number>> {
  const civ = s.civs[c.civId];
  if (!civ.dynasties?.length) return {};
  const gov = governorOf(s, c)!;
  const ruler = rulerOf(civ);
  const k = isDemocracy(civ) ? DEMOCRACY_BONUS : 1;
  const out: Partial<Record<Line, number>> = {};
  for (const line of Object.keys(TRINKETS) as Line[]) {
    let v = trinketsOf(gov, line) * TRINKET_PCT;
    if (ruler.id !== gov.id) v += trinketsOf(ruler, line) * TRINKET_PCT * COURT_SHARE;
    if (v) out[line] = v * k;
  }
  return out;
}

/** A civil war halves what the rebel settlements make and costs the others a tenth. */
export function warPenalty(s: GameState, c: City): number {
  const civ = s.civs[c.civId];
  if (!civ.civilWar) return 1;
  return governorOf(s, c)?.id === civ.civilWar.rebel ? 0.5 : 0.9;
}

// ---------------------------------------------------------------- actions

export function assignGovernor(s: GameState, civId: number, cityId: number, dynId: number): Result {
  const civ = s.civs[civId];
  const c = s.cities.find(x => x.id === cityId && x.civId === civId);
  const d = civ.dynasties.find(x => x.id === dynId);
  if (!c || !d) return fail('No such settlement or house.');
  const was = governorOf(s, c);
  if (was?.id === d.id) return ok();
  if (civ.civilWar && (was?.id === civ.civilWar.rebel || d.id === civ.civilWar.rebel))
    return fail('Not while that house is at war with the throne.');
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

/** Give in to the rebels: they take the throne now, without the war's full cost. */
export function yieldThrone(s: GameState, civId: number): Result {
  const civ = s.civs[civId];
  if (!civ.civilWar) return fail('There is no civil war.');
  return ok(endCivilWar(s, civ, true, true));
}

function largestParty(s: GameState, civ: Civ): number {
  const p = powerOf(s, civ);
  return [...civ.dynasties].sort((a, b) => p.get(b.id)!.people - p.get(a.id)!.people)[0].id;
}

/** A finished building may yield a trinket of its line. */
export function maybeTrinket(s: GameState, civ: Civ, line: Line, salt: number): Trinket | null {
  const r = mulberry32(hashSeed(s.settings.map.seed, s.turn * 977 + civ.id * 53 + salt));
  if (r() >= TRINKET_CHANCE) return null;
  const names = TRINKETS[line];
  const t: Trinket = { id: s.nextId++, name: names[Math.floor(r() * names.length)], line };
  civ.trinkets.push(t);
  return t;
}

// ---------------------------------------------------------------- the turn

/** New houses, unrest, civil war. Returns messages for the player. */
export function dynastyTurn(s: GameState, civ: Civ): string[] {
  const out: string[] = [];
  if (!civ.dynasties?.length) return out;
  // houses rise with the realm
  while (civ.dynasties.length < dynastyCap(s, civ)) {
    const d: Dynasty = {
      id: s.nextId++,
      name: pickName(s, civ),
      color: HOUSE_COLORS[civ.dynasties.length % HOUSE_COLORS.length],
      trinkets: [],
      unrest: 0,
      founded: s.turn,
    };
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
      civ.civilWar = { rebel: d.id, since: s.turn };
      out.push(
        `Civil war! House ${d.name} rises against House ${ruler.name} for the throne. Its settlements make half while it lasts.`,
      );
    }
  }
  if (civ.civilWar && s.turn - civ.civilWar.since >= CIVIL_WAR_TURNS) {
    const rebel = civ.dynasties.find(d => d.id === civ.civilWar!.rebel);
    if (!rebel) civ.civilWar = undefined;
    else {
      const crown = power.get(ruler.id)!.people + militaryPeople(s, civ);
      const rebels = power.get(rebel.id)!.people * 1.2 + rebel.trinkets.length * 800;
      const roll = mulberry32(hashSeed(s.settings.map.seed, s.turn * 4099 + civ.id))();
      out.push(endCivilWar(s, civ, roll < rebels / Math.max(1, rebels + crown), false));
    }
  }
  return out;
}

/** People under arms inside the realm stand with the throne. */
function militaryPeople(s: GameState, civ: Civ): number {
  let n = 0;
  for (const f of s.formations)
    if (f.civId === civ.id && f.kind === 'army') n += f.cohorts.reduce((a, c) => a + c.strength, 0);
  return n * 2;
}

function endCivilWar(s: GameState, civ: Civ, rebelsWin: boolean, yielded: boolean): string {
  const war = civ.civilWar!;
  const rebel = civ.dynasties.find(d => d.id === war.rebel)!;
  const old = rulerOf(civ);
  civ.civilWar = undefined;
  for (const d of civ.dynasties) d.unrest = 0;
  // the fighting costs people where the rebels held sway
  if (!yielded)
    for (const c of s.cities)
      if (c.civId === civ.id && governorOf(s, c)?.id === rebel.id)
        c.pop = Math.max(1000, Math.round((c.pop * 0.9) / 50) * 50);
  if (rebelsWin) {
    civ.ruling = rebel.id;
    // the fallen house loses half its treasures to the victors
    const lost = old.trinkets.splice(0, Math.floor(old.trinkets.length / 2));
    rebel.trinkets.push(...lost);
    return `House ${rebel.name} takes the throne of the ${civ.name}${yielded ? ' without a fight' : ''}. House ${old.name} gives up ${lost.length} trinket${lost.length === 1 ? '' : 's'}.`;
  }
  // the crown holds: the rebels lose their charges and their treasures
  civ.trinkets.push(...rebel.trinkets.splice(0));
  for (const c of s.cities) if (c.civId === civ.id && c.governor === rebel.id) c.governor = old.id;
  return `House ${old.name} holds the throne. House ${rebel.name} is broken: its trinkets return to the treasury and its settlements to the crown.`;
}
