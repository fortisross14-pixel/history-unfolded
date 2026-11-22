/**
 * Settlement economy: districts and their slots, workers, housing, construction, and markets.
 *
 * A settlement is one hex. It works its land: its own hex and the six around it (a hex next to
 * two settlements belongs to the older one). Towns hold 2 districts, cities 4, a metropolis 6;
 * only towns keep farms, woodlots and mines. Slots that rely on a deposit run at full rate for
 * richness × 2 slots of that type, then at half rate; slots that rely on land run at full rate
 * for two slots per matching hex. Settlements join into a market when a road, river or port
 * links them; a market pays for things from one shared store, and towns feed its cities.
 */
import { DEPOSITS } from '../data/goods.ts';
import {
  gridNeighbors,
  isRural,
  SLOT_TYPES,
  type SlotGroup,
  type SlotType,
  type Yield,
} from '../data/slots.ts';
import { isWater, RELIEF, VEGETATION } from '../data/terrain.ts';
import { distance, neighbors, within, type Grid } from './hex.ts';
import { hexFood } from './mapgen.ts';
import type { City, District, GameState, SlotState, Tier } from './types.ts';
import { civMods, pct } from './mods.ts';

export const WORKER_SHARE = 0.5;

/** Districts each kind of settlement can hold. */
export const DISTRICT_CAP: Record<Tier, number> = { town: 2, city: 4, metropolis: 6 };
export const TIER_NAME: Record<Tier, string> = {
  town: 'Town',
  city: 'City',
  metropolis: 'Metropolis',
};
/** Output bonus for every building, and the extra for research and industry. */
export const TIER_BONUS: Record<Tier, { all: number; focus: number }> = {
  town: { all: 0, focus: 0 },
  city: { all: 15, focus: 35 },
  metropolis: { all: 30, focus: 70 },
};
const FOCUS: SlotGroup[] = ['services', 'craft'];
/** A building gains this much per other building of its group in its district, up to the cap. */
export const SYNERGY_PCT = 5;
export const SYNERGY_CAP = 30;

const gridOf = (s: GameState): Grid => ({ w: s.map.w, h: s.map.h });

export const cityDistricts = (s: GameState, c: City) =>
  s.districts
    .filter(d => d.cityId === c.id)
    .sort((a, b) => (isCentre(a) ? -1 : isCentre(b) ? 1 : a.id - b.id));
/** The centre district holds the town hall. */
export const isCentre = (d: District) => d.slots.some(x => x.type === 'town-hall');
export const cityAtHex = (s: GameState, hex: number) => s.cities.find(c => c.hex === hex);

export const emptySlot = (type: string | null = null): SlotState => ({
  type,
  built: false,
  progress: 0,
  paid: false,
});

/**
 * The land a settlement works: its hex and the six around it, less any hex that is nearer
 * another settlement or equally near an older one.
 */
const landCache = new WeakMap<GameState, { key: string; byCity: Map<number, number[]> }>();
export function landOf(s: GameState, c: City): number[] {
  const key = s.cities.map(x => `${x.id}@${x.hex}`).join(',');
  let cache = landCache.get(s);
  if (!cache || cache.key !== key) {
    cache = { key, byCity: new Map() };
    landCache.set(s, cache);
  }
  let land = cache.byCity.get(c.id);
  if (!land) {
    const g = gridOf(s);
    land = within(g, c.hex, 1).filter(k => {
      if (k === c.hex) return true;
      for (const o of s.cities) {
        if (o === c) continue;
        const d = distance(g, o.hex, k);
        if (d === 0 || (d === 1 && o.id < c.id)) return false;
      }
      return true;
    });
    cache.byCity.set(c.id, land);
  }
  return land;
}

/** The land around a settlement hex (for planning before a city exists, the plain ring). */
function landAt(s: GameState, hex: number): number[] {
  const c = cityAtHex(s, hex);
  return c ? landOf(s, c) : within(gridOf(s), hex, 1);
}

