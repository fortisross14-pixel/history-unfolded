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
import {
  COMFORT_PCT,
  COMFORT_PEOPLE,
  DEPOSITS,
  GOODS,
  isComfort,
  SPECIAL_MIN,
  STORE_PER_CELL,
} from '../data/goods.ts';
import {
  isHousing,
  isRural,
  LINES,
  MIN_HOUSING,
  ROLE_MUL,
  SLOT_TYPES,
  type SlotGroup,
  type SlotType,
  type Yield,
} from '../data/slots.ts';
import { isWater, RELIEF, VEGETATION } from '../data/terrain.ts';
import { distance, neighbors, within, type Grid } from './hex.ts';
import { hexFood } from './mapgen.ts';
import { colonyBuildProblem } from './colonies.ts';
import type { City, District, GameState, SlotState, Tier } from './types.ts';
import { civMods, pct } from './mods.ts';
import { ITEMS } from '../data/items.ts';
import { TECHS } from '../data/techs.ts';
import { lineBonus, warPenalty } from './dynasty.ts';

export const WORKER_SHARE = 0.5;
/** What a support building puts on each base of its line in the district. */
export const SUPPORT_ADD = 0.5;

/**
 * Sizes, smallest first. A settlement is its centre hex; each step up opens one more district,
 * laid out on one of the six hexes around the centre (a metropolis uses all of them).
 */
export const TIERS: Tier[] = [
  'settlement',
  'town',
  'large-town',
  'city',
  'large-city',
  'metropolis',
];
/** Districts each size of settlement can hold (the centre counts). */
export const DISTRICT_CAP: Record<Tier, number> = {
  settlement: 1,
  town: 2,
  'large-town': 3,
  city: 4,
  'large-city': 5,
  metropolis: 7,
};
export const TIER_NAME: Record<Tier, string> = {
  settlement: 'Settlement',
  town: 'Town',
  'large-town': 'Large town',
  city: 'City',
  'large-city': 'Large city',
  metropolis: 'Metropolis',
};
/** Output bonus for every building, and the extra for research and industry. */
export const TIER_BONUS: Record<Tier, { all: number; focus: number }> = {
  settlement: { all: 0, focus: 0 },
  town: { all: 0, focus: 0 },
  'large-town': { all: 5, focus: 10 },
  city: { all: 15, focus: 35 },
  'large-city': { all: 22, focus: 50 },
  metropolis: { all: 30, focus: 70 },
};
export const rankOf = (t: Tier | undefined) => Math.max(0, TIERS.indexOf(t ?? 'town'));
/** A city or larger: its centre is built over (no fields there), and it burns fuel. */
export const isUrban = (c: { tier?: Tier }) => rankOf(c.tier) >= rankOf('city');
const FOCUS: SlotGroup[] = ['services', 'craft'];

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

/** The settlement whose land holds this hex (its centre or one of the six around it). */
export function ownerOfHex(s: GameState, hex: number): City | undefined {
  const here = cityAtHex(s, hex);
  if (here) return here;
  const g = gridOf(s);
  return s.cities.find(c => distance(g, c.hex, hex) === 1 && landOf(s, c).includes(hex));
}

/**
 * What a district on this hex can reach: its own hex and the hexes next to it on its
 * settlement's land (for the centre, the whole ring). Before a settlement exists, the plain ring.
 */
function landAt(s: GameState, hex: number): number[] {
  const c = ownerOfHex(s, hex);
  if (!c) return within(gridOf(s), hex, 1);
  if (c.hex === hex) return landOf(s, c);
  const land = new Set(landOf(s, c));
  return within(gridOf(s), hex, 1).filter(k => land.has(k));
}

/**
 * Deposits a district can work, visible to the civ: special ones (ores, plantation crops,
 * furs, whales…) only on the district's own hex, plain ones (animals, grain, fish) on the hexes
 * next to it too. Where a district stands decides what it can gather.
 */
