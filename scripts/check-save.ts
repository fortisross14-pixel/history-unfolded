// Loads an old save file, migrates it and keeps simulating, to prove old saves still work.
// usage: node scripts/check-save.ts <saves.json> [years]
import { readFileSync } from 'node:fs';
import { advanceWorld } from '../src/engine/index.ts';
import { migrateWorld, SAVE_VERSION } from '../src/engine/save.ts';
import { summarize } from '../src/engine/metrics.ts';

const file = process.argv[2];
const years = Number(process.argv[3] ?? '300');
const slots = JSON.parse(readFileSync(file, 'utf8')) as { world: unknown }[];
for (const slot of slots) {
  const from = (slot.world as { version?: number })?.version;
  const world = migrateWorld(slot.world);
  if (!world) throw new Error(`Save could not be migrated (version ${from})`);
  const later = advanceWorld(world, years);
  const m = summarize(later);
  console.log(
    `Migrated v${from} → v${SAVE_VERSION}, then ran ${years} years: ${m.livingRealms} realms, ` +
      `${m.livingPeople} living characters, ${m.wars} wars, year ${later.year}.`,
  );
}
