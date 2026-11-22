/** Derived numbers for cohorts, designs and formations. Pure functions of the data. */
import { ITEMS, loadoutKey, SLOTS, type DamageType, type Loadout } from '../data/items.ts';
import { RELIEF, VEGETATION } from '../data/terrain.ts';
import type { Civ, Cohort, Design, Formation, MapData } from './types.ts';

export const COHORT_SIZE = 100;
export const LEVY_COHORTS = 5;
export const SETTLER_COHORTS = 5;
export const COMMAND_CAP = 10;
export const SETTLER_CAP = 5;
export const BASE_SIGHT = 2;
export const BASE_MORALE = 30;

export const capOf = (f: Formation) => (f.kind === 'settlers' ? SETTLER_CAP : COMMAND_CAP);
export const people = (f: Formation) => f.cohorts.reduce((s, c) => s + c.strength, 0);

export function loadoutWeight(l: Loadout): number {
  return SLOTS.reduce((s, k) => s + ITEMS[l[k]].weight, 0);
}

export const isMounted = (l: Loadout) => l.mount !== 'foot';
export const isRanged = (l: Loadout) => !!ITEMS[l.weapon].ranged;

export type Role = 'infantry' | 'ranged' | 'cavalry' | 'horse-archers';
export function roleOf(l: Loadout): Role {
  if (isRanged(l)) return isMounted(l) ? 'horse-archers' : 'ranged';
  return isMounted(l) ? 'cavalry' : 'infantry';
}
export const ROLE_NAMES: Record<Role, string> = {
  infantry: 'Infantry',
  ranged: 'Ranged',
  cavalry: 'Cavalry',
  'horse-archers': 'Horse archers',
};

/** Movement points of one cohort: mount speed, kit bonus, heavy kit slows. */
export function cohortMoves(l: Loadout): number {
  let m = (ITEMS[l.mount].move ?? 2) + (ITEMS[l.kit].move ?? 0);
  const w = loadoutWeight(l);
  if (!isMounted(l) && w >= 4) m -= 1;
  if (isMounted(l) && w >= 5) m -= 1;
  return Math.max(1, m);
}

/** A formation moves at the speed of its slowest cohort. */
export function formationMoves(f: Formation): number {
  if (!f.cohorts.length) return 0;
  return Math.min(...f.cohorts.map(c => cohortMoves(c.loadout)));
}

export function formationSight(f: Formation, m: MapData): number {
  const kit = Math.max(0, ...f.cohorts.map(c => ITEMS[c.loadout.kit].sight ?? 0));
  return BASE_SIGHT + kit + (m.relief[f.hex] === 'hills' ? 1 : 0);
}

export const allMounted = (f: Formation) =>
  f.cohorts.length > 0 && f.cohorts.every(c => isMounted(c.loadout));
const allBooted = (f: Formation) =>
  f.cohorts.length > 0 &&
  f.cohorts.every(c => !isMounted(c.loadout) && ITEMS[c.loadout.boots].rough);

/** Cost in movement points to enter hex `to`. Infinity = impassable. */
export function enterCost(m: MapData, f: Formation, to: number): number {
  const t = m.terrain[to];
  if (t === 'ocean' || t === 'coast' || t === 'lake') return Infinity;
  const rel = RELIEF[m.relief[to]];
  if (!isFinite(rel.moveCost)) return Infinity;
  const veg = VEGETATION[m.vegetation[to]];
  let extra = rel.moveCost + veg.moveCost;
  if (allBooted(f)) extra = Math.max(0, extra - 1);
  if (allMounted(f)) extra += veg.mountedExtra;
  return 1 + extra;
}

/** Share of losses (in %) a formation takes before it breaks: base, best banner, average gear. */
export function formationMorale(f: Formation): number {
  if (!f.cohorts.length) return BASE_MORALE;
  let banner = 0,
    gear = 0;
  for (const c of f.cohorts) {
    banner = Math.max(banner, ITEMS[c.loadout.kit].morale ?? 0);
    for (const s of SLOTS) if (s !== 'kit') gear += ITEMS[c.loadout[s]].morale ?? 0;
  }
  const xp = f.cohorts.reduce((s, c) => s + Math.min(5, c.xp), 0) / f.cohorts.length;
  return BASE_MORALE + banner + gear / f.cohorts.length + xp * 2;
}

export interface CohortGroup {
  key: string;
  designId: number | null;
  loadout: Loadout;
  cohorts: Cohort[];
}

/** Cohorts grouped by design and actual gear, biggest group first. */
export function groupCohorts(f: Formation): CohortGroup[] {
  const map = new Map<string, CohortGroup>();
  for (const c of f.cohorts) {
    const k = `${c.designId ?? '-'}:${loadoutKey(c.loadout)}`;
    if (!map.has(k)) map.set(k, { key: k, designId: c.designId, loadout: c.loadout, cohorts: [] });
    map.get(k)!.cohorts.push(c);
  }
  return [...map.values()].sort((a, b) => b.cohorts.length - a.cohorts.length);
}

export function designOf(civ: Civ, id: number | null): Design | undefined {
  return id === null ? undefined : civ.designs.find(d => d.id === id);
}

/** Display name of a cohort group: its design, or Levy / Custom when it has none. */
export function groupName(
  civ: Civ,
  g: { designId: number | null; loadout: Loadout },
  kind = 'army',
): string {
  if (kind === 'settlers') return 'Settlers';
  const d = designOf(civ, g.designId);
  if (d) return d.name;
  return SLOTS.every(s => ITEMS[g.loadout[s]].empty) ? 'Levy' : 'Custom';
}

