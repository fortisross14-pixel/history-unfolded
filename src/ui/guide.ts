/**
 * The guided first game: ten steps through the first hours, each shown only when it is the next
 * thing to learn, and checked against the game itself (no step is ticked by reading it). The
 * player can hide the guide at any time; it is on for new games on Discovery and Standard.
 */
import { territory } from '../engine/game.ts';
import type { GameState } from '../engine/types.ts';

export interface GuideStep {
  id: string;
  title: string;
  hint: string;
  /** what "Show me" does */
  show:
    'settlers' | 'research' | 'city-dialog' | 'scouts' | 'city' | 'peoples' | 'culture' | 'victory';
  done: (s: GameState, civId: number) => boolean;
}

const mine = (s: GameState, civId: number) => s.cities.filter(c => c.civId === civId);
const explored = (s: GameState, civId: number) => s.civs[civId].explored.reduce((a, x) => a + x, 0);
const seen = (s: GameState, what: string) => !!s.guide?.seen.includes(what);

export const GUIDE: GuideStep[] = [
  {
    id: 'found',
    title: 'Found your first settlement',
    hint: 'Select your settlers and press Found city (B). Good spots have food, a river or coast, and room around them for districts.',
    show: 'settlers',
    done: (s, id) => mine(s, id).length >= 1,
  },
  {
    id: 'research',
    title: 'Choose what to research',
    hint: 'Science pays for techs that open buildings, gear and the next age. Pick one now; you can change it later.',
    show: 'research',
    done: (s, id) => !!s.civs[id].researching || s.civs[id].techs.length > 0,
  },
  {
    id: 'district',
    title: 'Plan a building',
    hint: 'Open your settlement (C) and place a building: a farm for food, or houses for more people. Production builds it over a few turns.',
    show: 'city-dialog',
    done: (s, id) => {
      const cities = new Set(mine(s, id).map(c => c.id));
      return s.districts.some(
        d => cities.has(d.cityId) && d.slots.some(x => x.type && x.type !== 'town-hall'),
      );
    },
  },
  {
    id: 'explore',
    title: 'Explore',
    hint: 'Select your scouts and press Explore, or click a far hex to send them there. You will find land, free peoples and neighbours.',
    show: 'scouts',
    done: (s, id) => explored(s, id) >= (s.guide?.explored0 ?? 60) * 2.5,
  },
  {
    id: 'road',
    title: 'Raise workers and build a road',
    hint: 'In your settlement panel choose Send workers. With them selected, press Build road (R) on the way to your next town: roads halve moves and join markets.',
    show: 'city',
    done: (s, id) => {
      const own = territory(s);
      return s.roads.some((r, h) => r && own[h] === id);
    },
  },
  {
    id: 'second',
    title: 'Found a second settlement',
    hint: 'A settlement of 2,000+ people can send settlers. Found the new one at least two hexes away, near food and goods you lack.',
    show: 'city',
    done: (s, id) => mine(s, id).length >= 2,
  },
  {
    id: 'meet',
    title: 'Meet your neighbours',
    hint: 'When your scouts meet another people, open Peoples (P): what they think of you, why, and what they intend.',
    show: 'peoples',
    done: (s, id) => s.civs[id].met.some(o => !s.civs[o].independent) && seen(s, 'peoples'),
  },
  {
    id: 'army',
    title: 'Raise a levy',
    hint: 'Raiders and rivals will come. Raise a levy in a settlement, and keep troops in your towns: a garrison keeps raiders away.',
    show: 'city',
    done: (s, id) =>
      s.formations
        .filter(f => f.civId === id && f.kind === 'army')
        .reduce((a, f) => a + f.cohorts.length, 0) >= 8,
  },
  {
    id: 'culture',
    title: 'Make a culture choice',
    hint: 'Open Culture (K) and spend your culture points. Each choice gives a bonus and shapes who your people are.',
    show: 'culture',
    done: (s, id) => s.civs[id].culture.taken.length > 0,
  },
  {
    id: 'victory',
    title: 'See how you can win',
    hint: 'Open Victory (V): the ways to win, when each opens, and who is close. Then the game is yours. The Codex (H) explains everything else.',
    show: 'victory',
    done: s => seen(s, 'victory'),
  },
];

/** The step to show now, with its number; null when the guide is done or off. */
export function guideStep(s: GameState, civId: number): { step: GuideStep; n: number } | null {
  if (!s.guide || s.guide.off) return null;
  const i = GUIDE.findIndex(g => !g.done(s, civId));
  return i < 0 ? null : { step: GUIDE[i], n: i + 1 };
}

/** Start the guide for a new game (on for Discovery and Standard). */
export function startGuide(s: GameState, civId: number) {
  if (s.guide) return;
  s.guide = {
    off: s.settings.difficulty === 'hard',
    seen: [],
    explored0: Math.max(30, explored(s, civId)),
  };
}

export function guideSeen(s: GameState, what: string) {
  if (s.guide && !s.guide.seen.includes(what)) s.guide.seen.push(what);
}
