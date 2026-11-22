/** Headless checks of age policies: one lever per age, what each side does, cooldown, AI. */
import { AGE_GATE } from '../src/data/techs.ts';
import { aiTurn } from '../src/engine/ai.ts';
import { CRISIS, pressureOf } from '../src/engine/crises.ts';
import {
  deserialize,
  endTurn,
  foundCity,
  newGame,
  player,
  serialize,
  settlersCost,
} from '../src/engine/game.ts';
import { civMods } from '../src/engine/mods.ts';
import { openPolicies, policyProblem, policyTurn, setPolicy } from '../src/engine/policies.ts';
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
      type: 'continents',
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

{
  const s = fresh();
  const me = player(s);
  const home = s.cities.find(c => c.civId === me.id)!;
  check(
    openPolicies(me)
      .map(p => p.id)
      .join() === 'way-of-life',
    'the Ancient age opens one lever: Way of Life',
  );
  check(!!policyProblem(s, me, 'feudal-balance'), 'the Medieval lever waits for its age');
  const cost = settlersCost(s, home);
  const sight = civMods(s, me.id).sight;
  check(setPolicy(s, me.id, 'way-of-life', -1).ok, 'the player chooses a Migratory way of life');
  check(
    settlersCost(s, home) === Math.round((cost * 0.75) / 50) * 50 &&
      civMods(s, me.id).sight === sight + 1,
    `settlers cost fewer people (${cost} → ${settlersCost(s, home)}) and sight +1`,
  );
  check(
    !setPolicy(s, me.id, 'way-of-life', 1).ok,
    `the lever cannot move again at once: "${policyProblem(s, me, 'way-of-life')}"`,
  );
  s.turn += 10;
  check(setPolicy(s, me.id, 'way-of-life', 1).ok, 'ten turns later it can');

  // ---- every age adds its lever; earlier ones stay
  toAge(me, 5);
  check(openPolicies(me).length === 5, 'by the Industrial age the realm pulls five levers');
  const gold = civMods(s, me.id).goldPct;
  setPolicy(s, me.id, 'revenue', 1);
  check(civMods(s, me.id).goldPct === gold + 15, 'Heavy Taxes bring +15% gold');
  // a second house beside the throne
  const house = { ...structuredClone(me.dynasties[0]), id: 9999, name: 'Testa', unrest: 10 };
  me.dynasties.push(house);
  policyTurn(s, me);
  check(house.unrest === 11, 'and stir the noble houses (+1 unrest a turn)');
  me.stats = {
    gdp: 1,
    culture: 1,
    crowd: 1,
    starving: 0,
    upkeep: 0,
    income: 1,
    industry: 4,
    comfort: -1,
  };
  for (const c of s.cities) if (c.civId === me.id) c.pop = 20000;
  const plague = pressureOf(s, me, CRISIS.plague).value;
  setPolicy(s, me.id, 'trade-policy', 1);
  check(
    pressureOf(s, me, CRISIS.plague).value > plague,
    'Free Trade makes plague more likely (ideas and sickness travel)',
  );
  const strikes = pressureOf(s, me, CRISIS.strikes).value;
  setPolicy(s, me.id, 'labour', 1);
  check(
    pressureOf(s, me, CRISIS.strikes).value === strikes / 2,
    'Welfare halves the pressure of strikes',
  );
  const back = deserialize(serialize(s));
  check(player(back).policies?.labour?.pos === 1, 'levers survive a save and load');
}

// ---- AI peoples pull their levers as they advance
{
  const s = fresh(9);
  for (let k = 0; k < 160; k++) {
    const me = player(s);
    me.isPlayer = false;
    aiTurn(s, me);
    me.isPlayer = true;
    endTurn(s);
  }
  const ais = s.civs.filter(c => c.alive && !c.independent && !c.isPlayer);
  check(
    ais.every(c => c.policies?.['way-of-life'] !== undefined),
    `AI peoples set their way of life (${ais.map(c => `${c.name}: ${c.policies?.['way-of-life']?.pos}`).join(', ')})`,
  );
}

console.log(failures ? `${failures} failures` : 'all policy checks passed');
process.exit(failures ? 1 : 0);
