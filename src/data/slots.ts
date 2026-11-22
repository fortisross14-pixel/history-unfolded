/**
 * District slot types. A district is a 3×3 grid of these on one hex. Each slot needs something
 * within reach (the district's hex and its six neighbours), workers, and production plus goods
 * to build. Neighbouring slots in the grid (up, down, left, right) can boost each other.
 * Numbers are first-pass.
 */
import type { ReliefId, TerrainId, VegetationId } from './terrain.ts';

export type SlotGroup =
  | 'farming'
  | 'forestry'
  | 'extraction'
  | 'craft'
  | 'services'
  | 'commerce'
  | 'residential'
  | 'civic';

export const GROUPS: Record<SlotGroup, { name: string; color: string }> = {
  farming: { name: 'Farming', color: '#9bb54a' },
  forestry: { name: 'Forestry', color: '#4f7a3a' },
  extraction: { name: 'Extraction', color: '#8a6b4e' },
  craft: { name: 'Craft & industry', color: '#b0663a' },
  services: { name: 'Services', color: '#5a86a8' },
  commerce: { name: 'Commerce & finance', color: '#c9962b' },
  residential: { name: 'Residential', color: '#b5838d' },
  civic: { name: 'Civic', color: '#6b4a8a' },
};

/** What a slot yields per turn when built and staffed. Goods are keyed by good id. */
export interface Yield {
  food?: number;
  prod?: number;
  science?: number;
  gold?: number;
  culture?: number;
  housing?: number;
  goods?: Record<string, number>;
}

export interface Needs {
  /** any hex in reach with one of these terrains (and relief / vegetation if given) */
  land?: { terrain?: TerrainId[]; relief?: ReliefId[]; vegetation?: VegetationId[] };
  /** a deposit of one of these kinds in reach; output scales with richness */
  deposit?: string[];
  /** a coast or lake hex next to the district */
  water?: boolean;
  /** only in the city centre / never in the city centre */
  centre?: boolean;
  notCentre?: boolean;
}

export interface SlotType {
  id: string;
  name: string;
  group: SlotGroup;
  tech?: string;
  /** workers (people) needed to run it */
  labour: number;
  build: { prod: number; goods?: Record<string, number> };
  out: Yield;
  /** goods consumed per turn from the city's market while running */
  inputs?: Record<string, number>;
  needs?: Needs;
  /** slots of these types next to this one in the grid add `bonus` to this slot */
  adjacency?: { from: string[]; bonus: Yield; pct?: number }[];
  /** a matching deposit in reach adds this per richness level (to as many slots as it can feed) */
  boost?: { deposit: string[]; bonus: Yield };
  /** also yields one of the matching deposit's own goods (furs, ivory, spices…) */
  depositGoods?: boolean;
  /** special effects */
  armoury?: boolean;
  barracks?: boolean;
  /** city centre only: share of assault damage the walls stop, and extra guard cohorts */
  walls?: number;
  guard?: number;
  /** cannot be built by the player (city hall) */
  fixed?: boolean;
  /** one glyph for the grid view */
  glyph: string;
  note: string;
}

const OPEN: TerrainId[] = ['grassland', 'plains'];
const MINES = [
  'copper-mine',
  'tin-mine',
  'iron-mine',
  'coal-mine',
  'gold-mine',
  'silver-mine',
  'quarry',
];
const FARMS = ['grain-field', 'pig-pen', 'cattle-pasture', 'sheep-run'];

