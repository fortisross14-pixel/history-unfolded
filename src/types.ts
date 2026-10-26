// ---- Basics --------------------------------------------------------------------

export type Rank = 'Tribe' | 'Settlement' | 'City-State' | 'Duchy' | 'Kingdom' | 'Empire';
export type Terrain = 'ocean' | 'plains' | 'forest' | 'desert' | 'mountain' | 'tundra';
export type MapSize = 'small' | 'medium' | 'large' | 'huge';
export type NameMode = 'real' | 'fictional' | 'mixed';
export type EventCategory =
  | 'military'
  | 'economy'
  | 'diplomacy'
  | 'religion'
  | 'culture'
  | 'technology'
  | 'great-person'
  | 'society'
  | 'world'
  | 'exploration'
  | 'city'
  | 'politics'
  | 'wonder';

/** Seven governments, each with clear effects (see engine/government.ts). */
export type GovernmentType =
  'Chiefdom' | 'Monarchy' | 'Theocracy' | 'Merchant Republic' | 'Empire' | 'Republic' | 'Democracy';

/** Fifteen breakthroughs in six eras (see engine/eras.ts). */
export type BreakthroughId =
  | 'agriculture'
  | 'writing'
  | 'bronze'
  | 'iron'
  | 'money'
  | 'philosophy'
  | 'astronomy'
  | 'deep_sailing'
  | 'gunpowder'
  | 'printing'
  | 'banking'
  | 'steam_power'
  | 'railways'
  | 'electricity'
  | 'flight';

/** Ten buildings (see engine/buildings.ts). */
export type BuildingType =
  | 'Granary'
  | 'Market'
  | 'Barracks'
  | 'Temple'
  | 'Harbor'
  | 'Fortress'
  | 'Library'
  | 'Guild Hall'
  | 'University'
  | 'Factory';

/** Building quality, set by the rarity of whoever built it. */
export type BuildingQuality = 'Common' | 'Rare' | 'Epic' | 'Legend' | 'Generational';
export type DynastyStatus = 'ruling' | 'deposed' | 'extinct' | 'exiled' | 'restored';
export type WarType =
  | 'Expansion War'
  | 'Religious War'
  | 'Commercial War'
  | 'Dynastic Claim'
  | 'Cultural Reunification'
  | 'Punitive War'
  | 'Civil War'
  | 'Annexation War';

// ---- Land ------------------------------------------------------------------------

/** A hex of land or sea. Development is the one number that measures it. */
export interface Province {
  id: number;
  name: string;
  x: number;
  y: number;
  terrain: Terrain;
  continentId: number | null;
  ownerId: number | null;
  /** How built-up and populous the province is. Grows over time; war and disaster cut it. */
  development: number;
  cultureId: number | null;
  religionId: number | null;
  cityId: number | null;
}

export interface Continent {
  id: number;
  name: string;
  provinceIds: number[];
  discoveredByRealmId?: number;
  discoveredByCharacterId?: number;
  /** Name before an explorer renamed it, if any. */
  originalName?: string;
  discoveredYear?: number;
}

export interface KnownBreakthrough {
  id: BreakthroughId;
  year: number;
  source: 'invented' | 'spread' | 'founding';
  characterId?: number;
}

export interface Building {
  id: number;
  type: BuildingType;
  builtYear: number;
  builderId?: number;
  /** 1 (Common) to 5 (Generational): scales the building's effect. */
  level: 1 | 2 | 3 | 4 | 5;
}

export interface CityOwnership {
  realmId: number;
  from: number;
  to?: number;
}

/** A city turns its province's development into wealth, manpower and influence. */
export interface City {
  id: number;
  name: string;
  provinceId: number;
  continentId: number;
  foundedYear: number;
  founderRealmId: number;
  currentRealmId: number;
  isCapital: boolean;
  /** Character the city is named after, if any. */
  namedAfterId?: number;
  buildings: Building[];
  ownershipHistory: CityOwnership[];
  tradeRouteIds: number[];
  wonderIds: number[];
  /** Yearly output, recomputed every year from development, buildings and routes. */
  wealth: number;
  manpower: number;
  influence: number;
}

export interface TradeRoute {
  id: number;
  name: string;
  originCityId: number;
  destinationCityId: number;
  founderId: number;
  createdYear: number;
  /** Extra share of each end city's wealth. */
  bonus: number;
  active: boolean;
}

// ---- Characters -------------------------------------------------------------

