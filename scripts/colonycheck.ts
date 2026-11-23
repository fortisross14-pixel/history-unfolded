/** Headless checks of towns and colonies: contiguous towns, colonies that only gather, promotion. */
import { AGE_GATE } from '../src/data/techs.ts';
import { aiTurn } from '../src/engine/ai.ts';
import {
  colonyBuildProblem,
  foundKind,
  promoteColony,
  promoteInfo,
} from '../src/engine/colonies.ts';
import { cityDistricts, slotProblem } from '../src/engine/economy.ts';
import {
  availableTechs,
  endTurn,
  foundCity,
  newGame,
  player,
  territoryRadius,
  upgradeInfo,
} from '../src/engine/game.ts';
import { distance, within } from '../src/engine/hex.ts';
import { isPassableLand } from '../src/engine/mapgen.ts';
import type { GameState } from '../src/engine/types.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};
const make = (seed: number, size: 'small' | 'standard' = 'small'): GameState =>
  newGame({
    map: {
      type: 'continents',
      size,
      seaLevel: 'normal',
      climate: 'normal',
      rainfall: 'normal',
      resources: 'normal',
      mountains: 'normal',
      seed,
    },
    civCount: 4,
    playerName: 'Test',
  });

{
  const s = make(5);
  const me = player(s);
  const g = { w: s.map.w, h: s.map.h };
  const settlers = s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!;
  const R = territoryRadius(s, me.id);
  check(foundKind(s, me.id, settlers.hex, R) === 'town', 'the first settlement is a town');
  foundCity(s, settlers.id);
  const home = s.cities.find(c => c.civId === me.id)!;
  check(!home.colony, 'and is not a colony');
  // a site 3-4 hexes away joins the realm; one far away is a colony
  const free = (lo: number, hi: number) =>
    within(g, home.hex, hi).find(
      h =>
        distance(g, home.hex, h) >= lo &&
        isPassableLand(s.map, h) &&
        !s.cities.some(c => distance(g, c.hex, h) < 3),
    );
  const near = free(3, 4)!;
  const far = free(7, 9)!;
  check(foundKind(s, me.id, near, R) === 'town', `4 hexes away: a town (borders touch)`);
  check(
    foundKind(s, me.id, far, R) === 'colony',
    `${distance(g, home.hex, far)} hexes away: a colony`,
  );
  // found a colony there
  const f2 = { ...settlers, id: s.nextId++, hex: far, cohorts: settlers.cohorts };
  s.formations.push(f2);
  check(foundCity(s, f2.id).ok, 'a colony can be founded');
  const col = s.cities.find(c => c.hex === far)!;
  check(col.colony === true, 'it is marked a colony');
  const d = cityDistricts(s, col)[0];
  check(colonyBuildProblem(s, col, 'farm') === null, 'a colony may farm');
  check(colonyBuildProblem(s, col, 'mine') === null, 'and mine');
  check(colonyBuildProblem(s, col, 'houses') === null, 'and build houses');
  me.techs.push('writing');
  check(
    !!colonyBuildProblem(s, col, 'school') || !!slotProblem(s, me.id, d.hex, true, 'library', d.id),
    'but not schools or libraries',
  );
  col.pop = 9000;
  check(
    /colony/i.test(upgradeInfo(s, col).problem ?? ''),
    'a colony cannot grow past one district',
  );
  // promotion needs the realm to reach it
  check(!!promoteInfo(s, col, R)?.problem, 'not joined: no promotion yet');
  const bridge = within(g, far, 4).find(
    h =>
      distance(g, far, h) >= 3 &&
      isPassableLand(s.map, h) &&
      !s.cities.some(c => distance(g, c.hex, h) < 3),
  )!;
  const town2 = { ...settlers, id: s.nextId++, hex: bridge, cohorts: settlers.cohorts };
  s.formations.push(town2);
  // pretend it is joined (founded as a town next to the colony)
  foundCity(s, town2.id);
  const t2 = s.cities.find(c => c.hex === bridge)!;
  t2.colony = undefined;
  me.gold = 500;
  check(promoteInfo(s, col, R)?.problem === null, 'joined by a town: it can be made a town');
  check(promoteColony(s, col.id, R).ok && !col.colony, 'made a town for gold');
  // later ages
  const late = make(6);
  const lp = player(late);
  for (let a = 2; a <= 5; a++) lp.techs.push(AGE_GATE[a]);
  foundCity(late, late.formations.find(f => f.civId === lp.id && f.kind === 'settlers')!.id);
  const lhome = late.cities.find(c => c.civId === lp.id)!;
  const lfar = within({ w: late.map.w, h: late.map.h }, lhome.hex, 9).find(
    h =>
      distance({ w: late.map.w, h: late.map.h }, lhome.hex, h) >= 7 && isPassableLand(late.map, h),
  )!;
  check(
    foundKind(late, lp.id, lfar, R) === 'town',
    'in the Industrial age every settlement is a town',
  );
}

// the AI keeps its realm together: most of its settlements are towns
{
  const s = make(9, 'standard');
  const me = player(s);
  for (let t = 0; t < 150; t++) {
    me.isPlayer = false;
    aiTurn(s, me);
    me.isPlayer = true;
    if (!me.researching) me.researching = availableTechs(me)[0]?.id ?? null;
    endTurn(s);
  }
  const great = s.cities.filter(c => !s.civs[c.civId].independent);
  const colonies = great.filter(c => c.colony).length;
  console.log(`     after 150 turns: ${great.length} settlements, ${colonies} colonies`);
  check(colonies <= great.length * 0.3, 'AI realms are mostly towns joined together');
}

if (failures) {
  console.log(`${failures} colony check(s) failed`);
  process.exit(1);
}
console.log('all colony checks OK');
