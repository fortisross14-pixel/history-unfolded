import type {
  BreakthroughId,
  Civilization,
  GovernmentType,
  Religion,
  WorldConfig,
  WorldState,
} from '../types.ts';
import { RNG } from './rng.ts';
import { neigh } from './util.ts';
import { earthMap, LANDMASS, lonLat } from './earth.ts';
import { emptyWorld, foundRealm } from './world.ts';
import { learn } from './research.ts';
import { createCity, rankFor } from './realms.ts';
import { armyCapacity, developmentCap, navyCapacity, realmOutput } from './economy.ts';
import { realmModifiers } from './modifiers.ts';
import { captureEvolutionSnapshot } from './records.ts';
import { rebuildIndex } from './lookup.ts';
import { updatePower } from './power.ts';

/** [longitude, latitude, provinces, city name] for one part of a realm. */
type Seed = [number, number, number, string?];

interface RealmData {
  name: string;
  culture: string;
  religion?: string;
  color: string;
  /** Ambition, Horizon, Economy, Faith, Order (0–100); random when left out. */
  axes?: [number, number, number, number, number];
  seeds: Seed[];
  government?: GovernmentType;
  dynasty?: string;
  /** Which breakthrough list the realm starts with (default "civ"). */
  tier?: 'tribe' | 'civ' | 'advanced';
}

interface ReligionData {
  name: string;
  color: string;
  tolerance: number;
  expansion: number;
  doctrine: string;
}

export interface Scenario {
  year: number;
  label: string;
  religions: ReligionData[];
  tiers: Record<'tribe' | 'civ' | 'advanced', BreakthroughId[]>;
  realms: RealmData[];
}

const BRONZE: BreakthroughId[] = ['agriculture', 'bronze', 'writing'];
const CLASSICAL: BreakthroughId[] = [...BRONZE, 'iron', 'money', 'philosophy'];
const MEDIEVAL: BreakthroughId[] = [...CLASSICAL, 'astronomy', 'gunpowder'];

// ---- 3000 BCE: the first states among the tribes ---------------------------------

const BCE3000: Scenario = {
  year: -3000,
  label: '3000 BCE · The first cities',
  religions: [
    {
      name: 'Egyptian Religion',
      color: '#e0b84c',
      tolerance: 45,
      expansion: 45,
      doctrine: 'Maat, the cosmic order kept by the king',
    },
    {
      name: 'Mesopotamian Religion',
      color: '#b0703c',
      tolerance: 50,
      expansion: 50,
      doctrine: 'Gods of the city, served in great temples',
    },
  ],
  tiers: {
    tribe: ['agriculture'],
    civ: ['agriculture', 'writing'],
    advanced: ['agriculture', 'writing', 'bronze'],
  },
  realms: [
    {
      name: 'Egypt',
      culture: 'Egyptian',
      religion: 'Egyptian Religion',
      color: '#e6c35c',
      axes: [45, 35, 35, 20, 22],
      seeds: [[31.2, 29.9, 5, 'Memphis']],
      government: 'Monarchy',
      dynasty: 'Narmer',
      tier: 'advanced',
    },
    {
      name: 'Sumer',
      culture: 'Sumerian',
      religion: 'Mesopotamian Religion',
      color: '#c4783d',
      axes: [55, 40, 60, 35, 72],
      seeds: [[45.6, 31.3, 4, 'Uruk']],
      government: 'Monarchy',
      tier: 'advanced',
    },
    {
      name: 'Elam',
      culture: 'Elamite',
      religion: 'Mesopotamian Religion',
      color: '#8e5a9e',
      axes: [55, 25, 45, 40, 50],
      seeds: [[48.3, 32.2, 3, 'Susa']],
      tier: 'civ',
    },
    {
      name: 'Harappa',
      culture: 'Harappan',
      color: '#c7a26b',
      axes: [30, 45, 68, 55, 45],
      seeds: [[68.1, 27.3, 5, 'Mohenjo-daro']],
      tier: 'civ',
    },
    {
      name: 'Longshan',
      culture: 'Huaxia',
      color: '#d9534f',
      axes: [40, 25, 35, 50, 30],
      seeds: [[111.5, 35.9, 5, 'Taosi']],
      tier: 'civ',
    },
    {
      name: 'Liangzhu',
      culture: 'Liangzhu',
      color: '#5fa36a',
      axes: [35, 55, 45, 45, 50],
      seeds: [[120, 30.4, 3, 'Liangzhu']],
      tier: 'civ',
    },
    {
      name: 'Minoan Crete',
      culture: 'Minoan',
      color: '#4ea8de',
      axes: [35, 85, 75, 55, 55],
      seeds: [[24.5, 36.5, 2, 'Knossos']],
      tier: 'civ',
    },
    {
      name: 'Yamnaya',
      culture: 'Proto-Indo-European',
      color: '#9b8b5e',
      axes: [80, 12, 25, 50, 75],
      seeds: [[40, 48, 4]],
      tier: 'tribe',
    },
    {
      name: 'Botai',
      culture: 'Botai',
      color: '#b5a37a',
      axes: [65, 10, 25, 50, 80],
      seeds: [[69, 53, 3]],
      tier: 'tribe',
    },
    {
      name: 'Afanasievo',
      culture: 'Afanasievo',
      color: '#a68f6d',
      axes: [70, 10, 25, 50, 75],
      seeds: [[88, 51, 2]],
      tier: 'tribe',
    },
    {
      name: 'Hattians',
      culture: 'Hattian',
      color: '#8f6b4a',
      axes: [50, 30, 45, 45, 55],
      seeds: [[34, 40, 3]],
      tier: 'civ',
    },
    {
      name: 'Canaan',
      culture: 'Canaanite',
      color: '#6b8fb0',
      axes: [40, 70, 70, 50, 70],
      seeds: [[36, 33.5, 2, 'Byblos']],
      tier: 'civ',
    },
    {
      name: 'Nubia',
      culture: 'Nubian',
      color: '#7a5230',
      axes: [50, 25, 45, 40, 55],
      seeds: [[32.5, 21, 2, 'Kerma']],
      tier: 'tribe',
    },
    {
      name: 'Namazga',
      culture: 'Namazga',
      color: '#b39a5f',
      axes: [45, 15, 50, 50, 55],
      seeds: [[58, 38, 2]],
      tier: 'tribe',
    },
    {
      name: 'Corded Ware',
      culture: 'Corded Ware',
      color: '#7d9b5a',
      axes: [70, 25, 30, 50, 75],
      seeds: [[15, 51, 3]],
      tier: 'tribe',
    },
    {
      name: 'Wessex',
      culture: 'Neolithic Briton',
      color: '#5b8c7a',
      axes: [40, 60, 30, 35, 60],
      seeds: [[-1.8, 51.2, 2, 'Stonehenge']],
      tier: 'tribe',
    },
    {
      name: 'Los Millares',
      culture: 'Iberian',
      color: '#c9a23f',
      axes: [45, 55, 40, 45, 60],
      seeds: [[-2.5, 37.5, 2]],
      tier: 'tribe',
    },
    {
      name: 'Saharan Herders',
      culture: 'Saharan',
      color: '#d4b483',
      axes: [55, 5, 25, 50, 75],
      seeds: [[13, 25, 2]],
      tier: 'tribe',
    },
    {
      name: 'Proto-Bantu',
      culture: 'Bantu',
      color: '#5e8c3e',
      axes: [70, 15, 30, 50, 70],
      seeds: [[11, 6, 3]],
      tier: 'tribe',
    },
    {
      name: 'Cushites',
      culture: 'Cushitic',
      color: '#8c6d3e',
      axes: [50, 25, 30, 45, 65],
      seeds: [[39, 9, 2]],
      tier: 'tribe',
    },
    {
      name: 'Ban Chiang',
      culture: 'Austroasiatic',
      color: '#4f9a8f',
      axes: [40, 35, 45, 55, 60],
      seeds: [[103, 17.4, 2]],
      tier: 'tribe',
    },
    {
      name: 'Jomon',
      culture: 'Jomon',
      color: '#e07a5f',
      axes: [30, 75, 30, 55, 65],
      seeds: [[138, 36, 2]],
      tier: 'tribe',
    },
    {
      name: 'Austronesians',
      culture: 'Austronesian',
      color: '#3fa7a0',
      axes: [60, 90, 45, 50, 65],
      seeds: [[121, 15, 2]],
      tier: 'tribe',
    },
    {
      name: 'Papuans',
      culture: 'Papuan',
      color: '#6c8f3a',
      axes: [40, 40, 30, 50, 80],
      seeds: [[145, -6, 2]],
      tier: 'tribe',
    },
    {
      name: 'Pama-Nyungan',
      culture: 'Aboriginal',
      color: '#c06a3e',
      axes: [25, 30, 20, 50, 80],
      seeds: [[133, -25, 3]],
      tier: 'tribe',
    },
    {
      name: 'Caral',
      culture: 'Norte Chico',
      color: '#d98c5f',
      axes: [40, 55, 45, 40, 45],
      seeds: [[-77.6, -10.9, 2, 'Caral']],
      tier: 'civ',
    },
    {
      name: 'Amazonian Peoples',
      culture: 'Amazonian',
      color: '#4c8f4c',
      axes: [35, 30, 30, 50, 80],
      seeds: [[-60, -3, 3]],
      tier: 'tribe',
    },
    {
      name: 'Gulf Peoples',
      culture: 'Proto-Olmec',
      color: '#a64d79',
      axes: [45, 45, 40, 40, 60],
      seeds: [[-94, 18, 2]],
      tier: 'tribe',
    },
    {
      name: 'Mound Builders',
      culture: 'Woodland',
      color: '#8d7a4f',
      axes: [40, 20, 35, 45, 70],
      seeds: [[-90, 33, 3]],
      tier: 'tribe',
    },
    {
      name: 'Plains Peoples',
      culture: 'Plains',
      color: '#b07d48',
      axes: [55, 10, 25, 50, 80],
      seeds: [[-100, 42, 3]],
      tier: 'tribe',
    },
    {
      name: 'Saqqaq',
      culture: 'Paleo-Eskimo',
      color: '#9fb8c8',
      axes: [30, 70, 20, 50, 80],
      seeds: [[-52, 68, 1]],
      tier: 'tribe',
    },
  ],
};