export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legend' | 'Generational';
export type CharacterRole =
  | 'Ruler'
  | 'Heir'
  | 'Consort'
  | 'General'
  | 'Admiral'
  | 'Explorer'
  | 'Merchant'
  | 'Scholar'
  | 'Prophet'
  | 'Statesman';
export type TraitId =
  | 'Ambitious'
  | 'Cruel'
  | 'Just'
  | 'Patron'
  | 'Brilliant'
  | 'Greedy'
  | 'Pious'
  | 'Tolerant'
  | 'Brave'
  | 'Craven'
  | 'Charismatic'
  | 'Paranoid'
  | 'Builder'
  | 'Strategist'
  | 'Seafarer'
  | 'Frugal'
  | 'Reformer'
  | 'Sickly'
  | 'Hale'
  | 'Mad'
  | 'Lucky';
export type DeathCause = 'age' | 'battle' | 'illness' | 'assassination' | 'executed';
export type AmbitionType =
  | 'conquer'
  | 'expand'
  | 'found-religion'
  | 'reach-continent'
  | 'build-wonder'
  | 'grow-wealth'
  | 'great-discovery'
  | 'win-battles'
  | 'reform';

/** A life goal. Achieving it grants a legacy; failing it can sour a reign. */
export interface Ambition {
  type: AmbitionType;
  label: string;
  targetId?: number;
  /** Starting value for "grow" style goals (wealth, provinces, battles won). */
  baseline?: number;
  deadline: number;
  status: 'pending' | 'achieved' | 'failed';
  resolvedYear?: number;
}

/** Something a character did that history remembers. */
export interface Deed {
  year: number;
  text: string;
  /** How much this deed adds to the character's fame. */
  fame: number;
}

export interface Character {
  id: number;
  name: string;
  nickname?: string;
  role: CharacterRole;
  realmId: number;
  dynastyId: number | null;
  cultureId: number | null;
  religionId: number | null;
  born: number;
  died?: number;
  deathCause?: DeathCause;
  /** Planned natural lifespan in years; illness, battle or murder can cut it short. */
  lifespan: number;
  parentIds: number[];
  spouseId?: number;
  mentorId?: number;
  rarity: Rarity;
  /** 0–100 ability in the character's role. Rarity sets the range. */
  skill: number;
  traits: TraitId[];
  ambition: Ambition | null;
  deeds: Deed[];
  fame: number;
  legacyIds: number[];
  battlesWon: number;
  battlesLost: number;
  /** Role the character held before becoming ruler or consort, if any. */
  formerRole?: CharacterRole;
}

/** One reign of one ruler over one realm: the ruler's report card. */
export interface Reign {
  id: number;
  characterId: number;
  /** Copy of the ruler's name so the record survives pruning. */
  name: string;
  realmId: number;
  dynastyId: number | null;
  start: number;
  end?: number;
  endReason?: string;
  regentId?: number;
  regencyEnd?: number;
  government: GovernmentType;
  startProvinces: number;
  endProvinces?: number;
  startBreakthroughs: number;
  endBreakthroughs?: number;
  startWealth: number;
  endWealth?: number;
  startDevelopment: number;
  endDevelopment?: number;
  /** 0–100 summary of how much the realm grew under this reign. */
  score: number;
}

export type ModKey =
  | 'wealth'
  | 'growth'
  | 'research'
  | 'army'
  | 'stability'
  | 'influence'
  | 'warAppetite'
  | 'warPower'
  | 'faithSpread'
  | 'diplomacy'
  | 'exploration'
  | 'navy'
  | 'build';

/** A lasting realm bonus named after the character who earned it. */
export interface Legacy {
  id: number;
  name: string;
  characterId: number;
  realmId: number;
  start: number;
  end: number;
  mods: Partial<Record<ModKey, number>>;
  reason: string;
}

export type RenameKind = 'realm' | 'city' | 'character' | 'dynasty' | 'continent' | 'war';
export type NameOverrides = Record<RenameKind, Record<number, string>>;

// ---- Peoples and faiths ------------------------------------------------------

export interface Culture {
  id: number;
  name: string;
  color: string;
  founded: number;
  originRealmId: number;
  /** Share of the world's influence held by realms of this culture, 0–100. */
  strength: number;
  provinces: number;
}

export interface Religion {
  id: number;
  name: string;
  color: string;
  founded: number;
  founderId: number | null;
  holyProvinceIds: number[];
  doctrine: string;
  /** How fast the faith spreads from a state that follows it. */
  expansion: number;
  /** Low tolerance makes religious civil wars possible. */
  tolerance: number;
  parentReligionId?: number;
  schismIds: number[];
  provinces: number;
}

