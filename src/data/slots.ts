/**
 * District slot types. A district is a 3×3 grid of these inside a settlement. Each slot needs
 * workers and production plus goods to build. Producers make things; boosters raise the
 * producers of their district: an adder (+0.5 to each, early to mid game) and a multiplier
 * (×2, late). Every district needs at least two housing cells for its other buildings to work.
 * Farming, forestry and extraction are rural: only towns have room for them.
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

/** A district's other buildings work only with this many built housing cells in it. */
export const MIN_HOUSING = 2;
export const isHousing = (typeId: string | null) =>
  !!typeId && SLOT_TYPES[typeId]?.group === 'residential';

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
  /**
   * A booster: works on buildings of these types in its own district. `add` puts that much on
   * every yield each of them makes (a library: +0.5 science to each university); `mul`
   * multiplies what they make (a laboratory: ×2). Adders stack; of several multipliers on one
   * building only the strongest counts.
   */
  boost?: { of: string[]; add?: number; mul?: number };
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
    note: 'The heart of the settlement.',
  },
  // ---------------- farming (towns only)
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
  {
    id: 'granary',
    name: 'Granary',
    group: 'farming',
    tech: 'pottery',
    labour: 50,
    build: { prod: 12, goods: { wood: 2 } },
    out: {},
    boost: { of: ['farm', 'plantation'], add: 0.5 },
    glyph: '⌂',
    note: '+½ to each farm and plantation in the district.',
  },
  {
    id: 'windmill',
    name: 'Windmill',
    group: 'farming',
    tech: 'mechanics',
    labour: 50,
    build: { prod: 16, goods: { wood: 3 } },
    out: {},
    boost: { of: ['farm', 'pasture'], add: 0.5 },
    glyph: '✣',
    note: '+½ to each farm and pasture in the district.',
  },
  {
    id: 'cannery',
    name: 'Food packaging',
    group: 'farming',
    tech: 'preservation',
    labour: 100,
    build: { prod: 40, goods: { wood: 3, iron: 1 } },
    out: {},
    boost: { of: ['farm', 'pasture', 'plantation', 'fishing-dock', 'hunting-lodge'], mul: 2 },
    glyph: '▣',
    note: "Doubles what the district's farms, pastures, plantations, boats and lodges make.",
  },
  // ---------------- forestry (towns only)
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
  {
    id: 'lumber-mill',
    name: 'Lumber mill',
    group: 'forestry',
    tech: 'carpentry',
    labour: 50,
    build: { prod: 16, goods: { wood: 2 } },
    out: {},
    boost: { of: ['woodlot', 'hunting-lodge'], add: 0.5 },
    glyph: '⚙',
    note: '+½ to each woodcutter and hunting lodge in the district.',
  },
  {
    id: 'sawmill',
    name: 'Steam sawmill',
    group: 'forestry',
    tech: 'steam-power',
    labour: 100,
    build: { prod: 40, goods: { iron: 2, coal: 2 } },
    out: {},
    boost: { of: ['woodlot', 'hunting-lodge'], mul: 2 },
    glyph: '⛭',
    note: "Doubles what the district's woodcutters and lodges make.",
  },
  // ---------------- extraction (towns only)
  {
    id: 'mine',
    name: 'Mine',
    group: 'extraction',
    labour: 150,
    build: { prod: 10, goods: { wood: 1 } },
    out: { goods: { stone: 0.5 } },
    glyph: '⛏',
    note: '½ stone anywhere. With 3 or more mines in one district, each also digs a unit of the stone, coal, iron, copper, tin, gold, silver or saltpeter on the land.',
  },
  {
    id: 'pumping-station',
    name: 'Pumping station',
    group: 'extraction',
    tech: 'steam-power',
    labour: 100,
    build: { prod: 40, goods: { iron: 2, coal: 2 } },
    out: {},
    boost: { of: ['mine'], mul: 2 },
    glyph: '⛽',
    note: "Steam pumps drain the deep seams: doubles what the district's mines dig.",
  },
  // ---------------- services
  {
    id: 'infirmary',
    name: 'Infirmary',
    group: 'services',
    tech: 'tanning',
    labour: 50,
    build: { prod: 10, goods: { hides: 1 } },
    out: {},
    boost: { of: ['mine'], add: 0.5 },
    glyph: '✚',
    note: '+½ to each mine in the district: miners mended are miners working.',
  },
  {
    id: 'school',
    name: 'School',
    group: 'services',
    tech: 'writing',
    labour: 50,
    build: { prod: 14, goods: { wood: 1, stone: 1 } },
    out: { science: 1 },
    glyph: '✎',
    note: '+1 science.',
  },
  {
    id: 'university',
    name: 'University',
    group: 'services',
    tech: 'education',
    labour: 100,
    build: { prod: 35, goods: { stone: 3 } },
    out: { science: 1.5 },
    glyph: '🎓',
    note: '+1½ science.',
  },
  {
    id: 'observatory',
    name: 'Observatory',
    group: 'services',
    tech: 'astronomy',
    labour: 50,
    build: { prod: 40, goods: { stone: 3 } },
    out: { science: 2 },
    needs: { land: { relief: ['hills', 'mountains'] } },
    glyph: '☾',
    note: '+2 science. Needs hills or mountains on the land.',
  },
  {
    id: 'library',
    name: 'Library',
    group: 'services',
    tech: 'philosophy',
    labour: 50,
    build: { prod: 20, goods: { wood: 2 } },
    out: {},
    boost: { of: ['school', 'university', 'observatory'], add: 0.5 },
    glyph: '📚',
    note: '+½ to each school, university and observatory in the district.',
  },
  {
    id: 'laboratory',
    name: 'Research lab',
    group: 'services',
    tech: 'scientific-method',
    labour: 100,
    build: { prod: 50, goods: { stone: 3, iron: 2 } },
    out: {},
    boost: { of: ['school', 'university', 'observatory'], mul: 2 },
    glyph: '⚗',
    note: "Doubles the science of the district's schools, universities and observatories.",
  },
  // ---------------- civic
  {
    id: 'shrine',
    name: 'Shrine',
    group: 'civic',
    tech: 'mysticism',
    labour: 50,
    build: { prod: 8, goods: { wood: 1 } },
    out: { culture: 1 },
    glyph: '⛩',
    note: '+1 culture.',
  },
  {
    id: 'monument',
    name: 'Monument',
    group: 'civic',
    tech: 'masonry',
    labour: 0,
    build: { prod: 15, goods: { stone: 2 } },
    out: { culture: 1.5 },
    glyph: '⚱',
    note: '+1½ culture. Needs no workers.',
  },
  {
    id: 'temple',
    name: 'Temple',
    group: 'civic',
    tech: 'priesthood',
    labour: 50,
    build: { prod: 22, goods: { stone: 2 } },
    out: { culture: 2 },
    glyph: '⛪',
    note: '+2 culture.',
  },
  {
    id: 'cathedral',
    name: 'Cathedral',
    group: 'civic',
    tech: 'theology',
    labour: 100,
    build: { prod: 45, goods: { stone: 5 } },
    out: { culture: 4 },
    glyph: '✝',
    note: '+4 culture.',
  },
  {
    id: 'amphitheatre',
    name: 'Amphitheatre',
    group: 'civic',
    tech: 'literature',
    labour: 50,
    build: { prod: 24, goods: { stone: 3 } },
    out: { gold: 1 },
    boost: { of: ['shrine', 'monument', 'temple', 'cathedral'], add: 0.5 },
    glyph: '⌓',
    note: '+½ to each shrine, monument, temple and cathedral in the district; +1 gold from the crowds.',
  },
  {
    id: 'printing-house',
    name: 'Printing house',
    group: 'civic',
    tech: 'printing',
    labour: 100,
    build: { prod: 40, goods: { wood: 3, iron: 1 } },
    out: { science: 1 },
    boost: { of: ['shrine', 'monument', 'temple', 'cathedral'], mul: 2 },
    glyph: '⎙',
    note: "Doubles the culture of the district's shrines, monuments, temples and cathedrals; +1 science.",
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
    note: 'Centre only. Assaults do 25% less; one more guard cohort.',
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
    note: 'Centre only. Assaults do 45% less; two more guard cohorts.',
  },
  // ---------------- commerce
  {
    id: 'market',
    name: 'Market',
    group: 'commerce',
    labour: 50,
    build: { prod: 12, goods: { wood: 2 } },
    out: { gold: 1 },
    boost: { of: ['houses', 'tenements', 'aqueduct'], add: 0.5 },
    glyph: '⚖',
    note: '+1 gold, and each housing cell in the district brings ½ gold to it: shops on every street.',
  },
  {
    id: 'bank',
    name: 'Bank',
    group: 'commerce',
    tech: 'currency',
    labour: 50,
    build: { prod: 20, goods: { stone: 2 } },
    out: { gold: 2 },
    glyph: '🏦',
    note: '+2 gold.',
  },
  {
    id: 'mint',
    name: 'Mint',
    group: 'commerce',
    tech: 'currency',
    labour: 50,
    build: { prod: 20, goods: { stone: 2 } },
    out: { gold: 3 },
    inputs: { gold: 1 },
    glyph: '⊙',
    note: 'Strikes a unit of gold into 3 coin.',
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
    glyph: '⚓',
    note: 'Trade by sea: joins the markets of ports. +1 food, +2 gold.',
  },
  {
    id: 'guild-hall',
    name: 'Guild hall',
    group: 'commerce',
    tech: 'guilds',
    labour: 50,
    build: { prod: 30, goods: { wood: 2, stone: 2 } },
    out: {},
    boost: {
      of: [
        ...['market', 'bank', 'mint', 'harbour'],
        ...['workshop', 'smithy', 'foundry', 'tannery', 'weaver'],
      ],
      add: 0.5,
    },
    glyph: '⚜',
    note: '+½ to each market, bank, mint, harbour and workshop of any kind in the district.',
  },
  {
    id: 'stock-exchange',
    name: 'Stock exchange',
    group: 'commerce',
    tech: 'banking',
    labour: 50,
    build: { prod: 40, goods: { stone: 4 } },
    out: {},
    boost: { of: ['market', 'bank', 'mint', 'harbour'], mul: 2 },
    glyph: '📈',
    note: "Doubles the gold of the district's markets, banks, mints and harbours.",
  },
  // ---------------- craft and industry
  {
    id: 'workshop',
    name: 'Workshop',
    group: 'craft',
    labour: 100,
    build: { prod: 12, goods: { wood: 2 } },
    out: { prod: 3 },
    inputs: { wood: 1 },
    glyph: '⚒',
    note: 'Burns a unit of wood for 3 production.',
  },
  {
    id: 'smithy',
    name: 'Smithy',
    group: 'craft',
    tech: 'bronze-working',
    labour: 100,
    build: { prod: 16, goods: { wood: 2, stone: 1 } },
    out: { prod: 1, goods: { tools: 1 } },
    inputs: { copper: 1, tin: 0.5 },
    glyph: '⚔',
    note: 'Works copper and tin into tools to trade or to run factories.',
  },
  {
    id: 'tannery',
    name: 'Tannery',
    group: 'craft',
    tech: 'tanning',
    labour: 100,
    build: { prod: 12, goods: { wood: 2 } },
    out: { goods: { leatherwork: 1 } },
    inputs: { hides: 1 },
    glyph: '⛺',
    note: 'Turns leather into leatherwork: comforts and trade.',
  },
  {
    id: 'weaver',
    name: 'Weaver',
    group: 'craft',
    labour: 100,
    build: { prod: 12, goods: { wood: 2 } },
    out: { goods: { cloth: 1 } },
    inputs: { wool: 1 },
    glyph: '🧶',
    note: 'Weaves wool into cloth: comforts and trade.',
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
    glyph: '🔥',
    note: 'Burns coal and iron for heavy production.',
  },
  {
    id: 'factory',
    name: 'Factory',
    group: 'craft',
    tech: 'steam-power',
    labour: 150,
    build: { prod: 50, goods: { iron: 3, stone: 3 } },
    out: {},
    inputs: { tools: 1 },
    boost: { of: ['workshop', 'smithy', 'foundry', 'tannery', 'weaver'], mul: 2 },
    glyph: '🏭',
    note: "Wears out a unit of tools a turn: doubles what the district's workshops, smithies, foundries, tanneries and weavers make.",
  },
  {
    id: 'armoury',
    name: 'Armoury',
    group: 'craft',
    labour: 100,
    build: { prod: 16, goods: { wood: 2, stone: 1 } },
    out: { prod: 1 },
    armoury: true,
    glyph: '🛡',
    note: 'Equipping troops near this settlement costs 20% less and no distance surcharge.',
  },
  {
    id: 'barracks',
    name: 'Barracks',
    group: 'craft',
    labour: 50,
    build: { prod: 14, goods: { wood: 2 } },
    out: {},
    barracks: true,
    glyph: '⚑',
    note: "New levies start with a battle's experience.",
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
    note: 'Builds ships; joins the markets of ports by sea.',
  },
  // ---------------- residential
  {
    id: 'houses',
    name: 'Houses',
    group: 'residential',
    labour: 0,
    build: { prod: 10, goods: { wood: 2 } },
    out: { housing: 1000 },
    glyph: '⌂',
    note: 'Room for 1,000 people. Every district needs 2 housing cells to work.',
  },
  {
    id: 'tenements',
    name: 'Tenements',
    group: 'residential',
    tech: 'urbanism',
    labour: 0,
    build: { prod: 18, goods: { wood: 3 } },
    out: { housing: 1500 },
    glyph: '▤',
    note: 'Room for 1,500 people.',
  },
  {
    id: 'aqueduct',
    name: 'Aqueduct',
    group: 'residential',
    tech: 'engineering',
    labour: 0,
    build: { prod: 30, goods: { stone: 4 } },
    out: { housing: 2000 },
    glyph: '≋',
    note: 'Room for 2,000 people.',
  },
];

export const SLOT_TYPES: Record<string, SlotType> = Object.fromEntries(list.map(t => [t.id, t]));
export const SLOT_LIST = list.filter(t => !t.fixed);
