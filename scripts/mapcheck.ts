/** Generates maps of every type and size and prints stats plus a small ASCII preview. */
import { generateMap, MAP_SIZES, START_DEPOSITS, startValue } from '../src/engine/mapgen.ts';
import { distance, within } from '../src/engine/hex.ts';
import { DEPOSITS } from '../src/data/goods.ts';
import type { MapSettings, MapType, MapSize } from '../src/engine/types.ts';

const types: MapType[] = [
  'continents',
  'pangaea',
  'archipelago',
  'inland-sea',
  'highlands',
  'random',
];
const sizes = Object.keys(MAP_SIZES) as MapSize[];
const preview = process.argv.includes('--preview');
const seeds = Number(process.argv.find(a => a.startsWith('--seeds='))?.split('=')[1] ?? 3);
let fails = 0;
for (const type of types) {
  for (const size of preview ? (['standard'] as MapSize[]) : sizes) {
    for (let seed = 1; seed <= seeds; seed++) {
      const s: MapSettings = {
        type,
        size,
        seaLevel: 'normal',
        climate: 'normal',
        rainfall: 'normal',
        resources: 'normal',
        mountains: 'normal',
        seed,
      };
      const t0 = performance.now();
      const m = generateMap(s);
      const ms = performance.now() - t0;
      const N = m.w * m.h;
      const count = (f: (i: number) => boolean) => {
        let n = 0;
        for (let i = 0; i < N; i++) if (f(i)) n++;
        return n;
      };
      const land = count(i => !['ocean', 'coast', 'lake'].includes(m.terrain[i]));
      const want = MAP_SIZES[size].civs;
      // every major people needs a start; free peoples fill what is left
      const ok = m.starts.length >= want;
      if (!ok) fails++;
      console.log(
        `${type.padEnd(11)} ${size.padEnd(8)} seed ${seed} → ${m.type.padEnd(11)} land ${((land / N) * 100).toFixed(0)}%  mtn ${count(i => m.relief[i] === 'mountains')}  rivers ${count(i => m.river[i] > 0)}  lakes ${count(i => m.terrain[i] === 'lake')}  deposits ${count(i => !!m.deposit[i])}  starts ${m.starts.length}/${want}+${MAP_SIZES[size].independents} ${ok ? '' : 'FAIL'}  ${ms.toFixed(0)}ms`,
      );
      if (preview && seed === 1) {
        const ch: Record<string, string> = {
          ocean: ' ',
          coast: '.',
          lake: 'o',
          grassland: '"',
          plains: ',',
          desert: ':',
          tundra: '-',
          snow: '*',
        };
        for (let r = 0; r < m.h; r += 1) {
          let line = r & 1 ? ' ' : '';
          for (let c = 0; c < m.w; c++) {
            const i = r * m.w + c;
            let x = ch[m.terrain[i]];
            if (m.relief[i] === 'mountains') x = '^';
            else if (m.relief[i] === 'hills') x = 'n';
            else if (m.vegetation[i] === 'forest') x = 'T';
            else if (m.vegetation[i] === 'jungle') x = 'J';
            else if (m.vegetation[i] === 'marsh') x = '~';
            if (m.river[i]) x = 'r';
            if (m.starts.includes(i)) x = '@';
            line += x + ' ';
          }
          console.log(line);
        }
      }
    }
  }
}
// fairness: the poorest start against the median, and how close neighbours sit
{
  let worst = 1,
    sum = 0,
    n = 0,
    gap = Infinity;
  for (const type of [
    'continents',
    'pangaea',
    'archipelago',
    'inland-sea',
    'highlands',
  ] as MapType[])
    for (let seed = 1; seed <= 24; seed++) {
      const m = generateMap({
        type,
        size: 'standard',
        seaLevel: 'normal',
        climate: 'normal',
        rainfall: 'normal',
        resources: 'normal',
        mountains: 'normal',
        seed,
      });
      const v = m.starts.map(st => startValue(m, st)).sort((a, b) => a - b);
      const ratio = v[0] / v[Math.floor(v.length / 2)];
      worst = Math.min(worst, ratio);
      sum += ratio;
      n++;
      for (const a of m.starts)
        for (const b of m.starts) if (a !== b) gap = Math.min(gap, distance(m, a, b));
    }
  const ok = worst >= 0.55 && sum / n >= 0.8 && gap >= 6;
  if (!ok) fails++;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} start fairness: poorest/median worst ${worst.toFixed(2)}, mean ${(sum / n).toFixed(2)}; closest starts ${gap} hexes apart`,
  );
}
// resources: every great people's start sees 3 to 5 deposits in its first ring of districts
{
  let n = 0,
    inRange = 0,
    under = 0,
    sum = 0;
  for (const type of [
    'continents',
    'pangaea',
    'archipelago',
    'inland-sea',
    'highlands',
  ] as MapType[])
    for (let seed = 1; seed <= 12; seed++) {
      const m = generateMap({
        type,
        size: 'standard',
        seaLevel: 'normal',
        climate: 'normal',
        rainfall: 'normal',
        resources: 'normal',
        mountains: 'normal',
        seed,
      });
      for (const st of m.starts.slice(0, MAP_SIZES.standard.civs)) {
        const k = within(m, st, 2).filter(
          i => i !== st && m.deposit[i] && !DEPOSITS[m.deposit[i]!.kind].revealedBy,
        ).length;
        n++;
        sum += k;
        if (k >= START_DEPOSITS[0] && k <= START_DEPOSITS[1]) inRange++;
        if (k < START_DEPOSITS[0]) under++;
      }
    }
  const ok = inRange / n >= 0.9 && under / n <= 0.03;
  if (!ok) fails++;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} deposits by the starts: mean ${(sum / n).toFixed(1)} within 2 hexes; ${inRange} of ${n} starts have ${START_DEPOSITS[0]}–${START_DEPOSITS[1]}, ${under} fewer`,
  );
}
console.log(fails ? `${fails} map checks failed` : 'all maps OK');
process.exit(fails ? 1 : 0);
