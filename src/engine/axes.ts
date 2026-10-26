import type {
  AxisKey,
  Character,
  Civilization,
  NationalAxes,
  TraitId,
  WorldState,
} from '../types.ts';
import { RNG } from './rng.ts';
import { courtOf, idx, isAlive } from './lookup.ts';
import { neigh } from './util.ts';
import { rarityDef } from './traits.ts';
import { yearsOnTop } from './power.ts';

export interface AxisDef {
  key: AxisKey;
  label: string;
  low: string;
  high: string;
}

/** 0 is the left word, 100 the right word. */
export const AXES: AxisDef[] = [
  { key: 'ambition', label: 'Ambition', low: 'Inward', high: 'Expansionist' },
  { key: 'horizon', label: 'Horizon', low: 'Land', high: 'Sea' },
  { key: 'economy', label: 'Economy', low: 'Agrarian', high: 'Mercantile' },
  { key: 'faith', label: 'Faith', low: 'Zealous', high: 'Tolerant' },
  { key: 'order', label: 'Order', low: 'Centralised', high: 'Fractious' },
];

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Share of a realm's provinces that touch the sea, 0–1. */
export function coastalShare(s: WorldState, c: Civilization) {
  if (!c.provinces.length) return 0;
  let coastal = 0;
  for (const id of c.provinces)
    if (neigh(s.provinces[id], s).some(n => n.terrain === 'ocean')) coastal++;
  return coastal / c.provinces.length;
}

export function initialAxes(r: RNG, coastal: boolean): NationalAxes {
  return {
    ambition: r.int(30, 70),
    horizon: coastal ? r.int(50, 72) : r.int(18, 40),
    economy: r.int(22, 50),
    faith: r.int(30, 70),
    order: r.int(30, 70),
  };
}

/** How each trait pulls a ruler's realm; Seafarer kings turn land powers to the sea. */
const TRAIT_PULL: Partial<Record<TraitId, [AxisKey, number]>> = {
  Ambitious: ['ambition', 1],
  Cruel: ['ambition', 0.6],
  Craven: ['ambition', -1],
  Seafarer: ['horizon', 2],
  Greedy: ['economy', 1],
  Frugal: ['economy', 0.6],
  Builder: ['economy', 0.4],
  Pious: ['faith', -1.2],
  Tolerant: ['faith', 1.2],
  Brilliant: ['faith', 0.4],
  Just: ['order', -1],
  Paranoid: ['order', -0.6],
  Reformer: ['order', 0.6],
  Mad: ['order', 1.2],
  Charismatic: ['order', -0.4],
};

/** Notables pull their realm too, at a third of a ruler's strength. */
const ROLE_PULL: Partial<Record<Character['role'], [AxisKey, number]>> = {
  Explorer: ['horizon', 0.8],
  Admiral: ['horizon', 0.8],
  Merchant: ['economy', 0.8],
  Prophet: ['faith', -0.8],
  General: ['ambition', 0.6],
  Statesman: ['order', -0.6],
  Scholar: ['faith', 0.4],
};

/** Yearly pull of one character; rarity matters a lot (Generational ≈ 9× Common). */
const pullOf = (ch: Character) => 0.06 * rarityDef(ch.rarity).weight ** 2;

/**
 * Slow yearly drift. Geography pulls Horizon toward the coast, long trade
 * pulls Economy toward Mercantile, and the ruler and court nudge each axis
 * by their traits and rarity. Every axis relaxes slightly toward the middle.
 */
export function driftAxes(s: WorldState, c: Civilization, tradeRoutes: number) {
  const a = c.axes;
  a.horizon += (coastalShare(s, c) * 100 - a.horizon) * 0.004;
  a.economy += Math.min(0.05, tradeRoutes * 0.008);
  // A long-dominant power loses its drive and its grip.
  if (yearsOnTop(s, c) > 150) {
    a.ambition -= 0.05;
    a.order += 0.05;
  }
  // Sprawling realms drift toward local lords and fractious nobles.
  a.order += Math.max(0, c.provinces.length - 15) * 0.003;
  const ruler = idx(s).char.get(c.rulerId);
  if (isAlive(ruler))
    for (const t of ruler.traits) {
      const pull = TRAIT_PULL[t];
      if (pull) a[pull[0]] += pull[1] * pullOf(ruler);
    }
  for (const ch of courtOf(s, c.id)) {
    const pull = ROLE_PULL[ch.role];
    if (pull) a[pull[0]] += (pull[1] * pullOf(ch)) / 3;
  }
  for (const def of AXES) a[def.key] = clamp(a[def.key] + (50 - a[def.key]) * 0.0015);
}

/** Wars leave a mark: crushing defeats turn a people inward, victories feed ambition. */
export function warShapesAxes(c: Civilization, won: boolean, decisive: boolean) {
  c.axes.ambition = clamp(c.axes.ambition + (won ? (decisive ? 4 : 2) : decisive ? -8 : -3));
  if (!won && decisive) c.axes.order = clamp(c.axes.order + 4);
}

const word = (v: number, low: string, high: string, mid = '') =>
  v < 35 ? low : v > 65 ? high : mid;

/** One generated sentence that describes the country. */
export function describeNation(c: Civilization) {
  const a = c.axes;
  const order = word(a.order, 'centralised', 'fractious', 'orderly');
  const horizon = word(a.horizon, 'land', 'seafaring', '');
  const economy = word(a.economy, 'farming', 'merchant', 'trading');
  const noun = a.order > 65 ? 'league' : a.ambition > 65 ? 'power' : 'realm';
  const subject = [order, horizon, economy].filter(Boolean).join(' ');
  const article = /^[aeiou]/i.test(subject) ? 'An' : 'A';
  const faith = word(
    a.faith,
    'zealous in its faith',
    'tolerant of every creed',
    'steady in its faith',
  );
  const ambition = word(
    a.ambition,
    'content within its borders',
    'hungry for new land',
    'watchful of its neighbours',
  );
  return `${article} ${subject} ${noun}, ${faith} and ${ambition}.`.replace(/\s+/g, ' ');
}
