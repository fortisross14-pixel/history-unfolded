/**
 * National directions: a major choice a people makes on entering the Classical age and again
 * on entering the Renaissance. Each leaves a lasting legacy (its mods stay for the rest of the
 * game), brings one edict (an action with a cooldown) and works better with a culture tag the
 * people already leans to. Some Renaissance directions are alternate developments: they are
 * offered only to a people whose own history fits them.
 */
import type { Mods } from './mods.ts';

export interface NationalPath {
  id: string;
  name: string;
  /** the age it is chosen in: 2 Classical, 4 Renaissance */
  age: 2 | 4;
  pitch: string;
  mods: Partial<Mods>;
  /** a culture tag that strengthens it by half when the people holds it */
  synergy: string;
  edict: { name: string; text: string; gold: number; cooldown: number };
  /** an alternate development: offered only when this is true of the people (see paths.ts) */
  needs?: 'wealth' | 'conquest';
  /** what the player reads about the need */
  needsText?: string;
  /** the effects, as the player reads them */
  effects: string[];
}

export const PATH_LIST: NationalPath[] = [
  // ---- Classical: government and regional commerce
  {
    id: 'republic',
    name: 'Merchant Republic',
    age: 2,
    pitch: 'Councils and trade over crowns and taxes. Citizens are paid to fight.',
    mods: { goldPct: 12, culturePct: 5, upkeepPct: 10 },
    synergy: 'republican',
    edict: {
      name: 'Convene the Senate',
      text: 'Every house calms by 20 unrest.',
      gold: 30,
      cooldown: 20,
    },
    effects: ['+12% gold', '+5% culture', 'troops cost 10% more upkeep'],
  },
  {
    id: 'monarchy',
    name: 'Centralized Monarchy',
    age: 2,
    pitch: 'One crown, one law. The throne commands the levies and the walls.',
    mods: { levyCohorts: 1, guard: 1, upkeepPct: -10, goldPct: -5 },
    synergy: 'absolutist',
    edict: {
      name: 'Royal Levy',
      text: 'Raise a levy in your largest settlement at once.',
      gold: 20,
      cooldown: 15,
    },
    effects: ['+1 cohort per levy', '+1 city guard', '−10% upkeep', '−5% gold'],
  },
  {
    id: 'bureaucracy',
    name: 'Imperial Bureaucracy',
    age: 2,
    pitch: 'Scribes, censuses and roads. Taxation over trade.',
    mods: { sciencePct: 10, roadCost: -0.1, goldPct: 5 },
    synergy: 'rationalist',
    edict: {
      name: 'Census and Tax',
      text: '5 gold per 1,000 people in the realm; every house grows 10 more restless.',
      gold: 0,
      cooldown: 15,
    },
    effects: ['+10% science', '+5% gold', 'faster roads'],
  },
  // ---- Renaissance: overseas expansion and international commerce
  {
    id: 'companies',
    name: 'Chartered Companies',
    age: 4,
    pitch: 'Merchant companies with royal charters carry the flag across the sea.',
    mods: { coastalPct: 15, navalPct: 10, goldPct: 5 },
    synergy: 'maritime',
    edict: {
      name: 'Charter a Company',
      text: '25 gold for every coastal settlement.',
      gold: 0,
      cooldown: 20,
    },
    effects: ['+15% yields in coastal settlements', '+10% naval strength', '+5% gold'],
  },
  {
    id: 'colonial',
    name: 'Colonial Administration',
    age: 4,
    pitch: 'Governors, land grants and new towns on far shores.',
    mods: { growthPct: 15, housingPct: 10 },
    synergy: 'expansionist',
    edict: {
      name: 'Colonial Charter',
      text: 'Settlers leave your largest settlement without costing it people.',
      gold: 40,
      cooldown: 25,
    },
    effects: ['settlements grow 15% faster', '+10% housing'],
  },
  {
    id: 'reform',
    name: 'Religious Reform',
    age: 4,
    pitch: 'New teachings, printed in the common tongue. Faith becomes a nation’s own.',
    mods: { culturePct: 15, cultureCostPct: -10 },
    synergy: 'devout',
    edict: {
      name: 'Reformation Sermons',
      text: '+25 culture; every house calms by 10 unrest.',
      gold: 25,
      cooldown: 20,
    },
    effects: ['+15% culture', 'culture choices 10% cheaper'],
  },
  {
    id: 'commercial-renaissance',
    name: 'Commercial Renaissance',
    age: 4,
    pitch: 'Banks, bills of exchange and great fairs: your wealth becomes your power.',
    mods: { goldPct: 20, prodPct: 10 },
    synergy: 'mercantile',
    needs: 'wealth',
    needsText: 'for a people making a quarter of the world’s wealth',
    edict: { name: 'Great Fair', text: '+60 gold and +10 culture.', gold: 0, cooldown: 20 },
    effects: ['+20% gold', '+10% production'],
  },
  {
    id: 'age-of-conquest',
    name: 'Age of Conquest',
    age: 4,
    pitch: 'Gunpowder, drill and ambition: the sword writes the next chapter.',
    mods: { attackPct: 10, siegePct: 15, morale: 1 },
    synergy: 'martial',
    needs: 'conquest',
    needsText: 'for a people that has taken settlements in war',
    edict: {
      name: 'Muster the Hosts',
      text: 'Raise a levy in each of your two largest settlements.',
      gold: 40,
      cooldown: 25,
    },
    effects: ['+10% attack', '+15% when assaulting cities', '+1 morale'],
  },
];

export const PATHS: Record<string, NationalPath> = Object.fromEntries(
  PATH_LIST.map(p => [p.id, p]),
);

/** What each age brings, for the "Entering the age" card. */
export const AGE_SYSTEMS: Record<number, { system: string; text: string }> = {
  2: {
    system: 'Government and regional commerce',
    text: 'Choose how your realm is governed. Markets joined by roads now carry the realm’s trade.',
  },
  3: {
    system: 'Feudal obligations and political power',
    text: 'Noble houses claim their due. Roads now need workers raised in your settlements; castles and plate arrive.',
  },
  4: {
    system: 'Overseas expansion and international commerce',
    text: 'Choose your realm’s direction across the sea. Cultural domination and Economic dominance can now be won.',
  },
  5: {
    system: 'Industrial transformation',
    text: 'Engineers, steam, steel and oil. The Diplomatic federation and the Scientific projects can now be won.',
  },
};
