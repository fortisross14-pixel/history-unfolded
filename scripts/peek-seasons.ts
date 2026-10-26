// Prints a few century recaps and the record book: node scripts/peek-seasons.ts [years]
import { runBalanceTest } from '../src/engine/index.ts';
import { seasonTitle } from '../src/engine/seasons.ts';
import { worldRecords } from '../src/engine/recordbook.ts';

const { world } = runBalanceTest(424242, Number(process.argv[2] ?? '4500'));
for (const s of world.seasons.slice(-2)) {
  console.log(`\n== The ${seasonTitle(s.year)} (${s.realmsBefore} → ${s.realmsAfter} realms)`);
  for (const a of s.awards) console.log(`   ${a.title}: ${a.name} — ${a.reason}`);
  for (const h of s.headlines.slice(0, 4)) console.log(`   · ${h.year}: ${h.title}`);
}
console.log('\n== Record book');
for (const r of worldRecords(world))
  console.log(`   ${r.title}: ${r.holder} (${r.value}; ${r.detail})`);
