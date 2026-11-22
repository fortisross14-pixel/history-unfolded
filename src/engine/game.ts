/**
 * Game state and every action a player (human or AI) can take. All functions mutate the state
 * in place and return a result message; the UI re-renders from the state afterwards.
 */
import { CITY_NAMES, CIV_PRESETS } from '../data/civs.ts';
import { DEPOSITS } from '../data/goods.ts';
import { DEFAULT_LOADOUT, ITEMS, SLOTS, type Loadout } from '../data/items.ts';
import { TECHS, TECH_LIST } from '../data/techs.ts';
import { distance, neighbors, within, type Grid } from './hex.ts';
import { generateMap, isPassableLand, MAP_SIZES } from './mapgen.ts';
import { findPath } from './path.ts';
import { hashSeed, mulberry32 } from './rng.ts';
import type { City, Civ, Cohort, Design, Formation, GameSettings, GameState } from './types.ts';
import { aiTurn } from './ai.ts';
import {
  build,
  cityDistricts,
  cityEconomy,
  districtAt,
  districtSites,
  emptySlot,
  marketCities,
  marketSpend,
  marketStock,
  slotProblem,
} from './economy.ts';
import { SLOT_TYPES } from '../data/slots.ts';
import type { Blueprint, District } from './types.ts';
import { resolveBattle, type BattleReport } from './combat.ts';
import {
  capOf,
  COHORT_SIZE,
  enterCost,
  formationMoves,
  formationSight,
  formationMorale,
  isRanged,
  LEVY_COHORTS,
  power as powerOf,
  loadoutProblem,
  people,
  refitCost,
  SETTLER_COHORTS,
} from './units.ts';

export const SAVE_VERSION = 3;
export const CITY_RADIUS = 1;
export const TERRITORY_RADIUS = 2;
export const MIN_CITY_DISTANCE = 4;
export const LEVY_PEOPLE = LEVY_COHORTS * COHORT_SIZE;
export const MIN_CITY_POP = 1000;
export const START_CITY_POP = 2000;
export const SETTLED_CITY_POP = 1200;
export const SETTLERS_PEOPLE = 1000;

export type Result = { ok: true; msg?: string } | { ok: false; msg: string };
const ok = (msg?: string): Result => ({ ok: true, msg });
const fail = (msg: string): Result => ({ ok: false, msg });

export const gridOf = (s: GameState): Grid => ({ w: s.map.w, h: s.map.h });

// ---------------------------------------------------------------- setup

export function newGame(settings: GameSettings): GameState {
  const map = generateMap(settings.map);
  const civCount = Math.min(settings.civCount, map.starts.length);
  const s: GameState = {
    version: SAVE_VERSION,
    settings,
    turn: 1,
    map,
    civs: [],
    cities: [],
    formations: [],
    nextId: 1,
    log: [],
    wars: [],
    districts: [],
    roads: new Array(map.w * map.h).fill(0),
  };
  for (let i = 0; i < civCount; i++) {
    const preset = CIV_PRESETS[i];
    const civ: Civ = {
      id: i,
      name: i === 0 && settings.playerName ? settings.playerName : preset.name,
      color: preset.color,
      isPlayer: i === 0,
      techs: [],
      researching: null,
      science: 0,
      gold: 20,
      explored: new Array(map.w * map.h).fill(0),
      designs: [],
      blueprints: [],
      cityNames: 0,
      levies: 0,
      met: [],
      alive: true,
      kills: 0,
      losses: 0,
    };
    s.civs.push(civ);
    const start = map.starts[i];
    const g = gridOf(s);
    const free = neighbors(g, start).filter(k => isPassableLand(map, k));
    const spot = (n: number) => free[n % Math.max(1, free.length)] ?? start;
    addFormation(s, civ.id, 'settlers', start, SETTLER_COHORTS, 'Settlers');
    addFormation(s, civ.id, 'army', spot(0), LEVY_COHORTS, nextLevyName(s, civ.id));
    const scout = addFormation(s, civ.id, 'army', spot(1), 1, 'Scouts');
    const scoutDesign: Design = {
      id: s.nextId++,
      name: 'Scouts',
      loadout: { ...DEFAULT_LOADOUT, kit: 'scouting-gear' },
    };
    civ.designs.push(scoutDesign);
    scout.cohorts[0].loadout = { ...scoutDesign.loadout };
    scout.cohorts[0].designId = scoutDesign.id;
    scout.moves = formationMoves(scout);
    if (!civ.isPlayer) {
      const settlers = s.formations.find(f => f.civId === civ.id && f.kind === 'settlers')!;
      foundCity(s, settlers.id);
    }
  }
  for (const c of s.civs) updateExplored(s, c.id);
  log(s, 0, `Turn 1. ${s.civs.length} peoples begin on a ${map.type.replace('-', ' ')} world.`);
  return s;
}

function addFormation(
  s: GameState,
  civId: number,
  kind: Formation['kind'],
  hex: number,
  cohorts: number,
  name: string,
): Formation {
  const f: Formation = {
    id: s.nextId++,
    civId,
    name,
    kind,
    hex,
    moves: 0,
    path: [],
    fortified: false,
    cohorts: Array.from({ length: cohorts }, () => newCohort(s)),
  };
  f.moves = formationMoves(f);
  s.formations.push(f);
  return f;
}

function newCohort(s: GameState, loadout: Loadout = DEFAULT_LOADOUT): Cohort {
  return { id: s.nextId++, strength: COHORT_SIZE, xp: 0, designId: null, loadout: { ...loadout } };
}

function nextLevyName(s: GameState, civId: number): string {
  const n = ++s.civs[civId].levies;
  const suf =
    n % 10 === 1 && n % 100 !== 11
      ? 'st'
      : n % 10 === 2 && n % 100 !== 12
        ? 'nd'
        : n % 10 === 3 && n % 100 !== 13
          ? 'rd'
          : 'th';
  return `${n}${suf} Levy`;
}

export function log(s: GameState, civId: number, text: string) {
  s.log.push({ turn: s.turn, civId, text });
  if (s.log.length > 300) s.log.splice(0, s.log.length - 300);
}

// ---------------------------------------------------------------- lookups

