/** Headless checks of the three difficulty presets: same world, only the named knobs differ. */
import { aiTurn } from '../src/engine/ai.ts';
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  difficultyOf,
  type Difficulty,
} from '../src/engine/difficulty.ts';
import { deserialize, endTurn, newGame, player, score, serialize } from '../src/engine/game.ts';
import type { GameSettings, GameState } from '../src/engine/types.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};

const settings = (difficulty?: Difficulty): GameSettings => ({
  map: {
    type: 'continents',
    size: 'small',
    seaLevel: 'normal',
    climate: 'normal',
    rainfall: 'normal',
    resources: 'normal',
    mountains: 'normal',
    seed: 11,
  },
  civCount: 4,
  playerName: 'Test',
  difficulty,
});

const games = Object.fromEntries(DIFFICULTY_ORDER.map(d => [d, newGame(settings(d))])) as Record<
  Difficulty,
  GameState
>;

// ---- the same world on every level
const sameMap = (a: GameState, b: GameState) =>
  JSON.stringify([a.map.terrain, a.map.relief, a.map.starts, a.cities.map(c => c.hex)]) ===
  JSON.stringify([b.map.terrain, b.map.relief, b.map.starts, b.cities.map(c => c.hex)]);
check(
  sameMap(games.casual, games.normal) && sameMap(games.hard, games.normal),
  'one seed gives the same map, starts and settlements on all three levels',
);

// ---- the player's start: only Casual is more generous
const levy = (s: GameState) =>
  Math.max(
    ...s.formations.filter(f => f.civId === 0 && f.kind === 'army').map(f => f.cohorts.length),
  );
check(
  player(games.casual).gold === player(games.normal).gold + DIFFICULTIES.casual.startGold,
  `Casual adds ${DIFFICULTIES.casual.startGold} gold at the start`,
);
check(
  levy(games.casual) === levy(games.normal) + DIFFICULTIES.casual.startCohorts,
  `Casual adds ${DIFFICULTIES.casual.startCohorts} levy cohorts`,
);
check(
  player(games.hard).gold === player(games.normal).gold && levy(games.hard) === levy(games.normal),
  'Hard gives the player no handicap and no bonus',
);
check(
  games.normal.civs.slice(1).every((c, i) => c.gold === games.hard.civs[i + 1].gold),
  'AI peoples start the same on every level',
);

// ---- older saves play as Normal
{
  const t = newGame(settings());
  check(difficultyOf(t).id === 'normal', 'a game with no difficulty set plays as Normal');
  const back = deserialize(serialize(games.hard));
  check(difficultyOf(back).id === 'hard', 'the difficulty survives a save and load');
}

// ---- play each level for a while: rivals are weaker on Casual, stronger on Hard
const TURNS = 110;
const result: Record<string, { rival: number; warOnMeBy: number }> = {};
for (const d of DIFFICULTY_ORDER) {
  const s = games[d];
  const me = player(s);
  let warOnMeBy = Infinity;
  for (let k = 0; k < TURNS; k++) {
    me.isPlayer = false;
    aiTurn(s, me);
    me.isPlayer = true;
    endTurn(s);
    const w = s.wars.find(x => (x.a === me.id || x.b === me.id) && x.a !== me.id);
    if (w && warOnMeBy === Infinity) warOnMeBy = w.since;
  }
  const rivals = s.civs.filter(c => !c.isPlayer && !c.independent && c.alive);
  const rival = rivals.reduce((a, c) => a + score(s, c.id), 0) / Math.max(1, rivals.length);
  result[d] = { rival: Math.round(rival), warOnMeBy };
  console.log(
    `     ${DIFFICULTIES[d].name}: rival score ${result[d].rival}, first war on the player ${warOnMeBy === Infinity ? 'none' : 'turn ' + warOnMeBy}`,
  );
}
check(
  result.casual.rival < result.hard.rival,
  `rivals score lower on Casual than on Hard (${result.casual.rival} < ${result.hard.rival})`,
);
check(
  result.casual.warOnMeBy > DIFFICULTIES.casual.peaceWithPlayerUntil,
  `on Casual no rival attacks the player before turn ${DIFFICULTIES.casual.peaceWithPlayerUntil}`,
);

console.log(failures ? `${failures} failures` : 'all difficulty checks passed');
process.exit(failures ? 1 : 0);
