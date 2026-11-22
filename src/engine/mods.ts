/** A people's total bonuses: research + culture choices + identity tags + upheaval penalties. */
import { CULTURE, TAGS, TAG_TIERS } from '../data/culture.ts';
import { addMods, ZERO_MODS, type Mods } from '../data/mods.ts';
import { TECHS } from '../data/techs.ts';
import { PATHS } from '../data/paths.ts';
import { CRISIS_MODS } from '../data/crisisMods.ts';
import { policySides } from '../data/policies.ts';
import type { Civ, GameState } from './types.ts';

const cache = new WeakMap<Civ, { key: string; mods: Mods }>();

/** How many current (not legacy) choices carry each tag. */
export function tagCounts(civ: Civ): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of civ.culture.taken)
    for (const t of CULTURE[id]?.tags ?? []) out[t] = (out[t] ?? 0) + 1;
  return out;
}

export interface IdentityTag {
  tag: string;
  count: number;
  /** tiers reached: 0..3 */
  tier: number;
}

/** The people's identity: its tags, strongest first. */
export function identity(civ: Civ): IdentityTag[] {
  return Object.entries(tagCounts(civ))
    .map(([tag, count]) => ({ tag, count, tier: TAG_TIERS.filter(t => count >= t).length }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export const UPHEAVAL_PENALTY: Partial<Mods> = {
  foodPct: -10,
  prodPct: -25,
  sciencePct: -25,
  goldPct: -25,
  culturePct: -25,
  morale: -5,
};

export function civMods(s: GameState, civId: number): Mods {
  const civ = s.civs[civId];
  const c = civ.culture;
  const key = `${civ.techs.length}|${c.taken.length}|${c.legacy.length}|${c.upheaval ? c.upheaval.domain : ''}|${civ.paths?.length ?? 0}|${civ.crisis ? civ.crisis.id + (civ.crisis.eased ? 'e' : '') : ''}|${Object.entries(
    civ.policies ?? {},
  )
    .map(([k, v]) => k + v.pos)
    .join()}`;
  const hit = cache.get(civ);
  if (hit && hit.key === key) return hit.mods;
  const m = ZERO_MODS();
  for (const t of civ.techs) if (TECHS[t]?.mods) addMods(m, TECHS[t].mods!);
  for (const id of c.taken) if (CULTURE[id]) addMods(m, CULTURE[id].mods);
  for (const id of c.legacy) if (CULTURE[id]) addMods(m, CULTURE[id].mods, 0.5);
  for (const it of identity(civ))
    for (let k = 0; k < it.tier; k++) addMods(m, TAGS[it.tag].tiers[k]);
  if (c.upheaval) addMods(m, UPHEAVAL_PENALTY);
  // national directions: a lasting legacy, half again as strong with their culture tag
  const tags = identity(civ);
  for (const id of civ.paths ?? []) {
    const p = PATHS[id];
    if (p) addMods(m, p.mods, tags.some(t => t.tag === p.synergy && t.tier > 0) ? 1.5 : 1);
  }
  // a crisis changes play while it lasts; eased, by half
  if (civ.crisis && CRISIS_MODS[civ.crisis.id])
    addMods(m, CRISIS_MODS[civ.crisis.id], civ.crisis.eased ? 0.5 : 1);
  // age policies: the side each lever sits on
  for (const side of policySides(civ)) addMods(m, side.mods);
  cache.set(civ, { key, mods: m });
  return m;
}

/** A yield multiplier from a percentage, never below 10%. */
export const pct = (n: number) => Math.max(0.1, 1 + n / 100);
