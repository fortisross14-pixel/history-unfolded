// Headless balance run.
//   npm run sim                         one full run on the reference seed
//   npm run sim -- --seeds 4            summary over several seeds
//   npm run sim -- --seed 7 --years 2000 --map large --every 2
// Prints key metrics and fails if the run is slower than the time budget.
import { runBalanceTest } from '../src/engine/index.ts';
import { formatMetrics, type WorldMetrics } from '../src/engine/metrics.ts';
import type { MapSize } from '../src/types.ts';

// Full 5,000-year run on the default (medium) map must not exceed this.
// The pre-overhaul engine took 94-143 s on the reference machine.
const BUDGET_MS = 140_000;

function arg(name: string, fallback: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const seed = Number(arg('seed', '424242'));
const seeds = Number(arg('seeds', '1'));
// --map earth plays on real geography; --start picks its start year (-3000, 1 or 1444).
const earth = arg('map', 'medium') === 'earth';
const start = Number(arg('start', '-3000'));
const years = Number(arg('years', String(earth ? 2000 - start : 5000)));
const mapSize = (earth ? 'medium' : arg('map', 'medium')) as MapSize;
const label = earth
  ? `Earth map from ${start < 0 ? `${-start} BCE` : `${start} CE`}`
  : `${mapSize} map`;
const every = Number(arg('every', '5'));

function run(runSeed: number) {
  const started = performance.now();
  const { metrics } = runBalanceTest(runSeed, years, mapSize, earth ? 'earth' : 'fantasy', start);
  return { metrics, ms: performance.now() - started };
}

/** Largest share of world power any realm held at a century mark. */
const peakShare = (m: WorldMetrics) =>
  Math.max(0, ...m.centuries.map(c => c.leaders[0]?.score ?? 0)) / 10;

if (seeds <= 1) {
  const { metrics, ms } = run(seed);
  console.log(`History Unfolded sim · seed ${seed} · ${years} years · ${label}`);
  console.log(formatMetrics(metrics, every));
  console.log('');
  console.log(
    `Time: ${(ms / 1000).toFixed(1)} s (${(ms / Math.max(1, years / 100)).toFixed(0)} ms per century)`,
  );
  const budget = (BUDGET_MS * years) / 5000;
  if (mapSize === 'medium' && ms > budget) {
    console.error(`Too slow: budget is ${(budget / 1000).toFixed(1)} s for this run.`);
    process.exit(1);
  }
} else {
  console.log(`History Unfolded sim · ${seeds} seeds · ${years} years · ${label}`);
  console.log(
    'seed      realms  moments/c  great wars  longest on top          peak share  gen avg  time',
  );
  let slowest = 0;
  for (let i = 0; i < seeds; i++) {
    const runSeed = seed + i * 1009;
    const { metrics: m, ms } = run(runSeed);
    slowest = Math.max(slowest, ms);
    const perCentury = m.moments / Math.max(1, m.centuries.length - 1);
    console.log(
      [
        String(runSeed).padEnd(9),
        String(m.livingRealms).padStart(6),
        perCentury.toFixed(1).padStart(10),
        String(m.greatWars).padStart(11),
        `  ${m.longestLead.years} y (${m.longestLead.name})`.slice(0, 24).padEnd(24),
        `${peakShare(m).toFixed(0)}%`.padStart(10),
        m.generationalAverage.toFixed(1).padStart(8),
        `${(ms / 1000).toFixed(0)} s`.padStart(6),
      ].join(''),
    );
  }
  if (mapSize === 'medium' && slowest > (BUDGET_MS * years) / 5000) {
    console.error('Too slow: at least one run exceeded the time budget.');
    process.exit(1);
  }
}
