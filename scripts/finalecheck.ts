/** Headless checks of railways (the Industrial finale) and coalitions against a runaway leader. */
import { AGE_GATE } from '../src/data/techs.ts';
import { aiTurn } from '../src/engine/ai.ts';
import { coalitionTurn, COALITION_FROM } from '../src/engine/coalition.ts';
import { opinion } from '../src/engine/diplomacy.ts';
import { cityEconomy, invalidateMarkets, railLinked } from '../src/engine/economy.ts';
import {
  buildRoad,
  foundCity,
  newGame,
  player,
  railProblem,
  RAIL,
  stepCost,
  trainCrew,
} from '../src/engine/game.ts';
import { neighbors } from '../src/engine/hex.ts';
import type { Civ, GameState } from '../src/engine/types.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};
const fresh = (seed = 5): GameState => {
  const s = newGame({
    map: {
      type: 'pangaea',
      size: 'small',
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
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  return s;
};
const toAge = (civ: Civ, age: number) => {
  for (let a = 2; a <= age; a++) if (!civ.techs.includes(AGE_GATE[a])) civ.techs.push(AGE_GATE[a]);
};

// ---- railways
{
  const s = fresh();
  const me = player(s);
  const home = s.cities.find(c => c.civId === me.id)!;
  home.pop = 8000;
  me.gold = 500;
  toAge(me, 5);
  check(trainCrew(s, home.id, 'engineers').ok, 'the Industrial age raises engineers');
  const eng = s.formations.find(f => f.civId === me.id && f.kind === 'engineers')!;
  eng.moves = 2;
  check(
    /Railways tech/.test(railProblem(s, eng) ?? ''),
    `without the tech: "${railProblem(s, eng)}"`,
  );
  me.techs.push('steam-power', 'railways');
  const gold = me.gold;
  check(
    buildRoad(s, eng.id).ok && s.roads[home.hex] === RAIL,
    'engineers lay a railway over the road (R)',
  );
  check(me.gold === gold - 10, 'a stretch of railway costs 10 gold');
  // a second settlement two hexes away, joined by rail
  const g = { w: s.map.w, h: s.map.h };
  const mid = neighbors(g, home.hex).find(h => !s.cities.some(c => c.hex === h))!;
  s.roads[mid] = RAIL;
  invalidateMarkets();
  const army = s.formations.find(f => f.civId === me.id && f.kind === 'army')!;
  check(
    stepCost(s, army, home.hex, mid) < stepCost(s, { ...army }, mid, mid) ||
      stepCost(s, army, home.hex, mid) === 0.2,
    `moving from rail to rail costs a fifth of a move (${stepCost(s, army, home.hex, mid)})`,
  );
  const before = cityEconomy(s, home).total.prod;
  check(!railLinked(s, home), 'a railway that reaches no other settlement links nothing');
  const other = s.cities.find(c => c.civId !== me.id)!;
  const far = neighbors(g, mid).find(h => h !== home.hex && !s.cities.some(c => c.hex === h))!;
  // move a settlement of ours to the far end (a test shortcut)
  const ours = { ...structuredClone(other), id: 999, civId: me.id, hex: far, name: 'Railton' };
  s.cities.push(ours);
  s.roads[far] = RAIL;
  invalidateMarkets();
  check(railLinked(s, home), 'two settlements joined by rail are linked');
  s.turn++;
  const after = cityEconomy(s, home).total.prod;
  check(
    after > before,
    `rail-linked settlements produce more (${before.toFixed(1)} → ${after.toFixed(1)})`,
  );
}

// ---- the AI lays rails once it knows Railways
{
  const s = fresh(9);
  const ai = s.civs.find(c => !c.isPlayer && !c.independent)!;
  toAge(ai, 5);
  ai.techs.push('steam-power', 'railways');
  ai.gold = 2000;
  const mine = s.cities.filter(c => c.civId === ai.id);
  for (const c of mine) c.pop = 9000;
  for (let k = 0; k < 40; k++) {
    s.turn++;
    aiTurn(s, ai);
    for (const f of s.formations) if (f.civId === ai.id) f.moves = 2;
  }
  const rails = s.roads.filter(v => v === RAIL).length;
  check(
    s.formations.some(f => f.civId === ai.id && f.kind === 'engineers'),
    'an AI people with Railways raises engineers',
  );
  console.log(`     (${rails} rail hexes after 40 turns; ${mine.length} settlements)`);
}

// ---- coalitions
{
  const s = fresh();
  const me = player(s);
  const great = s.civs.filter(c => !c.independent);
  for (const c of great) c.met = great.filter(o => o.id !== c.id).map(o => o.id);
  s.turn = COALITION_FROM;
  check(!coalitionTurn(s).length && !s.coalition, 'no coalition while nobody runs away');
  s.holding = { economic: { civId: me.id, since: s.turn } };
  const rival = great.find(c => c.id !== me.id)!;
  const before = opinion(s, rival.id, me.id);
  const news = coalitionTurn(s);
  check(
    s.coalition?.against === me.id && s.coalition.members.length >= 2,
    `holding a victory goal brings a coalition (${s.coalition?.members.length} peoples)`,
  );
  check(
    news.some(n => n.startsWith('A coalition forms against you')),
    `the player is told why: "${news[0]}"`,
  );
  check(opinion(s, rival.id, me.id) < before, 'its members think worse of the leader');
  s.holding = {};
  s.turn += 1;
  const end = coalitionTurn(s);
  check(!s.coalition && /breaks up/.test(end[0] ?? ''), 'it breaks up when the danger passes');
}

console.log(failures ? `${failures} failures` : 'all finale checks passed');
process.exit(failures ? 1 : 0);