/** True when the cohorts carry older gear than their design now asks for. */
export function outdated(civ: Civ, g: { designId: number | null; loadout: Loadout }): boolean {
  const d = designOf(civ, g.designId);
  return !!d && loadoutKey(d.loadout) !== loadoutKey(g.loadout);
}

export interface CohortStats {
  role: Role;
  melee: number;
  ranged: number;
  damage: DamageType;
  rangedDamage: DamageType;
  charge: number;
  antiCharge: number;
  protection: Record<DamageType, number>;
  moves: number;
  weight: number;
  upkeep: number;
  morale: number;
}

export function cohortStats(l: Loadout): CohortStats {
  const w = ITEMS[l.weapon];
  const protection: Record<DamageType, number> = { cut: 0, pierce: 0, crush: 0, missile: 0 };
  let morale = 0;
  for (const s of SLOTS) {
    const it = ITEMS[l[s]];
    if (it.protection)
      for (const k of Object.keys(it.protection) as DamageType[])
        protection[k] += it.protection[k] ?? 0;
    morale += it.morale ?? 0;
  }
  return {
    role: roleOf(l),
    // ranged troops fight poorly hand to hand; javelin men keep a bit more punch
    melee: w.ranged ? (w.id === 'javelins' ? 2 : 1) : (w.attack ?? 1),
    ranged: w.ranged ? (w.attack ?? 0) : 0,
    damage: w.ranged ? 'crush' : (w.damage ?? 'crush'),
    rangedDamage: w.damage ?? 'missile',
    charge: ITEMS[l.mount].charge ?? 0,
    antiCharge: w.antiCharge ?? 0,
    protection,
    moves: cohortMoves(l),
    weight: loadoutWeight(l),
    upkeep: SLOTS.reduce((s, k) => s + ITEMS[l[k]].upkeep, 0),
    morale,
  };
}

/** Formation totals, each cohort weighted by its strength. */
export function formationStats(f: Formation) {
  let melee = 0,
    ranged = 0,
    charge = 0,
    prot = 0,
    upkeep = 0;
  for (const c of f.cohorts) {
    const s = cohortStats(c.loadout);
    const k = c.strength / COHORT_SIZE;
    melee += s.melee * k;
    ranged += s.ranged * k;
    charge += s.charge * k;
    prot +=
      ((s.protection.cut + s.protection.pierce + s.protection.crush + s.protection.missile) / 4) *
      k;
    upkeep += s.upkeep;
  }
  const n = Math.max(1, f.cohorts.length);
  return {
    melee: Math.round(melee),
    ranged: Math.round(ranged),
    charge: Math.round(charge),
    protection: Math.round((prot / n) * 10) / 10,
    upkeep,
    morale: Math.round(formationMorale(f)),
  };
}

/** A rough single number for comparing armies (used by the AI and the peoples screen). */
export function power(f: Formation): number {
  if (f.kind !== 'army') return 0;
  let p = 0;
  for (const c of f.cohorts) {
    const s = cohortStats(c.loadout);
    const prot =
      (s.protection.cut + s.protection.pierce + s.protection.crush + s.protection.missile) / 4;
    p +=
      (s.melee + s.ranged * 1.2 + s.charge * 0.5) * (1 + prot * 0.25) * (c.strength / COHORT_SIZE);
  }
  return p;
}

/** Rules a loadout must follow. Returns a reason, or null if valid. */
export function loadoutProblem(l: Loadout, techs: string[]): string | null {
  for (const s of SLOTS) {
    const it = ITEMS[l[s]];
    if (!it || it.slot !== s) return `Invalid ${s}`;
    if (it.tech && !techs.includes(it.tech)) return `${it.name} needs research`;
  }
  if (ITEMS[l.weapon].twoHanded && !ITEMS[l.shield].empty)
    return `${ITEMS[l.weapon].name} needs both hands: no shield`;
  return null;
}

/** Goods per cohort for a full set of gear. */
export function loadoutCost(l: Loadout): Record<string, number> {
  const cost: Record<string, number> = {};
  for (const s of SLOTS)
    for (const [g, n] of Object.entries(ITEMS[l[s]].cost)) cost[g] = (cost[g] ?? 0) + n;
  return cost;
}

/** Goods to change one cohort from `from` to `to` (only changed slots cost anything). */
export function refitCost(
  from: Loadout,
  to: Loadout,
): { cost: Record<string, number>; refund: Record<string, number> } {
  const cost: Record<string, number> = {},
    refund: Record<string, number> = {};
  for (const s of SLOTS) {
    if (from[s] === to[s]) continue;
    for (const [g, n] of Object.entries(ITEMS[to[s]].cost)) cost[g] = (cost[g] ?? 0) + n;
    for (const [g, n] of Object.entries(ITEMS[from[s]].cost))
      refund[g] = (refund[g] ?? 0) + n * 0.5;
  }
  return { cost, refund };
}

const ROLE_SPRITE: Record<Role, string> = {
  infantry: 'pikeman',
  ranged: 'musketeer',
  cavalry: 'cavalry',
  'horse-archers': 'cavalry',
};

export function spriteForLoadout(l: Loadout): string {
  if (l.kit === 'scouting-gear' && !isMounted(l)) return 'scout';
  const r = roleOf(l);
  if (r === 'infantry' && !ITEMS[l.armour].empty && ITEMS[l.weapon].damage === 'cut')
    return 'conquistador';
  return ROLE_SPRITE[r];
}

/** Which sprite stands for a formation on the map: its biggest group. */
export function formationSprite(f: Formation): string {
  if (f.kind === 'settlers') return 'colonist';
  const main = groupCohorts(f)[0]?.loadout;
  return main ? spriteForLoadout(main) : 'pikeman';
}
