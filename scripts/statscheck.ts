/** Headless checks of the statistics history and the chronicle. */
import { aiTurn } from '../src/engine/ai.ts';
import { deserialize, endTurn, newGame, player, score, serialize } from '../src/engine/game.ts';
import { currentStats, metricOf } from '../src/engine/stats.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};
const s = newGame({
  map: {
    type: 'continents',
    size: 'small',
    seaLevel: 'normal',
    climate: 'normal',
    rainfall: 'normal',
    resources: 'normal',
    mountains: 'normal',
    seed: 12,
  },
  civCount: 4,
  playerName: 'Test',
});
const me = player(s);
for (let k = 0; k < 220; k++) {
  me.isPlayer = false;
  aiTurn(s, me);
  me.isPlayer = true;
  endTurn(s);
}
const h = s.statsHistory ?? [];
check(
  h.length > 100 && h.length <= 200,
  `a row of numbers each turn, older ones thinned (${h.length} rows for 220 turns)`,
);
check(h[h.length - 1].t === s.turn - 1, 'the last row is the turn just played');
const free = s.civs.filter(c => c.independent).map(c => c.id);
check(
  h.every(r => free.every(id => r.v[id] == null)),
  'free peoples are left out',
);
const ai = s.civs.find(c => !c.isPlayer && !c.independent && c.alive)!;
check(
  metricOf(currentStats(s, ai.id), 'score') === score(s, ai.id),
  'the score column is the game score',
);
check(
  h.some(r => (metricOf(r.v[ai.id], 'techs') ?? 0) > 5),
  'techs grow over the game',
);
const ch = s.chronicle ?? [];
check(
  ch.some(e => e.kind === 'age'),
  `the chronicle remembers ages entered (${ch.length} moments)`,
);
check(
  ch.some(e => e.kind === 'found'),
  'and settlements founded',
);
check(
  ch.every(e => !s.civs[e.civId]?.independent),
  'but nothing of the free peoples',
);
const back = deserialize(serialize(s));
check(
  (back.statsHistory?.length ?? 0) === h.length && (back.chronicle?.length ?? 0) === ch.length,
  'both survive a save and load',
);
const bytes = serialize(s).length;
console.log(`     save size ${(bytes / 1024).toFixed(0)} KB after ${s.turn} turns`);
console.log(failures ? `${failures} failures` : 'all stats checks passed');
process.exit(failures ? 1 : 0);