// ---- 1 CE: the classical empires ----------------------------------------------------

const CE1: Scenario = {
  year: 1,
  label: '1 CE · Rome, Parthia and Han',
  religions: [
    {
      name: 'Roman Paganism',
      color: '#c9a227',
      tolerance: 65,
      expansion: 45,
      doctrine: 'The gods of Rome and the genius of the emperor',
    },
    {
      name: 'Zoroastrianism',
      color: '#e8743b',
      tolerance: 40,
      expansion: 45,
      doctrine: 'The good mind of Ahura Mazda against the lie',
    },
    {
      name: 'Judaism',
      color: '#4a7fc1',
      tolerance: 35,
      expansion: 25,
      doctrine: 'One God and his covenant',
    },
    {
      name: 'Buddhism',
      color: '#f2c14e',
      tolerance: 80,
      expansion: 65,
      doctrine: 'The middle way out of suffering',
    },
    {
      name: 'Hinduism',
      color: '#e76f51',
      tolerance: 70,
      expansion: 45,
      doctrine: 'Dharma and the cycle of rebirth',
    },
    {
      name: 'Confucianism',
      color: '#c0392b',
      tolerance: 70,
      expansion: 35,
      doctrine: 'Harmony, ritual and the mandate of heaven',
    },
    {
      name: 'Tengrism',
      color: '#5dade2',
      tolerance: 60,
      expansion: 35,
      doctrine: 'The eternal blue sky',
    },
    {
      name: 'Maya Religion',
      color: '#16a085',
      tolerance: 40,
      expansion: 35,
      doctrine: 'The world tree and the long count',
    },
  ],
  tiers: {
    tribe: ['agriculture', 'bronze', 'iron'],
    civ: CLASSICAL.filter(b => b !== 'philosophy'),
    advanced: CLASSICAL,
  },
  realms: [
    {
      name: 'Roman Empire',
      culture: 'Latin',
      religion: 'Roman Paganism',
      color: '#a4161a',
      axes: [75, 55, 55, 60, 28],
      government: 'Empire',
      dynasty: 'Julio-Claudian',
      tier: 'advanced',
      seeds: [
        [12.5, 41.9, 4, 'Rome'],
        [2, 46.5, 4, 'Lugdunum'],
        [-4, 40, 4, 'Tarraco'],
        [32, 39, 3, 'Ancyra'],
        [36.5, 33.5, 2, 'Antioch'],
        [31, 28, 3, 'Alexandria'],
        [9.5, 35, 2, 'Carthage'],
        [22, 40.5, 3, 'Thessalonica'],
      ],
    },
    {
      name: 'Parthian Empire',
      culture: 'Persian',
      religion: 'Zoroastrianism',
      color: '#6a994e',
      axes: [55, 20, 50, 40, 68],
      government: 'Empire',
      dynasty: 'Arsacid',
      tier: 'advanced',
      seeds: [
        [44.6, 33.1, 4, 'Ctesiphon'],
        [53, 33, 5, 'Ecbatana'],
        [59, 36, 3, 'Merv'],
      ],
    },
    {
      name: 'Han Empire',
      culture: 'Han',
      religion: 'Confucianism',
      color: '#d1495b',
      axes: [35, 25, 45, 55, 22],
      government: 'Empire',
      dynasty: 'Liu',
      tier: 'advanced',
      seeds: [
        [108.9, 34.3, 6, "Chang'an"],
        [115, 36, 5, 'Luoyang'],
        [113, 27, 5, 'Changsha'],
        [104, 30.6, 3, 'Chengdu'],
      ],
    },
    {
      name: 'Kushan Empire',
      culture: 'Kushan',
      religion: 'Buddhism',
      color: '#e9c46a',
      axes: [60, 20, 65, 70, 50],
      government: 'Empire',
      tier: 'advanced',
      seeds: [
        [68, 36, 3, 'Bactra'],
        [72, 32, 3, 'Taxila'],
      ],
    },
    {
      name: 'Satavahana',
      culture: 'Andhra',
      religion: 'Hinduism',
      color: '#f4a261',
      axes: [50, 50, 60, 60, 45],
      government: 'Monarchy',
      tier: 'advanced',
      seeds: [[77, 18, 5, 'Pratishthana']],
    },
    {
      name: 'Magadha',
      culture: 'Magadhi',
      religion: 'Buddhism',
      color: '#f6bd60',
      axes: [45, 30, 55, 65, 50],
      government: 'Monarchy',
      tier: 'civ',
      seeds: [[85, 25.5, 4, 'Pataliputra']],
    },
    {
      name: 'Chola',
      culture: 'Tamil',
      religion: 'Hinduism',
      color: '#bc6c25',
      axes: [50, 70, 65, 55, 50],
      government: 'Monarchy',
      tier: 'civ',
      seeds: [[79, 11, 2, 'Uraiyur']],
    },
    {
      name: 'Xiongnu',
      culture: 'Xiongnu',
      religion: 'Tengrism',
      color: '#7f8c8d',
      axes: [82, 8, 25, 55, 78],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[103, 47, 6]],
    },
    {
      name: 'Saka',
      culture: 'Saka',
      religion: 'Tengrism',
      color: '#95a5a6',
      axes: [75, 8, 30, 55, 80],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[75, 43, 3]],
    },
    {
      name: 'Sarmatians',
      culture: 'Sarmatian',
      color: '#a68a64',
      axes: [75, 10, 30, 55, 80],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[40, 48, 4]],
    },
    {
      name: 'Germania',
      culture: 'Germanic',
      color: '#457b9d',
      axes: [70, 30, 25, 45, 82],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[10, 53, 4]],
    },
    {
      name: 'Dacia',
      culture: 'Dacian',
      color: '#9c6644',
      axes: [65, 20, 35, 45, 55],
      government: 'Monarchy',
      tier: 'civ',
      seeds: [[24, 46, 3, 'Sarmizegetusa']],
    },
    {
      name: 'Britons',
      culture: 'Celtic',
      color: '#2a9d8f',
      axes: [55, 55, 30, 40, 80],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[-1, 52.5, 2, 'Camulodunum']],
    },
    {
      name: 'Armenia',
      culture: 'Armenian',
      religion: 'Zoroastrianism',
      color: '#e76f51',
      axes: [45, 20, 50, 45, 50],
      government: 'Monarchy',
      dynasty: 'Artaxiad',
      tier: 'civ',
      seeds: [[44.5, 40, 2, 'Artaxata']],
    },
    {
      name: 'Nabataea',
      culture: 'Arab',
      color: '#d4a373',
      axes: [40, 30, 80, 55, 55],
      government: 'Monarchy',
      tier: 'civ',
      seeds: [[35.4, 30.3, 1, 'Petra']],
    },
    {
      name: 'Arabia',
      culture: 'Arab',
      color: '#cdb38b',
      axes: [50, 25, 50, 50, 80],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[44, 24, 3]],
    },
    {
      name: 'Himyar',
      culture: 'Sabaean',
      color: '#bc8a5f',
      axes: [45, 60, 75, 50, 55],
      government: 'Monarchy',
      tier: 'civ',
      seeds: [[45, 15, 2, 'Zafar']],
    },
    {
      name: 'Aksum',
      culture: "Ge'ez",
      color: '#6d597a',
      axes: [55, 55, 65, 45, 45],
      government: 'Monarchy',
      tier: 'civ',
      seeds: [[38.7, 14.1, 3, 'Aksum']],
    },
    {
      name: 'Kush',
      culture: 'Kushite',
      color: '#7f5539',
      axes: [45, 25, 50, 40, 45],
      government: 'Monarchy',
      tier: 'civ',
      seeds: [[33.7, 16.9, 3, 'Meroe']],
    },
    {
      name: 'Nok',
      culture: 'Nok',
      color: '#588157',
      axes: [45, 15, 35, 50, 70],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[8, 9.5, 3]],
    },
    {
      name: 'Bantu Peoples',
      culture: 'Bantu',
      color: '#3a5a40',
      axes: [70, 15, 30, 50, 75],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[25, -5, 3]],
    },
    {
      name: 'Goguryeo',
      culture: 'Korean',
      color: '#4d908e',
      axes: [60, 30, 40, 55, 45],
      government: 'Monarchy',
      tier: 'civ',
      seeds: [[126, 41, 2, 'Jolbon']],
    },
    {
      name: 'Wa',
      culture: 'Yamato',
      color: '#f28482',
      axes: [40, 70, 40, 50, 70],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[134, 34.5, 2]],
    },
    {
      name: 'Funan',
      culture: 'Khmer',
      religion: 'Hinduism',
      color: '#43aa8b',
      axes: [45, 75, 70, 60, 50],
      government: 'Monarchy',
      tier: 'civ',
      seeds: [[105, 11, 2, 'Vyadhapura']],
    },
    {
      name: 'Maya',
      culture: 'Maya',
      religion: 'Maya Religion',
      color: '#2d6a4f',
      axes: [55, 30, 45, 30, 75],
      government: 'Monarchy',
      tier: 'civ',
      seeds: [[-89.5, 17.2, 3, 'El Mirador']],
    },
    {
      name: 'Teotihuacan',
      culture: 'Teotihuacano',
      color: '#b56576',
      axes: [55, 20, 55, 35, 40],
      government: 'Theocracy',
      tier: 'civ',
      seeds: [[-98.8, 19.7, 2, 'Teotihuacan']],
    },
    {
      name: 'Moche',
      culture: 'Moche',
      color: '#e09f3e',
      axes: [50, 55, 45, 35, 45],
      government: 'Theocracy',
      tier: 'civ',
      seeds: [[-79, -8, 2, 'Moche']],
    },
    {
      name: 'Hopewell',
      culture: 'Hopewell',
      color: '#8d6b48',
      axes: [40, 20, 45, 45, 70],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[-83, 39, 2]],
    },
    {
      name: 'Basketmakers',
      culture: 'Ancestral Puebloan',
      color: '#c08552',
      axes: [30, 5, 35, 45, 60],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[-108, 36, 2]],
    },
    {
      name: 'Pama-Nyungan',
      culture: 'Aboriginal',
      color: '#c06a3e',
      axes: [25, 30, 20, 50, 80],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[133, -25, 3]],
    },
  ],
};

