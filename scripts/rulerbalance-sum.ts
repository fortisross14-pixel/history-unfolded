/**
 * Merge rulerbalance.ts runs: per ruler and per strength, games, average rank, average score share
 * (1.00 = the game's average) and wins.
 * Usage: node --no-warnings scripts/rulerbalance-sum.ts a.json b.json …
 */
import { readFileSync } from 'node:fs';
import { RULER_BY_ID } from '../src/data/rulers.ts';

interface Result {
  seed: number;
  ruler: string;
  rank: number;
  share: number;
  won: boolean;
  alive: boolean;
}
const all: Result[] = process.argv.slice(2).flatMap(f => {
  try {
    return JSON.parse(readFileSync(f, 'utf8')) as Result[];
  } catch {
    return [];
  }
});
const games = new Set(all.map(x => x.seed)).size;
console.log(`${games} games, ${all.length} rulers played\n`);
const table = (key: (x: Result) => string[], title: string) => {
  const by: Record<string, Result[]> = {};
  for (const x of all) for (const k of key(x)) (by[k] ??= []).push(x);
  const rows = Object.entries(by).map(([k, xs]) => {
    const avg = (f: (x: Result) => number) => xs.reduce((m, x) => m + f(x), 0) / xs.length;
    return {
      k,
      n: xs.length,
      rank: avg(x => x.rank),
      share: avg(x => x.share),
      wins: xs.filter(x => x.won).length,
      gone: xs.filter(x => !x.alive).length,
    };
  });
  rows.sort((p, q) => q.share - p.share);
  console.log(`${title.padEnd(26)} games  rank  share  wins  gone`);
  for (const r of rows)
    console.log(
      `${r.k.padEnd(26)} ${String(r.n).padStart(5)} ${r.rank.toFixed(1).padStart(5)} ${r.share.toFixed(2).padStart(6)} ${String(r.wins).padStart(5)} ${String(r.gone).padStart(5)}`,
    );
  console.log('');
};
table(x => [RULER_BY_ID[x.ruler].name], 'ruler');
table(x => [`${RULER_BY_ID[x.ruler].major} (major)`], 'major strength');
table(x => [`${RULER_BY_ID[x.ruler].minor} (minor)`], 'minor strength');
