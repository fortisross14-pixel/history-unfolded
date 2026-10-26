// Writes a saved world to disk, for testing save migrations: node scripts/make-fixture.ts <out.json> [years]
import { writeFileSync } from 'node:fs';
import { advanceWorld, createWorld } from '../src/engine/index.ts';

const out = process.argv[2];
const years = Number(process.argv[3] ?? '1200');
let world = createWorld(
  { name: 'Fixture', mapSize: 'small', mapVariant: 0, tribeCount: 16, nameMode: 'mixed' },
  777,
);
for (let done = 0; done < years; done += 25) world = advanceWorld(world, 25);
writeFileSync(out, JSON.stringify([{ slot: 1, updatedAt: Date.now(), world }]));
console.log(`Saved ${out} at year ${world.year}`);
