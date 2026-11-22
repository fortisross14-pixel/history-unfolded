/** Terrain, relief and vegetation. A land hex = one terrain + one relief + one vegetation. */
export type TerrainId =
  'ocean' | 'coast' | 'lake' | 'grassland' | 'plains' | 'desert' | 'tundra' | 'snow';
export type ReliefId = 'flat' | 'hills' | 'mountains';
export type VegetationId = 'none' | 'forest' | 'jungle' | 'marsh';

export interface TerrainInfo {
  name: string;
  water: boolean;
  /** watercolour wash on the map */
  wash: string;
  food: number;
  prod: number;
}

export const TERRAIN: Record<TerrainId, TerrainInfo> = {
  ocean: { name: 'Ocean', water: true, wash: '#86a3ad', food: 1, prod: 0 },
  coast: { name: 'Coast', water: true, wash: '#a9c2c0', food: 1, prod: 0 },
  lake: { name: 'Lake', water: true, wash: '#9dbcc0', food: 2, prod: 0 },
  grassland: { name: 'Grassland', water: false, wash: '#b5c48a', food: 2, prod: 0 },
  plains: { name: 'Plains', water: false, wash: '#d4c98f', food: 1, prod: 1 },
  desert: { name: 'Desert', water: false, wash: '#e6d3a1', food: 0, prod: 0 },
  tundra: { name: 'Tundra', water: false, wash: '#b8b9a0', food: 1, prod: 0 },
  snow: { name: 'Snow', water: false, wash: '#eeeae0', food: 0, prod: 0 },
};

export const RELIEF: Record<
  ReliefId,
  { name: string; moveCost: number; prod: number; defense: number }
> = {
  flat: { name: 'Flat', moveCost: 0, prod: 0, defense: 0 },
  hills: { name: 'Hills', moveCost: 1, prod: 1, defense: 0.25 },
  mountains: { name: 'Mountains', moveCost: Infinity, prod: 0, defense: 0.5 },
};

export const VEGETATION: Record<
  VegetationId,
  { name: string; moveCost: number; mountedExtra: number; food: number; prod: number; wood: number }
> = {
  none: { name: '', moveCost: 0, mountedExtra: 0, food: 0, prod: 0, wood: 0 },
  forest: { name: 'Forest', moveCost: 1, mountedExtra: 1, food: 0, prod: 1, wood: 1 },
  jungle: { name: 'Jungle', moveCost: 1, mountedExtra: 1, food: 0, prod: 0, wood: 1 },
  marsh: { name: 'Marsh', moveCost: 1, mountedExtra: 1, food: 1, prod: 0, wood: 0 },
};

export const isWater = (t: TerrainId) => TERRAIN[t].water;
