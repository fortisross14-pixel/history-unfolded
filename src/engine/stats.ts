/**
 * Statistics and the chronicle. Every turn each great people's numbers are recorded (population,
 * settlements, techs, culture, GDP, military power, score), so the player can rank and chart
 * peoples over time; notable moments go into a chronicle that tells the story of the game.
 * Free peoples are left out of both. Kept compact: one small array per people per turn.
 */
import { militaryPower, score } from './game.ts';
import type { GameState } from './types.ts';

export const METRICS = [
  { id: 'pop', name: 'Population', unit: 'people' },
  { id: 'cities', name: 'Settlements', unit: '' },
  { id: 'techs', name: 'Technologies', unit: 'known' },
  { id: 'culture', name: 'Culture', unit: 'a turn' },
  { id: 'gdp', name: 'Wealth (GDP)', unit: 'a turn' },
  { id: 'military', name: 'Military power', unit: '' },
  { id: 'score', name: 'Score', unit: 'points' },
] as const;
export type MetricId = (typeof METRICS)[number]['id'];
const INDEX: Record<MetricId, number> = Object.fromEntries(
  METRICS.map((m, i) => [m.id, i]),
) as Record<MetricId, number>;

/** One turn's numbers: per people id, its metrics in METRICS order (null when gone or free). */
export interface StatsRow {
  t: number;
  v: (number[] | null)[];
}

/** The numbers of one people now. */
export function currentStats(s: GameState, civId: number): number[] {
  const civ = s.civs[civId];
  const mine = s.cities.filter(c => c.civId === civId);
  return [
    mine.reduce((a, c) => a + c.pop, 0),
    mine.length,
    civ.techs.length,
    civ.stats?.culture ?? 0,
    civ.stats?.gdp ?? 0,
    Math.round(militaryPower(s, civId)),
    score(s, civId),
  ];
}

/** Called at the end of each turn. */
export function recordStats(s: GameState) {
  s.statsHistory ??= [];
  s.statsHistory.push({
    t: s.turn,
    v: s.civs.map(c => (c.alive && !c.independent ? currentStats(s, c.id) : null)),
  });
  // saves stay small: the last 40 turns turn by turn, older ones every fourth turn
  const h = s.statsHistory;
  if (h.length > 160) {
    const recent = h.slice(-40);
    s.statsHistory = [...h.slice(0, -40).filter(r => r.t % 4 === 0), ...recent];
  }
}

export const metricOf = (row: number[] | null | undefined, m: MetricId) =>
  row ? row[INDEX[m]] : null;

/** Rank of each people on a metric now (1 = first), among the given peoples. */
export function ranking(s: GameState, ids: number[], m: MetricId) {
  return ids
    .map(id => ({ id, v: currentStats(s, id)[INDEX[m]] }))
    .sort((a, b) => b.v - a.v)
    .map((x, i) => ({ ...x, rank: i + 1 }));
}

// ---------------------------------------------------------------- chronicle

export interface ChronicleEntry {
  turn: number;
  civId: number;
  kind:
    | 'age'
    | 'war'
    | 'peace'
    | 'capture'
    | 'found'
    | 'grow'
    | 'crisis'
    | 'direction'
    | 'dynasty'
    | 'victory'
    | 'faith'
    | 'wonder'
    | 'story'
    | 'other';
  text: string;
}

/** The log lines worth keeping for good, and what kind of moment each is. */
const KEEP: [RegExp, ChronicleEntry['kind']][] = [
  [/ enter the .* age\./, 'age'],
  [/ complete the .* in /, 'wonder'],
  [/, chapter \d: /, 'story'],
  [/ found a new faith, | now keep | drift away from |takes up a new tenet/, 'faith'],
  [/ declared war on /, 'war'],
  [/ joined their allies against /, 'war'],
  [/ made peace\./, 'peace'],
  [/ captured .* from /, 'capture'],
  [/ cede .* to the /, 'capture'],
  [/ founded\b|keep the free city of/, 'found'],
  [/ grew from a .* into a /, 'grow'],
  [/ strikes the /, 'crisis'],
  [/ take a new direction: /, 'direction'],
  [/[Cc]ivil war|rises against|takes the throne|new dynasty/, 'dynasty'],
  [/ win the .* victory| hold the .* goal/, 'victory'],
];

/** Every log line passes here: the notable ones are kept in the chronicle. */
export function chronicle(s: GameState, civId: number, text: string) {
  if (s.civs[civId]?.independent) return;
  // battle reports are told by the capture line that follows them
  if (text.startsWith('Battle')) return;
  for (const [re, kind] of KEEP)
    if (re.test(text)) {
      s.chronicle ??= [];
      s.chronicle.push({ turn: s.turn, civId, kind, text });
      // a long game keeps its last 800 moments
      if (s.chronicle.length > 800) s.chronicle.splice(0, s.chronicle.length - 800);
      return;
    }
}
