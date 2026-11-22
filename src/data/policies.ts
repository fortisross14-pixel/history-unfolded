/**
 * Age policies: every age brings one question the realm must keep answering, as a lever with
 * three positions. The middle is balanced (no effect); each side gives something and costs
 * something. Policies from earlier ages stay in force, so a late realm pulls five levers.
 * A lever can be moved again POLICY_COOLDOWN turns after it was last moved.
 */
import type { Mods } from './mods.ts';

export const POLICY_COOLDOWN = 10;

export interface PolicySide {
  name: string;
  mods: Partial<Mods>;
  /** noble houses' unrest each turn (negative calms them) */
  unrest?: number;
  /** settlers cost this much more (+) or less (−), as a fraction */
  settlerCost?: number;
  /** crisis pressure multipliers by crisis id */
  pressure?: Record<string, number>;
  /** the effects, as the player reads them */
  effects: string;
}

export interface Policy {
  id: string;
  name: string;
  /** the age it opens in */
  age: number;
  question: string;
  /** -1 (left), +1 (right); the middle is balanced */
  left: PolicySide;
  right: PolicySide;
}

export const POLICY_LIST: Policy[] = [
  {
    id: 'way-of-life',
    name: 'Way of Life',
    age: 1,
    question: 'Wander and claim new land, or settle and grow?',
    left: {
      name: 'Migratory',
      mods: { sight: 1, growthPct: -10 },
      settlerCost: -0.25,
      effects: 'Settlers cost 25% fewer people; +1 sight; growth −10%',
    },
    right: {
      name: 'Settled',
      mods: { growthPct: 10, foodPct: 5 },
      settlerCost: 0.25,
      effects: 'Growth +10%; food +5%; settlers cost 25% more people',
    },
  },
  {
    id: 'revenue',
    name: 'Revenue',
    age: 2,
    question: 'Let trade and people flourish, or tax them hard?',
    left: {
      name: 'Light Taxes',
      mods: { growthPct: 10, culturePct: 5, goldPct: -10 },
      effects: 'Growth +10%; culture +5%; gold −10%',
    },
    right: {
      name: 'Heavy Taxes',
      mods: { goldPct: 15 },
      unrest: 1,
      pressure: { debt: 0.7 },
      effects: 'Gold +15%; noble houses +1 unrest a turn; debt less likely',
    },
  },
  {
    id: 'feudal-balance',
    name: 'Feudal Balance',
    age: 3,
    question: 'Leave the nobles their lands, or bind them to the crown?',
    left: {
      name: 'Noble Autonomy',
      mods: { levyCohorts: -1 },
      unrest: -1,
      effects: 'Noble houses −1 unrest a turn; levies 1 cohort smaller',
    },
    right: {
      name: 'Royal Authority',
      mods: { levyCohorts: 1, guard: 1 },
      unrest: 1.5,
      effects: 'Levies 1 cohort larger; +1 city guard; noble houses +1.5 unrest a turn',
    },
  },
  {
    id: 'trade-policy',
    name: 'Trade Policy',
    age: 4,
    question: 'Guard your markets, or open them to the world?',
    left: {
      name: 'Mercantilism',
      mods: { prodPct: 10, goldPct: 5, culturePct: -5 },
      pressure: { plague: 0.8 },
      effects: 'Production +10%; gold +5%; culture −5%; plague less likely',
    },
    right: {
      name: 'Free Trade',
      mods: { goldPct: 10, sciencePct: 10 },
      pressure: { plague: 1.25 },
      effects: 'Gold +10%; science +10% (ideas travel); plague more likely',
    },
  },
  {
    id: 'labour',
    name: 'Labour',
    age: 5,
    question: 'Drive the factories hard, or look after the workers?',
    left: {
      name: 'Laissez-faire',
      mods: { prodPct: 15 },
      pressure: { strikes: 1.5 },
      effects: 'Production +15%; strikes far more likely',
    },
    right: {
      name: 'Welfare',
      mods: { goldPct: -10, growthPct: 10 },
      pressure: { strikes: 0.5 },
      effects: 'Growth +10%; gold −10%; strikes half as likely',
    },
  },
];

export const POLICIES: Record<string, Policy> = Object.fromEntries(POLICY_LIST.map(p => [p.id, p]));

/** The side a lever sits on, or null when balanced. */
export const sideOf = (p: Policy, pos: number | undefined): PolicySide | null =>
  pos === -1 ? p.left : pos === 1 ? p.right : null;

/** The sides a people's levers sit on (balanced levers left out). */
export function policySides(civ: { policies?: Record<string, { pos: number }> }): PolicySide[] {
  const out: PolicySide[] = [];
  for (const [id, v] of Object.entries(civ.policies ?? {})) {
    const p = POLICIES[id];
    const side = p && sideOf(p, v.pos);
    if (side) out.push(side);
  }
  return out;
}

/** Settlers cost × this many people. */
export const settlerFactor = (civ: { policies?: Record<string, { pos: number }> }) =>
  policySides(civ).reduce((a, x) => a + (x.settlerCost ?? 0), 1);

/** A crisis's pressure × this. */
export const pressureFactor = (
  civ: { policies?: Record<string, { pos: number }> },
  crisis: string,
) => policySides(civ).reduce((a, x) => a * (x.pressure?.[crisis] ?? 1), 1);
