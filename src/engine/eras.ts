import type { BreakthroughId, Civilization, ModKey } from '../types.ts';

export interface EraDef {
  index: number;
  name: string;
  /** People per point of development, used only to display population. */
  peoplePerDevelopment: number;
}

export const ERAS: EraDef[] = [
  { index: 1, name: 'Bronze Age', peoplePerDevelopment: 1_000 },
  { index: 2, name: 'Iron Age', peoplePerDevelopment: 2_000 },
  { index: 3, name: 'Middle Ages', peoplePerDevelopment: 3_000 },
  { index: 4, name: 'Renaissance', peoplePerDevelopment: 5_000 },
  { index: 5, name: 'Industrial Age', peoplePerDevelopment: 12_000 },
  { index: 6, name: 'Modern Age', peoplePerDevelopment: 40_000 },
];

export interface BreakthroughDef {
  id: BreakthroughId;
  name: string;
  era: number;
  /** Nobody can make the breakthrough before this year. */
  earliest: number;
  effect: string;
  mods: Partial<Record<ModKey, number>>;
}

/**
 * Fifteen breakthroughs, two or three per era. Each starts with one realm and
 * spreads as a Great Discovery; each changes the balance of power.
 */
export const BREAKTHROUGHS: BreakthroughDef[] = [
  {
    id: 'agriculture',
    name: 'Agriculture',
    era: 1,
    earliest: -3200,
    effect: 'Growth +20%',
    mods: { growth: 0.2 },
  },
  {
    id: 'bronze',
    name: 'Bronze Working',
    era: 1,
    earliest: -2800,
    effect: 'War power +8%',
    mods: { warPower: 0.08 },
  },
  {
    id: 'writing',
    name: 'Writing',
    era: 1,
    earliest: -2600,
    effect: 'Research +15%, stability +3',
    mods: { research: 0.15, stability: 3 },
  },
  {
    id: 'iron',
    name: 'Iron Working',
    era: 2,
    earliest: -1200,
    effect: 'War power +12%, army +10%',
    mods: { warPower: 0.12, army: 0.1 },
  },
  {
    id: 'money',
    name: 'Coinage',
    era: 2,
    earliest: -900,
    effect: 'Wealth +15%',
    mods: { wealth: 0.15 },
  },
  {
    id: 'philosophy',
    name: 'Philosophy',
    era: 2,
    earliest: -600,
    effect: 'Research +10%, influence +10%',
    mods: { research: 0.1, influence: 0.1 },
  },
  {
    id: 'astronomy',
    name: 'Astronomy',
    era: 3,
    earliest: 300,
    effect: 'Exploration +25%, navy +10%',
    mods: { exploration: 0.25, navy: 0.1 },
  },
  {
    id: 'deep_sailing',
    name: 'Deep-Water Sailing',
    era: 3,
    earliest: 600,
    effect: 'Ocean crossings and colonies; navy +25%',
    mods: { navy: 0.25 },
  },
  {
    id: 'gunpowder',
    name: 'Gunpowder',
    era: 3,
    earliest: 900,
    effect: 'War power +20%',
    mods: { warPower: 0.2 },
  },
  {
    id: 'printing',
    name: 'Printing',
    era: 4,
    earliest: 1250,
    effect: 'Research +20%, influence +15%; ideas spread faster',
    mods: { research: 0.2, influence: 0.15 },
  },
  {
    id: 'banking',
    name: 'Banking',
    era: 4,
    earliest: 1300,
    effect: 'Wealth +20%',
    mods: { wealth: 0.2 },
  },
  {
    id: 'steam_power',
    name: 'Steam Power',
    era: 5,
    earliest: 1650,
    effect: 'Wealth +30%, growth +10%',
    mods: { wealth: 0.3, growth: 0.1 },
  },
  {
    id: 'railways',
    name: 'Railways',
    era: 5,
    earliest: 1780,
    effect: 'Army +15%; armies supplied far from home',
    mods: { army: 0.15 },
  },
  {
    id: 'electricity',
    name: 'Electricity',
    era: 6,
    earliest: 1860,
    effect: 'Wealth +25%, research +20%',
    mods: { wealth: 0.25, research: 0.2 },
  },
  {
    id: 'flight',
    name: 'Powered Flight',
    era: 6,
    earliest: 1880,
    effect: 'Exploration +50%; the whole world is in contact',
    mods: { exploration: 0.5 },
  },
];

export const breakthroughDef = (id: BreakthroughId) => BREAKTHROUGHS.find(b => b.id === id)!;
export const breakthroughName = (id: string) => BREAKTHROUGHS.find(b => b.id === id)?.name ?? id;

export const knows = (c: Civilization, id: BreakthroughId) =>
  c.breakthroughs.some(b => b.id === id);

/** A realm's era is the latest era of any breakthrough it has. */
export function eraOf(c: Civilization) {
  return c.breakthroughs.reduce((n, b) => Math.max(n, breakthroughDef(b.id).era), 1);
}

export const eraName = (era: number) => ERAS[Math.max(0, Math.min(ERAS.length - 1, era - 1))].name;

/** Display population: development times people per point for the realm's era. */
export const populationOf = (development: number, era: number) =>
  Math.round(
    development * ERAS[Math.max(0, Math.min(ERAS.length - 1, era - 1))].peoplePerDevelopment,
  );

/** Research needed to be first in the world to a breakthrough of this era. */
export const researchCost = (era: number) => Math.round(260 * era ** 0.8);
