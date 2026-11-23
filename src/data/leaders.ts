/**
 * Leader personalities: every great AI people has one, shown to the player, and it changes how
 * the AI judges war and peace and what it thinks of others (see ai.ts and diplomacy.ts).
 */
import { hashSeed } from '../engine/rng.ts';

export type PersonalityId =
  'conqueror' | 'builder' | 'merchant' | 'zealot' | 'diplomat' | 'opportunist';

export interface Personality {
  id: PersonalityId;
  name: string;
  /** one line the player reads */
  note: string;
  /** chance of looking for a war, times the difficulty's */
  war: number;
  /** the edge in strength it wants before attacking, times the difficulty's */
  margin: number;
}

export const PERSONALITIES: Record<PersonalityId, Personality> = {
  conqueror: {
    id: 'conqueror',
    name: 'Conqueror',
    note: 'Sees weakness as an invitation: looks for wars more often and attacks with less of an edge.',
    war: 1.8,
    margin: 0.85,
  },
  builder: {
    id: 'builder',
    name: 'Builder',
    note: 'Wants peace to build and grow: rarely starts a war, and needs a large edge to do it.',
    war: 0.5,
    margin: 1.25,
  },
  merchant: {
    id: 'merchant',
    name: 'Merchant',
    note: 'Values trade above all: trading partners are friends, and war is bad for business.',
    war: 0.7,
    margin: 1.1,
  },
  zealot: {
    id: 'zealot',
    name: 'Zealot',
    note: 'Judges everyone by their faith: warm to those who share it, cold to those who do not.',
    war: 1.1,
    margin: 1,
  },
  diplomat: {
    id: 'diplomat',
    name: 'Diplomat',
    note: 'Keeps its word and values pacts and alliances; slow to anger.',
    war: 0.7,
    margin: 1.15,
  },
  opportunist: {
    id: 'opportunist',
    name: 'Opportunist',
    note: 'Strikes whoever is already busy fighting someone else.',
    war: 1.2,
    margin: 1,
  },
};

const ORDER: PersonalityId[] = [
  'conqueror',
  'builder',
  'merchant',
  'zealot',
  'diplomat',
  'opportunist',
];

/** A people's leader personality: fixed for the game by the seed (none for the player or free peoples). */
export function personalityOf(
  seed: number,
  civ: { id: number; isPlayer: boolean; independent?: boolean },
): Personality | null {
  if (civ.isPlayer || civ.independent) return null;
  return PERSONALITIES[ORDER[hashSeed(seed, civ.id * 977 + 41) % ORDER.length]];
}