/** Deposits a settlement can work: on its land and visible to the civ. */
function reachDeposits(s: GameState, civId: number, hex: number) {
  const out: { kind: string; richness: number; hex: number }[] = [];
  for (const k of landAt(s, hex)) {
    const d = s.map.deposit[k];
    if (!d) continue;
    const by = DEPOSITS[d.kind].revealedBy;
    if (by && !s.civs[civId].techs.includes(by)) continue;
    out.push({ kind: d.kind, richness: d.richness, hex: k });
  }
  return out;
}

function landMatches(
  s: GameState,
  hex: number,
  need: NonNullable<NonNullable<SlotType['needs']>['land']>,
): number {
  let n = 0;
  for (const k of landAt(s, hex)) {
    const m = s.map;
    if (isWater(m.terrain[k])) continue;
    if (need.terrain && !need.terrain.includes(m.terrain[k])) continue;
    if (need.relief && !need.relief.includes(m.relief[k])) continue;
    if (need.vegetation && !need.vegetation.includes(m.vegetation[k])) continue;
    n++;
  }
  return n;
}

/** Why a slot type cannot go in this district (or null if it can). */
export function slotProblem(
  s: GameState,
  civId: number,
  hex: number,
  centre: boolean,
  typeId: string,
  districtId = Infinity,
): string | null {
  const t = SLOT_TYPES[typeId];
  if (!t) return 'Unknown building.';
  if (t.fixed) return 'Built with the city.';
  if (t.tech && !s.civs[civId].techs.includes(t.tech))
    return `Needs research: ${t.tech.replace('-', ' ')}`;
  const here = cityAtHex(s, hex);
  if (here && here.tier !== 'town' && isRural(typeId))
    return 'Only towns have room for farms, woodlots and mines; the towns around feed the city.';
  const n = t.needs;
  if (!n) return null;
  if (n.centre && !centre) return 'Only in the centre district.';
  if (n.notCentre && centre) return 'Not in the centre district.';
  if (
    n.water &&
    !within(gridOf(s), hex, 1).some(
      k => s.map.terrain[k] === 'coast' || s.map.terrain[k] === 'lake',
    )
  )
    return 'Needs a coast or lake next to the settlement.';
  if (n.deposit && !reachDeposits(s, civId, hex).some(d => n.deposit!.includes(d.kind))) {
    const names = n.deposit.map(k => DEPOSITS[k]?.name ?? k);
    const near = within(gridOf(s), hex, 1).some(
      k => s.map.deposit[k] && n.deposit!.includes(s.map.deposit[k]!.kind),
    );
    return near
      ? `That ${names.join('/')} lies on an older neighbour's land.`
      : `Needs ${names.join(' or ')} on the settlement's land.`;
  }
  if (n.land && !landMatches(s, hex, n.land)) {
    const parts = [
      n.land.relief?.join('/'),
      n.land.vegetation?.join('/'),
      n.land.terrain?.join('/'),
    ].filter(Boolean);
    return `Needs ${parts.join(' ')} land around the settlement.`;
  }
  void districtId;
  return null;
}

/** How many slots of this type the district runs at full rate. */
function capacity(s: GameState, civId: number, hex: number, t: SlotType): number {
  const n = t.needs;
  if (!n) return Infinity;
  if (n.deposit)
    return reachDeposits(s, civId, hex)
      .filter(d => n.deposit!.includes(d.kind))
      .reduce((a, d) => a + d.richness * 2, 0);
  if (n.land) return landMatches(s, hex, n.land) * 2;
  return Infinity;
}

