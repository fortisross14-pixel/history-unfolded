/**
 * Rulers. Every great people is led by a ruler with a major strength and a minor one. The
 * historical rulers come with their nation's name, banner colour and city names; a player may lead
 * one of them or make a ruler of their own (name, face, the two strengths, and either a nation's
 * banner and names or invented ones).
 *
 * A strength (trait) has a major form and a weaker minor form. Most are bonuses the rest of the
 * game already knows (mods); four are new: extra moves, ignoring terrain, and free research or
 * culture on entering each age.
 */
import type { Mods } from './mods.ts';
import type { PersonalityId } from './leaders.ts';

export type TraitId =
  | 'swift'
  | 'pathfinder'
  | 'warlord'
  | 'drillmaster'
  | 'defender'
  | 'admiral'
  | 'scholar'
  | 'sage'
  | 'patron'
  | 'visionary'
  | 'merchant'
  | 'farmer'
  | 'builder';

export interface Trait {
  id: TraitId;
  name: string;
  /** the area, for grouping in the picker */
  area: 'military' | 'research' | 'culture' | 'money' | 'growth' | 'production';
  major: Partial<Mods>;
  minor: Partial<Mods>;
}

export const TRAITS: Record<TraitId, Trait> = {
  swift: {
    id: 'swift',
    name: 'Swift armies',
    area: 'military',
    major: { moves: 1 },
    minor: { roadCost: -0.2, sight: 1 },
  },
  pathfinder: {
    id: 'pathfinder',
    name: 'Pathfinder',
    area: 'military',
    major: { ignoreTerrain: 1 },
    minor: { roughPct: 20 },
  },
  warlord: {
    id: 'warlord',
    name: 'Warlord',
    area: 'military',
    major: { attackPct: 15, morale: 10 },
    minor: { attackPct: 7 },
  },
  drillmaster: {
    id: 'drillmaster',
    name: 'Drillmaster',
    area: 'military',
    major: { upkeepPct: -35, refitPct: -20 },
    minor: { upkeepPct: -15 },
  },
  defender: {
    id: 'defender',
    name: 'Defender',
    area: 'military',
    major: { cityDefensePct: 30, homePct: 10 },
    minor: { cityDefensePct: 12 },
  },
  admiral: {
    id: 'admiral',
    name: 'Admiral',
    area: 'military',
    major: { navalPct: 25, coastalPct: 10 },
    minor: { navalPct: 10 },
  },
  scholar: {
    id: 'scholar',
    name: 'Scholar',
    area: 'research',
    major: { sciencePct: 25 },
    minor: { sciencePct: 10 },
  },
  sage: {
    id: 'sage',
    name: 'Sage',
    area: 'research',
    major: { freeTechs: 2 },
    minor: { freeTechs: 1 },
  },
  patron: {
    id: 'patron',
    name: 'Patron of the arts',
    area: 'culture',
    major: { culturePct: 25 },
    minor: { culturePct: 10 },
  },
  visionary: {
    id: 'visionary',
    name: 'Visionary',
    area: 'culture',
    major: { freeCulture: 2 },
    minor: { freeCulture: 1 },
  },
  merchant: {
    id: 'merchant',
    name: 'Merchant',
    area: 'money',
    major: { goldPct: 25 },
    minor: { goldPct: 10 },
  },
  farmer: {
    id: 'farmer',
    name: 'Provider',
    area: 'growth',
    major: { foodPct: 15, growthPct: -15 },
    minor: { foodPct: 7 },
  },
  builder: {
    id: 'builder',
    name: 'Builder',
    area: 'production',
    major: { prodPct: 20 },
    minor: { prodPct: 8 },
  },
};
export const TRAIT_LIST = Object.values(TRAITS);

export interface Ruler {
  id: string;
  name: string;
  /** the nation they lead */
  nation: string;
  color: string;
  /** portrait key in the art manifest */
  face: string;
  major: TraitId;
  minor: TraitId;
  /** how they behave as a rival */
  personality: PersonalityId;
  cities: string[];
}

