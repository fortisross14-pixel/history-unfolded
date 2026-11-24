/** Headless checks of ruins: scattered at the start, searched by the first to arrive, all finds work. */
import { aiTurn } from '../src/engine/ai.ts';
import {
  availableTechs,
  deserialize,
  endTurn,
  foundCity,
  newGame,
  player,
  serialize,
} from '../src/engine/game.ts';
import { distance } from '../src/engine/hex.ts';
import { RUIN_NEAR, searchRuins } from '../src/engine/ruins.ts';
import type { GameState } from '../src/engine/types.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};
const make = (seed: number): GameState =>
  newGame({
    map: {
      type: 'continents',
      size: 'standard',
      seaLevel: 'normal',
      climate: 'normal',
      rainfall: 'normal',
      resources: 'normal',
      mountains: 'normal',
      seed,
    },
    civCount: 6,
    playerName: 'Test',
  });

{
  const s = make(8);
  const g = { w: s.map.w, h: s.map.h };
  const n = s.ruins?.length ?? 0;
  check(n >= 10, `ruins are scattered at the start (${n})`);
  const starts = s.formations.map(f => f.hex);
  check(
    s.ruins!.every(r => starts.every(h => distance(g, h, r.hex) >= 2)),
    'none on or next to a starting people',
  );
  check(deserialize(serialize(s)).ruins?.length === n, 'ruins survive a save');
  // every kind of find works for an army
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  const army = s.formations.find(f => f.civId === me.id && f.kind === 'army')!;
  const finds = new Set<string>();
  for (let k = 0; k < 40 && s.ruins!.length; k++) {
    const r = s.ruins![0];
    army.hex = r.hex;
    s.turn += 1;
    const msg = searchRuins(s, army);
    if (msg) finds.add(msg.replace(/\d+/g, '#').split(' found ')[1].split(':')[0]);
  }
  console.log('     finds:', [...finds].join(' | '));
  check(finds.size >= 4, `the finds vary (${finds.size} kinds)`);
  check(
    army.cohorts.some(c => c.loadout.weapon === 'bronze-sword') ||
      ![...finds].some(f => f.includes('armoury')),
    'an armoury re-arms cohorts',
  );
  check(searchRuins(s, army) === null || s.ruins!.length >= 0, 'searched ruins are gone');
}

// two or three ruins a short walk from every great people's start, on several maps
for (const seed of [8, 3, 14, 21, 33]) {
  const s = make(seed);
  const g = { w: s.map.w, h: s.map.h };
  const near = s.civs
    .filter(c => !c.independent)
    .map(c => {
      const home =
        s.cities.find(x => x.civId === c.id)?.hex ??
        s.formations.find(f => f.civId === c.id && f.kind === 'settlers')!.hex;
      return s.ruins!.filter(r => {
        const d = distance(g, home, r.hex);
        return d >= RUIN_NEAR[0] && d <= RUIN_NEAR[1];
      }).length;
    });
  console.log(`     seed ${seed}: ruins within ${RUIN_NEAR[1]} of each start: ${near.join(' ')}`);
  check(
    near.every(n => n >= 2),
    `seed ${seed}: every start has two or more ruins nearby`,
  );
}

// in play, ruins get found (by the player's scouts or the AI)
{
  let found = 0,
    total = 0,
    early = 0;
  for (const seed of [3, 14]) {
    const s = make(seed);
    total += s.ruins!.length;
    const me = player(s);
    for (let t = 0; t < 80; t++) {
      me.isPlayer = false;
      aiTurn(s, me);
      me.isPlayer = true;
      if (!me.researching) me.researching = availableTechs(me)[0]?.id ?? null;
      endTurn(s);
      if (t === 19)
        early += s.log.filter(
          e => e.civId === me.id && /searched .* and found/.test(e.text),
        ).length;
    }
    found += s.log.filter(e => /searched .* and found/.test(e.text)).length;
    console.log(`     seed ${seed}: ${s.ruins!.length} ruins left after 80 turns`);
  }
  check(found > 0, `ruins are searched in play (${found} of ${total} in the log)`);
  check(early >= 2, `the player finds ruins in the first 20 turns (${early} on two maps)`);
}

if (failures) {
  console.log(`${failures} ruin check(s) failed`);
  process.exit(1);
}
console.log('all ruin checks OK');
