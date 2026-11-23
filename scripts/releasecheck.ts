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

if (failures) {
  console.log(`${failures} release check(s) failed`);
  process.exit(1);
}
console.log('all release checks OK');
