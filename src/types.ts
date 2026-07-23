export type Rank = 'Tribe' | 'Settlement' | 'City-State' | 'Duchy' | 'Kingdom' | 'Empire';
export type Terrain = 'ocean' | 'plains' | 'forest' | 'desert' | 'mountain' | 'tundra';
export type EventCategory = 'military' | 'economy' | 'diplomacy' | 'religion' | 'culture' | 'technology' | 'society' | 'world';

export interface Province {
  id: number;
  x: number;
  y: number;
  terrain: Terrain;
  fertility: number;
  ownerId: number | null;
  population: number;
}

export interface GreatPerson {
  id: number;
  name: string;
  role: 'Ruler' | 'General' | 'Prophet' | 'Scholar' | 'Artist' | 'Merchant' | 'Explorer' | 'Statesman';
  trait: string;
  born: number;
  died?: number;
  fame: number;
  achievement: string;
}

export interface Religion {
  id: number;
  name: string;
  founder: string;
  founded: number;
  followers: number;
  color: string;
  holyCity: string;
}

export interface NameEra {
  name: string;
  rank: Rank;
  from: number;
  reason: string;
}

export interface Civilization {
  id: number;
  name: string;
  adjective: string;
  color: string;
  rank: Rank;
  founded: number;
  originTribe: string;
  capital: string;
  culture: string;
  ruler: GreatPerson;
  population: number;
  economy: number;
  military: number;
  technology: number;
  stability: number;
  prestige: number;
  faithId: number | null;
  allies: number[];
  rivals: number[];
  provinces: number[];
  history: number[];
  nameHistory: NameEra[];
  absorbedCultures: string[];
  predecessorIds: number[];
  parentEmpireId?: number;
  goldenAge?: { start: number; end?: number };
  peakPopulation: number;
  peakProvinces: number;
  warsWon: number;
  warsLost: number;
}

export interface HistoryEvent {
  id: number;
  year: number;
  category: EventCategory;
  title: string;
  description: string;
  importance: number;
  civIds: number[];
}

export interface WorldState {
  seed: number;
  year: number;
  provinces: Province[];
  civilizations: Civilization[];
  religions: Religion[];
  events: HistoryEvent[];
  nextEventId: number;
  nextPersonId: number;
  nextReligionId: number;
  nextCivilizationId: number;
}
