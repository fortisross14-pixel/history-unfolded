/**
 * Battle resolution. A battle has a volley, a charge and up to three melee rounds, with a morale
 * check after each. What makes a formation strong is the mix of designs inside it:
 *
 * - Infantry and cavalry form the front. While a front stands, enemy blows rarely reach the
 *   ranged cohorts behind it, and those keep shooting every melee round (screened fire).
 * - Ranged cohorts without a front get caught: they fight hand to hand and take full hits.
 * - Cavalry charges before melee, rides down unscreened archers, and flanks an enemy that has
 *   no cavalry of its own. Spears blunt a charge and hurt the riders. Rough ground stops both.
 * - Each damage type is reduced by the target's protection against that type, so armour that
 *   shrugs off arrows can still fold under axes.
 */
import { type DamageType } from '../data/items.ts';
import { RELIEF, VEGETATION } from '../data/terrain.ts';
import type { Rng } from './rng.ts';
import type { Cohort, MapData } from './types.ts';
import { cohortStats, COHORT_SIZE, type CohortStats } from './units.ts';

/** casualties per point of attack at full strength, before protection */
export const LETHALITY = 5;
const PROT_SCALE = 4;

export interface Boost {
  melee: number;
  ranged: number;
  charge: number;
  /** multiplier on damage this side takes */
  taken: number;
}
const NO_BOOST: Boost = { melee: 1, ranged: 1, charge: 1, taken: 1 };

export interface BattleSideInput {
  name: string;
  cohorts: Cohort[];
  morale: number;
  /** research, culture and situation */
  boost?: Boost;
}

export interface BattleContext {
  map: MapData;
  /** hex the defender stands on */
  hex: number;
  fortified: boolean;
  city: boolean;
  /** attacker only shoots: no charge, no melee */
  volleyOnly: boolean;
  /** city walls: share of assault damage they stop */
  walls?: number;
  /** attacker's average siege gear: share of walls ignored */
  siege?: number;
  rng: Rng;
}

export interface SideReport {
  name: string;
  start: number;
  lost: number;
  broke: boolean;
  /** losses per cohort id */
  cohortLoss: Record<number, number>;
}

export interface BattleReport {
  /** which battle picture fits: set by the caller */
  scene?: 'field' | 'siege' | 'naval' | 'charge' | 'forest' | 'landing';
  attacker: SideReport;
  defender: SideReport;
  lines: string[];
  outcome: 'defender-broke' | 'attacker-broke' | 'held' | 'skirmish';
}

interface Unit {
  c: Cohort;
  s: CohortStats;
  hp: number;
  /** xp gives up to +30% punch */
  xpMul: number;
}

const front = (u: Unit) => u.s.role === 'infantry' || u.s.role === 'cavalry';
const alive = (us: Unit[]) => us.filter(u => u.hp > 0.5);

function mitigation(dmg: DamageType, prot: Record<DamageType, number>, ap = 0): number {
  return PROT_SCALE / (PROT_SCALE + prot[dmg] * (1 - ap));
}

type Hit = { amount: number; type: DamageType; ap?: number };

/** Spread `pool` of hits (per damage type) over targets weighted by exposure. */
function strike(
  targets: Unit[],
  hits: Hit[],
  exposure: (u: Unit) => number,
  takenMul: number,
): number {
  const ts = alive(targets);
  const w = ts.map(exposure);
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let dealt = 0;
  for (const h of hits) {
    for (let i = 0; i < ts.length; i++) {
      if (!w[i]) continue;
      const share = (h.amount * w[i]) / total;
      const d = Math.min(ts[i].hp, share * mitigation(h.type, ts[i].s.protection, h.ap) * takenMul);
      ts[i].hp -= d;
      dealt += d;
    }
  }
  return dealt;
}