// ---- 1444: the late medieval world --------------------------------------------------

const CE1444: Scenario = {
  year: 1444,
  label: '1444 · On the eve of the Age of Discovery',
  religions: [
    {
      name: 'Catholicism',
      color: '#e9c46a',
      tolerance: 35,
      expansion: 55,
      doctrine: 'The one church under the pope',
    },
    {
      name: 'Orthodoxy',
      color: '#e76f51',
      tolerance: 40,
      expansion: 45,
      doctrine: 'Right worship and the councils',
    },
    {
      name: 'Sunni Islam',
      color: '#2a9d8f',
      tolerance: 45,
      expansion: 60,
      doctrine: 'The Quran and the tradition of the Prophet',
    },
    {
      name: 'Shia Islam',
      color: '#1b7a6e',
      tolerance: 40,
      expansion: 45,
      doctrine: 'The Quran and the line of the imams',
    },
    {
      name: 'Hinduism',
      color: '#f4a261',
      tolerance: 70,
      expansion: 40,
      doctrine: 'Dharma and the cycle of rebirth',
    },
    {
      name: 'Buddhism',
      color: '#f2c14e',
      tolerance: 80,
      expansion: 50,
      doctrine: 'The middle way out of suffering',
    },
    {
      name: 'Confucianism',
      color: '#c0392b',
      tolerance: 70,
      expansion: 30,
      doctrine: 'Harmony, ritual and the mandate of heaven',
    },
    {
      name: 'Shinto',
      color: '#ef476f',
      tolerance: 65,
      expansion: 25,
      doctrine: 'The kami of land and ancestors',
    },
    {
      name: 'Nahuatl Religion',
      color: '#9b2226',
      tolerance: 25,
      expansion: 45,
      doctrine: 'The sun must be fed',
    },
    {
      name: 'Inti Religion',
      color: '#ee9b00',
      tolerance: 40,
      expansion: 45,
      doctrine: 'The sun and the divine Sapa Inca',
    },
  ],
  tiers: {
    tribe: ['agriculture', 'bronze', 'iron'],
    civ: MEDIEVAL,
    advanced: [...MEDIEVAL, 'banking'],
  },
  realms: [
    {
      name: 'Portugal',
      culture: 'Portuguese',
      religion: 'Catholicism',
      color: '#2a7f62',
      axes: [65, 88, 65, 30, 35],
      government: 'Monarchy',
      dynasty: 'Aviz',
      seeds: [[-8.6, 39.5, 1, 'Lisbon']],
    },
    {
      name: 'Castile',
      culture: 'Castilian',
      religion: 'Catholicism',
      color: '#e9c46a',
      axes: [72, 60, 45, 22, 40],
      government: 'Monarchy',
      dynasty: 'Trastamara',
      seeds: [[-3.7, 40.4, 3, 'Toledo']],
    },
    {
      name: 'Aragon',
      culture: 'Catalan',
      religion: 'Catholicism',
      color: '#f6bd60',
      axes: [55, 70, 65, 35, 55],
      government: 'Monarchy',
      seeds: [
        [0.5, 41.5, 1, 'Barcelona'],
        [14.3, 40.8, 1, 'Naples'],
      ],
    },
    {
      name: 'France',
      culture: 'French',
      religion: 'Catholicism',
      color: '#2a4d9b',
      axes: [65, 45, 50, 35, 50],
      government: 'Monarchy',
      dynasty: 'Valois',
      seeds: [[2.35, 48.85, 4, 'Paris']],
    },
    {
      name: 'England',
      culture: 'English',
      religion: 'Catholicism',
      color: '#c1121f',
      axes: [60, 75, 70, 40, 45],
      government: 'Monarchy',
      dynasty: 'Lancaster',
      seeds: [[-0.12, 51.5, 2, 'London']],
    },
    {
      name: 'Scotland',
      culture: 'Scottish',
      religion: 'Catholicism',
      color: '#5e60ce',
      axes: [50, 55, 35, 40, 70],
      government: 'Monarchy',
      dynasty: 'Stewart',
      seeds: [[-3.2, 56, 1, 'Edinburgh']],
    },
    {
      name: 'Burgundy',
      culture: 'Burgundian',
      religion: 'Catholicism',
      color: '#7b2cbf',
      axes: [60, 55, 80, 40, 55],
      government: 'Monarchy',
      dynasty: 'Valois-Burgundy',
      tier: 'advanced',
      seeds: [
        [4.4, 50.8, 1, 'Brussels'],
        [5, 47.3, 1, 'Dijon'],
      ],
    },
    {
      name: 'Austria',
      culture: 'Austrian',
      religion: 'Catholicism',
      color: '#f1faee',
      axes: [55, 20, 50, 35, 60],
      government: 'Monarchy',
      dynasty: 'Habsburg',
      seeds: [[16.4, 48.2, 2, 'Vienna']],
    },
    {
      name: 'Bohemia',
      culture: 'Czech',
      religion: 'Catholicism',
      color: '#8ecae6',
      axes: [45, 15, 55, 60, 65],
      government: 'Monarchy',
      seeds: [[14.4, 50.1, 1, 'Prague']],
    },
    {
      name: 'Brandenburg',
      culture: 'German',
      religion: 'Catholicism',
      color: '#495057',
      axes: [55, 30, 45, 45, 55],
      government: 'Monarchy',
      dynasty: 'Hohenzollern',
      seeds: [[13.4, 52.5, 1, 'Berlin']],
    },
    {
      name: 'Venice',
      culture: 'Venetian',
      religion: 'Catholicism',
      color: '#2ec4b6',
      axes: [50, 88, 88, 55, 55],
      government: 'Merchant Republic',
      tier: 'advanced',
      seeds: [[12.3, 45.4, 1, 'Venice']],
    },
    {
      name: 'Milan',
      culture: 'Lombard',
      religion: 'Catholicism',
      color: '#80b918',
      axes: [55, 30, 75, 45, 60],
      government: 'Monarchy',
      dynasty: 'Visconti',
      tier: 'advanced',
      seeds: [[9.2, 45.5, 1, 'Milan']],
    },
    {
      name: 'Papal States',
      culture: 'Italian',
      religion: 'Catholicism',
      color: '#fefae0',
      axes: [35, 40, 60, 15, 50],
      government: 'Theocracy',
      tier: 'advanced',
      seeds: [[12.5, 41.9, 1, 'Rome']],
    },
    {
      name: 'Hungary',
      culture: 'Hungarian',
      religion: 'Catholicism',
      color: '#bc4749',
      axes: [60, 15, 45, 35, 60],
      government: 'Monarchy',
      dynasty: 'Hunyadi',
      seeds: [[19, 47.5, 3, 'Buda']],
    },
    {
      name: 'Poland',
      culture: 'Polish',
      religion: 'Catholicism',
      color: '#e5383b',
      axes: [55, 25, 45, 50, 75],
      government: 'Monarchy',
      dynasty: 'Jagiellon',
      seeds: [[19.9, 50, 3, 'Krakow']],
    },
    {
      name: 'Lithuania',
      culture: 'Lithuanian',
      religion: 'Catholicism',
      color: '#ffd166',
      axes: [60, 20, 35, 55, 65],
      government: 'Monarchy',
      dynasty: 'Gediminid',
      seeds: [[25.3, 54.7, 3, 'Vilnius']],
    },
    {
      name: 'Teutonic Order',
      culture: 'German',
      religion: 'Catholicism',
      color: '#adb5bd',
      axes: [65, 50, 55, 20, 40],
      government: 'Theocracy',
      seeds: [[20, 54.4, 1, 'Marienburg']],
    },
    {
      name: 'Denmark',
      culture: 'Danish',
      religion: 'Catholicism',
      color: '#d00000',
      axes: [55, 75, 60, 45, 55],
      government: 'Monarchy',
      dynasty: 'Oldenburg',
      seeds: [
        [12.6, 55.7, 1, 'Copenhagen'],
        [10.7, 59.9, 2, 'Oslo'],
      ],
    },
    {
      name: 'Sweden',
      culture: 'Swedish',
      religion: 'Catholicism',
      color: '#0077b6',
      axes: [55, 65, 45, 45, 60],
      government: 'Monarchy',
      seeds: [[18, 59.3, 2, 'Stockholm']],
    },
    {
      name: 'Novgorod',
      culture: 'Russian',
      religion: 'Orthodoxy',
      color: '#a7c957',
      axes: [35, 45, 80, 50, 75],
      government: 'Merchant Republic',
      seeds: [[31.3, 58.5, 4, 'Novgorod']],
    },
    {
      name: 'Muscovy',
      culture: 'Russian',
      religion: 'Orthodoxy',
      color: '#386641',
      axes: [75, 15, 35, 35, 25],
      government: 'Monarchy',
      dynasty: 'Rurikid',
      seeds: [[37.6, 55.75, 4, 'Moscow']],
    },
    {
      name: 'Byzantium',
      culture: 'Greek',
      religion: 'Orthodoxy',
      color: '#7209b7',
      axes: [30, 60, 60, 35, 60],
      government: 'Empire',
      dynasty: 'Palaiologos',
      tier: 'advanced',
      seeds: [[28.95, 41, 1, 'Constantinople']],
    },
    {
      name: 'Georgia',
      culture: 'Georgian',
      religion: 'Orthodoxy',
      color: '#ef233c',
      axes: [40, 30, 45, 40, 65],
      government: 'Monarchy',
      dynasty: 'Bagrationi',
      seeds: [[44.8, 41.7, 1, 'Tbilisi']],
    },
    {
      name: 'Ottoman Empire',
      culture: 'Turkish',
      religion: 'Sunni Islam',
      color: '#386d36',
      axes: [85, 45, 50, 40, 28],
      government: 'Empire',
      dynasty: 'Osman',
      seeds: [
        [32.8, 39.9, 4, 'Bursa'],
        [26, 42, 2, 'Edirne'],
      ],
    },
    {
      name: 'Mamluk Sultanate',
      culture: 'Egyptian Arab',
      religion: 'Sunni Islam',
      color: '#e0c068',
      axes: [50, 35, 60, 30, 60],
      government: 'Empire',
      seeds: [
        [31.2, 30, 4, 'Cairo'],
        [36.3, 33.5, 2, 'Damascus'],
        [39.8, 21.4, 2, 'Mecca'],
      ],
    },
    {
      name: 'Qara Qoyunlu',
      culture: 'Turkmen',
      religion: 'Shia Islam',
      color: '#6a4c93',
      axes: [70, 15, 40, 40, 70],
      government: 'Monarchy',
      seeds: [[46.3, 38, 3, 'Tabriz']],
    },
    {
      name: 'Timurid Empire',
      culture: 'Persian',
      religion: 'Sunni Islam',
      color: '#52b788',
      axes: [65, 15, 55, 50, 70],
      government: 'Empire',
      dynasty: 'Timurid',
      tier: 'advanced',
      seeds: [
        [62.2, 34.3, 4, 'Herat'],
        [66.9, 39.6, 3, 'Samarkand'],
        [53, 32, 3, 'Isfahan'],
      ],
    },
    {
      name: 'Golden Horde',
      culture: 'Tatar',
      religion: 'Sunni Islam',
      color: '#d4a017',
      axes: [70, 10, 35, 50, 85],
      government: 'Chiefdom',
      dynasty: 'Jochid',
      seeds: [[45, 48, 5, 'Sarai']],
    },
    {
      name: 'Kazan',
      culture: 'Tatar',
      religion: 'Sunni Islam',
      color: '#b08968',
      axes: [55, 15, 50, 45, 65],
      government: 'Monarchy',
      seeds: [[49, 55.8, 2, 'Kazan']],
    },
    {
      name: 'Kazakh Khanate',
      culture: 'Kazakh',
      religion: 'Sunni Islam',
      color: '#90be6d',
      axes: [75, 8, 30, 55, 85],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[70, 47, 4]],
    },
    {
      name: 'Morocco',
      culture: 'Maghrebi',
      religion: 'Sunni Islam',
      color: '#9c0d38',
      axes: [55, 40, 50, 30, 60],
      government: 'Monarchy',
      dynasty: 'Wattasid',
      seeds: [[-5, 34, 2, 'Fez']],
    },
    {
      name: 'Tunis',
      culture: 'Maghrebi',
      religion: 'Sunni Islam',
      color: '#bc6c25',
      axes: [50, 55, 60, 40, 60],
      government: 'Monarchy',
      dynasty: 'Hafsid',
      seeds: [[10.2, 36.8, 2, 'Tunis']],
    },
    {
      name: 'Mali',
      culture: 'Mandinka',
      religion: 'Sunni Islam',
      color: '#f9c74f',
      axes: [45, 20, 72, 50, 65],
      government: 'Empire',
      dynasty: 'Keita',
      seeds: [
        [-8, 13, 5, 'Niani'],
        [-3, 16.8, 1, 'Timbuktu'],
      ],
    },
    {
      name: 'Songhai',
      culture: 'Songhai',
      religion: 'Sunni Islam',
      color: '#e76f51',
      axes: [70, 25, 55, 45, 55],
      government: 'Monarchy',
      seeds: [[0, 16.3, 2, 'Gao']],
    },
    {
      name: 'Kanem-Bornu',
      culture: 'Kanuri',
      religion: 'Sunni Islam',
      color: '#a98467',
      axes: [55, 10, 50, 40, 60],
      government: 'Monarchy',
      seeds: [[14, 12, 3, 'Ngazargamu']],
    },
    {
      name: 'Hausa',
      culture: 'Hausa',
      religion: 'Sunni Islam',
      color: '#6c584c',
      axes: [45, 10, 70, 50, 80],
      government: 'Merchant Republic',
      seeds: [[8.5, 12, 2, 'Kano']],
    },
    {
      name: 'Benin',
      culture: 'Edo',
      color: '#9d0208',
      axes: [55, 40, 55, 40, 45],
      government: 'Monarchy',
      tier: 'tribe',
      seeds: [[5.6, 6.3, 2, 'Benin City']],
    },
    {
      name: 'Kongo',
      culture: 'Kongo',
      color: '#606c38',
      axes: [50, 35, 50, 50, 60],
      government: 'Monarchy',
      tier: 'tribe',
      seeds: [[14.5, -5.5, 3, 'Mbanza Kongo']],
    },
    {
      name: 'Mutapa',
      culture: 'Shona',
      color: '#bb9457',
      axes: [50, 15, 60, 50, 55],
      government: 'Monarchy',
      tier: 'tribe',
      seeds: [[31, -18, 3, 'Great Zimbabwe']],
    },
    {
      name: 'Kilwa',
      culture: 'Swahili',
      religion: 'Sunni Islam',
      color: '#48cae4',
      axes: [40, 85, 85, 55, 65],
      government: 'Merchant Republic',
      seeds: [[39.5, -9, 1, 'Kilwa']],
    },
    {
      name: 'Ethiopia',
      culture: 'Amhara',
      religion: 'Orthodoxy',
      color: '#b5838d',
      axes: [50, 20, 40, 25, 45],
      government: 'Empire',
      dynasty: 'Solomonic',
      seeds: [[38.7, 11.5, 4, 'Gondar']],
    },
    {
      name: 'Adal',
      culture: 'Somali',
      religion: 'Sunni Islam',
      color: '#81b29a',
      axes: [65, 45, 60, 30, 60],
      government: 'Monarchy',
      seeds: [[43, 9.5, 2, 'Zeila']],
    },
    {
      name: 'Delhi Sultanate',
      culture: 'Hindustani',
      religion: 'Sunni Islam',
      color: '#2d6a4f',
      axes: [55, 15, 55, 45, 65],
      government: 'Monarchy',
      dynasty: 'Sayyid',
      seeds: [[77.2, 28.6, 3, 'Delhi']],
    },
    {
      name: 'Mewar',
      culture: 'Rajput',
      religion: 'Hinduism',
      color: '#ff7b00',
      axes: [60, 10, 45, 40, 70],
      government: 'Monarchy',
      dynasty: 'Sisodia',
      seeds: [[73.7, 24.6, 2, 'Chittor']],
    },
    {
      name: 'Bengal',
      culture: 'Bengali',
      religion: 'Sunni Islam',
      color: '#57cc99',
      axes: [45, 55, 75, 55, 55],
      government: 'Monarchy',
      seeds: [[90, 24, 2, 'Gaur']],
    },
    {
      name: 'Bahmani Sultanate',
      culture: 'Deccani',
      religion: 'Shia Islam',
      color: '#40916c',
      axes: [60, 30, 55, 45, 60],
      government: 'Monarchy',
      seeds: [[77, 17.3, 3, 'Bidar']],
    },
    {
      name: 'Vijayanagara',
      culture: 'Kannada',
      religion: 'Hinduism',
      color: '#f48c06',
      axes: [60, 45, 65, 45, 45],
      government: 'Empire',
      dynasty: 'Sangama',
      seeds: [[76.5, 15.3, 4, 'Vijayanagara']],
    },
    {
      name: 'Orissa',
      culture: 'Oriya',
      religion: 'Hinduism',
      color: '#e85d04',
      axes: [50, 50, 50, 40, 55],
      government: 'Monarchy',
      dynasty: 'Gajapati',
      seeds: [[85.8, 20.3, 2, 'Cuttack']],
    },
    {
      name: 'Tibet',
      culture: 'Tibetan',
      religion: 'Buddhism',
      color: '#bde0fe',
      axes: [25, 5, 30, 25, 70],
      government: 'Theocracy',
      seeds: [[91.1, 29.6, 3, 'Lhasa']],
    },
    {
      name: 'Oirat',
      culture: 'Oirat',
      religion: 'Buddhism',
      color: '#cdb4db',
      axes: [80, 5, 25, 55, 80],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[88, 47, 4]],
    },
    {
      name: 'Northern Yuan',
      culture: 'Mongol',
      religion: 'Buddhism',
      color: '#a2d2ff',
      axes: [70, 5, 25, 55, 85],
      government: 'Chiefdom',
      dynasty: 'Borjigin',
      tier: 'tribe',
      seeds: [[107, 48, 4, 'Karakorum']],
    },
    {
      name: 'Ming',
      culture: 'Han',
      religion: 'Confucianism',
      color: '#f2cc8f',
      axes: [25, 22, 40, 55, 18],
      government: 'Empire',
      dynasty: 'Zhu',
      tier: 'advanced',
      seeds: [
        [116.4, 39.9, 5, 'Beijing'],
        [118.8, 32, 5, 'Nanjing'],
        [113.3, 23.1, 4, 'Guangzhou'],
        [104, 30.6, 3, 'Chengdu'],
        [109, 34.3, 3, "Xi'an"],
      ],
    },
    {
      name: 'Joseon',
      culture: 'Korean',
      religion: 'Confucianism',
      color: '#4361ee',
      axes: [30, 35, 40, 50, 30],
      government: 'Monarchy',
      dynasty: 'Yi',
      seeds: [[127, 37.5, 2, 'Hanseong']],
    },
    {
      name: 'Japan',
      culture: 'Japanese',
      religion: 'Shinto',
      color: '#ef476f',
      axes: [45, 55, 45, 55, 80],
      government: 'Monarchy',
      dynasty: 'Ashikaga',
      seeds: [[135.8, 35, 3, 'Kyoto']],
    },
    {
      name: 'Dai Viet',
      culture: 'Vietnamese',
      religion: 'Confucianism',
      color: '#bc4749',
      axes: [60, 45, 45, 50, 35],
      government: 'Monarchy',
      dynasty: 'Le',
      seeds: [[105.8, 21, 2, 'Thang Long']],
    },
    {
      name: 'Ayutthaya',
      culture: 'Thai',
      religion: 'Buddhism',
      color: '#4cc9f0',
      axes: [60, 55, 65, 60, 40],
      government: 'Monarchy',
      seeds: [[100.5, 14.4, 3, 'Ayutthaya']],
    },
    {
      name: 'Ava',
      culture: 'Burmese',
      religion: 'Buddhism',
      color: '#7209b7',
      axes: [55, 30, 45, 55, 60],
      government: 'Monarchy',
      seeds: [[95.9, 21.9, 2, 'Ava']],
    },
    {
      name: 'Khmer',
      culture: 'Khmer',
      religion: 'Buddhism',
      color: '#3a86ff',
      axes: [35, 40, 45, 55, 60],
      government: 'Monarchy',
      seeds: [[104.9, 11.6, 2, 'Angkor']],
    },
    {
      name: 'Majapahit',
      culture: 'Javanese',
      religion: 'Hinduism',
      color: '#f15bb5',
      axes: [50, 85, 70, 55, 65],
      government: 'Empire',
      seeds: [[112, -7.5, 3, 'Trowulan']],
    },
    {
      name: 'Malacca',
      culture: 'Malay',
      religion: 'Sunni Islam',
      color: '#00bbf9',
      axes: [40, 88, 88, 55, 55],
      government: 'Merchant Republic',
      seeds: [[102.2, 2.2, 1, 'Malacca']],
    },
    {
      name: 'Aztec Empire',
      culture: 'Nahua',
      religion: 'Nahuatl Religion',
      color: '#ae2012',
      axes: [82, 25, 50, 15, 40],
      government: 'Empire',
      tier: 'tribe',
      seeds: [[-99.1, 19.4, 3, 'Tenochtitlan']],
    },
    {
      name: 'Maya',
      culture: 'Maya',
      color: '#2d6a4f',
      axes: [40, 40, 50, 35, 80],
      government: 'Monarchy',
      tier: 'tribe',
      seeds: [[-89.5, 20.6, 2, 'Mayapan']],
    },
    {
      name: 'Inca',
      culture: 'Quechua',
      religion: 'Inti Religion',
      color: '#ee9b00',
      axes: [78, 20, 35, 30, 15],
      government: 'Empire',
      tier: 'tribe',
      seeds: [[-72, -13.5, 5, 'Cusco']],
    },
    {
      name: 'Chimu',
      culture: 'Chimu',
      color: '#ca6702',
      axes: [45, 50, 55, 40, 40],
      government: 'Monarchy',
      tier: 'tribe',
      seeds: [[-79, -8.1, 2, 'Chan Chan']],
    },
    {
      name: 'Muisca',
      culture: 'Muisca',
      color: '#94d2bd',
      axes: [40, 20, 55, 45, 70],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[-74, 5, 1]],
    },
    {
      name: 'Iroquois',
      culture: 'Iroquoian',
      color: '#6a994e',
      axes: [60, 25, 35, 50, 75],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[-76, 43, 2]],
    },
    {
      name: 'Cherokee',
      culture: 'Cherokee',
      color: '#bc6c25',
      axes: [45, 20, 35, 50, 75],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[-84, 35, 2]],
    },
    {
      name: 'Pueblo',
      culture: 'Puebloan',
      color: '#c08552',
      axes: [30, 5, 35, 45, 70],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[-106, 35, 2]],
    },
    {
      name: 'Plains Nations',
      culture: 'Plains',
      color: '#b07d48',
      axes: [60, 8, 25, 50, 85],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[-100, 42, 3]],
    },
    {
      name: 'Tupi',
      culture: 'Tupi',
      color: '#4c8f4c',
      axes: [55, 45, 30, 50, 80],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[-45, -12, 3]],
    },
    {
      name: 'Mapuche',
      culture: 'Mapuche',
      color: '#7d8597',
      axes: [55, 30, 30, 50, 85],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[-72, -38, 2]],
    },
    {
      name: 'Pama-Nyungan',
      culture: 'Aboriginal',
      color: '#c06a3e',
      axes: [25, 30, 20, 50, 80],
      government: 'Chiefdom',
      tier: 'tribe',
      seeds: [[133, -25, 3]],
    },
  ],
};

