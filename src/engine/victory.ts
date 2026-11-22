/**
 * The ways to win. Conquest is open from the start; Cultural and Economic open for a people when
 * it enters the Renaissance, Diplomatic and Scientific in the Industrial age. The dominance
 * victories must be held for HOLD turns, so rivals see them coming and can answer. At the turn
 * limit the best score wins.
 */
import { ageOf, ERAS, TECH_LIST } from '../data/techs.ts';
import { alliesOf } from './diplomacy.ts';
import type { Civ, GameState } from './types.ts';

export type VictoryKind = 'conquest' | 'cultural' | 'economic' | 'diplomatic' | 'scientific';

export interface VictoryInfo {
  id: VictoryKind;
  name: string;
  /** the age (1 Ancient … 5 Industrial) in which it opens for a people */
  opensAt: number;
  goal: string;
  /** turns the goal must be held; 0 = wins at once */
  hold: number;
}

export const HOLD = 10;
export const CULTURE_SHARE = 0.4;
export const GDP_SHARE = 0.5;
export const LEAGUE_SHARE = 0.5;

export const VICTORIES: VictoryInfo[] = [
  {
    id: 'conquest',
    name: 'Conquest',
    opensAt: 1,
    goal: 'Be the last great people standing.',
    hold: 0,
  },
  {
    id: 'cultural',
    name: 'Cultural domination',
    opensAt: 4,
    goal: `Make ${CULTURE_SHARE * 100}% of the world's culture each turn, for ${HOLD} turns.`,
    hold: HOLD,
  },
  {
    id: 'economic',
    name: 'Economic dominance',
    opensAt: 4,
    goal: `Make ${GDP_SHARE * 100}% of the world's wealth (GDP) each turn, for ${HOLD} turns.`,
    hold: HOLD,
  },
  {
    id: 'diplomatic',
    name: 'Diplomatic federation',
    opensAt: 5,
    goal: `Lead a league of allies holding over ${LEAGUE_SHARE * 100}% of the world's people, as its largest member, for ${HOLD} turns.`,
    hold: HOLD,
  },
  {
    id: 'scientific',
    name: 'Scientific',
    opensAt: 5,
    goal: 'Know every Industrial tech, then complete three national projects: Great Observatory, Transcontinental Telegraph, First Powered Flight.',
    hold: 0,
  },
];

export const VICTORY: Record<VictoryKind, VictoryInfo> = Object.fromEntries(
  VICTORIES.map(v => [v.id, v]),
) as Record<VictoryKind, VictoryInfo>;

export const PROJECTS = TECH_LIST.filter(t => t.project).sort((a, b) => a.project! - b.project!);

const great = (s: GameState) => s.civs.filter(c => c.alive && !c.independent);
const popOf = (s: GameState, civId: number) =>
  s.cities.filter(c => c.civId === civId).reduce((a, c) => a + c.pop, 0);

export const isOpen = (civ: Civ, v: VictoryInfo) => ageOf(civ.techs) >= v.opensAt;
export const opensText = (v: VictoryInfo) =>
  v.opensAt <= 1 ? 'Open from the start' : `Opens in the ${ERAS[v.opensAt]} age`;

/** How close a people is to a victory: 0..1, whether the goal is met now, and a line to read. */
export function progress(
  s: GameState,
  civ: Civ,
  kind: VictoryKind,
): { value: number; met: boolean; text: string } {
  switch (kind) {
    case 'conquest': {
      const start = s.civs.filter(c => !c.independent).length - 1;
      const left = great(s).filter(c => c.id !== civ.id).length;
      return {
        value: start ? 1 - left / start : 1,
        met: left === 0,
        text: `${left} rival ${left === 1 ? 'people remains' : 'peoples remain'}`,
      };
    }
    case 'cultural': {
      const world = great(s).reduce((a, c) => a + (c.stats?.culture ?? 0), 0);
      const share = world ? (civ.stats?.culture ?? 0) / world : 0;
      return {
        value: Math.min(1, share / CULTURE_SHARE),
        met: share >= CULTURE_SHARE,
        text: `${Math.round(share * 100)}% of the world's culture (goal ${CULTURE_SHARE * 100}%)`,
      };
    }
    case 'economic': {
      // the world economy counts free peoples too
      const world = s.civs.filter(c => c.alive).reduce((a, c) => a + (c.stats?.gdp ?? 0), 0);
      const share = world ? (civ.stats?.gdp ?? 0) / world : 0;
      return {
        value: Math.min(1, share / GDP_SHARE),
        met: share >= GDP_SHARE,
        text: `${Math.round(share * 100)}% of world GDP (goal ${GDP_SHARE * 100}%)`,
      };
    }
    case 'diplomatic': {
      const league = [civ.id, ...alliesOf(s, civ.id)];
      const world = s.civs.filter(c => c.alive).reduce((a, c) => a + popOf(s, c.id), 0);
      const pops = league.map(id => popOf(s, id));
      const share = world ? pops.reduce((a, b) => a + b, 0) / world : 0;
      const leads = pops[0] >= Math.max(...pops);
      return {
        value: Math.min(1, share / LEAGUE_SHARE) * (leads ? 1 : 0.9),
        met: share > LEAGUE_SHARE && leads && league.length > 1,
        text: `League of ${league.length} holds ${Math.round(share * 100)}% of the world's people${leads ? '' : ', but you are not its largest member'}`,
      };
    }
    case 'scientific': {
      const done = PROJECTS.filter(p => civ.techs.includes(p.id)).length;
      const ind = TECH_LIST.filter(t => t.era === 5 && !t.project);
      const known = ind.filter(t => civ.techs.includes(t.id)).length;
      return {
        value: (known / ind.length) * 0.4 + (done / PROJECTS.length) * 0.6,
        met: done === PROJECTS.length,
        text: `${known}/${ind.length} Industrial techs, ${done}/${PROJECTS.length} national projects`,
      };
    }
  }
}

/**
 * Called each turn: track who holds which goal; returns the winner once a goal has been held
 * long enough, and lines for the player when a rival starts or loses a hold.
 */
export function victoryTurn(s: GameState): {
  winner?: { civId: number; kind: VictoryKind };
  news: string[];
} {
  s.holding ??= {};
  const news: string[] = [];
  const me = s.civs.find(c => c.isPlayer);
  for (const v of VICTORIES) {
    if (v.id === 'conquest') continue;
    const holder = great(s).find(c => isOpen(c, v) && progress(s, c, v.id).met);
    const was = s.holding[v.id];
    if (!holder) {
      if (was && me && was.civId !== me.id)
        news.push(`The ${s.civs[was.civId].name} no longer hold the ${v.name} goal.`);
      delete s.holding[v.id];
      continue;
    }
    if (!was || was.civId !== holder.id) {
      s.holding[v.id] = { civId: holder.id, since: s.turn };
      if (v.hold && me)
        news.push(
          holder.id === me.id
            ? `You hold the ${v.name} goal: keep it ${v.hold} turns to win.`
            : `Warning: the ${holder.name} hold the ${v.name} goal. In ${v.hold} turns they win.`,
        );
    }
    if (s.turn - s.holding[v.id].since >= v.hold)
      return { winner: { civId: holder.id, kind: v.id }, news };
  }
  return { news };
}

/** Turns left before the holder of a goal wins it, or null when nobody holds it. */
export function holdLeft(s: GameState, kind: VictoryKind): { civId: number; left: number } | null {
  const h = s.holding?.[kind];
  if (!h) return null;
  return { civId: h.civId, left: Math.max(0, VICTORY[kind].hold - (s.turn - h.since)) };
}
