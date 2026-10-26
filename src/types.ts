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
export type RealmEventType =
  | 'Famine'
  | 'Volcanic Eruption'
  | 'Flooding'
  | 'Pandemic'
  | 'Baby Boom'
  | 'National Sentiment'
  | 'Cultural Golden Age'
  | 'Commercial Renaissance'
  | 'Scientific Awakening';
export type EventSeverity = 'Mild' | 'Large' | 'Historical';
export type GovernmentType =
  | 'Tribal Council'
  | 'Chiefdom'
  | 'Clan Confederation'
  | 'Sacred Kingship'
  | 'Open Monarchy'
  | 'Feudal Monarchy'
  | 'Absolute Monarchy'
  | 'Constitutional Monarchy'
  | 'Imperial Court'
  | 'Oligarchy'
  | 'Merchant Republic'
  | 'Republic'
  | 'Democracy'
  | 'Federation'
  | 'Military Junta'
  | 'Dictatorship'
  | 'Theocracy'
  | 'Religious Monarchy';
export type TechnologyId =
  | 'agriculture'
  | 'writing'
  | 'bronze'
  | 'money'
  | 'iron'
  | 'deep_sailing'
  | 'gunpowder'
  | 'printing'
  | 'steam_power'
  | 'flight';
export type BuildingType =
  | 'Granary'
  | 'Road Network'
  | 'Workshop'
  | 'Forge'
  | 'Aqueduct'
  | 'Observatory'
  | 'Shipyard'
  | 'Courthouse'
  | 'Shrine'
  | 'Temple'
  | 'Monastery'
  | 'Cathedral'
  | 'Trading Post'
  | 'Market'
  | 'Harbor'
  | 'Barracks'
  | 'Fortifications'
  | 'Library'
  | 'University'
  | 'Merchant Guild'
  | 'Bank'
  | 'Stock Exchange'
  | 'Military Academy'
  | 'Printing House'
  | 'Hospital'
  | 'Artist Workshop'
  | 'Theater';
export type CityLevel = 'Village' | 'Settlement' | 'Town' | 'City' | 'Metropolis';
export type ArtworkType =
  'Oral Tradition' | 'Book / Writing' | 'Painting' | 'Building' | 'Sculpture' | 'Artifact' | 'Song';
export type ArtworkRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
export type BuildingRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
export type WonderCategory =
  'Military' | 'Religious' | 'Commercial' | 'Scientific' | 'Cultural' | 'Engineering';
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

