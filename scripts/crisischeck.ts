/** Headless checks of crises: they need a real cause, change play, can be answered, and end. */
import { AGE_GATE } from '../src/data/techs.ts';
import {
  activeCrisis,
  CRISIS_GAP,
  crisisRisks,
  crisisTurn,
  FIRST_CRISIS,
  respondCrisis,
} from '../src/engine/crises.ts';
import { deserialize, foundCity, newGame, player, serialize } from '../src/engine/game.ts';
import { civMods } from '../src/engine/mods.ts';
import type { Civ, GameState } from '../src/engine/types.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};

const fresh = (): GameState => {
  const s = newGame({
    map: {
      type: 'continents',
      size: 'small',
      seaLevel: 'normal',
      climate: 'normal',
      rainfall: 'normal',
      resources: 'normal',
      mountains: 'normal',
      seed: 5,
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
const crowded = (s: GameState, civ: Civ) => {
  civ.stats = {
    gdp: 10,
    culture: 1,
    crowd: 1,
    starving: 0,
    upkeep: 0,
    income: 20,
    industry: 0,
    comfort: 0,
  };
  for (const c of s.cities) if (c.civId === civ.id) c.pop = 20000;
};
/** run turns until a crisis strikes (or give up) */
const until = (s: GameState, civ: Civ, max: number) => {
  const out: string[] = [];
  for (let k = 0; k < max && !civ.crisis; k++) {
    s.turn++;
    out.push(...crisisTurn(s, civ));
  }
  return out;
};

// ---- no cause, no crisis; no crisis before FIRST_CRISIS
{
  const s = fresh();
  const me = player(s);
  toAge(me, 3);
  me.stats = {
    gdp: 10,
    culture: 1,
    crowd: 0.5,
    starving: 0,
    upkeep: 0,
    income: 20,
    industry: 0,
    comfort: 0,
  };
  s.turn = FIRST_CRISIS;
  until(s, me, 200);
  check(!me.crisis, 'a realm without a real cause never meets a crisis in 200 turns');
  const t = fresh();
  const p = player(t);
  toAge(p, 2);
  crowded(t, p);
  t.turn = 1;
  until(t, p, FIRST_CRISIS - 3);
  check(!p.crisis, `no crisis before turn ${FIRST_CRISIS}, whatever the pressure`);
}

// ---- a crowded realm meets plague: warning first, then the crisis, then the answers
{
  const s = fresh();
  const me = player(s);
  toAge(me, 2);
  crowded(s, me);
  check(
    crisisRisks(s, me).some(r => r.def.id === 'plague'),
    `the Nation screen warns of the risk first: "${crisisRisks(s, me)[0]?.why}"`,
  );
  s.turn = FIRST_CRISIS;
  const news = until(s, me, 80);
  check(me.crisis?.id === 'plague', `crowding brings plague (turn ${s.turn})`);
  check(
    news.some(n => n.startsWith('Crisis: Plague')) && s.crisisCard,
    'the player is told and its card opens',
  );
  check(civMods(s, me.id).growthPct <= -60, 'while it lasts, growth falls by 60%');
  const big = s.cities.find(c => c.civId === me.id)!;
  const before = big.pop;
  s.turn++;
  crisisTurn(s, me);
  check(big.pop < before, `the largest settlement loses people (${before} → ${big.pop})`);
  me.gold = 0;
  const a = activeCrisis(s, me)!;
  check(!!a.choices[0].blocked, `an answer it cannot pay for says why: "${a.choices[0].blocked}"`);
  me.gold = 100;
  check(respondCrisis(s, me.id, 0).ok, 'paying the physicians is accepted');
  check(
    me.crisis!.until === s.turn + 2 && me.crisis!.eased,
    'it will pass in 2 turns, eased meanwhile',
  );
  check(civMods(s, me.id).growthPct > -60, 'eased, its effects are halved');
  check(!respondCrisis(s, me.id, 1).ok, 'a crisis is answered once');
  const back = deserialize(serialize(s));
  check(player(back).crisis?.id === 'plague', 'a crisis survives a save and load');
  s.turn += 2;
  const end = crisisTurn(s, me);
  check(!me.crisis && end.length > 0, `it ends: "${end[0]}"`);
  check(
    me.crisisNext === s.turn + CRISIS_GAP,
    `the next crisis waits at least ${CRISIS_GAP} turns`,
  );
}

// ---- a famine ends as soon as the realm is fed again
{
  const s = fresh();
  const me = player(s);
  me.stats = {
    gdp: 10,
    culture: 1,
    crowd: 0.5,
    starving: 2,
    upkeep: 0,
    income: 20,
    industry: 0,
    comfort: 0,
  };
  s.turn = FIRST_CRISIS;
  until(s, me, 80);
  check(me.crisis?.id === 'famine', 'hungry settlements bring famine');
  me.stats.starving = 0;
  s.turn += 3;
  const out = crisisTurn(s, me);
  check(!me.crisis && /granaries fill/.test(out[0] ?? ''), 'fixing the cause ends it early');
}

// ---- schism: letting the faith divide starts a religious upheaval
{
  const s = fresh();
  const me = player(s);
  toAge(me, 3);
  me.crisis = { id: 'schism', since: s.turn, until: s.turn + 15 };
  me.culture.tension.religion = 80;
  check(
    respondCrisis(s, me.id, 2).ok && me.culture.upheaval?.domain === 'religion',
    'letting the faith divide begins a religious upheaval',
  );
}

// ---- the AI answers its own crises at once
{
  const s = fresh();
  const ai = s.civs.find(c => !c.isPlayer && !c.independent)!;
  toAge(ai, 2);
  crowded(s, ai);
  ai.gold = 500;
  s.turn = FIRST_CRISIS;
  until(s, ai, 80);
  check(
    !ai.crisis || !!ai.crisis.response,
    `an AI people answers its crisis (${ai.crisis?.response ?? 'ended at once'})`,
  );
}

console.log(failures ? `${failures} failures` : 'all crisis checks passed');
process.exit(failures ? 1 : 0);
