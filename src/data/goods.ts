/** Goods and the map deposits that produce them. */
import type { ReliefId, TerrainId, VegetationId } from './terrain.ts';

export type GoodKind = 'food' | 'raw' | 'luxury';

export interface GoodInfo {
  name: string;
  kind: GoodKind;
  /** sprite under /sprites/goods, or a short glyph drawn as a badge */
  icon?: string;
  glyph: string;
  color: string;
}

export const GOODS: Record<string, GoodInfo> = {
  wood: { name: 'Wood', kind: 'raw', icon: 'timber', glyph: 'Wd', color: '#7a5a34' },
  stone: { name: 'Stone', kind: 'raw', glyph: 'St', color: '#8a8478' },
  hides: { name: 'Hides', kind: 'raw', icon: 'furs', glyph: 'Hd', color: '#9a6b40' },
  copper: { name: 'Copper', kind: 'raw', glyph: 'Cu', color: '#b0663a' },
  tin: { name: 'Tin', kind: 'raw', glyph: 'Sn', color: '#9aa4a8' },
  iron: { name: 'Iron', kind: 'raw', glyph: 'Fe', color: '#5d5a5a' },
  coal: { name: 'Coal', kind: 'raw', glyph: 'C', color: '#2f2b28' },
  saltpeter: { name: 'Saltpeter', kind: 'raw', glyph: 'Sp', color: '#c9c3b4' },
  horses: { name: 'Horses', kind: 'raw', glyph: 'Hr', color: '#7b4b2a' },
  grain: { name: 'Grain', kind: 'food', icon: 'corn', glyph: 'Gr', color: '#c9a640' },
  fish: { name: 'Fish', kind: 'food', icon: 'cod', glyph: 'Fi', color: '#5b7f95' },
  meat: { name: 'Meat', kind: 'food', glyph: 'Mt', color: '#a0473a' },
  ivory: { name: 'Ivory', kind: 'luxury', glyph: 'Iv', color: '#a8956a' },
  furs: { name: 'Furs', kind: 'luxury', icon: 'furs', glyph: 'Fu', color: '#6d4a2e' },
  gold: { name: 'Gold', kind: 'luxury', icon: 'gold', glyph: 'Au', color: '#d1a72f' },
  silver: { name: 'Silver', kind: 'luxury', icon: 'silver', glyph: 'Ag', color: '#a9b0b5' },
  spices: { name: 'Spices', kind: 'luxury', icon: 'spices', glyph: 'Sc', color: '#b24d2a' },
  silk: { name: 'Silk', kind: 'luxury', icon: 'silk', glyph: 'Sk', color: '#b56b8f' },
  dyes: { name: 'Dyes', kind: 'luxury', icon: 'dyes', glyph: 'Dy', color: '#5a4f9a' },
  wine: { name: 'Wine', kind: 'luxury', icon: 'wine', glyph: 'Wn', color: '#7a2a3a' },
};

export interface DepositInfo {
  name: string;
  /** what one richness level yields per turn when worked */
  yields: Record<string, number>;
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
    name: 'Wheat',
    yields: { grain: 1 },
    terrain: ['plains', 'grassland'],
    relief: ['flat'],
    vegetation: ['none'],
    weight: 6,
  },
  rice: {
    name: 'Rice',
    yields: { grain: 1 },
    terrain: ['grassland'],
    relief: ['flat'],
    vegetation: ['none', 'marsh'],
    weight: 3,
  },
  fish: { name: 'Fish', yields: { fish: 1 }, terrain: ['coast', 'lake'], weight: 6 },
  pigs: {
    name: 'Pigs',
    yields: { meat: 1 },
    terrain: LAND_OPEN,
    vegetation: ['none', 'forest'],
    weight: 3,
  },
  cattle: {
    name: 'Cattle',
    yields: { meat: 1, hides: 1 },
    terrain: LAND_OPEN,
    relief: ['flat', 'hills'],
    vegetation: ['none'],
    weight: 4,
  },
  sheep: {
    name: 'Sheep',
    yields: { meat: 1, hides: 1 },
    terrain: ['plains', 'grassland', 'tundra'],
    relief: ['hills'],
    weight: 3,
  },
  game: {
    name: 'Game',
    yields: { hides: 1, meat: 1 },
    terrain: ['tundra', 'grassland', 'plains'],
    vegetation: ['forest'],
    weight: 4,
  },
  horses: {
    name: 'Horses',
    yields: { horses: 1 },
    terrain: ['plains', 'grassland', 'desert'],
    relief: ['flat'],
    vegetation: ['none'],
    weight: 3,
  },
  stone: {
    name: 'Stone',
    yields: { stone: 1 },
    terrain: ['plains', 'grassland', 'desert', 'tundra'],
    relief: ['hills'],
    weight: 4,
  },
  copper: {
    name: 'Copper',
    yields: { copper: 1 },
    terrain: ['plains', 'grassland', 'desert', 'tundra'],
    relief: ['hills'],
    weight: 3,
  },
  tin: {
    name: 'Tin',
    yields: { tin: 1 },
    terrain: ['plains', 'grassland', 'desert', 'tundra'],
    relief: ['hills', 'flat'],
    vegetation: ['none', 'forest'],
    weight: 2,
  },
  iron: {
    name: 'Iron',
    yields: { iron: 1 },
    terrain: ['plains', 'grassland', 'desert', 'tundra', 'snow'],
    relief: ['hills'],
    weight: 3,
    revealedBy: 'iron-working',
  },
  coal: {
    name: 'Coal',
    yields: { coal: 1 },
    terrain: ['plains', 'grassland', 'tundra'],
    relief: ['hills', 'flat'],
    vegetation: ['none', 'forest'],
    weight: 2,
    revealedBy: 'mineralogy',
  },
  saltpeter: {
    name: 'Saltpeter',
    yields: { saltpeter: 1 },
    terrain: ['desert', 'plains'],
    weight: 1,
    revealedBy: 'alchemy',
  },
  ivory: {
    name: 'Ivory',
    yields: { ivory: 1 },
    terrain: ['plains', 'grassland'],
    vegetation: ['jungle', 'none'],
    weight: 2,
  },
  furs: {
    name: 'Furs',
    yields: { furs: 1 },
    terrain: ['tundra', 'snow'],
    vegetation: ['forest', 'none'],
    weight: 3,
  },
  gold: {
    name: 'Gold',
    yields: { gold: 1 },
    terrain: ['desert', 'plains', 'grassland'],
    relief: ['hills'],
    weight: 1,
  },
  silver: {
    name: 'Silver',
    yields: { silver: 1 },
    terrain: ['tundra', 'plains', 'desert'],
    relief: ['hills'],
    weight: 1,
  },
  spices: {
    name: 'Spices',
    yields: { spices: 1 },
    terrain: ['grassland', 'plains'],
    vegetation: ['jungle'],
    weight: 2,
  },
  silk: {
    name: 'Silk',
    yields: { silk: 1 },
    terrain: ['grassland', 'plains'],
    vegetation: ['forest'],
    weight: 1,
  },
  dyes: {
    name: 'Dyes',
    yields: { dyes: 1 },
    terrain: ['grassland'],
    vegetation: ['jungle', 'forest'],
    weight: 1,
  },
  wine: {
    name: 'Wine',
    yields: { wine: 1 },
    terrain: ['plains', 'grassland'],
    relief: ['hills', 'flat'],
    vegetation: ['none'],
    weight: 1,
  },
};
