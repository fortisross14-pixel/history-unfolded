/**
 * Faiths: the tenets a founder chooses, and names for new faiths. Kept in a data file so the
 * mods can read tenets without pulling in the engine (see engine/faith.ts for the rules).
 */
import type { Mods } from './mods.ts';

export type TenetSlot = 'founding' | 'teaching' | 'doctrine';

export interface Tenet {
  id: string;
  slot: TenetSlot;
  name: string;
  /** what it does, in one line */
  note: string;
  /** a realm bonus: for the founder (founding) or every people that keeps the faith */
  mods?: Partial<Mods>;
  /** faith spreads this much faster (1 = normal) */
  spread?: number;
  /** gold a turn to the founder per follower settlement, anywhere */
  tithe?: number;
  /** culture a turn to the founder per follower settlement of another people */
  pilgrims?: number;
  /** culture tags the AI likes it with */
  tags?: string[];
}

/** When each tenet is chosen. */
export const TENET_SLOTS: { slot: TenetSlot; name: string; tech: string | null; who: string }[] = [
  { slot: 'founding', name: 'Founding belief', tech: null, who: 'rewards the founder' },
  { slot: 'teaching', name: 'Teaching', tech: 'priesthood', who: 'every people that keeps it' },
  { slot: 'doctrine', name: 'Doctrine', tech: 'theology', who: 'every people that keeps it' },
];

export const TENETS: Record<string, Tenet> = Object.fromEntries(
  (
    [
      // founding beliefs: what the founder gains as the faith spreads
      {
        id: 'tithes',
        slot: 'founding',
        name: 'Tithes',
        note: '+½ gold a turn for every settlement that keeps the faith, anywhere.',
        tithe: 0.5,
        tags: ['mercantile'],
      },
      {
        id: 'pilgrims',
        slot: 'founding',
        name: 'Pilgrimage',
        note: '+1 culture a turn for every settlement of another people that keeps the faith.',
        pilgrims: 1,
        tags: ['devout'],
      },
      {
        id: 'missionaries',
        slot: 'founding',
        name: 'Missionaries',
        note: 'The faith spreads half again as fast.',
        spread: 1.5,
        tags: ['tolerant'],
      },
      {
        id: 'holy-warriors',
        slot: 'founding',
        name: 'Holy Warriors',
        note: "+5 morale for the founder's armies.",
        mods: { morale: 5 },
        tags: ['zealous', 'martial'],
      },
      // teachings: every people whose faith it is
      {
        id: 'feasts',
        slot: 'teaching',
        name: 'Holy Feasts',
        note: '+10% growth.',
        mods: { growthPct: -10 },
      },
      {
        id: 'temple-schools',
        slot: 'teaching',
        name: 'Temple Schools',
        note: '+5% science and +5% culture.',
        mods: { sciencePct: 5, culturePct: 5 },
        tags: ['rationalist'],
      },
      {
        id: 'charity',
        slot: 'teaching',
        name: 'Charity',
        note: 'Tension builds 15% slower.',
        mods: { tensionPct: -15 },
        tags: ['tolerant'],
      },
      {
        id: 'sacred-labour',
        slot: 'teaching',
        name: 'Sacred Labour',
        note: '+5% production.',
        mods: { prodPct: 5 },
      },
      // doctrines
      {
        id: 'cathedral-light',
        slot: 'doctrine',
        name: 'Glory to the Heavens',
        note: '+10% culture.',
        mods: { culturePct: 10 },
        tags: ['devout'],
      },
      {
        id: 'just-war',
        slot: 'doctrine',
        name: 'Just War',
        note: '+10% damage when defending your own land.',
        mods: { homePct: 10 },
        tags: ['martial'],
      },
      {
        id: 'reformed',
        slot: 'doctrine',
        name: 'Reformed Teaching',
        note: '+10% science.',
        mods: { sciencePct: 10 },
        tags: ['rationalist'],
      },
      {
        id: 'mission-orders',
        slot: 'doctrine',
        name: 'Mission Orders',
        note: 'The faith spreads a quarter faster and +5% gold.',
        spread: 1.25,
        mods: { goldPct: 5 },
        tags: ['mercantile'],
      },
    ] as Tenet[]
  ).map(t => [t.id, t]),
);

export const tenetsFor = (slot: TenetSlot) => Object.values(TENETS).filter(t => t.slot === slot);

/** Words for faith names: a form and a sacred word. */
const FORMS = [
  'The Way of',
  'The Light of',
  'Children of',
  'The Path of',
  'Keepers of',
  'The Word of',
];
const WORDS = [
  'the Sun',
  'the Sky Father',
  'the Deep Waters',
  'the Ancestors',
  'the Flame',
  'the Mountain',
  'the Harvest',
  'the Star',
  'the Twin Moons',
  'the Great Tree',
  'the Silent One',
  'the Dawn',
];

/** A name not taken yet, picked by a number (seeded by the caller). */
export function faithName(n: number, taken: string[]): string {
  for (let k = 0; k < FORMS.length * WORDS.length; k++) {
    const i = (n + k * 7) % (FORMS.length * WORDS.length);
    const word = WORDS[Math.floor(i / FORMS.length) % WORDS.length];
    const name = `${FORMS[i % FORMS.length]} ${word}`;
    if (!taken.some(t => t.endsWith(word))) return name;
  }
  return `Faith ${taken.length + 1}`;
}
