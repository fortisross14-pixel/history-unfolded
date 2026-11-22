/** Headless checks of the core rules: setup, movement, merge, split, refit, levy, turns. */
import { DEFAULT_LOADOUT } from '../src/data/items.ts';
import {
  cityAt,
  deserialize,
  endTurn,
  formationsAt,
  foundCity,
  levy,
  newGame,
  orderMove,
  player,
  refit,
  refitPreview,
  serialize,
  setResearch,
  split,
} from '../src/engine/game.ts';

import { isPassableLand } from '../src/engine/mapgen.ts';
import type { GameState } from '../src/engine/types.ts';
import { formationMoves } from '../src/engine/units.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};

for (const seed of [1, 2, 3, 42]) {
  console.log(`-- seed ${seed}`);
  const s: GameState = newGame({
    map: {
      type: 'random',
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
  const me = player(s);
  check(s.civs.length === 6, '6 civs');
  check(s.cities.length === 5, 'AI civs founded their capitals');
  const mine = () => s.formations.filter(f => f.civId === me.id);
  check(mine().length === 3, 'player starts with settlers, levy, scouts');
  const settlers = mine().find(f => f.kind === 'settlers')!;
  const r = foundCity(s, settlers.id);
  check(r.ok, 'found capital: ' + r.msg);
  const capital = cityAt(s, settlers.hex)!;
  const levy1 = mine().find(f => f.name === '1st Levy')!;
  check(levy1.cohorts.length === 5, 'levy has 5 cohorts (500 people)');

  // raise a second levy and merge it by moving onto the first
  check(levy(s, capital.id).ok, 'raise 2nd levy');
  check(capital.pop === 1500, 'levy took 500 people');
  const levy2 = mine().find(f => f.name === '2nd Levy')!;
  endTurn(s);
  const mv = orderMove(s, levy2.id, levy1.hex);
  check(
    mv.ok && !s.formations.includes(levy2) && levy1.cohorts.length === 10,
    'moving onto a friendly formation merges (10 cohorts): ' + (mv.msg ?? ''),
  );

  // the scouts cannot join: over the cap
  const scouts = mine().find(f => f.name === 'Scouts')!;
  const toCap = orderMove(s, scouts.id, levy1.hex);
  check(!toCap.ok, 'merge past the command cap is refused');

  // split 2 cohorts and give them spears
  const two = levy1.cohorts.slice(0, 2).map(c => c.id);
  const sp = split(s, levy1.id, two, 'Spears');
  check(sp.ok && levy1.cohorts.length === 8, 'split 2 cohorts off');
  const spears = s.formations.find(f => f.id === sp.id)!;
  // walk back into the capital's territory if needed
  if (levy1.hex !== capital.hex) {
    endTurn(s);
    orderMove(s, spears.id, capital.hex);
  }
  capital.stockpile.wood = 10;
  const prev = refitPreview(
    s,
    spears.id,
    spears.cohorts.map(c => c.id),
    { ...DEFAULT_LOADOUT, weapon: 'spear' },
  );
  check(
    prev.problem === null && prev.cost.wood >= 2,
    `refit preview costs wood (${JSON.stringify(prev.problem ?? (prev as { cost: unknown }).cost)})`,
  );
  const rf = refit(
    s,
    spears.id,
    spears.cohorts.map(c => c.id),
    { ...DEFAULT_LOADOUT, weapon: 'spear' },
  );
  check(
    rf.ok && spears.cohorts.every(c => c.loadout.weapon === 'spear'),
    'refit: 200 spearmen ' + rf.msg,
  );
  const bad = refit(s, spears.id, [spears.cohorts[0].id], { ...DEFAULT_LOADOUT, weapon: 'bow' });
  check(!bad.ok, 'bow is locked before Archery: ' + bad.msg);

  // research and a few turns
  check(setResearch(s, me.id, 'archery').ok, 'research Archery');
  let learned = false;
  for (let t = 0; t < 30 && !learned; t++) {
    endTurn(s);
    learned = me.techs.includes('archery');
  }
  check(learned, `Archery learned by turn ${s.turn}`);

  // movement points: mounted cohorts are faster, a mixed formation moves at the slowest
  const fake = {
    ...levy1,
    cohorts: [
      { ...levy1.cohorts[0], loadout: { ...DEFAULT_LOADOUT, mount: 'horse' } },
      levy1.cohorts[1],
    ],
  };
  check(formationMoves(fake) === 2, 'mixed horse + foot formation moves 2');

  // nothing stands on water or mountains, nothing shares a hex with foreigners
  const okHexes = s.formations.every(f => isPassableLand(s.map, f.hex));
  check(okHexes, 'all formations on passable land');
  const mixed = s.formations.some(f => formationsAt(s, f.hex).some(o => o.civId !== f.civId));
  check(!mixed, 'no hex shared between peoples');

  const back = deserialize(serialize(s));
  check(back.turn === s.turn && back.formations.length === s.formations.length, 'save round-trip');
}
console.log(failures ? `${failures} failures` : 'all rules checks passed');
process.exit(failures ? 1 : 0);
