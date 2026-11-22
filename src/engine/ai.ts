/**
 * A simple AI. It designs troops from what it has researched (a spear line with archers behind
 * it, cavalry once it has horses), equips its levies with what its cities can pay for, expands
 * with settlers, keeps a garrison in each city and goes to war when it feels much stronger.
 */
import { DEFAULT_LOADOUT, type Loadout } from '../data/items.ts';
import {
  assignDesign,
  atWar,
  attack,
  canFoundCity,
  declareWar,
  formationsAt,
  foundCity,
  gridOf,
  levy,
  merge,
  militaryPower,
  planPath,
  previewBattle,
  refitPreview,
  saveDesign,
  supplyingCity,
  trainSettlers,
  advance,
} from './game.ts';
import { distance, neighbors, within } from './hex.ts';
import { hexFood, isPassableLand } from './mapgen.ts';
import { hashSeed, mulberry32, type Rng } from './rng.ts';
import type { Civ, Formation, GameState } from './types.ts';
import { capOf, COHORT_SIZE, isRanged, loadoutProblem, people } from './units.ts';

interface Plan {
  name: string;
  role: 'front' | 'ranged';
  rank: number;
  loadout: (t: string[]) => Loadout;
}

const has = (t: string[], id: string) => t.includes(id);
const PLANS: Plan[] = [
  {
    name: 'Spear levy',
    role: 'front',
    rank: 0,
    loadout: () => ({ ...DEFAULT_LOADOUT, weapon: 'spear', shield: 'wicker-shield' }),
  },
  {
    name: 'Javelineers',
    role: 'ranged',
    rank: 0,
    loadout: () => ({ ...DEFAULT_LOADOUT, weapon: 'javelins', shield: 'wicker-shield' }),
  },
  {
    name: 'Spearmen',
    role: 'front',
    rank: 1,
    loadout: t => ({
      ...DEFAULT_LOADOUT,
      weapon: 'spear',
      shield: 'hide-shield',
      armour: has(t, 'tanning') ? 'leather' : 'padded',
      helmet: has(t, 'tanning') ? 'leather-cap' : 'no-helmet',
    }),
  },
  {
    name: 'Slingers',
    role: 'ranged',
    rank: 1,
    loadout: () => ({ ...DEFAULT_LOADOUT, weapon: 'sling', armour: 'padded' }),
  },
  {
    name: 'Archers',
    role: 'ranged',
    rank: 2,
    loadout: t => ({
      ...DEFAULT_LOADOUT,
      weapon: 'bow',
      armour: 'padded',
      helmet: has(t, 'tanning') ? 'leather-cap' : 'no-helmet',
    }),
  },
  {
    name: 'Swordsmen',
    role: 'front',
    rank: 3,
    loadout: () => ({
      ...DEFAULT_LOADOUT,
      weapon: 'bronze-sword',
      shield: 'bronze-shield',
      helmet: 'bronze-helmet',
      armour: 'bronze-scale',
    }),
  },
  {
    name: 'Riders',
    role: 'front',
    rank: 2,
    loadout: t => ({
      ...DEFAULT_LOADOUT,
      weapon: has(t, 'bronze-working') ? 'bronze-sword' : 'spear',
      shield: 'hide-shield',
      mount: 'horse',
    }),
  },
];

function ensureDesigns(s: GameState, civ: Civ) {
  for (const p of PLANS) {
    const l = p.loadout(civ.techs);
    if (loadoutProblem(l, civ.techs)) continue;
    const ex = civ.designs.find(d => d.name === p.name);
    if (!ex) saveDesign(s, civ.id, p.name, l);
    else if (JSON.stringify(ex.loadout) !== JSON.stringify(l))
      saveDesign(s, civ.id, p.name, l, ex.id);
  }
}

