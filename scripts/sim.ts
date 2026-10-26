// Headless balance run: `npm run sim -- --seed 424242 --years 5000 --map medium`
// Prints key metrics and fails if the run is slower than the time budget.
import { runBalanceTest } from '../src/engine/index.ts';
import { formatMetrics } from '../src/engine/metrics.ts';
import type { MapSize } from '../src/types.ts';

// Full 5,000-year run on the default (medium) map must not exceed this.
// The pre-overhaul engine took about 143 s on the reference machine.
const BUDGET_MS = 150_000;

function arg(name: string, fallback: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const seed = Number(arg('seed', '424242'));
const years = Number(arg('years', '5000'));
const mapSize = arg('map', 'medium') as MapSize;
const every = Number(arg('every', '5'));

const started = performance.now();
const { metrics } = runBalanceTest(seed, years, mapSize);
const ms = performance.now() - started;

console.log(`History Unfolded sim · seed ${seed} · ${years} years · ${mapSize} map`);
console.log(formatMetrics(metrics, every));
console.log('');
const perCentury = ms / Math.max(1, years / 100);
console.log(`Time: ${(ms / 1000).toFixed(1)} s (${perCentury.toFixed(0)} ms per century)`);

const budget = (BUDGET_MS * years) / 5000;
if (mapSize === 'medium' && ms > budget) {
  console.error(`Too slow: budget is ${(budget / 1000).toFixed(1)} s for this run.`);
  process.exit(1);
}
