/**
 * Three difficulty presets. Difficulty changes how able and how forgiving the opponents are,
 * never which mechanics exist: every age, tech, culture choice, event and victory is open on
 * all three. The numbers are shown to the player on the New game screen.
 */
import type { Civ, GameState } from './types.ts';

export type Difficulty = 'casual' | 'normal' | 'hard';

export interface DifficultyProfile {
  id: Difficulty;
  name: string;
  /** what the player can expect, one line */
  promise: string;
  /** gold, science and culture of AI peoples, as a multiplier */
  aiYield: number;
  /** no AI declares war on the player before this turn */
  peaceWithPlayerUntil: number;
  /** no AI declares any war before this turn */
  firstWarTurn: number;
  /** chance per turn an AI at peace looks for a war */
  warChance: number;
  /** how much stronger than its target an AI wants to be (×) before it attacks */
  warMargin: number;
  /** extra gold and levy cohorts for the player at the start */
  startGold: number;
  startCohorts: number;
  /** weight of harmful realm events (blight, plague, fire, bandits, flood) */
  harshEvents: number;
  /** how fast the player's houses grow restless */
  unrestRate: number;
  /** the modifiers as the player reads them */
  notes: string[];
}

export const DIFFICULTIES: Record<Difficulty, DifficultyProfile> = {
  casual: {
    id: 'casual',
    name: 'Discovery',
    promise: 'Learn, explore and recover from mistakes.',
    aiYield: 0.85,
    peaceWithPlayerUntil: 60,
    firstWarTurn: 40,
    warChance: 0.04,
    warMargin: 1.4,
    startGold: 50,
    startCohorts: 2,
    harshEvents: 0.5,
    unrestRate: 0.8,
    notes: [
      'Rivals earn 15% less gold, science and culture',
      'No rival attacks you before turn 60',
      '+50 gold and 2 more levy cohorts at the start',
      'Fewer harmful events; houses calm down faster',
    ],
  },
  normal: {
    id: 'normal',
    name: 'Standard',
    promise: 'Competitive rivals playing by the same rules as you.',
    aiYield: 1,
    peaceWithPlayerUntil: 30,
    firstWarTurn: 30,
    warChance: 0.06,
    warMargin: 1,
    startGold: 0,
    startCohorts: 0,
    harshEvents: 1,
    unrestRate: 1,
    notes: ['Everyone starts even', 'Rivals go to war when they feel strong enough'],
  },
  hard: {
    id: 'hard',
    name: 'Veteran',
    promise: 'Pressure from early on; adapting is rewarded.',
    aiYield: 1.15,
    peaceWithPlayerUntil: 25,
    firstWarTurn: 25,
    warChance: 0.08,
    warMargin: 0.85,
    startGold: 0,
    startCohorts: 0,
    harshEvents: 1.3,
    unrestRate: 1.15,
    notes: [
      'Rivals earn 15% more gold, science and culture',
      'Rivals attack sooner and with a smaller edge',
      'More harmful events; houses grow restless faster',
      'Same map, same information: no hidden vision',
    ],
  },
};

export const DIFFICULTY_ORDER: Difficulty[] = ['casual', 'normal', 'hard'];

/** The game's profile; saves from before difficulty existed play as Normal. */
export const difficultyOf = (s: GameState): DifficultyProfile =>
  DIFFICULTIES[s.settings.difficulty ?? 'normal'] ?? DIFFICULTIES.normal;

/** Yield multiplier for a people: the AI's handicap or edge; the player is always 1. */
export const yieldFactor = (s: GameState, civ: Civ): number =>
  civ.isPlayer ? 1 : difficultyOf(s).aiYield;
