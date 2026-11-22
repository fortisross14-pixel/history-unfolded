/** Generates maps of every type and size and prints stats plus a small ASCII preview. */
import { generateMap, MAP_SIZES } from '../src/engine/mapgen.ts';
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
      const ok = m.starts.length === want;
      if (!ok) fails++;
      console.log(
        `${type.padEnd(11)} ${size.padEnd(8)} seed ${seed} → ${m.type.padEnd(11)} land ${((land / N) * 100).toFixed(0)}%  mtn ${count(i => m.relief[i] === 'mountains')}  rivers ${count(i => m.river[i] > 0)}  lakes ${count(i => m.terrain[i] === 'lake')}  deposits ${count(i => !!m.deposit[i])}  starts ${m.starts.length}/${want} ${ok ? '' : 'FAIL'}  ${ms.toFixed(0)}ms`,
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
console.log(fails ? `${fails} maps short of starts` : 'all maps OK');
process.exit(fails ? 1 : 0);
