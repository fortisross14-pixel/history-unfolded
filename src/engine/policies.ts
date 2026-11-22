/**
 * Age policies (data/policies.ts): one lever per age, three positions, moved at most every
 * POLICY_COOLDOWN turns. Their bonuses go through civMods; this file moves the levers, applies
 * their unrest each turn and lets AI peoples pull them.
 */
import {
  POLICIES,
  POLICY_COOLDOWN,
  POLICY_LIST,
  policySides,
  type Policy,
} from '../data/policies.ts';
import { ageOf } from '../data/techs.ts';
import { log } from './game.ts';
import type { Civ, GameState } from './types.ts';

/** The policies a people's age has opened, oldest first. */
export const openPolicies = (civ: Civ): Policy[] =>
  POLICY_LIST.filter(p => ageOf(civ.techs) >= p.age);

export const positionOf = (civ: Civ, id: string): -1 | 0 | 1 =>
  (civ.policies?.[id]?.pos ?? 0) as -1 | 0 | 1;

/** Why the lever cannot move now, or null. */
export function policyProblem(s: GameState, civ: Civ, id: string): string | null {
  const p = POLICIES[id];
  if (!p || ageOf(civ.techs) < p.age) return 'This policy opens in a later age.';
  const since = civ.policies?.[id]?.since;
  if (since !== undefined && s.turn - since < POLICY_COOLDOWN)
    return `Can be changed again in ${POLICY_COOLDOWN - (s.turn - since)} turns.`;
  return null;
}

export function setPolicy(
  s: GameState,
  civId: number,
  id: string,
  pos: -1 | 0 | 1,
): { ok: boolean; msg: string } {
  const civ = s.civs[civId];
  const p = POLICIES[id];
  if (!p) return { ok: false, msg: 'No such policy.' };
  if (positionOf(civ, id) === pos) return { ok: false, msg: 'Already so.' };
  const why = policyProblem(s, civ, id);
  if (why) return { ok: false, msg: why };
  civ.policies = { ...(civ.policies ?? {}), [id]: { pos, since: s.turn } };
  const side = pos === -1 ? p.left : pos === 1 ? p.right : null;
  const name = side ? side.name : 'a balanced course';
  log(s, civId, `${p.name}: the ${civ.name} choose ${name}.`);
  return {
    ok: true,
    msg: `${p.name}: ${side ? `${side.name}. ${side.effects}` : 'balanced, no effect'}.`,
  };
}

/** Each turn: the levers' pull on the noble houses. */
export function policyTurn(s: GameState, civ: Civ) {
  const n = policySides(civ).reduce((a, x) => a + (x.unrest ?? 0), 0);
  if (!n) return;
  const ruler = civ.ruling;
  for (const d of civ.dynasties)
    if (d.id !== ruler) d.unrest = Math.max(0, Math.min(100, d.unrest + n));
  void s;
}

// ---------------------------------------------------------------- AI

/** An AI people reviews its levers every few turns, reading its own situation. */
export function aiPolicyTurn(s: GameState, civ: Civ) {
  if ((s.turn + civ.id) % 5) return;
  const cities = s.cities.filter(c => c.civId === civ.id).length;
  const restless = Math.max(
    0,
    ...civ.dynasties.filter(d => d.id !== civ.ruling).map(d => d.unrest),
  );
  const atWar = s.wars.some(w => w.a === civ.id || w.b === civ.id);
  const want: Record<string, -1 | 0 | 1> = {
    'way-of-life': cities < 4 ? -1 : 1,
    revenue: restless >= 40 ? -1 : civ.gold < 150 ? 1 : 0,
    'feudal-balance': restless >= 55 ? -1 : atWar ? 1 : 0,
    'trade-policy': (civ.stats?.crowd ?? 0) >= 0.9 ? -1 : 1,
    labour: (civ.stats?.industry ?? 0) >= 3 ? 1 : -1,
  };
  for (const p of openPolicies(civ)) {
    const pos = want[p.id] ?? 0;
    if (positionOf(civ, p.id) !== pos && !policyProblem(s, civ, p.id))
      setPolicy(s, civ.id, p.id, pos);
  }
}
