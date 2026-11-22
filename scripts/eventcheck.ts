/** Headless checks of renaming, road crews and the event system. */
import { aiTurn } from '../src/engine/ai.ts';
import { EVENT_DEFS, pendingEvent, resolveEvent } from '../src/engine/events.ts';
import {
  buildRoad,
  endTurn,
  foundCity,
  newGame,
  player,
  renameCity,
  roadBuilderProblem,
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
    type: 'continents',
    size: 'standard',
    seaLevel: 'normal',
    climate: 'normal',
    rainfall: 'normal',
    resources: 'normal',
    mountains: 'normal',
    seed: 4,
  },
  civCount: 6,
  playerName: 'Test',
});
const me = player(s);
const settlers = s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!;
foundCity(s, settlers.id);
const home = s.cities.find(c => c.civId === me.id)!;

// ---- renaming
const other = s.cities.find(c => c.civId !== me.id)!;
check(!renameCity(s, home.id, other.name).ok, 'two settlements cannot share a name');
check(
  renameCity(s, home.id, 'Aurelia').ok && home.name === 'Aurelia',
  'a settlement can be renamed',
);
check(
  s.districts.some(d => d.cityId === home.id && d.name.startsWith('Aurelia')),
  'its centre district follows the new name',
);

// ---- roads: no automatic tracks; troops early, workers always, engineers in the Industrial age
const roadsAtStart = s.roads.filter(Boolean).length;
check(
  roadsAtStart === s.cities.length,
  `only settlement hexes carry roads at first (${roadsAtStart})`,
);
const army = s.formations.find(f => f.civId === me.id && f.kind === 'army')!;
check(roadBuilderProblem(s, army) === null, 'in the Ancient age any army may lay a road');
me.techs.push('classical-age', 'medieval-age');
check(!!roadBuilderProblem(s, army), 'from the Medieval age troops may not');
home.pop = 5000;
me.gold = 100;
check(trainCrew(s, home.id, 'workers').ok, 'a settlement raises workers');
check(!trainCrew(s, home.id, 'engineers').ok, 'engineers wait for the Industrial age');
const crew = s.formations.find(f => f.civId === me.id && f.kind === 'workers')!;
check(roadBuilderProblem(s, crew) === null, 'workers lay roads in any age');
crew.moves = 2;
const next = s.formations.find(f => f === crew)!;
next.hex = s.map.terrain.findIndex(
  (t, i) =>
    t === 'grassland' &&
    !s.roads[i] &&
    s.map.relief[i] === 'flat' &&
    !s.cities.some(c => c.hex === i),
);
check(
  buildRoad(s, crew.id).ok && s.roads[crew.hex] === 1,
  'the crew builds a road where it stands',
);

// ---- events: about one every 5 to 15 turns, varied, choices that do what they say
{
  const t: GameState = newGame({ ...s.settings, playerName: 'P' });
  const p = player(t);
  foundCity(t, t.formations.find(f => f.civId === p.id && f.kind === 'settlers')!.id);
  const fired: { turn: number; id: string }[] = [];
  for (let k = 0; k < 220; k++) {
    // the AI plays the player's realm so it grows
    p.isPlayer = false;
    aiTurn(t, p);
    p.isPlayer = true;
    endTurn(t);
    const ev = t.events?.pending;
    if (ev && ev.turn === t.turn) fired.push({ turn: t.turn, id: ev.id });
  }
  const gaps = fired.slice(1).map((f, i) => f.turn - fired[i].turn);
  check(fired.length >= 12 && fired.length <= 40, `${fired.length} events in 220 turns`);
  check(
    Math.min(...gaps) >= 3 && Math.max(...gaps) <= 16,
    `gaps ${Math.min(...gaps)}–${Math.max(...gaps)} turns`,
  );
  check(
    new Set(fired.map(f => f.id)).size >= 8,
    `${new Set(fired.map(f => f.id)).size} different events`,
  );
  check(
    fired.every((f, i) => i === 0 || f.id !== fired[i - 1].id),
    'never the same event twice in a row',
  );
  const once = Object.values(EVENT_DEFS)
    .filter(e => e.cooldown === Infinity)
    .map(e => e.id);
  check(
    once.every(id => fired.filter(f => f.id === id).length <= 1),
    'once-a-game events come once at most',
  );
}
{
  // a choice the realm cannot pay for is refused, with a reason
  const t = structuredClone(s);
  const p = player(t);
  p.gold = 0;
  t.events = {
    next: 999,
    history: [],
    queued: [],
    pending: { id: 'festival', turn: t.turn, subject: {}, variant: 0 },
  };
  t.cities.find(c => c.civId !== p.id)!.civId = p.id;
  const ev = pendingEvent(t, p)!;
  check(!!ev.choices[0].blocked, `an unaffordable choice says why: "${ev.choices[0].blocked}"`);
  check(!resolveEvent(t, p, 0).ok, 'and cannot be made');
  const before = p.culture.points;
  p.gold = 500;
  check(
    resolveEvent(t, p, 0).ok && p.culture.points === before + 25,
    'the festival gives +25 culture as it said',
  );
  check(!t.events!.pending, 'the event is done');
}

console.log(failures ? `${failures} failures` : 'all event checks passed');
process.exit(failures ? 1 : 0);
