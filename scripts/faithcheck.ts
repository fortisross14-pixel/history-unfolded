/** Headless checks of faiths: founding race, tenets, spreading, opinion, tension, AI games. */
import { TENETS } from '../src/data/faiths.ts';
import { aiTurn } from '../src/engine/ai.ts';
import { opinionParts } from '../src/engine/diplomacy.ts';
import { cityDistricts } from '../src/engine/economy.ts';
import {
  chooseTenet,
  CONVERT_TURNS,
  faithIncome,
  faithTurn,
  foundedBy,
  foundFaith,
  foundProblem,
  maxFaiths,
  pressures,
  tenetDue,
} from '../src/engine/faith.ts';
import { deserialize, endTurn, foundCity, newGame, player, serialize } from '../src/engine/game.ts';
import { civMods } from '../src/engine/mods.ts';
import type { City, GameState } from '../src/engine/types.ts';

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
const shrine = (s: GameState, c: City) => {
  const d = cityDistricts(s, c)[0];
  const i = d.slots.findIndex(x => !x.type);
  d.slots[i >= 0 ? i : 0] = { type: 'shrine', built: true, progress: 0, paid: true };
};

// ---------------------------------------------------------------- founding
{
  const s = make(5);
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  const home = s.cities.find(c => c.civId === me.id)!;
  check(foundProblem(s, me.id) === 'Needs Mysticism.', 'no faith without Mysticism');
  me.techs.push('mysticism');
  check(/shrine/.test(foundProblem(s, me.id) ?? ''), 'no faith without a shrine');
  shrine(s, home);
  check(foundProblem(s, me.id) === null, 'Mysticism and a shrine: a faith can be founded');
  check(!foundFaith(s, me.id, 'feasts').ok, 'a teaching cannot be the founding belief');
  const r = foundFaith(s, me.id, 'tithes', 'The Way of Tests');
  check(r.ok, `founded: ${r.msg}`);
  const f = foundedBy(s, me.id)!;
  check(f.holy === home.id && home.faith === f.id, 'the holy city keeps the faith at once');
  check(me.faith === f.id, 'the founder keeps its own faith');
  check(!foundFaith(s, me.id, 'tithes').ok, 'one faith per people');
  check(
    s.chronicle?.some(e => e.kind === 'faith'),
    'the founding goes into the chronicle',
  );
  // tenets open with Priesthood and Theology
  check(tenetDue(s, me.id) === null, 'no teaching before Priesthood');
  me.techs.push('priesthood');
  check(tenetDue(s, me.id) === 'teaching', 'Priesthood opens the teaching');
  check(!chooseTenet(s, me.id, 'reformed').ok, 'a doctrine is not a teaching');
  const before = civMods(s, me.id).growthPct;
  check(chooseTenet(s, me.id, 'feasts').ok, 'teaching chosen');
  check(
    civMods(s, me.id).growthPct === before - 10,
    'the teaching helps the people keeping it (less food to grow)',
  );
  me.techs.push('theology');
  check(tenetDue(s, me.id) === 'doctrine', 'Theology opens the doctrine');
  check(chooseTenet(s, me.id, 'reformed').ok && tenetDue(s, me.id) === null, 'three tenets');
  check(faithIncome(s, me.id).gold === 0.5, 'tithes: ½ gold per follower settlement');

  // the race: the world has room for only a few
  const others = s.civs.filter(c => !c.independent && c.id !== me.id);
  let n = 1;
  for (const o of others) {
    const c = s.cities.find(x => x.civId === o.id);
    if (!c) continue;
    o.techs.push('mysticism');
    shrine(s, c);
    if (foundFaith(s, o.id, 'pilgrims').ok) n++;
  }
  check(n === maxFaiths(s), `the world holds ${maxFaiths(s)} faiths (founded ${n})`);
  const late = others.find(o => !foundedBy(s, o.id) && s.cities.some(c => c.civId === o.id));
  if (late) check(/room for/.test(foundProblem(s, late.id) ?? ''), 'late peoples find no room');

  // a save keeps it all
  const back = deserialize(serialize(s));
  check(
    back.faiths?.length === s.faiths!.length &&
      back.cities.find(c => c.id === home.id)!.faith === f.id,
    'faiths survive a save',
  );
}

