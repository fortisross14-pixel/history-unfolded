export type Rank = 'Tribe' | 'Settlement' | 'City-State' | 'Duchy' | 'Kingdom' | 'Empire';
export type Terrain = 'ocean' | 'plains' | 'forest' | 'desert' | 'mountain' | 'tundra';
export type EventCategory = 'military' | 'economy' | 'diplomacy' | 'religion' | 'culture' | 'technology' | 'great-person' | 'society' | 'world';
export type PersonRole = 'Scientist' | 'Engineer' | 'Merchant' | 'Religious Figure' | 'General' | 'Artist';
export type MapSize = 'small' | 'medium' | 'large';
export type GovernmentType = 'Tribal Council' | 'Chiefdom' | 'Open Monarchy' | 'Authoritarian Monarchy' | 'Oligarchy' | 'Duchy' | 'Monarchy' | 'Imperial Court' | 'Republic' | 'Democracy' | 'Theocracy' | 'Military Junta';
export type ArtworkType = 'Oral Tradition' | 'Book / Writing' | 'Painting' | 'Building' | 'Sculpture' | 'Artifact' | 'Song';
export type ArtworkRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
export type TechnologyId = 'agriculture' | 'writing' | 'money' | 'bronze' | 'iron' | 'deep_sailing' | 'printing' | 'gunpowder' | 'steam_power' | 'flight';

export interface Province {
  id:number; x:number; y:number; terrain:Terrain; continent:number; fertility:number;
  ownerId:number|null; population:number; cultureId:number|null; religionId:number|null;
}
export interface TechnologyDefinition {
  id:TechnologyId; name:string; earliestYear:number; field:'economy'|'culture'|'military'|'exploration'|'technology';
  description:string; effect:string;
}
export interface KnownTechnology { technologyId:TechnologyId; discoveredYear:number; source:'scientist'|'diffusion'|'founding'; sourcePersonId?:number; sourceRealmId?:number; }
export interface TechnologyContact { technologyId:TechnologyId; realmId:number; years:number; }
export interface Artwork { id:number; name:string; year:number; rating:number; rarity:ArtworkRarity; type:ArtworkType; artistId:number; cultureId:number; realmId:number; }
export interface GreatPerson {
  id:number; name:string; role:PersonRole; born:number; died?:number; realmId:number; cultureId:number|null; religionId:number|null;
  stars:1|2|3|4|5; historicalRelevance:number; impact:number; trait:string; achievement:string; active:boolean;
  technologyPoints:number; technologiesRevealed:TechnologyId[]; battlesWon:number; battlesLost:number; wealthCreated:number;
  followersGained:number; artworks:number[];
}
export interface RulerRecord {
  id:number; name:string; realmId:number; born:number; reignStart:number; reignEnd?:number; government:GovernmentType;
  administration:number; military:number; diplomacy:number; trait:string;
  startProvinces:number; endProvinces?:number; startTechnology:number; endTechnology?:number;
  startGDP:number; endGDP?:number; startPopulation:number; endPopulation?:number; historicalRelevance:number;
}
export interface Religion {
  id:number; name:string; founderPersonId:number|null; founder:string; founded:number; followers:number; color:string;
  holySites:string[]; doctrine:string; expansion:number; loyalty:number; tolerance:number; parentReligionId?:number;
  schisms:number[]; provinces:number;
}
export interface Culture {
  id:number; name:string; founded:number; population:number; color:string; provinces:number; heritage:string[];
  originRealmId:number; strength:number; artworks:number[]; peacefulViolent:number; economicCreative:number; unstableStable:number;
}
export interface BattleSide { realmIds:number[]; generalId:number|null; combatants:number; casualties:number; power:number; }
export interface Battle { id:number; warId:number; name:string; year:number; provinceId:number; attacker:BattleSide; defender:BattleSide; winner:'attacker'|'defender'; significance:number; }
export interface War {
  id:number; name:string; startYear:number; endYear?:number; attackerIds:number[]; defenderIds:number[]; participantIds:number[];
  winnerIds:number[]; loserIds:number[]; attackerLosses:number; defenderLosses:number; battles:number; battleIds:number[]; territoriesChanged:number; active:boolean;
}
export interface NameEra { name:string; rank:Rank; from:number; reason:string; }
export interface Civilization {
  id:number; name:string; adjective:string; color:string; rank:Rank; founded:number; government:GovernmentType;
  originTribe:string; capital:string; cultureId:number; rulerId:number; population:number; gdp:number; military:number;
  armySize:number; technology:number; stability:number; prestige:number; faithId:number|null; allies:number[]; rivals:number[];
  provinces:number[]; history:number[]; nameHistory:NameEra[]; absorbedCultures:number[]; predecessorIds:number[]; parentEmpireId?:number;
  peakPopulation:number; peakProvinces:number; warsWon:number; warsLost:number; knownTechnologies:KnownTechnology[];
  technologyContacts:TechnologyContact[]; warIds:number[];
}
export interface HistoryEvent {
  id:number; year:number; category:EventCategory; title:string; description:string; importance:number; civIds:number[];
  personIds?:number[]; religionIds?:number[]; cultureIds?:number[]; warIds?:number[]; technologyIds?:TechnologyId[]; tags:string[];
}
export interface WorldConfig { mapSize:MapSize; mapVariant:number; tribeCount:number; name:string; }
export interface WorldState {
  seed:number; year:number; config:WorldConfig; width:number; height:number; provinces:Province[]; civilizations:Civilization[];
  religions:Religion[]; cultures:Culture[]; people:GreatPerson[]; rulers:RulerRecord[]; wars:War[]; battles:Battle[]; artworks:Artwork[];
  events:HistoryEvent[]; nextEventId:number; nextPersonId:number; nextReligionId:number; nextCultureId:number;
  nextCivilizationId:number; nextRulerId:number; nextWarId:number; nextBattleId:number; nextArtworkId:number;
}
export interface SaveSlot { slot:number; updatedAt:number; world:WorldState|null; }
