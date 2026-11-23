/**
 * World wonders: one in the whole world each, built by whoever finishes first (engine/wonders.ts).
 * Each gives its holder a realm bonus and culture every turn; it changes hands with its city.
 */
import type { Mods } from './mods.ts';

export interface WonderDef {
  id: string;
  name: string;
  /** the tech that opens it */
  tech: string;
  /** production to finish it */
  prod: number;
  /** goods paid when work starts */
  goods: Record<string, number>;
  /** needs a coastal settlement */
  coast?: boolean;
  mods: Partial<Mods>;
  note: string;
  /** the landmark drawn on the map */
  shape: 'pyramid' | 'tower' | 'statue' | 'dome' | 'wall' | 'hall' | 'garden' | 'spire';
  /** culture tags the AI likes it with */
  tags?: string[];
}

/** culture a turn from every wonder its holder has */
export const WONDER_CULTURE = 2;
/** score per wonder held */
export const WONDER_SCORE = 5;

export const WONDER_LIST: WonderDef[] = [
  // ancient
  {
    id: 'great-pyramid',
    name: 'Great Pyramid',
    tech: 'masonry',
    prod: 90,
    goods: { stone: 6 },
    mods: { prodPct: 5, workers: 2 },
    note: '+5% production; 2% more of your people can work.',
    shape: 'pyramid',
  },
  {
    id: 'hanging-gardens',
    name: 'Hanging Gardens',
    tech: 'irrigation',
    prod: 90,
    goods: { wood: 4, stone: 3 },
    mods: { growthPct: 15 },
    note: '+15% growth in every settlement.',
    shape: 'garden',
    tags: ['agrarian'],
  },
  // classical
  {
    id: 'great-library',
    name: 'Great Library',
    tech: 'literature',
    prod: 160,
    goods: { stone: 6, wood: 4 },
    mods: { researchPct: -10 },
    note: 'Research costs 10% less.',
    shape: 'hall',
    tags: ['rationalist'],
  },
  {
    id: 'great-wall',
    name: 'Great Wall',
    tech: 'construction',
    prod: 170,
    goods: { stone: 10 },
    mods: { cityDefensePct: 25, homePct: 5 },
    note: 'Settlements defend 25% better; +5% fighting at home.',
    shape: 'wall',
    tags: ['martial'],
  },
  // medieval
  {
    id: 'dome-of-heaven',
    name: 'Dome of Heaven',
    tech: 'theology',
    prod: 260,
    goods: { stone: 12, wood: 4 },
    mods: { culturePct: 15, tensionPct: -10 },
    note: '+15% culture; tension builds 10% slower.',
    shape: 'dome',
    tags: ['devout'],
  },
  {
    id: 'grand-bazaar',
    name: 'Grand Bazaar',
    tech: 'guilds',
    prod: 240,
    goods: { stone: 8, wood: 6 },
    mods: { goldPct: 12 },
    note: '+12% gold.',
    shape: 'hall',
    tags: ['mercantile'],
  },
  // renaissance
  {
    id: 'house-of-printing',
    name: 'House of Printing',
    tech: 'printing',
    prod: 400,
    goods: { stone: 10, wood: 8 },
    mods: { sciencePct: 10, cultureCostPct: -10 },
    note: '+10% science; culture costs 10% less.',
    shape: 'hall',
    tags: ['rationalist'],
  },
  {
    id: 'admiralty',
    name: 'Grand Admiralty',
    tech: 'cartography',
    prod: 380,
    goods: { wood: 12, iron: 4 },
    coast: true,
    mods: { navalPct: 25, commandCap: 1 },
    note: '+25% at sea, one more cohort under each command.',
    shape: 'tower',
    tags: ['maritime', 'expansionist'],
  },
  // industrial
  {
    id: 'crystal-palace',
    name: 'Crystal Palace',
    tech: 'machine-tools',
    prod: 600,
    goods: { iron: 10, stone: 8 },
    mods: { prodPct: 10, goldPct: 5 },
    note: '+10% production, +5% gold.',
    shape: 'spire',
  },
  {
    id: 'grand-terminus',
    name: 'Grand Terminus',
    tech: 'railways',
    prod: 600,
    goods: { iron: 12, stone: 10 },
    mods: { prodPct: 5, goldPct: 10 },
    note: '+5% production, +10% gold.',
    shape: 'spire',
    tags: ['mercantile'],
  },
];

export const WONDERS: Record<string, WonderDef> = Object.fromEntries(
  WONDER_LIST.map(w => [w.id, w]),
);
