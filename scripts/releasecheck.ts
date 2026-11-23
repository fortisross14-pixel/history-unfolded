/** Headless checks of Release 1 conveniences: sentry, victory toggles. */
import {
  declareWar,
  foundCity,
  newGame,
  player,
  sentry,
  SENTRY_RANGE,
  wakeSentries,
} from '../src/engine/game.ts';
import { distance } from '../src/engine/hex.ts';
import { victoryOn, victoryTurn } from '../src/engine/victory.ts';
import type { GameState } from '../src/engine/types.ts';
import { classify, groupNews, locate } from '../src/ui/news.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};
const make = (noVictory?: GameState['settings']['noVictory']): GameState =>
  newGame({
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
    noVictory,
  });

// ---------------------------------------------------------------- sentry
{
  const s = make();
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  const f = s.formations.find(x => x.civId === me.id && x.kind === 'army')!;
  check(sentry(s, f.id).ok && f.sentry, 'a unit can stand sentry');
  check(wakeSentries(s, me.id).length === 0 && f.sentry, 'it stays on sentry while all is quiet');
  // an enemy comes near
  const rival = s.civs.find(c => !c.independent && c.id !== me.id)!;
  const theirs = s.formations.find(x => x.civId === rival.id)!;
  declareWar(s, me.id, rival.id);
  const g = { w: s.map.w, h: s.map.h };
  theirs.hex = f.hex + 2;
  check(distance(g, f.hex, theirs.hex) <= SENTRY_RANGE, 'the enemy is within range');
  const woke = wakeSentries(s, me.id);
  check(woke.length === 1 && !f.sentry, `an enemy near wakes it: ${woke[0]}`);
  sentry(s, f.id);
  sentry(s, f.id);
  check(!f.sentry, 'sentry toggles off');
}

// ---------------------------------------------------------------- victory toggles
{
  const s = make(['cultural', 'scientific']);
  check(!victoryOn(s, 'cultural') && !victoryOn(s, 'scientific'), 'turned-off victories are off');
  check(victoryOn(s, 'conquest') && victoryOn(s, 'economic'), 'the others stay on');
  // a people that would hold the cultural goal does not win by it
  const me = player(s);
  for (const c of s.civs) c.stats = { gdp: 1, culture: c.id === me.id ? 1000 : 1 };
  me.techs.push('renaissance-age', 'medieval-age', 'classical-age');
  s.holding = { cultural: { civId: me.id, since: s.turn - 50 } };
  const r = victoryTurn(s);
  check(!r.winner || r.winner.kind !== 'cultural', 'a turned-off goal never wins');
  check(make().settings.noVictory === undefined, 'all on by default');
}

// ---------------------------------------------------------------- news: grouped and located
{
  const s = make();
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  const town = s.cities.find(c => c.civId === me.id)!;
  const army = s.formations.find(f => f.civId === me.id && f.kind === 'army')!;
  const rival = s.civs.find(c => !c.independent && c.id !== me.id)!;
  check(
    classify(`The ${rival.name} declared war on the ${me.name}!`) === 'urgent',
    'war is urgent',
  );
  check(
    classify(`Raiders pillaged ${town.name}: 12 gold carried off.`) === 'urgent',
    'a raid is urgent',
  );
  check(
    classify(`${town.name}: Farm in Centre finished.`) === 'act',
    'a finished building is to act on',
  );
  check(classify('The Tolhuan learned Masonry.') === 'info', 'rivals’ news is for information');
  const t1 = locate(s, me.id, `${town.name}: Farm in Centre finished.`);
  check(t1?.kind === 'city' && t1.id === town.id, 'a settlement’s news goes to the settlement');
  const t2 = locate(s, me.id, `${army.name} wakes: raiders nearby.`);
  check(t2?.kind === 'formation' && t2.id === army.id, 'a unit’s news goes to the unit');
  const t3 = locate(s, me.id, 'Research complete: Pottery. More food.');
  check(t3?.kind === 'dialog' && t3.dialog === 'research', 'research news opens research');
  const t4 = locate(s, me.id, `The ${rival.name} are massing troops on the ${me.name} border.`);
  check(t4?.kind === 'dialog' && t4.dialog === 'peoples', 'a rival’s threat opens Peoples');
  const g = groupNews(['a', `Raiders pillaged ${town.name}.`, 'Research complete: X.']);
  check(g.urgent.length === 1 && g.act.length === 1 && g.info.length === 1, 'news is grouped');
}

if (failures) {
  console.log(`${failures} release check(s) failed`);
  process.exit(1);
}
console.log('all release checks OK');
