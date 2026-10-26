import type { Civilization, WorldState } from '../types.ts';
import { idx } from './lookup.ts';

/**
 * Power is a realm's share of the world's land, wealth and armed forces,
 * scaled to 0–1000. Unlike the legacy score it can fall as fast as it rises.
 */
export function updatePower(s: WorldState) {
  const living = s.civilizations.filter(c => c.provinces.length);
  let land = 0;
  let wealth = 0;
  let force = 0;
  const forceOf = (c: Civilization) => c.armySize + c.navy * 0.6;
  for (const c of living) {
    land += c.provinces.length;
    wealth += c.gdp;
    force += forceOf(c);
  }
  for (const c of s.civilizations) {
    if (!c.provinces.length) {
      c.power = 0;
      continue;
    }
    const share =
      0.35 * (c.provinces.length / Math.max(1, land)) +
      0.35 * (c.gdp / Math.max(1, wealth)) +
      0.3 * (forceOf(c) / Math.max(1, force));
    c.power = Math.round(share * 1000);
  }
  idx(s).ranking = undefined;
  // Remember how long the leader has been on top (see Complacency in modifiers.ts).
  const leader = topPowers(s, 1)[0];
  // A near-equal of the leader keeps its clock running; anyone else resets.
  for (const c of s.civilizations)
    if (c !== leader && (!leader || c.power < leader.power * 0.85)) delete c.topSince;
  if (leader) leader.topSince ??= s.year;
}

/** Years the realm has been the world's top power, 0 if it is not on top. */
export const yearsOnTop = (s: WorldState, c: Civilization) =>
  c.topSince === undefined ? 0 : s.year - c.topSince;

/** The strongest realms right now, strongest first. */
export function topPowers(s: WorldState, n: number) {
  const index = idx(s);
  index.ranking ??= s.civilizations
    .filter(c => c.provinces.length)
    .sort((a, b) => b.power - a.power);
  return index.ranking.filter(c => c.provinces.length).slice(0, n);
}

/** Great powers are the top three realms by power. */
export const GREAT_POWER_COUNT = 3;

export function isGreatPower(s: WorldState, c: Civilization) {
  return topPowers(s, GREAT_POWER_COUNT).some(x => x.id === c.id);
}
