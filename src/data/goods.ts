/** Goods and the map deposits that produce them. */
import type { ReliefId, TerrainId, VegetationId } from './terrain.ts';

/** made: manufactured in cities (cloth, tools…): traded, and cloth and leatherwork are comforts */
export type GoodKind = 'food' | 'raw' | 'luxury' | 'made';

export interface GoodInfo {
  name: string;
  kind: GoodKind;
  /** sprite under /sprites/goods, or a short glyph drawn as a badge */
  icon?: string;
  glyph: string;
  /** a pictogram for the badge when there is no art */
  emoji?: string;
  color: string;
}

export const GOODS: Record<string, GoodInfo> = {
  wood: { name: 'Wood', kind: 'raw', icon: 'timber', emoji: '🪵', glyph: 'Wd', color: '#7a5a34' },
  stone: { name: 'Stone', kind: 'raw', emoji: '🪨', glyph: 'St', color: '#8a8478' },
  hides: { name: 'Hides', kind: 'raw', icon: 'furs', emoji: '🐂', glyph: 'Hd', color: '#9a6b40' },
  copper: { name: 'Copper', kind: 'raw', emoji: '🟠', glyph: 'Cu', color: '#b0663a' },
  tin: { name: 'Tin', kind: 'raw', emoji: '⚪', glyph: 'Sn', color: '#9aa4a8' },
  iron: { name: 'Iron', kind: 'raw', emoji: '⚙️', glyph: 'Fe', color: '#5d5a5a' },
  coal: { name: 'Coal', kind: 'raw', emoji: '⚫', glyph: 'C', color: '#2f2b28' },
  saltpeter: { name: 'Saltpeter', kind: 'raw', emoji: '💥', glyph: 'Sp', color: '#c9c3b4' },
  horses: { name: 'Horses', kind: 'raw', emoji: '🐎', glyph: 'Hr', color: '#7b4b2a' },
  grain: { name: 'Grain', kind: 'food', icon: 'corn', emoji: '🌾', glyph: 'Gr', color: '#c9a640' },
  fish: {
    name: 'Fish',
    kind: 'food',
    icon: 'cod',
    emoji: '🐟',
    glyph: 'Fi',
    color: '#5b7f95',
  },
  meat: { name: 'Meat', kind: 'food', emoji: '🍖', glyph: 'Mt', color: '#a0473a' },
  ivory: { name: 'Ivory', kind: 'luxury', emoji: '🐘', glyph: 'Iv', color: '#a8956a' },
  furs: { name: 'Furs', kind: 'luxury', icon: 'furs', emoji: '🦊', glyph: 'Fu', color: '#6d4a2e' },
  gold: { name: 'Gold', kind: 'luxury', icon: 'gold', emoji: '🪙', glyph: 'Au', color: '#d1a72f' },
  silver: {
    name: 'Silver',
    kind: 'luxury',
    icon: 'silver',
    emoji: '🥈',
    glyph: 'Ag',
    color: '#a9b0b5',
  },
  spices: {
    name: 'Spices',
    kind: 'luxury',
    icon: 'spices',
    emoji: '🌶️',
    glyph: 'Sc',
    color: '#b24d2a',
  },
  silk: { name: 'Silk', kind: 'luxury', icon: 'silk', emoji: '🧵', glyph: 'Sk', color: '#b56b8f' },
  dyes: { name: 'Dyes', kind: 'luxury', icon: 'dyes', emoji: '🌺', glyph: 'Dy', color: '#5a4f9a' },
  wine: { name: 'Wine', kind: 'luxury', icon: 'wine', emoji: '🍇', glyph: 'Wn', color: '#7a2a3a' },
  wool: { name: 'Wool', kind: 'raw', emoji: '🐑', glyph: 'Wo', color: '#d8cfb8' },
  sugar: { name: 'Sugar', kind: 'luxury', emoji: '🎋', glyph: 'Su', color: '#e7dcc8' },
  'whale-oil': { name: 'Whale oil', kind: 'luxury', emoji: '🐋', glyph: 'Wh', color: '#4d6a7a' },
  pearls: { name: 'Pearls', kind: 'luxury', emoji: '🦪', glyph: 'Pe', color: '#e9e4f0' },
  tools: { name: 'Tools', kind: 'made', emoji: '🔨', glyph: 'Tl', color: '#6b6f78' },
  cloth: { name: 'Cloth', kind: 'made', emoji: '🧶', glyph: 'Cl', color: '#b08f6a' },
  leatherwork: { name: 'Leatherwork', kind: 'made', emoji: '👞', glyph: 'Lw', color: '#8a5a32' },
  salt: { name: 'Salt', kind: 'raw', emoji: '🧂', glyph: 'Sa', color: '#e4e1da' },
  paper: { name: 'Paper', kind: 'made', emoji: '📜', glyph: 'Pa', color: '#efe6cf' },
  steel: { name: 'Steel', kind: 'made', emoji: '🔩', glyph: 'Sl', color: '#7d8a96' },
  oil: { name: 'Oil', kind: 'raw', emoji: '🛢️', glyph: 'Oi', color: '#262422' },
  electricity: { name: 'Electricity', kind: 'made', emoji: '⚡', glyph: 'El', color: '#e0c23a' },
};