function addYield(
  into: Required<Omit<Yield, 'goods'>> & { goods: Record<string, number> },
  y: Yield,
  k = 1,
) {
  into.food += (y.food ?? 0) * k;
  into.prod += (y.prod ?? 0) * k;
  into.science += (y.science ?? 0) * k;
  into.gold += (y.gold ?? 0) * k;
  into.culture += (y.culture ?? 0) * k;
  into.housing += (y.housing ?? 0) * k;
  for (const [g, n] of Object.entries(y.goods ?? {})) into.goods[g] = (into.goods[g] ?? 0) + n * k;
}
const zero = () => ({
  food: 0,
  prod: 0,
  science: 0,
  gold: 0,
  culture: 0,
  housing: 0,
  goods: {} as Record<string, number>,
});
export type Totals = ReturnType<typeof zero>;

export interface SlotReport {
  problem: string | null;
  staffed: boolean;
  /** 1 full rate, 0.5 beyond what the land or deposit supports, 0 idle */
  rate: number;
  out: Totals;
  idle?: string;
}

export interface CityEconomy {
  total: Totals;
  eat: number;
  surplus: number;
  workers: number;
  workersUsed: number;
  inputs: Record<string, number>;
  slots: Map<number, SlotReport[]>;
  subsistence: Totals;
}