/** Equip plain levy cohorts: about 60% front line, 40% ranged, best design the city can pay for. */
function equip(s: GameState, civ: Civ, f: Formation) {
  if (f.kind !== 'army' || f.name === 'Scouts' || f.moves <= 0) return;
  if (!supplyingCity(s, civ.id, f.hex)) return;
  const raw = f.cohorts.filter(c => c.designId === null);
  if (!raw.length) return;
  const ranged = f.cohorts.filter(c => c.designId !== null && isRanged(c.loadout)).length;
  const wantRanged = Math.round(f.cohorts.length * 0.4) - ranged;
  const options = (role: Plan['role']) =>
    PLANS.filter(p => p.role === role)
      .map(p => ({ p, d: civ.designs.find(d => d.name === p.name) }))
      .filter(x => x.d)
      .sort((a, b) => b.p.rank - a.p.rank);
  const tryAssign = (ids: number[], role: Plan['role']) => {
    for (const { d } of options(role)) {
      const pv = refitPreview(s, f.id, ids, d!.loadout);
      if (pv.problem === null && !pv.missing.length) return assignDesign(s, f.id, ids, d!.id).ok;
    }
    return false;
  };
  const rIds = raw.slice(0, Math.max(0, wantRanged)).map(c => c.id);
  const fIds = raw.slice(Math.max(0, wantRanged)).map(c => c.id);
  if (rIds.length) tryAssign(rIds, 'ranged');
  if (fIds.length) tryAssign(fIds, 'front');
}

function bestSite(s: GameState, f: Formation, rng: Rng): number {
  const g = gridOf(s);
  let best = -1,
    bv = -Infinity;
  for (const k of within(g, f.hex, 9)) {
    if (!isPassableLand(s.map, k) || formationsAt(s, k).some(x => x.civId !== f.civId)) continue;
    if (canFoundCity(s, { ...f, hex: k })) continue;
    let v = 0;
    for (const n of within(g, k, 1)) v += hexFood(s.map, n) + (s.map.deposit[n] ? 1.5 : 0);
    v -= distance(g, f.hex, k) * 0.6 + rng() * 0.5;
    if (v > bv) {
      bv = v;
      best = k;
    }
  }
  return best;
}

/** Path to the best free hex next to `target`. */
function pathNextTo(s: GameState, f: Formation, target: number): number[] | null {
  let best: number[] | null = null;
  for (const n of neighbors(gridOf(s), target)) {
    if (n === f.hex) return [];
    const p = planPath(s, f, n);
    if (p && (!best || p.length < best.length)) best = p;
  }
  return best;
}

