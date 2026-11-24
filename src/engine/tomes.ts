/**
 * Mandates: what a Tome's missions ask of a people, measured on the real game state each turn.
 * A mandate counts something the people has now (buildings, armies, yields…) or something done
 * since the mission was bought (techs learned, battles won…). See data/tomes.ts for the Tomes.
 */
import type { Area } from '../data/dynasties.ts';
import { SLOT_TYPES, type SlotGroup } from '../data/slots.ts';
import { governorOf, levelOf, powerOf, rulerOf, totalLevels } from './dynasty.ts';
import { cityDistricts } from './economy.ts';
import { atWar, formationStrength } from './game.ts';
import { heldWonders } from './mods.ts';
import { isRanged } from './units.ts';
import type { Civ, GameState } from './types.ts';

/** What a people has, counted once for all its missions. */
export interface Survey {
  built: Record<string, number>;
  /** buildings built in all */
  buildings: number;
  /** the most districts in one settlement */
  maxDistricts: number;
  /** the most buildings of each group in one settlement */
  maxGroup: Partial<Record<SlotGroup, number>>;
  settlements: number;
  urban: number;
  /** people, in thousands */
  pop: number;
  strongest: number;
  ranged: number;
  cohorts: number;
  fleets: number;
  goods: number;
  /** settlements with walls of any kind */
  walled: number;
  faithful: number;
  roads: number;
  explored: number;
}

const WALLS = new Set(['palisade', 'walls', 'castle']);

export function survey(s: GameState, civ: Civ): Survey {
  const x: Survey = {
    built: {},
    buildings: 0,
    maxDistricts: 0,
    maxGroup: {},
    settlements: 0,
    urban: 0,
    pop: 0,
    strongest: 0,
    ranged: 0,
    cohorts: 0,
    fleets: 0,
    goods: 0,
    walled: 0,
    faithful: 0,
    roads: 0,
    explored: 0,
  };
  const goods = new Set<string>();
  const g = { w: s.map.w };
  const near = new Set<number>();
  for (const c of s.cities) {
    if (c.civId !== civ.id) continue;
    x.settlements++;
    x.pop += c.pop / 1000;
    if (c.tier === 'city' || c.tier === 'large-city' || c.tier === 'metropolis') x.urban++;
    if (civ.faith !== undefined && c.faith === civ.faith) x.faithful++;
    for (const [k, n] of Object.entries(c.stockpile)) if (n >= 1) goods.add(k);
    const ds = cityDistricts(s, c);
    x.maxDistricts = Math.max(x.maxDistricts, ds.length);
    const groups: Partial<Record<SlotGroup, number>> = {};
    let walled = false;
    for (const d of ds)
      for (const sl of d.slots) {
        if (!sl.built || !sl.type || sl.type === 'town-hall') continue;
        const t = SLOT_TYPES[sl.type];
        if (!t) continue;
        x.built[sl.type] = (x.built[sl.type] ?? 0) + 1;
        if (t.group !== 'residential') x.buildings++;
        groups[t.group] = (groups[t.group] ?? 0) + 1;
        if (WALLS.has(sl.type)) walled = true;
      }
    if (walled) x.walled++;
    for (const [k, n] of Object.entries(groups) as [SlotGroup, number][])
      x.maxGroup[k] = Math.max(x.maxGroup[k] ?? 0, n);
    // roads on the settlement's own land: its hex and the ring around it
    const col = c.hex % g.w,
      row = Math.floor(c.hex / g.w);
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const r = row + dy,
          q = col + dx;
        if (r < 0 || q < 0 || r >= s.map.h || q >= s.map.w) continue;
        near.add(r * g.w + q);
      }
  }
  for (const h of near) if (s.roads[h]) x.roads++;
  x.goods = goods.size;
  for (const f of s.formations) {
    if (f.civId !== civ.id) continue;
    if (f.kind === 'fleet') x.fleets++;
    if (f.kind !== 'army') continue;
    x.cohorts += f.cohorts.length;
    x.ranged += f.cohorts.filter(c => isRanged(c.loadout)).length;
    x.strongest = Math.max(x.strongest, formationStrength(s, f));
  }
  let seen = 0;
  for (const e of civ.explored) if (e) seen++;
  x.explored = Math.round((seen / Math.max(1, civ.explored.length)) * 100);
  return x;
}

