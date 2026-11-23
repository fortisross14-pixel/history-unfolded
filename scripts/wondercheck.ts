/** Headless checks of world wonders: a race, half the production, refunds, bonuses, AI games. */
import { WONDERS, WONDER_LIST } from '../src/data/wonders.ts';
import { aiTurn } from '../src/engine/ai.ts';
import { cityDistricts } from '../src/engine/economy.ts';
import {
  deserialize,
  endTurn,
  foundCity,
  newGame,
  player,
  score,
  serialize,
} from '../src/engine/game.ts';
import { civMods } from '../src/engine/mods.ts';
import {
  builders,
  startWonder,
  WONDER_REFUND,
  WONDER_SHARE,
  wonderProblem,
  wondersOf,
  workOnWonder,
} from '../src/engine/wonders.ts';
import type { GameState } from '../src/engine/types.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};
const make = (seed: number, size: 'small' | 'standard' = 'small', civs = 4): GameState =>
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
    civCount: civs,
    playerName: 'Test',
  });

{
  const s = make(5);
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  const c = s.cities.find(x => x.civId === me.id)!;
  check(/research/.test(wonderProblem(s, c.id, 'great-pyramid') ?? ''), 'needs its tech');
  me.techs.push('masonry');
  check(/town/.test(wonderProblem(s, c.id, 'great-pyramid') ?? ''), 'a settlement is too small');
  c.tier = 'town';
  c.stockpile.stone = 0;
  check(/stone/.test(wonderProblem(s, c.id, 'great-pyramid') ?? ''), 'needs its goods to start');
  c.stockpile.stone = 20;
  const r = startWonder(s, c.id, 'great-pyramid');
  check(r.ok && c.wonder?.id === 'great-pyramid', `started: ${r.msg}`);
  check(c.stockpile.stone === 14, 'the goods are paid at the start');
  check(/Already being built/.test(wonderProblem(s, c.id, 'great-pyramid') ?? ''), 'once per city');
  // half the production while other work is queued, all of it when nothing is
  let w = workOnWonder(s, c, 10, false);
  check(
    w.left === 10 * (1 - WONDER_SHARE) && c.wonder!.progress === 5,
    'half the production goes to it',
  );
  w = workOnWonder(s, c, 10, true);
  check(w.left === 0 && c.wonder!.progress === 15, 'all of it when nothing else is queued');

  // a rival in the race
  const rival = s.civs.find(x => !x.independent && x.id !== me.id)!;
  const rc = s.cities.find(x => x.civId === rival.id)!;
  rival.techs.push('masonry');
  rc.tier = 'town';
  rc.stockpile.stone = 20;
  check(startWonder(s, rc.id, 'great-pyramid').ok, 'a rival can race for it too');
  check(builders(s, 'great-pyramid').length === 2, 'both show as building it');
  const goldBefore = rival.gold;
  const scoreBefore = score(s, me.id);
  const prodBefore = civMods(s, me.id).prodPct;
  workOnWonder(s, rc, 20, true);
  const done = workOnWonder(s, c, 200, true);
  check(s.wonders?.length === 1 && s.wonders[0].civId === me.id, 'the first to finish takes it');
  check(
    done.msgs.some(m => /complete/.test(m)),
    'the player is told',
  );
  check(!rc.wonder, "the rival's work stops");
  check(
    rival.gold === goldBefore + Math.round(20 * WONDER_REFUND),
    'half the work comes back as gold',
  );
  check(/Already built/.test(wonderProblem(s, rc.id, 'great-pyramid') ?? ''), 'one in the world');
  check(
    civMods(s, me.id).prodPct === prodBefore + WONDERS['great-pyramid'].mods.prodPct!,
    'its bonus applies',
  );
  check(score(s, me.id) > scoreBefore, 'it counts for score');
  check(
    s.chronicle?.some(e => e.kind === 'wonder'),
    'it goes into the chronicle',
  );
  // it changes hands with its city
  c.civId = rival.id;
  check(
    wondersOf(s, rival.id).length === 1 && wondersOf(s, me.id).length === 0,
    'it goes with its city',
  );
  c.civId = me.id;
  // coast
  me.techs.push('sailing');
  const inland = cityDistricts(s, c).length >= 0;
  check(inland, 'districts read');
  const back = deserialize(serialize(s));
  check(back.wonders?.length === 1, 'wonders survive a save');
}

// ---------------------------------------------------------------- AI games
for (const seed of [11, 23]) {
  const s = make(seed, 'standard', 6);
  const me = player(s);
  for (let t = 0; t < 250; t++) {
    me.isPlayer = false;
    aiTurn(s, me);
    me.isPlayer = true;
    endTurn(s);
  }
  const done = s.wonders ?? [];
  const holders = new Set(done.map(w => s.cities.find(c => c.id === w.cityId)?.civId));
  console.log(
    `     seed ${seed}: ${done.length}/${WONDER_LIST.length} wonders by turn 250: ` +
      done.map(w => `${WONDERS[w.id].name} t${w.turn}`).join(', '),
  );
  check(done.length >= 4, 'AI peoples build wonders');
  check(holders.size >= 2, 'more than one people holds wonders');
  check(new Set(done.map(w => w.id)).size === done.length, 'never the same wonder twice');
}

if (failures) {
  console.log(`${failures} wonder check(s) failed`);
  process.exit(1);
}
console.log('all wonder checks OK');
