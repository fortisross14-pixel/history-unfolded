/**
 * Dynasties: the great houses of a people. One rules at the start; two more rise in the second
 * age once the realm has grown, one more in each later age, up to five. Houses govern
 * settlements and specialise through trinkets earned by building. A house strong enough to
 * outweigh the throne grows restless and may rise in civil war. Under Democracy the houses
 * become parties: easier to manage, but their bonuses are smaller.
 */
import type { Line } from './slots.ts';

export const MAX_DYNASTIES = 5;

/** Per trinket of a line: this much more to that line in the settlements the house governs. */
export const TRINKET_PCT = 10;
/** The ruling house lends this share of its trinket bonuses to every settlement of the realm. */
export const COURT_SHARE = 0.5;
/** Under Democracy trinket bonuses fall to this share, and unrest grows this much slower. */
export const DEMOCRACY_BONUS = 0.4;
export const DEMOCRACY_UNREST = 0.25;
/** A finished building of a line gives a trinket of that line with this chance. */
export const TRINKET_CHANCE = 0.12;
/** Unrest at which a house rises against the throne, and how long a civil war lasts. */
export const REVOLT_AT = 100;
export const CIVIL_WAR_TURNS = 8;
/** Gold to grant a house honours, per settlement of the realm, and the unrest it takes away. */
export const HONOURS_GOLD = 15;
export const HONOURS_CALM = 35;

export const HOUSE_NAMES = [
  'Aurel',
  'Varn',
  'Ostric',
  'Teleme',
  'Corvan',
  'Halvard',
  'Mereth',
  'Sabine',
  'Dornac',
  'Ilvane',
  'Kastor',
  'Ruthen',
  'Belisar',
  'Ondre',
  'Fennick',
  'Lothar',
  'Severin',
  'Amalric',
  'Tavish',
  'Zoran',
  'Aldren',
  'Brisca',
  'Calloway',
  'Desmar',
  'Eskel',
  'Faramund',
  'Gondric',
  'Hesper',
  'Isolde',
  'Jaravet',
  'Kendral',
  'Lucan',
  'Morvane',
  'Norrick',
  'Orsolya',
  'Pellam',
  'Quill',
  'Rosmer',
  'Sandor',
  'Thessaly',
];

export const HOUSE_COLORS = ['#7a2a3a', '#2f5d8a', '#4f7a3a', '#a06a1f', '#5a3d7a'];

/** Trinket names by line: what a house treasures, and what it is good at. */
export const TRINKETS: Record<Line, string[]> = {
  food: ['Seed chest', 'Golden sickle', 'Harvest crown', 'Plough of the founders', 'Herd book'],
  wood: ['Forester’s horn', 'Oak charter', 'Woodsman’s axe', 'Map of the old groves'],
  mining: ['Miner’s lamp', 'Assay scales', 'Vein map', 'Silver pick', 'Deep-shaft key'],
  research: ['Astrolabe', 'Star chart', 'Ground lens', 'Codex of the sages', 'Brass orrery'],
  culture: ['Holy relic', 'Gilded lyre', 'Illuminated psalter', 'Icon of the founders', 'Mask'],
  gold: ['Abacus', 'Ledger of debts', 'Merchant’s seal', 'Gold balance', 'Bill of credit'],
  industry: ['Master’s anvil', 'Bellows', 'Guild charter', 'Pattern book', 'Steel die'],
};
