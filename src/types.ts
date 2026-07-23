export type Rank = 'Tribe' | 'Settlement' | 'City-State' | 'Duchy' | 'Kingdom' | 'Empire';
export type Terrain = 'ocean' | 'plains' | 'forest' | 'desert' | 'mountain' | 'tundra';
export type EventCategory = 'military' | 'economy' | 'diplomacy' | 'religion' | 'culture' | 'technology' | 'society' | 'world';
export type PersonRole = 'Scientist' | 'Engineer' | 'Merchant' | 'Religious Figure' | 'General' | 'Artist';
export type MapSize = 'small' | 'medium' | 'large';

export interface Province {
  id: number; x: number; y: number; terrain: Terrain; fertility: number;
  ownerId: number | null; population: number; cultureId: number | null; religionId: number | null;
}
export interface GreatPerson {
  id: number; name: string; role: PersonRole; born: number; died?: number;
  realmId: number; cultureId: number | null; religionId: number | null;
  stars: 1|2|3|4|5; historicalRelevance: number; impact: number;
  trait: string; achievement: string; active: boolean;
}
export interface RulerRecord {
  id: number; name: string; realmId: number; born: number; reignStart: number; reignEnd?: number;
  administration: number; military: number; diplomacy: number; trait: string;
  startProvinces: number; endProvinces?: number; startTechnology: number; endTechnology?: number;
  startGDP: number; endGDP?: number; startPopulation: number; endPopulation?: number;
  historicalRelevance: number;
}
export interface Religion {
  id: number; name: string; founderPersonId: number | null; founder: string; founded: number;
  followers: number; color: string; holySites: string[]; doctrine: string;
}
export interface Culture {
  id: number; name: string; founded: number; population: number; color: string;
  provinces: number; heritage: string[]; originRealmId: number;
}
export interface NameEra { name: string; rank: Rank; from: number; reason: string; }
export interface Civilization {
  id: number; name: string; adjective: string; color: string; rank: Rank; founded: number;
  originTribe: string; capital: string; cultureId: number; rulerId: number;
  population: number; gdp: number; military: number; armySize: number; technology: number;
  stability: number; prestige: number; faithId: number | null; allies: number[]; rivals: number[];
  provinces: number[]; history: number[]; nameHistory: NameEra[]; absorbedCultures: number[];
  predecessorIds: number[]; parentEmpireId?: number; goldenAge?: {start:number;end?:number};
  peakPopulation: number; peakProvinces: number; warsWon: number; warsLost: number;
}
export interface HistoryEvent {
  id: number; year: number; category: EventCategory; title: string; description: string;
  importance: number; civIds: number[]; personIds?: number[]; religionIds?: number[]; cultureIds?: number[];
}
export interface WorldConfig { mapSize: MapSize; mapVariant: number; tribeCount: number; name: string; }
export interface WorldState {
  seed: number; year: number; config: WorldConfig; width: number; height: number;
  provinces: Province[]; civilizations: Civilization[]; religions: Religion[]; cultures: Culture[];
  people: GreatPerson[]; rulers: RulerRecord[]; events: HistoryEvent[];
  nextEventId: number; nextPersonId: number; nextReligionId: number; nextCultureId: number;
  nextCivilizationId: number; nextRulerId: number;
}
export interface SaveSlot { slot: number; updatedAt: number; world: WorldState | null; }
