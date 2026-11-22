/**
 * Game state and every action a player (human or AI) can take. All functions mutate the state
 * in place and return a result message; the UI re-renders from the state afterwards.
 */
import { CITY_NAMES, CIV_PRESETS } from '../data/civs.ts';
import { DEPOSITS } from '../data/goods.ts';
import { DEFAULT_LOADOUT, ITEMS, SLOTS, type Loadout } from '../data/items.ts';
import { RELIEF, VEGETATION, TERRAIN } from '../data/terrain.ts';
import { TECHS, TECH_LIST } from '../data/techs.ts';
import { distance, neighbors, within, type Grid } from './hex.ts';
import { generateMap, hexFood, isPassableLand, MAP_SIZES } from './mapgen.ts';
import { findPath } from './path.ts';
import { hashSeed, mulberry32 } from './rng.ts';
import type { City, Civ, Cohort, Formation, GameSettings, GameState } from './types.ts';
import {
  capOf,
  COHORT_SIZE,
  enterCost,
  formationMoves,
  formationSight,
  LEVY_COHORTS,
  loadoutProblem,
  refitCost,
} from './units.ts';

export const SAVE_VERSION = 1;
export const CITY_RADIUS = 1;
export const TERRITORY_RADIUS = 2;
export const MIN_CITY_DISTANCE = 4;
export const LEVY_PEOPLE = LEVY_COHORTS * COHORT_SIZE;
export const MIN_CITY_POP = 1000;
export const START_CITY_POP = 2000;

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
      templates: [],
      cityNames: 0,
    };
    s.civs.push(civ);
    const start = map.starts[i];
    const g = gridOf(s);
    const free = neighbors(g, start).filter(k => isPassableLand(map, k));
    const spot = (n: number) => free[n % Math.max(1, free.length)] ?? start;
    addFormation(s, civ.id, 'settlers', start, 2, 'Settlers');
    addFormation(s, civ.id, 'army', spot(0), LEVY_COHORTS, nextLevyName(s, civ.id));
    const scout = addFormation(s, civ.id, 'army', spot(1), 1, 'Scouts');
    scout.cohorts[0].loadout = { ...DEFAULT_LOADOUT, kit: 'scouting-gear' };
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
  return { id: s.nextId++, strength: COHORT_SIZE, xp: 0, loadout: { ...loadout } };
}

