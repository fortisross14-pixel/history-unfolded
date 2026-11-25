/**
 * Headless checks of recovery, commanding houses and the battle history: a wounded army heals
 * at the stated rate (from a city's people in its lands, on the march outside), the unit card's
 * rate is the engine's, battles against the player on the AI's turn are kept with their report,
 * the history survives a save and is capped, a house's War level helps its army, a win teaches
 * it war, and in a civil war the rebel house's armies go with it.
 */
import {
  assignCommander,
  attack,
  BATTLE_LOG_CAP,
  COMMAND,
  commandLevel,
  deserialize,
  endTurn,
  formationStrength,
  foundCity,
  fullMoves,
  HEAL,
  healPlan,
  healTurn,
  isWaterHex,
  levy,
  MIN_CITY_POP,
  newGame,
  player,
  serialize,
  supplyingCity,
} from '../src/engine/game.ts';
import { chooseSide, levelOf, riseHouse, splitArmies } from '../src/engine/dynasty.ts';
import { distance, neighbors } from '../src/engine/hex.ts';
import { isPassableLand } from '../src/engine/mapgen.ts';
import { raiderCiv } from '../src/engine/raiders.ts';
import { XP_PER_LEVEL } from '../src/data/dynasties.ts';
import { healthOf } from '../src/ui/health.ts';
import type { Formation, GameState } from '../src/engine/types.ts';

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
const g = (s: GameState) => ({ w: s.map.w, h: s.map.h });
const raise = (s: GameState): Formation => {
  const me = player(s);
  const c = s.cities.find(x => x.civId === me.id)!;
  c.pop = Math.max(c.pop, 6000);
  const before = new Set(s.formations.map(f => f.id));
  const r = levy(s, c.id);
  if (!r.ok) throw new Error(r.msg);
  const f = s.formations.find(x => !before.has(x.id) && x.kind === 'army')!;
  f.moves = fullMoves(s, f);
  return f;
};
/** a land hex far from every settlement (outside anyone's lands) */
const wild = (s: GameState) => {
  for (let i = 0; i < s.map.w * s.map.h; i++)
    if (
      !isWaterHex(s, i) &&
      isPassableLand(s.map, i) &&
      !s.formations.some(f => f.hex === i) &&
      s.cities.every(c => distance(g(s), c.hex, i) > 6)
    )
      return i;
  throw new Error('no wild hex');
};

// ---- in your lands: recruits from the nearest settlement
{
  const s = fresh();
  const f = raise(s);
  for (const c of f.cohorts) c.strength = 5;
  const city = supplyingCity(s, f.civId, f.hex)!;
  city.pop = 8000;
  const plan = healPlan(s, f);
  check(plan.kind === 'home' && plan.city === city, 'in your lands: topped up from the city');
  check(plan.rate >= HEAL.home, `rate at least ${HEAL.home} a cohort (${plan.rate})`);
  const pop = city.pop;
  const before = f.cohorts.map(c => c.strength);
  healTurn(s);
  const gained = f.cohorts.reduce((a, c, i) => a + c.strength - before[i], 0);
  check(
    f.cohorts.every((c, i) => c.strength - before[i] === Math.min(95, plan.rate)),
    'each cohort gains the stated rate',
  );
  check(pop - city.pop === gained && gained === plan.total, 'the city gives exactly those people');
  // back to full from near nothing in about 3 turns
  let turns = 1;
  while (f.cohorts.some(c => c.strength < 100) && turns < 20) {
    healTurn(s);
    turns++;
  }
  check(turns <= 3, `full from 5 a cohort in ${turns} turns at home`);
  // a city at its floor cannot spare recruits: the wounded still mend at the field rate
  for (const c of f.cohorts) c.strength = 40;
  city.pop = MIN_CITY_POP;
  const p2 = healPlan(s, f);
  check(p2.kind === 'field' && p2.fromCity === 0 && p2.total > 0, 'small city: field rate, free');
  // the card says what the engine does
  for (const c of f.cohorts) c.strength = 30;
  city.pop = 8000;
  const h = healthOf(s, f);
  const b2 = f.cohorts.map(c => c.strength);
  healTurn(s);
  const g2 = f.cohorts.reduce((a, c, i) => a + c.strength - b2[i], 0);
  check(h.perTurn === g2, `card says +${h.perTurn}, engine gave +${g2}`);
  check(h.text.includes(String(h.rate)) && h.text.includes(city.name), `card: "${h.text}"`);
}