function reachDeposits(s: GameState, civId: number, hex: number) {
  const out: { kind: string; richness: number; hex: number }[] = [];
  for (const k of landAt(s, hex)) {
    const d = s.map.deposit[k];
    if (!d) continue;
    if (DEPOSITS[d.kind].special && k !== hex) continue;
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
    return `Needs research: ${TECHS[t.tech]?.name ?? t.tech}`;
  const d = s.districts.find(x => x.id === districtId);
  const here = d ? s.cities.find(x => x.id === d.cityId) : ownerOfHex(s, hex);
  const colonyWhy = here ? colonyBuildProblem(s, here, typeId) : null;
  if (colonyWhy) return colonyWhy;
  if (here && centre && isUrban(here) && isRural(typeId))
    return 'A city has built over its centre: farms, woodlots and mines go in its outer districts.';
  if (t.role === 'multiplier' && d) {
    const other = d.slots.find(
      x => x.type && x.type !== typeId && SLOT_TYPES[x.type]?.role === 'multiplier',
    );
    if (other)
      return `One multiplier per district: this one has a ${SLOT_TYPES[other.type!].name.toLowerCase()}.`;
  }
  if (t.role === 'great') {
    const mine = new Set(s.cities.filter(c => c.civId === civId).map(c => c.id));
    const there = s.districts.find(
      x => x.id !== districtId && mine.has(x.cityId) && x.slots.some(y => y.type === typeId),
    );
    if (there) return `Only one in the realm: there is one in ${there.name}.`;
  }
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
    return 'Needs a coast or lake next to the district: lay it out on a hex by the water.';
  if (n.deposit && !reachDeposits(s, civId, hex).some(d => n.deposit!.includes(d.kind))) {
    const names = n.deposit.map(k => DEPOSITS[k]?.name ?? k);
    const near = within(gridOf(s), hex, 1).some(
      k => s.map.deposit[k] && n.deposit!.includes(s.map.deposit[k]!.kind),
    );
    return near
      ? `The ${names.join('/')} lies on a hex next door: lay out a district on that hex to gather it.`
      : `Needs ${names.join(' or ')} on the district's hex.`;
  }
  if (n.land && !landMatches(s, hex, n.land)) {
    const parts = [
      n.land.relief?.join('/'),
      n.land.vegetation?.join('/'),
      n.land.terrain?.join('/'),
    ].filter(Boolean);
    return `Needs ${parts.join(' ')} land on or next to the district.`;
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
  /** what the land could add here, and what it takes (e.g. coal needs 3 mines in the district) */
  note?: string;
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
  /** cities burn fuel: coal if the market has it, else wood; null good = none to burn */
  fuel: { need: number; good: string | null };
  /** luxuries wanted and received this turn, and the gold and culture change they make */
  comfort: { want: number; got: Record<string, number>; pct: number };
}

/**
 * The deposits a building type works on this land, for a district holding `count` of them.
 * Special goods (minerals, crops, furs, whales…) open only at SPECIAL_MIN; animals, grain and
 * fish work for any number.
 */
export function workable(
  s: GameState,
  civId: number,
  hex: number,
  typeId: string,
  count: number,
): { open: string[]; waiting: string[] } {
  const civ = s.civs[civId];
  const kinds: string[] = [];
  for (const d of reachDeposits(s, civId, hex)) {
    const info = DEPOSITS[d.kind];
    if (info.by !== typeId || kinds.includes(d.kind)) continue;
    if (info.tech && !civ.techs.includes(info.tech)) continue;
    kinds.push(d.kind);
  }
  const special = kinds.filter(k => DEPOSITS[k].special);
  const plain = kinds.filter(k => !DEPOSITS[k].special);
  return count >= SPECIAL_MIN
    ? { open: [...special, ...plain], waiting: [] }
    : { open: plain, waiting: special };
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
  if (!isUrban(c)) {
    const builtOn = new Set(districts.map(d => d.hex));
    for (const k of landOf(s, c)) {
      if (builtOn.has(k) || isWater(s.map.terrain[k]) || s.map.relief[k] === 'mountains') continue;
      subsistence.food += hexFood(s.map, k) * 0.6;
      subsistence.prod +=
        (RELIEF[s.map.relief[k]].prod + VEGETATION[s.map.vegetation[k]].prod) * 0.3;
      const wood = VEGETATION[s.map.vegetation[k]].wood;
      if (wood) subsistence.goods.wood = (subsistence.goods.wood ?? 0) + wood * 0.3;
    }
  }
  addYield(total, subsistence);
  const bonus = TIER_BONUS[c.tier ?? 'town'];
  // the governing house (and the throne) favour their lines
  const houses = lineBonus(s, c);
  // the land and deposits are shared by all the settlement's districts
  const used: Record<string, number> = {};
  const forest = landOf(s, c).some(
    k => s.map.vegetation[k] === 'forest' || s.map.vegetation[k] === 'jungle',
  );
  void g;

  for (const d of districts) {
    const centre = isCentre(d);
    const reports: SlotReport[] = [];
    // how many of each building the district holds, and which one of them this is
    const typeCount: Record<string, number> = {};
    const nth: Record<string, number> = {};
    let housing = 0;
    for (const x of d.slots)
      if (x.built && x.type) {
        typeCount[x.type] = (typeCount[x.type] ?? 0) + 1;
        if (isHousing(x.type)) housing++;
      }
    const lived = housing >= MIN_HOUSING;
    // 1. producers: staffing, inputs, base yield, what the land adds
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
      // nobody lives here: only the houses themselves (and the town hall) work
      if (!lived && !t.fixed && !isHousing(t.id)) {
        reports.push({
          problem: null,
          staffed: false,
          rate: 0,
          out,
          idle: `Needs ${MIN_HOUSING} housing cells in this district (${housing} built)`,
        });
        continue;
      }
      if (t.labour > free) {
        reports.push({ problem: null, staffed: false, rate: 0, out, idle: 'No workers' });
        continue;
      }
      // a better fuel first (oil in a power plant), else what it usually burns
      const has = (want: Record<string, number>) =>
        Object.entries(want).every(([gd, n]) => (stock[gd] ?? 0) - (inputs[gd] ?? 0) >= n);
      const useAlt = !!t.alt && has(t.alt.inputs);
      const need = useAlt ? t.alt!.inputs : (t.inputs ?? {});
      // short of what it burns: it limps along at a third, using nothing
      const short = Object.entries(need).filter(
        ([gd, n]) => (stock[gd] ?? 0) - (inputs[gd] ?? 0) < n,
      );
      free -= t.labour;
      if (!short.length)
        for (const [gd, n] of Object.entries(need)) inputs[gd] = (inputs[gd] ?? 0) + n;
      used[t.id] = (used[t.id] ?? 0) + 1;
      let rate = used[t.id] <= capacity(s, c.civId, d.hex, t) ? 1 : 0.5;
      if (short.length) rate /= 3;
      addYield(out, useAlt ? t.alt!.out : t.out, rate);
      // what lies on the land: one deposit per building, in turn
      let note: string | undefined;
      const w = workable(s, c.civId, d.hex, t.id, typeCount[t.id] ?? 0);
      if (w.open.length) {
        const k = nth[t.id] ?? 0;
        nth[t.id] = k + 1;
        const dep = DEPOSITS[w.open[k % w.open.length]];
        addYield(out, { food: dep.gives.food, gold: dep.gives.gold, goods: dep.gives.goods }, rate);
        note = `Works the ${dep.name.toLowerCase()}`;
      }
      if (w.waiting.length)
        note = `${w.waiting.map(k => DEPOSITS[k].name).join(', ')} need ${SPECIAL_MIN} ${t.name.toLowerCase()}s in this district (${typeCount[t.id] ?? 0} now)`;
      if (t.id === 'woodlot' && forest) out.goods.wood = (out.goods.wood ?? 0) + 0.5 * rate;
      if (short.length)
        note = `Short of ${short.map(([gd]) => gd).join(', ')}: a third of its output`;
      reports.push({ problem: null, staffed: true, rate, out, note });
    }
    // 2. supports add ½ to every yield of each base of their line (and the market to each house);
    // 3. the district's multiplier doubles its line, a great building triples it
    const staffedOf = (pred: (t: SlotType) => boolean) =>
      d.slots
        .map((x, k) => ({ t: x.type ? SLOT_TYPES[x.type] : undefined, r: reports[k] }))
        .filter(b => b.t && b.r.staffed && pred(b.t));
    for (let i = 0; i < 9; i++) {
      const r = reports[i];
      const t = d.slots[i].type ? SLOT_TYPES[d.slots[i].type!] : undefined;
      if (!r.staffed || !t) continue;
      let add = 0;
      if (t.role === 'base' && t.line)
        add += staffedOf(b => b.role === 'support' && b.line === t.line).reduce(
          (a, b) => a + SUPPORT_ADD * b.r.rate,
          0,
        );
      add += staffedOf(b => !!b.boost?.of.includes(t.id)).reduce(
        (a, b) => a + b.t!.boost!.add * b.r.rate,
        0,
      );
      if (add) {
        for (const k of ['food', 'prod', 'science', 'gold', 'culture'] as const)
          if (r.out[k] > 0) r.out[k] += add;
        for (const gd of Object.keys(r.out.goods)) if (r.out.goods[gd] > 0) r.out.goods[gd] += add;
        // a house with a market: its shops bring gold
        if (t.group === 'residential') r.out.gold += add;
      }
      if (t.line && (t.role === 'base' || t.role === 'support'))
        for (const role of ['multiplier', 'great'] as const) {
          const m = staffedOf(b => b.role === role && b.line === t.line)[0];
          if (m) scaleTotals(r.out, 1 + (ROLE_MUL[role] - 1) * m.r.rate, true);
        }
    }
    for (const b of staffedOf(
      t => t.role === 'support' || t.role === 'multiplier' || t.role === 'great' || !!t.boost,
    )) {
      const t = b.t!;
      const n = d.slots.filter(
        (x, k) =>
          x.type &&
          reports[k].staffed &&
          (t.boost
            ? t.boost.of.includes(x.type)
            : SLOT_TYPES[x.type].line === t.line && SLOT_TYPES[x.type].role === 'base'),
      ).length;
      const what =
        t.role === 'multiplier'
          ? '×2'
          : t.role === 'great'
            ? '+200%'
            : `+${t.boost?.add ?? SUPPORT_ADD}`;
      b.r.note = n
        ? `${what} to ${n} here`
        : `Boosts nothing here yet: needs ${t.boost ? 'housing' : `${LINES[t.line!].name.toLowerCase()} buildings`}`;
    }
    // 4. the settlement's rank and the people's research and culture, then into the totals
    for (let i = 0; i < 9; i++) {
      const r = reports[i];
      const type = d.slots[i].type;
      if (!r.staffed || !type) continue;
      const t = SLOT_TYPES[type];
      let up = 0;
      if (!t.fixed) up += FOCUS.includes(t.group) ? bonus.focus : bonus.all;
      if (t.line) up += houses[t.line] ?? 0;
      up += mods.groupPct[t.group] ?? 0;
      if (up) scaleTotals(r.out, pct(up), true);
      addYield(total, r.out);
    }
    slots.set(d.id, reports);
  }
  // cities burn fuel as they grow: coal when the market has it (a little extra industry), else
  // wood; with neither, everything slows
  const fuel: CityEconomy['fuel'] = { need: 0, good: null };
  if (isUrban(c)) {
    fuel.need = Math.ceil(c.pop / 4000);
    const left = (gd: string) => (stock[gd] ?? 0) - (inputs[gd] ?? 0);
    fuel.good = left('coal') >= fuel.need ? 'coal' : left('wood') >= fuel.need ? 'wood' : null;
    if (fuel.good) inputs[fuel.good] = (inputs[fuel.good] ?? 0) + fuel.need;
    if (fuel.good === 'coal') total.prod *= 1.05;
    if (!fuel.good) scaleTotals(total, 0.85, false);
  }
  // comforts: a luxury a turn for every few thousand people, varied if possible
  const comfort: CityEconomy['comfort'] = {
    want: Math.floor(c.pop / COMFORT_PEOPLE),
    got: {},
    pct: 0,
  };
  if (comfort.want) {
    const left = (gd: string) => (stock[gd] ?? 0) - (inputs[gd] ?? 0);
    const kinds = Object.keys(GOODS)
      .filter(gd => isComfort(gd) && left(gd) >= 1)
      .sort((a, b) => left(b) - left(a));
    let n = 0;
    for (let round = 0; n < comfort.want && kinds.some(gd => left(gd) >= 1); round++)
      for (const gd of kinds) {
        if (n >= comfort.want || left(gd) < 1) continue;
        inputs[gd] = (inputs[gd] ?? 0) + 1;
        comfort.got[gd] = (comfort.got[gd] ?? 0) + 1;
        n++;
      }
    comfort.pct = COMFORT_PCT * Object.keys(comfort.got).length - COMFORT_PCT * (comfort.want - n);
    total.gold *= pct(comfort.pct);
    total.culture *= pct(comfort.pct);
  }
  // a house at war with the throne
  const war = warPenalty(s, c);
  if (war < 1) scaleTotals(total, war, true);
  total.science += Math.floor(c.pop / 2000);
  total.gold += Math.floor(c.pop / 2500);
  total.culture += 1 + Math.floor(c.pop / 4000);
  // people-wide bonuses, coastal cities, upheavals
  const coast = isCoastal(s, c) ? mods.coastalPct : 0;
  total.food *= pct(mods.foodPct + coast * 0.5);
  // a settlement on a railway linked by rail to another of its realm's settlements
  const rail = railLinked(s, c) ? RAIL_PROD_PCT : 0;
  total.prod *= pct(mods.prodPct + coast * 0.5 + rail);
  total.science *= pct(mods.sciencePct);
  total.gold *= pct(mods.goldPct + coast);
  total.culture *= pct(mods.culturePct);
  total.housing *= pct(mods.housingPct);
  for (const k of ['food', 'prod', 'science', 'gold', 'culture'] as const)
    total[k] = Math.round(total[k] * 10) / 10;
  total.housing = Math.round(total.housing / 50) * 50;
  // a thousand people eat a unit of food a turn (two farms' worth)
  const eat = Math.ceil(c.pop / 1000);
  return {
    total,
    eat,
    surplus: total.food - eat,
    workers,
    workersUsed: workers - free,
    inputs,
    slots,
    subsistence,
    fuel,
    comfort,
  };
}

// ---------------------------------------------------------------- construction

/** The next slot the city's production goes into. */
export function constructionQueue(s: GameState, c: City): { d: District; i: number }[] {
  const out: { d: District; i: number }[] = [];
  for (const d of cityDistricts(s, c)) {
    const centre = isCentre(d);
    // a district without its housing cannot work: its houses go first
    const housed = d.slots.filter(x => x.built && isHousing(x.type)).length >= MIN_HOUSING;
    const todo: { d: District; i: number }[] = [];
    d.slots.forEach((st, i) => {
      if (st.type && !st.built && !slotProblem(s, c.civId, d.hex, centre, st.type, d.id))
        todo.push({ d, i });
    });
    if (!housed)
      todo.sort((a, b) => +isHousing(b.d.slots[b.i].type) - +isHousing(a.d.slots[a.i].type));
    out.push(...todo);
  }
  return out;
}

/** Spend a turn's production; returns the slots finished. */
export function build(s: GameState, c: City, prod: number): { text: string; type: string }[] {
  const done: { text: string; type: string }[] = [];
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
      done.push({ text: `${t.name} in ${d.name}`, type: t.id });
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
/** Production bonus (%) for a settlement joined by rail to another of the realm's settlements. */
export const RAIL_PROD_PCT = 15;
const railCache = new WeakMap<GameState, { key: string; comp: Int32Array }>();

/** Rail networks: each rail hex gets a component id; recomputed when the rails change. */
function railComponents(s: GameState): Int32Array {
  const key = `${s.turn}|${marketVersion}`;
  const hit = railCache.get(s);
  if (hit && hit.key === key) return hit.comp;
  const g = gridOf(s);
  const comp = new Int32Array(s.roads.length).fill(-1);
  let id = 0;
  for (let i = 0; i < s.roads.length; i++) {
    if (s.roads[i] !== 2 || comp[i] >= 0) continue;
    const stack = [i];
    comp[i] = id;
    while (stack.length) {
      const h = stack.pop()!;
      for (const n of neighbors(g, h))
        if (s.roads[n] === 2 && comp[n] < 0) {
          comp[n] = id;
          stack.push(n);
        }
    }
    id++;
  }
  railCache.set(s, { key, comp });
  return comp;
}

/** Is this settlement on a railway that reaches another settlement of its realm? */
export function railLinked(s: GameState, c: City): boolean {
  const comp = railComponents(s);
  const k = comp[c.hex];
  if (k < 0) return false;
  return s.cities.some(o => o.id !== c.id && o.civId === c.civId && comp[o.hex] === k);
}

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
  // a colony on the coast ships from its own shore to the realm's harbours
  const ports = new Set(
    s.cities
      .filter(x => x.civId === c.civId && (hasPort(s, x) || (x.colony && isCoastal(s, x))))
      .map(x => x.hex),
  );
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

/** Housing cells built in a settlement, and those beyond each district's two. */
export function housingCells(s: GameState, c: City): { built: number; spare: number } {
  const ds = s.districts.filter(d => d.cityId === c.id);
  const built = ds.reduce(
    (a, d) => a + d.slots.filter(x => x.built && isHousing(x.type)).length,
    0,
  );
  return { built, spare: Math.max(0, built - MIN_HOUSING * ds.length) };
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

/** Take as much as there is of each good, from the city first, then its market. */
export function marketTake(s: GameState, c: City, want: Record<string, number>) {
  const cities = marketCities(s, c);
  for (const [k, n] of Object.entries(want)) {
    let left = n;
    for (const m of cities) {
      const take = Math.min(left, m.stockpile[k] ?? 0);
      m.stockpile[k] = (m.stockpile[k] ?? 0) - take;
      left -= take;
      if (left <= 1e-9) break;
    }
  }
}

export interface GoodLine {
  /** per turn */
  made: number;
  used: number;
  /** per turn, + bought, − sold */
  traded: number;
  net: number;
  stock: number;
  /** most the stores can hold */
  cap: number;
}

/** A people's goods, per turn: what its settlements make and burn, its trade deals, its stores. */
export function civGoods(s: GameState, civId: number): Record<string, GoodLine> {
  const out: Record<string, GoodLine> = {};
  const line = (g: string) =>
    (out[g] ??= { made: 0, used: 0, traded: 0, net: 0, stock: 0, cap: 0 });
  for (const c of s.cities) {
    if (c.civId !== civId) continue;
    const e = cityEconomy(s, c);
    for (const [g, n] of Object.entries(e.total.goods)) line(g).made += n;
    for (const [g, n] of Object.entries(e.inputs)) line(g).used += n;
    for (const [g, n] of Object.entries(c.stockpile)) if (n > 0) line(g).stock += n;
  }
  const powder = powderNeed(s, civId);
  if (powder) line('saltpeter').used += powder;
  for (const t of s.treaties) {
    if (t.kind !== 'trade' || (t.a !== civId && t.b !== civId)) continue;
    const give = t.a === civId ? t.aGives : t.bGives;
    const get = t.a === civId ? t.bGives : t.aGives;
    for (const [g, n] of Object.entries(give?.goodsPerTurn ?? {})) line(g).traded -= n;
    for (const [g, n] of Object.entries(get?.goodsPerTurn ?? {})) line(g).traded += n;
  }
  const { cap } = storeCaps(s, civId);
  for (const [g, l] of Object.entries(out)) {
    l.cap = cap(g);
    l.made = Math.round(l.made * 10) / 10;
    l.used = Math.round(l.used * 10) / 10;
    l.net = Math.round((l.made - l.used + l.traded) * 10) / 10;
    l.stock = Math.floor(l.stock);
  }
  return out;
}

/**
 * How much of each good a people can keep: STORE_PER_CELL for every working cell that makes it,
 * and as much again per settlement for anything (bought goods need somewhere to go).
 */
export function storeCaps(s: GameState, civId: number, econ?: Map<number, CityEconomy>) {
  const cells: Record<string, number> = {};
  let settlements = 0;
  for (const c of s.cities) {
    if (c.civId !== civId) continue;
    settlements++;
    const e = econ?.get(c.id) ?? cityEconomy(s, c);
    for (const reps of e.slots.values())
      for (const r of reps)
        if (r.staffed)
          for (const [g, n] of Object.entries(r.out.goods))
            if (n > 0) cells[g] = (cells[g] ?? 0) + 1;
  }
  return {
    cap: (g: string) => STORE_PER_CELL * ((cells[g] ?? 0) + settlements),
    cells,
  };
}

/** Goods past the store limit are lost: each settlement gives up its share. */
export function capStores(s: GameState, civId: number, econ?: Map<number, CityEconomy>) {
  const { cap } = storeCaps(s, civId, econ);
  const mine = s.cities.filter(c => c.civId === civId);
  const total: Record<string, number> = {};
  for (const c of mine)
    for (const [g, n] of Object.entries(c.stockpile)) total[g] = (total[g] ?? 0) + n;
  for (const [g, n] of Object.entries(total)) {
    const lim = cap(g);
    if (n <= lim) continue;
    const k = lim / n;
    for (const c of mine) if (c.stockpile[g]) c.stockpile[g] *= k;
  }
}

/** Saltpeter a realm's firearms burn as powder each turn. */
export function powderNeed(s: GameState, civId: number): number {
  let n = 0;
  for (const f of s.formations) {
    if (f.civId !== civId) continue;
    for (const c of f.cohorts)
      for (const k of Object.keys(c.loadout) as (keyof typeof c.loadout)[])
        n += (ITEMS[c.loadout[k]]?.powder ?? 0) * (c.strength / 100);
  }
  return Math.round(n * 10) / 10;
}

/**
 * What a building would make on one plot, as it would run there now: its own output (land,
 * deposits, boosters and workers all counted), or why it would stand idle.
 */
export function slotPreview(
  s: GameState,
  c: City,
  d: District,
  i: number,
  typeId: string,
): { yields: Record<string, number>; goods: Record<string, number>; why?: string } {
  const keep = d.slots[i];
  let rep: SlotReport | undefined;
  try {
    d.slots[i] = { type: typeId, built: true, progress: 0, paid: true };
    invalidateMarkets();
    rep = cityEconomy(s, c).slots.get(d.id)?.[i];
  } finally {
    d.slots[i] = keep;
    invalidateMarkets();
  }
  const r = (n: number) => Math.round(n * 10) / 10;
  const yields: Record<string, number> = {};
  const goods: Record<string, number> = {};
  if (rep?.staffed)
    for (const k of ['food', 'prod', 'science', 'gold', 'culture', 'housing'] as const) {
      const v = r(rep.out[k]);
      if (v) yields[k] = v;
    }
  if (rep?.staffed) for (const [k, n] of Object.entries(rep.out.goods)) if (r(n)) goods[k] = r(n);
  return { yields, goods, why: rep?.problem ?? rep?.idle ?? undefined };
}
