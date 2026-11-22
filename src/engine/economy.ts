/**
 * City economy: districts and their slots, workers, housing, construction, and markets.
 *
 * A slot can use anything within reach of its district (the district hex and its six
 * neighbours). Slots that rely on a deposit run at full rate for richness × 2 slots of that type
 * in the district, then at half rate; slots that rely on land run at full rate for two slots per
 * matching hex in reach. Cities join into a market when a road or river links them; a market's
 * cities pay for things from one shared store.
 */
import { DEPOSITS } from '../data/goods.ts';
import { gridNeighbors, SLOT_TYPES, type SlotType, type Yield } from '../data/slots.ts';
import { isWater, RELIEF, VEGETATION } from '../data/terrain.ts';
import { distance, neighbors, within, type Grid } from './hex.ts';
import { hexFood } from './mapgen.ts';
import type { City, District, GameState, SlotState } from './types.ts';
import { civMods, pct } from './mods.ts';

export const DISTRICT_RADIUS = 2;
export const WORKER_SHARE = 0.5;

const gridOf = (s: GameState): Grid => ({ w: s.map.w, h: s.map.h });

export const cityDistricts = (s: GameState, c: City) =>
  s.districts
    .filter(d => d.cityId === c.id)
    .sort((a, b) => (a.hex === c.hex ? -1 : b.hex === c.hex ? 1 : a.id - b.id));
export const districtAt = (s: GameState, hex: number) => s.districts.find(d => d.hex === hex);
export const isCentre = (s: GameState, d: District) =>
  s.cities.some(c => c.id === d.cityId && c.hex === d.hex);

export const emptySlot = (type: string | null = null): SlotState => ({
  type,
  built: false,
  progress: 0,
  paid: false,
});

/** True when another district already works the deposit on `depHex`. */
function claimedElsewhere(s: GameState, depHex: number, kind: string, districtId: number): boolean {
  const g = gridOf(s);
  const uses = (d: District) =>
    d.slots.some(x => x.type && SLOT_TYPES[x.type]?.needs?.deposit?.includes(kind));
  const onHex = s.districts.find(d => d.hex === depHex);
  // the district standing on the deposit has first call on it
  if (onHex) return onHex.id !== districtId && uses(onHex);
  return s.districts.some(
    d => d.id !== districtId && d.id < districtId && distance(g, d.hex, depHex) <= 1 && uses(d),
  );
}

/**
 * Deposits a district can work: visible to the civ, in reach, and not already worked by an
 * older district. districtId = Infinity when planning a district that does not exist yet.
 */
function reachDeposits(s: GameState, civId: number, hex: number, districtId = Infinity) {
  const out: { kind: string; richness: number; hex: number }[] = [];
  for (const k of within(gridOf(s), hex, 1)) {
    const d = s.map.deposit[k];
    if (!d) continue;
    const by = DEPOSITS[d.kind].revealedBy;
    if (by && !s.civs[civId].techs.includes(by)) continue;
    if (claimedElsewhere(s, k, d.kind, districtId)) continue;
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
  for (const k of within(gridOf(s), hex, 1)) {
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
  const n = t.needs;
  if (!n) return null;
  if (n.centre && !centre) return 'Only in the city centre.';
  if (n.notCentre && centre) return 'Not in the city centre.';
  if (
    n.water &&
    !within(gridOf(s), hex, 1).some(
      k => s.map.terrain[k] === 'coast' || s.map.terrain[k] === 'lake',
    )
  )
    return 'Needs a coast or lake next to the district.';
  if (
    n.deposit &&
    !reachDeposits(s, civId, hex, districtId).some(d => n.deposit!.includes(d.kind))
  ) {
    const names = n.deposit.map(k => DEPOSITS[k]?.name ?? k);
    const any = within(gridOf(s), hex, 1).some(
      k => s.map.deposit[k] && n.deposit!.includes(s.map.deposit[k]!.kind),
    );
    return any
      ? `That ${names.join('/')} is already worked by another district.`
      : `Needs ${names.join(' or ')} in reach.`;
  }
  if (n.land && !landMatches(s, hex, n.land)) {
    const parts = [
      n.land.relief?.join('/'),
      n.land.vegetation?.join('/'),
      n.land.terrain?.join('/'),
    ].filter(Boolean);
    return `Needs ${parts.join(' ')} land in reach.`;
  }
  return null;
}

/** How many slots of this type the district runs at full rate. */
function capacity(
  s: GameState,
  civId: number,
  hex: number,
  t: SlotType,
  districtId: number,
): number {
  const n = t.needs;
  if (!n) return Infinity;
  if (n.deposit)
    return reachDeposits(s, civId, hex, districtId)
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

  // subsistence: unbuilt land next to the city feeds a few people
  const subsistence = zero();
  const taken = new Set(districts.map(d => d.hex));
  for (const k of within(g, c.hex, 1)) {
    if (taken.has(k) || isWater(s.map.terrain[k]) || s.map.relief[k] === 'mountains') continue;
    subsistence.food += hexFood(s.map, k);
    subsistence.prod += (RELIEF[s.map.relief[k]].prod + VEGETATION[s.map.vegetation[k]].prod) * 0.5;
    const wood = VEGETATION[s.map.vegetation[k]].wood;
    if (wood) subsistence.goods.wood = (subsistence.goods.wood ?? 0) + wood * 0.5;
  }
  addYield(total, subsistence);

  for (const d of districts) {
    const centre = d.hex === c.hex;
    const reports: SlotReport[] = [];
    const used: Record<string, number> = {};
    const deps = reachDeposits(s, c.civId, d.hex, d.id);
    for (let i = 0; i < 9; i++) {
      const st = d.slots[i];
      const out = zero();
      if (!st.type) {
        reports.push({ problem: null, staffed: false, rate: 0, out });
        continue;
      }
      const t = SLOT_TYPES[st.type];
      const problem = t.fixed ? null : slotProblem(s, c.civId, d.hex, centre, st.type, d.id);
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
      const rate = used[t.id] <= capacity(s, c.civId, d.hex, t, d.id) ? 1 : 0.5;
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
      // research and culture boost whole groups of buildings
      const gp = mods.groupPct[t.group];
      if (gp) scaleTotals(out, pct(gp), true);
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
    const centre = d.hex === c.hex;
    d.slots.forEach((st, i) => {
      if (st.type && !st.built && !slotProblem(s, c.civId, d.hex, centre, st.type, d.id))
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

export const districtRadius = (s: GameState, civId: number) =>
  DISTRICT_RADIUS + Math.floor(civMods(s, civId).districtRadius);

/** Hexes a city can put districts on: its own territory within DISTRICT_RADIUS, on land. */
export function districtSites(s: GameState, c: City, owner: Int16Array): number[] {
  const g = gridOf(s);
  return within(g, c.hex, districtRadius(s, c.civId)).filter(
    k => !isWater(s.map.terrain[k]) && owner[k] === c.civId && nearestCity(s, k)?.id === c.id,
  );
}

function nearestCity(s: GameState, hex: number): City | undefined {
  const g = gridOf(s);
  let best: City | undefined,
    bd = Infinity;
  for (const c of s.cities) {
    const d = distance(g, c.hex, hex);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}