// ---- outside your lands: slower, faster resting and fortified
{
  const s = fresh();
  const f = raise(s);
  f.hex = wild(s);
  f.path = [];
  for (const c of f.cohorts) c.strength = 50;
  f.moves = 0;
  const moving = healPlan(s, f);
  check(
    moving.kind === 'field' && moving.rate === HEAL.field,
    `on the march: +${HEAL.field} (${moving.rate})`,
  );
  f.moves = fullMoves(s, f);
  const rest = healPlan(s, f);
  check(rest.rate === HEAL.field + HEAL.rest, 'resting: + rest');
  f.fortified = true;
  const fort = healPlan(s, f);
  check(fort.rate === HEAL.field + HEAL.fortified, 'fortified: + fortified');
  f.fought = s.turn;
  check(healPlan(s, f).rate === HEAL.field, 'fought this turn: no rest bonus');
  f.fought = undefined;
  f.fortified = false;
  const before = f.cohorts.map(c => c.strength);
  const h = healthOf(s, f);
  healTurn(s);
  check(
    f.cohorts.every((c, i) => c.strength - before[i] === h.rate),
    `outside: card's +${h.rate} a cohort is what it gets`,
  );
  for (const c of f.cohorts) c.strength = 5;
  let turns = 0;
  while (f.cohorts.some(c => c.strength < 100) && turns < 20) {
    f.moves = 0;
    healTurn(s);
    turns++;
  }
  check(turns >= 5 && turns <= 6, `outside, marching: full in ${turns} turns`);
}

// ---- battles on the AI's turn against the player are kept, with their report
{
  const s = fresh();
  const me = player(s);
  const f = raise(s);
  // a lone cohort out in the wild, next to a raider band
  f.cohorts = f.cohorts.slice(0, 1);
  f.hex = wild(s);
  f.moves = fullMoves(s, f);
  const rc = raiderCiv(s);
  const spot = neighbors(g(s), f.hex).find(
    n => !isWaterHex(s, n) && isPassableLand(s.map, n) && !s.formations.some(x => x.hex === n),
  )!;
  const band: Formation = {
    id: s.nextId++,
    civId: rc.id,
    name: 'Raider band',
    kind: 'army',
    hex: spot,
    cohorts: Array.from({ length: 4 }, () => ({
      id: s.nextId++,
      strength: 100,
      xp: 0,
      designId: null,
      loadout: { ...f.cohorts[0].loadout, weapon: 'spear' },
    })),
    moves: 0,
    path: [],
    fortified: false,
  };
  s.formations.push(band);
  band.moves = fullMoves(s, band);
  s.raiders!.bands.push({ fid: band.id, camp: spot });
  const n0 = s.battles?.length ?? 0;
  me.researching ??= null;
  const events = endTurn(s);
  const rec = (s.battles ?? []).slice(n0).find(b => b.side === 'defender');
  check(rec, 'a raider attack on the player at the turn end is recorded');
  check(
    rec && !rec.ordered && rec.att.civId === rc.id,
    'recorded as not ordered, raiders attacking',
  );
  check(
    rec && rec.report.lines.length > 0 && Array.isArray(rec.report.why),
    'with its report and reasons',
  );
  check(rec && rec.place && rec.turn === s.turn - 1, `with turn and place (${rec?.place})`);
  check(
    events.some(e => /^Battle (at|near|in) /.test(e)),
    'it is in the turn news: ' + (events.find(e => /^Battle /.test(e)) ?? 'none'),
  );
  // save / load keeps the history
  const back = deserialize(serialize(s));
  check(
    back.battles?.length === s.battles?.length &&
      back.battles?.at(-1)?.report.attacker.lost === s.battles?.at(-1)?.report.attacker.lost,
    'save and load keep the battles',
  );
  // old saves have no history and load
  const old = JSON.parse(serialize(s));
  delete old.state.battles;
  check(!deserialize(JSON.stringify(old)).battles, 'an old save without battles loads');
}