// ---------------------------------------------------------------- spreading and opinion
{
  const s = make(7);
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  const home = s.cities.find(c => c.civId === me.id)!;
  me.techs.push('mysticism');
  shrine(s, home);
  foundFaith(s, me.id, 'missionaries');
  const f = foundedBy(s, me.id)!;
  // a foreign settlement next door with no faith
  const other = s.civs.find(c => !c.independent && c.id !== me.id)!;
  const near = s.cities.find(c => c.civId === other.id)!;
  const oldHex = near.hex;
  near.hex = home.hex + 3; // three hexes along the row
  const p = pressures(s, near).get(f.id) ?? 0;
  check(p >= 1, `a strong faith next door presses on a settlement (${p.toFixed(2)})`);
  for (let i = 0; i < CONVERT_TURNS; i++) faithTurn(s);
  check(near.faith === f.id, `it takes up the faith after ${CONVERT_TURNS} turns`);
  faithTurn(s);
  check(
    other.faith === f.id ||
      near.pop * 3 < s.cities.filter(c => c.civId === other.id).reduce((a, c) => a + c.pop, 0),
    'a people takes up the faith most of it keeps',
  );
  if (other.faith === f.id) {
    check(
      opinionParts(s, other.id, me.id).some(x => /Shared faith/.test(x.label) && x.value > 0),
      'a shared faith warms opinion',
    );
  }
  near.hex = oldHex;
  // a realm divided: religious tension builds, to the cap
  me.culture.tension.religion = 0;
  const mine2 = s.cities.find(c => c.civId === other.id)!;
  // give the player a second, larger settlement that keeps another faith
  const second = {
    ...home,
    id: 999,
    name: 'Otherton',
    hex: home.hex + 40,
    pop: home.pop,
    faith: 77,
  } as City;
  s.faiths!.push({
    id: 77,
    name: 'Old Ways',
    founder: other.id,
    holy: mine2.id,
    founded: 0,
    tenets: [],
  });
  s.cities.push(second);
  for (let i = 0; i < 20; i++) faithTurn(s);
  check(
    (me.culture.tension.religion ?? 0) > 5,
    `a divided realm builds religious tension (${(me.culture.tension.religion ?? 0).toFixed(1)})`,
  );
  s.cities = s.cities.filter(c => c !== second);
}

// ---------------------------------------------------------------- AI games
for (const seed of [11, 23]) {
  const s = make(seed, 'standard', 6);
  const me = player(s);
  for (let t = 0; t < 200; t++) {
    me.isPlayer = false;
    aiTurn(s, me);
    me.isPlayer = true;
    endTurn(s);
  }
  const faiths = s.faiths ?? [];
  const keeping = s.cities.filter(c => c.faith !== undefined).length;
  console.log(
    `     seed ${seed}: ${faiths.length}/${maxFaiths(s)} faiths (turns ${faiths.map(f => f.founded).join(', ')}), ` +
      `${keeping}/${s.cities.length} settlements keep one; ` +
      faiths
        .map(
          f =>
            `${f.name} [${f.tenets.map(t => TENETS[t].name).join(', ')}] ${s.cities.filter(c => c.faith === f.id).length}`,
        )
        .join('; '),
  );
  check(
    faiths.length >= 2 && faiths.length <= maxFaiths(s),
    'AI peoples found faiths, within room',
  );
  check(
    faiths.every(f => f.tenets.length >= 1),
    'every faith has a founding belief',
  );
  check(keeping >= s.cities.length * 0.3, 'faith reaches a good part of the world');
  check(
    faiths.filter(f => s.cities.some(c => c.faith === f.id)).length >= 2,
    'more than one faith survives',
  );
}

if (failures) {
  console.log(`${failures} faith check(s) failed`);
  process.exit(1);
}
console.log('all faith checks OK');