export interface Dynasty {
  id: number;
  name: string;
  founderId: number | null;
  foundedYear: number;
  endedYear?: number;
  originCultureId: number;
  originRealmId: number;
  /** Characters who ruled for this dynasty, in order. */
  rulerIds: number[];
  realmIds: number[];
  /** Dynasties linked to this one by royal marriage. */
  marriedIntoIds: number[];
  totalYearsInPower: number;
  peakTerritory: number;
  peakWealth: number;
  status: DynastyStatus;
}

// ---- Wars and wonders --------------------------------------------------------------

/** A named battle that swung a Great War. Ordinary battles are not stored. */
export interface KeyBattle {
  /** Year with season as a fraction (1450.25 = spring 1450). */
  t: number;
  name: string;
  provinceId: number;
  naval: boolean;
  winner: 'attacker' | 'defender';
  /** Momentum change, positive toward the attacker. */
  swing: number;
  text: string;
  characterIds: number[];
}

export interface War {
  id: number;
  name: string;
  type: WarType;
  rationale: string;
  goal: string;
  outcome?: string;
  startYear: number;
  endYear?: number;
  attackerIds: number[];
  defenderIds: number[];
  participantIds: number[];
  winnerIds: number[];
  loserIds: number[];
  attackerLosses: number;
  defenderLosses: number;
  territoriesChanged: number;
  goldTransferred: number;
  religionChanged: boolean;
  decisiveVictory: boolean;
  active: boolean;
  /** Great Wars are played out season by season as a World Moment. */
  great: boolean;
  momentId?: number;
  keyBattles: KeyBattle[];
  /** Peace terms the loser accepted. */
  terms: string[];
}

/** One of a handful of wonders; each gives its owner a clear, lasting bonus. */
export interface Wonder {
  id: number;
  /** Key into engine/wonders.ts. */
  kind: string;
  name: string;
  cityId: number;
  builderId: number;
  completedYear: number;
}

// ---- Diplomacy -----------------------------------------------------------------

/** The five diplomatic relations between two realms. */
export type RelationType = 'Alliance' | 'Marriage' | 'Vassal' | 'Rival' | 'Truce';

export interface Relation {
  id: number;
  type: RelationType;
  /** For a Vassal relation, a is the overlord and b the vassal. */
  a: number;
  b: number;
  since: number;
  /** Truces expire; other relations end when broken. */
  until?: number;
  /** Vassal relation created by inheriting a crown (personal union). */
  union?: boolean;
  /** Wars fought between rivals. */
  wars?: number;
  reason: string;
}

// ---- History -------------------------------------------------------------------

export interface HistoryEvent {
  id: number;
  year: number;
  category: EventCategory;
  title: string;
  description: string;
  importance: number;
  civIds: number[];
  personIds: number[];
  cityIds: number[];
  continentIds: number[];
  breakthroughIds: BreakthroughId[];
  warIds: number[];
  momentIds: number[];
  religionIds: number[];
  cultureIds: number[];
  wonderIds: number[];
  dynastyIds: number[];
  tags: string[];
  worldChronicle: boolean;
}

// ---- Realms --------------------------------------------------------------------

export interface NationalAxes {
  ambition: number;
  horizon: number;
  economy: number;
  faith: number;
  order: number;
}
export type AxisKey = keyof NationalAxes;

export interface Civilization {
  id: number;
  name: string;
  originTribe: string;
  successorIdentity?: string;
  color: string;
  rank: Rank;
  founded: number;
  government: GovernmentType;
  capitalCityId: number;
  cultureId: number;
  faithId: number | null;
  provinces: number[];
  cityIds: number[];
  /** Totals recomputed every year; the realm page shows where each comes from. */
  development: number;
  wealth: number;
  manpower: number;
  influence: number;
  armySize: number;
  armyCapacity: number;
  navy: number;
  navyCapacity: number;
  stability: number;
  /** Progress toward the next breakthrough nobody has made yet. */
  research: number;
  era: number;
  breakthroughs: KnownBreakthrough[];
  knownContinentIds: number[];
  knownRealmIds: number[];
  continentExposure: Record<string, number>;
  /** Character ids of the ruler, heir and regent (0 when none). */
  rulerId: number;
  heirId: number;
  regentId: number;
  dynastyId: number | null;
  historyEventIds: number[];
  warIds: number[];
  /**
   * National personality, each 0–100: Ambition (inward → expansionist),
   * Horizon (land → sea), Economy (agrarian → mercantile), Faith (zealous →
   * tolerant), Order (centralised → fractious).
   */
  axes: NationalAxes;
  /** Current strength relative to the world (land, wealth, armed forces). */
  power: number;
  /** Year this realm became the world's top power, while it stays on top. */
  topSince?: number;
  /** The most provinces the realm ever held, and when. */
  peakProvinces: number;
  peakYear: number;
  governmentHistory: { government: GovernmentType; from: number; to?: number; reason: string }[];
  nameHistory: { name: string; rank: Rank; from: number; reason: string }[];
}