function nextLevyName(s: GameState, civId: number): string {
  const n = s.formations.filter(f => f.civId === civId && /Levy$/.test(f.name)).length + 1;
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
  const e = s.civs[civId].explored;
  for (let i = 0; i < v.length; i++) if (v[i]) e[i] = 1;
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

export function planPath(s: GameState, f: Formation, target: number): number[] | null {
  const civ = s.civs[f.civId];
  const pass = passable(s, f);
  return findPath(gridOf(s), f.hex, target, (from, to) => {
    if (!pass(to)) return Infinity;
    // unexplored hexes are assumed passable at base cost until seen
    if (!civ.explored[to]) return 1;
    return enterCost(s.map, f, to);
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
    const cost = enterCost(s.map, f, next);
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
    pop: START_CITY_POP,
    food: 0,
    founded: s.turn,
    stockpile: { wood: 8, hides: 4, stone: 3 },
  };
  s.cities.push(c);
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
  log(s, c.civId, `${c.name} raised the ${f.name} (500 people).`);
  return ok(`${f.name} raised in ${c.name}.`);
}

/** Per-turn output of a city working its ring (placeholder until districts). */
export function cityYield(s: GameState, c: City) {
  const g = gridOf(s);
  let food = 0,
    prod = 0;
  const goods: Record<string, number> = {};
  const add = (k: string, n: number) => {
    goods[k] = (goods[k] ?? 0) + n;
  };
  for (const k of within(g, c.hex, CITY_RADIUS)) {
    const m = s.map;
    if (m.relief[k] === 'mountains') continue;
    food += hexFood(m, k);
    prod +=
      TERRAIN[m.terrain[k]].prod + RELIEF[m.relief[k]].prod + VEGETATION[m.vegetation[k]].prod;
    const wood = VEGETATION[m.vegetation[k]].wood;
    if (wood) add('wood', wood);
    if (m.deposit[k] && depositVisible(s, c.civId, k)) {
      const d = m.deposit[k]!;
      for (const [good, n] of Object.entries(DEPOSITS[d.kind].yields)) {
        if (good === 'grain' || good === 'fish' || good === 'meat') food += n * d.richness;
        else add(good, n * d.richness);
      }
    }
  }
  const eat = Math.ceil(c.pop / 1000) * 2;
  const science = 1 + Math.floor(c.pop / 1500);
  const gold = 1 + Math.floor(c.pop / 2000);
  return { food, eat, surplus: food - eat, prod, goods, science, gold };
}

// ---------------------------------------------------------------- refit

/** Re-equip some cohorts of a formation. Goods come from the city whose territory it stands in. */
export type RefitPreview =
  | { problem: string }
  | {
      problem: null;
      city: City;
      far: boolean;
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
  const far = distance(g, c.hex, f.hex) > CITY_RADIUS;
  const mul = far ? 1.5 : 1;
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
  const missing = Object.entries(cost)
    .filter(([k, n]) => (c.stockpile[k] ?? 0) < n)
    .map(([k, n]) => ({ good: k, need: n, have: c.stockpile[k] ?? 0 }));
  return { city: c, far, cost, refund, missing, problem: null };
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
  for (const [k, n] of Object.entries(p.cost)) p.city.stockpile[k] = (p.city.stockpile[k] ?? 0) - n;
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

export function saveTemplate(s: GameState, civId: number, name: string, loadout: Loadout): Result {
  const civ = s.civs[civId];
  const n = name.trim().slice(0, 24);
  if (!n) return fail('Name the template.');
  const ex = civ.templates.find(t => t.name === n);
  if (ex) ex.loadout = { ...loadout };
  else civ.templates.push({ name: n, loadout: { ...loadout } });
  return ok(`Template "${n}" saved.`);
}

export function deleteTemplate(s: GameState, civId: number, name: string) {
  const civ = s.civs[civId];
  civ.templates = civ.templates.filter(t => t.name !== name);
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
  // AI acts after the player, in the same turn
  for (const civ of s.civs) if (!civ.isPlayer) aiTurn(s, civ);

  for (const civ of s.civs) {
    let science = 0,
      gold = 0;
    for (const c of s.cities.filter(x => x.civId === civ.id)) {
      const y = cityYield(s, c);
      science += y.science;
      gold += y.gold;
      for (const [k, n] of Object.entries(y.goods)) c.stockpile[k] = (c.stockpile[k] ?? 0) + n;
      c.food += y.surplus;
      // food stored turns into people; starvation shrinks the city
      if (c.food >= 10) {
        c.food -= 10;
        c.pop += 250;
      }
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

  s.turn++;
  for (const f of s.formations) {
    f.moves = formationMoves(f);
  }
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

/** Gold per turn: equipment upkeep only, so plain levies cost nothing. */
export function cohortUpkeep(c: Cohort): number {
  return SLOTS.reduce((u, k) => u + ITEMS[c.loadout[k]].upkeep, 0);
}

// ---------------------------------------------------------------- a very simple AI (explore, raise levies)

function aiTurn(s: GameState, civ: Civ) {
  const g = gridOf(s);
  const rng = mulberry32(hashSeed(s.settings.map.seed, s.turn * 131 + civ.id));
  for (const f of s.formations.filter(x => x.civId === civ.id)) {
    if (f.name === 'Scouts') {
      if (!f.path.length) {
        // head for the nearest unexplored hex
        let best = -1,
          bd = Infinity;
        for (const k of within(g, f.hex, 8)) {
          if (civ.explored[k] || !isPassableLand(s.map, k)) continue;
          const d = distance(g, f.hex, k) + rng() * 2;
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
        if (best >= 0) f.path = planPath(s, f, best) ?? [];
      }
      advance(s, f);
    }
  }
  for (const c of s.cities.filter(x => x.civId === civ.id)) {
    const garrison = s.formations.filter(
      f => f.civId === civ.id && f.kind === 'army' && f.name !== 'Scouts',
    ).length;
    if (c.pop >= 3500 && garrison < 3) levy(s, c.id);
  }
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
      const c = s.civs[f.civId].explored[n] ? enterCost(s.map, f, n) : Infinity;
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
  for (const h of path) {
    if (left <= 0) {
      turn++;
      left = full;
    }
    const c = s.civs[f.civId].explored[h] ? enterCost(s.map, f, h) : 1;
    left = Math.max(0, left - c);
    out.push(turn);
  }
  return out;
}
