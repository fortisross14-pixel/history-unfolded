/** Derived numbers for cohorts and formations. Pure functions of the data. */
import { ITEMS, loadoutKey, SLOTS, type DamageType, type Loadout } from '../data/items.ts';
import { RELIEF, VEGETATION } from '../data/terrain.ts';
import type { Cohort, Formation, MapData } from './types.ts';

export const COHORT_SIZE = 100;
export const LEVY_COHORTS = 5;
export const COMMAND_CAP = 10;
export const SETTLER_CAP = 4;
export const BASE_SIGHT = 2;

export const capOf = (f: Formation) => (f.kind === 'settlers' ? SETTLER_CAP : COMMAND_CAP);
export const people = (f: Formation) => f.cohorts.reduce((s, c) => s + c.strength, 0);

export function loadoutWeight(l: Loadout): number {
  return SLOTS.reduce((s, k) => s + ITEMS[l[k]].weight, 0);
}

export function isMounted(l: Loadout): boolean {
  return l.mount !== 'foot';
}

/** Movement points of one cohort: mount speed, kit bonus, heavy kit slows foot troops. */
export function cohortMoves(l: Loadout): number {
  let m = (ITEMS[l.mount].move ?? 2) + (ITEMS[l.kit].move ?? 0);
  const w = loadoutWeight(l);
  if (!isMounted(l) && w >= 3) m -= 1;
  if (isMounted(l) && w >= 4) m -= 1;
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

/** Cost in movement points to enter hex `to`. Infinity = impassable. */
export function enterCost(m: MapData, f: Formation, to: number): number {
  const t = m.terrain[to];
  if (t === 'ocean' || t === 'coast' || t === 'lake') return Infinity;
  const rel = RELIEF[m.relief[to]];
  if (!isFinite(rel.moveCost)) return Infinity;
  const veg = VEGETATION[m.vegetation[to]];
  return 1 + rel.moveCost + veg.moveCost + (allMounted(f) ? veg.mountedExtra : 0);
}

export interface CohortGroup {
  key: string;
  loadout: Loadout;
  cohorts: Cohort[];
}

/** Cohorts grouped by identical loadout, biggest group first. */
export function groupCohorts(f: Formation): CohortGroup[] {
  const map = new Map<string, CohortGroup>();
  for (const c of f.cohorts) {
    const k = loadoutKey(c.loadout);
    if (!map.has(k)) map.set(k, { key: k, loadout: c.loadout, cohorts: [] });
    map.get(k)!.cohorts.push(c);
  }
  return [...map.values()].sort((a, b) => b.cohorts.length - a.cohorts.length);
}

export interface CohortStats {
  melee: number;
  ranged: number;
  damage: DamageType;
  charge: number;
  antiCharge: number;
  protection: Record<DamageType, number>;
  moves: number;
  weight: number;
  upkeep: number;
}

export function cohortStats(l: Loadout): CohortStats {
  const w = ITEMS[l.weapon];
  const protection: Record<DamageType, number> = { cut: 0, pierce: 0, crush: 0, missile: 0 };
  for (const s of SLOTS) {
    const p = ITEMS[l[s]].protection;
    if (p) for (const k of Object.keys(p) as DamageType[]) protection[k] += p[k] ?? 0;
  }
  return {
    melee: w.ranged ? 1 : (w.attack ?? 1),
    ranged: w.ranged ? (w.attack ?? 0) : 0,
    damage: w.damage ?? 'crush',
    charge: ITEMS[l.mount].charge ?? 0,
    antiCharge: w.antiCharge ?? 0,
    protection,
    moves: cohortMoves(l),
    weight: loadoutWeight(l),
    upkeep: SLOTS.reduce((s, k) => s + ITEMS[l[k]].upkeep, 0),
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
  };
}

/** Rules a loadout must follow. Returns a reason, or null if valid. */
export function loadoutProblem(l: Loadout, techs: string[]): string | null {
  for (const s of SLOTS) {
    const it = ITEMS[l[s]];
    if (!it || it.slot !== s) return `Invalid ${s}`;
    if (it.tech && !techs.includes(it.tech)) return `${it.name} needs research`;
  }
  if (ITEMS[l.weapon].twoHanded && l.kit === 'shield')
    return `${ITEMS[l.weapon].name} is two-handed: no shield`;
  return null;
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

/** Which sprite stands for a formation on the map. */
export function formationSprite(f: Formation): string {
  if (f.kind === 'settlers') return 'colonist';
  const groups = groupCohorts(f);
  const main = groups[0]?.loadout;
  if (!main) return 'pikeman';
  if (f.cohorts.every(c => c.loadout.kit === 'scouting-gear')) return 'scout';
  if (isMounted(main)) return 'cavalry';
  const w = ITEMS[main.weapon];
  if (w.ranged) return 'musketeer';
  if (main.armour !== 'no-armour' && w.damage === 'cut') return 'conquistador';
  return 'pikeman';
}
