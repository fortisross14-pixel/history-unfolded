import type { CharacterRole, ModKey, Rarity, TraitId } from '../types.ts';

export interface TraitDef {
  id: TraitId;
  /** One-line description of the trait's effect, shown in the UI. */
  effect: string;
  /** Realm modifiers applied while this character rules (or serves, at half strength). */
  mods: Partial<Record<ModKey, number>>;
  /** Years added to (or taken from) natural lifespan. */
  lifespan?: number;
  /** Multiplier on yearly assassination risk when ruling. */
  assassination?: number;
  /** Battle and war power multiplier when commanding. */
  command?: number;
  /** Traits that cannot appear together with this one. */
  opposite?: TraitId;
}

export const TRAITS: Record<TraitId, TraitDef> = {
  Ambitious: { id: 'Ambitious', effect: 'War appetite +25%', mods: { warAppetite: 0.25 } },
  Cruel: {
    id: 'Cruel',
    effect: 'War appetite +30%, stability −6',
    mods: { warAppetite: 0.3, stability: -6 },
    assassination: 1.8,
    opposite: 'Just',
  },
  Just: { id: 'Just', effect: 'Stability +8', mods: { stability: 8 }, opposite: 'Cruel' },
  Patron: {
    id: 'Patron',
    effect: 'Influence +15%, finer buildings and art',
    mods: { influence: 0.15, build: 0.2 },
  },
  Brilliant: { id: 'Brilliant', effect: 'Research +15%', mods: { research: 0.15 } },
  Greedy: {
    id: 'Greedy',
    effect: 'Wealth +10%, stability −4',
    mods: { wealth: 0.1, stability: -4 },
    opposite: 'Frugal',
  },
  Pious: {
    id: 'Pious',
    effect: 'Faith spreads 30% faster',
    mods: { faithSpread: 0.3 },
    opposite: 'Tolerant',
  },
  Tolerant: {
    id: 'Tolerant',
    effect: 'Stability +4, faith spreads 20% slower',
    mods: { stability: 4, faithSpread: -0.2 },
    opposite: 'Pious',
  },
  Brave: {
    id: 'Brave',
    effect: 'Command +10%, more likely to fall in battle',
    mods: { warPower: 0.05 },
    command: 1.1,
    opposite: 'Craven',
  },
  Craven: {
    id: 'Craven',
    effect: 'War appetite −40%',
    mods: { warAppetite: -0.4 },
    command: 0.92,
    opposite: 'Brave',
  },
  Charismatic: {
    id: 'Charismatic',
    effect: 'Royal marriages and alliances 50% likelier',
    mods: { diplomacy: 0.5 },
  },
  Paranoid: {
    id: 'Paranoid',
    effect: 'Assassination risk halved, stability −3',
    mods: { stability: -3 },
    assassination: 0.5,
  },
  Builder: { id: 'Builder', effect: 'Buildings 50% likelier', mods: { build: 0.5 } },
  Strategist: {
    id: 'Strategist',
    effect: 'Command +15%',
    mods: { warPower: 0.08 },
    command: 1.15,
  },
  Seafarer: {
    id: 'Seafarer',
    effect: 'Exploration +40%',
    mods: { exploration: 0.4 },
  },
  Frugal: {
    id: 'Frugal',
    effect: 'Wealth +6%',
    mods: { wealth: 0.06 },
    opposite: 'Greedy',
  },
  Reformer: {
    id: 'Reformer',
    effect: 'Research +5%, stability −2, drives reforms',
    mods: { research: 0.05, stability: -2 },
  },
  Sickly: { id: 'Sickly', effect: 'Lifespan −15 years', mods: {}, lifespan: -15, opposite: 'Hale' },
  Hale: { id: 'Hale', effect: 'Lifespan +10 years', mods: {}, lifespan: 10, opposite: 'Sickly' },
  Mad: {
    id: 'Mad',
    effect: 'War appetite +40%, stability −8',
    mods: { warAppetite: 0.4, stability: -8 },
    assassination: 2,
  },
  Lucky: {
    id: 'Lucky',
    effect: 'Command +8%, growth +3%',
    mods: { growth: 0.03 },
    command: 1.08,
  },
};

export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];

/** Traits that suit each role. A character is a little likelier to get these. */
export const ROLE_TRAITS: Record<CharacterRole, TraitId[]> = {
  Ruler: ['Ambitious', 'Just', 'Patron', 'Charismatic', 'Builder'],
  Heir: ['Ambitious', 'Just', 'Charismatic'],
  Consort: ['Charismatic', 'Patron', 'Pious'],
  General: ['Brave', 'Strategist', 'Cruel', 'Lucky'],
  Admiral: ['Seafarer', 'Brave', 'Strategist'],
  Explorer: ['Seafarer', 'Brave', 'Lucky', 'Ambitious'],
  Merchant: ['Greedy', 'Frugal', 'Charismatic', 'Builder'],
  Scholar: ['Brilliant', 'Reformer', 'Builder', 'Patron'],
  Prophet: ['Pious', 'Charismatic', 'Just'],
  Statesman: ['Just', 'Reformer', 'Charismatic', 'Frugal'],
};

export interface RarityDef {
  id: Rarity;
  /** Base chance when a character is created. */
  chance: number;
  skill: [number, number];
  /** Strength of trait and role effects. */
  weight: number;
  /** Fame multiplier for deeds. */
  fame: number;
}

export const RARITIES: RarityDef[] = [
  { id: 'Common', chance: 0.556, skill: [15, 45], weight: 0.6, fame: 0.6 },
  { id: 'Rare', chance: 0.28, skill: [35, 60], weight: 0.8, fame: 0.8 },
  { id: 'Epic', chance: 0.115, skill: [50, 75], weight: 1, fame: 1 },
  { id: 'Legend', chance: 0.039, skill: [68, 90], weight: 1.3, fame: 1.4 },
  { id: 'Generational', chance: 0.01, skill: [88, 100], weight: 1.8, fame: 2 },
];

export const rarityDef = (r: Rarity) => RARITIES.find(x => x.id === r)!;
export const rarityRank = (r: Rarity) => RARITIES.findIndex(x => x.id === r);

/** Most Generational characters allowed alive at the same time. */
export const GENERATIONAL_CAP = 3;