const list: SlotType[] = [
  // civic
  {
    id: 'town-hall',
    name: 'Town hall',
    group: 'civic',
    fixed: true,
    labour: 0,
    build: { prod: 0 },
    out: { food: 3, prod: 2, science: 1, gold: 1, housing: 3000, goods: { wood: 1 } },
    needs: { centre: true },
    glyph: '♜',
    note: 'The heart of the city.',
  },
  // farming
  {
    id: 'grain-field',
    name: 'Grain field',
    group: 'farming',
    labour: 100,
    build: { prod: 8 },
    out: { food: 2 },
    needs: { land: { terrain: OPEN, relief: ['flat'] } },
    boost: { deposit: ['wheat', 'rice'], bonus: { food: 1 } },
    adjacency: [{ from: ['granary'], bonus: { food: 1 } }],
    glyph: '𝍢',
    note: 'Cereals. Needs flat open land in reach; wheat and rice deposits add more.',
  },
  {
    id: 'pig-pen',
    name: 'Pig pen',
    group: 'farming',
    labour: 100,
    build: { prod: 8, goods: { wood: 1 } },
    out: { food: 2 },
    needs: { land: { terrain: ['grassland', 'plains', 'tundra'] } },
    boost: { deposit: ['pigs'], bonus: { food: 1 } },
    adjacency: [{ from: ['grain-field'], bonus: { food: 1 } }],
    glyph: '🐖',
    note: 'Meat. Fed better next to a grain field.',
  },
  {
    id: 'cattle-pasture',
    name: 'Cattle pasture',
    group: 'farming',
    labour: 100,
    build: { prod: 10, goods: { wood: 1 } },
    out: { food: 1, goods: { hides: 1 } },
    needs: { land: { terrain: OPEN, vegetation: ['none'] } },
    boost: { deposit: ['cattle'], bonus: { food: 1, goods: { hides: 1 } } },
    glyph: '🐄',
    note: 'Meat and leather. Cattle deposits double it.',
  },
  {
    id: 'sheep-run',
    name: 'Sheep run',
    group: 'farming',
    labour: 100,
    build: { prod: 8 },
    out: { food: 1, goods: { hides: 1 } },
    needs: { land: { relief: ['hills'] } },
    glyph: '🐑',
    note: 'Meat and hides on hills.',
  },
  {
    id: 'horse-stud',
    name: 'Horse stud',
    group: 'farming',
    tech: 'animal-husbandry',
    labour: 100,
    build: { prod: 12, goods: { wood: 2 } },
    out: { goods: { horses: 1 } },
    needs: { deposit: ['horses'] },
    glyph: '🐎',
    note: 'Breeds horses for cavalry.',
  },
  {
    id: 'fishing-dock',
    name: 'Fishing dock',
    group: 'farming',
    labour: 100,
    build: { prod: 10, goods: { wood: 2 } },
    out: { food: 2 },
    needs: { water: true },
    boost: { deposit: ['fish'], bonus: { food: 1 } },
    glyph: '⚓',
    note: 'Needs a coast or lake. Fish deposits add more.',
  },
  {
    id: 'granary',
    name: 'Granary',
    group: 'farming',
    tech: 'pottery',
    labour: 50,
    build: { prod: 12, goods: { wood: 2 } },
    out: { food: 1 },
    glyph: '⌂',
    note: 'Each neighbouring grain field gives +1 food.',
  },
  // forestry
  {
    id: 'woodlot',
    name: 'Woodlot',
    group: 'forestry',
    labour: 100,
    build: { prod: 6 },
    out: { goods: { wood: 2 } },
    needs: { land: { vegetation: ['forest', 'jungle'] } },
    glyph: '🌲',
    note: 'Wood. Needs forest in reach.',
  },
  // extraction
  {
    id: 'quarry',
    name: 'Quarry',
    group: 'extraction',
    labour: 150,
    build: { prod: 10 },
    out: { goods: { stone: 2 } },
    needs: { deposit: ['stone'] },
    adjacency: [{ from: ['infirmary'], bonus: {}, pct: 15 }],
    glyph: '⛏',
    note: 'Stone. Needs a stone deposit.',
  },
  {
    id: 'copper-mine',
    name: 'Copper mine',
    group: 'extraction',
    tech: 'mining',
    labour: 200,
    build: { prod: 14, goods: { wood: 2 } },
    out: { goods: { copper: 1 } },
    needs: { deposit: ['copper'] },
    adjacency: [{ from: ['infirmary'], bonus: {}, pct: 15 }],
    glyph: 'Cu',
    note: 'Needs a copper deposit.',
  },
  {
    id: 'tin-mine',
    name: 'Tin mine',
    group: 'extraction',
    tech: 'mining',
    labour: 200,
    build: { prod: 14, goods: { wood: 2 } },
    out: { goods: { tin: 1 } },
    needs: { deposit: ['tin'] },
    adjacency: [{ from: ['infirmary'], bonus: {}, pct: 15 }],
    glyph: 'Sn',
    note: 'Needs a tin deposit.',
  },
  {
    id: 'iron-mine',
    name: 'Iron mine',
    group: 'extraction',
    tech: 'iron-working',
    labour: 200,
    build: { prod: 18, goods: { wood: 2 } },
    out: { goods: { iron: 1 } },
    needs: { deposit: ['iron'] },
    adjacency: [{ from: ['infirmary'], bonus: {}, pct: 15 }],
    glyph: 'Fe',
    note: 'Needs an iron deposit.',
  },
  {
    id: 'coal-mine',
    name: 'Coal mine',
    group: 'extraction',
    tech: 'mineralogy',
    labour: 200,
    build: { prod: 18, goods: { wood: 2 } },
    out: { goods: { coal: 1 } },
    needs: { deposit: ['coal'] },
    adjacency: [{ from: ['infirmary'], bonus: {}, pct: 15 }],
    glyph: 'C',
    note: 'Needs a coal deposit.',
  },
  {
    id: 'gold-mine',
    name: 'Gold mine',
    group: 'extraction',
    tech: 'mining',
    labour: 200,
    build: { prod: 16, goods: { wood: 2 } },
    out: { gold: 3, goods: { gold: 1 } },
    needs: { deposit: ['gold'] },
    adjacency: [{ from: ['infirmary'], bonus: {}, pct: 15 }],
    glyph: 'Au',
    note: 'Needs a gold deposit.',
  },
  {
    id: 'silver-mine',
    name: 'Silver mine',
    group: 'extraction',
    tech: 'mining',
    labour: 200,
    build: { prod: 16, goods: { wood: 2 } },
    out: { gold: 2, goods: { silver: 1 } },
    needs: { deposit: ['silver'] },
    adjacency: [{ from: ['infirmary'], bonus: {}, pct: 15 }],
    glyph: 'Ag',
    note: 'Needs a silver deposit.',
  },
  {
    id: 'hunting-lodge',
    name: 'Hunting lodge',
    group: 'extraction',
    labour: 100,
    build: { prod: 8 },
    out: { food: 1, goods: { hides: 1 } },
    needs: { deposit: ['game', 'furs', 'ivory'] },
    depositGoods: true,
    glyph: '🏹',
    note: 'Hides, plus furs or ivory where they are found.',
  },
  {
    id: 'plantation',
    name: 'Plantation',
    group: 'extraction',
    labour: 150,
    build: { prod: 12, goods: { wood: 1 } },
    out: { gold: 1 },
    needs: { deposit: ['spices', 'silk', 'dyes', 'wine'] },
    depositGoods: true,
    glyph: '❀',
    note: 'Spices, silk, dyes or wine.',
  },
  // craft
  {
    id: 'workshop',
    name: 'Workshop',
    group: 'craft',
    labour: 100,
    build: { prod: 12, goods: { wood: 2 } },
    out: { prod: 3 },
    inputs: { wood: 1 },
    adjacency: [{ from: ['woodlot', 'quarry'], bonus: { prod: 1 } }],
    glyph: '⚒',
    note: 'Turns wood into production.',
  },
  {
    id: 'armoury',
    name: 'Armoury',
    group: 'craft',
    labour: 100,
    build: { prod: 16, goods: { wood: 2, stone: 1 } },
    out: { prod: 1 },
    armoury: true,
    glyph: '⚔',
    note: 'Troops near this city equip for 20% less and without the +50% distance cost.',
  },
  {
    id: 'barracks',
    name: 'Barracks',
    group: 'craft',
    labour: 50,
    build: { prod: 14, goods: { wood: 2 } },
    out: {},
    barracks: true,
    glyph: '⛺',
    note: 'Levies raised here start with one battle of experience.',
  },
  // services
  {
    id: 'infirmary',
    name: 'Infirmary',
    group: 'services',
    tech: 'tanning',
    labour: 50,
    build: { prod: 10, goods: { hides: 1 } },
    out: {},
    glyph: '✚',
    note: 'Neighbouring mines and quarries produce 15% more.',
  },
  {
    id: 'school',
    name: 'School',
    group: 'services',
    tech: 'writing',
    labour: 50,
    build: { prod: 14, goods: { wood: 1, stone: 1 } },
    out: { science: 2 },
    adjacency: [{ from: ['houses'], bonus: { science: 1 } }],
    glyph: '✎',
    note: 'Science, more next to houses.',
  },
  // commerce
  {
    id: 'market',
    name: 'Market',
    group: 'commerce',
    labour: 50,
    build: { prod: 12, goods: { wood: 2 } },
    out: { gold: 2 },
    adjacency: [{ from: ['market', 'bank', 'houses'], bonus: { gold: 1 } }],
    glyph: '⚖',
    note: '+1 gold for each neighbouring market, bank or houses.',
  },
  {
    id: 'bank',
    name: 'Bank',
    group: 'commerce',
    tech: 'currency',
    labour: 50,
    build: { prod: 20, goods: { stone: 2 } },
    out: { gold: 3 },
    adjacency: [
      { from: ['bank'], bonus: { gold: 1 } },
      { from: ['stock-exchange'], bonus: { gold: 2 } },
    ],
    glyph: '₿',
    note: 'Banks cluster: +1 gold per neighbouring bank, +2 next to a stock exchange.',
  },
  {
    id: 'stock-exchange',
    name: 'Stock exchange',
    group: 'commerce',
    tech: 'banking',
    labour: 50,
    build: { prod: 40, goods: { stone: 4 } },
    out: { gold: 4 },
    adjacency: [{ from: ['bank'], bonus: { gold: 1 } }],
    glyph: '📈',
    note: 'Feeds the banks around it.',
  },
  // residential
  {
    id: 'houses',
    name: 'Houses',
    group: 'residential',
    labour: 0,
    build: { prod: 10, goods: { wood: 2 } },
    out: { housing: 1000 },
    glyph: '⌂',
    note: 'Room for 1,000 more people.',
  },
  // ---- unlocked by research
  {
    id: 'shrine',
    name: 'Shrine',
    group: 'civic',
    tech: 'mysticism',
    labour: 50,
    build: { prod: 8, goods: { wood: 1 } },
    out: { culture: 1 },
    glyph: '☉',
    note: 'Culture.',
  },
  {
    id: 'monument',
    name: 'Monument',
    group: 'civic',
    tech: 'masonry',
    labour: 0,
    build: { prod: 15, goods: { stone: 2 } },
    out: { culture: 2 },
    glyph: '⌖',
    note: 'Culture without workers.',
  },
  {
    id: 'walls',
    name: 'City walls',
    group: 'civic',
    tech: 'masonry',
    labour: 0,
    build: { prod: 20, goods: { stone: 3 } },
    out: {},
    needs: { centre: true },
    walls: 0.25,
    guard: 1,
    glyph: '▥',
    note: 'Assaults on the city do a quarter less damage; one more guard cohort.',
  },
  {
    id: 'temple',
    name: 'Temple',
    group: 'civic',
    tech: 'priesthood',
    labour: 50,
    build: { prod: 22, goods: { stone: 2 } },
    out: { culture: 3 },
    adjacency: [{ from: ['shrine', 'monument'], bonus: { culture: 1 } }],
    glyph: '⛩',
    note: 'Culture, more next to shrines and monuments.',
  },
  {
    id: 'amphitheatre',
    name: 'Amphitheatre',
    group: 'civic',
    tech: 'literature',
    labour: 50,
    build: { prod: 24, goods: { stone: 3 } },
    out: { culture: 2, gold: 1 },
    adjacency: [{ from: ['houses', 'tenements'], bonus: { culture: 1 } }],
    glyph: '◠',
    note: 'Culture and a little gold, more next to houses.',
  },
  {
    id: 'cathedral',
    name: 'Cathedral',
    group: 'civic',
    tech: 'theology',
    labour: 100,
    build: { prod: 45, goods: { stone: 5 } },
    out: { culture: 6 },
    glyph: '✝',
    note: 'Great culture.',
  },
  {
    id: 'castle',
    name: 'Castle',
    group: 'civic',
    tech: 'castles',
    labour: 50,
    build: { prod: 40, goods: { stone: 6 } },
    out: {},
    needs: { centre: true },
    walls: 0.45,
    guard: 2,
    glyph: '♖',
    note: 'Assaults do 45% less damage; two more guard cohorts (replaces walls).',
  },
  {
    id: 'library',
    name: 'Library',
    group: 'services',
    tech: 'philosophy',
    labour: 50,
    build: { prod: 20, goods: { wood: 2 } },
    out: { science: 3 },
    adjacency: [{ from: ['school'], bonus: { science: 1 } }],
    glyph: '📚',
    note: 'Science, more next to schools.',
  },
  {
    id: 'university',
    name: 'University',
    group: 'services',
    tech: 'education',
    labour: 100,
    build: { prod: 45, goods: { stone: 4 } },
    out: { science: 6 },
    adjacency: [{ from: ['library'], bonus: { science: 2 } }],
    glyph: '🎓',
    note: 'Great science, more next to libraries.',
  },
  {
    id: 'printing-house',
    name: 'Printing house',
    group: 'services',
    tech: 'printing',
    labour: 100,
    build: { prod: 40, goods: { wood: 3, iron: 1 } },
    out: { science: 3, culture: 2 },
    adjacency: [{ from: ['university', 'library'], bonus: { science: 1 } }],
    glyph: '🖨',
    note: 'Books spread learning and ideas.',
  },
  {
    id: 'observatory',
    name: 'Observatory',
    group: 'services',
    tech: 'astronomy',
    labour: 50,
    build: { prod: 40, goods: { stone: 3 } },
    out: { science: 5 },
    needs: { land: { relief: ['hills', 'mountains'] } },
    glyph: '🔭',
    note: 'Needs hills or mountains in reach.',
  },
  {
    id: 'aqueduct',
    name: 'Aqueduct',
    group: 'residential',
    tech: 'engineering',
    labour: 0,
    build: { prod: 30, goods: { stone: 4 } },
    out: { housing: 2000 },
    glyph: '⩩',
    note: 'Room for 2,000 more people.',
  },
  {
    id: 'tenements',
    name: 'Tenements',
    group: 'residential',
    tech: 'urbanism',
    labour: 0,
    build: { prod: 18, goods: { wood: 3 } },
    out: { housing: 1500 },
    glyph: '▦',
    note: 'Room for 1,500 more people.',
  },
  {
    id: 'harbour',
    name: 'Harbour',
    group: 'commerce',
    tech: 'sailing',
    labour: 100,
    build: { prod: 20, goods: { wood: 3 } },
    out: { food: 1, gold: 2 },
    needs: { water: true },
    adjacency: [
      { from: ['fishing-dock'], bonus: { food: 1 } },
      { from: ['market'], bonus: { gold: 1 } },
    ],
    glyph: '⚓',
    note: 'Food and trade by the water.',
  },
  {
    id: 'guild-hall',
    name: 'Guild hall',
    group: 'commerce',
    tech: 'guilds',
    labour: 100,
    build: { prod: 30, goods: { wood: 2, stone: 2 } },
    out: { gold: 2, prod: 2 },
    adjacency: [{ from: ['workshop', 'foundry'], bonus: { prod: 1 } }],
    glyph: '⚜',
    note: 'Gold and production, more next to workshops.',
  },
  {
    id: 'lumber-mill',
    name: 'Lumber mill',
    group: 'forestry',
    tech: 'carpentry',
    labour: 100,
    build: { prod: 16, goods: { wood: 2 } },
    out: { goods: { wood: 3 }, prod: 1 },
    needs: { land: { vegetation: ['forest', 'jungle'] } },
    adjacency: [{ from: ['woodlot'], bonus: { goods: { wood: 1 } } }],
    glyph: '🪚',
    note: 'More wood, more next to woodlots.',
  },
  {
    id: 'windmill',
    name: 'Windmill',
    group: 'farming',
    tech: 'mechanics',
    labour: 50,
    build: { prod: 16, goods: { wood: 3 } },
    out: { food: 1, prod: 1 },
    adjacency: [{ from: ['grain-field'], bonus: { food: 1 } }],
    glyph: '✣',
    note: '+1 food for each neighbouring grain field.',
  },
  {
    id: 'saltpeter-works',
    name: 'Saltpeter works',
    group: 'extraction',
    tech: 'alchemy',
    labour: 150,
    build: { prod: 20, goods: { wood: 2 } },
    out: { goods: { saltpeter: 1 } },
    needs: { deposit: ['saltpeter'] },
    adjacency: [{ from: ['infirmary'], bonus: {}, pct: 15 }],
    glyph: 'Sp',
    note: 'Needs a saltpeter deposit. For gunpowder.',
  },
  {
    id: 'foundry',
    name: 'Foundry',
    group: 'craft',
    tech: 'metallurgy',
    labour: 150,
    build: { prod: 40, goods: { stone: 3, iron: 2 } },
    out: { prod: 6 },
    inputs: { coal: 1 },
    adjacency: [{ from: ['coal-mine', 'iron-mine'], bonus: { prod: 1 } }],
    glyph: '🔥',
    note: 'Burns coal for heavy production.',
  },
];

export const SLOT_TYPES: Record<string, SlotType> = Object.fromEntries(list.map(t => [t.id, t]));
export const SLOT_LIST = list.filter(t => !t.fixed);
export { MINES, FARMS };

/** Grid neighbours of slot index 0..8 (up, down, left, right). */
export function gridNeighbors(i: number): number[] {
  const r = Math.floor(i / 3),
    c = i % 3;
  const out: number[] = [];
  if (r > 0) out.push(i - 3);
  if (r < 2) out.push(i + 3);
  if (c > 0) out.push(i - 1);
  if (c < 2) out.push(i + 1);
  return out;
}