/** Everything a city makes this turn, slot by slot. */
export function cityEconomy(s: GameState, c: City): CityEconomy {
  const g = gridOf(s);
  const total = zero();
  const mods = civMods(s, c.civId);
  const workers = Math.floor((c.pop * (WORKER_SHARE + mods.workers / 100)) / 50) * 50;
  let free = workers;
  const inputs: Record<string, number> = {};
  const stock = marketStock(s, c);
  const slots = new Map<number, SlotReport[]>();
  const districts = cityDistricts(s, c);

  // subsistence: a town's open land feeds a few people (a city has built over its fields)
  const subsistence = zero();
  if (c.tier === 'town')
    for (const k of landOf(s, c)) {
      if (k === c.hex || isWater(s.map.terrain[k]) || s.map.relief[k] === 'mountains') continue;
      subsistence.food += hexFood(s.map, k) * 0.6;
      subsistence.prod +=
        (RELIEF[s.map.relief[k]].prod + VEGETATION[s.map.vegetation[k]].prod) * 0.3;
      const wood = VEGETATION[s.map.vegetation[k]].wood;
      if (wood) subsistence.goods.wood = (subsistence.goods.wood ?? 0) + wood * 0.3;
    }
  addYield(total, subsistence);
  const bonus = TIER_BONUS[c.tier ?? 'town'];
  // the land and deposits are shared by all the settlement's districts
  const used: Record<string, number> = {};
  const deps = reachDeposits(s, c.civId, c.hex);
  void g;

  for (const d of districts) {
    const centre = isCentre(d);
    const reports: SlotReport[] = [];
    // buildings of a kind gather: each gains for every other built one of its group here
    const groupCount: Record<string, number> = {};
    for (const x of d.slots)
      if (x.built && x.type) {
        const gr = SLOT_TYPES[x.type].group;
        groupCount[gr] = (groupCount[gr] ?? 0) + 1;
      }
    for (let i = 0; i < 9; i++) {
      const st = d.slots[i];
      const out = zero();
      if (!st.type) {
        reports.push({ problem: null, staffed: false, rate: 0, out });
        continue;
      }
      const t = SLOT_TYPES[st.type];
      const problem = t.fixed ? null : slotProblem(s, c.civId, c.hex, centre, st.type, d.id);
      if (problem || !st.built) {
        reports.push({
          problem,
          staffed: false,
          rate: 0,
          out,
          idle: problem ? undefined : 'Not built yet',
        });
        continue;
      }
      if (t.labour > free) {
        reports.push({ problem: null, staffed: false, rate: 0, out, idle: 'No workers' });
        continue;
      }
      if (
        t.inputs &&
        Object.entries(t.inputs).some(([gd, n]) => (stock[gd] ?? 0) - (inputs[gd] ?? 0) < n)
      ) {
        reports.push({
          problem: null,
          staffed: false,
          rate: 0,
          out,
          idle: `Needs ${Object.keys(t.inputs).join(', ')}`,
        });
        continue;
      }
      free -= t.labour;
      for (const [gd, n] of Object.entries(t.inputs ?? {})) inputs[gd] = (inputs[gd] ?? 0) + n;
      used[t.id] = (used[t.id] ?? 0) + 1;
      const rate = used[t.id] <= capacity(s, c.civId, c.hex, t) ? 1 : 0.5;
      addYield(out, t.out, rate);
      // deposits feed the first richness × 2 slots of this type
      if (t.boost) {
        const cap = deps
          .filter(x => t.boost!.deposit.includes(x.kind))
          .reduce((a, x) => a + x.richness * 2, 0);
        if (used[t.id] <= cap) addYield(out, t.boost.bonus);
      }
      if (t.depositGoods) {
        const dep = deps.find(x => t.needs?.deposit?.includes(x.kind));
        if (dep)
          for (const gd of Object.keys(DEPOSITS[dep.kind].yields))
            if (gd !== 'meat') out.goods[gd] = (out.goods[gd] ?? 0) + rate;
      }
      // neighbours in the grid
      for (const a of t.adjacency ?? []) {
        const n = gridNeighbors(i).filter(
          j => d.slots[j].built && d.slots[j].type && a.from.includes(d.slots[j].type!),
        ).length;
        if (!n) continue;
        addYield(out, a.bonus, n);
        if (a.pct) for (const gd of Object.keys(out.goods)) out.goods[gd] *= 1 + (a.pct / 100) * n;
      }
      // a themed district, then the settlement's rank, then research and culture
      let up = 0;
      if (!t.fixed && !isRural(t.id) && t.group !== 'residential')
        up += Math.min(SYNERGY_CAP, SYNERGY_PCT * ((groupCount[t.group] ?? 1) - 1));
      if (!t.fixed) up += FOCUS.includes(t.group) ? bonus.focus : bonus.all;
      up += mods.groupPct[t.group] ?? 0;
      if (up) scaleTotals(out, pct(up), true);
      // granaries reward each neighbouring grain field
      if (t.id === 'granary') {
        const fields = gridNeighbors(i).filter(
          j => d.slots[j].built && d.slots[j].type === 'grain-field',
        ).length;
        out.food += fields;
      }
      addYield(total, out);
      reports.push({ problem: null, staffed: true, rate, out });
    }
    slots.set(d.id, reports);
  }
  total.science += Math.floor(c.pop / 2000);
  total.gold += Math.floor(c.pop / 2500);
  total.culture += 1 + Math.floor(c.pop / 4000);
  // people-wide bonuses, coastal cities, upheavals
  const coast = isCoastal(s, c) ? mods.coastalPct : 0;
  total.food *= pct(mods.foodPct + coast * 0.5);
  total.prod *= pct(mods.prodPct + coast * 0.5);
  total.science *= pct(mods.sciencePct);
  total.gold *= pct(mods.goldPct + coast);
  total.culture *= pct(mods.culturePct);
  total.housing *= pct(mods.housingPct);
  for (const k of ['food', 'prod', 'science', 'gold', 'culture'] as const)
    total[k] = Math.round(total[k] * 10) / 10;
  total.housing = Math.round(total.housing / 50) * 50;
  const eat = Math.ceil(c.pop / 1000) * 2;
  return {
    total,
    eat,
    surplus: total.food - eat,
    workers,
    workersUsed: workers - free,
    inputs,
    slots,
    subsistence,
  };
}

// ---------------------------------------------------------------- construction

/** The next slot the city's production goes into. */
export function constructionQueue(s: GameState, c: City): { d: District; i: number }[] {
  const out: { d: District; i: number }[] = [];
  for (const d of cityDistricts(s, c)) {
    const centre = isCentre(d);
    d.slots.forEach((st, i) => {
      if (st.type && !st.built && !slotProblem(s, c.civId, c.hex, centre, st.type, d.id))
        out.push({ d, i });
    });
  }
  return out;
}

