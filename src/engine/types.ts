import type { ReliefId, TerrainId, VegetationId } from '../data/terrain.ts';
import type { Loadout } from '../data/items.ts';

export type MapType =
  'continents' | 'pangaea' | 'archipelago' | 'inland-sea' | 'highlands' | 'random';
export type MapSize = 'small' | 'standard' | 'large' | 'huge';
export type Level3 = 'low' | 'normal' | 'high';

export interface MapSettings {
  type: MapType;
  size: MapSize;
  seaLevel: Level3;
  /** low = cold, high = hot */
  climate: Level3;
  /** low = dry, high = wet */
  rainfall: Level3;
  resources: Level3;
  mountains: Level3;
  seed: number;
}

export interface GameSettings {
  map: MapSettings;
  civCount: number;
  playerName: string;
}

export interface Deposit {
  kind: string;
  richness: 1 | 2 | 3;
}

export interface MapData {
  w: number;
  h: number;
  /** the map type actually generated (resolves "random") */
  type: Exclude<MapType, 'random'>;
  terrain: TerrainId[];
  relief: ReliefId[];
  vegetation: VegetationId[];
  elevation: number[];
  /** downstream hex of the river leaving this hex, or -1 */
  riverTo: number[];
  /** river flow volume through this hex (0 = no river) */
  river: number[];
  deposit: (Deposit | null)[];
  starts: number[];
}

export interface Cohort {
  id: number;
  /** people, 0..100 */
  strength: number;
  xp: number;
  loadout: Loadout;
}

export type FormationKind = 'army' | 'settlers';

export interface Formation {
  id: number;
  civId: number;
  name: string;
  kind: FormationKind;
  hex: number;
  cohorts: Cohort[];
  moves: number;
  /** remaining go-to path (next hex first) */
  path: number[];
  fortified: boolean;
}

export interface City {
  id: number;
  civId: number;
  name: string;
  hex: number;
  /** people */
  pop: number;
  food: number;
  stockpile: Record<string, number>;
  founded: number;
}

export interface Template {
  name: string;
  loadout: Loadout;
}

export interface Civ {
  id: number;
  name: string;
  color: string;
  isPlayer: boolean;
  techs: string[];
  researching: string | null;
  science: number;
  gold: number;
  /** 1 = explored, per hex */
  explored: number[];
  templates: Template[];
  cityNames: number;
}

export interface LogEntry {
  turn: number;
  civId: number;
  text: string;
}

export interface GameState {
  version: number;
  settings: GameSettings;
  turn: number;
  map: MapData;
  civs: Civ[];
  cities: City[];
  formations: Formation[];
  nextId: number;
  log: LogEntry[];
}