export interface Mandate {
  id: string;
  /** what to do, for a need of n */
  label: (n: number) => string;
  /** interface icon */
  icon: string;
  /** need by age, 1..5 */
  need: [number, number, number, number, number];
  /** first and last age it is offered in */
  from?: number;
  until?: number;
  /** counted from when the mission was bought: the measure then is its baseline */
  since?: boolean;
  /** counted in turns this holds while the mission is active */
  streak?: (s: GameState, civ: Civ) => boolean;
  measure?: (s: GameState, civ: Civ, x: Survey) => number;
  /** the buffs (Mods keys) this mandate suits, to pair it with a fitting culture choice */
  keys: string[];
  /** about the noble houses (dynasty.ts): Tomes keep one or two of these in every age */
  house?: boolean;
}

/** The best level in `area` among the houses governing a settlement that has one of `ids` built. */
function governorLevel(s: GameState, civ: Civ, area: Area, ids: string[]): number {
  let best = 0;
  for (const c of s.cities) {
    if (c.civId !== civ.id) continue;
    const g = governorOf(s, c);
    if (!g) continue;
    const has = cityDistricts(s, c).some(d =>
      d.slots.some(x => x.built && x.type && ids.includes(x.type)),
    );
    if (has) best = Math.max(best, levelOf(g, area));
  }
  return best;
}
const houses = (civ: Civ) => civ.dynasties ?? [];
const AREA_SETS: Area[] = [
  'food',
  'wood',
  'mining',
  'research',
  'culture',
  'gold',
  'industry',
  'military',
];
const topLevel = (civ: Civ) =>
  Math.max(0, ...houses(civ).flatMap(d => AREA_SETS.map(a => levelOf(d, a))));