export const RULERS: Ruler[] = [
  {
    id: 'cleopatra',
    name: 'Cleopatra',
    nation: 'Egyptians',
    color: '#c78a1e',
    face: 'leader/ancient-1',
    major: 'farmer',
    minor: 'merchant',
    personality: 'diplomat',
    cities: [
      'Alexandria',
      'Memphis',
      'Thebes',
      'Heliopolis',
      'Abydos',
      'Elephantine',
      'Bubastis',
      'Sais',
      'Edfu',
      'Dendera',
      'Tanis',
      'Faiyum',
    ],
  },
  {
    id: 'hammurabi',
    name: 'Hammurabi',
    nation: 'Babylonians',
    color: '#3a7fc4',
    face: 'leader/ancient-2',
    major: 'builder',
    minor: 'scholar',
    personality: 'builder',
    cities: [
      'Babylon',
      'Ur',
      'Uruk',
      'Lagash',
      'Kish',
      'Nippur',
      'Eridu',
      'Sippar',
      'Larsa',
      'Isin',
      'Borsippa',
      'Mari',
    ],
  },
  {
    id: 'moctezuma',
    name: 'Moctezuma',
    nation: 'Aztecs',
    color: '#2f8a3c',
    face: 'leader/ancient-3',
    major: 'warlord',
    minor: 'farmer',
    personality: 'zealot',
    cities: [
      'Tenochtitlan',
      'Texcoco',
      'Tlacopan',
      'Tlatelolco',
      'Xochimilco',
      'Chalco',
      'Coyoacan',
      'Cholula',
      'Tula',
      'Azcapotzalco',
      'Culhuacan',
      'Malinalco',
    ],
  },
  {
    id: 'qin-shi-huang',
    name: 'Qin Shi Huang',
    nation: 'Qin',
    color: '#5a5a5a',
    face: 'leader/ancient-4',
    major: 'defender',
    minor: 'builder',
    personality: 'builder',
    cities: [
      'Xianyang',
      'Yong',
      'Handan',
      'Linzi',
      'Ying',
      'Daliang',
      'Ji',
      'Xinzheng',
      'Chengdu',
      'Langya',
      'Yueyang',
      'Wancheng',
    ],
  },
  {
    id: 'alexander',
    name: 'Alexander the Great',
    nation: 'Macedonians',
    color: '#2a5fb0',
    face: 'leader/classical-1',
    major: 'swift',
    minor: 'warlord',
    personality: 'conqueror',
    cities: [
      'Pella',
      'Aigai',
      'Amphipolis',
      'Thessalonica',
      'Dion',
      'Philippi',
      'Pydna',
      'Edessa',
      'Beroea',
      'Stobi',
      'Heraclea',
      'Olynthus',
    ],
  },
  {
    id: 'caesar',
    name: 'Julius Caesar',
    nation: 'Romans',
    color: '#b0302a',
    face: 'leader/classical-2',
    major: 'drillmaster',
    minor: 'warlord',
    personality: 'conqueror',
    cities: [
      'Roma',
      'Antium',
      'Cumae',
      'Neapolis',
      'Ravenna',
      'Arretium',
      'Mediolanum',
      'Capua',
      'Ostia',
      'Brundisium',
      'Verona',
      'Aquileia',
    ],
  },
  {
    id: 'ashoka',
    name: 'Ashoka',
    nation: 'Mauryans',
    color: '#d0612a',
    face: 'leader/classical-3',
    major: 'visionary',
    minor: 'farmer',
    personality: 'diplomat',
    cities: [
      'Pataliputra',
      'Ujjain',
      'Taxila',
      'Vidisha',
      'Kaushambi',
      'Sanchi',
      'Mathura',
      'Varanasi',
      'Tosali',
      'Suvarnagiri',
      'Sravasti',
      'Rajagriha',
    ],
  },
  {
    id: 'wu-zetian',
    name: 'Wu Zetian',
    nation: 'Tang',
    color: '#c2507a',
    face: 'leader/classical-4',
    major: 'scholar',
    minor: 'merchant',
    personality: 'opportunist',
    cities: [
      "Chang'an",
      'Luoyang',
      'Yangzhou',
      'Guangzhou',
      'Taiyuan',
      'Kaifeng',
      'Suzhou',
      'Hangzhou',
      'Jiangling',
      'Youzhou',
      'Liangzhou',
      'Dunhuang',
    ],
  },
  {
    id: 'charlemagne',
    name: 'Charlemagne',
    nation: 'Franks',
    color: '#4b3f9a',
    face: 'leader/medieval-1',
    major: 'sage',
    minor: 'warlord',
    personality: 'zealot',
    cities: [
      'Aachen',
      'Paderborn',
      'Ingelheim',
      'Nijmegen',
      'Metz',
      'Reims',
      'Tours',
      'Soissons',
      'Worms',
      'Regensburg',
      'Laon',
      'Orleans',
    ],
  },
  {
    id: 'theodora',
    name: 'Theodora',
    nation: 'Byzantines',
    color: '#7a3ea0',
    face: 'leader/medieval-2',
    major: 'patron',
    minor: 'defender',
    personality: 'opportunist',
    cities: [
      'Constantinople',
      'Nicaea',
      'Trebizond',
      'Thessalonica',
      'Smyrna',
      'Ephesus',
      'Antioch',
      'Nicomedia',
      'Mystras',
      'Adrianople',
      'Philadelphia',
      'Chalcedon',
    ],
  },
  {
    id: 'saladin',
    name: 'Saladin',
    nation: 'Ayyubids',
    color: '#3f6f2a',
    face: 'leader/medieval-3',
    major: 'warlord',
    minor: 'patron',
    personality: 'zealot',
    cities: [
      'Cairo',
      'Damascus',
      'Aleppo',
      'Homs',
      'Hama',
      'Mosul',
      'Karak',
      'Ascalon',
      'Baalbek',
      'Edessa',
      'Tikrit',
      'Aswan',
    ],
  },
  {
    id: 'genghis-khan',
    name: 'Genghis Khan',
    nation: 'Mongols',
    color: '#a6752f',
    face: 'leader/medieval-4',
    major: 'pathfinder',
    minor: 'swift',
    personality: 'conqueror',
    cities: [
      'Karakorum',
      'Avarga',
      'Khanbaliq',
      'Sarai',
      'Almalik',
      'Kharkhorin',
      'Beshbalik',
      'Otrar',
      'Bukhara',
      'Samarkand',
      'Tabriz',
      'Kashgar',
    ],
  },
  {
    id: 'lorenzo',
    name: 'Lorenzo de’ Medici',
    nation: 'Florentines',
    color: '#8f2f5e',
    face: 'leader/renaissance-1',
    major: 'merchant',
    minor: 'patron',
    personality: 'merchant',
    cities: [
      'Firenze',
      'Pisa',
      'Arezzo',
      'Prato',
      'Pistoia',
      'Livorno',
      'Volterra',
      'Cortona',
      'Empoli',
      'Fiesole',
      'Montepulciano',
      'San Gimignano',
    ],
  },
  {
    id: 'elizabeth',
    name: 'Elizabeth I',
    nation: 'English',
    color: '#8aa02a',
    face: 'leader/renaissance-2',
    major: 'admiral',
    minor: 'merchant',
    personality: 'merchant',
    cities: [
      'London',
      'York',
      'Bristol',
      'Plymouth',
      'Norwich',
      'Oxford',
      'Canterbury',
      'Winchester',
      'Exeter',
      'Lincoln',
      'Coventry',
      'Southampton',
    ],
  },
  {
    id: 'suleiman',
    name: 'Suleiman',
    nation: 'Ottomans',
    color: '#1f8f8f',
    face: 'leader/renaissance-3',
    major: 'builder',
    minor: 'defender',
    personality: 'opportunist',
    cities: [
      'Istanbul',
      'Bursa',
      'Edirne',
      'Konya',
      'Izmir',
      'Ankara',
      'Sivas',
      'Trabzon',
      'Antalya',
      'Kayseri',
      'Manisa',
      'Amasya',
    ],
  },
  {
    id: 'louis',
    name: 'Louis XIV',
    nation: 'French',
    color: '#3a5fa0',
    face: 'leader/renaissance-4',
    major: 'patron',
    minor: 'builder',
    personality: 'builder',
    cities: [
      'Paris',
      'Versailles',
      'Lyon',
      'Marseille',
      'Bordeaux',
      'Toulouse',
      'Rouen',
      'Nantes',
      'Lille',
      'Strasbourg',
      'Dijon',
      'Rennes',
    ],
  },
  {
    id: 'lincoln',
    name: 'Abraham Lincoln',
    nation: 'Americans',
    color: '#6b4a24',
    face: 'leader/industrial-1',
    major: 'scholar',
    minor: 'farmer',
    personality: 'diplomat',
    cities: [
      'Washington',
      'Philadelphia',
      'Boston',
      'New York',
      'Springfield',
      'Chicago',
      'Baltimore',
      'Richmond',
      'Cincinnati',
      'Pittsburgh',
      'Saint Louis',
      'Albany',
    ],
  },
  {
    id: 'bismarck',
    name: 'Otto von Bismarck',
    nation: 'Germans',
    color: '#3b3a36',
    face: 'leader/industrial-2',
    major: 'drillmaster',
    minor: 'sage',
    personality: 'opportunist',
    cities: [
      'Berlin',
      'Hamburg',
      'Munich',
      'Cologne',
      'Frankfurt',
      'Dresden',
      'Leipzig',
      'Hanover',
      'Stuttgart',
      'Bremen',
      'Nuremberg',
      'Königsberg',
    ],
  },
  {
    id: 'meiji',
    name: 'Emperor Meiji',
    nation: 'Japanese',
    color: '#a83a3a',
    face: 'leader/industrial-3',
    major: 'sage',
    minor: 'admiral',
    personality: 'builder',
    cities: [
      'Tokyo',
      'Kyoto',
      'Osaka',
      'Nagoya',
      'Yokohama',
      'Kobe',
      'Sendai',
      'Nagasaki',
      'Hiroshima',
      'Kanazawa',
      'Sapporo',
      'Kagoshima',
    ],
  },
];
export const RULER_BY_ID: Record<string, Ruler> = Object.fromEntries(RULERS.map(r => [r.id, r]));

/** Faces for a ruler of one's own (art/map-7-faces). */
export const FACES = Array.from({ length: 12 }, (_, i) => `face/${i + 1}`);

/** The ruler a people has, as stored on it: a historical one or a player's own. */
export interface RulerChoice {
  /** a historical ruler's id; absent for a ruler of one's own */
  id?: string;
  name: string;
  face: string;
  major: TraitId;
  minor: TraitId;
}

/** The mods a ruler gives: the major strength in full and the minor one's weaker form. */
export function rulerMods(r: Pick<RulerChoice, 'major' | 'minor'>): Partial<Mods>[] {
  return [TRAITS[r.major]?.major ?? {}, TRAITS[r.minor]?.minor ?? {}];
}
