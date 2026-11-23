/**
 * Mid-game shocks, forced on purpose: each must leave more than one way to recover.
 * - Iron lost: gear without iron is still there, and a neighbour with iron will sell some.
 * - A road cut by an enemy army: driving it off rejoins the market, and so does a road around.
 * - A house about to rise: honours calm it; if it rises, the player can stand with either side.
 */
import { evaluateOffer } from '../src/engine/diplomacy.ts';
import { grantHonours } from '../src/engine/dynasty.ts';
import { REVOLT_AT } from '../src/data/dynasties.ts';
import { invalidateMarkets, marketCities } from '../src/engine/economy.ts';
import { declareWar, foundCity, newGame, player } from '../src/engine/game.ts';
import { distance, neighbors } from '../src/engine/hex.ts';
import { isPassableLand } from '../src/engine/mapgen.ts';
import { findPath } from '../src/engine/path.ts';
import { ITEMS } from '../src/data/items.ts';
import type { GameState } from '../src/engine/types.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};
const make = (): GameState =>
  newGame({
    map: {
      type: 'pangaea',
      size: 'small',
      seaLevel: 'low',
      climate: 'normal',
      rainfall: 'normal',
      resources: 'normal',
      mountains: 'low',
      seed: 31,
    },
    civCount: 4,
    playerName: 'Test',
  });

// ---------------------------------------------------------------- iron lost
{
  const s = make();
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  const home = s.cities.find(c => c.civId === me.id)!;
  home.stockpile.iron = 0;
  for (let i = 0; i < s.map.deposit.length; i++)
    if (s.map.deposit[i]?.kind === 'iron') s.map.deposit[i] = null;
  me.techs.push('bronze-working', 'iron-working');
  const noIron = Object.values(ITEMS).filter(
    it =>
      it.slot === 'weapon' &&
      !('iron' in (it.cost ?? {})) &&
      (!it.tech || me.techs.includes(it.tech)) &&
      it.id !== 'improvised',
  );
  check(
    noIron.length >= 2,
    `gear without iron is still there (${noIron.map(x => x.id).join(', ')})`,
  );
  // a neighbour with iron to spare
  const rival = s.civs.find(c => !c.independent && c.id !== me.id)!;
  const theirs = s.cities.find(c => c.civId === rival.id)!;
  theirs.stockpile.iron = 30;
  me.met.push(rival.id);
  rival.met.push(me.id);
  me.gold = 300;
  let sold = false;
  for (const gold of [2, 4, 6, 10])
    if (
      evaluateOffer(s, me.id, rival.id, {
        give: { goldPerTurn: gold },
        get: { goodsPerTurn: { iron: 1 } },
        turns: 20,
      }).accept
    ) {
      sold = true;
      break;
    }
  check(sold, 'a neighbour sells iron for gold a turn');
}

// ---------------------------------------------------------------- a road cut
{
  const s = make();
  const me = player(s);
  const g = { w: s.map.w, h: s.map.h };
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  const home = s.cities.find(c => c.civId === me.id)!;
  // a second town 4 hexes away, joined by road
  const spot = s.map.terrain
    .map((_, i) => i)
    .find(
      i =>
        distance(g, home.hex, i) === 4 &&
        isPassableLand(s.map, i) &&
        !s.cities.some(c => c !== home && distance(g, c.hex, i) < 3),
    )!;
  const settlers = s.formations.find(f => f.civId === me.id && f.kind === 'army')!;
  const f2 = { ...settlers, id: s.nextId++, kind: 'settlers' as const, hex: spot };
  s.formations.push(f2);
  foundCity(s, f2.id);
  const town = s.cities.find(c => c.hex === spot)!;
  // rivers join markets too: this scenario is about the road alone
  s.map.river = s.map.river.map(() => 0);
  const land = (a: number, b: number) => (isPassableLand(s.map, b) ? 1 : Infinity);
  const road = findPath(g, home.hex, town.hex, land)!;
  for (const h of road) s.roads[h] = 1;
  invalidateMarkets();
  check(marketCities(s, home).includes(town), 'the two towns share a market by road');
  // an enemy army stands on the road
  const rival = s.civs.find(c => !c.independent && c.id !== me.id)!;
  declareWar(s, me.id, rival.id);
  const mid = road[Math.floor(road.length / 2) - 1] ?? road[0];
  const enemy = s.formations.find(f => f.civId === rival.id && f.kind === 'army')!;
  const was = enemy.hex;
  enemy.hex = mid;
  invalidateMarkets();
  check(!marketCities(s, home).includes(town), 'an enemy army on the road splits the market');
  // way out 1: drive it off
  enemy.hex = was;
  invalidateMarkets();
  check(marketCities(s, home).includes(town), 'driving it off rejoins the market');
  // way out 2: a road around it
  enemy.hex = mid;
  const around = findPath(g, home.hex, town.hex, (a, b) =>
    b === mid || !isPassableLand(s.map, b) ? Infinity : 1,
  );
  if (around) for (const h of around) s.roads[h] = 1;
  invalidateMarkets();
  check(!!around && marketCities(s, home).includes(town), 'a road around the enemy rejoins it too');
  void neighbors;
}

// ---------------------------------------------------------------- a house about to rise
{
  const s = make();
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  const house = me.dynasties[0];
  house.unrest = REVOLT_AT - 5;
  me.gold = 500;
  const before = house.unrest;
  const r = grantHonours(s, me.id, house.id);
  check(
    r.ok && house.unrest < before,
    `honours calm a restless house (${before} → ${house.unrest})`,
  );
}

if (failures) {
  console.log(`${failures} shock check(s) failed`);
  process.exit(1);
}
console.log('all shock checks OK');