export interface Province {
  id: number;
  name: string;
  x: number;
  y: number;
  terrain: Terrain;
  continentId: number | null;
  fertility: number;
  ownerId: number | null;
  population: number;
  gdp: number;
  cultureId: number | null;
  religionId: number | null;
  cityId: number | null;
  naturalWonderId: number | null;
  holySiteReligionIds: number[];
}
export interface Continent {
  id: number;
  name: string;
  provinceIds: number[];
  traitName: string;
  traitDescription: string;
  populationBonus: number;
  gdpBonus: number;
  technologyBonus: number;
  armyBonus: number;
  cultureBonus: number;
  discoveredByRealmId?: number;
  discoveredByCharacterId?: number;
  /** Name before an explorer renamed it, if any. */
  originalName?: string;
  discoveredYear?: number;
}
export interface TechnologyDefinition {
  id: TechnologyId;
  name: string;
  earliestYear: number;
  field: string;
  effect: string;
}
export interface KnownTechnology {
  technologyId: TechnologyId;
  discoveredYear: number;
  source: 'scholar' | 'diffusion' | 'founding';
  sourceCharacterId?: number;
}
export interface Building {
  id: number;
  type: BuildingType;
  name: string;
  builtYear: number;
  lastUpgradedYear: number;
  builderId?: number;
  lastBuilderId?: number;
  realmIdAtConstruction: number;
  rarity: BuildingRarity;
  level: 1 | 2 | 3 | 4 | 5;
  impact: number;
  gdpBonus: number;
  armyBonus: number;
  scienceBonus: number;
  cultureBonus: number;
  upgradeHistory: {
    year: number;
    characterId?: number;
    from?: BuildingRarity;
    to: BuildingRarity;
  }[];
}
export interface CityOwnership {
  realmId: number;
  from: number;
  to?: number;
}
export interface City {
  id: number;
  name: string;
  provinceId: number;
  continentId: number;
  foundedYear: number;
  founderRealmId: number;
  currentRealmId: number;
  population: number;
  prosperity: number;
  infrastructure: number;
  defense: number;
  culturalImportance: number;
  scientificImportance: number;
  religiousImportance: number;
  isCapital: boolean;
  /** Character the city is named after, if any. */
  namedAfterId?: number;
  buildings: Building[];
  ownershipHistory: CityOwnership[];
  tradeRouteIds: number[];
  wonderIds: number[];
  artworkIds: number[];
}
export interface TradeRoute {
  id: number;
  name: string;
  originCityId: number;
  destinationCityId: number;
  founderId: number;
  createdYear: number;
  gdpBonus: number;
  active: boolean;
}
export interface Artwork {
  id: number;
  name: string;
  year: number;
  rating: number;
  rarity: ArtworkRarity;
  type: ArtworkType;
  /** The patron character who commissioned the work. */
  patronId: number;
  cultureId: number;
  realmId: number;
  cityId: number;
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
  startTechnology: number;
  endTechnology?: number;
  startGDP: number;
  endGDP?: number;
  startPopulation: number;
  endPopulation?: number;
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

export interface Culture {
  id: number;
  name: string;
  color: string;
  population: number;
  founded: number;
  originRealmId: number;
  peacefulViolent: number;
  economicCreative: number;
  unstableStable: number;
  strength: number;
  heritage: string[];
  artworkIds: number[];
  provinces: number;
}
export interface Religion {
  id: number;
  name: string;
  color: string;
  followers: number;
  founded: number;
  founderId: number | null;
  holyProvinceIds: number[];
  doctrine: string;
  expansion: number;
  loyalty: number;
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
  peakGDP: number;
  peakPopulation: number;
  warsWon: number;
  wonderIds: number[];
  status: DynastyStatus;
  historicalRelevance: number;
}
export interface BattleSide {
  realmIds: number[];
  generalId: number | null;
  combatants: number;
  casualties: number;
  power: number;
}
export interface Battle {
  id: number;
  warId: number;
  name: string;
  year: number;
  provinceId: number;
  attacker: BattleSide;
  defender: BattleSide;
  winner: 'attacker' | 'defender';
  significance: number;
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
  battles: number;
  battleIds: number[];
  territoriesChanged: number;
  gdpTransferred: number;
  religionChanged: boolean;
  decisiveVictory: boolean;
  active: boolean;
}
export interface Wonder {
  id: number;
  name: string;
  category: WonderCategory;
  cityId: number;
  provinceId: number;
  realmId: number;
  builderId: number;
  startedYear: number;
  completedYear: number;
  status: 'standing' | 'damaged' | 'destroyed';
  effect: string;
  gdpBonus: number;
  armyBonus: number;
  scienceBonus: number;
  cultureBonus: number;
  religionBonus: number;
  historicalRelevance: number;
}
export interface NaturalWonder {
  id: number;
  name: string;
  provinceId: number;
  effect: string;
  gdpBonus: number;
  armyBonus: number;
  cultureBonus: number;
  prestigeBonus: number;
}
export interface Rivalry {
  id: number;
  realmIds: [number, number];
  startedYear: number;
  endedYear?: number;
  cause: 'border' | 'religion' | 'dynasty' | 'trade' | 'colonial' | 'cultural' | 'historical';
  warIds: number[];
  battleIds: number[];
  totalCasualties: number;
  provincesExchanged: number;
  intensity: number;
  status: 'active' | 'dormant' | 'resolved';
}

export interface RealmEventEffects {
  populationAnnualPct: number;
  gdpAnnualPct: number;
  technologyAnnual: number;
  armyAnnualPct: number;
  stabilityAnnual: number;
  cultureAnnual: number;
}
export interface RealmEvent {
  id: number;
  realmId: number;
  type: RealmEventType;
  severity: EventSeverity;
  startYear: number;
  endYear: number;
  duration: number;
  title: string;
  description: string;
  effects: RealmEventEffects;
  destroyedBuildings: string[];
  active: boolean;
}
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
  technologyIds: TechnologyId[];
  warIds: number[];
  battleIds: number[];
  religionIds: number[];
  cultureIds: number[];
  wonderIds: number[];
  dynastyIds: number[];
  tags: string[];
  worldChronicle: boolean;
}
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
  population: number;
  urbanPopulation: number;
  ruralPopulation: number;
  gdp: number;
  armySize: number;
  armyCapacity: number;
  technology: number;
  stability: number;
  prestige: number;
  provinces: number[];
  cityIds: number[];
  knownTechnologies: KnownTechnology[];
  technologyProgress: Record<string, number>;
  knownContinentIds: number[];
  knownRealmIds: number[];
  continentExposure: Record<string, number>;
  technologyExposure: Record<string, number>;
  /** Character ids of the ruler, heir and regent (0 when none). */
  rulerId: number;
  heirId: number;
  regentId: number;
  dynastyId: number | null;
  historyEventIds: number[];
  warIds: number[];
  rivalryIds: number[];
  historicalScore: number;
  legacyScore: number;
  governmentHistory: { government: GovernmentType; from: number; to?: number; reason: string }[];
  nameHistory: { name: string; rank: Rank; from: number; reason: string }[];
}
export interface WorldConfig {
  mapSize: MapSize;
  mapVariant: number;
  tribeCount: number;
  name: string;
  nameMode: NameMode;
}
export interface HallOfFameEntry {
  id: number;
  category: 'realm' | 'city' | 'character' | 'battle';
  entityId: number;
  name: string;
  year: number;
  score: number;
  subtitle: string;
  periodKey: string;
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
  battles: Battle[];
  artworks: Artwork[];
  wonders: Wonder[];
  naturalWonders: NaturalWonder[];
  rivalries: Rivalry[];
  events: HistoryEvent[];
  realmEvents: RealmEvent[];
  evolutionSnapshots: EvolutionSnapshot[];
  hallOfFame: HallOfFameEntry[];
  usedHistoricalNames: string[];
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
    battle: number;
    artwork: number;
    wonder: number;
    naturalWonder: number;
    rivalry: number;
    realmEvent: number;
    hallOfFame: number;
  };
}
export interface EvolutionRealmSnapshot {
  realmId: number;
  name: string;
  color: string;
  rank: Rank;
  continentId: number;
  greatPower: number;
  population: number;
  gdp: number;
  technology: number;
  military: number;
}
export interface EvolutionSnapshot {
  year: number;
  realms: EvolutionRealmSnapshot[];
  worldPopulation: number;
  worldGDP: number;
  averageTechnology: number;
}
export interface SaveSlot {
  slot: number;
  updatedAt: number;
  world: WorldState | null;
}
