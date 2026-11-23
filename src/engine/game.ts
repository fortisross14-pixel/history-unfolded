/**
 * Game state and every action a player (human or AI) can take. All functions mutate the state
 * in place and return a result message; the UI re-renders from the state afterwards.
 */
import { CITY_NAMES, CIV_PRESETS, INDEPENDENT_PRESETS } from '../data/civs.ts';
import { independentTurn } from './independents.ts';
import { historyTurn } from './events.ts';
import { DEPOSITS, GOODS } from '../data/goods.ts';
import { isWater, type ReliefId, type TerrainId, type VegetationId } from '../data/terrain.ts';
import { DEFAULT_LOADOUT, isNavalLoadout, ITEMS, SLOTS, type Loadout } from '../data/items.ts';
import { AGE_GATE, ageOf, ageTechs, ERAS, TECHS, TECH_LIST } from '../data/techs.ts';
import { distance, neighbors, within, type Grid } from './hex.ts';
import { generateMap, isPassableLand, MAP_SIZES } from './mapgen.ts';
import { findPath } from './path.ts';
import { hashSeed, mulberry32 } from './rng.ts';
import type {
  City,
  Civ,
  Cohort,
  Design,
  Formation,
  GameSettings,
  GameState,
  Tier,
} from './types.ts';
import { aiTurn, planDistricts, playerAutomation } from './ai.ts';
import {
  alliesOf,
  breakTreaties,
  diplomacyTurn,
  hasPact,
  proposeDeal,
  remember,
  setEndWarFn,
  setCedeFn,
  setPowerFn,
} from './diplomacy.ts';
import { civMods, pct } from './mods.ts';
import { cultureTurn, newCultureState } from './culture.ts';
import { CULTURE, TAGS } from '../data/culture.ts';
import { tagCounts as tagCountsOf } from './mods.ts';
import {
  build,
  cityDistricts,
  invalidateMarkets,
  cityEconomy,
  DISTRICT_CAP,
  emptySlot,
  isCentre,
  shareFood,
  housingCells,
  TIER_NAME,
  TIERS,
  rankOf,
  landOf,
  marketCities,
  marketSpend,
  marketStock,
  marketTake,
  capStores,
  powderNeed,
  slotProblem,
  constructionQueue,
} from './economy.ts';
import { isRural, SLOT_TYPES } from '../data/slots.ts';
import {
  awardTrinket,
  dynastyTurn,
  foundingDynasty,
  levyXpFrom,
  maybeTrinket,
  settlementAreas,
  settlePending,
} from './dynasty.ts';
import { AREA_NAMES, type Area } from '../data/dynasties.ts';
import { difficultyOf, yieldFactor } from './difficulty.ts';
import { victoryTurn } from './victory.ts';
import { aiPathTurn, enterAge } from './paths.ts';
import { crisisTurn } from './crises.ts';
import { faithTurn } from './faith.ts';
import { aiWonderTurn, wonderCulture, wondersOf, workOnWonder } from './wonders.ts';
import { WONDER_SCORE } from '../data/wonders.ts';
import { coalitionTurn } from './coalition.ts';
import { chronicle, recordStats } from './stats.ts';
import { aiPolicyTurn, policyTurn } from './policies.ts';
import { settlerFactor } from '../data/policies.ts';
import { realmEventTurn, settleRealmEvent } from './realmEvents.ts';
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
  fleetCapacity,
  loadoutCost,
  loadoutProblem,
  people,
  refitCost,
  SETTLER_COHORTS,
  isCivilian,
} from './units.ts';

export const SAVE_VERSION = 11;
export const CITY_RADIUS = 1;
export const TERRITORY_RADIUS = 2;
/**
 * Settlements keep two hexes between them: each one's land is its centre and the six hexes
 * around it, where its districts stand, and no two settlements share a hex of land.
 */
export const MIN_CITY_DISTANCE = 3;
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
    memories: [],
    treaties: [],
    proposals: [],
    districts: [],
    roads: new Array(map.w * map.h).fill(0),
    events: [],
    lastEvent: {},
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
      researchGoal: null,
      culture: newCultureState(),
      leanings: pickLeanings(settings.map.seed, i),
      met: [],
      alive: true,
      kills: 0,
      losses: 0,
      dynasties: [],
      ruling: -1,
      trinkets: [],
    };
    s.civs.push(civ);
    const house = foundingDynasty(s, civ);
    civ.dynasties.push(house);
    civ.ruling = house.id;
    const start = map.starts[i];
    const g = gridOf(s);
    const free = neighbors(g, start).filter(k => isPassableLand(map, k));
    const spot = (n: number) => free[n % Math.max(1, free.length)] ?? start;
    addFormation(s, civ.id, 'settlers', start, SETTLER_COHORTS, 'Settlers');
    const extra = civ.isPlayer ? difficultyOf(s).startCohorts : 0;
    if (civ.isPlayer) civ.gold += difficultyOf(s).startGold;
    addFormation(s, civ.id, 'army', spot(0), LEVY_COHORTS + extra, nextLevyName(s, civ.id));
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
  placeIndependents(s, civCount);
  for (const c of s.civs) updateExplored(s, c.id);
  log(s, 0, `Turn 1. ${civCount} peoples begin on a ${map.type.replace('-', ' ')} world.`);
  return s;
}