/** Spend a turn's production; returns names of slots finished. */
export function build(s: GameState, c: City, prod: number): string[] {
  const done: string[] = [];
  let left = prod;
  for (const { d, i } of constructionQueue(s, c)) {
    if (left <= 0) break;
    const st = d.slots[i];
    const t = SLOT_TYPES[st.type!];
    if (!st.paid) {
      if (!marketSpend(s, c, t.build.goods ?? {})) continue; // skip until the goods are there
      st.paid = true;
    }
    const need = t.build.prod - st.progress;
    const put = Math.min(need, left);
    st.progress += put;
    left -= put;
    if (st.progress >= t.build.prod - 1e-9) {
      st.built = true;
      if (t.id === 'harbour' || t.id === 'shipyard') invalidateMarkets();
      done.push(`${t.name} in ${d.name}`);
    }
  }
  return done;
}

// ---------------------------------------------------------------- markets

/** Hexes that carry trade: roads, rivers and cities. Enemy troops at war cut the link. */
function connectorSet(s: GameState, civId: number): Uint8Array {
  const N = s.map.w * s.map.h;
  const ok = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (s.roads[i] || s.map.river[i]) ok[i] = 1;
  for (const c of s.cities) if (c.civId === civId) ok[c.hex] = 1;
  for (const f of s.formations) {
    if (f.civId === civId || f.kind !== 'army') continue;
    if (s.wars.some(w => (w.a === civId && w.b === f.civId) || (w.b === civId && w.a === f.civId)))
      ok[f.hex] = 0;
  }
  return ok;
}

/** Cities with a harbour or shipyard trade by sea with each other's ports. */
const hasPort = (s: GameState, c: City) =>
  cityDistricts(s, c).some(d =>
    d.slots.some(x => x.built && (x.type === 'harbour' || x.type === 'shipyard')),
  );

/**
 * Cities of the same civ joined by roads or rivers, including `c` itself. Ports also join over
 * water (coast; open ocean once the Compass is known). Enemy armies or fleets cut the links.
 */
const marketCache = new WeakMap<GameState, { key: string; groups: Map<number, City[]> }>();
let marketVersion = 0;
/** Call when roads, cities, ports or wars change: market links are recomputed on next use. */
export function invalidateMarkets() {
  marketVersion++;
}

/** Market links are worked out once per turn, or again after something changes them. */
export function marketCities(s: GameState, c: City): City[] {
  const key = `${s.turn}|${marketVersion}`;
  let cache = marketCache.get(s);
  if (!cache || cache.key !== key) {
    cache = { key, groups: new Map() };
    marketCache.set(s, cache);
  }
  let group = cache.groups.get(c.id);
  if (!group) {
    group = marketCitiesUncached(s, c);
    for (const x of group) cache.groups.set(x.id, group);
  }
  if (group[0] === c) return group;
  return [c, ...group.filter(x => x !== c)];
}

