import type { Civilization, GovernmentType, ModKey, Rank, WorldState } from '../types.ts';
import { addEvent } from './events.ts';

export interface GovernmentDef {
  type: GovernmentType;
  effect: string;
  mods: Partial<Record<ModKey, number>>;
}

/** Seven governments, each with clear effects that show in the breakdowns. */
export const GOVERNMENTS: GovernmentDef[] = [
  {
    type: 'Chiefdom',
    effect: 'Stability +4, research −15%',
    mods: { stability: 4, research: -0.15 },
  },
  { type: 'Monarchy', effect: 'Stability +5', mods: { stability: 5 } },
  {
    type: 'Theocracy',
    effect: 'Faith spread +30%, influence +15%, research −10%',
    mods: { faithSpread: 0.3, influence: 0.15, research: -0.1 },
  },
  {
    type: 'Merchant Republic',
    effect: 'Wealth +15%, army −10%',
    mods: { wealth: 0.15, army: -0.1 },
  },
  {
    type: 'Empire',
    effect: 'Army +10%, influence +10%, stability −5',
    mods: { army: 0.1, influence: 0.1, stability: -5 },
  },
  {
    type: 'Republic',
    effect: 'Research +10%, wealth +5%, war appetite −10%',
    mods: { research: 0.1, wealth: 0.05, warAppetite: -0.1 },
  },
  {
    type: 'Democracy',
    effect: 'Research +15%, growth +5%, stability +5, war appetite −30%',
    mods: { research: 0.15, growth: 0.05, stability: 5, warAppetite: -0.3 },
  },
];

export const governmentDef = (t: GovernmentType) => GOVERNMENTS.find(g => g.type === t)!;

const big = (r: Rank) => r === 'Kingdom' || r === 'Empire';

/** The government a realm drifts toward, from its era, size and national character. */
export function governmentFor(c: Civilization): GovernmentType {
  const a = c.axes;
  if (c.rank === 'Tribe' || c.rank === 'Settlement') return 'Chiefdom';
  if (a.faith < 22 && c.faithId) return 'Theocracy';
  if (a.economy > 72 && a.order > 50 && c.rank !== 'Empire') return 'Merchant Republic';
  if (c.era >= 5) {
    if (a.order < 30 && a.ambition > 65 && big(c.rank)) return 'Empire';
    if (c.stability > 55 || a.order > 55) return 'Democracy';
    return 'Republic';
  }
  if (c.era >= 4 && a.order > 62) return 'Republic';
  if (c.rank === 'Empire') return 'Empire';
  return 'Monarchy';
}

export function changeGovernment(
  s: WorldState,
  c: Civilization,
  to: GovernmentType,
  reason: string,
) {
  if (to === c.government) return;
  const old = c.government;
  const last = c.governmentHistory.at(-1);
  if (last) last.to = s.year;
  c.government = to;
  c.governmentHistory.push({ government: to, from: s.year, reason });
  addEvent(
    s,
    'politics',
    `${c.name} becomes a ${to}`,
    `${c.name} replaced its ${old} with a ${to} (${reason}). ${governmentDef(to).effect}.`,
    6,
    [c.id],
    {
      tags: ['government change'],
      worldChronicle: to === 'Democracy' || to === 'Empire',
    },
  );
}
