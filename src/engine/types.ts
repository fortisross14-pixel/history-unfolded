import type { RulerChoice } from '../data/rulers.ts';
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
  /** peaceful victories turned off for this game (conquest and score are always on) */
  noVictory?: ('cultural' | 'economic' | 'diplomatic' | 'scientific')[];
  /** opponent strength and forgiveness; absent in older saves = normal */
  difficulty?: 'casual' | 'normal' | 'hard';
  /** the player's ruler; absent = a ruler chosen for them */
  ruler?: RulerSetup;
  /** rivals led by historical rulers (default) or the invented peoples of earlier versions */
  rivals?: 'historical' | 'fictional';
}

/** The player's ruler as set up before the game. */
export interface RulerSetup extends RulerChoice {
  /** the people's name; for a historical ruler, their nation by default */
  nation?: string;
  color?: string;
  /** settlement names: a historical ruler's id to borrow from, or 'invented' */
  names?: string;
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

/** settlers, workers and engineers are civilians: they do not fight */
export type FormationKind = 'army' | 'settlers' | 'fleet' | 'workers' | 'engineers';

export interface Formation {
  /** skipped by the player this turn: left out of the to-do list until the next turn */
  skip?: number;
  /** on sentry: stays put and out of the to-do list until enemies come near */
  sentry?: boolean;
  /** works on its own each turn: a crew builds roads and rails, a scout explores, settlers settle */
  auto?: 'crew' | 'explore' | 'settle';
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
/** a settlement's size: one more district at each step, up to the centre and its six neighbours */
export type Tier = 'settlement' | 'town' | 'large-town' | 'city' | 'large-city' | 'metropolis';

/** A faith founded by a people (faith.ts): it spreads from settlement to settlement by itself. */
export interface Faith {
  id: number;
  name: string;
  /** the people who founded it */
  founder: number;
  /** the settlement it was founded in */
  holy: number;
  founded: number;
  /** chosen tenet ids, founding belief first */
  tenets: string[];
}

export interface City {
  /** founded away from the realm's lands (colonies.ts): gathers only, until made a town */
  colony?: boolean;
  /** a world wonder being built here (wonders.ts): half its production goes to it */
  wonder?: { id: string; progress: number };
  /** the faith most of its people keep (faith.ts) */
  faith?: number;
  /** another faith gaining ground: turns it has been the stronger */
  conv?: { f: number; n: number };
  /** the governor plans its districts and buildings each turn (the player's settlements) */
  auto?: boolean;
  /** enemy troops around it since this turn (siege); guard falls, walls breach in time */
  siege?: { since: number; by: number };
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
  /** the builders' queue, in the player's order (economy.ts cityQueue); absent in older saves */
  queue?: BuildOrder[];
}

/** One planned building in a settlement's queue: a district plot, or the centre row (slot ≥ 9). */
export interface BuildOrder {
  districtId: number;
  slot: number;
  type: string;
  paused?: boolean;
}

export interface Civ {
  id: number;
  name: string;
  color: string;
  isPlayer: boolean;
  /** who leads this people: a historical ruler or a player's own (absent in older saves) */
  ruler?: RulerChoice;
  /** the names its settlements take, in order, before the shared list */
  cityList?: string[];
  /** an AI people's war on someone, announced: it strikes at turn `at` if it still wants to */
  warPlan?: { target: number; at: number; since: number };
  /** when goods run short, who comes first: factories (default), homes' hearths, or the army */
  supply?: 'industry' | 'homes' | 'army';
  /** what governed settlements and automated units work toward (ai.ts playerAutomation) */
  priority?: 'balanced' | 'growth' | 'trade' | 'expand' | 'war';
  /** the hidden people of raider bands (raiders.ts) */
  raiders?: boolean;
  /** the faith most of its people keep, if any (faith.ts) */
  faith?: number;
  /** a free people: one city, never expands; can be befriended, allied, absorbed or conquered */
  independent?: boolean;
  /** last turn's output, for the dominance victories: wealth made (GDP) and culture */
  stats?: {
    gdp: number;
    culture: number;
    /** science made last turn */
    science?: number;
    /** the most crowded settlement: people per housing */
    crowd?: number;
    /** settlements short of food */
    starving?: number;
    /** troop upkeep and gold income per turn */
    upkeep?: number;
    income?: number;
    /** industrial buildings, and the average comfort bonus in % (negative: short of luxuries) */
    industry?: number;
    comfort?: number;
  };
  /** a crisis the realm is going through (crises.ts) */
  crisis?: { id: string; since: number; until: number; eased?: boolean; response?: string };
  /** last turn each crisis struck, and the earliest turn the next may */
  crisisLast?: Record<string, number>;
  crisisNext?: number;
  /** age policies (data/policies.ts): lever position −1, 0 (balanced) or +1, and when moved */
  policies?: Record<string, { pos: number; since: number }>;
  /** national directions taken (data/paths.ts), in order */
  paths?: string[];
  /** an age (2 or 4) whose national direction is still to be chosen */
  pathDue?: 2 | 4;
  /** last turn each direction's edict was issued */
  edicts?: Record<string, number>;
  /** settlements taken in war, for the Age of Conquest */
  captured?: number;
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
  /** culture choices kept for good: missions done (and older saves' choices) */
  taken: string[];
  /** older saves: choices kept from before an upheaval, half their effect, no tags */
  legacy?: string[];
  /** religious tension (faith.ts and the schism crisis); other domains no longer build any */
  tension: Partial<Record<Domain, number>>;
  /** the Tome open in this age (culture.ts) */
  tome?: Tome | null;
  /** an age whose Tome is still to be chosen */
  pickDue?: number | null;
  /** Tomes closed, oldest first */
  history?: ClosedTome[];
  /** deeds the missions count: battles won, lairs cleared, wars declared, settlements founded */
  deeds?: Record<string, number>;
}

/** One mission of a Tome: a mandate (engine/tomes.ts) and the culture choice it gives. */
export interface TomeMission {
  node: string;
  task: string;
  /** the measure when bought, for mandates counted from then */
  base?: number;
  /** turns the mandate has held, for mandates counted in turns */
  count?: number;
}

export interface Tome {
  domain: Domain;
  age: number;
  offered: TomeMission[];
  /** missions bought (active or done), by culture choice id */
  taken: string[];
  done: string[];
  major: 'locked' | 'open' | 'bought';
  opened: number;
}

export interface ClosedTome {
  domain: Domain;
  age: number;
  done: string[];
  major: 'won' | 'lost';
  turn: number;
  /** of the missions done, those about the noble houses */
  houses?: number;
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
  /** settlements handed over (peace treaties only) */
  cities?: number[];
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
  /** the guided first game (ui/guide.ts): off, screens seen, hexes known at the start */
  guide?: { off?: boolean; seen: string[]; explored0?: number };
  /** tells two games on the same map apart (saves); absent in older saves */
  uid?: string;
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
  ended?: {
    winner: number;
    reason: 'conquest' | 'score' | 'defeat' | 'cultural' | 'economic' | 'diplomatic' | 'scientific';
  };
  /** a people holding a victory's goal, and since when (victories that must be held) */
  holding?: Record<string, { civId: number; since: number }>;
  /** the age the player just entered: shows the "Entering the age" card until closed */
  ageCard?: number;
  /** each turn's numbers per people, for the statistics screen (stats.ts) */
  statsHistory?: import('./stats.ts').StatsRow[];
  /** notable moments, kept for good (stats.ts) */
  chronicle?: import('./stats.ts').ChronicleEntry[];
  /** the peoples banded together against a runaway leader (coalition.ts) */
  coalition?: {
    against: number;
    members: number[];
    since: number;
    reason: string;
    /** turn the coalition warned the player it would march */
    warned?: number;
  };
  /** ruins not yet searched (ruins.ts) */
  ruins?: import('./ruins.ts').Ruin[];
  /** raider camps and bands of the early ages (raiders.ts) */
  raiders?: import('./raiders.ts').RaiderState;
  /** world wonders finished, in order (wonders.ts) */
  wonders?: { id: string; cityId: number; civId: number; turn: number }[];
  /** the faiths of the world, in the order they were founded (faith.ts) */
  faiths?: Faith[];
  /** a crisis has just struck the player: its dialog opens once */
  crisisCard?: boolean;
  districts: District[];
  /** 1 where a road runs, per hex */
  roads: number[];
  /** the player's events: pacing, history, the one waiting for a choice */
  realmEvents?: import('./realmEvents.ts').RealmEventState;
  /** history events waiting for the player's choice */
  events: PendingEvent[];
  /** last turn each civ had a history event */
  lastEvent: Record<number, number>;
}

/** A history event that has happened to a people and waits for a choice. */
export interface PendingEvent {
  id: number;
  eventId: string;
  civId: number;
  turn: number;
  /** the city it happens in, if any */
  cityId?: number;
  /** the other people involved, if any */
  other?: number;
}
