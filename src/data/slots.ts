/**
 * District slot types. A district is a 3×3 grid of these inside a settlement. Each slot needs
 * something on the settlement's land (its hex and its six neighbours), workers, and production
 * plus goods to build. Neighbouring slots in the grid (up, down, left, right) can boost each
 * other. Farming, forestry and extraction are rural: only towns have room for them.
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

/** Groups that work the land: towns only. Cities get these goods from the towns around them. */
export const RURAL_GROUPS: SlotGroup[] = ['farming', 'forestry', 'extraction'];
export const isRural = (typeId: string | null) =>
  !!typeId && RURAL_GROUPS.includes(SLOT_TYPES[typeId]?.group);

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
  // farming: towns only. Each gives a little anywhere; what lies on the land adds more
  {
    id: 'farm',
    name: 'Farm',
    group: 'farming',
    labour: 100,
    build: { prod: 6 },
    out: { food: 0.5 },
    glyph: '𝍢',
    note: 'Crops: ½ food anywhere. Wheat or rice on the land makes it 1.',
  },
  {
    id: 'pasture',
    name: 'Pasture',
    group: 'farming',
    labour: 100,
    build: { prod: 6, goods: { wood: 1 } },
    out: { food: 0.5 },
    glyph: '🐄',
    note: 'Animals: ½ food anywhere. Pigs on the land make it 1 food; cattle add leather, sheep wool, horses (Animal Husbandry) horses.',
  },
  {
    id: 'plantation',
    name: 'Plantation',
    group: 'farming',
    labour: 100,
    build: { prod: 8, goods: { wood: 1 } },
    out: { food: 0.5 },
    glyph: '❀',
    note: '½ food. With 3 or more in one district, each also yields the sugar, spices, silk, dyes or wine on the land.',
  },
  {
    id: 'fishing-dock',
    name: 'Fishing boats',
    group: 'farming',
    labour: 100,
    build: { prod: 8, goods: { wood: 2 } },
    out: { food: 0.5 },
    needs: { water: true },
    glyph: '⚓',
    note: '½ food from a coast or lake. Fish make it 1; with 3 or more in one district, whales give whale oil and pearl beds pearls.',
  },
  // forestry
  {
    id: 'woodlot',
    name: 'Woodcutter',
    group: 'forestry',
    labour: 100,
    build: { prod: 5 },
    out: { goods: { wood: 0.5 } },
    glyph: '🌲',
    note: '½ wood anywhere; a forest or jungle on the land makes it 1.',
  },
  {
    id: 'hunting-lodge',
    name: 'Hunting lodge',
    group: 'forestry',
    labour: 100,
    build: { prod: 6 },
    out: { food: 0.5 },
    glyph: '🏹',
    note: '½ food. Game adds food and hides; with 3 or more in one district, furs and ivory on the land.',
  },
  // extraction
  {
    id: 'mine',
    name: 'Mine',
    group: 'extraction',
    labour: 150,
    build: { prod: 10, goods: { wood: 1 } },
    out: { goods: { stone: 0.5 } },
    adjacency: [{ from: ['infirmary'], bonus: {}, pct: 15 }],
    glyph: '⛏',
    note: '½ stone anywhere. With 3 or more mines in one district, each also digs a unit of the stone, coal, iron, copper, tin, gold, silver or saltpeter on the land.',
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
    note: 'Each neighbouring farm gives +½ food.',
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
    adjacency: [{ from: ['woodlot', 'mine'], bonus: { prod: 1 } }],
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
    id: 'shipyard',
    name: 'Shipyard',
    group: 'craft',
    tech: 'sailing',
    labour: 100,
    build: { prod: 18, goods: { wood: 4 } },
    out: { prod: 1 },
    needs: { water: true },
    glyph: '⛵',
    note: 'Lets the city build ships. Needs a coast or lake.',
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
    adjacency: [{ from: ['farm'], bonus: { food: 0.5 } }],
    glyph: '✣',
    note: '+½ food for each neighbouring farm.',
  },
  {
    id: 'smithy',
    name: 'Smithy',
    group: 'craft',
    tech: 'bronze-working',
    labour: 100,
    build: { prod: 16, goods: { wood: 2, stone: 1 } },
    out: { prod: 4 },
    inputs: { copper: 1, tin: 0.5 },
    adjacency: [{ from: ['workshop', 'armoury'], bonus: { prod: 1 } }],
    glyph: '⚒',
    note: 'Works copper and tin into tools: production.',
  },
  {
    id: 'tannery',
    name: 'Tannery',
    group: 'craft',
    tech: 'tanning',
    labour: 100,
    build: { prod: 12, goods: { wood: 2 } },
    out: { gold: 2, prod: 1 },
    inputs: { hides: 1 },
    glyph: '⛺',
    note: 'Turns leather into goods to sell.',
  },
  {
    id: 'weaver',
    name: 'Weaver',
    group: 'craft',
    labour: 100,
    build: { prod: 12, goods: { wood: 2 } },
    out: { gold: 2 },
    inputs: { wool: 1 },
    adjacency: [{ from: ['market'], bonus: { gold: 1 } }],
    glyph: '🧶',
    note: 'Weaves wool into cloth for the market.',
  },
  {
    id: 'mint',
    name: 'Mint',
    group: 'commerce',
    tech: 'currency',
    labour: 50,
    build: { prod: 20, goods: { stone: 2 } },
    out: { gold: 4 },
    inputs: { gold: 1 },
    adjacency: [{ from: ['bank'], bonus: { gold: 1 } }],
    glyph: '⊙',
    note: 'Strikes gold into coin.',
  },
  {
    id: 'foundry',
    name: 'Foundry',
    group: 'craft',
    tech: 'metallurgy',
    labour: 150,
    build: { prod: 40, goods: { stone: 3, iron: 2 } },
    out: { prod: 7 },
    inputs: { coal: 1, iron: 1 },
    adjacency: [{ from: ['mine'], bonus: { prod: 1 } }],
    glyph: '🔥',
    note: 'Burns coal and iron for heavy production.',
  },
];

export const SLOT_TYPES: Record<string, SlotType> = Object.fromEntries(list.map(t => [t.id, t]));
export const SLOT_LIST = list.filter(t => !t.fixed);

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