export const SCENARIOS: Scenario[] = [BCE3000, CE1, CE1444];
export const scenarioFor = (year: number | undefined) =>
  SCENARIOS.find(x => x.year === year) ?? BCE3000;

/** Extra cost of moving through each terrain when territories grow from their seeds. */
const TERRAIN_COST: Record<string, number> = {
  plains: 1,
  forest: 1.4,
  desert: 2.2,
  mountain: 2.6,
  tundra: 2.4,
};

/**
 * Grows each realm's territory outward from its historical seats, round by
 * round, over land only, until every seed has its share of provinces.
 */
function placeRealms(s: WorldState, data: RealmData[]) {
  const claimed = new Map<number, number>(); // province id -> realm index
  const land = s.provinces.filter(p => p.terrain !== 'ocean');
  interface Grower {
    realm: number;
    left: number;
    frontier: { id: number; cost: number }[];
    seat: number;
    city?: string;
  }
  const growers: Grower[] = [];
  data.forEach((realm, k) =>
    realm.seeds.forEach(([lon, lat, size, city]) => {
      // The seat is the nearest unclaimed land region to the historical place.
      let seat = -1;
      let best = Infinity;
      for (const p of land) {
        if (claimed.has(p.id)) continue;
        const [plon, plat] = lonLat(p.x, p.y);
        const d = Math.hypot((plon - lon) * Math.cos((lat * Math.PI) / 180), plat - lat);
        if (d < best) {
          best = d;
          seat = p.id;
        }
      }
      if (seat < 0) return;
      claimed.set(seat, k);
      growers.push({ realm: k, left: size - 1, frontier: [{ id: seat, cost: 0 }], seat, city });
    }),
  );
  let progress = true;
  while (progress) {
    progress = false;
    for (const g of growers) {
      if (g.left <= 0) continue;
      // Expand from the cheapest frontier cell into its cheapest free neighbour.
      g.frontier.sort((a, b) => a.cost - b.cost);
      let grown = false;
      for (const f of g.frontier) {
        const options = neigh(s.provinces[f.id], s)
          .filter(n => n.terrain !== 'ocean' && !claimed.has(n.id))
          .sort((a, b) => (TERRAIN_COST[a.terrain] ?? 2) - (TERRAIN_COST[b.terrain] ?? 2));
        if (!options.length) continue;
        const n = options[0];
        claimed.set(n.id, g.realm);
        g.frontier.push({ id: n.id, cost: f.cost + (TERRAIN_COST[n.terrain] ?? 2) });
        g.left--;
        grown = true;
        progress = true;
        break;
      }
      if (!grown) g.left = 0;
    }
  }
  return { claimed, growers };
}

