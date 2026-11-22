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
  assignDesign,
  atWar,
  attack,
  declareWar,
  previewBattle,
  saveDesign,
  serialize,
  setResearch,
} from '../src/engine/game.ts';

import { isPassableLand } from '../src/engine/mapgen.ts';
import { neighbors } from '../src/engine/hex.ts';
import type { GameState } from '../src/engine/types.ts';
import { formationMoves, groupCohorts, outdated, people } from '../src/engine/units.ts';

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

  // design two unit types and split one 500-man levy between them: 200 + 300
  capital.pop += 2000;
  const lv = levy(s, capital.id);
  const levy3 = mine().find(f => f.name === '3rd Levy');
  if (!levy3)
    console.log(
      lv.msg,
      mine().map(f => f.name),
    );
  capital.stockpile = { wood: 20, hides: 20, stone: 10 };
  check(!!levy3 && levy3.cohorts.length === 5, 'third levy raised in the capital');
  const hop = saveDesign(s, me.id, 'Foot Falcons', {
    ...DEFAULT_LOADOUT,
    weapon: 'spear',
    shield: 'hide-shield',
    armour: 'padded',
    boots: 'sandals',
  });
  const sl = saveDesign(s, me.id, 'Stone Hail', {
    ...DEFAULT_LOADOUT,
    weapon: 'sling',
    armour: 'padded',
  });
  check(hop.ok && sl.ok, 'two designs saved: ' + hop.msg + ' / ' + sl.msg);
  const dup = saveDesign(s, me.id, 'foot falcons', DEFAULT_LOADOUT);
  check(!dup.ok, 'duplicate design names refused');
  const locked = saveDesign(s, me.id, 'Bowmen', { ...DEFAULT_LOADOUT, weapon: 'bow' });
  check(!locked.ok, 'bow design needs Archery: ' + locked.msg);
  const twoH = saveDesign(s, me.id, 'X', {
    ...DEFAULT_LOADOUT,
    weapon: 'sling',
    shield: 'hide-shield',
  });
  check(twoH.ok, 'sling with shield is allowed');
  const ids = levy3!.cohorts.map(c => c.id);
  const a1 = assignDesign(s, levy3!.id, ids.slice(0, 2), hop.id!);
  const a2 = assignDesign(s, levy3!.id, ids.slice(2), sl.id!);
  check(a1.ok && a2.ok, `200 Foot Falcons + 300 Stone Hail: ${a1.msg} ${a2.msg}`);
  const groups = groupCohorts(levy3!);
  check(
    groups.length === 2 &&
      groups.some(g => g.cohorts.length === 2) &&
      groups.some(g => g.cohorts.length === 3),
    'formation shows two groups (2 and 3 cohorts)',
  );
  check((capital.stockpile.wood ?? 0) < 20, 'gear was paid from the city store');
  // editing a design marks equipped cohorts as outdated until re-equipped
  saveDesign(
    s,
    me.id,
    'Foot Falcons',
    { ...DEFAULT_LOADOUT, weapon: 'spear', shield: 'wicker-shield' },
    hop.id,
  );
  check(
    outdated(
      me,
      groups.find(g => g.designId === hop.id)!,
    ),
    'edited design: equipped cohorts flagged outdated',
  );

  // --- combat: declare war on a neighbour and attack its capital guard
  const enemyCity = s.cities.find(c => c.civId !== me.id)!;
  const enemy = s.civs[enemyCity.civId];
  const g = { w: s.map.w, h: s.map.h };
  const spot = neighbors(g, enemyCity.hex).find(
    n => isPassableLand(s.map, n) && !formationsAt(s, n).length && !s.cities.some(c => c.hex === n),
  );
  if (spot !== undefined) {
    levy3!.hex = spot;
    levy3!.moves = 2;
    // empty the city so the guard defends
    s.formations = s.formations.filter(f => !(f.hex === enemyCity.hex && f.civId === enemy.id));
    const peace = attack(s, levy3!.id, enemyCity.hex);
    check(!peace.ok, 'cannot attack while at peace: ' + peace.msg);
    check(declareWar(s, me.id, enemy.id).ok && atWar(s, me.id, enemy.id), 'war declared');
    const pv = previewBattle(s, levy3!.id, enemyCity.hex);
    check(!!pv && pv.lines.length > 0, 'battle preview: ' + pv?.lines.join(' | '));
    const before = people(levy3!);
    const r = attack(s, levy3!.id, enemyCity.hex);
    check(r.ok && !!r.report, 'attack resolves: ' + r.report?.lines.join(' | '));
    check(
      !s.formations.includes(levy3!) || people(levy3!) <= before,
      'attacker took losses or died',
    );
    check(levy3!.moves === 0, 'attacking uses all moves');
    // keep attacking with fresh troops until the city falls
    for (let k = 0; k < 6 && enemyCity.civId === enemy.id; k++) {
      const f = s.formations.find(x => x.id === levy3!.id) ?? levy3!;
      if (!s.formations.includes(f)) break;
      f.moves = 2;
      for (const c of f.cohorts) c.strength = 100;
      if (f.hex === enemyCity.hex) break;
      attack(s, f.id, enemyCity.hex);
    }
    check(
      enemyCity.civId === me.id,
      `${enemyCity.name} captured (now ${s.civs[enemyCity.civId].name})`,
    );
    check(
      !enemy.alive ||
        s.cities.some(c => c.civId === enemy.id) ||
        s.formations.some(f => f.civId === enemy.id && f.kind === 'settlers'),
      'elimination is consistent',
    );
  }

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

  // a long game with the AI: no crashes, invariants hold
  for (let t = 0; t < 150; t++) endTurn(s);
  const bad2 = s.formations.filter(f => !isPassableLand(s.map, f.hex) || f.cohorts.length === 0);
  check(!bad2.length, `after turn ${s.turn}: ${s.formations.length} formations, all valid`);
  check(
    !s.formations.some(f => formationsAt(s, f.hex).some(o => o.civId !== f.civId)),
    'still no hex shared between peoples',
  );
  check(
    s.formations.every(f => f.cohorts.every(c => c.strength > 0 && c.strength <= 100)),
    'cohort strengths within 1..100',
  );
  const aiCities = s.cities.filter(c => c.civId !== me.id).length;
  const aiDesigns = s.civs.filter(c => !c.isPlayer).reduce((n, c) => n + c.designs.length, 0);
  const equipped = s.formations
    .filter(f => f.civId !== me.id)
    .flatMap(f => f.cohorts)
    .filter(c => c.designId !== null).length;
  console.log(
    `     AI: ${aiCities} cities, ${aiDesigns} designs, ${equipped} equipped cohorts, wars so far: ${s.log.filter(e => e.text.includes('declared war')).length}, battles: ${s.log.filter(e => e.text.startsWith('Battle')).length}`,
  );
  check(aiCities > 0 && aiDesigns > 0, 'AI expands and designs troops');

  const back = deserialize(serialize(s));
  check(back.turn === s.turn && back.formations.length === s.formations.length, 'save round-trip');
}
console.log(failures ? `${failures} failures` : 'all rules checks passed');
process.exit(failures ? 1 : 0);
