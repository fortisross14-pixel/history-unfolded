/**
 * Ruins: places to explore in the first ages. Scattered over the wild land at the start, each
 * holds one find for the first unit to step onto it: gold, lost scrolls, a cache of rare goods
 * (ivory and hides make ivory lamellar, copper and tin bronze), an ancient armoury that re-arms
 * the finder's first cohorts with gear far ahead of its time, a map of distant land, survivors
 * who join, or a relic for the houses. Exploring early pays.
 */
import { ageOf } from '../data/techs.ts';
import { awardTrinket } from './dynasty.ts';
import { addCohorts, isWaterHex, log, techCost } from './game.ts';
import { distance, within } from './hex.ts';
import { isPassableLand } from './mapgen.ts';
import { hashSeed, mulberry32 } from './rng.ts';
import type { Formation, GameState } from './types.ts';

export type RuinKind = 'city' | 'barrow' | 'camp' | 'temple';
export interface Ruin {
  hex: number;
  kind: RuinKind;
}

export const RUIN_NAME: Record<RuinKind, string> = {
  city: 'the ruins of an old city',
  barrow: 'an ancient barrow',
  camp: 'an abandoned camp',
  temple: 'a fallen temple',
};

/** one ruin for about this many hexes of open land away from the starts */
const LAND_PER_RUIN = 55;

/** Scatter ruins over the wild land, away from where peoples start. */
export function placeRuins(s: GameState) {
  const g = { w: s.map.w, h: s.map.h };
  const r = mulberry32(hashSeed(s.settings.map.seed, 7717));
  const starts = s.cities.map(c => c.hex).concat(s.formations.map(f => f.hex));
  const land: number[] = [];
  for (let i = 0; i < g.w * g.h; i++)
    if (!isWaterHex(s, i) && isPassableLand(s.map, i) && starts.every(h => distance(g, h, i) >= 4))
      land.push(i);
  const want = Math.max(8, Math.round(land.length / LAND_PER_RUIN));
  const kinds: RuinKind[] = ['city', 'barrow', 'camp', 'temple'];
  const ruins: Ruin[] = [];
  for (let k = 0; k < want * 20 && ruins.length < want && land.length; k++) {
    const hex = land[Math.floor(r() * land.length)];
    if (ruins.some(x => distance(g, x.hex, hex) < 4)) continue;
    ruins.push({ hex, kind: kinds[Math.floor(r() * kinds.length)] });
  }
  s.ruins = ruins;
}

export const ruinAt = (s: GameState, hex: number) => s.ruins?.find(x => x.hex === hex);

type Find = (s: GameState, f: Formation, r: () => number) => string | null;

/** The finds, by weight. Each returns what was found, or null when it does not apply. */
const FINDS: [number, Find][] = [
  [
    3,
    (s, f, r) => {
      const gold = Math.round(25 + r() * 35) * Math.max(1, ageOf(s.civs[f.civId].techs));
      s.civs[f.civId].gold += gold;
      return `a buried hoard: ${gold} gold`;
    },
  ],
  [
    2,
    (s, f) => {
      const civ = s.civs[f.civId];
      const cost = civ.researching ? techCost(s, civ, civ.researching) : 40;
      const n = Math.round(cost * 0.5);
      civ.science += n;
      return `lost scrolls: +${n} science toward your research`;
    },
  ],
  [
    3,
    (s, f, r) => {
      const cap = s.cities.filter(c => c.civId === f.civId).sort((a, b) => a.id - b.id)[0];
      if (!cap) return null;
      const caches: [string, Record<string, number>][] = [
        ['ivory and hides', { ivory: 4, hides: 3 }],
        ['copper and tin', { copper: 4, tin: 3 }],
        ['fine furs', { furs: 5, hides: 2 }],
        ['horses gone wild', { horses: 4 }],
      ];
      const [what, goods] = caches[Math.floor(r() * caches.length)];
      for (const [k, n] of Object.entries(goods)) cap.stockpile[k] = (cap.stockpile[k] ?? 0) + n;
      return `a cache of ${what}, carried home to ${cap.name}`;
    },
  ],
  [
    2,
    (s, f) => {
      if (f.kind !== 'army' || !f.cohorts.length) return null;
      // gear far ahead of its time for the first cohorts
      const n = Math.min(2, f.cohorts.length);
      for (const co of f.cohorts.slice(0, n)) {
        co.loadout = { ...co.loadout, weapon: 'bronze-sword', armour: 'bronze-scale' };
        co.designId = null;
      }
      return `an ancient armoury: ${n} cohort${n > 1 ? 's' : ''} now carry bronze swords and scale armour`;
    },
  ],
  [
    2,
    (s, f, r) => {
      const g = { w: s.map.w, h: s.map.h };
      const civ = s.civs[f.civId];
      const far: number[] = [];
      for (let i = 0; i < g.w * g.h; i++)
        if (!civ.explored[i] && !isWaterHex(s, i) && distance(g, f.hex, i) <= 18) far.push(i);
      if (!far.length) return null;
      const at = far[Math.floor(r() * far.length)];
      for (const k of within(g, at, 4)) civ.explored[k] = 1;
      return 'an old map: a far land appears on yours';
    },
  ],
  [
    2,
    (s, f) => {
      if (f.kind !== 'army') return null;
      addCohorts(s, f, 1);
      return 'survivors who join you: one more cohort';
    },
  ],
  [
    1,
    (s, f) => {
      const civ = s.civs[f.civId];
      if (civ.independent || !civ.dynasties.length) return null;
      const t = awardTrinket(s, civ, 'culture', f.hex);
      return `a relic, the ${t.name}, for your houses`;
    },
  ],
];

/** A formation stepped onto a hex: if it holds ruins, they are searched. Returns the news. */
export function searchRuins(s: GameState, f: Formation): string | null {
  const ruin = ruinAt(s, f.hex);
  if (!ruin || s.civs[f.civId].raiders) return null;
  if (f.kind === 'fleet') return null;
  s.ruins = s.ruins!.filter(x => x !== ruin);
  const r = mulberry32(hashSeed(s.settings.map.seed, f.hex * 131 + s.turn * 7 + f.civId));
  // draw by weight until one applies
  const options = FINDS.filter(([w]) => w > 0);
  for (let k = 0; k < 12; k++) {
    let roll = r() * options.reduce((a, [w]) => a + w, 0);
    const pick = options.find(([w]) => (roll -= w) <= 0) ?? options[0];
    const found = pick[1](s, f, r);
    if (found) {
      const msg = `${f.name} searched ${RUIN_NAME[ruin.kind]} and found ${found}.`;
      log(s, f.civId, msg);
      return msg;
    }
  }
  const gold = 20;
  s.civs[f.civId].gold += gold;
  const msg = `${f.name} searched ${RUIN_NAME[ruin.kind]} and found ${gold} gold.`;
  log(s, f.civId, msg);
  return msg;
}

/** The nearest ruins a people knows of within reach of a hex, if any. */
export function nearRuin(s: GameState, civId: number, hex: number, reach = 8): number | undefined {
  const g = { w: s.map.w, h: s.map.h };
  const known = s.civs[civId].explored;
  let best: number | undefined,
    bd = Infinity;
  for (const r of s.ruins ?? []) {
    if (!known[r.hex]) continue;
    const d = distance(g, hex, r.hex);
    if (d <= reach && d < bd) [best, bd] = [r.hex, d];
  }
  return best;
}
