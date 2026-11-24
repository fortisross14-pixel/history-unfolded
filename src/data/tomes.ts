/**
 * Culture Tomes. In each world age a people opens one Tome: one of the nine culture domains.
 * The Tome offers missions; each mission is a mandate to fulfil (src/engine/tomes.ts measures
 * them) and, once done, gives a small buff for good: one of the domain's culture choices from
 * data/culture.ts. Three missions done open the Tome's major buff, bought with culture and kept
 * forever. When any great people enters a new age, every open Tome closes: what was done stays,
 * an unbought major buff is lost.
 */
import type { Domain } from './culture.ts';
import type { Mods } from './mods.ts';

/** Culture to buy a mission, by age (1..5). */
export const MISSION_COST = [0, 30, 40, 55, 70, 90];
/** Culture to buy a Tome's major buff once three of its missions are done, by age. */
export const MAJOR_COST = [0, 80, 160, 240, 320, 400];
/** Missions done that open the major buff. */
export const MAJOR_AT = 3;
/** Missions a Tome offers: five in the first age, six after. */
export const MISSIONS_IN = (age: number) => (age <= 1 ? 5 : 6);
/** A domain with fewer culture choices left than this cannot be opened again. */
export const MIN_POOL = 3;
/** A major buff won a second time (in a later age) counts this much. */
export const REPEAT_MAJOR = 0.5;

export interface MajorBuff {
  name: string;
  mods: Partial<Mods>;
  /** a rule beyond the mods, in a few words (applied where named) */
  extra?: string;
  note: string;
}

export const MAJORS: Record<Domain, MajorBuff> = {
  cosmology: {
    name: 'Order of the Heavens',
    mods: { sciencePct: 15, culturePct: 15, sight: 1, groupPct: { farming: 10 } },
    note: 'The calendar, the stars and the harvest agree.',
  },
  politics: {
    name: 'Mandate to Rule',
    mods: { commandCap: 1, prodPct: 15, goldPct: 10, territoryRadius: 1 },
    note: 'One law runs from the capital to the last village.',
  },
  religion: {
    name: 'Faith Triumphant',
    mods: { culturePct: 25, morale: 10, defensePct: 10 },
    note: 'The gods walk with the people, and the people know it.',
  },
  society: {
    name: 'The Great Society',
    mods: { foodPct: 15, growthPct: -20, housingPct: 15, workers: 5 },
    note: 'Every family has its place, and every place its bread.',
  },
  economy: {
    name: 'Golden Ledger',
    mods: { goldPct: 25, groupPct: { commerce: 15 }, refitPct: -15 },
    note: 'Coin flows to the realm from every road and market.',
  },
  war: {
    name: 'Martial Supremacy',
    mods: { attackPct: 20, commandCap: 1, morale: 5 },
    note: 'An army with a people behind it.',
  },
  seafaring: {
    name: 'Mistress of the Seas',
    mods: { navalPct: 30, coastalPct: 20, sight: 1, goldPct: 10 },
    note: 'Every coast is a road, every harbour a door.',
  },
  knowledge: {
    name: 'Age of Reason',
    mods: { sciencePct: 25 },
    extra: 'the first tech of each age −25% cost',
    note: 'A dominant technological power.',
  },
  arts: {
    name: 'Golden Century',
    mods: { culturePct: 30, goldPct: 10, morale: 5 },
    note: 'Its poets and builders are known to every people.',
  },
};

/** The mandates (engine/tomes.ts) each domain draws its missions from, most fitting first. */
export const TOME_TASKS: Record<Domain, string[]> = {
  cosmology: ['explore', 'science', 'techs', 'culture', 'shrines', 'met', 'monuments', 'peace'],
  politics: [
    'settlements',
    'treaties',
    'met',
    'urban',
    'walls',
    'cohorts',
    'treasury',
    'districts',
    'declare-war',
  ],
  religion: ['shrines', 'faith', 'culture', 'monuments', 'peace', 'wonder', 'win-battles', 'pop'],
  society: [
    'pop',
    'grow',
    'houses',
    'districts',
    'farms',
    'settlements',
    'urban',
    'found',
    'workshops',
  ],
  economy: [
    'gold',
    'goods',
    'markets',
    'treasury',
    'mines',
    'treaties',
    'farms',
    'workshops',
    'roads',
  ],
  war: [
    'win-battles',
    'beasts',
    'strong-army',
    'ranged',
    'lairs',
    'cohorts',
    'kills',
    'capture',
    'declare-war',
    'barracks',
    'walls',
  ],
  seafaring: ['ports', 'fleets', 'explore', 'met', 'treaties', 'gold', 'found', 'goods'],
  knowledge: ['techs', 'science', 'schools', 'explore', 'buildings', 'met', 'culture'],
  arts: [
    'culture',
    'monuments',
    'wonder',
    'districts',
    'buildings',
    'shrines',
    'treasury',
    'peace',
    'roads',
  ],
};

/**
 * The noble houses' mandates each domain draws from (dynasty.ts), most fitting first. Every Tome
 * keeps one of these in every age (Politics and Society two), so a realm that leans on its houses
 * always finds work for them.
 */
export const HOUSE_TASKS: Record<Domain, string[]> = {
  cosmology: ['house-level', 'house-learning', 'calm-houses'],
  politics: [
    'honours',
    'court',
    'ruling-power',
    'calm-houses',
    'houses-govern',
    'civil-war',
    'house-total',
    'trinkets',
  ],
  religion: ['house-faith', 'calm-houses', 'trinkets'],
  society: ['house-seat', 'balance', 'calm-houses', 'court', 'trinkets', 'house-total'],
  economy: ['house-trade', 'houses-govern', 'house-total'],
  war: ['house-war', 'civil-war', 'house-total'],
  seafaring: ['house-trade', 'house-level'],
  knowledge: ['house-learning', 'house-level'],
  arts: ['house-faith', 'trinkets', 'house-level'],
};
/** House missions in a Tome: two in these domains, one elsewhere. */
export const HOUSE_QUOTA = (d: Domain) => (d === 'politics' || d === 'society' ? 2 : 1);
