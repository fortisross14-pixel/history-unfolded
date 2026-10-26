// Prints a few World Moments from a run, to read how they tell the story: node scripts/peek.ts [years]
import { runBalanceTest, displayYear } from '../src/engine/index.ts';

const { world } = runBalanceTest(424242, Number(process.argv[2] ?? '3500'));
const wars = world.wars.filter(w => w.great && w.keyBattles.length >= 2).slice(-2);
for (const w of wars) {
  console.log(`\n== ${w.name} (${displayYear(w.startYear)}–${displayYear(w.endYear ?? world.year)})`);
  for (const b of w.keyBattles) console.log('   ' + b.text);
  console.log('   ' + w.outcome);
}
for (const m of world.moments.filter(x => x.kind !== 'war').slice(-3)) {
  console.log(`\n== ${m.title} (${displayYear(m.startYear)}–${m.endYear ? displayYear(m.endYear) : 'now'})`);
  for (const e of m.events.slice(0, 4)) console.log('   ' + e.text);
  console.log('   ' + (m.summary ?? ''));
}
const ch = world.characters.filter(c => c.rarity === 'Generational').slice(-1)[0];
if (ch) {
  console.log(`\n== ${ch.name} ${ch.nickname ?? ''} (${ch.role}, ${ch.traits.join(', ')})`);
  for (const d of ch.deeds) console.log(`   ${displayYear(d.year)}: ${d.text}`);
}