export const civOf = (s: GameState, id: number) => s.civs[id];
export const formation = (s: GameState, id: number) => s.formations.find(f => f.id === id);
export const city = (s: GameState, id: number) => s.cities.find(c => c.id === id);
export const cityAt = (s: GameState, hex: number) => s.cities.find(c => c.hex === hex);
export const formationsAt = (s: GameState, hex: number) => s.formations.filter(f => f.hex === hex);
export const player = (s: GameState) => s.civs.find(c => c.isPlayer)!;

/** Owner civ of every hex: hexes within TERRITORY_RADIUS of a city, nearest city wins. */
export function territory(s: GameState): Int16Array {
  const g = gridOf(s);
  const own = new Int16Array(g.w * g.h).fill(-1);
  const best = new Int16Array(g.w * g.h).fill(99);
  for (const c of s.cities) {
    for (const k of within(g, c.hex, TERRITORY_RADIUS)) {
      const d = distance(g, c.hex, k);
      if (d < best[k]) {
        best[k] = d;
        own[k] = c.civId;
      }
    }
  }
  return own;
}

/** The friendly city whose territory a hex lies in (nearest within range), if any. */
export function supplyingCity(s: GameState, civId: number, hex: number): City | undefined {
  const g = gridOf(s);
  let best: City | undefined,
    bd = Infinity;
  for (const c of s.cities) {
    if (c.civId !== civId) continue;
    const d = distance(g, c.hex, hex);
    if (d <= TERRITORY_RADIUS && d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

// ---------------------------------------------------------------- visibility

export function visibleHexes(s: GameState, civId: number): Uint8Array {
  const g = gridOf(s);
  const v = new Uint8Array(g.w * g.h);
  for (const f of s.formations) {
    if (f.civId !== civId) continue;
    for (const k of within(g, f.hex, formationSight(f, s.map))) v[k] = 1;
  }
  for (const c of s.cities) {
    if (c.civId !== civId) continue;
    for (const k of within(g, c.hex, TERRITORY_RADIUS + 1)) v[k] = 1;
  }
  return v;
}

export function updateExplored(s: GameState, civId: number) {
  const v = visibleHexes(s, civId);
  const civ = s.civs[civId];
  const e = civ.explored;
  for (let i = 0; i < v.length; i++) if (v[i]) e[i] = 1;
  // meeting another people: seeing one of their formations or cities
  const seen = (other: number) => {
    if (other === civId || civ.met.includes(other)) return;
    civ.met.push(other);
    s.civs[other].met.includes(civId) || s.civs[other].met.push(civId);
    log(s, civId, `${civ.name} and the ${s.civs[other].name} have met.`);
  };
  for (const f of s.formations) if (v[f.hex]) seen(f.civId);
  for (const c of s.cities) if (v[c.hex]) seen(c.civId);
}

/** A deposit is shown only once its revealing tech is known. */
export function depositVisible(s: GameState, civId: number, hex: number): boolean {
  const d = s.map.deposit[hex];
  if (!d) return false;
  const by = DEPOSITS[d.kind].revealedBy;
  return !by || s.civs[civId].techs.includes(by);
}

// ---------------------------------------------------------------- movement

/** Can `f` end its move on `hex`? Returns the formation it would merge into, or a reason. */
export function arrival(
  s: GameState,
  f: Formation,
  hex: number,
): { mergeWith?: Formation; blocked?: string } {
  const there = formationsAt(s, hex).filter(o => o.id !== f.id);
  if (there.some(o => o.civId !== f.civId)) return { blocked: 'Another people holds that hex.' };
  const c = cityAt(s, hex);
  if (c && c.civId !== f.civId) return { blocked: 'A foreign city.' };
  const same = there.filter(o => o.kind === f.kind);
  if (!same.length) return {};
  const fits = same.find(o => o.cohorts.length + f.cohorts.length <= capOf(o));
  if (!fits)
    return {
      blocked: `Merging would exceed the command limit of ${capOf(same[0])} cohorts. Split first.`,
    };
  return { mergeWith: fits };
}

/** Hexes a formation may pass through: no foreign formations or cities. */
export function passable(s: GameState, f: Formation): (hex: number) => boolean {
  const foreign = new Set<number>();
  for (const o of s.formations) if (o.civId !== f.civId) foreign.add(o.hex);
  for (const c of s.cities) if (c.civId !== f.civId) foreign.add(c.hex);
  return h => !foreign.has(h);
}

/** Moving along a road (from one road hex to the next) costs half a move, whatever the ground. */
export function stepCost(s: GameState, f: Formation, from: number, to: number): number {
  const base = enterCost(s.map, f, to);
  if (!isFinite(base)) return base;
  if (s.roads[from] && s.roads[to]) return 0.5;
  return base;
}

export function planPath(s: GameState, f: Formation, target: number): number[] | null {
  const civ = s.civs[f.civId];
  const pass = passable(s, f);
  return findPath(gridOf(s), f.hex, target, (from, to) => {
    if (!pass(to)) return Infinity;
    // unexplored hexes are assumed passable at base cost until seen
    if (!civ.explored[to]) return 1;
    return stepCost(s, f, from, to);
  });
}

/** Order a formation to go to `target`: it moves now as far as it can and keeps the rest for later turns. */
export function orderMove(s: GameState, fid: number, target: number): Result {
  const f = formation(s, fid);
  if (!f) return fail('No such formation.');
  if (target === f.hex) {
    f.path = [];
    return ok();
  }
  const end = arrival(s, f, target);
  if (end.blocked) return fail(end.blocked);
  const path = planPath(s, f, target);
  if (!path) return fail('No route there.');
  f.path = path;
  f.fortified = false;
  return advance(s, f);
}

/** Walk along the stored path while movement points last. */
export function advance(s: GameState, f: Formation): Result {
  let merged: string | undefined;
  while (f.path.length && f.moves > 0) {
    const next = f.path[0];
    const cost = stepCost(s, f, f.hex, next);
    if (!isFinite(cost) || !passable(s, f)(next)) {
      f.path = [];
      return fail('The way is blocked.');
    }
    const last = f.path.length === 1;
    if (last) {
      const end = arrival(s, f, next);
      if (end.blocked) {
        f.path = [];
        return fail(end.blocked);
      }
    }
    // a formation can always enter a hex if it has any movement left (it then stops)
    f.moves = Math.max(0, f.moves - cost);
    f.hex = next;
    f.path.shift();
    updateExplored(s, f.civId);
    if (last) {
      const end = arrival(s, f, next);
      if (end.mergeWith) merged = mergeInto(s, f, end.mergeWith);
    }
    // re-plan if the terrain just revealed makes the rest of the path impossible
    if (f.path.length && !isFinite(enterCost(s.map, f, f.path[0]))) {
      const target = f.path[f.path.length - 1];
      f.path = planPath(s, f, target) ?? [];
    }
  }
  return ok(merged);
}

/** `a` joins `b`: cohorts keep their loadouts, the result moves at the slower pace. */
export function mergeInto(s: GameState, a: Formation, b: Formation): string {
  b.cohorts.push(...a.cohorts);
  b.moves = Math.min(b.moves, a.moves);
  b.path = [];
  s.formations = s.formations.filter(x => x.id !== a.id);
  const msg = `${a.name} merged into ${b.name} (${b.cohorts.length} cohorts).`;
  log(s, a.civId, msg);
  return msg;
}

/** Explicit merge of two formations on the same hex. */
export function merge(s: GameState, aId: number, bId: number): Result {
  const a = formation(s, aId),
    b = formation(s, bId);
  if (!a || !b || a.hex !== b.hex || a.civId !== b.civId)
    return fail('Formations must share a hex.');
  if (a.kind !== b.kind) return fail('Settlers and troops cannot merge.');
  if (a.cohorts.length + b.cohorts.length > capOf(b))
    return fail(`Over the command limit of ${capOf(b)} cohorts.`);
  return ok(mergeInto(s, a, b));
}

/** Detach the given cohorts into a new formation on the same hex. */
export function split(
  s: GameState,
  fid: number,
  cohortIds: number[],
  name?: string,
): Result & { id?: number } {
  const f = formation(s, fid);
  if (!f) return fail('No such formation.');
  const ids = new Set(cohortIds);
  const moving = f.cohorts.filter(c => ids.has(c.id));
  if (!moving.length) return fail('Pick at least one cohort.');
  if (moving.length === f.cohorts.length) return fail('Leave at least one cohort behind.');
  f.cohorts = f.cohorts.filter(c => !ids.has(c.id));
  const n: Formation = {
    id: s.nextId++,
    civId: f.civId,
    kind: f.kind,
    hex: f.hex,
    cohorts: moving,
    path: [],
    fortified: false,
    name: name ?? (f.kind === 'settlers' ? 'Settlers' : nextLevyName(s, f.civId)),
    moves: 0,
  };
  n.moves = Math.min(f.moves, formationMoves(n));
  f.moves = Math.min(f.moves, formationMoves(f));
  s.formations.push(n);
  return { ok: true, msg: `${n.name} split from ${f.name}.`, id: n.id };
}

export function rename(s: GameState, fid: number, name: string): Result {
  const f = formation(s, fid);
  if (!f || !name.trim()) return fail('Invalid name.');
  f.name = name.trim().slice(0, 32);
  return ok();
}

export function fortify(s: GameState, fid: number): Result {
  const f = formation(s, fid);
  if (!f) return fail('No such formation.');
  f.fortified = !f.fortified;
  f.path = [];
  return ok();
}

// ---------------------------------------------------------------- cities

export function canFoundCity(s: GameState, f: Formation): string | null {
  if (f.kind !== 'settlers') return 'Only settlers can found a city.';
  if (!isPassableLand(s.map, f.hex)) return 'Cities need open land.';
  const g = gridOf(s);
  const near = s.cities.find(c => distance(g, c.hex, f.hex) < MIN_CITY_DISTANCE);
  if (near) return `Too close to ${near.name} (min ${MIN_CITY_DISTANCE} hexes).`;
  return null;
}

export function foundCity(s: GameState, fid: number): Result {
  const f = formation(s, fid);
  if (!f) return fail('No such formation.');
  const why = canFoundCity(s, f);
  if (why) return fail(why);
  const civ = s.civs[f.civId];
  const used = new Set(s.cities.map(c => c.name));
  const rng = mulberry32(hashSeed(s.settings.map.seed, 1000 + civ.id * 97 + civ.cityNames));
  let name = CITY_NAMES[Math.floor(rng() * CITY_NAMES.length)];
  for (let k = 0; used.has(name) && k < CITY_NAMES.length; k++)
    name = CITY_NAMES[(CITY_NAMES.indexOf(name) + 1) % CITY_NAMES.length];
  if (used.has(name)) name = `${name} ${civ.cityNames + 2}`;
  civ.cityNames++;
  const c: City = {
    id: s.nextId++,
    civId: civ.id,
    name,
    hex: f.hex,
    pop: s.cities.some(x => x.civId === civ.id) ? SETTLED_CITY_POP : START_CITY_POP,
    food: 0,
    founded: s.turn,
    guard: 1,
    stockpile: { wood: 10, hides: 4, stone: 4 },
  };
  s.cities.push(c);
  // the city centre is a district of its own, with the town hall in the middle
  const centre: District = {
    id: s.nextId++,
    cityId: c.id,
    hex: c.hex,
    name: `${name} centre`,
    slots: Array.from({ length: 9 }, () => emptySlot()),
  };
  centre.slots[4] = { type: 'town-hall', built: true, progress: 0, paid: true };
  // a district already on this hex (from an older city) is cleared
  s.districts = s.districts.filter(d => d.hex !== c.hex);
  s.districts.push(centre);
  s.roads[c.hex] = 1;
  s.formations = s.formations.filter(x => x.id !== f.id);
  s.map.vegetation[f.hex] = 'none';
  updateExplored(s, civ.id);
  log(s, civ.id, `${civ.name} founded ${name}.`);
  return ok(`${name} founded.`);
}

/** Raise a new levy of 5 cohorts (500 people) from a city's population. */
export function levy(s: GameState, cityId: number): Result {
  const c = city(s, cityId);
  if (!c) return fail('No such city.');
  if (c.pop - LEVY_PEOPLE < MIN_CITY_POP)
    return fail(`${c.name} needs ${MIN_CITY_POP + LEVY_PEOPLE} people to raise a levy.`);
  c.pop -= LEVY_PEOPLE;
  const f = addFormation(s, c.civId, 'army', c.hex, LEVY_COHORTS, nextLevyName(s, c.civId));
  f.moves = 0;
  if (hasSlot(s, c, 'barracks')) for (const co of f.cohorts) co.xp = 1;
  log(s, c.civId, `${c.name} raised the ${f.name} (500 people).`);
  return ok(`${f.name} raised in ${c.name}.`);
}

/** Food a city must store to grow by 250 people: bigger cities grow more slowly. */
export const growthCost = (c: City) => 10 + Math.floor(c.pop / 1000) * 8;

/** Per-turn summary of a city (see economy.ts for the slot-by-slot detail). */
export function cityYield(s: GameState, c: City) {
  const e = cityEconomy(s, c);
  return {
    food: e.total.food,
    eat: e.eat,
    surplus: e.surplus,
    prod: e.total.prod,
    goods: e.total.goods,
    science: e.total.science,
    gold: e.total.gold,
    housing: e.total.housing,
    workers: e.workers,
    workersUsed: e.workersUsed,
    inputs: e.inputs,
  };
}

// ---------------------------------------------------------------- refit

/** Re-equip some cohorts of a formation. Goods come from the city whose territory it stands in. */
export type RefitPreview =
  | { problem: string }
  | {
      problem: null;
      city: City;
      far: boolean;
      armoury: boolean;
      cost: Record<string, number>;
      refund: Record<string, number>;
      missing: { good: string; need: number; have: number }[];
    };

export function refitPreview(
  s: GameState,
  fid: number,
  cohortIds: number[],
  to: Loadout,
): RefitPreview {
  const f = formation(s, fid);
  if (!f) return { problem: 'No such formation.' };
  if (f.kind !== 'army') return { problem: 'Settlers carry no weapons.' };
  const civ = s.civs[f.civId];
  const problem = loadoutProblem(to, civ.techs);
  if (problem) return { problem };
  const c = supplyingCity(s, f.civId, f.hex);
  if (!c) return { problem: 'Refit only inside your territory, near one of your cities.' };
  const g = gridOf(s);
  const armoury = hasSlot(s, c, 'armoury');
  const far = !armoury && distance(g, c.hex, f.hex) > CITY_RADIUS;
  const mul = (far ? 1.5 : 1) * (armoury ? 0.8 : 1);
  const cost: Record<string, number> = {},
    refund: Record<string, number> = {};
  const ids = new Set(cohortIds);
  for (const co of f.cohorts) {
    if (!ids.has(co.id)) continue;
    const r = refitCost(co.loadout, to);
    for (const [k, n] of Object.entries(r.cost)) cost[k] = (cost[k] ?? 0) + n * mul;
    for (const [k, n] of Object.entries(r.refund)) refund[k] = (refund[k] ?? 0) + n;
  }
  for (const k of Object.keys(cost)) cost[k] = Math.ceil(cost[k]);
  for (const k of Object.keys(refund)) refund[k] = Math.floor(refund[k]);
  const stock = marketStock(s, c);
  const missing = Object.entries(cost)
    .filter(([k, n]) => (stock[k] ?? 0) < n)
    .map(([k, n]) => ({ good: k, need: n, have: stock[k] ?? 0 }));
  return { city: c, far, armoury, cost, refund, missing, problem: null };
}

export function refit(s: GameState, fid: number, cohortIds: number[], to: Loadout): Result {
  const p = refitPreview(s, fid, cohortIds, to);
  if (p.problem !== null) return fail(p.problem);
  if (p.missing.length)
    return fail(
      `${p.city.name} lacks ${p.missing.map(m => `${m.need - m.have} ${m.good}`).join(', ')}.`,
    );
  const f = formation(s, fid)!;
  const ids = new Set(cohortIds);
  if (!marketSpend(s, p.city, p.cost)) return fail('The market cannot pay for it.');
  for (const [k, n] of Object.entries(p.refund))
    if (n > 0) p.city.stockpile[k] = (p.city.stockpile[k] ?? 0) + n;
  let n = 0;
  for (const co of f.cohorts)
    if (ids.has(co.id)) {
      co.loadout = { ...to };
      n++;
    }
  f.moves = 0;
  f.path = [];
  log(s, f.civId, `${f.name}: ${n} cohort${n === 1 ? '' : 's'} re-equipped from ${p.city.name}.`);
  return ok(`${n * COHORT_SIZE} people re-equipped.`);
}

// ---------------------------------------------------------------- unit designs

/** Create or update a named unit design. Cohorts already equipped keep their gear until re-equipped. */
export function saveDesign(
  s: GameState,
  civId: number,
  name: string,
  loadout: Loadout,
  id?: number,
): Result & { id?: number } {
  const civ = s.civs[civId];
  const n = name.trim().slice(0, 28);
  if (!n) return fail('Give the design a name.');
  const problem = loadoutProblem(loadout, civ.techs);
  if (problem) return fail(problem);
  if (civ.designs.some(d => d.name.toLowerCase() === n.toLowerCase() && d.id !== id))
    return fail(`You already have a design called ${n}.`);
  const ex = id !== undefined ? civ.designs.find(d => d.id === id) : undefined;
  if (ex) {
    ex.name = n;
    ex.loadout = { ...loadout };
    return {
      ok: true,
      msg: `${n} updated. Re-equip cohorts to give them the new gear.`,
      id: ex.id,
    };
  }
  const d: Design = { id: s.nextId++, name: n, loadout: { ...loadout } };
  civ.designs.push(d);
  return { ok: true, msg: `${n} designed.`, id: d.id };
}

export function deleteDesign(s: GameState, civId: number, id: number): Result {
  const civ = s.civs[civId];
  const d = civ.designs.find(x => x.id === id);
  if (!d) return fail('No such design.');
  civ.designs = civ.designs.filter(x => x.id !== id);
  // cohorts keep their gear but lose the name
  for (const f of s.formations) for (const c of f.cohorts) if (c.designId === id) c.designId = null;
  return ok(`${d.name} retired.`);
}

/** Equip the selected cohorts as the given design (paying only for gear they do not have). */
export function assignDesign(
  s: GameState,
  fid: number,
  cohortIds: number[],
  designId: number,
): Result {
  const f = formation(s, fid);
  if (!f) return fail('No such formation.');
  const d = s.civs[f.civId].designs.find(x => x.id === designId);
  if (!d) return fail('No such design.');
  const r = refit(s, fid, cohortIds, d.loadout);
  if (!r.ok) return r;
  const ids = new Set(cohortIds);
  for (const c of f.cohorts) if (ids.has(c.id)) c.designId = d.id;
  return ok(`${cohortIds.length * COHORT_SIZE} people are now ${d.name}.`);
}

// ---------------------------------------------------------------- research

export function availableTechs(civ: Civ) {
  return TECH_LIST.filter(
    t => !civ.techs.includes(t.id) && t.requires.every(r => civ.techs.includes(r)),
  );
}

export function setResearch(s: GameState, civId: number, techId: string): Result {
  const civ = s.civs[civId];
  if (!availableTechs(civ).some(t => t.id === techId)) return fail('Not available.');
  civ.researching = techId;
  return ok();
}

// ---------------------------------------------------------------- turns

export function endTurn(s: GameState): string[] {
  const events: string[] = [];
  const me = player(s);
  const logStart = s.log.length;
  // AI acts after the player, in the same turn
  for (const civ of s.civs) if (!civ.isPlayer && civ.alive) aiTurn(s, civ);
  // tell the player about anything the AI did to them
  for (const e of s.log.slice(logStart))
    if (e.civId !== me.id && e.text.includes(me.name)) events.push(e.text);

  for (const civ of s.civs) {
    if (!civ.alive) continue;
    let science = 0,
      gold = 0;
    for (const c of s.cities.filter(x => x.civId === civ.id)) {
      const e = cityEconomy(s, c);
      science += e.total.science;
      gold += e.total.gold;
      for (const [k, n] of Object.entries(e.total.goods))
        c.stockpile[k] = (c.stockpile[k] ?? 0) + n;
      marketSpend(s, c, e.inputs);
      c.food += e.surplus;
      // food stored turns into people while there is housing; starvation shrinks the city
      const need = growthCost(c);
      if (c.food >= need) {
        if (c.pop + 250 <= e.total.housing) {
          c.food -= need;
          c.pop += 250;
        } else c.food = need;
      }
      for (const done of build(s, c, e.total.prod))
        if (civ.isPlayer) events.push(`${c.name}: ${done} finished.`);
      if (c.food < -5) {
        c.food = 0;
        c.pop = Math.max(MIN_CITY_POP, c.pop - 250);
        if (civ.isPlayer) events.push(`${c.name} is starving.`);
      }
    }
    let upkeep = 0;
    for (const f of s.formations)
      if (f.civId === civ.id) for (const co of f.cohorts) upkeep += cohortUpkeep(co);
    civ.gold += gold - upkeep;
    if (civ.gold < 0) civ.gold = 0;
    if (!civ.researching)
      civ.researching = civ.isPlayer ? null : (availableTechs(civ)[0]?.id ?? null);
    if (civ.researching) {
      civ.science += science;
      const t = TECHS[civ.researching];
      if (civ.science >= t.cost) {
        civ.science -= t.cost;
        civ.techs.push(t.id);
        civ.researching = null;
        log(s, civ.id, `${civ.name} learned ${t.name}.`);
        if (civ.isPlayer) events.push(`Research complete: ${t.name}. ${t.note}`);
      }
    }
  }

  heal(s);
  for (const c of s.cities) c.guard = Math.min(1, c.guard + 0.1);
  s.turn++;
  for (const f of s.formations) f.moves = formationMoves(f);
  // standing orders carry on at the start of the new turn
  for (const f of [...s.formations]) {
    if (f.civId === me.id && f.path.length && s.formations.includes(f)) {
      const r = advance(s, f);
      if (!r.ok) events.push(`${f.name}: ${r.msg}`);
      else if (r.msg) events.push(r.msg);
    }
  }
  for (const c of s.civs) updateExplored(s, c.id);
  return events;
}

/**
 * Wounded cohorts recover: inside your territory they are topped up from the nearest city's
 * people (troops are population); outside it only field medics help.
 */
function heal(s: GameState) {
  for (const f of s.formations) {
    if (f.kind !== 'army') continue;
    const medics = f.cohorts.some(c => c.loadout.kit === 'field-medics');
    const home = supplyingCity(s, f.civId, f.hex);
    for (const c of f.cohorts) {
      if (c.strength >= COHORT_SIZE) continue;
      if (home) {
        const want = Math.min(COHORT_SIZE - c.strength, medics ? 20 : 10);
        const take = Math.min(want, Math.max(0, home.pop - MIN_CITY_POP));
        // medics return wounded to the ranks before new recruits are needed
        const free = medics ? Math.ceil(want / 2) : 0;
        c.strength += Math.min(want, free + take);
        home.pop -= Math.max(0, Math.min(want, free + take) - free);
      } else if (medics) {
        c.strength = Math.min(COHORT_SIZE, c.strength + 5);
      }
    }
  }
}

/** Gold per turn: equipment upkeep only, so plain levies cost nothing. */
export function cohortUpkeep(c: Cohort): number {
  return SLOTS.reduce((u, k) => u + ITEMS[c.loadout[k]].upkeep, 0);
}

// ---------------------------------------------------------------- save / load

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

export function deserialize(json: string): GameState {
  const s = JSON.parse(json) as GameState;
  if (s.version !== SAVE_VERSION) throw new Error(`Save version ${s.version} is not supported.`);
  return s;
}

export const defaultCivCount = (size: keyof typeof MAP_SIZES) => MAP_SIZES[size].civs;

// ---------------------------------------------------------------- previews for the UI

/** Hexes the formation can still reach this turn (it may always step once if it has moves). */
export function reachable(s: GameState, f: Formation): Set<number> {
  const out = new Set<number>();
  if (f.moves <= 0) return out;
  const g = gridOf(s);
  const pass = passable(s, f);
  const best = new Map<number, number>([[f.hex, f.moves]]);
  const queue = [f.hex];
  while (queue.length) {
    const cur = queue.shift()!;
    const left = best.get(cur)!;
    if (left <= 0) continue;
    for (const n of neighbors(g, cur)) {
      if (!pass(n)) continue;
      const c = s.civs[f.civId].explored[n] ? stepCost(s, f, cur, n) : Infinity;
      if (!isFinite(c)) continue;
      const rem = Math.max(0, left - c);
      if ((best.get(n) ?? -1) < rem) {
        best.set(n, rem);
        queue.push(n);
      }
    }
  }
  for (const k of best.keys()) if (k !== f.hex) out.add(k);
  return out;
}

/** For each step of a path, the turn (0 = this turn) in which the formation gets there. */
export function pathTurns(s: GameState, f: Formation, path: number[]): number[] {
  const full = formationMoves(f);
  let left = f.moves,
    turn = 0;
  const out: number[] = [];
  let prev = f.hex;
  for (const h of path) {
    if (left <= 0) {
      turn++;
      left = full;
    }
    const c = s.civs[f.civId].explored[h] ? stepCost(s, f, prev, h) : 1;
    prev = h;
    left = Math.max(0, left - c);
    out.push(turn);
  }
  return out;
}

// ---------------------------------------------------------------- war and peace

export const atWar = (s: GameState, a: number, b: number) =>
  s.wars.some(w => (w.a === a && w.b === b) || (w.a === b && w.b === a));

export function declareWar(s: GameState, a: number, b: number): Result {
  if (a === b || atWar(s, a, b)) return fail('Already at war.');
  s.wars.push({ a, b, since: s.turn });
  const msg = `The ${s.civs[a].name} declared war on the ${s.civs[b].name}!`;
  log(s, a, msg);
  return ok(msg);
}

export function endWar(s: GameState, a: number, b: number) {
  s.wars = s.wars.filter(w => !((w.a === a && w.b === b) || (w.a === b && w.b === a)));
  log(s, a, `The ${s.civs[a].name} and the ${s.civs[b].name} made peace.`);
}

/** Total fighting power of a civ (rough, for the AI and the peoples screen). */
export function militaryPower(s: GameState, civId: number): number {
  let p = 0;
  for (const f of s.formations) if (f.civId === civId) p += powerOf(f);
  return Math.round(p);
}

/** The player offers peace. The AI takes it once the war has dragged on and is not going its way. */
export function offerPeace(s: GameState, from: number, to: number): Result {
  const w = s.wars.find(x => (x.a === from && x.b === to) || (x.a === to && x.b === from));
  if (!w) return fail('You are not at war.');
  const length = s.turn - w.since;
  const theirs = militaryPower(s, to),
    mine = militaryPower(s, from);
  if (length < 6)
    return fail(
      `The ${s.civs[to].name} want this war to run its course (${6 - length} more turns).`,
    );
  if (theirs > mine * 1.6 && length < 20)
    return fail(`The ${s.civs[to].name} feel strong and refuse.`);
  endWar(s, from, to);
  return ok(`Peace with the ${s.civs[to].name}.`);
}

// ---------------------------------------------------------------- battle

/** What stands on a hex for an attacker: the strongest formation, else a city's own guard. */
export function defenderAt(s: GameState, hex: number): { f?: Formation; city?: City } {
  const fs = formationsAt(s, hex).filter(f => f.kind === 'army');
  const city = cityAt(s, hex);
  const f = fs.sort((a, b) => people(b) - people(a))[0];
  return { f, city };
}

/** The city guard: townsfolk with spears and hide shields, more of them in bigger cities. */
export function cityGuard(c: City): Cohort[] {
  const n = 3 + Math.floor(c.pop / 2000);
  return Array.from({ length: n }, (_, i) => ({
    id: -1 - i,
    strength: Math.max(1, Math.round(COHORT_SIZE * c.guard)),
    xp: 0,
    designId: null,
    loadout: { ...DEFAULT_LOADOUT, weapon: 'spear', shield: 'hide-shield' },
  }));
}

export interface AttackCheck {
  problem?: string;
  needsWar?: number;
  target?: { f?: Formation; city?: City; civId: number };
}

export function canAttack(s: GameState, fid: number, hex: number): AttackCheck {
  const f = formation(s, fid);
  if (!f) return { problem: 'No such formation.' };
  if (f.kind !== 'army') return { problem: 'Settlers do not fight.' };
  const { f: df, city } = defenderAt(s, hex);
  const civilians = formationsAt(s, hex).filter(x => x.kind === 'settlers' && x.civId !== f.civId);
  const civId = df?.civId ?? city?.civId ?? civilians[0]?.civId;
  if (civId === undefined || civId === f.civId) return { problem: 'Nothing to attack there.' };
  if (distance(gridOf(s), f.hex, hex) !== 1) return { problem: 'Move next to them first.' };
  if (f.moves <= 0) return { problem: 'No moves left this turn.' };
  if (!atWar(s, f.civId, civId)) return { needsWar: civId, target: { f: df, city, civId } };
  return { target: { f: df, city, civId } };
}

function battleInputs(s: GameState, f: Formation, hex: number) {
  const { f: df, city } = defenderAt(s, hex);
  const defCivId = df?.civId ?? city!.civId;
  const defCohorts = df ? df.cohorts : cityGuard(city!);
  const defName = df ? `${s.civs[defCivId].name} ${df.name}` : `${city!.name} guard`;
  const volleyOnly = f.cohorts.every(c => cohortRanged(c));
  return {
    att: {
      name: `${s.civs[f.civId].name} ${f.name}`,
      cohorts: f.cohorts,
      morale: formationMorale(f),
    },
    def: {
      name: defName,
      cohorts: defCohorts,
      morale: df ? formationMorale(df) + (city ? 15 : 0) : 45,
    },
    ctx: { map: s.map, hex, fortified: !!df?.fortified, city: !!city, volleyOnly },
    df,
    city,
    defCivId,
  };
}
const cohortRanged = (c: Cohort) => isRanged(c.loadout);

/** Expected result with average luck, without changing anything. */
export function previewBattle(s: GameState, fid: number, hex: number): BattleReport | null {
  const f = formation(s, fid);
  if (!f) return null;
  const chk = canAttack(s, fid, hex);
  if (chk.problem || !chk.target || (!chk.target.f && !chk.target.city)) return null;
  const b = battleInputs(s, f, hex);
  const clone = (cs: Cohort[]) => cs.map(c => ({ ...c }));
  return resolveBattle(
    { ...b.att, cohorts: clone(b.att.cohorts) },
    { ...b.def, cohorts: clone(b.def.cohorts) },
    { ...b.ctx, rng: () => 0.5 },
  );
}

/** Attack an adjacent hex. Applies losses, retreats, captures. */
export function attack(s: GameState, fid: number, hex: number): Result & { report?: BattleReport } {
  const f = formation(s, fid);
  if (!f) return fail('No such formation.');
  const chk = canAttack(s, fid, hex);
  if (chk.problem) return fail(chk.problem);
  if (chk.needsWar !== undefined)
    return fail(`You are at peace with the ${s.civs[chk.needsWar].name}.`);
  const g = gridOf(s);
  const attCiv = s.civs[f.civId];
  f.fortified = false;
  f.path = [];

  // undefended civilians are simply taken
  if (!chk.target!.f && !chk.target!.city) {
    const victims = formationsAt(s, hex).filter(x => x.civId !== f.civId);
    s.formations = s.formations.filter(x => !victims.includes(x));
    f.moves = 0;
    f.hex = hex;
    const msg = `${attCiv.name} ${f.name} scattered the ${s.civs[chk.target!.civId].name} settlers.`;
    log(s, f.civId, msg);
    checkElimination(s);
    updateExplored(s, f.civId);
    return ok(msg);
  }

  const b = battleInputs(s, f, hex);
  const rng = mulberry32(hashSeed(s.settings.map.seed, s.turn * 7919 + f.id * 31 + hex));
  const report = resolveBattle(b.att, b.def, { ...b.ctx, rng });
  const defCiv = s.civs[b.defCivId];

  const applyLosses = (fm: Formation, loss: Record<number, number>) => {
    for (const c of fm.cohorts) {
      c.strength = Math.max(0, c.strength - (loss[c.id] ?? 0));
      if (c.strength > 0) c.xp += 1;
    }
    // cohorts cut below a fifth of their men are folded into the survivors
    const lost = fm.cohorts.filter(c => c.strength < 20);
    fm.cohorts = fm.cohorts.filter(c => c.strength >= 20);
    if (!fm.cohorts.length) s.formations = s.formations.filter(x => x !== fm);
    return lost.length;
  };
  applyLosses(f, report.attacker.cohortLoss);
  if (b.df) applyLosses(b.df, report.defender.cohortLoss);
  attCiv.kills += report.defender.lost;
  attCiv.losses += report.attacker.lost;
  defCiv.kills += report.attacker.lost;
  defCiv.losses += report.defender.lost;
  f.moves = 0;

  let result = '';
  const attackerAlive = s.formations.includes(f);
  const defenderAlive = b.df ? s.formations.includes(b.df) : false;
  if (!b.df && b.city) {
    b.city.guard = Math.max(
      0,
      b.city.guard * (1 - report.defender.lost / Math.max(1, report.defender.start)),
    );
  }
  if (report.outcome === 'defender-broke' && b.df && defenderAlive) {
    // retreat away from the attacker, or be cut down if there is nowhere to go
    const pass = passable(s, b.df);
    const options = neighbors(g, hex).filter(
      n =>
        n !== f.hex &&
        pass(n) &&
        isFinite(enterCost(s.map, b.df!, n)) &&
        !formationsAt(s, n).some(x => x.civId === b.df!.civId && x.kind === 'army'),
    );
    options.sort((x, y) => distance(g, y, f.hex) - distance(g, x, f.hex));
    if (options.length && !b.city) {
      b.df.hex = options[0];
      b.df.fortified = false;
      b.df.path = [];
      result = `${b.def.name} fell back.`;
    } else if (b.city) {
      result = `${b.def.name} was driven from the walls.`;
      // the garrison is broken but stays in the city; a second assault will meet the city guard
      b.df.fortified = false;
      b.df.moves = 0;
    } else {
      s.formations = s.formations.filter(x => x !== b.df);
      result = `${b.def.name} had nowhere to run and was destroyed.`;
    }
  } else if (report.outcome === 'defender-broke' && !b.df && b.city && attackerAlive) {
    // city guard broken: the city falls to troops that can hold it
    if (f.cohorts.some(c => !cohortRanged(c))) {
      result = captureCity(s, b.city, f);
    } else {
      result = `${b.city.name}'s guard is shaken, but archers cannot take a city.`;
    }
  } else if (report.outcome === 'attacker-broke') {
    result = `${b.att.name} was thrown back.`;
  } else if (!defenderAlive && b.df) {
    result = `${b.def.name} was destroyed.`;
  } else {
    result = report.outcome === 'skirmish' ? 'An exchange of volleys.' : 'Neither side gave way.';
  }
  // advance into an emptied hex (not into a city still holding out)
  if (
    attackerAlive &&
    report.outcome !== 'attacker-broke' &&
    !b.ctx.volleyOnly &&
    !formationsAt(s, hex).some(x => x.civId !== f.civId) &&
    (!cityAt(s, hex) || cityAt(s, hex)!.civId === f.civId)
  ) {
    f.hex = hex;
  }
  if (!attackerAlive) result += ` ${b.att.name} was destroyed.`;
  report.lines.push(result);
  log(
    s,
    f.civId,
    `Battle: ${b.att.name} attacked ${b.def.name} — lost ${report.attacker.lost}, killed ${report.defender.lost}. ${result}`,
  );
  checkElimination(s);
  updateExplored(s, f.civId);
  updateExplored(s, b.defCivId);
  return { ok: true, msg: result, report };
}

function captureCity(s: GameState, c: City, by: Formation): string {
  const old = s.civs[c.civId];
  const civ = s.civs[by.civId];
  c.civId = by.civId;
  c.pop = Math.max(MIN_CITY_POP, Math.round((c.pop * 0.75) / 50) * 50);
  // civilians in the city are lost
  s.formations = s.formations.filter(x => !(x.hex === c.hex && x.civId === old.id));
  by.hex = c.hex;
  const msg = `${civ.name} captured ${c.name} from the ${old.name}!`;
  log(s, by.civId, msg);
  return msg;
}

/** A people with no cities and no settlers is gone; its troops scatter. */
export function checkElimination(s: GameState) {
  for (const civ of s.civs) {
    if (!civ.alive) continue;
    const hasCity = s.cities.some(c => c.civId === civ.id);
    const hasSettlers = s.formations.some(f => f.civId === civ.id && f.kind === 'settlers');
    if (hasCity || hasSettlers) continue;
    civ.alive = false;
    s.formations = s.formations.filter(f => f.civId !== civ.id);
    s.wars = s.wars.filter(w => w.a !== civ.id && w.b !== civ.id);
    log(s, civ.id, `The ${civ.name} are no more.`);
  }
}

// ---------------------------------------------------------------- settlers

/** Send out settlers: 1,000 people (500 settlers with their families) leave the city. */
export function trainSettlers(s: GameState, cityId: number): Result {
  const c = city(s, cityId);
  if (!c) return fail('No such city.');
  if (c.pop - SETTLERS_PEOPLE < MIN_CITY_POP)
    return fail(`${c.name} needs ${MIN_CITY_POP + SETTLERS_PEOPLE} people to send out settlers.`);
  c.pop -= SETTLERS_PEOPLE;
  const f = addFormation(s, c.civId, 'settlers', c.hex, SETTLER_COHORTS, 'Settlers');
  f.moves = 0;
  log(s, c.civId, `${c.name} sent out settlers.`);
  return ok(`Settlers leave ${c.name}.`);
}

// ---------------------------------------------------------------- districts

export const hasSlot = (s: GameState, c: City, type: string) =>
  cityDistricts(s, c).some(d => d.slots.some(x => x.built && x.type === type));

/** Lay out a new district on a hex near the city. Slots are built one by one by the city. */
export function placeDistrict(
  s: GameState,
  cityId: number,
  hex: number,
  name: string,
  slots: (string | null)[],
): Result & { id?: number } {
  const c = city(s, cityId);
  if (!c) return fail('No such city.');
  if (districtAt(s, hex)) return fail('There is already a district there.');
  if (!districtSites(s, c, territory(s)).includes(hex))
    return fail(`Not a site for ${c.name}: pick its own land within 2 hexes.`);
  const d: District = {
    id: s.nextId++,
    cityId,
    hex,
    name: name.trim().slice(0, 28) || 'District',
    slots: Array.from({ length: 9 }, (_, i) =>
      emptySlot(slots[i] && !SLOT_TYPES[slots[i]!]?.fixed ? slots[i] : null),
    ),
  };
  s.districts.push(d);
  return { ok: true, msg: `${d.name} laid out.`, id: d.id };
}

/** Change one slot. A built slot that is replaced is demolished (a quarter of its goods back). */
export function setSlot(s: GameState, districtId: number, i: number, type: string | null): Result {
  const d = s.districts.find(x => x.id === districtId);
  if (!d || i < 0 || i > 8) return fail('No such slot.');
  const cur = d.slots[i];
  if (cur.type && SLOT_TYPES[cur.type]?.fixed) return fail('The town hall stays.');
  if (type && SLOT_TYPES[type]?.fixed) return fail('Cannot build that.');
  if (cur.type === type) return ok();
  const c = city(s, d.cityId)!;
  if (cur.type && (cur.built || cur.paid)) {
    for (const [k, n] of Object.entries(SLOT_TYPES[cur.type].build.goods ?? {}))
      c.stockpile[k] = (c.stockpile[k] ?? 0) + Math.floor(n * (cur.built ? 0.25 : 1));
  }
  d.slots[i] = emptySlot(type);
  if (type) {
    const why = slotProblem(s, c.civId, d.hex, d.hex === c.hex, type, d.id);
    if (why) return ok(`${SLOT_TYPES[type].name} planned, but: ${why}`);
  }
  return ok();
}

export function renameDistrict(s: GameState, districtId: number, name: string): Result {
  const d = s.districts.find(x => x.id === districtId);
  if (!d || !name.trim()) return fail('Invalid name.');
  d.name = name.trim().slice(0, 28);
  return ok();
}

export function removeDistrict(s: GameState, districtId: number): Result {
  const d = s.districts.find(x => x.id === districtId);
  if (!d) return fail('No such district.');
  const c = city(s, d.cityId);
  if (c && c.hex === d.hex) return fail('The city centre cannot be removed.');
  for (let i = 0; i < 9; i++) setSlot(s, d.id, i, null);
  s.districts = s.districts.filter(x => x !== d);
  return ok(`${d.name} cleared.`);
}

/** Replace every slot of a district with a blueprint's layout (the town hall stays). */
export function applyBlueprint(s: GameState, districtId: number, bp: Blueprint): Result {
  const d = s.districts.find(x => x.id === districtId);
  if (!d) return fail('No such district.');
  for (let i = 0; i < 9; i++) {
    if (d.slots[i].type && SLOT_TYPES[d.slots[i].type!]?.fixed) continue;
    setSlot(s, d.id, i, bp.slots[i]);
  }
  return ok(`${bp.name} applied to ${d.name}.`);
}

export function saveBlueprint(
  s: GameState,
  civId: number,
  name: string,
  slots: (string | null)[],
): Result {
  const civ = s.civs[civId];
  const n = name.trim().slice(0, 28);
  if (!n) return fail('Name the blueprint.');
  const clean = slots.map(t => (t && !SLOT_TYPES[t]?.fixed ? t : null));
  const ex = civ.blueprints.find(b => b.name.toLowerCase() === n.toLowerCase());
  if (ex) ex.slots = clean;
  else civ.blueprints.push({ id: s.nextId++, name: n, slots: clean });
  return ok(`Blueprint "${n}" saved.`);
}

export function deleteBlueprint(s: GameState, civId: number, id: number) {
  const civ = s.civs[civId];
  civ.blueprints = civ.blueprints.filter(b => b.id !== id);
}

// ---------------------------------------------------------------- roads

/** Troops or settlers lay a road on the hex they stand on; it takes their remaining moves. */
export function buildRoad(s: GameState, fid: number): Result {
  const f = formation(s, fid);
  if (!f) return fail('No such formation.');
  if (s.roads[f.hex]) return fail('There is a road here already.');
  if (!isPassableLand(s.map, f.hex)) return fail('No road can be built here.');
  if (f.moves <= 0) return fail('No moves left this turn.');
  s.roads[f.hex] = 1;
  f.moves = 0;
  f.path = [];
  return ok('Road built.');
}

export { marketCities, marketStock };
