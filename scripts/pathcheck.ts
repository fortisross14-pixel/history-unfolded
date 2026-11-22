/** Headless checks of national directions: when they are offered, what they do, edicts, the AI. */
import { aiTurn } from '../src/engine/ai.ts';
import { ageOf } from '../src/data/techs.ts';
import { civMods } from '../src/engine/mods.ts';
import { deserialize, endTurn, foundCity, newGame, player, serialize } from '../src/engine/game.ts';
import {
  choosePath,
  edictProblem,
  enterAge,
  lockedOptions,
  pathOptions,
  useEdict,
} from '../src/engine/paths.ts';
import type { GameState } from '../src/engine/types.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};

const fresh = (seed = 5): GameState =>
  newGame({
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

{
  const s = fresh();
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  check(!pathOptions(s, me).length, 'no direction is offered in the Ancient age');
  enterAge(s, me, 3);
  check(
    !me.pathDue && s.ageCard === 3,
    'the Medieval age shows its card but asks for no direction',
  );
  enterAge(s, me, 2);
  check(me.pathDue === 2 && s.ageCard === 2, 'entering the Classical age asks for a direction');
  const opts = pathOptions(s, me).map(p => p.id);
  check(
    opts.join() === 'republic,monarchy,bureaucracy',
    `three Classical directions: ${opts.join(', ')}`,
  );
  check(!choosePath(s, me.id, 'companies').ok, 'a Renaissance direction cannot be taken now');
  const gold = civMods(s, me.id).goldPct;
  check(choosePath(s, me.id, 'republic').ok && !me.pathDue, 'the Merchant Republic is chosen');
  check(civMods(s, me.id).goldPct === gold + 12, 'and its lasting +12% gold applies');
  check(!choosePath(s, me.id, 'monarchy').ok, 'only one direction per age');

  // ---- edicts
  me.gold = 100;
  for (const d of me.dynasties) d.unrest = 50;
  check(useEdict(s, me.id, 'republic').ok, 'Convene the Senate is issued');
  check(
    me.gold === 70 && me.dynasties.every(d => d.unrest === 30),
    'it costs 30 gold and calms every house by 20',
  );
  check(!!edictProblem(s, me, 'republic'), `then it waits: "${edictProblem(s, me, 'republic')}"`);
  s.turn += 20;
  check(!edictProblem(s, me, 'republic'), 'and is ready again after its cooldown');
  check(!useEdict(s, me.id, 'monarchy').ok, 'an edict of a direction not taken is refused');

  // ---- Renaissance: base directions and alternate developments earned by history
  enterAge(s, me, 4);
  check(
    pathOptions(s, me).length === 3 && lockedOptions(s, me).length === 2,
    'the Renaissance offers three directions; two alternate developments wait',
  );
  for (const c of s.civs) c.stats = { gdp: 10, culture: 1 };
  me.stats = { gdp: 100, culture: 1 };
  me.captured = 1;
  const alt = pathOptions(s, me).map(p => p.id);
  check(
    alt.includes('commercial-renaissance') && alt.includes('age-of-conquest'),
    'a rich, conquering people is offered the Commercial Renaissance and the Age of Conquest',
  );
  choosePath(s, me.id, 'commercial-renaissance');
  const back = deserialize(serialize(s));
  check(
    player(back).paths?.join() === 'republic,commercial-renaissance',
    'directions survive a save and load',
  );
}

// ---- the AI takes its directions as it advances
{
  const s = fresh(9);
  for (let k = 0; k < 220; k++) {
    const me = player(s);
    me.isPlayer = false;
    aiTurn(s, me);
    me.isPlayer = true;
    endTurn(s);
  }
  const ais = s.civs.filter(c => c.alive && !c.independent && !c.isPlayer);
  const ok = ais.every(c => {
    const age = ageOf(c.techs);
    const want = (age >= 2 ? 1 : 0) + (age >= 4 ? 1 : 0);
    return (c.paths?.length ?? 0) === want;
  });
  check(
    ok,
    `AI peoples hold one direction per Classical and Renaissance age (${ais.map(c => `${c.name} age ${ageOf(c.techs)}: ${(c.paths ?? []).join('+') || 'none'}`).join('; ')})`,
  );
  const issued = ais.some(c => Object.keys(c.edicts ?? {}).length);
  check(issued, 'and issue their edicts');
}

console.log(failures ? `${failures} failures` : 'all path checks passed');
process.exit(failures ? 1 : 0);
