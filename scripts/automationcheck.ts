/** Headless checks of automation: crews that build, scouts that explore, governors that plan. */
import { constructionQueue } from '../src/engine/economy.ts';
import {
  automate,
  automateCity,
  endTurn,
  foundCity,
  newGame,
  orderMove,
  player,
  trainCrew,
} from '../src/engine/game.ts';
import type { GameState } from '../src/engine/types.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};
const s: GameState = newGame({
  map: {
    type: 'pangaea',
    size: 'small',
    seaLevel: 'normal',
    climate: 'normal',
    rainfall: 'normal',
    resources: 'normal',
    mountains: 'normal',
    seed: 8,
  },
  civCount: 4,
  playerName: 'Test',
});
const me = player(s);
foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
const home = s.cities.find(c => c.civId === me.id)!;

// ---- scouts explore
const scout = s.formations.find(f => f.civId === me.id && f.name === 'Scouts')!;
check(
  !automate(s, s.formations.find(f => f.civId === me.id && f.cohorts.length > 2)!.id, 'explore').ok,
  'a large army does not wander off exploring',
);
check(automate(s, scout.id, 'explore').ok && scout.auto === 'explore', 'scouts are set to explore');
const seen = me.explored.filter(Boolean).length;
for (let k = 0; k < 6; k++) endTurn(s);
check(
  me.explored.filter(Boolean).length > seen,
  `they explore on their own (${seen} → ${me.explored.filter(Boolean).length} hexes known)`,
);
orderMove(s, scout.id, home.hex);
check(!scout.auto, 'a direct order takes them back');

// ---- governors plan
for (const d of s.districts.filter(d => d.cityId === home.id))
  for (const x of d.slots) if (!x.built) x.type = null as never;
check(automateCity(s, home.id, true).ok && home.auto, 'the governor is asked to plan the capital');
endTurn(s);
check(
  constructionQueue(s, home).length > 0,
  `the governor plans buildings (${constructionQueue(s, home).length} queued)`,
);

// ---- crews build roads between settlements on their own
home.pop = 9000;
me.gold = 200;
check(trainCrew(s, home.id, 'workers').ok, 'workers are raised');
const crew = s.formations.find(f => f.civId === me.id && f.kind === 'workers')!;
check(automate(s, crew.id, 'crew').ok, 'and set to build on their own');
check(!automate(s, scout.id, 'crew').ok, 'troops cannot be set to build');

console.log(failures ? `${failures} failures` : 'all automation checks passed');
process.exit(failures ? 1 : 0);
