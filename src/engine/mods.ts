/** A people's total bonuses: research + culture choices + identity tags + Tomes' major buffs. */
import { CULTURE, TAGS, TAG_TIERS, type Domain } from '../data/culture.ts';
import { MAJORS, REPEAT_MAJOR } from '../data/tomes.ts';
import { addMods, ZERO_MODS, type Mods } from '../data/mods.ts';
import { TECHS } from '../data/techs.ts';
import { PATHS } from '../data/paths.ts';
import { CRISIS_MODS } from '../data/crisisMods.ts';
import { policySides } from '../data/policies.ts';
import { TENETS } from '../data/faiths.ts';
import { WONDERS } from '../data/wonders.ts';
import { rulerMods } from '../data/rulers.ts';
import type { Civ, GameState } from './types.ts';

const cache = new WeakMap<Civ, { key: string; mods: Mods }>();

/** How many kept culture choices (missions done) carry each tag. */
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

/** The domains whose major buffs a people has won (a Tome's major bought), in order. */
export function majorDomains(civ: Civ): Domain[] {
  const c = civ.culture;
  const out = (c.history ?? []).filter(h => h.major === 'won').map(h => h.domain);
  if (c.tome?.major === 'bought') out.push(c.tome.domain);
  return out;
}

/** The tenets that help a people (see faith.ts; kept here so mods need no engine import). */
export function faithTenets(s: GameState, civ: Civ): string[] {
  const out: string[] = [];
  const kept = civ.faith === undefined ? undefined : s.faiths?.find(f => f.id === civ.faith);
  if (kept) out.push(...kept.tenets.filter(t => TENETS[t]?.slot !== 'founding'));
  const own = s.faiths?.find(f => f.founder === civ.id);
  if (own?.tenets[0]) out.push(own.tenets[0]);
  return out;
}

/** Ids of the world wonders a people holds (see wonders.ts). */
export function heldWonders(s: GameState, civId: number): string[] {
  if (!s.wonders?.length) return [];
  return s.wonders
    .filter(w => WONDERS[w.id] && s.cities.find(c => c.id === w.cityId)?.civId === civId)
    .map(w => w.id);
}

export function civMods(s: GameState, civId: number): Mods {
  const civ = s.civs[civId];
  const c = civ.culture;
  const key = `${civ.ruler?.major ?? ''}${civ.ruler?.minor ?? ''}|${civ.techs.length}|${c.taken.length}|${c.legacy?.length ?? 0}|${majorDomains(civ).join()}|${civ.paths?.length ?? 0}|${civ.crisis ? civ.crisis.id + (civ.crisis.eased ? 'e' : '') : ''}|${Object.entries(
    civ.policies ?? {},
  )
    .map(([k, v]) => k + v.pos)
    .join()}|${faithTenets(s, civ).join()}|${heldWonders(s, civ.id).join()}`;
  const hit = cache.get(civ);
  if (hit && hit.key === key) return hit.mods;
  const m = ZERO_MODS();
  // the ruler: the major strength in full, the minor one's weaker form
  if (civ.ruler) for (const r of rulerMods(civ.ruler)) addMods(m, r);
  for (const t of civ.techs) if (TECHS[t]?.mods) addMods(m, TECHS[t].mods!);
  for (const id of c.taken) if (CULTURE[id]) addMods(m, CULTURE[id].mods);
  for (const id of c.legacy ?? []) if (CULTURE[id]) addMods(m, CULTURE[id].mods, 0.5);
  for (const it of identity(civ))
    for (let k = 0; k < it.tier; k++) addMods(m, TAGS[it.tag].tiers[k]);
  // Tomes' major buffs, for good; one won again in a later age counts less
  const seen = new Set<Domain>();
  for (const d of majorDomains(civ)) {
    addMods(m, MAJORS[d].mods, seen.has(d) ? REPEAT_MAJOR : 1);
    seen.add(d);
  }
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
  // world wonders held
  for (const id of heldWonders(s, civ.id)) addMods(m, WONDERS[id].mods);
  // faith: the teachings of the faith the people keeps, and its own founding belief
  for (const t of faithTenets(s, civ)) if (TENETS[t]?.mods) addMods(m, TENETS[t].mods!);
  cache.set(civ, { key, mods: m });
  return m;
}

/** A yield multiplier from a percentage, never below 10%. */
export const pct = (n: number) => Math.max(0.1, 1 + n / 100);