export function aiTurn(s: GameState, civ: Civ) {
  const g = gridOf(s);
  const rng = mulberry32(hashSeed(s.settings.map.seed, s.turn * 131 + civ.id));
  ensureDesigns(s, civ);
  const cities = s.cities.filter(c => c.civId === civ.id);
  const mine = () => s.formations.filter(f => f.civId === civ.id);

  // --- cities: settlers first while small, then levies
  const settlersOut = mine().some(f => f.kind === 'settlers');
  for (const c of cities) {
    const armies = mine().filter(f => f.kind === 'army' && f.name !== 'Scouts').length;
    if (!settlersOut && cities.length < 4 && s.turn > 6 && c.pop >= 3000) trainSettlers(s, c.id);
    else if (c.pop >= 3000 && armies < cities.length * 2 + 1) levy(s, c.id);
  }

  // --- war
  const enemies = s.civs.filter(o => o.alive && o.id !== civ.id && atWar(s, civ.id, o.id));
  if (!enemies.length && s.turn > 30 && rng() < 0.06) {
    const mineP = militaryPower(s, civ.id);
    const targets = s.civs.filter(o => {
      if (!o.alive || o.id === civ.id || !civ.met.includes(o.id)) return false;
      const near = s.cities.some(
        c => c.civId === o.id && cities.some(m => distance(g, c.hex, m.hex) <= 14),
      );
      return near && mineP > militaryPower(s, o.id) * 1.5 + 5;
    });
    if (targets.length) declareWar(s, civ.id, targets[Math.floor(rng() * targets.length)].id);
  }

  // --- formations
  const garrisoned = new Set<number>();
  for (const f of mine()) {
    if (!s.formations.includes(f)) continue;
    equip(s, civ, f);
    if (f.kind === 'settlers') {
      // settle on arrival; pick a site if there is no route yet
      if (!f.path.length) {
        if (canFoundCity(s, f) === null && (cities.length === 0 || bestSite(s, f, rng) === f.hex)) {
          foundCity(s, f.id);
          continue;
        }
        const site = bestSite(s, f, rng);
        if (site >= 0) f.path = planPath(s, f, site) ?? [];
        if (!f.path.length && canFoundCity(s, f) === null) {
          foundCity(s, f.id);
          continue;
        }
      }
      advance(s, f);
      if (s.formations.includes(f) && !f.path.length && canFoundCity(s, f) === null)
        foundCity(s, f.id);
      continue;
    }
    if (f.name === 'Scouts') {
      if (!f.path.length) {
        let best = -1,
          bd = Infinity;
        for (const k of within(g, f.hex, 8)) {
          if (civ.explored[k] || !isPassableLand(s.map, k)) continue;
          const d = distance(g, f.hex, k) + rng() * 2;
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
        if (best >= 0) f.path = planPath(s, f, best) ?? [];
      }
      advance(s, f);
      continue;
    }
    // garrison: one army sits in each city
    const home = cities.find(c => c.hex === f.hex && !garrisoned.has(c.id));
    if (home && (!enemies.length || cities.length > garrisoned.size + 1 || people(f) < 400)) {
      garrisoned.add(home.id);
      // fold a second army on the same hex into the garrison while there is room
      for (const o of formationsAt(s, f.hex))
        if (
          o !== f &&
          o.civId === civ.id &&
          o.kind === 'army' &&
          o.cohorts.length + f.cohorts.length <= capOf(f) &&
          o.name !== 'Scouts'
        )
          merge(s, o.id, f.id);
      f.fortified = true;
      continue;
    }
    const ungarrisoned = cities.find(
      c =>
        !garrisoned.has(c.id) &&
        !formationsAt(s, c.hex).some(x => x.civId === civ.id && x.kind === 'army' && x !== f),
    );
    if (!enemies.length) {
      if (ungarrisoned && f.hex !== ungarrisoned.hex) {
        f.path = planPath(s, f, ungarrisoned.hex) ?? [];
        advance(s, f);
      } else f.fortified = true;
      continue;
    }
    // at war: weakened formations go home to recover
    if (people(f) < f.cohorts.length * COHORT_SIZE * 0.55 && cities.length) {
      const c = cities
        .slice()
        .sort((a, b) => distance(g, a.hex, f.hex) - distance(g, b.hex, f.hex))[0];
      if (f.hex !== c.hex) {
        f.path = planPath(s, f, c.hex) ?? [];
        advance(s, f);
      }
      continue;
    }
    // hunt: nearest enemy army, settlers or city
    let target = -1,
      td = Infinity;
    for (const o of s.formations) {
      if (!enemies.some(e => e.id === o.civId)) continue;
      const d = distance(g, f.hex, o.hex);
      if (d < td && d <= 10) {
        td = d;
        target = o.hex;
      }
    }
    for (const c of s.cities) {
      if (!enemies.some(e => e.id === c.civId)) continue;
      const d = distance(g, f.hex, c.hex) - 2;
      if (d < td) {
        td = d;
        target = c.hex;
      }
    }
    if (target < 0) continue;
    if (distance(g, f.hex, target) === 1) {
      const pv = previewBattle(s, f.id, target);
      const good =
        !pv ||
        pv.outcome === 'defender-broke' ||
        pv.defender.lost / Math.max(1, pv.defender.start) >=
          (pv.attacker.lost / Math.max(1, pv.attacker.start)) * 0.9;
      if (good) {
        attack(s, f.id, target);
        continue;
      }
      f.fortified = true;
      continue;
    }
    f.path = pathNextTo(s, f, target) ?? [];
    advance(s, f);
    // close enough to strike this turn?
    if (s.formations.includes(f) && f.moves > 0 && distance(g, f.hex, target) === 1) {
      const pv = previewBattle(s, f.id, target);
      if (!pv || pv.outcome === 'defender-broke') attack(s, f.id, target);
    }
  }
}