/** A new world on the Earth map at one of the historical start dates. */
export function createEarthWorld(cfg: WorldConfig, seed: number): WorldState {
  const r = new RNG(seed);
  const scenario = scenarioFor(cfg.start);
  const s = emptyWorld(
    { ...cfg, map: 'earth', start: scenario.year },
    seed,
    scenario.year,
    earthMap(r),
  );
  const religionId = new Map<string, number>();
  for (const rel of scenario.religions) {
    const religion: Religion = {
      id: s.nextIds.religion++,
      name: rel.name,
      color: rel.color,
      founded: scenario.year - 500,
      founderId: null,
      holyProvinceIds: [],
      doctrine: rel.doctrine,
      expansion: rel.expansion,
      tolerance: rel.tolerance,
      schismIds: [],
      provinces: 0,
    };
    s.religions.push(religion);
    religionId.set(rel.name, religion.id);
  }
  const { claimed, growers } = placeRealms(s, scenario.realms);
  const cultureIds = new Map<string, number>();
  const realms: Civilization[] = [];
  scenario.realms.forEach((data, k) => {
    const provinceIds = growers.filter(g => g.realm === k).flatMap(g => [g.seat]);
    const rest = [...claimed.entries()]
      .filter(([id, owner]) => owner === k && !provinceIds.includes(id))
      .map(([id]) => id);
    const all = [...provinceIds, ...rest];
    if (!all.length) return;
    const [a, h, e, f, o] = data.axes ?? [50, 50, 50, 50, 50];
    const c = foundRealm(
      s,
      {
        name: data.name,
        root: data.culture,
        color: data.color,
        provinceIds: all,
        cultureId: cultureIds.get(data.culture),
        cultureName: data.culture,
        axes: data.axes ? { ambition: a, horizon: h, economy: e, faith: f, order: o } : undefined,
        dynasty: data.dynasty,
      },
      r,
    );
    cultureIds.set(data.culture, c.cultureId);
    // A real name is kept as the realm grows or shrinks.
    c.successorIdentity = data.name;
    c.nameHistory[0].reason = `${scenario.label}`;
    for (const b of scenario.tiers[data.tier ?? 'civ']) learn(s, c, b, 'founding');
    if (data.government) {
      c.government = data.government;
      c.governmentHistory[0].government = data.government;
    }
    if (data.religion && religionId.has(data.religion)) {
      c.faithId = religionId.get(data.religion)!;
      for (const id of all) s.provinces[id].religionId = c.faithId;
    }
    realms.push(c);
  });
  rebuildIndex(s);
  // Seats with a historical city get that city; the first is the capital.
  for (const g of growers) {
    const c = realms.find(x => x.name === scenario.realms[g.realm].name);
    if (!c || s.provinces[g.seat].ownerId !== c.id) continue;
    const isCapital = !c.cityIds.length;
    if (!g.city && !isCapital) continue;
    const city = createCity(s, c, s.provinces[g.seat], r, isCapital);
    if (g.city) city.name = g.city;
    city.foundedYear = scenario.year - 200;
    const faith = c.faithId ? s.religions.find(x => x.id === c.faithId) : undefined;
    if (faith && !faith.holyProvinceIds.length) faith.holyProvinceIds.push(g.seat);
  }
  // Settled realms start developed for their era; ranks and armies to match.
  for (const c of realms) {
    for (const id of c.provinces) {
      const p = s.provinces[id];
      p.development = Math.max(p.development, developmentCap(s, p, c.era) * (0.4 + r.next() * 0.3));
    }
    const continent = s.provinces[c.provinces[0]].continentId ?? 0;
    const land = s.continents[continent]?.provinceIds.length ?? 1;
    c.rank = rankFor(c, land, 0);
    if (c.rank === 'Empire' && c.government === 'Chiefdom') c.government = 'Empire';
  }
  rebuildIndex(s);
  for (const c of realms) {
    const mods = realmModifiers(s, c).total;
    const out = realmOutput(s, c, mods);
    c.development = Math.round(out.development);
    c.wealth = out.wealth.total;
    c.manpower = out.manpower.total;
    c.influence = out.influence.total;
    c.armyCapacity = armyCapacity(c, c.manpower);
    c.armySize = c.armyCapacity;
    c.navyCapacity = navyCapacity(s, c, mods);
    c.navy = c.navyCapacity;
    c.peakProvinces = c.provinces.length;
  }
  // Who knows whom: everyone on the same landmass (Afro-Eurasia, the Americas, Oceania).
  const mass = (c: Civilization) =>
    LANDMASS[s.continents[s.provinces[c.provinces[0]].continentId ?? 0]?.name] ?? 0;
  for (const c of realms) {
    const mine = mass(c);
    c.knownContinentIds = s.continents.filter(ct => LANDMASS[ct.name] === mine).map(ct => ct.id);
    c.knownRealmIds = realms.filter(x => x.id !== c.id && mass(x) === mine).map(x => x.id);
  }
  updatePower(s);
  captureEvolutionSnapshot(s);
  return s;
}
