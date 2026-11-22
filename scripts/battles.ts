/** Matchup table for army compositions, to see what combinations win. Flat grassland, no walls. */
import { DEFAULT_LOADOUT, type Loadout } from '../src/data/items.ts';
import { resolveBattle } from '../src/engine/combat.ts';
import { generateMap } from '../src/engine/mapgen.ts';
import { mulberry32 } from '../src/engine/rng.ts';
import type { Cohort } from '../src/engine/types.ts';
import { BASE_MORALE } from '../src/engine/units.ts';

const D = DEFAULT_LOADOUT;
const T: Record<string, Loadout> = {
  levy: D,
  spear: { ...D, weapon: 'spear', shield: 'hide-shield', armour: 'padded' },
  archer: { ...D, weapon: 'bow', armour: 'padded' },
  sling: { ...D, weapon: 'sling' },
  sword: {
    ...D,
    weapon: 'bronze-sword',
    shield: 'bronze-shield',
    helmet: 'bronze-helmet',
    armour: 'bronze-scale',
  },
  axe: { ...D, weapon: 'axe', helmet: 'bronze-helmet', armour: 'bronze-scale' },
  rider: { ...D, weapon: 'spear', shield: 'hide-shield', mount: 'horse' },
  hoplite: {
    ...D,
    weapon: 'spear',
    shield: 'bronze-shield',
    helmet: 'bronze-helmet',
    armour: 'bronze-scale',
  },
};
const ARMIES: Record<string, [string, number][]> = {
  '10 levy': [['levy', 10]],
  '10 spear': [['spear', 10]],
  '10 archer': [['archer', 10]],
  '6 spear 4 archer': [
    ['spear', 6],
    ['archer', 4],
  ],
  '10 sword': [['sword', 10]],
  '6 sword 4 archer': [
    ['sword', 6],
    ['archer', 4],
  ],
  '10 rider': [['rider', 10]],
  '4 rider 4 spear 2 archer': [
    ['rider', 4],
    ['spear', 4],
    ['archer', 2],
  ],
  '6 hoplite 4 archer': [
    ['hoplite', 6],
    ['archer', 4],
  ],
  '6 axe 4 archer': [
    ['axe', 6],
    ['archer', 4],
  ],
};
let id = 1;
const build = (k: string): Cohort[] =>
  ARMIES[k].flatMap(([t, n]) =>
    Array.from({ length: n }, () => ({
      id: id++,
      strength: 100,
      xp: 0,
      designId: null,
      loadout: T[t],
    })),
  );
const map = generateMap({
  type: 'pangaea',
  size: 'small',
  seaLevel: 'normal',
  climate: 'normal',
  rainfall: 'normal',
  resources: 'normal',
  mountains: 'normal',
  seed: 1,
});
const flat = map.terrain.findIndex(
  (t, i) => t === 'grassland' && map.relief[i] === 'flat' && map.vegetation[i] === 'none',
);
const names = Object.keys(ARMIES);
console.log(
  'attacker → defender: attacker losses / defender losses (W = defender broke, L = attacker broke, = held)\n',
);
const score: Record<string, number> = {};
for (const a of names) {
  const row: string[] = [];
  for (const d of names) {
    let w = 0,
      la = 0,
      ld = 0;
    const N = 20;
    for (let k = 0; k < N; k++) {
      const r = resolveBattle(
        { name: a, cohorts: build(a), morale: BASE_MORALE },
        { name: d, cohorts: build(d), morale: BASE_MORALE },
        {
          map,
          hex: flat,
          fortified: false,
          city: false,
          volleyOnly: ARMIES[a].every(([t]) => t === 'archer' || t === 'sling'),
          rng: mulberry32(k * 977 + 1),
        },
      );
      if (r.outcome === 'defender-broke') w++;
      if (r.outcome === 'attacker-broke') w--;
      la += r.attacker.lost;
      ld += r.defender.lost;
    }
    score[a] = (score[a] ?? 0) + w;
    score[d] = (score[d] ?? 0) - w;
    row.push(
      `${(w > 6 ? 'W' : w < -6 ? 'L' : '=').padStart(1)} ${String(Math.round(la / N)).padStart(3)}/${String(Math.round(ld / N)).padEnd(3)}`,
    );
  }
  console.log(a.padEnd(26), row.join(' '));
}
console.log('\nheader:', names.map((n, i) => `${i}:${n}`).join(' | '));
console.log('\nscore (wins as attacker or defender, net):');
for (const [k, v] of Object.entries(score).sort((x, y) => y[1] - x[1]))
  console.log(String(v).padStart(5), k);