/** Free peoples take the start spots no major people uses: one city and a garrison each. */
function placeIndependents(s: GameState, civCount: number) {
  const want = MAP_SIZES[s.settings.map.size].independents;
  const spots = s.map.starts.slice(civCount, civCount + want);
  spots.forEach((hex, k) => {
    const preset = INDEPENDENT_PRESETS[k % INDEPENDENT_PRESETS.length];
    const civ: Civ = {
      id: s.civs.length,
      name: preset.name,
      color: preset.color,
      isPlayer: false,
      independent: true,
      techs: [],
      researching: null,
      science: 0,
      gold: 30,
      explored: new Array(s.map.w * s.map.h).fill(0),
      designs: [],
      blueprints: [],
      cityNames: 0,
      levies: 0,
      researchGoal: null,
      culture: newCultureState(),
      leanings: [],
      met: [],
      alive: true,
      kills: 0,
      losses: 0,
      dynasties: [],
      ruling: -1,
      trinkets: [],
    };
    s.civs.push(civ);
    const house = foundingDynasty(s, civ);
    civ.dynasties.push(house);
    civ.ruling = house.id;
    const settlers = addFormation(s, civ.id, 'settlers', hex, SETTLER_COHORTS, 'Settlers');
    foundCity(s, settlers.id);
    const c = s.cities.find(x => x.civId === civ.id);
    if (!c) return;
    c.name = preset.city;
    c.pop = 1600;
    const last = s.log[s.log.length - 1];
    if (last?.civId === civ.id) last.text = `The ${civ.name} keep the free city of ${c.name}.`;
    const garrison = addFormation(s, civ.id, 'army', hex, 4, `${preset.city} Guard`);
    for (const co of garrison.cohorts) co.loadout = { ...co.loadout, weapon: 'spear' };
    garrison.fortified = true;
  });
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

function nextFleetName(s: GameState, civId: number): string {
  const n = s.formations.filter(f => f.civId === civId && f.kind === 'fleet').length + 1;
  const suf =
    n % 10 === 1 && n % 100 !== 11
      ? 'st'
      : n % 10 === 2 && n % 100 !== 12
        ? 'nd'
        : n % 10 === 3 && n % 100 !== 13
          ? 'rd'
          : 'th';
  return `${n}${suf} Fleet`;
}

/** Build a ship of a naval design in a city with a shipyard; it takes 50 crew from the city. */
export function buildShip(s: GameState, cityId: number, designId: number): Result {
  const c = city(s, cityId);
  if (!c) return fail('No such city.');
  const civ = s.civs[c.civId];
  const d = civ.designs.find(x => x.id === designId);
  if (!d || !d.naval) return fail('Pick a ship design.');
  if (!hasSlot(s, c, 'shipyard')) return fail(`${c.name} needs a shipyard.`);
  const problem = loadoutProblem(d.loadout, civ.techs);
  if (problem) return fail(problem);
  if (c.pop - SHIP_CREW < MIN_CITY_POP) return fail(`${c.name} is too small to crew a ship.`);
  const g = gridOf(s);
  const water = neighbors(g, c.hex).filter(
    k => isWaterHex(s, k) && !formationsAt(s, k).some(o => o.civId !== c.civId),
  );
  if (!water.length) return fail('No free water next to the city.');
  const spot =
    water.find(k =>
      s.formations.some(
        o =>
          o.kind === 'fleet' &&
          o.civId === c.civId &&
          o.hex === k &&
          o.cohorts.length < capOf(o, s),
      ),
    ) ?? water[0];
  if (!marketSpend(s, c, loadoutCost(d.loadout))) return fail(`${c.name} cannot pay for the ship.`);
  c.pop -= SHIP_CREW;
  const ship: Cohort = {
    id: s.nextId++,
    strength: COHORT_SIZE,
    xp: 0,
    designId: d.id,
    loadout: { ...d.loadout },
  };
  const host = s.formations.find(
    o =>
      o.kind === 'fleet' && o.civId === c.civId && o.hex === spot && o.cohorts.length < capOf(o, s),
  );
  if (host) host.cohorts.push(ship);
  else {
    const f: Formation = {
      id: s.nextId++,
      civId: c.civId,
      name: nextFleetName(s, c.civId),
      kind: 'fleet',
      hex: spot,
      cohorts: [ship],
      moves: 0,
      path: [],
      fortified: false,
    };
    s.formations.push(f);
  }
  log(s, c.civId, `${c.name} launched a ${d.name}.`);
  updateExplored(s, c.civId);
  return ok(`${d.name} launched from ${c.name}.`);
}

export const SHIP_CREW = 50;

export function log(s: GameState, civId: number, text: string) {
  s.log.push({ turn: s.turn, civId, text });
  chronicle(s, civId, text);
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
    for (const k of within(g, c.hex, territoryRadius(s, c.civId))) {
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
    if (d <= territoryRadius(s, civId) && d < bd) {
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
    for (const k of within(g, f.hex, formationSight(f, s.map, civMods(s, civId).sight))) v[k] = 1;
  }
  for (const c of s.cities) {
    if (c.civId !== civId) continue;
    for (const k of within(g, c.hex, territoryRadius(s, civId) + 1)) v[k] = 1;
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

// ---------------------------------------------------------------- ships and cargo

export const isWaterHex = (s: GameState, h: number) => isWater(s.map.terrain[h]);
/** Formations carried by a fleet. */
export const cargoOf = (s: GameState, fleet: Formation) =>
  s.formations.filter(o => o.aboard === fleet.id);
/** Free cohort places on a fleet. */
export const roomOn = (s: GameState, fleet: Formation) =>
  fleetCapacity(fleet) - cargoOf(s, fleet).reduce((a, o) => a + o.cohorts.length, 0);
/** An own fleet on `hex` with room for `f`. */
export function shipFor(s: GameState, f: Formation, hex: number): Formation | undefined {
  return s.formations.find(
    o =>
      o.kind === 'fleet' &&
      o.civId === f.civId &&
      o.hex === hex &&
      o !== f &&
      roomOn(s, o) >= f.cohorts.length,
  );
}
/** An own coastal city a fleet can sail into. */
export function isPort(s: GameState, civId: number, hex: number): boolean {
  const c = cityAt(s, hex);
  return !!c && c.civId === civId && neighbors(gridOf(s), hex).some(k => isWaterHex(s, k));
}

/** Remove a formation; a fleet takes its cargo down with it. */
export function removeFormation(s: GameState, f: Formation) {
  const lost = f.kind === 'fleet' ? cargoOf(s, f) : [];
  s.formations = s.formations.filter(x => x !== f && !lost.includes(x));
}

/** Can `f` end its move on `hex`? Returns the formation it would merge into, or a reason. */
export function arrival(
  s: GameState,
  f: Formation,
  hex: number,
): { mergeWith?: Formation; embark?: Formation; blocked?: string } {
  const there = formationsAt(s, hex).filter(o => o.id !== f.id);
  if (there.some(o => o.civId !== f.civId)) return { blocked: 'Another people holds that hex.' };
  const c = cityAt(s, hex);
  if (c && c.civId !== f.civId) return { blocked: 'A foreign city.' };
  const water = isWaterHex(s, hex);
  if (f.kind !== 'fleet' && water) {
    const ship = shipFor(s, f, hex);
    return ship ? { embark: ship } : { blocked: 'No ship there with room for them.' };
  }
  if (f.kind === 'fleet' && !water && !isPort(s, f.civId, hex))
    return { blocked: 'Ships stay on water or in your ports.' };
  if (water && f.kind !== 'fleet') return {};
  const same = there.filter(o => o.kind === f.kind && o.aboard === undefined);
  if (!same.length) return {};
  const fits = same.find(o => o.cohorts.length + f.cohorts.length <= capOf(o, s));
  if (!fits)
    return {
      blocked: `Merging would exceed the command limit of ${capOf(same[0], s)} cohorts. Split first.`,
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

/**
 * Cost of one step. Roads: half a move. Ships move on water and into own ports. Troops board
 * an own ship with room, or land from one, at the cost of all their moves.
 */
export function stepCost(s: GameState, f: Formation, from: number, to: number): number {
  if (f.kind === 'fleet') {
    if (!isWaterHex(s, to)) return isPort(s, f.civId, to) ? 1 : Infinity;
    return enterCost(s.map, f, to);
  }
  if (isWaterHex(s, to)) return shipFor(s, f, to) ? Math.max(1, formationMoves(f)) : Infinity;
  const base = enterCost(s.map, f, to);
  if (!isFinite(base)) return base;
  if (isWaterHex(s, from)) return Math.max(1, formationMoves(f)); // landing
  // railways: a fifth of a move from rail to rail
  if (s.roads[from] === RAIL && s.roads[to] === RAIL) return RAIL_COST;
  if (s.roads[from] && s.roads[to]) return Math.max(0.2, 0.5 + civMods(s, f.civId).roadCost);
  return base;
}

export function planPath(s: GameState, f: Formation, target: number): number[] | null {
  const civ = s.civs[f.civId];
  const pass = passable(s, f);
  return findPath(gridOf(s), f.hex, target, (from, to) => {
    if (!pass(to)) return Infinity;
    // unexplored hexes are assumed passable at base cost until seen (on land, or water for ships)
    if (!civ.explored[to]) return isWaterHex(s, to) === (f.kind === 'fleet') ? 1 : Infinity;
    return stepCost(s, f, from, to);
  });
}

/** Order a formation to go to `target`: it moves now as far as it can and keeps the rest for later turns. */
export function orderMove(s: GameState, fid: number, target: number): Result {
  const f = formation(s, fid);
  if (!f) return fail('No such formation.');
  // a direct order takes the unit back from automation
  f.auto = undefined;
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
    const end = last ? arrival(s, f, next) : undefined;
    if (end?.blocked) {
      f.path = [];
      return fail(end.blocked);
    }
    // a formation can always enter a hex if it has any movement left (it then stops)
    f.moves = Math.max(0, f.moves - cost);
    const from = f.hex;
    f.hex = next;
    f.path.shift();
    if (f.kind === 'fleet') for (const o of cargoOf(s, f)) o.hex = next;
    else if (isWaterHex(s, next)) {
      f.aboard = shipFor(s, f, next)?.id;
      f.moves = 0;
    } else {
      // stepping onto land always leaves the ship (also from a ship docked in port)
      if (isWaterHex(s, from)) f.moves = 0;
      f.aboard = undefined;
    }
    // troops at war can cut (or reopen) roads and sea lanes as they move
    const carries = (h: number) => s.roads[h] || s.map.river[h] || isWaterHex(s, h);
    if ((carries(from) || carries(next)) && s.wars.some(w => w.a === f.civId || w.b === f.civId))
      invalidateMarkets();
    updateExplored(s, f.civId);
    if (end?.mergeWith) merged = mergeInto(s, f, end.mergeWith);
    if (end?.embark) merged = `${f.name} boarded ${end.embark.name}.`;
    // re-plan if the terrain just revealed makes the rest of the path impossible
    if (f.path.length && !isFinite(stepCost(s, f, f.hex, f.path[0]))) {
      const target = f.path[f.path.length - 1];
      f.path = planPath(s, f, target) ?? [];
    }
  }
  return ok(merged);
}

/** `a` joins `b`: cohorts keep their loadouts, the result moves at the slower pace. */
export function mergeInto(s: GameState, a: Formation, b: Formation): string {
  b.cohorts.push(...a.cohorts);
  for (const o of cargoOf(s, a)) o.aboard = b.id;
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
  if (a.cohorts.length + b.cohorts.length > capOf(b, s))
    return fail(`Over the command limit of ${capOf(b, s)} cohorts.`);
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
  if (f.kind === 'fleet') {
    const left = { ...f, cohorts: f.cohorts.filter(c => !ids.has(c.id)) };
    if (fleetCapacity(left) < cargoOf(s, f).reduce((x, o) => x + o.cohorts.length, 0))
      return fail('Land the troops first: the rest of the fleet could not carry them.');
  }
  f.cohorts = f.cohorts.filter(c => !ids.has(c.id));
  const n: Formation = {
    id: s.nextId++,
    civId: f.civId,
    kind: f.kind,
    hex: f.hex,
    cohorts: moving,
    path: [],
    fortified: false,
    name:
      name ??
      (f.kind === 'settlers'
        ? 'Settlers'
        : f.kind === 'fleet'
          ? nextFleetName(s, f.civId)
          : nextLevyName(s, f.civId)),
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

/** Rename a settlement (its centre district follows when it still carries the old name). */
export function renameCity(s: GameState, cityId: number, name: string): Result {
  const c = city(s, cityId);
  const n = name.trim().slice(0, 24);
  if (!c || !n) return fail('Give it a name.');
  if (s.cities.some(x => x !== c && x.name.toLowerCase() === n.toLowerCase()))
    return fail(`There is already a ${n}.`);
  const old = c.name;
  c.name = n;
  for (const d of s.districts)
    if (d.cityId === c.id && d.name.startsWith(old)) d.name = n + d.name.slice(old.length);
  return ok(`${old} is now called ${n}.`);
}

export function fortify(s: GameState, fid: number): Result {
  const f = formation(s, fid);
  if (!f) return fail('No such formation.');
  f.fortified = !f.fortified;
  f.path = [];
  f.auto = undefined;
  return ok();
}

/** Why this formation cannot be automated in this way, or null. */
export function autoProblem(f: Formation, mode: 'crew' | 'explore'): string | null {
  if (mode === 'crew')
    return f.kind === 'workers' || f.kind === 'engineers' ? null : 'Only crews build on their own.';
  return f.kind === 'army' && f.cohorts.length <= 2
    ? null
    : 'Only small bands (one or two cohorts) explore on their own.';
}

/** Let a formation work on its own (or take it back with mode null). */
export function automate(s: GameState, fid: number, mode: 'crew' | 'explore' | null): Result {
  const f = formation(s, fid);
  if (!f) return fail('No such formation.');
  if (!mode) {
    f.auto = undefined;
    return ok('Back under your orders.');
  }
  const why = autoProblem(f, mode);
  if (why) return fail(why);
  f.auto = mode;
  f.fortified = false;
  f.path = [];
  return ok(
    mode === 'crew'
      ? `${f.name} build roads and railways on their own.`
      : `${f.name} explore on their own.`,
  );
}

/** The governor plans a settlement's districts and buildings each turn, or stops. */
export function automateCity(s: GameState, cityId: number, on: boolean): Result {
  const c = city(s, cityId);
  if (!c) return fail('No such settlement.');
  c.auto = on || undefined;
  return ok(on ? `The governor plans ${c.name} from now on.` : `You plan ${c.name} again.`);
}

// ---------------------------------------------------------------- cities

export function canFoundCity(s: GameState, f: Formation): string | null {
  if (f.kind !== 'settlers') return 'Only settlers can found a town.';
  if (!isPassableLand(s.map, f.hex)) return 'Towns need open land.';
  const g = gridOf(s);
  const near = s.cities.find(c => distance(g, c.hex, f.hex) < MIN_CITY_DISTANCE);
  if (near)
    return `Too close to ${near.name}: leave two hexes between settlements (each needs the six hexes around it for its districts).`;
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
    tier: 'settlement',
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
  s.districts.push(centre);
  s.roads[c.hex] = 1;
  invalidateMarkets();
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
  // spare housing fills bigger levies (those men are people too)
  const extra = housingLevyExtra(s, c);
  const people = LEVY_PEOPLE + extra * COHORT_SIZE;
  if (c.pop - people < MIN_CITY_POP)
    return fail(`${c.name} needs ${MIN_CITY_POP + people} people to raise a levy.`);
  c.pop -= people;
  const f = addFormation(
    s,
    c.civId,
    'army',
    c.hex,
    levySize(s, c.civId) + extra,
    nextLevyName(s, c.civId),
  );
  f.moves = 0;
  // barracks, a house seasoned in war, and the realm's War College all season new levies
  const seasoned =
    (hasSlot(s, c, 'barracks') ? 1 : 0) +
    levyXpFrom(s, c) +
    (s.cities.some(x => x.civId === c.civId && hasSlot(s, x, 'war-college')) ? 1 : 0);
  for (const co of f.cohorts) co.xp = Math.max(co.xp, seasoned);
  log(s, c.civId, `${c.name} raised the ${f.name} (${people} people).`);
  return ok(`${f.name} raised in ${c.name}.`);
}

/**
 * Food a settlement must store to grow by 250 people: bigger ones grow more slowly, and every
 * housing cell beyond its districts' two makes growing 8% cheaper (down to 60%).
 */
export const growthCost = (s: GameState, c: City) =>
  Math.round(
    (15 + (c.pop / 1000) * 12 + (c.pop / 1000) ** 2 * 0.6) *
      pct(civMods(s, c.civId).growthPct) *
      Math.max(0.6, 1 - 0.08 * housingCells(s, c).spare),
  );

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
  if (isCivilian(f)) return { problem: `${f.name} carry no weapons.` };
  if ((f.kind === 'fleet') !== !!ITEMS[to.armour]?.naval)
    return {
      problem: f.kind === 'fleet' ? 'Ships take ship designs.' : 'Troops take troop designs.',
    };
  if (f.aboard !== undefined) return { problem: 'Land the troops first.' };
  if (f.kind === 'fleet' && !isWaterHex(s, f.hex) && !isPort(s, f.civId, f.hex))
    return { problem: 'Ships refit in port or near home.' };
  const civ = s.civs[f.civId];
  const problem = loadoutProblem(to, civ.techs);
  if (problem) return { problem };
  const c = supplyingCity(s, f.civId, f.hex);
  if (!c) return { problem: 'Refit only inside your territory, near one of your cities.' };
  const g = gridOf(s);
  const armoury = hasSlot(s, c, 'armoury');
  const far = !armoury && distance(g, c.hex, f.hex) > CITY_RADIUS;
  const mul = (far ? 1.5 : 1) * (armoury ? 0.8 : 1) * pct(civMods(s, f.civId).refitPct);
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
    ex.naval = isNavalLoadout(loadout);
    return {
      ok: true,
      msg: `${n} updated. Re-equip cohorts to give them the new gear.`,
      id: ex.id,
    };
  }
  const d: Design = {
    id: s.nextId++,
    name: n,
    loadout: { ...loadout },
    naval: isNavalLoadout(loadout),
  };
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

/** How many of an age's techs a people knows, gates left out. */
export const knownInAge = (civ: Civ, era: number) =>
  ageTechs(era).filter(t => civ.techs.includes(t.id)).length;

/** Techs that can be researched now: in an age already reached, prerequisites known; a gate also
 * needs enough of its age known. */
export function availableTechs(civ: Civ) {
  const age = ageOf(civ.techs);
  return TECH_LIST.filter(
    t =>
      !civ.techs.includes(t.id) &&
      t.era <= age &&
      t.requires.every(r => civ.techs.includes(r)) &&
      (t.gate === undefined || knownInAge(civ, t.era) >= t.gate),
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
  // a civil war choice left open: the player stands with the throne; an event, its first answer
  events.push(...settlePending(s, me));
  events.push(...settleRealmEvent(s, me));
  // what the player has handed over: crews, scouts and settlements that run themselves
  playerAutomation(s, me);
  const logStart = s.log.length;
  // AI acts after the player, in the same turn
  for (const civ of s.civs)
    if (!civ.isPlayer && civ.alive) {
      if (civ.independent) {
        events.push(...independentTurn(s, civ, id => levy(s, id)));
        for (const c of s.cities) if (c.civId === civ.id) planDistricts(s, civ, c);
      } else {
        aiTurn(s, civ);
        aiWonderTurn(s, civ, c => cityEconomy(s, c).total.prod);
      }
    }
  // tell the player about anything the AI did to them
  for (const e of s.log.slice(logStart))
    if (e.civId !== me.id && e.text.includes(me.name)) events.push(e.text);

  const cultureOf = new Map<number, number>();
  for (const civ of s.civs) {
    if (!civ.alive) continue;
    let science = 0,
      gold = 0,
      culture = 0;
    const mine = s.cities.filter(x => x.civId === civ.id);
    const econ = new Map(mine.map(c => [c.id, cityEconomy(s, c)]));
    // towns feed the cities they trade with
    const fed = shareFood(s, new Map(mine.map(c => [c.id, econ.get(c.id)!.surplus])));
    for (const c of mine) {
      const e = econ.get(c.id)!;
      science += e.total.science;
      culture += e.total.culture;
      gold += e.total.gold;
      for (const [k, n] of Object.entries(e.total.goods))
        c.stockpile[k] = (c.stockpile[k] ?? 0) + n;
      // what the buildings and hearths burned this turn (as much as the market had)
      marketTake(s, c, e.inputs);
      c.food += fed.get(c.id) ?? e.surplus;
      // food stored turns into people while there is housing; starvation shrinks the city
      const need = growthCost(s, c);
      if (c.food >= need) {
        if (c.pop + 250 <= e.total.housing) {
          c.food -= need;
          c.pop += 250;
        } else c.food = need;
      }
      // a wonder under way takes its share of the production first
      const ww = workOnWonder(s, c, e.total.prod, !constructionQueue(s, c).length);
      events.push(...ww.msgs);
      culture += wonderCulture(s, c.id);
      for (const done of build(s, c, ww.left)) {
        if (civ.isPlayer) events.push(`${c.name}: ${done.text} finished.`);
        // a finished building of a line may bring a trinket for the houses
        const st = SLOT_TYPES[done.type];
        const line: Area | undefined = st?.id === 'war-college' ? 'military' : st?.line;
        // a great building always brings two treasures of its line
        if (st?.role === 'great' && line) {
          const a = awardTrinket(s, civ, line, c.id * 17);
          const b = awardTrinket(s, civ, line, c.id * 19);
          if (civ.isPlayer)
            events.push(`${st.name} brings the ${a.name} and the ${b.name} to your treasury.`);
        }
        const t =
          line && st?.role !== 'great'
            ? maybeTrinket(s, civ, line, c.id * 13 + done.type.length)
            : null;
        if (t && civ.isPlayer)
          events.push(
            `A trinket is found in ${c.name}: the ${t.name} (${AREA_NAMES[line!]}). Give it to a house.`,
          );
      }
      if (c.food < -5) {
        c.food = 0;
        c.pop = Math.max(MIN_CITY_POP, c.pop - 250);
        if (civ.isPlayer) events.push(`${c.name} is starving.`);
      }
    }
    // difficulty: the AI's yields are scaled, never the player's
    const yf = yieldFactor(s, civ);
    cultureOf.set(civ.id, culture * yf);
    let upkeep = 0;
    for (const f of s.formations)
      if (f.civId === civ.id) for (const co of f.cohorts) upkeep += cohortUpkeep(co);
    upkeep = Math.round(upkeep * pct(civMods(s, civ.id).upkeepPct));
    civ.gold += Math.round(gold * yf) - upkeep;
    if (civ.gold < 0) civ.gold = 0;
    // firearms burn powder each turn; a realm out of it fires at half
    const powder = powderNeed(s, civ.id);
    const cap0 = mine[0];
    civ.shortOf = [];
    if (powder > 0 && cap0) {
      const have = marketStock(s, cap0).saltpeter ?? 0;
      if (have < powder) civ.shortOf.push('saltpeter');
      marketTake(s, cap0, { saltpeter: Math.min(have, powder) });
    }
    // stores hold only so much: what does not fit is lost
    capStores(s, civ.id, econ);
    // what the realm made this turn, for the dominance victories
    let gdp = gold * yf;
    for (const e of econ.values()) {
      gdp += e.total.prod + Math.max(0, e.surplus) * 0.25;
      for (const [k, n] of Object.entries(e.total.goods))
        gdp += n * (GDP_WEIGHT[GOODS[k]?.kind ?? 'raw'] ?? 1);
    }
    // the realm's pressures, read by crises (crises.ts): crowding, hunger, debt, industry, comfort
    let crowd = 0,
      starving = 0,
      industry = 0,
      comfort = 0;
    for (const c of mine) {
      const e = econ.get(c.id)!;
      if (c.pop >= 4000 && e.total.housing > 0) crowd = Math.max(crowd, c.pop / e.total.housing);
      if (e.surplus < 0 && (fed.get(c.id) ?? e.surplus) < 0) starving++;
      comfort += e.comfort.pct;
      for (const d of cityDistricts(s, c))
        for (const x of d.slots) if (x.built && x.type && INDUSTRY.has(x.type)) industry++;
    }
    civ.stats = {
      gdp: Math.round(gdp),
      culture: Math.round(culture * yf),
      crowd: Math.round(crowd * 100) / 100,
      starving,
      upkeep,
      income: Math.round(gold * yf),
      industry,
      comfort: mine.length ? Math.round(comfort / mine.length) : 0,
    };
    if (!civ.researching) civ.researching = nextResearch(s, civ);
    // science is stored even while nothing is chosen, so choosing late costs nothing
    civ.science += science * yf;
    if (civ.researching) {
      const t = TECHS[civ.researching];
      const cost = techCost(s, civ, t.id);
      if (civ.science >= cost) {
        civ.science -= cost;
        civ.techs.push(t.id);
        civ.researching = null;
        if (t.gate !== undefined) {
          log(s, civ.id, `The ${civ.name} enter the ${ERAS[t.era + 1]} age.`);
          enterAge(s, civ, t.era + 1);
          if (civ.isPlayer)
            events.push(
              `A new age: the ${ERAS[t.era + 1]}. ${ageTechs(t.era + 1).length} new techs to research.`,
            );
        } else {
          log(s, civ.id, `${civ.name} learned ${t.name}.`);
          if (civ.isPlayer) events.push(`Research complete: ${t.name}. ${t.note}`);
        }
      }
    }
  }

  for (const civ of s.civs) {
    if (!civ.alive || civ.independent) continue;
    const msgs = cultureTurn(s, civ, cultureOf.get(civ.id) ?? 0);
    if (civ.isPlayer) events.push(...msgs);
    const dyn = dynastyTurn(s, civ);
    if (civ.isPlayer) events.push(...dyn);
    // AI peoples choose their national direction and issue edicts
    if (!civ.isPlayer) aiPathTurn(s, civ);
    // hard times that grow out of the realm's own state
    const cr = crisisTurn(s, civ);
    if (civ.isPlayer) events.push(...cr);
    // age policies pull on the noble houses; AI peoples review their levers
    policyTurn(s, civ);
    if (!civ.isPlayer) aiPolicyTurn(s, civ);
  }
  events.push(...faithTurn(s));
  events.push(...diplomacyTurn(s));
  events.push(...coalitionTurn(s));
  events.push(...historyTurn(s));
  heal(s);
  events.push(...siegeTurn(s));
  recordStats(s);
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
  // now and then a story asks for a choice
  if (me.alive) {
    const ev = realmEventTurn(s, me);
    if (ev) events.push(`A matter for the throne: ${ev}.`);
  }
  events.push(...checkVictory(s));
  return events;
}

/**
 * Wounded cohorts recover: inside your territory they are topped up from the nearest city's
 * people (troops are population); outside it only field medics help.
 */
function heal(s: GameState) {
  for (const f of s.formations) {
    if (isCivilian(f) || f.aboard !== undefined) continue;
    const medics = f.cohorts.some(c => c.loadout.kit === 'field-medics');
    const home = supplyingCity(s, f.civId, f.hex);
    for (const c of f.cohorts) {
      if (c.strength >= COHORT_SIZE) continue;
      if (home) {
        const want = Math.min(
          COHORT_SIZE - c.strength,
          (medics ? 20 : 10) + civMods(s, f.civId).heal,
        );
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

// ---------------------------------------------------------------- save format

const TER: TerrainId[] = [
  'ocean',
  'coast',
  'lake',
  'grassland',
  'plains',
  'desert',
  'tundra',
  'snow',
];
const REL: ReliefId[] = ['flat', 'hills', 'mountains'];
const VEG: VegetationId[] = ['none', 'forest', 'jungle', 'marsh'];
const enc = <T extends string>(xs: T[], ids: T[]) =>
  xs.map(x => String.fromCharCode(97 + ids.indexOf(x))).join('');
const dec = <T extends string>(str: string, ids: T[]) =>
  Array.from(str, ch => ids[ch.charCodeAt(0) - 97]);
function bits(xs: number[]): string {
  const bytes = new Uint8Array(Math.ceil(xs.length / 8));
  xs.forEach((v, i) => v && (bytes[i >> 3] |= 1 << (i & 7)));
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return btoa(out);
}
function unbits(b64: string, n: number): number[] {
  const raw = atob(b64);
  return Array.from({ length: n }, (_, i) => (raw.charCodeAt(i >> 3) >> (i & 7)) & 1);
}

/**
 * Saves are versioned. Each entry upgrades a save from version k to k + 1; keep them forever.
 * Versions before MIN_SAVE_VERSION came from development builds and are not loadable.
 */
const MIGRATIONS: Record<number, (d: GameState) => GameState> = {
  // 5 → 6: research went to ages; anyone already holding a later age's tech gets its gates
  5: d => {
    for (const c of d.civs) {
      const top = Math.max(1, ...c.techs.map(id => TECHS[id]?.era ?? 1));
      for (let e = 2; e <= top; e++) if (!c.techs.includes(AGE_GATE[e])) c.techs.push(AGE_GATE[e]);
      if (c.researchGoal && !TECHS[c.researchGoal]) c.researchGoal = null;
    }
    return { ...d, version: 6 };
  },
  // 6 → 7: settlements became one hex with 2/4/6 districts; old ones become towns keeping
  // their centre and their oldest other district
  6: d => {
    for (const c of d.cities) {
      c.tier = 'town';
      const mine = d.districts.filter(x => x.cityId === c.id);
      const centre = mine.find(x => x.slots.some(y => y.type === 'town-hall'));
      const other = mine.filter(x => x !== centre).sort((a, b) => a.id - b.id)[0];
      const keep = new Set([centre, other].filter(Boolean));
      d.districts = d.districts.filter(x => x.cityId !== c.id || keep.has(x));
      for (const x of keep) x!.hex = c.hex;
    }
    return { ...d, version: 7 };
  },
  // 7 → 8: the specialised rural buildings became farms, pastures and mines
  7: d => {
    const to: Record<string, string> = {
      'grain-field': 'farm',
      'pig-pen': 'pasture',
      'cattle-pasture': 'pasture',
      'sheep-run': 'pasture',
      'horse-stud': 'pasture',
      quarry: 'mine',
      'copper-mine': 'mine',
      'tin-mine': 'mine',
      'iron-mine': 'mine',
      'coal-mine': 'mine',
      'gold-mine': 'mine',
      'silver-mine': 'mine',
      'saltpeter-works': 'mine',
    };
    for (const x of d.districts)
      for (const st of x.slots) if (st.type && to[st.type]) st.type = to[st.type];
    for (const c of d.civs)
      for (const b of c.blueprints) b.slots = b.slots.map(t => (t && to[t]) || t);
    return { ...d, version: 8 };
  },
  // 8 → 9: dynasties, and buildings on lines
  8: d => {
    for (const c of d.civs) {
      c.trinkets = [];
      const house = foundingDynasty(d, c);
      c.dynasties = [house];
      c.ruling = house.id;
    }
    return { ...d, version: 9 };
  },
  // 9 → 10: history events (free peoples only appear in new games)
  9: d => ({ ...d, events: [], lastEvent: {}, version: 10 }),
  // 10 → 11: districts stand on their own hexes around the centre (they all sat on the centre)
  10: d => {
    for (const c of d.cities) {
      const ds = d.districts.filter(x => x.cityId === c.id);
      for (const x of ds)
        if (x.hex === c.hex && !x.slots.some(y => y.type === 'town-hall')) {
          const h = bestDistrictHex(
            d,
            c,
            x.slots.map(y => y.type),
          );
          if (h >= 0) x.hex = h;
        }
    }
    return { ...d, version: 11 };
  },
};
export const MIN_SAVE_VERSION = 5;

/** Compact JSON: terrain as strings, explored and roads as bitsets, no generation-only data. */
export function serialize(s: GameState): string {
  const N = s.map.w * s.map.h;
  const map = {
    ...s.map,
    terrain: enc(s.map.terrain, TER),
    relief: enc(s.map.relief, REL),
    vegetation: enc(s.map.vegetation, VEG),
    elevation: [],
    riverTo: s.map.riverTo.flatMap((t, i) => (t >= 0 ? [i, t] : [])),
    river: s.map.river.flatMap((v, i) => (v ? [i, v] : [])),
  };
  const civs = s.civs.map(c => ({ ...c, explored: bits(c.explored) }));
  return JSON.stringify({ format: 2, n: N, state: { ...s, map, civs, roads: bits(s.roads) } });
}

export class SaveError extends Error {}

export function deserialize(json: string): GameState {
  const raw = JSON.parse(json);
  let s: GameState;
  if (raw && raw.format === 2) {
    const st = raw.state,
      N = raw.n as number;
    const riverTo = new Array<number>(N).fill(-1),
      river = new Array<number>(N).fill(0);
    for (let k = 0; k < st.map.riverTo.length; k += 2)
      riverTo[st.map.riverTo[k]] = st.map.riverTo[k + 1];
    for (let k = 0; k < st.map.river.length; k += 2) river[st.map.river[k]] = st.map.river[k + 1];
    s = {
      ...st,
      map: {
        ...st.map,
        terrain: dec(st.map.terrain, TER),
        relief: dec(st.map.relief, REL),
        vegetation: dec(st.map.vegetation, VEG),
        riverTo,
        river,
      },
      civs: st.civs.map((c: Civ & { explored: string }) => ({
        ...c,
        explored: unbits(c.explored as unknown as string, N),
      })),
      roads: unbits(st.roads, N),
    };
  } else s = raw as GameState; // plain JSON from earlier builds
  if (typeof s.version !== 'number') throw new SaveError('This is not a History Unfolded save.');
  if (s.version > SAVE_VERSION)
    throw new SaveError('This save comes from a newer version of the game.');
  if (s.version < MIN_SAVE_VERSION)
    throw new SaveError('This save comes from an early test version and cannot be loaded.');
  while (s.version < SAVE_VERSION) s = MIGRATIONS[s.version]({ ...s, version: s.version });
  for (const c of s.cities) c.tier ??= 'town';
  for (const c of s.civs)
    for (const d of c.dynasties ?? []) {
      d.traits ??= {};
      d.xp ??= {};
    }
  validate(s);
  return s;
}

/** Refuse saves whose pieces do not fit together; quietly drop references to removed content. */
function validate(s: GameState) {
  const N = s.map.w * s.map.h;
  const sizes = [
    s.map.terrain.length,
    s.map.relief.length,
    s.map.vegetation.length,
    s.map.river.length,
    s.roads.length,
  ];
  if (sizes.some(n => n !== N) || s.civs.some(c => c.explored.length !== N))
    throw new SaveError('The save is damaged (map data does not fit).');
  if (
    s.map.terrain.some(t => !t) ||
    s.formations.some(f => f.hex < 0 || f.hex >= N) ||
    s.cities.some(c => c.hex < 0 || c.hex >= N)
  )
    throw new SaveError('The save is damaged.');
  for (const c of s.civs) c.techs = c.techs.filter(t => TECHS[t]);
  for (const f of s.formations)
    for (const co of f.cohorts)
      for (const k of SLOTS) if (!ITEMS[co.loadout[k]]) co.loadout[k] = DEFAULT_LOADOUT[k];
  // buildings that no longer exist leave an empty cell
  for (const d of s.districts)
    for (let i = 0; i < 9; i++)
      if (d.slots[i].type && !SLOT_TYPES[d.slots[i].type!]) d.slots[i] = emptySlot();
  for (const c of s.civs)
    for (const b of c.blueprints) b.slots = b.slots.map(t => (t && SLOT_TYPES[t] ? t : null));
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

/**
 * Declare war. Breaking a pact is remembered by everyone; the target's allies join in; the
 * target and its friends remember who started it.
 */
export function declareWar(s: GameState, a: number, b: number, called = false): Result {
  if (a === b || atWar(s, a, b)) return fail('Already at war.');
  const A = s.civs[a],
    B = s.civs[b];
  const treachery = hasPact(s, a, b);
  breakTreaties(s, a, b);
  s.wars.push({ a, b, since: s.turn });
  invalidateMarkets();
  const msg = called
    ? `The ${A.name} joined their allies against the ${B.name}!`
    : `The ${A.name} declared war on the ${B.name}${treachery ? ', breaking their pact' : ''}!`;
  log(s, a, msg);
  if (!called) {
    remember(s, b, a, 'war', 'Declared war on us', -40, 0.2);
    if (treachery)
      for (const c of s.civs)
        if (c.alive && c.id !== a)
          remember(s, c.id, a, 'treachery', 'Broke a sworn pact', c.id === b ? -40 : -15, 0.1);
    // the target's allies come to its aid
    for (const ally of alliesOf(s, b)) {
      if (ally === a || !s.civs[ally].alive || atWar(s, ally, a)) continue;
      declareWar(s, ally, a, true);
      remember(s, b, ally, 'aid', 'Stood by us in war', 20, 0.1);
    }
  }
  return ok(msg);
}

export function endWar(s: GameState, a: number, b: number) {
  invalidateMarkets();
  s.wars = s.wars.filter(w => !((w.a === a && w.b === b) || (w.a === b && w.b === a)));
  log(s, a, `The ${s.civs[a].name} and the ${s.civs[b].name} made peace.`);
}

/** Total fighting power of a civ (rough, for the AI and the peoples screen). */
export function militaryPower(s: GameState, civId: number): number {
  let p = 0;
  for (const f of s.formations) if (f.civId === civId) p += powerOf(f);
  return Math.round(p);
}

/** Offer peace: the other side weighs how the war is going and how long it has lasted. */
export function offerPeace(s: GameState, from: number, to: number): Result {
  if (!atWar(s, from, to)) return fail('You are not at war.');
  const r = proposeDeal(s, from, to, { give: {}, get: {}, peace: true });
  return r.ok ? ok(`Peace with the ${s.civs[to].name}.`) : fail(r.msg);
}

setPowerFn((s, civId) => militaryPower(s, civId));
setEndWarFn((s, a, b) => endWar(s, a, b));
setCedeFn((s, id, to) => cedeCity(s, id, to));

/** A settlement handed over by treaty: no plunder, but its old owner's troops withdraw. */
export function cedeCity(s: GameState, cityId: number, to: number) {
  const c = city(s, cityId);
  if (!c || c.civId === to) return;
  const old = s.civs[c.civId];
  c.civId = to;
  c.governor = undefined;
  c.siege = undefined;
  delete c.wonder;
  if (
    c.tier === 'metropolis' &&
    s.cities.some(x => x !== c && x.civId === to && x.tier === 'metropolis')
  ) {
    c.tier = 'large-city';
    const extra = cityDistricts(s, c)
      .filter(d => !isCentre(d))
      .slice(DISTRICT_CAP['large-city'] - 1);
    s.districts = s.districts.filter(d => !extra.includes(d));
  }
  // the old owner's troops and crews withdraw to their nearest settlement
  const home = s.cities
    .filter(x => x.civId === old.id)
    .sort((a, b) => distance(gridOf(s), a.hex, c.hex) - distance(gridOf(s), b.hex, c.hex))[0];
  for (const f of s.formations)
    if (f.hex === c.hex && f.civId === old.id) {
      if (home) {
        f.hex = home.hex;
        f.path = [];
      } else f.cohorts = [];
    }
  s.formations = s.formations.filter(f => f.cohorts.length);
  invalidateMarkets();
  remember(s, old.id, to, 'ceded', 'Took our land by treaty', -15, 0.1);
  log(s, to, `The ${old.name} cede ${c.name} to the ${s.civs[to].name}.`);
}

/** Score: people, cities, knowledge and culture. Decides the game at the turn limit. */
export function score(s: GameState, civId: number): number {
  const cities = s.cities.filter(c => c.civId === civId);
  const pop = cities.reduce((a, c) => a + c.pop, 0);
  const civ = s.civs[civId];
  return Math.round(
    pop / 1000 +
      cities.length * 10 +
      civ.techs.length * 3 +
      civ.culture.taken.length * 3 +
      wondersOf(s, civId).length * WONDER_SCORE +
      civ.kills / 2000,
  );
}

export const DEFAULT_TURN_LIMIT = 400;

/** Buildings of the industrial economy: where strikes start. */
const INDUSTRY = new Set([
  'factory',
  'foundry',
  'ironworks',
  'power-plant',
  'railway-station',
  'paper-mill',
  'cannery',
  'sawmill',
  'pumping-station',
]);

/** Goods by kind, as wealth in the GDP: made goods are worth most. */
const GDP_WEIGHT: Record<string, number> = { food: 0.5, raw: 1, luxury: 2, made: 3 };

/**
 * Decide the game: last people standing, a held dominance goal, the Scientific projects, or
 * best score at the turn limit. Returns lines for the player (rivals close to winning).
 */
export function checkVictory(s: GameState): string[] {
  if (s.ended) return [];
  const me = player(s);
  if (!me.alive) {
    s.ended = { winner: -1, reason: 'defeat' };
    return [];
  }
  // free peoples do not count: the game is between the great peoples
  const alive = s.civs.filter(c => c.alive && !c.independent);
  if (alive.length === 1) {
    s.ended = { winner: alive[0].id, reason: 'conquest' };
    return [];
  }
  const v = victoryTurn(s);
  if (v.winner) {
    s.ended = { winner: v.winner.civId, reason: v.winner.kind };
    return v.news;
  }
  if (s.turn >= (s.settings.turnLimit ?? DEFAULT_TURN_LIMIT)) {
    const best = alive.sort((x, y) => score(s, y.id) - score(s, x.id))[0];
    s.ended = { winner: best.id, reason: 'score' };
  }
  return v.news;
}

// ---------------------------------------------------------------- battle

/** What stands on a hex for an attacker: the strongest formation, else a city's own guard. */
export function defenderAt(s: GameState, hex: number): { f?: Formation; city?: City } {
  const water = isWaterHex(s, hex);
  const fs = formationsAt(s, hex).filter(f =>
    water ? f.kind === 'fleet' : f.kind === 'army' && f.aboard === undefined,
  );
  const city = cityAt(s, hex);
  const f = fs.sort((a, b) => people(b) - people(a))[0];
  return { f, city };
}

/** The city guard: townsfolk with spears and hide shields, more of them in bigger cities. */
export function cityGuard(s: GameState, c: City): Cohort[] {
  const walls = cityWalls(s, c);
  const n =
    3 +
    Math.floor(c.pop / 2000) +
    walls.guard +
    Math.floor(civMods(s, c.civId).guard) +
    // a governor house seasoned in war musters more of the townsfolk
    Math.floor(levyXpFrom(s, c) * 1.5);
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
  if (isCivilian(f)) return { problem: `${f.name} do not fight.` };
  const waterTarget = isWaterHex(s, hex);
  if (f.kind === 'army' && waterTarget) return { problem: 'Troops cannot fight ships at sea.' };
  if (f.kind === 'fleet' && !waterTarget && !f.cohorts.some(c => cohortRanged(c)))
    return { problem: 'Only ships with archers or guns can bombard the shore.' };
  if (
    f.kind === 'army' &&
    f.aboard !== undefined &&
    formationsAt(s, hex).some(o => o.kind === 'fleet')
  )
    return { problem: 'Nothing to land on.' };
  const { f: df, city } = defenderAt(s, hex);
  const civilians = formationsAt(s, hex).filter(x => isCivilian(x) && x.civId !== f.civId);
  const civId = df?.civId ?? city?.civId ?? civilians[0]?.civId;
  if (civId === undefined || civId === f.civId) return { problem: 'Nothing to attack there.' };
  if (f.kind === 'fleet' && !waterTarget && !df && !city)
    return { problem: 'Land troops to take them.' };
  if (distance(gridOf(s), f.hex, hex) !== 1) return { problem: 'Move next to them first.' };
  if (f.moves <= 0) return { problem: 'No moves left this turn.' };
  if (!atWar(s, f.civId, civId)) return { needsWar: civId, target: { f: df, city, civId } };
  return { target: { f: df, city, civId } };
}

function battleInputs(s: GameState, f: Formation, hex: number) {
  const { f: df, city } = defenderAt(s, hex);
  const defCivId = df?.civId ?? city!.civId;
  const defCohorts = df ? df.cohorts : cityGuard(s, city!);
  const defName = df ? `${s.civs[defCivId].name} ${df.name}` : `${city!.name} guard`;
  const naval = f.kind === 'fleet';
  // ships fire at the shore; they never board a beach
  const volleyOnly = f.cohorts.every(c => cohortRanged(c)) || (naval && !isWaterHex(s, hex));
  const landing = f.kind === 'army' && f.aboard !== undefined;
  const own = territory(s);
  const rough = s.map.relief[hex] !== 'flat' || s.map.vegetation[hex] !== 'none';
  const am = civMods(s, f.civId),
    dm = civMods(s, defCivId);
  const attHome = own[f.hex] === f.civId,
    defHome = own[hex] === defCivId;
  // situational bonuses add up into simple multipliers for each side
  const boost = (m: typeof am, attacking: boolean, home: boolean) => {
    const atSea = isWaterHex(s, hex) || (attacking && naval);
    const sit =
      (atSea ? m.navalPct : 0) +
      (attacking && landing ? -30 : 0) +
      (attacking ? m.attackPct : 0) +
      (home ? m.homePct : 0) +
      (rough ? m.roughPct : 0) +
      (attacking && city ? m.siegePct : 0);
    return {
      melee: pct(m.meleePct + sit),
      ranged: pct(m.rangedPct + sit),
      charge: pct(m.chargePct + sit),
      taken: Math.max(
        0.4,
        1 -
          (m.defensePct +
            (home ? m.homePct : 0) +
            (rough ? m.roughPct : 0) +
            (!attacking && city ? m.cityDefensePct : 0) +
            (atSea ? m.navalPct / 2 : 0) -
            (attacking && landing ? 25 : 0)) /
            100,
      ),
    };
  };
  const walls = city ? cityWalls(s, city).walls : 0;
  const siege = f.cohorts.length
    ? f.cohorts.reduce((a, c) => a + cohortSiege(c), 0) / f.cohorts.length
    : 0;
  return {
    att: {
      name: `${s.civs[f.civId].name} ${f.name}`,
      cohorts: f.cohorts,
      morale: formationMorale(f) + am.morale,
      boost: dryPowder(s, f, boost(am, true, attHome)),
    },
    def: {
      name: defName,
      cohorts: defCohorts,
      morale: (df ? formationMorale(df) + (city ? 15 : 0) : 45) + dm.morale,
      boost: df ? dryPowder(s, df, boost(dm, false, defHome)) : boost(dm, false, defHome),
    },
    ctx: {
      map: s.map,
      hex,
      fortified: !!df?.fortified,
      city: !!city,
      volleyOnly,
      walls,
      siege: Math.min(1, siege),
    },
    df,
    city,
    defCivId,
  };
}

/** The city's best defences: walls or castle in its centre. */
export function cityWalls(s: GameState, c: City): { walls: number; guard: number } {
  let walls = 0,
    guard = 0;
  // a long siege breaches the walls: they stop counting until it is lifted
  if (siegeBreached(s, c)) return { walls: 0, guard: 0 };
  for (const d of cityDistricts(s, c))
    for (const x of d.slots)
      if (x.built && x.type && SLOT_TYPES[x.type].walls && SLOT_TYPES[x.type].walls! > walls) {
        walls = SLOT_TYPES[x.type].walls!;
        guard = SLOT_TYPES[x.type].guard ?? 0;
      }
  return { walls, guard };
}

// ---------------------------------------------------------------- sieges

/** Enemy cohorts that must stand around a settlement to besiege it. */
export const SIEGE_COHORTS = 3;
/** Turns of siege before the guard starts to starve, and before the walls are breached. */
export const SIEGE_STARVE = 2;
export const SIEGE_BREACH = 5;

export const siegeBreached = (s: GameState, c: City) =>
  !!c.siege && s.turn - c.siege.since >= SIEGE_BREACH;

/** Enemy troops (at war with the owner) standing next to a settlement, by people. */
export function besiegers(s: GameState, c: City): Map<number, number> {
  const g = gridOf(s);
  const around = new Set(neighbors(g, c.hex));
  const by = new Map<number, number>();
  for (const f of s.formations)
    if (
      f.kind === 'army' &&
      around.has(f.hex) &&
      f.aboard === undefined &&
      atWar(s, f.civId, c.civId)
    )
      by.set(f.civId, (by.get(f.civId) ?? 0) + f.cohorts.length);
  return by;
}

/**
 * Each turn: a settlement ringed by enough enemy troops is besieged. It stops growing, its guard
 * does not recover and, after SIEGE_STARVE turns, starves (−10% a turn); after SIEGE_BREACH turns
 * its walls are breached. Lifted, the guard recovers 10% a turn as before.
 */
export function siegeTurn(s: GameState): string[] {
  const out: string[] = [];
  const me = s.civs.find(c => c.isPlayer);
  for (const c of s.cities) {
    const by = [...besiegers(s, c).entries()].sort((a, b) => b[1] - a[1])[0];
    if (!by || by[1] < SIEGE_COHORTS) {
      if (c.siege && me && (c.civId === me.id || c.siege.by === me.id))
        out.push(`The siege of ${c.name} is lifted.`);
      c.siege = undefined;
      c.guard = Math.min(1, c.guard + 0.1);
      continue;
    }
    if (!c.siege) {
      c.siege = { since: s.turn, by: by[0] };
      if (me && c.civId === me.id)
        out.push(
          `${c.name} is besieged by the ${s.civs[by[0]].name}! Lift the siege, or its walls fall in ${SIEGE_BREACH} turns.`,
        );
      else if (me && by[0] === me.id)
        out.push(
          `Your troops besiege ${c.name}: its guard starves and its walls fall in ${SIEGE_BREACH} turns.`,
        );
    }
    const t = s.turn - c.siege.since;
    c.food = Math.min(c.food, 0);
    if (t >= SIEGE_STARVE) c.guard = Math.max(0.2, c.guard - 0.1);
    if (t === SIEGE_BREACH && me && (c.civId === me.id || c.siege.by === me.id))
      out.push(`The walls of ${c.name} are breached.`);
  }
  return out;
}

const cohortSiege = (c: Cohort) => SLOTS.reduce((a, k) => a + (ITEMS[c.loadout[k]].siege ?? 0), 0);

/** Short of powder, a formation's firearms fire at half: its ranged strength drops by their share. */
function dryPowder<T extends { ranged: number }>(s: GameState, f: Formation, b: T): T {
  if (!s.civs[f.civId].shortOf?.includes('saltpeter')) return b;
  const guns = f.cohorts.filter(c => SLOTS.some(k => ITEMS[c.loadout[k]]?.powder)).length;
  const ranged = f.cohorts.filter(c => cohortRanged(c)).length;
  if (!guns || !ranged) return b;
  return { ...b, ranged: b.ranged * (1 - 0.5 * (guns / ranged)) };
}

/** Cohorts per new levy. */
export const levySize = (s: GameState, civId: number) =>
  LEVY_COHORTS + Math.floor(civMods(s, civId).levyCohorts);
/**
 * Spare housing (cells beyond each district's two) lets a settlement raise bigger levies (+1
 * cohort per two, up to +3) and send out settlers for fewer people (−10% each, to 60%).
 */
export const housingLevyExtra = (s: GameState, c: City) =>
  Math.min(3, Math.floor(housingCells(s, c).spare / 2));
export const settlersCost = (s: GameState, c: City) =>
  Math.round(
    (SETTLERS_PEOPLE *
      Math.max(0.6, 1 - 0.1 * housingCells(s, c).spare) *
      settlerFactor(s.civs[c.civId])) /
      50,
  ) * 50;
export const territoryRadius = (s: GameState, civId: number) =>
  TERRITORY_RADIUS + Math.floor(civMods(s, civId).territoryRadius);

/** Later eras cost more than their listed base (indexed by era, 1..4). */
const ERA_COST = [1, 1.3, 1.6, 2, 4.5, 3.5];

/** Research cost after culture leanings and bonuses. */
export function techCost(s: GameState, civ: Civ, id: string): number {
  const t = TECHS[id];
  const m = civMods(s, civ.id);
  const fav = t.favoured && (tagCountsOf(civ)[t.favoured] ?? 0) >= 2 ? -20 : 0;
  return Math.round(t.cost * ERA_COST[t.era] * pct(m.researchPct + fav));
}

/** What to research next: the player's goal path, else (AI) a pick that suits its plans. */
export function nextResearch(s: GameState, civ: Civ): string | null {
  const avail = availableTechs(civ);
  if (civ.researchGoal) {
    if (civ.techs.includes(civ.researchGoal)) civ.researchGoal = null;
    else {
      const step = goalStep(civ, civ.researchGoal);
      if (step) return step;
    }
  }
  if (civ.isPlayer || !avail.length) return null;
  // AI: cheapest first, with a pull toward its culture and war needs
  const atWarNow = s.wars.some(w => w.a === civ.id || w.b === civ.id);
  const rng = mulberry32(hashSeed(s.settings.map.seed, s.turn * 17 + civ.id));
  const score = (id: string) => {
    const t = TECHS[id];
    let v = techCost(s, civ, id);
    // a new age is worth reaching as soon as it opens
    if (t.gate !== undefined) v *= 0.35;
    if (t.favoured && civ.leanings.includes(t.favoured)) v *= 0.7;
    if (civ.sea === undefined && (id === 'sailing' || id === 'navigation') && boxedIn(s, civ))
      v *= 0.3;
    if (
      atWarNow &&
      /sword|bow|mail|armour|pike|gun|musket|drill|chivalry|feudal|siege|iron|bronze/.test(
        t.note.toLowerCase() + id,
      )
    )
      v *= 0.7;
    return v * (0.85 + rng() * 0.3);
  };
  return avail.sort((a, b) => score(a.id) - score(b.id))[0].id;
}

/** A people with no room left on its own land (it will need ships). */
function boxedIn(s: GameState, civ: Civ): boolean {
  return (
    s.formations.some(f => f.civId === civ.id && f.kind === 'settlers' && !f.path.length) ||
    s.map.type === 'archipelago'
  );
}

/** The first tech on the way to `goal` that can be researched now. */
export function goalStep(civ: Civ, goal: string): string | null {
  const seen = new Set<string>();
  const walk = (id: string): string | null => {
    if (civ.techs.includes(id) || seen.has(id)) return null;
    seen.add(id);
    const t = TECHS[id];
    // a later age is reached through its gate
    if (t.era > ageOf(civ.techs)) return walk(AGE_GATE[t.era]);
    if (t.gate !== undefined && knownInAge(civ, t.era) < t.gate) {
      // any tech of the age counts: take the cheapest open one
      const open = availableTechs(civ)
        .filter(x => x.era === t.era && x.gate === undefined)
        .sort((a, b) => a.cost - b.cost);
      return open[0]?.id ?? null;
    }
    const missing = t.requires.filter(r => !civ.techs.includes(r));
    if (!missing.length) return id;
    // cheapest branch first
    for (const r of missing.sort((a, b) => TECHS[a].cost - TECHS[b].cost)) {
      const x = walk(r);
      if (x) return x;
    }
    return null;
  };
  return walk(goal);
}

export function setResearchGoal(s: GameState, civId: number, goal: string | null): Result {
  const civ = s.civs[civId];
  if (goal && civ.techs.includes(goal)) return fail('Already known.');
  civ.researchGoal = goal;
  if (goal) civ.researching = goalStep(civ, goal);
  return ok(goal ? `Researching towards ${TECHS[goal].name}.` : undefined);
}

function pickLeanings(seed: number, i: number): string[] {
  const r = mulberry32(hashSeed(seed, 500 + i));
  const tags = Object.keys(TAGS);
  const a = tags[Math.floor(r() * tags.length)];
  let b = tags[Math.floor(r() * tags.length)];
  if (b === a) b = tags[(tags.indexOf(a) + 3) % tags.length];
  return [a, b];
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
    f.aboard = undefined;
    const msg = `${attCiv.name} ${f.name} scattered the ${s.civs[chk.target!.civId].name} ${victims.map(v => v.name.toLowerCase()).join(' and ')}.`;
    log(s, f.civId, msg);
    checkElimination(s);
    updateExplored(s, f.civId);
    return ok(msg);
  }

  const b = battleInputs(s, f, hex);
  const rng = mulberry32(hashSeed(s.settings.map.seed, s.turn * 7919 + f.id * 31 + hex));
  const report = resolveBattle(b.att, b.def, { ...b.ctx, rng });
  report.scene = isWaterHex(s, hex)
    ? 'naval'
    : f.aboard !== undefined
      ? 'landing'
      : b.city
        ? 'siege'
        : report.lines.some(l => l.startsWith('Charge:'))
          ? 'charge'
          : s.map.vegetation[hex] === 'forest' || s.map.vegetation[hex] === 'jungle'
            ? 'forest'
            : 'field';
  const defCiv = s.civs[b.defCivId];

  const applyLosses = (fm: Formation, loss: Record<number, number>) => {
    for (const c of fm.cohorts) {
      c.strength = Math.max(0, c.strength - (loss[c.id] ?? 0));
      if (c.strength > 0) c.xp += 1;
    }
    // cohorts cut below a fifth of their men are folded into the survivors
    const lost = fm.cohorts.filter(c => c.strength < 20);
    fm.cohorts = fm.cohorts.filter(c => c.strength >= 20);
    if (!fm.cohorts.length) removeFormation(s, fm);
    return lost.length;
  };
  applyLosses(f, report.attacker.cohortLoss);
  if (b.df) applyLosses(b.df, report.defender.cohortLoss);
  const war = s.wars.find(
    w => (w.a === f.civId && w.b === b.defCivId) || (w.b === f.civId && w.a === b.defCivId),
  );
  if (war) {
    war.dead ??= {};
    war.dead[f.civId] = (war.dead[f.civId] ?? 0) + report.attacker.lost;
    war.dead[b.defCivId] = (war.dead[b.defCivId] ?? 0) + report.defender.lost;
    war.lastFight = s.turn;
  }
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
  // a broken enemy that lost heavily: the victors may carry off a war trophy
  if (report.outcome === 'defender-broke' && report.defender.lost >= 300) {
    const civ = s.civs[f.civId];
    const roll = mulberry32(hashSeed(s.settings.map.seed, s.turn * 331 + f.id))();
    if (roll < 0.25) {
      const t = awardTrinket(s, civ, 'military', f.id);
      if (civ.isPlayer)
        log(s, civ.id, `A trophy from the field: the ${t.name}. Give it to a house.`);
    }
  }
  if (report.outcome === 'defender-broke' && b.df && defenderAlive) {
    // retreat away from the attacker, or be cut down if there is nowhere to go
    const pass = passable(s, b.df);
    const options = neighbors(g, hex).filter(
      n =>
        n !== f.hex &&
        pass(n) &&
        isFinite(enterCost(s.map, b.df!, n)) &&
        !formationsAt(s, n).some(x => x.civId === b.df!.civId && x.kind === b.df!.kind),
    );
    options.sort((x, y) => distance(g, y, f.hex) - distance(g, x, f.hex));
    if (options.length && !b.city) {
      b.df.hex = options[0];
      for (const o of cargoOf(s, b.df)) o.hex = options[0];
      b.df.fortified = false;
      b.df.path = [];
      result = `${b.def.name} fell back.`;
    } else if (b.city) {
      result = `${b.def.name} was driven from the walls.`;
      // the garrison is broken but stays in the city; a second assault will meet the city guard
      b.df.fortified = false;
      b.df.moves = 0;
    } else {
      removeFormation(s, b.df);
      result = `${b.def.name} had nowhere to run and was destroyed.`;
    }
  } else if (report.outcome === 'defender-broke' && !b.df && b.city && attackerAlive) {
    // city guard broken: the city falls to troops that can hold it
    if (f.kind === 'army' && f.cohorts.some(c => !cohortRanged(c))) {
      result = captureCity(s, b.city, f);
      f.aboard = undefined;
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
    (!cityAt(s, hex) || cityAt(s, hex)!.civId === f.civId) &&
    isWaterHex(s, hex) === (f.kind === 'fleet')
  ) {
    f.hex = hex;
    f.aboard = undefined;
    if (f.kind === 'fleet') for (const o of cargoOf(s, f)) o.hex = hex;
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
  s.civs[by.civId].captured = (s.civs[by.civId].captured ?? 0) + 1;
  const old = s.civs[c.civId];
  const civ = s.civs[by.civId];
  c.civId = by.civId;
  c.governor = undefined;
  invalidateMarkets();
  // a people keeps one metropolis: a second one taken steps down to a city
  if (
    c.tier === 'metropolis' &&
    s.cities.some(x => x !== c && x.civId === by.civId && x.tier === 'metropolis')
  ) {
    c.tier = 'large-city';
    const extra = cityDistricts(s, c)
      .filter(d => !isCentre(d))
      .slice(DISTRICT_CAP['large-city'] - 1);
    s.districts = s.districts.filter(d => !extra.includes(d));
  }
  c.pop = Math.max(MIN_CITY_POP, Math.round((c.pop * 0.75) / 50) * 50);
  // civilians in the city are lost
  s.formations = s.formations.filter(x => !(x.hex === c.hex && x.civId === old.id));
  by.hex = c.hex;
  const msg = `${civ.name} captured ${c.name} from the ${old.name}!`;
  remember(s, old.id, civ.id, 'conquest', 'Took our cities', -30, 0.1);
  if (old.independent)
    for (const o of s.civs)
      if (o.alive && o.independent && o.id !== old.id)
        remember(s, o.id, civ.id, 'crushed', 'Crushed a free people', -15, 0.1);
  const war = s.wars.find(
    w => (w.a === civ.id && w.b === old.id) || (w.b === civ.id && w.a === old.id),
  );
  if (war) {
    war.taken ??= {};
    war.taken[civ.id] = (war.taken[civ.id] ?? 0) + 1;
  }
  // the conquerors carry off a treasure of what the place was known for
  const areas = Object.entries(settlementAreas(s, c)).sort((x, y) => y[1] - x[1]);
  const loot = awardTrinket(s, civ, (areas[0]?.[0] as Area) ?? 'military', c.id);
  log(s, by.civId, msg);
  return `${msg} Among the spoils: the ${loot.name}.`;
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
  const people = settlersCost(s, c);
  if (c.pop - people < MIN_CITY_POP)
    return fail(`${c.name} needs ${MIN_CITY_POP + people} people to send out settlers.`);
  c.pop -= people;
  const f = addFormation(s, c.civId, 'settlers', c.hex, SETTLER_COHORTS, 'Settlers');
  f.moves = 0;
  log(s, c.civId, `${c.name} sent out settlers.`);
  return ok(`Settlers leave ${c.name}.`);
}

// ---------------------------------------------------------------- districts

export const hasSlot = (s: GameState, c: City, type: string) =>
  cityDistricts(s, c).some(d => d.slots.some(x => x.built && x.type === type));

/** Lay out a new district on a hex near the city. Slots are built one by one by the city. */
/** Districts a settlement may still lay out. */
export const districtRoom = (s: GameState, c: City) =>
  DISTRICT_CAP[c.tier] - s.districts.filter(d => d.cityId === c.id).length;

/** Lay out a new district in a settlement, up to its rank's limit. */
/** The hexes around a settlement where a district may still be laid out: its land, not water. */
export function freeDistrictHexes(s: GameState, c: City): number[] {
  const used = new Set(s.districts.filter(d => d.cityId === c.id).map(d => d.hex));
  return landOf(s, c).filter(k => k !== c.hex && !used.has(k) && !isWater(s.map.terrain[k]));
}

/** Why a district cannot stand on this hex, or null. */
export function districtHexProblem(s: GameState, c: City, hex: number): string | null {
  if (hex === c.hex) return 'The centre district already stands there.';
  if (!landOf(s, c).includes(hex))
    return `Not ${c.name}'s land: districts go on the six hexes around it.`;
  if (isWater(s.map.terrain[hex])) return 'Districts stand on land.';
  if (s.districts.some(d => d.cityId === c.id && d.hex === hex))
    return 'A district already stands there.';
  return null;
}

/**
 * The best free hex for a district with these buildings: on a deposit its buildings work, by
 * the water for docks and yards, else open land.
 */
export function bestDistrictHex(s: GameState, c: City, slots: (string | null)[]): number {
  const free = freeDistrictHexes(s, c);
  if (!free.length) return -1;
  const g = gridOf(s);
  const types = new Set(slots.filter(Boolean) as string[]);
  const score = (k: number) => {
    let v = 0;
    const dep = s.map.deposit[k];
    if (dep && types.has(DEPOSITS[dep.kind].by)) v += 10;
    const wet = neighbors(g, k).some(n => isWater(s.map.terrain[n]));
    if (wet && [...types].some(t => SLOT_TYPES[t]?.needs?.water)) v += 6;
    if (s.map.relief[k] === 'mountains') v -= 2;
    if (dep && !types.has(DEPOSITS[dep.kind].by)) v -= 1;
    return v;
  };
  return free.sort((a, b) => score(b) - score(a) || a - b)[0];
}

export function placeDistrict(
  s: GameState,
  cityId: number,
  name: string,
  slots: (string | null)[],
  at?: number,
): Result & { id?: number } {
  const c = city(s, cityId);
  if (!c) return fail('No such settlement.');
  if (districtRoom(s, c) <= 0) {
    const next = TIERS[rankOf(c.tier) + 1];
    return fail(
      next
        ? `${c.name} is full: as a ${TIER_NAME[next].toLowerCase()} it would hold ${DISTRICT_CAP[next]}.`
        : `${c.name} holds all seven districts it can.`,
    );
  }
  const hex = at ?? bestDistrictHex(s, c, slots);
  if (hex < 0) return fail(`No free land is left around ${c.name}.`);
  const why = districtHexProblem(s, c, hex);
  if (why) return fail(why);
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
  // a blueprint may hold buildings this place cannot take: leave those cells empty
  for (let i = 0; i < 9; i++) {
    const t = d.slots[i].type;
    if (t && slotProblem(s, c.civId, d.hex, false, t, d.id)) d.slots[i] = emptySlot();
  }
  return { ok: true, msg: `${d.name} laid out.`, id: d.id };
}

// ---------------------------------------------------------------- town, city, metropolis

export interface UpgradeInfo {
  to: City['tier'] | null;
  pop: number;
  gold: number;
  goods: Record<string, number>;
  /** why it cannot happen yet, or null */
  problem: string | null;
  /** rural buildings that will be pulled down */
  lost: number;
}

/** Housing cells a settlement must have built to rise, and the culture choice it needs (if any). */
export const RANK_NEEDS: Partial<Record<Tier, { housing: number; culture?: string }>> = {
  town: { housing: 2 },
  'large-town': { housing: 4 },
  city: { housing: 6, culture: 'city-charter' },
  'large-city': { housing: 7, culture: 'city-charter' },
  metropolis: { housing: 8, culture: 'seat-of-empire' },
};

/** What each step up costs: people, gold and building goods from the market. */
export const UPGRADE: Partial<
  Record<Tier, { pop: number; gold: number; goods: Record<string, number> }>
> = {
  town: { pop: 2500, gold: 25, goods: { wood: 10 } },
  'large-town': { pop: 4000, gold: 70, goods: { wood: 20, stone: 5 } },
  city: { pop: 6000, gold: 150, goods: { stone: 10, wood: 30 } },
  'large-city': { pop: 10000, gold: 250, goods: { stone: 20, wood: 40 } },
  metropolis: { pop: 15000, gold: 400, goods: { stone: 30, wood: 50 } },
};

/** What raising a settlement to the next size takes. */
export function upgradeInfo(s: GameState, c: City): UpgradeInfo {
  const to = TIERS[rankOf(c.tier) + 1] ?? null;
  if (!to) return { to, pop: 0, gold: 0, goods: {}, problem: 'Already a metropolis.', lost: 0 };
  const need = UPGRADE[to]!;
  const rank = RANK_NEEDS[to]!;
  const civ = s.civs[c.civId];
  // becoming a city builds over the centre's fields and mines
  const centre = s.districts.find(d => d.cityId === c.id && isCentre(d));
  const lost = to === 'city' && centre ? centre.slots.filter(x => isRural(x.type)).length : 0;
  let problem: string | null = null;
  const stock = marketStock(s, c);
  const shortGoods = Object.entries(need.goods).filter(([k, n]) => (stock[k] ?? 0) < n);
  if (
    to === 'metropolis' &&
    s.cities.some(x => x.civId === c.civId && x.tier === 'metropolis' && x !== c)
  )
    problem = 'A people can have only one metropolis.';
  else if (rank.culture && !civ.culture.taken.includes(rank.culture))
    problem = `Needs the ${CULTURE[rank.culture].name} culture choice.`;
  else if (housingCells(s, c).built < rank.housing)
    problem = `Needs ${rank.housing} housing cells built (${housingCells(s, c).built} now).`;
  else if (c.pop < need.pop)
    problem = `Needs ${need.pop.toLocaleString()} people (${c.pop.toLocaleString()} now).`;
  else if (civ.gold < need.gold) problem = `Needs ${need.gold} gold (${Math.floor(civ.gold)} now).`;
  else if (shortGoods.length)
    problem = `The market lacks ${shortGoods.map(([k, n]) => `${Math.ceil(n - (stock[k] ?? 0))} ${k}`).join(', ')}.`;
  return { to, pop: need.pop, gold: need.gold, goods: need.goods, problem, lost };
}

/**
 * Raise a town to a city (4 districts, building bonuses, no farms, woodlots or mines) or a
 * city to the people's one metropolis (6 districts, bigger bonuses).
 */
export function upgradeSettlement(s: GameState, cityId: number): Result {
  const c = city(s, cityId);
  if (!c) return fail('No such settlement.');
  const u = upgradeInfo(s, c);
  if (u.problem || !u.to) return fail(u.problem ?? 'Cannot grow further.');
  if (!marketSpend(s, c, u.goods)) return fail('The market cannot pay for it.');
  s.civs[c.civId].gold -= u.gold;
  const was = c.tier;
  c.tier = u.to;
  // becoming a city: the centre's fields and mines give way to streets (outer districts keep theirs)
  let cleared = 0;
  if (c.tier === 'city')
    for (const d of s.districts.filter(x => x.cityId === c.id && isCentre(x)))
      for (let i = 0; i < 9; i++)
        if (isRural(d.slots[i].type)) {
          d.slots[i] = emptySlot();
          cleared++;
        }
  log(
    s,
    c.civId,
    `${c.name} grew from a ${TIER_NAME[was].toLowerCase()} into a ${TIER_NAME[c.tier].toLowerCase()}.`,
  );
  return ok(
    `${c.name} is now a ${TIER_NAME[c.tier].toLowerCase()}: room for ${DISTRICT_CAP[c.tier]} districts${cleared ? `; ${cleared} farm and mine buildings in its centre gave way to streets` : ''}.`,
  );
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
    const why = slotProblem(s, c.civId, d.hex, isCentre(d), type, d.id);
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
  if (c && isCentre(d)) return fail('The centre district stays.');
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
/**
 * Who may lay a road: in the Ancient and Classical ages any army or workers; from the Medieval
 * age only workers or engineers (engineers come with the Industrial age, and will lay railways).
 */
export function roadBuilderProblem(s: GameState, f: Formation): string | null {
  if (f.kind === 'workers' || f.kind === 'engineers') return null;
  if (f.kind !== 'army') return 'Only troops (early on) or workers build roads.';
  if (ageOf(s.civs[f.civId].techs) >= 3)
    return 'From the Medieval age roads need workers: raise them in a settlement.';
  return null;
}

/** People and gold for a crew of workers (any age) or engineers (Industrial age). */
export const CREW = { workers: { people: 200, gold: 10 }, engineers: { people: 200, gold: 40 } };

export function trainCrew(s: GameState, cityId: number, kind: 'workers' | 'engineers'): Result {
  const c = city(s, cityId);
  if (!c) return fail('No such settlement.');
  const civ = s.civs[c.civId];
  if (kind === 'engineers' && ageOf(civ.techs) < 5)
    return fail('Engineers come with the Industrial age.');
  const need = CREW[kind];
  if (c.pop - need.people < MIN_CITY_POP)
    return fail(`${c.name} needs ${MIN_CITY_POP + need.people} people.`);
  if (civ.gold < need.gold) return fail(`A crew costs ${need.gold} gold.`);
  c.pop -= need.people;
  civ.gold -= need.gold;
  const f = addFormation(s, c.civId, kind, c.hex, 2, kind === 'workers' ? 'Workers' : 'Engineers');
  f.moves = 0;
  log(s, c.civId, `${c.name} sent out ${f.name.toLowerCase()}.`);
  return ok(`${f.name} leave ${c.name}.`);
}

/** A hex value in s.roads: 1 a road, 2 a railway (laid by engineers over a road). */
export const RAIL = 2;
export const RAIL_COST = 0.2;
export const RAIL_GOLD = 10;

/** Why this formation cannot lay a railway where it stands, or null. */
export function railProblem(s: GameState, f: Formation): string | null {
  if (f.kind !== 'engineers') return 'Only engineers lay railways.';
  if (!s.civs[f.civId].techs.includes('railways')) return 'Railways need the Railways tech.';
  if (s.roads[f.hex] === RAIL) return 'There is a railway here already.';
  if (!s.roads[f.hex]) return 'Railways are laid over a road: build the road first.';
  if (f.moves <= 0) return 'No moves left this turn.';
  if (s.civs[f.civId].gold < RAIL_GOLD) return `A stretch of railway costs ${RAIL_GOLD} gold.`;
  return null;
}

/** Engineers lay a railway over the road they stand on. */
export function buildRail(s: GameState, fid: number): Result {
  const f = formation(s, fid);
  if (!f) return fail('No such formation.');
  const why = railProblem(s, f);
  if (why) return fail(why);
  s.roads[f.hex] = RAIL;
  s.civs[f.civId].gold -= RAIL_GOLD;
  invalidateMarkets();
  f.moves = 0;
  f.path = [];
  return ok(`Railway laid (${RAIL_GOLD} gold).`);
}

export function buildRoad(s: GameState, fid: number): Result {
  const f = formation(s, fid);
  if (!f) return fail('No such formation.');
  // engineers on a road lay rails over it
  if (f.kind === 'engineers' && s.roads[f.hex] === 1) return buildRail(s, fid);
  const who = roadBuilderProblem(s, f);
  if (who) return fail(who);
  if (s.roads[f.hex]) return fail('There is a road here already.');
  if (!isPassableLand(s.map, f.hex)) return fail('No road can be built here.');
  if (f.moves <= 0) return fail('No moves left this turn.');
  s.roads[f.hex] = 1;
  invalidateMarkets();
  f.moves = 0;
  f.path = [];
  return ok('Road built.');
}

export { marketCities, marketStock };