/** Goods that serve as comforts: luxuries and the finer made goods. */
export const isComfort = (g: string) =>
  GOODS[g]?.kind === 'luxury' || g === 'cloth' || g === 'leatherwork' || g === 'salt';

/** Store limit: this much of a good per cell that makes it (and per settlement, for anything). */
export const STORE_PER_CELL = 8;

/** Luxuries settlements consume as comforts: one unit a turn per this many people. */
export const COMFORT_PEOPLE = 4000;
/** Gold and culture per comfort kind received, and lost per unit missing. */
export const COMFORT_PCT = 5;

/** Special goods need a dedicated district: at least this many of the working building in it. */
export const SPECIAL_MIN = 3;

export interface DepositInfo {
  name: string;
  /** the good it stands for (icons, colours) */
  yields: Record<string, number>;
  /** the building that works it, and what each such building gains from it */
  by: string;
  gives: { food?: number; gold?: number; goods?: Record<string, number> };
  /** a special good: only a district with SPECIAL_MIN of `by` gets it */
  special?: boolean;
  /** tech needed to work it (beyond seeing it) */
  tech?: string;
  /** a pictogram for the map badge (else the good's) */
  emoji?: string;
  terrain: TerrainId[];
  relief?: ReliefId[];
  vegetation?: VegetationId[];
  /** relative frequency among the deposits valid for a hex */
  weight: number;
  /** tech that reveals it; hidden until known */
  revealedBy?: string;
}

const LAND_OPEN: TerrainId[] = ['grassland', 'plains'];