// ---- the list is capped; the player's own attack is "ordered"; commanders
{
  const s = fresh();
  const me = player(s);
  const f = raise(s);
  f.hex = wild(s);
  const rc = raiderCiv(s);
  const spot = neighbors(g(s), f.hex).find(
    n => !isWaterHex(s, n) && isPassableLand(s.map, n) && !s.formations.some(x => x.hex === n),
  )!;
  const prey: Formation = {
    id: s.nextId++,
    civId: rc.id,
    name: 'Raider band',
    kind: 'army',
    hex: spot,
    cohorts: [
      { id: s.nextId++, strength: 30, xp: 0, designId: null, loadout: { ...f.cohorts[0].loadout } },
    ],
    moves: 0,
    path: [],
    fortified: false,
  };
  s.formations.push(prey);
  const house = me.dynasties[0];
  check(assignCommander(s, f.id, house.id).ok && f.commander === house.id, 'a house takes command');
  house.traits = { ...house.traits, military: 3 };
  const lvl = commandLevel(s, f);
  const withHouse = formationStrength(s, f);
  f.commander = undefined;
  const without = formationStrength(s, f);
  f.commander = house.id;
  check(
    lvl >= 3 && withHouse > without,
    `War ${lvl}: strength ${without.toFixed(1)} → ${withHouse.toFixed(1)}`,
  );
  for (const c of f.cohorts) c.strength = 50;
  const pl2 = healPlan(s, f);
  check(
    pl2.parts.some(([l, n]) => l.includes(house.name) && n === lvl * 2),
    'the house speeds healing',
  );
  for (const c of f.cohorts) c.strength = 100;
  // a pile of old battles, then one more: capped, newest last
  const fake = { ...s.battles?.[0] };
  s.battles = Array.from({ length: BATTLE_LOG_CAP + 5 }, (_, i) => ({
    ...(fake as NonNullable<GameState['battles']>[number]),
    id: -1 - i,
  }));
  const xp0 = house.xp?.military ?? 0;
  f.moves = fullMoves(s, f);
  const r = attack(s, f.id, spot);
  check(r.ok && s.battles.length === BATTLE_LOG_CAP, `capped at ${BATTLE_LOG_CAP}`);
  const last = s.battles.at(-1)!;
  check(last.side === 'attacker' && last.ordered, "the player's own attack is kept as ordered");
  check(last.att.house?.name === house.name, 'the record names the commanding house');
  check(
    last.winner === 'attacker' && (house.xp?.military ?? 0) === xp0 + COMMAND.winXp,
    `a win teaches the house war (+${COMMAND.winXp}, ${XP_PER_LEVEL} a level)`,
  );
}

// ---- civil war: the rebel house's armies go with it; loyal houses' armies stay
{
  const s = fresh();
  const me = player(s);
  const c0 = s.cities.find(c => c.civId === me.id)!;
  // a second settlement for the rebels to hold
  const far = (() => {
    for (let i = 0; i < s.map.w * s.map.h; i++)
      if (
        !isWaterHex(s, i) &&
        isPassableLand(s.map, i) &&
        distance(g(s), c0.hex, i) >= 8 &&
        s.cities.every(c => distance(g(s), c.hex, i) >= 6)
      )
        return i;
    return -1;
  })();
  const settler = raise(s);
  settler.kind = 'settlers';
  settler.hex = far;
  foundCity(s, settler.id);
  const c1 = s.cities.find(c => c.civId === me.id && c !== c0)!;
  const rebel = riseHouse(s, me);
  c1.governor = rebel.id;
  const ruler = me.dynasties.find(d => d.id === me.ruling)!;
  // led by the rebels but standing at the capital; led by the throne but near the rebel town
  const a = raise(s);
  const b = raise(s);
  b.hex = c1.hex;
  const u = raise(s);
  u.hex = c1.hex;
  assignCommander(s, a.id, rebel.id);
  assignCommander(s, b.id, ruler.id);
  const plan = splitArmies(s, me.id, rebel.id);
  check(
    plan.going.includes(a) && plan.staying.includes(b) && plan.going.includes(u),
    'the warning shows: rebel-led and unled-near-rebels go, throne-led stay',
  );
  me.civilWar = { rebel: rebel.id, since: s.turn, pending: true };
  check(chooseSide(s, me.id, ruler.id).ok, 'the realm splits');
  const rival = me.civilWar?.rival;
  check(rival !== undefined && a.civId === rival, 'the rebel-led army goes with the rebels');
  check(b.civId === me.id, 'the throne-led army near the rebel town stays');
  check(u.civId === rival, 'an unled army follows the settlement nearest it');
  check(levelOf(rebel, 'military') >= 0, 'house levels still read');
}

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll health checks passed.');
