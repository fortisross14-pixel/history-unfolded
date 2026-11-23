/**
 * Bonuses that research, culture and identity give a people. Every source is a Partial<Mods>;
 * a people's total is the sum. Percentages are whole numbers (+10 = +10%).
 */
import type { SlotGroup } from './slots.ts';

export interface Mods {
  // army
  commandCap: number;
  levyCohorts: number;
  morale: number;
  meleePct: number;
  rangedPct: number;
  chargePct: number;
  /** less damage taken in every battle */
  defensePct: number;
  /** more damage dealt when attacking */
  attackPct: number;
  /** more damage dealt and less taken inside your own territory */
  homePct: number;
  /** more damage dealt and less taken when the fight is on hills, forest or marsh */
  roughPct: number;
  /** more damage dealt when assaulting a city */
  siegePct: number;
  cityDefensePct: number;
  guard: number;
  sight: number;
  heal: number;
  upkeepPct: number;
  /** cheaper equipping */
  refitPct: number;
  /** naval combat and sea travel (effects arrive with fleets) */
  navalPct: number;
  // land
  territoryRadius: number;
  districtRadius: number;
  /** road move cost, added to the base 0.5 (negative = faster) */
  roadCost: number;
  // economy
  foodPct: number;
  prodPct: number;
  sciencePct: number;
  goldPct: number;
  culturePct: number;
  housingPct: number;
  /** less food needed to grow */
  growthPct: number;
  /** share of people who can work, added to the base 50% (in %) */
  workers: number;
  /** yields of coastal cities */
  coastalPct: number;
  /** output of one slot group */
  groupPct: Partial<Record<SlotGroup, number>>;
  // culture
  /** cheaper research */
  researchPct: number;
  /** cheaper culture */
  cultureCostPct: number;
  /** slower build-up of tension (negative = slower) */
  tensionPct: number;
  /** extra moves a turn for armies and settlers */
  moves: number;
  /** 1 = armies cross any land at one move a hex, whatever the ground */
  ignoreTerrain: number;
  /** research handed over on entering each age, in techs' worth */
  freeTechs: number;
  /** culture handed over on entering each age, in choices' worth */
  freeCulture: number;
}

export const ZERO_MODS = (): Mods => ({
  commandCap: 0,
  levyCohorts: 0,
  morale: 0,
  meleePct: 0,
  rangedPct: 0,
  chargePct: 0,
  defensePct: 0,
  attackPct: 0,
  homePct: 0,
  roughPct: 0,
  siegePct: 0,
  cityDefensePct: 0,
  guard: 0,
  sight: 0,
  heal: 0,
  upkeepPct: 0,
  refitPct: 0,
  navalPct: 0,
  territoryRadius: 0,
  districtRadius: 0,
  roadCost: 0,
  foodPct: 0,
  prodPct: 0,
  sciencePct: 0,
  goldPct: 0,
  culturePct: 0,
  housingPct: 0,
  growthPct: 0,
  workers: 0,
  coastalPct: 0,
  groupPct: {},
  researchPct: 0,
  cultureCostPct: 0,
  tensionPct: 0,
  moves: 0,
  ignoreTerrain: 0,
  freeTechs: 0,
  freeCulture: 0,
});

export function addMods(into: Mods, m: Partial<Mods>, k = 1) {
  for (const [key, v] of Object.entries(m) as [keyof Mods, unknown][]) {
    if (key === 'groupPct') {
      for (const [g, n] of Object.entries(v as Record<string, number>))
        into.groupPct[g as SlotGroup] = (into.groupPct[g as SlotGroup] ?? 0) + n * k;
    } else (into[key] as number) += (v as number) * k;
  }
}

const LABEL: Record<Exclude<keyof Mods, 'groupPct'>, [string, boolean]> = {
  commandCap: ['cohorts per formation', false],
  levyCohorts: ['cohorts per levy', false],
  morale: ['morale', false],
  meleePct: ['melee', true],
  rangedPct: ['ranged', true],
  chargePct: ['charge', true],
  defensePct: ['damage taken', true],
  attackPct: ['attack', true],
  homePct: ['fighting at home', true],
  roughPct: ['fighting on rough ground', true],
  siegePct: ['assaulting cities', true],
  cityDefensePct: ['city defence', true],
  guard: ['city guard cohorts', false],
  sight: ['sight', false],
  heal: ['healing per turn', false],
  upkeepPct: ['upkeep', true],
  refitPct: ['equipping cost', true],
  navalPct: ['at sea (with fleets)', true],
  territoryRadius: ['territory radius', false],
  districtRadius: ['district radius', false],
  roadCost: ['road move cost', false],
  foodPct: ['food', true],
  prodPct: ['production', true],
  sciencePct: ['science', true],
  goldPct: ['gold', true],
  culturePct: ['culture', true],
  housingPct: ['housing', true],
  growthPct: ['food to grow', true],
  workers: ['workers', true],
  coastalPct: ['coastal city yields', true],
  researchPct: ['research cost', true],
  cultureCostPct: ['culture cost', true],
  tensionPct: ['tension build-up', true],
  moves: ['moves for troops', false],
  ignoreTerrain: ['troops ignore terrain', false],
  freeTechs: ['free techs each age', false],
  freeCulture: ['free culture choices each age', false],
};

/** "+10% science, +1 cohorts per formation" */
export function describeMods(m: Partial<Mods>): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(m) as [keyof Mods, unknown][]) {
    if (k === 'groupPct') {
      for (const [g, n] of Object.entries(v as Record<string, number>))
        out.push(`${n > 0 ? '+' : ''}${n}% ${g} buildings`);
      continue;
    }
    const n = v as number;
    if (!n) continue;
    const [label, pct] = LABEL[k];
    // for these, less is better: show the sign as it is
    out.push(
      `${n > 0 ? '+' : ''}${k === 'defensePct' ? -n : n}${pct ? '%' : ''} ${label}`.replace(
        '+-',
        '-',
      ),
    );
  }
  return out.join(', ');
}
