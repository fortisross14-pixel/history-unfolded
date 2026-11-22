/** Headless checks of peace terms (tribute, ceding settlements) and sieges. */
import { evaluateOffer, executeOffer } from '../src/engine/diplomacy.ts';
import {
  besiegers,
  cedeCity,
  declareWar,
  foundCity,
  newGame,
  player,
  siegeBreached,
  SIEGE_BREACH,
  siegeTurn,
} from '../src/engine/game.ts';
import { neighbors } from '../src/engine/hex.ts';
import type { GameState } from '../src/engine/types.ts';

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
      type: 'pangaea',
      size: 'small',
      seaLevel: 'normal',
      climate: 'normal',
      rainfall: 'normal',
      resources: 'normal',
      mountains: 'normal',
      seed: 6,
    },
    civCount: 4,
    playerName: 'Test',
  });
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  return s;
};

// ---- ceding by treaty
{
  const s = fresh();
  const me = player(s);
  const ai = s.civs.find(c => !c.isPlayer && !c.independent)!;
  const theirs = s.cities.find(c => c.civId === ai.id)!;
  check(
    !evaluateOffer(s, me.id, ai.id, { give: {}, get: { cities: [theirs.id] } }).accept &&
      /peace treaty/.test(
        evaluateOffer(s, me.id, ai.id, { give: {}, get: { cities: [theirs.id] } }).reason,
      ),
    'settlements change hands only in a peace treaty',
  );
  declareWar(s, me.id, ai.id);
  s.turn += 12;
  const last = evaluateOffer(s, me.id, ai.id, {
    give: {},
    get: { cities: [theirs.id] },
    peace: true,
  });
  check(
    s.cities.filter(c => c.civId === ai.id).length > 1 || /last settlement/.test(last.reason),
    `a people never cedes its last settlement ("${last.reason}")`,
  );
  // give the AI a second settlement, then make it lose the war badly
  const spare = {
    ...structuredClone(theirs),
    id: 777,
    hex: neighbors({ w: s.map.w, h: s.map.h }, theirs.hex)[0],
    name: 'Spare',
  };
  s.cities.push(spare);
  const w = s.wars.find(x => x.a === me.id && x.b === ai.id)!;
  w.dead = { [ai.id]: 5000, [me.id]: 100 };
  w.taken = { [me.id]: 2 };
  const terms = { give: {}, get: { cities: [spare.id] }, peace: true };
  const ev = evaluateOffer(s, me.id, ai.id, terms);
  check(ev.accept, `a people losing badly cedes a settlement for peace (${ev.reason})`);
  executeOffer(s, me.id, ai.id, terms);
  check(
    spare.civId === me.id && !s.wars.some(x => x === w),
    'the settlement is ours and the war is over',
  );
  // tribute: a per-turn payment for 20 turns
  declareWar(s, ai.id, me.id);
  s.turn += 12;
  const w2 = s.wars.find(x => x.a === ai.id)!;
  w2.dead = { [ai.id]: 5000, [me.id]: 100 };
  w2.taken = { [me.id]: 1 };
  const tribute = { give: {}, get: { goldPerTurn: 5 }, peace: true, turns: 20 };
  const tev = evaluateOffer(s, me.id, ai.id, tribute);
  check(
    tev.accept,
    `a beaten people agrees to pay tribute (${tev.reason} ${Math.round(tev.value)})`,
  );
  executeOffer(s, me.id, ai.id, tribute);
  check(
    s.treaties.some(
      t => t.kind === 'trade' && t.bGives?.goldPerTurn === 5 && t.until === s.turn + 20,
    ),
    'the tribute runs 20 turns',
  );
}

// ---- cedeCity: the old owner's troops withdraw
{
  const s = fresh();
  const me = player(s);
  const ai = s.civs.find(c => !c.isPlayer && !c.independent)!;
  const theirs = s.cities.find(c => c.civId === ai.id)!;
  const guard = s.formations.find(f => f.civId === ai.id && f.kind === 'army')!;
  guard.hex = theirs.hex;
  cedeCity(s, theirs.id, me.id);
  check(theirs.civId === me.id, 'a ceded settlement changes hands');
  check(
    !s.formations.some(f => f.civId === ai.id && f.hex === theirs.hex),
    'its old garrison withdraws',
  );
}

// ---- sieges
{
  const s = fresh();
  const me = player(s);
  const ai = s.civs.find(c => !c.isPlayer && !c.independent)!;
  const target = s.cities.find(c => c.civId === ai.id)!;
  declareWar(s, me.id, ai.id);
  const army = s.formations.find(f => f.civId === me.id && f.kind === 'army')!;
  const ring = neighbors({ w: s.map.w, h: s.map.h }, target.hex)[0];
  army.hex = ring;
  while (army.cohorts.length < 3)
    army.cohorts.push({ ...structuredClone(army.cohorts[0]), id: 9000 + army.cohorts.length });
  check((besiegers(s, target).get(me.id) ?? 0) >= 3, 'three cohorts stand around the settlement');
  target.guard = 1;
  const news = siegeTurn(s);
  check(target.siege?.by === me.id, 'it is besieged');
  check(
    news.some(n => /besiege/.test(n)),
    `the player is told: "${news[0]}"`,
  );
  for (let k = 0; k < SIEGE_BREACH; k++) {
    s.turn++;
    siegeTurn(s);
  }
  check(target.guard < 1, `its guard starves (${Math.round(target.guard * 100)}%)`);
  check(siegeBreached(s, target), `after ${SIEGE_BREACH} turns its walls are breached`);
  army.hex =
    target.hex + 5000 > 0
      ? neighbors({ w: s.map.w, h: s.map.h }, ring).find(
          h => h !== target.hex && !neighbors({ w: s.map.w, h: s.map.h }, target.hex).includes(h),
        )!
      : ring;
  s.turn++;
  const lift = siegeTurn(s);
  check(
    !target.siege && lift.some(n => /lifted/.test(n)),
    'driving the troops off lifts the siege',
  );
}

console.log(failures ? `${failures} failures` : 'all war checks passed');
process.exit(failures ? 1 : 0);