function marketCitiesUncached(s: GameState, c: City): City[] {
  const g = gridOf(s);
  const ok = connectorSet(s, c.civId);
  const N = g.w * g.h;
  const ports = new Set(s.cities.filter(x => x.civId === c.civId && hasPort(s, x)).map(x => x.hex));
  const ocean = s.civs[c.civId].techs.includes('compass');
  const sea = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const t = s.map.terrain[i];
    if (t === 'coast' || t === 'lake' || (ocean && t === 'ocean')) sea[i] = 1;
  }
  for (const f of s.formations)
    if (
      f.civId !== c.civId &&
      s.wars.some(w => (w.a === c.civId && w.b === f.civId) || (w.b === c.civId && w.a === f.civId))
    )
      sea[f.hex] = 0;
  const seen = new Uint8Array(N);
  const stack = [c.hex];
  seen[c.hex] = 1;
  while (stack.length) {
    const h = stack.pop()!;
    const fromSea = sea[h] === 1 && !ok[h];
    for (const n of neighbors(g, h)) {
      if (seen[n]) continue;
      const land = ok[n] && !fromSea;
      const toSea = sea[n] && (fromSea || ports.has(h));
      const intoPort = fromSea && ports.has(n);
      if (land || toSea || intoPort) {
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return s.cities
    .filter(x => x.civId === c.civId && seen[x.hex])
    .sort((a, b) => (a.id === c.id ? -1 : b.id === c.id ? 1 : 0));
}

export function marketStock(s: GameState, c: City): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of marketCities(s, c))
    for (const [k, n] of Object.entries(m.stockpile)) out[k] = (out[k] ?? 0) + n;
  return out;
}

/** Pay goods from the city first, then the rest of its market. False (and nothing taken) if short. */
export function marketSpend(s: GameState, c: City, cost: Record<string, number>): boolean {
  const cities = marketCities(s, c);
  for (const [k, n] of Object.entries(cost)) {
    if (cities.reduce((a, m) => a + (m.stockpile[k] ?? 0), 0) < n - 1e-9) return false;
  }
  for (const [k, n] of Object.entries(cost)) {
    let left = n;
    for (const m of cities) {
      const take = Math.min(left, m.stockpile[k] ?? 0);
      m.stockpile[k] = (m.stockpile[k] ?? 0) - take;
      left -= take;
      if (left <= 1e-9) break;
    }
  }
  return true;
}

export const isCoastal = (s: GameState, c: City) =>
  neighbors(gridOf(s), c.hex).some(
    k => s.map.terrain[k] === 'coast' || s.map.terrain[k] === 'lake',
  );

function scaleTotals(t: Totals, k: number, goodsToo: boolean) {
  t.food *= k;
  t.prod *= k;
  t.science *= k;
  t.gold *= k;
  t.culture *= k;
  if (goodsToo) for (const g of Object.keys(t.goods)) t.goods[g] *= k;
}

/** A district's character, from what is built (or planned) in it. */
export function districtKind(d: District): string {
  const n: Record<string, number> = {};
  for (const x of d.slots)
    if (x.type && !SLOT_TYPES[x.type].fixed) {
      const gr = SLOT_TYPES[x.type].group;
      n[gr] = (n[gr] ?? 0) + 1;
    }
  const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  if (!top) return 'Empty';
  const names: Record<string, string> = {
    farming: 'Farmland',
    forestry: 'Woodland',
    extraction: 'Mining quarter',
    craft: 'Industrial quarter',
    services: 'Research quarter',
    commerce: 'Market quarter',
    residential: 'Residential quarter',
    civic: 'Civic quarter',
  };
  return names[top[0]] ?? 'Quarter';
}

/**
 * Towns feed their market: settlements short of food draw on the surplus of others joined to
 * them by road, river or sea. Returns each settlement's food balance after sharing.
 */
export function shareFood(s: GameState, surplus: Map<number, number>): Map<number, number> {
  const out = new Map(surplus);
  const done = new Set<number>();
  for (const c of s.cities) {
    if (done.has(c.id)) continue;
    const group = marketCities(s, c);
    for (const x of group) done.add(x.id);
    const need = group.reduce((a, x) => a + Math.max(0, -(out.get(x.id) ?? 0)), 0);
    const spare = group.reduce((a, x) => a + Math.max(0, out.get(x.id) ?? 0), 0);
    if (!need || !spare) continue;
    const moved = Math.min(need, spare);
    for (const x of group) {
      const v = out.get(x.id) ?? 0;
      if (v > 0) out.set(x.id, v - (v / spare) * moved);
      else if (v < 0) out.set(x.id, v + (-v / need) * moved);
    }
  }
  return out;
}
