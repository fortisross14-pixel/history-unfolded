/**
 * Which ruler's portrait a people shows: one of the rulers of its age, the raider chief for
 * raiders. Keys match art/map-sheets.json.
 */
import { ageOf } from '../data/techs.ts';
import type { Civ, GameState } from '../engine/types.ts';

const PER_AGE: Record<number, string[]> = {
  1: ['ancient-1', 'ancient-2', 'ancient-3', 'ancient-4'],
  2: ['classical-1', 'classical-2', 'classical-3', 'classical-4'],
  3: ['medieval-1', 'medieval-2', 'medieval-3', 'medieval-4'],
  4: ['renaissance-1', 'renaissance-2', 'renaissance-3', 'renaissance-4'],
  5: ['industrial-1', 'industrial-2', 'industrial-3'],
};

/**
 * The ruler's portrait key for a people. Peoples take the age's portraits in turn (by their place
 * among the great peoples, shifted by the map seed), so neighbours do not share a face until there
 * are more peoples than portraits.
 */
export function leaderArt(s: GameState, c: Civ): string {
  if (c.raiders) return 'leader/raider';
  const list = PER_AGE[Math.min(5, Math.max(1, ageOf(c.techs)))];
  const great = s.civs.filter(x => !x.independent && !x.raiders);
  const place = Math.max(0, great.indexOf(c));
  return `leader/${list[(place + s.settings.map.seed) % list.length]}`;
}
