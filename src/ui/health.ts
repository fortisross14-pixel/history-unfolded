/**
 * A formation's health for the unit card and the map: people now against full strength, and
 * what it recovers this turn, in words taken from the engine's own plan (healPlan), so the card
 * says what will happen.
 */
import { HEAL, healPlan, type HealPlan } from '../engine/game.ts';
import type { Formation, GameState } from '../engine/types.ts';
import { COHORT_SIZE } from '../engine/units.ts';

export interface Health {
  now: number;
  full: number;
  /** people regained at the end of this turn (all cohorts) */
  perTurn: number;
  /** per wounded cohort */
  rate: number;
  plan: HealPlan;
  /** one line: "+34 a cohort a turn: in your lands, 80 recruits from Rome" */
  text: string;
  /** turns to full for the worst cohort at this rate */
  turns: number | null;
}

export function healthOf(s: GameState, f: Formation): Health {
  const now = f.cohorts.reduce((a, c) => a + c.strength, 0);
  const full = f.cohorts.length * COHORT_SIZE;
  const plan = healPlan(s, f);
  const worst = Math.max(0, ...f.cohorts.map(c => COHORT_SIZE - c.strength));
  const turns = plan.rate > 0 && plan.total > 0 ? Math.ceil(worst / plan.rate) : null;
  let text: string;
  if (plan.kind === 'full') text = 'At full strength';
  else if (plan.kind === 'home')
    text = `+${plan.rate} a cohort a turn: in your lands, ${plan.fromCity} recruits from ${plan.city!.name}`;
  else if (plan.kind === 'field')
    text = `+${plan.rate} a cohort a turn: ${plan.city ? plan.why : `outside your lands, ${plan.why.toLowerCase().replace(', outside your lands', '')}`}`;
  else text = `Not recovering: ${plan.why.toLowerCase()}`;
  return { now, full, perTurn: plan.total, rate: plan.rate, plan, text, turns };
}

/** The rules in short, for the info button. */
export const HEAL_RULES = [
  `Your lands: +${HEAL.home} a cohort a turn, recruits from the nearest settlement (it loses those people, down to 1,000)`,
  `Outside: +${HEAL.field}, +${HEAL.rest} more resting, +${HEAL.fortified} fortified`,
  `Medics +${HEAL.medics} · infirmary +${HEAL.infirmary} · barracks +${HEAL.barracks} (in or next to the settlement) · house +${HEAL.perWarLevel} a War level`,
];
