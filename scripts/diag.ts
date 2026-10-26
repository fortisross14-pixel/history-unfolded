// Quick diagnostics for balance work: node scripts/diag.ts [years]
import { runBalanceTest } from '../src/engine/index.ts';

const years = Number(process.argv[2] ?? '5000');
const { world } = runBalanceTest(424242, years);
const byType = new Map<string, number>();
for (const w of world.wars)
  byType.set(
    w.type + (w.great ? ' (great)' : ''),
    (byType.get(w.type + (w.great ? ' (great)' : '')) ?? 0) + 1,
  );
console.log('Wars by type:', Object.fromEntries([...byType].sort((a, b) => b[1] - a[1])));
const causes = new Map<string, number>();
for (const e of world.events)
  if (e.tags.includes('civil war'))
    causes.set(
      e.description.split(' over ')[1]?.split('.')[0] ?? '?',
      (causes.get(e.description.split(' over ')[1]?.split('.')[0] ?? '?') ?? 0) + 1,
    );
console.log('Recent civil war causes (event log):', Object.fromEntries(causes));
const dead = world.civilizations.filter(c => !c.provinces.length).length;
console.log(
  `Realms ever: ${world.civilizations.length}, dead: ${dead}, alive: ${world.civilizations.length - dead}`,
);
const sizes = world.civilizations
  .filter(c => c.provinces.length)
  .map(c => c.provinces.length)
  .sort((a, b) => b - a);
console.log('Living realm sizes:', sizes.join(' '));