export function resolveBattle(
  att: BattleSideInput,
  def: BattleSideInput,
  ctx: BattleContext,
): BattleReport {
  const mk = (cs: Cohort[]): Unit[] =>
    cs.map(c => ({
      c,
      s: cohortStats(c.loadout),
      hp: c.strength,
      xpMul: 1 + Math.min(0.3, c.xp * 0.05),
    }));
  const A = mk(att.cohorts),
    D = mk(def.cohorts);
  const bA = att.boost ?? NO_BOOST,
    bD = def.boost ?? NO_BOOST;
  const startA = A.reduce((s, u) => s + u.hp, 0),
    startD = D.reduce((s, u) => s + u.hp, 0);
  const lines: string[] = [];
  const m = ctx.map;
  const rough = m.relief[ctx.hex] !== 'flat' || VEGETATION[m.vegetation[ctx.hex]].moveCost > 0;
  const cover = m.vegetation[ctx.hex] === 'forest' || m.vegetation[ctx.hex] === 'jungle';
  // damage the defender takes: terrain, fortification and walls
  const defMul =
    (1 - RELIEF[m.relief[ctx.hex]].defense) *
    (cover ? 0.85 : 1) *
    (ctx.fortified ? 0.8 : 1) *
    (ctx.city ? 0.65 * (1 - (ctx.walls ?? 0) * (1 - (ctx.siege ?? 0))) : 1) *
    bD.taken;
  const attMul = bA.taken;
  const lostA = () => startA - A.reduce((s, u) => s + Math.max(0, u.hp), 0);
  const lostD = () => startD - D.reduce((s, u) => s + Math.max(0, u.hp), 0);
  const luck = () => 0.85 + ctx.rng() * 0.3;

  /** how exposed a unit is to enemy fire, given its side still has a front */
  const exposure = (side: Unit[], melee: boolean) => {
    const screened = alive(side).some(front);
    return (u: Unit) => {
      if (u.s.role === 'horse-archers') return 0.35;
      if (u.s.role === 'ranged') return screened ? (melee ? 0.15 : 0.5) : 1;
      return 1;
    };
  };

  const volley = (from: Unit[], mul: number): Hit[] =>
    alive(from)
      .filter(u => u.s.ranged > 0)
      .map(u => ({
        amount: u.s.ranged * LETHALITY * (u.hp / COHORT_SIZE) * u.xpMul * mul,
        type: u.s.rangedDamage,
        ap: u.s.armourPierce,
      }));

  let outcome: BattleReport['outcome'] = 'held';
  let aBroke = false,
    dBroke = false;
  const moraleCheck = (phase: string) => {
    const fa = lostA() / Math.max(1, startA),
      fd = lostD() / Math.max(1, startD);
    const ea = fa * 100 - att.morale,
      ed = fd * 100 - def.morale;
    if (ea > 0 || ed > 0 || !alive(A).length || !alive(D).length) {
      if (!alive(D).length || (ed > 0 && ed >= ea)) dBroke = true;
      else aBroke = true;
      lines.push(
        `${phase}: ${dBroke ? def.name : att.name} ${dBroke && !alive(D).length ? 'is wiped out' : 'breaks'}.`,
      );
      return true;
    }
    return false;
  };

  // 1. volley: both sides shoot; cover blunts arrows at the defender
  const aV = volley(A, luck() * bA.ranged),
    dV = volley(D, luck() * bD.ranged);
  const hitD = strike(D, aV, exposure(D, false), defMul * (cover ? 0.7 : 1));
  const hitA = strike(A, dV, exposure(A, false), attMul);
  if (aV.length || dV.length)
    lines.push(
      `Volleys: ${att.name} lose ${Math.round(hitA)}, ${def.name} lose ${Math.round(hitD)}.`,
    );

  if (ctx.volleyOnly) {
    moraleCheck('After the volleys');
    outcome = dBroke ? 'defender-broke' : aBroke ? 'attacker-broke' : 'skirmish';
  } else if (!moraleCheck('After the volleys')) {
    // 2. charge: attacker cavalry, not into rough ground or walls
    const riders = alive(A).filter(u => u.s.charge > 0 && u.s.role === 'cavalry');
    if (riders.length && !rough && !ctx.city) {
      const dFront = alive(D).filter(front);
      const spears = dFront.reduce((s, u) => s + u.s.antiCharge * (u.hp / COHORT_SIZE), 0);
      const spearShare = dFront.length ? spears / dFront.length : 0;
      const blunt = 1 - Math.min(0.7, spearShare / 6);
      const noFront = dFront.length === 0;
      const hits = riders.map(u => ({
        amount:
          u.s.charge *
          LETHALITY *
          (u.hp / COHORT_SIZE) *
          u.xpMul *
          blunt *
          (noFront ? 1.5 : 1) *
          bA.charge *
          luck(),
        type: u.s.damage,
      }));
      const d = strike(D, hits, exposure(D, true), defMul);
      let back = 0;
      if (spears > 0)
        back = strike(
          riders,
          [{ amount: spears * LETHALITY * 0.8 * bD.melee, type: 'pierce' }],
          () => 1,
          attMul,
        );
      lines.push(
        `Charge: ${def.name} lose ${Math.round(d)}${back ? `, spears cost the riders ${Math.round(back)}` : ''}${noFront ? ' (no front line to stop them)' : ''}.`,
      );
    } else if (riders.length) {
      lines.push(`No charge: ${ctx.city ? 'walls' : 'rough ground'} in the way.`);
    }

    // 3. melee rounds
    if (!moraleCheck('After the charge')) {
      for (let round = 1; round <= 3; round++) {
        const side = (us: Unit[], enemy: Unit[], b: Boost) => {
          const screened = alive(us).some(front);
          const flank =
            !rough &&
            alive(us).some(u => u.s.role === 'cavalry') &&
            !alive(enemy).some(u => u.s.role === 'cavalry');
          const k = luck() * (flank ? 1.3 : 1);
          const hits: Hit[] = [];
          for (const u of alive(us)) {
            const str = (u.hp / COHORT_SIZE) * u.xpMul * k;
            if (front(u))
              hits.push({ amount: u.s.melee * LETHALITY * str * b.melee, type: u.s.damage });
            else if (screened || u.s.role === 'horse-archers')
              hits.push({
                amount: u.s.ranged * LETHALITY * 0.8 * str * b.ranged,
                type: u.s.rangedDamage,
                ap: u.s.armourPierce,
              });
            else
              hits.push({ amount: u.s.melee * LETHALITY * 0.7 * str * b.melee, type: u.s.damage });
          }
          return { hits, flank };
        };
        const a = side(A, D, bA),
          d = side(D, A, bD);
        const toD = strike(D, a.hits, exposure(D, true), defMul);
        const toA = strike(A, d.hits, exposure(A, true), attMul);
        lines.push(
          `Melee ${round}: ${att.name} lose ${Math.round(toA)}, ${def.name} lose ${Math.round(toD)}${a.flank ? ' (flanked by cavalry)' : d.flank ? ' (attackers flanked)' : ''}.`,
        );
        if (moraleCheck(`Round ${round}`)) break;
      }
    }
    outcome = dBroke ? 'defender-broke' : aBroke ? 'attacker-broke' : 'held';
    if (outcome === 'held') lines.push('Both sides hold; the fighting dies down.');
  }

  const report = (name: string, us: Unit[], start: number, broke: boolean): SideReport => {
    const cohortLoss: Record<number, number> = {};
    for (const u of us) cohortLoss[u.c.id] = Math.round(u.c.strength - Math.max(0, u.hp));
    return {
      name,
      start: Math.round(start),
      lost: Math.round(start - us.reduce((s, u) => s + Math.max(0, u.hp), 0)),
      broke,
      cohortLoss,
    };
  };
  return {
    attacker: report(att.name, A, startA, aBroke),
    defender: report(def.name, D, startD, dBroke),
    lines,
    outcome,
  };
}