// ---- World Moments -------------------------------------------------------------

export type MomentKind = 'war' | 'discovery' | 'revolution';

export interface MomentEvent {
  t: number;
  title: string;
  text: string;
  swing?: number;
  realmIds: number[];
  characterIds: number[];
}

/**
 * A World Moment: an event big enough to be played out live. Every kind
 * shares one shape: start, ticks that move a value, key events, resolution.
 */
export interface Moment {
  id: number;
  kind: MomentKind;
  title: string;
  /** Breakthrough id for discoveries, ideology id for revolutions. */
  subject: string;
  startYear: number;
  endYear?: number;
  active: boolean;
  originRealmId: number;
  originCharacterId?: number;
  realmIds: number[];
  /** [time, value]: momentum for wars, realms reached for waves. */
  series: [number, number][];
  events: MomentEvent[];
  summary?: string;
  warId?: number;
  /** War state: momentum −100..100 (positive favours the attacker). */
  momentum?: number;
  weariness?: [number, number];
  /** Consecutive ticks past the victory threshold. */
  streak?: number;
}

// ---- Seasons -------------------------------------------------------------------

/** An award at the end of a century, like a sports season's MVP. */
export interface SeasonAward {
  title: string;
  kind: 'character' | 'war' | 'realm';
  id: number;
  name: string;
  reason: string;
}

/** A century treated as a season: headlines, the map before and after, and awards. */
export interface Season {
  /** Last year of the century (1500 = the years 1401–1500). */
  year: number;
  headlines: { year: number; title: string; text: string }[];
  /** Owner of each province at the start and end, comma separated (empty = nobody). */
  mapBefore: string;
  mapAfter: string;
  /** Names and colours of every realm on either map. */
  palette: { id: number; name: string; color: string }[];
  awards: SeasonAward[];
  realmsBefore: number;
  realmsAfter: number;
}

// ---- World ---------------------------------------------------------------------

export interface WorldConfig {
  mapSize: MapSize;
  mapVariant: number;
  tribeCount: number;
  name: string;
  nameMode: NameMode;
}

export interface HallOfFameEntry {
  id: number;
  category: 'realm' | 'city' | 'character' | 'war';
  entityId: number;
  name: string;
  year: number;
  score: number;
  subtitle: string;
  periodKey: string;
}

export interface EvolutionRealmSnapshot {
  realmId: number;
  name: string;
  color: string;
  rank: Rank;
  continentId: number;
  greatPower: number;
  development: number;
  wealth: number;
  breakthroughs: number;
  military: number;
}

export interface EvolutionSnapshot {
  year: number;
  realms: EvolutionRealmSnapshot[];
  worldDevelopment: number;
  worldWealth: number;
}

export interface WorldState {
  /** Save schema version, see engine/save.ts. */
  version: number;
  seed: number;
  year: number;
  config: WorldConfig;
  width: number;
  height: number;
  provinces: Province[];
  continents: Continent[];
  civilizations: Civilization[];
  cities: City[];
  tradeRoutes: TradeRoute[];
  characters: Character[];
  cultures: Culture[];
  religions: Religion[];
  reigns: Reign[];
  legacies: Legacy[];
  /** Names the player set by hand. They survive engine renames. */
  overrides: NameOverrides;
  dynasties: Dynasty[];
  wars: War[];
  /** Great Wars, Great Discoveries and World Revolutions. */
  moments: Moment[];
  wonders: Wonder[];
  relations: Relation[];
  events: HistoryEvent[];
  evolutionSnapshots: EvolutionSnapshot[];
  hallOfFame: HallOfFameEntry[];
  seasons: Season[];
  nextIds: {
    civ: number;
    city: number;
    character: number;
    culture: number;
    religion: number;
    event: number;
    building: number;
    route: number;
    reign: number;
    legacy: number;
    dynasty: number;
    war: number;
    moment: number;
    wonder: number;
    relation: number;
    hallOfFame: number;
  };
}

export interface SaveSlot {
  slot: number;
  updatedAt: number;
  world: WorldState | null;
}