export const DEPOSITS: Record<string, DepositInfo> = {
  wheat: {
    emoji: '🌾',
    by: 'farm',
    gives: { food: 0.5 },
    name: 'Wheat',
    yields: { grain: 1 },
    terrain: ['plains', 'grassland'],
    relief: ['flat'],
    vegetation: ['none'],
    weight: 6,
  },
  rice: {
    emoji: '🌾',
    by: 'farm',
    gives: { food: 0.5 },
    name: 'Rice',
    yields: { grain: 1 },
    terrain: ['grassland'],
    relief: ['flat'],
    vegetation: ['none', 'marsh'],
    weight: 3,
  },
  fish: {
    emoji: '🐟',
    name: 'Fish',
    by: 'fishing-dock',
    gives: { food: 0.5 },
    yields: { fish: 1 },
    terrain: ['coast', 'lake'],
    weight: 6,
  },
  pigs: {
    emoji: '🐖',
    by: 'pasture',
    gives: { food: 0.5 },
    name: 'Pigs',
    yields: { meat: 1 },
    terrain: LAND_OPEN,
    vegetation: ['none', 'forest'],
    weight: 3,
  },
  cattle: {
    emoji: '🐄',
    by: 'pasture',
    gives: { goods: { hides: 1 } },
    name: 'Cattle',
    yields: { meat: 1, hides: 1 },
    terrain: LAND_OPEN,
    relief: ['flat', 'hills'],
    vegetation: ['none'],
    weight: 4,
  },
  sheep: {
    emoji: '🐑',
    by: 'pasture',
    gives: { goods: { wool: 1 } },
    name: 'Sheep',
    yields: { meat: 1, hides: 1 },
    terrain: ['plains', 'grassland', 'tundra'],
    relief: ['hills'],
    weight: 3,
  },
  game: {
    emoji: '🦌',
    by: 'hunting-lodge',
    gives: { food: 0.5, goods: { hides: 0.5 } },
    name: 'Game',
    yields: { hides: 1, meat: 1 },
    terrain: ['tundra', 'grassland', 'plains'],
    vegetation: ['forest'],
    weight: 4,
  },
  horses: {
    by: 'pasture',
    gives: { goods: { horses: 1 } },
    tech: 'animal-husbandry',
    name: 'Horses',
    yields: { horses: 1 },
    terrain: ['plains', 'grassland', 'desert'],
    relief: ['flat'],
    vegetation: ['none'],
    weight: 3,
  },
  stone: {
    by: 'mine',
    gives: { goods: { stone: 1 } },
    special: true,
    name: 'Stone',
    yields: { stone: 1 },
    terrain: ['plains', 'grassland', 'desert', 'tundra'],
    relief: ['hills'],
    weight: 4,
  },
  copper: {
    by: 'mine',
    gives: { goods: { copper: 1 } },
    special: true,
    tech: 'mining',
    name: 'Copper',
    yields: { copper: 1 },
    terrain: ['plains', 'grassland', 'desert', 'tundra'],
    relief: ['hills'],
    weight: 3,
  },
  tin: {
    by: 'mine',
    gives: { goods: { tin: 1 } },
    special: true,
    tech: 'mining',
    name: 'Tin',
    yields: { tin: 1 },
    terrain: ['plains', 'grassland', 'desert', 'tundra'],
    relief: ['hills', 'flat'],
    vegetation: ['none', 'forest'],
    weight: 2,
  },
  iron: {
    by: 'mine',
    gives: { goods: { iron: 1 } },
    special: true,
    name: 'Iron',
    yields: { iron: 1 },
    terrain: ['plains', 'grassland', 'desert', 'tundra', 'snow'],
    relief: ['hills'],
    weight: 3,
    revealedBy: 'iron-working',
  },
  coal: {
    by: 'mine',
    gives: { goods: { coal: 1 } },
    special: true,
    name: 'Coal',
    yields: { coal: 1 },
    terrain: ['plains', 'grassland', 'tundra'],
    relief: ['hills', 'flat'],
    vegetation: ['none', 'forest'],
    weight: 2,
    revealedBy: 'mineralogy',
  },
  saltpeter: {
    by: 'mine',
    gives: { goods: { saltpeter: 1 } },
    special: true,
    name: 'Saltpeter',
    yields: { saltpeter: 1 },
    terrain: ['desert', 'plains'],
    weight: 1,
    revealedBy: 'alchemy',
  },
  ivory: {
    by: 'hunting-lodge',
    gives: { goods: { ivory: 1 } },
    special: true,
    name: 'Ivory',
    yields: { ivory: 1 },
    terrain: ['plains', 'grassland'],
    vegetation: ['jungle', 'none'],
    weight: 2,
  },
  furs: {
    by: 'hunting-lodge',
    gives: { goods: { furs: 1 } },
    special: true,
    name: 'Furs',
    yields: { furs: 1 },
    terrain: ['tundra', 'snow'],
    vegetation: ['forest', 'none'],
    weight: 3,
  },
  gold: {
    by: 'mine',
    gives: { gold: 1, goods: { gold: 1 } },
    special: true,
    tech: 'mining',
    name: 'Gold',
    yields: { gold: 1 },
    terrain: ['desert', 'plains', 'grassland'],
    relief: ['hills'],
    weight: 1,
  },
  silver: {
    by: 'mine',
    gives: { gold: 1, goods: { silver: 1 } },
    special: true,
    tech: 'mining',
    name: 'Silver',
    yields: { silver: 1 },
    terrain: ['tundra', 'plains', 'desert'],
    relief: ['hills'],
    weight: 1,
  },
  spices: {
    by: 'plantation',
    gives: { goods: { spices: 1 } },
    special: true,
    name: 'Spices',
    yields: { spices: 1 },
    terrain: ['grassland', 'plains'],
    vegetation: ['jungle'],
    weight: 2,
  },
  silk: {
    by: 'plantation',
    gives: { goods: { silk: 1 } },
    special: true,
    name: 'Silk',
    yields: { silk: 1 },
    terrain: ['grassland', 'plains'],
    vegetation: ['forest'],
    weight: 1,
  },
  dyes: {
    by: 'plantation',
    gives: { goods: { dyes: 1 } },
    special: true,
    name: 'Dyes',
    yields: { dyes: 1 },
    terrain: ['grassland'],
    vegetation: ['jungle', 'forest'],
    weight: 1,
  },
  wine: {
    by: 'plantation',
    gives: { goods: { wine: 1 } },
    special: true,
    name: 'Wine',
    yields: { wine: 1 },
    terrain: ['plains', 'grassland'],
    relief: ['hills', 'flat'],
    vegetation: ['none'],
    weight: 1,
  },
  sugar: {
    name: 'Sugar',
    by: 'plantation',
    gives: { goods: { sugar: 1 } },
    special: true,
    yields: { sugar: 1 },
    terrain: ['grassland', 'plains'],
    relief: ['flat'],
    vegetation: ['jungle', 'none', 'marsh'],
    weight: 2,
  },
  whales: {
    name: 'Whales',
    by: 'fishing-dock',
    gives: { goods: { 'whale-oil': 1 } },
    special: true,
    yields: { 'whale-oil': 1 },
    terrain: ['coast'],
    weight: 2,
  },
  pearls: {
    name: 'Pearls',
    by: 'fishing-dock',
    gives: { goods: { pearls: 1 } },
    special: true,
    yields: { pearls: 1 },
    terrain: ['coast'],
    weight: 1,
  },
  salt: {
    name: 'Salt',
    by: 'mine',
    gives: { goods: { salt: 1 } },
    special: true,
    yields: { salt: 1 },
    terrain: ['desert', 'plains', 'tundra'],
    relief: ['flat', 'hills'],
    vegetation: ['none'],
    weight: 2,
  },
  oil: {
    name: 'Oil',
    by: 'mine',
    gives: { goods: { oil: 1 } },
    special: true,
    yields: { oil: 1 },
    terrain: ['desert', 'plains', 'tundra', 'grassland'],
    relief: ['flat'],
    weight: 2,
    revealedBy: 'oil-drilling',
  },
};