const topArea = (civ: Civ, a: Area) => Math.max(0, ...houses(civ).map(d => levelOf(d, a)));
const deed = (civ: Civ, k: string) => civ.culture.deeds?.[k] ?? 0;
const builtOf = (x: Survey, ids: string[]) => ids.reduce((a, id) => a + (x.built[id] ?? 0), 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const list: Mandate[] = [
  // ---- war
  {
    id: 'win-battles',
    label: n => `Win ${plural(n, 'battle')}`,
    icon: 'war',
    need: [2, 3, 3, 4, 4],
    since: true,
    measure: (_s, c) => deed(c, 'wins'),
    keys: ['attackPct', 'meleePct', 'chargePct', 'morale'],
  },
  {
    id: 'beasts',
    label: n => `Defeat ${plural(n, 'pack')} of beasts or raiders`,
    icon: 'raiders',
    need: [2, 2, 3, 3, 3],
    until: 3,
    since: true,
    measure: (_s, c) => deed(c, 'beasts'),
    keys: ['sight', 'roughPct', 'rangedPct', 'meleePct'],
  },
  {
    id: 'lairs',
    label: n => `Clear ${plural(n, 'lair')} or raider camp${n === 1 ? '' : 's'}`,
    icon: 'ruins',
    need: [1, 2, 2, 2, 2],
    until: 3,
    since: true,
    measure: (_s, c) => deed(c, 'lairs'),
    keys: ['roughPct', 'sight', 'chargePct'],
  },
  {
    id: 'declare-war',
    label: () => 'Declare a war',
    icon: 'war',
    need: [1, 1, 1, 1, 1],
    from: 2,
    since: true,
    measure: (_s, c) => deed(c, 'wars'),
    keys: ['attackPct', 'siegePct', 'commandCap'],
  },
  {
    id: 'strong-army',
    label: n => `An army of strength ${n}`,
    icon: 'power',
    need: [10, 18, 35, 55, 75],
    measure: (_s, _c, x) => Math.floor(x.strongest),
    keys: ['commandCap', 'levyCohorts', 'morale', 'upkeepPct'],
  },
  {
    id: 'ranged',
    label: n => `${plural(n, 'ranged cohort')}`,
    icon: 'ranged',
    need: [2, 4, 8, 12, 16],
    measure: (_s, _c, x) => x.ranged,
    keys: ['rangedPct', 'sight'],
  },
  {
    id: 'cohorts',
    label: n => `${n} cohorts under arms`,
    icon: 'army',
    need: [6, 12, 30, 60, 100],
    measure: (_s, _c, x) => x.cohorts,
    keys: ['levyCohorts', 'upkeepPct', 'commandCap', 'homePct'],
  },
  {
    id: 'kills',
    label: n => `Slay ${n.toLocaleString()} enemy soldiers`,
    icon: 'melee',
    need: [200, 400, 600, 800, 1000],
    since: true,
    measure: (_s, c) => c.kills,
    keys: ['meleePct', 'chargePct', 'attackPct'],
  },
  {
    id: 'capture',
    label: () => 'Take a settlement in war',
    icon: 'siege',
    need: [1, 1, 1, 1, 1],
    from: 2,
    since: true,
    measure: (_s, c) => c.captured ?? 0,
    keys: ['siegePct', 'attackPct'],
  },
  {
    id: 'walls',
    label: n => `Walls around ${plural(n, 'settlement')}`,
    icon: 'protection',
    need: [1, 1, 2, 3, 4],
    measure: (_s, _c, x) => x.walled,
    keys: ['defensePct', 'homePct', 'cityDefensePct', 'guard'],
  },
  {
    id: 'barracks',
    label: n => `${plural(n, 'barracks', 'barracks')} or armour${n === 1 ? 'y' : 'ies'}`,
    icon: 'equip',
    need: [1, 1, 1, 2, 2],
    measure: (_s, _c, x) => builtOf(x, ['barracks', 'armoury', 'war-college']),
    keys: ['morale', 'commandCap', 'refitPct'],
  },
  // ---- knowledge
  {
    id: 'techs',
    label: n => `Learn ${plural(n, 'tech')}`,
    icon: 'research',
    need: [3, 3, 3, 3, 3],
    since: true,
    measure: (_s, c) => c.techs.length,
    keys: ['sciencePct', 'researchPct'],
  },
  {
    id: 'science',
    label: n => `${n} science a turn`,
    icon: 'science',
    need: [4, 8, 20, 40, 80],
    measure: (_s, c) => Math.floor(c.stats?.science ?? 0),
    keys: ['sciencePct'],
  },
  {
    id: 'schools',
    label: n => `${plural(n, 'school')} or librar${n === 1 ? 'y' : 'ies'}`,
    icon: 'science',
    need: [1, 2, 3, 5, 8],
    measure: (_s, _c, x) =>
      builtOf(x, ['school', 'library', 'university', 'academy', 'observatory', 'laboratory']),
    keys: ['sciencePct', 'heal'],
  },
  {
    id: 'explore',
    label: n => `Explore ${n}% of the world`,
    icon: 'sight',
    need: [10, 15, 20, 25, 30],
    measure: (_s, _c, x) => x.explored,
    keys: ['sight', 'navalPct', 'coastalPct'],
  },
  {
    id: 'met',
    label: n => `Meet ${plural(n, 'people')}`,
    icon: 'peoples',
    need: [2, 3, 4, 4, 5],
    measure: (_s, c) => c.met.length,
    keys: ['sight', 'goldPct', 'culturePct'],
  },
  {
    id: 'buildings',
    label: n => `Finish ${plural(n, 'building')}`,
    icon: 'production',
    need: [4, 6, 10, 15, 20],
    since: true,
    measure: (_s, _c, x) => x.buildings,
    keys: ['prodPct', 'roadCost', 'groupPct'],
  },
  // ---- economy
  {
    id: 'gold',
    label: n => `${n} gold a turn`,
    icon: 'gold',
    need: [4, 10, 25, 50, 90],
    measure: (_s, c) => Math.floor(c.stats?.income ?? 0),
    keys: ['goldPct', 'groupPct'],
  },
  {
    id: 'treasury',
    label: n => `${n} gold in the treasury`,
    icon: 'gold',
    need: [100, 300, 800, 1500, 3000],
    measure: (_s, c) => Math.floor(c.gold),
    keys: ['goldPct', 'refitPct'],
  },
  {
    id: 'goods',
    label: n => `${n} different goods in store`,
    icon: 'goods',
    need: [3, 5, 6, 8, 10],
    measure: (_s, _c, x) => x.goods,
    keys: ['groupPct', 'goldPct', 'prodPct'],
  },
  {
    id: 'markets',
    label: n => `${plural(n, 'market')} or bank${n === 1 ? '' : 's'}`,
    icon: 'trade',
    need: [1, 2, 3, 5, 8],
    measure: (_s, _c, x) =>
      builtOf(x, ['market', 'bank', 'mint', 'guild-hall', 'counting-house', 'stock-exchange']),
    keys: ['goldPct', 'groupPct'],
  },
  {
    id: 'mines',
    label: n => `${plural(n, 'mine')}`,
    icon: 'production',
    need: [1, 2, 4, 6, 8],
    measure: (_s, _c, x) => builtOf(x, ['mine', 'kings-mine', 'pumping-station']),
    keys: ['groupPct', 'prodPct'],
  },
  {
    id: 'treaties',
    label: n => `${plural(n, 'treaty', 'treaties')} in force`,
    icon: 'pact',
    need: [1, 1, 2, 2, 3],
    from: 2,
    measure: (s, c) => s.treaties.filter(t => t.a === c.id || t.b === c.id).length,
    keys: ['goldPct', 'tensionPct', 'coastalPct'],
  },
  {
    id: 'farms',
    label: n => `${plural(n, 'farm')}, pastures or docks`,
    icon: 'food',
    need: [2, 3, 6, 10, 15],
    measure: (_s, _c, x) =>
      builtOf(x, ['farm', 'pasture', 'plantation', 'fishing-dock', 'royal-granaries']),
    keys: ['groupPct', 'foodPct', 'growthPct'],
  },
  {
    id: 'roads',
    label: n => `${n} hexes of road near your settlements`,
    icon: 'road',
    need: [2, 4, 10, 20, 30],
    measure: (_s, _c, x) => x.roads,
    keys: ['roadCost', 'moves', 'goldPct'],
  },
  // ---- building and society
  {
    id: 'districts',
    label: n => `A settlement with ${n} districts`,
    icon: 'district',
    need: [2, 3, 3, 4, 4],
    measure: (_s, _c, x) => x.maxDistricts,
    keys: ['housingPct', 'prodPct', 'culturePct'],
  },
  {
    id: 'workshops',
    label: n => `A settlement with ${n} workshops`,
    icon: 'production',
    need: [1, 2, 2, 3, 3],
    measure: (_s, _c, x) => x.maxGroup.craft ?? 0,
    keys: ['prodPct', 'groupPct', 'workers'],
  },
  {
    id: 'settlements',
    label: n => `${plural(n, 'settlement')}`,
    icon: 'cities',
    need: [2, 3, 5, 8, 12],
    measure: (_s, _c, x) => x.settlements,
    keys: ['territoryRadius', 'commandCap', 'prodPct'],
  },
  {
    id: 'found',
    label: n => `Found ${plural(n, 'settlement')}`,
    icon: 'found-city',
    need: [1, 1, 2, 2, 2],
    since: true,
    measure: (_s, c) => deed(c, 'founded'),
    keys: ['growthPct', 'sight', 'territoryRadius'],
  },
  {
    id: 'pop',
    label: n => `${n},000 people`,
    icon: 'people',
    need: [4, 7, 15, 30, 60],
    measure: (_s, _c, x) => Math.floor(x.pop),
    keys: ['growthPct', 'foodPct', 'housingPct', 'workers'],
  },
  {
    id: 'grow',
    label: n => `Grow by ${n},000 people`,
    icon: 'growth',
    need: [1, 2, 4, 8, 15],
    since: true,
    measure: (_s, _c, x) => Math.floor(x.pop),
    keys: ['growthPct', 'foodPct'],
  },
  {
    id: 'urban',
    label: n => `${plural(n, 'city', 'cities')}`,
    icon: 'city',
    need: [1, 1, 1, 2, 3],
    from: 3,
    measure: (_s, _c, x) => x.urban,
    keys: ['housingPct', 'goldPct', 'workers'],
  },
  {
    id: 'houses',
    label: n => `${n} houses`,
    icon: 'housing',
    need: [4, 8, 20, 40, 70],
    measure: (_s, _c, x) => builtOf(x, ['houses', 'tenements', 'aqueduct']),
    keys: ['housingPct', 'growthPct'],
  },
  // ---- faith and arts
  {
    id: 'shrines',
    label: n => `${plural(n, 'shrine')} or temple${n === 1 ? '' : 's'}`,
    icon: 'faith',
    need: [1, 2, 4, 8, 12],
    measure: (_s, _c, x) => builtOf(x, ['shrine', 'temple', 'cathedral']),
    keys: ['culturePct', 'morale', 'tensionPct'],
  },
  {
    id: 'faith',
    label: n => `${plural(n, 'settlement')} keeping your faith`,
    icon: 'faith',
    need: [1, 2, 4, 8, 12],
    from: 2,
    measure: (_s, _c, x) => x.faithful,
    keys: ['morale', 'culturePct', 'attackPct'],
  },
  {
    id: 'culture',
    label: n => `${n} culture a turn`,
    icon: 'culture',
    need: [3, 6, 20, 50, 100],
    measure: (_s, c) => Math.floor(c.stats?.culture ?? 0),
    keys: ['culturePct'],
  },
  {
    id: 'monuments',
    label: n => `${plural(n, 'monument')} or theatre${n === 1 ? '' : 's'}`,
    icon: 'culture',
    need: [1, 2, 3, 6, 10],
    measure: (_s, _c, x) => builtOf(x, ['monument', 'amphitheatre', 'printing-house']),
    keys: ['culturePct', 'morale', 'goldPct'],
  },
  {
    id: 'wonder',
    label: () => 'Begin or hold a wonder',
    icon: 'wonder',
    need: [1, 1, 1, 1, 1],
    from: 2,
    measure: (s, c) =>
      heldWonders(s, c.id).length + (s.cities.some(x => x.civId === c.id && x.wonder) ? 1 : 0),
    keys: ['culturePct', 'prodPct'],
  },
  {
    id: 'peace',
    label: n => `${n} turns at peace`,
    icon: 'peace',
    need: [10, 12, 15, 15, 15],
    streak: (s, c) => !s.civs.some(o => o.id !== c.id && !o.raiders && atWar(s, c.id, o.id)),
    keys: ['tensionPct', 'goldPct', 'culturePct', 'growthPct'],
  },
  // ---- the noble houses (dynasty.ts)
  {
    id: 'house-level',
    label: n => `A house reaches level ${n} in one line`,
    icon: 'dynasties',
    need: [3, 4, 5, 6, 7],
    measure: (_s, c) => topLevel(c),
    keys: ['sciencePct', 'culturePct', 'goldPct', 'prodPct', 'foodPct', 'morale'],
    house: true,
  },
  {
    id: 'house-total',
    label: n => `A house with ${n} levels in all`,
    icon: 'dynasties',
    need: [4, 6, 8, 11, 14],
    measure: (_s, c) => Math.max(0, ...houses(c).map(totalLevels)),
    keys: ['commandCap', 'prodPct', 'tensionPct', 'workers', 'growthPct', 'housingPct'],
    house: true,
  },
  {
    id: 'house-war',
    label: n => `A house reaches War ${n}`,
    icon: 'dynasties',
    need: [1, 2, 3, 4, 5],
    measure: (_s, c) => topArea(c, 'military'),
    keys: ['attackPct', 'meleePct', 'morale', 'commandCap', 'chargePct', 'rangedPct'],
    house: true,
  },
  {
    id: 'house-learning',
    label: n => `A Science ${n} house governs a settlement with a school`,
    icon: 'dynasties',
    need: [1, 2, 2, 3, 4],
    measure: (s, c) =>
      governorLevel(s, c, 'research', ['school', 'library', 'university', 'academy']),
    keys: ['sciencePct', 'researchPct', 'heal'],
    house: true,
  },
  {
    id: 'house-trade',
    label: n => `A Money ${n} house governs a market town`,
    icon: 'dynasties',
    need: [1, 2, 2, 3, 4],
    measure: (s, c) => governorLevel(s, c, 'gold', ['market', 'bank', 'mint', 'guild-hall']),
    keys: ['goldPct', 'groupPct', 'refitPct'],
    house: true,
  },
  {
    id: 'house-faith',
    label: n => `A Religion-and-arts ${n} house governs a settlement with a shrine`,
    icon: 'dynasties',
    need: [1, 2, 2, 3, 4],
    measure: (s, c) =>
      governorLevel(s, c, 'culture', ['shrine', 'temple', 'cathedral', 'monument']),
    keys: ['culturePct', 'morale', 'tensionPct'],
    house: true,
  },
  {
    id: 'trinkets',
    label: n => `Give ${plural(n, 'treasure')} to the houses`,
    icon: 'gift',
    need: [1, 1, 2, 2, 3],
    since: true,
    measure: (_s, c) => houses(c).reduce((a, d) => a + d.trinkets.length, 0),
    keys: ['culturePct', 'goldPct', 'tensionPct', 'morale'],
    house: true,
  },
  {
    id: 'honours',
    label: n => `Grant honours ${n === 1 ? 'once' : `${n} times`}`,
    icon: 'crown',
    need: [1, 1, 2, 2, 2],
    since: true,
    measure: (_s, c) => deed(c, 'honours'),
    keys: ['tensionPct', 'goldPct', 'morale', 'commandCap'],
    house: true,
  },
  {
    id: 'calm-houses',
    label: n => `Every house's unrest below 30 for ${n} turns`,
    icon: 'unrest',
    need: [8, 10, 10, 12, 12],
    streak: (_s, c) => houses(c).every(d => d.unrest < 30),
    keys: ['tensionPct', 'morale', 'goldPct', 'growthPct'],
    house: true,
  },
  {
    id: 'house-seat',
    label: n => `A house governs a settlement of ${n},000 people`,
    icon: 'governor',
    need: [3, 5, 8, 12, 18],
    measure: (s, c) =>
      Math.floor(
        Math.max(0, ...s.cities.filter(x => x.civId === c.id && governorOf(s, x)).map(x => x.pop)) /
          1000,
      ),
    keys: ['housingPct', 'growthPct', 'foodPct', 'workers'],
    house: true,
  },
  {
    id: 'court',
    label: n => `${plural(n, 'house')} at court`,
    icon: 'dynasties',
    need: [2, 2, 3, 4, 5],
    from: 2,
    measure: (_s, c) => houses(c).length,
    keys: ['commandCap', 'workers', 'prodPct', 'territoryRadius'],
    house: true,
  },
  {
    id: 'houses-govern',
    label: n => `${plural(n, 'house')} governing settlements`,
    icon: 'governor',
    need: [2, 2, 2, 3, 3],
    from: 2,
    measure: (s, c) =>
      new Set(s.cities.filter(x => x.civId === c.id).map(x => governorOf(s, x)?.id)).size,
    keys: ['territoryRadius', 'goldPct', 'housingPct', 'tensionPct'],
    house: true,
  },
  {
    id: 'balance',
    label: () => 'No house holds over half the power',
    icon: 'opinion',
    need: [1, 1, 1, 1, 1],
    from: 2,
    measure: (s, c) => {
      if (houses(c).length < 2) return 0;
      const p = powerOf(s, c);
      return [...p.values()].every(x => x.share <= 0.5) ? 1 : 0;
    },
    keys: ['tensionPct', 'sciencePct', 'goldPct', 'workers'],
    house: true,
  },
  {
    id: 'ruling-power',
    label: n => `The ruling house holds ${n}% of the power`,
    icon: 'crown',
    need: [60, 60, 60, 60, 60],
    from: 2,
    measure: (s, c) => {
      if (houses(c).length < 2) return 0;
      return Math.floor((powerOf(s, c).get(rulerOf(c).id)?.share ?? 0) * 100);
    },
    keys: ['prodPct', 'commandCap', 'levyCohorts', 'morale'],
    house: true,
  },
  {
    id: 'civil-war',
    label: () => 'Come through a civil war',
    icon: 'war',
    need: [1, 1, 1, 1, 1],
    from: 2,
    since: true,
    measure: (_s, c) => deed(c, 'civilwars'),
    keys: ['morale', 'tensionPct', 'attackPct'],
    house: true,
  },
  // ---- the sea
  {
    id: 'ports',
    label: n => `${plural(n, 'harbour')} or dock${n === 1 ? '' : 's'}`,
    icon: 'trade',
    need: [1, 2, 3, 4, 5],
    measure: (_s, _c, x) => builtOf(x, ['harbour', 'fishing-dock', 'shipyard']),
    keys: ['coastalPct', 'navalPct', 'goldPct'],
  },
  {
    id: 'fleets',
    label: n => `${plural(n, 'fleet')} at sea`,
    icon: 'ship-cargo',
    need: [1, 1, 2, 2, 3],
    measure: (_s, _c, x) => x.fleets,
    keys: ['navalPct', 'sight'],
  },
];

export const MANDATES: Record<string, Mandate> = Object.fromEntries(list.map(m => [m.id, m]));
export const MANDATE_LIST = list;

export const mandateNeed = (m: Mandate, age: number) => m.need[Math.max(1, Math.min(5, age)) - 1];
export const mandateOpen = (m: Mandate, age: number) =>
  age >= (m.from ?? 1) && age <= (m.until ?? 5);
