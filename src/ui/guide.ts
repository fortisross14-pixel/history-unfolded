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
    title: 'Found a settlement',
    hint: 'Settlers → Found city. Food, river, coast.',
    show: 'settlers',
    done: (s, id) => mine(s, id).length >= 1,
  },
  {
    id: 'research',
    title: 'Pick research',
    hint: 'Choose a tech. Change it any time.',
    show: 'research',
    done: (s, id) => !!s.civs[id].researching || s.civs[id].techs.length > 0,
  },
  {
    id: 'district',
    title: 'Plan a building',
    hint: 'Farm for food, houses for people.',
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
    hint: 'Scouts → Explore, or send them far.',
    show: 'scouts',
    done: (s, id) => explored(s, id) >= (s.guide?.explored0 ?? 60) * 2.5,
  },
  {
    id: 'road',
    title: 'Build a road',
    hint: 'Send workers → Build road toward towns.',
    show: 'city',
    done: (s, id) => {
      const own = territory(s);
      return s.roads.some((r, h) => r && own[h] === id);
    },
  },
  {
    id: 'second',
    title: 'Second settlement',
    hint: '2,000+ people: settlers. Two hexes away.',
    show: 'city',
    done: (s, id) => mine(s, id).length >= 2,
  },
  {
    id: 'meet',
    title: 'Meet neighbours',
    hint: 'Met a people? Open Peoples.',
    show: 'peoples',
    done: (s, id) => s.civs[id].met.some(o => !s.civs[o].independent) && seen(s, 'peoples'),
  },
  {
    id: 'army',
    title: 'Raise a levy',
    hint: 'Levy in a settlement; garrison your towns.',
    show: 'city',
    done: (s, id) =>
      s.formations
        .filter(f => f.civId === id && f.kind === 'army')
        .reduce((a, f) => a + f.cohorts.length, 0) >= 8,
  },
  {
    id: 'culture',
    title: 'Culture Tome',
    hint: 'Open Culture, choose a Tome, buy a mission.',
    show: 'culture',
    done: (s, id) =>
      (s.civs[id].culture.tome?.taken.length ?? 0) > 0 || s.civs[id].culture.taken.length > 0,
  },
  {
    id: 'victory',
    title: 'Ways to win',
    hint: 'Open Victory. Codex explains the rest.',
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
