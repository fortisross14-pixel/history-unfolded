import type { ReliefId, TerrainId, VegetationId } from '../data/terrain.ts';
import type { Loadout } from '../data/items.ts';
import type { Domain } from '../data/culture.ts';

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
  /** the game ends on this turn with a score victory */
  turnLimit?: number;
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
  /** battles survived */
  xp: number;
  /** the unit design this cohort was equipped as; null = plain levy */
  designId: number | null;
  /** the gear it actually carries (may lag behind an edited design until re-equipped) */
  loadout: Loadout;
}

/** A named unit type the player designs once and assigns cohorts to: "Hoplites", "Foot Falcons". */
export interface Design {
  id: number;
  name: string;
  loadout: Loadout;
  /** a ship design */
  naval?: boolean;
}

export type FormationKind = 'army' | 'settlers' | 'fleet';

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
  /** an army or settlers carried by this fleet */
  aboard?: number;
}

/** Town: 2 districts, farms and mines allowed. City: 4, no rural buildings. Metropolis: 6, one per civ. */
export type Tier = 'town' | 'city' | 'metropolis';

export interface City {
  id: number;
  civId: number;
  name: string;
  hex: number;
  tier: Tier;
  /** the house that governs it (a dynasty id of its people) */
  governor?: number;
  /** people */
  pop: number;
  food: number;
  stockpile: Record<string, number>;
  founded: number;
  /** city guard readiness 0..1; battered by assaults, recovers each turn */
  guard: number;
}

export interface Civ {
  id: number;
  name: string;
  color: string;
  isPlayer: boolean;
  techs: string[];
  researching: string | null;
  /** a later tech the player aims for; research follows its prerequisites */
  researchGoal: string | null;
  culture: CultureState;
  /** AI only: culture tags it leans towards */
  leanings: string[];
  /** AI only: the current military campaign */
  ai?: {
    targetCity: number;
    /** land hex next to our city where the armies gather */
    staging: number;
    phase: 'gather' | 'march' | 'assault';
    since: number;
    /** formations committed to this campaign */
    members: number[];
  };
  /** AI only: formations sent home to heal (they rejoin at 80%) */
  recovering?: number[];
  /** AI only: a sea crossing in progress (settlers or an army on transports) */
  sea?: {
    fleet: number;
    cargo: number;
    port: number;
    landing: number;
    dest: number;
    stage: 'load' | 'sail' | 'unload';
    since: number;
    /** enemy city hex an invasion aims at (none for settlers) */
    target?: number;
    /** sailing home to unload after a crossing could not be made */
    abort?: boolean;
  };
  /** the great houses; `ruling` holds the throne */
  dynasties: Dynasty[];
  ruling: number;
  /** trinkets earned by building, not yet given to a house */
  trinkets: Trinket[];
  /**
   * A house has risen. `pending`: the player has yet to choose a side (the realm has not split).
   * Once split, `rival` is the breakaway realm and the war runs CIVIL_WAR_TURNS.
   */
  civilWar?: { rebel: number; since: number; pending?: boolean; rival?: number };
  /** goods it ran out of last turn (saltpeter: firearms fire at half) */
  shortOf?: string[];
  /** a realm that broke away in a civil war (from this civ id) */
  splitFrom?: number;
  science: number;
  gold: number;
  /** 1 = explored, per hex */
  explored: number[];
  designs: Design[];
  blueprints: Blueprint[];
  cityNames: number;
  /** levies raised so far, for naming */
  levies: number;
  /** civ ids this civ has met */
  met: number[];
  alive: boolean;
  /** enemy people killed / own people lost in battle, for the record */
  kills: number;
  losses: number;
}

export interface Trinket {
  id: number;
  name: string;
  line: import('../data/dynasties.ts').Area;
}

export interface Dynasty {
  id: number;
  name: string;
  color: string;
  trinkets: Trinket[];
  /** points it was born with, by area (2 in one, 1 in another) */
  traits: Partial<Record<import('../data/dynasties.ts').Area, number>>;
  /** experience from governing, by area */
  xp: Partial<Record<import('../data/dynasties.ts').Area, number>>;
  /** 0..REVOLT_AT: how close the house is to rising */
  unrest: number;
  founded: number;
}

/** One cell of a district's 3×3 grid. */
export interface SlotState {
  type: string | null;
  built: boolean;
  /** production put in so far */
  progress: number;
  /** goods for construction already paid */
  paid: boolean;
}

/** A district: a named 3×3 grid of slots inside a settlement (all on the settlement's hex). */
export interface District {
  id: number;
  cityId: number;
  hex: number;
  name: string;
  slots: SlotState[];
}

/** A saved district layout the player can place again. */
export interface Blueprint {
  id: number;
  name: string;
  slots: (string | null)[];
}

export interface CultureState {
  points: number;
  taken: string[];
  /** choices kept from before an upheaval: half their effect, no tags */
  legacy: string[];
  tension: Record<Domain, number>;
  upheaval: { domain: Domain; turnsLeft: number } | null;
  /** an upheaval has ended and the player must choose what to keep */
  choosing: Domain | null;
}

/** Something one people remembers about another. Fades over time. */
export interface Memory {
  /** who remembers */
  to: number;
  /** who did it */
  about: number;
  kind: string;
  text: string;
  value: number;
  turn: number;
  /** points it moves toward 0 each turn */
  fade: number;
}

/** What one side of a deal hands over. Per-turn items run for `turns` turns. */
export interface Bundle {
  goods?: Record<string, number>;
  gold?: number;
  goodsPerTurn?: Record<string, number>;
  goldPerTurn?: number;
}

export interface Offer {
  /** from the proposer */
  give: Bundle;
  /** from the other side */
  get: Bundle;
  peace?: boolean;
  pact?: boolean;
  alliance?: boolean;
  turns?: number;
}

export interface Treaty {
  kind: 'pact' | 'alliance' | 'trade';
  a: number;
  b: number;
  since: number;
  /** last turn it holds; -1 for open-ended */
  until: number;
  /** per-turn flows for trade treaties: a pays aGives, b pays bGives */
  aGives?: Bundle;
  bGives?: Bundle;
}

/** An offer the AI makes to the player, waiting for an answer. */
export interface Proposal {
  id: number;
  from: number;
  to: number;
  kind: 'trade' | 'pact' | 'alliance' | 'peace' | 'demand';
  offer: Offer;
  turn: number;
  text: string;
}

export interface War {
  a: number;
  b: number;
  since: number;
  /** people lost in battle, by civ id */
  dead?: Record<number, number>;
  /** cities taken, by the civ that took them */
  taken?: Record<number, number>;
  lastFight?: number;
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
  wars: War[];
  memories: Memory[];
  treaties: Treaty[];
  proposals: Proposal[];
  /** set when the game is decided */
  ended?: { winner: number; reason: 'conquest' | 'score' | 'defeat' };
  districts: District[];
  /** 1 where a road runs, per hex */
  roads: number[];
}
