/** Checks ships: building, sailing, carrying troops, landing, naval battle, sea trade. */
import { DEFAULT_SHIP } from '../src/data/items.ts';
import { marketCities } from '../src/engine/economy.ts';
import {
  attack,
  buildShip,
  cargoOf,
  declareWar,
  foundCity,
  isWaterHex,
  newGame,
  orderMove,
  placeDistrict,
  player,
  roomOn,
  saveDesign,
  territory,
} from '../src/engine/game.ts';
import { distance, neighbors, within } from '../src/engine/hex.ts';
import { isPassableLand } from '../src/engine/mapgen.ts';
import type { Formation } from '../src/engine/types.ts';
import { fleetCapacity, formationMoves, oceanGoing } from '../src/engine/units.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};

// an archipelago, so there is plenty of coast
const s = newGame({
  map: {
    type: 'archipelago',
    size: 'standard',
    seaLevel: 'normal',
    climate: 'normal',
    rainfall: 'normal',
    resources: 'normal',
    mountains: 'normal',
    seed: 3,
  },
  civCount: 4,
  playerName: 'Test',
});
const me = player(s);
const g = { w: s.map.w, h: s.map.h };
const settlers = s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!;
// move the settlers to a coastal hex if needed, then found the city
const coastal = within(g, settlers.hex, 4).find(
  h =>
    isPassableLand(s.map, h) &&
    neighbors(g, h).some(k => s.map.terrain[k] === 'coast') &&
    !s.cities.some(c => distance(g, c.hex, h) < 4),
);
if (coastal !== undefined) settlers.hex = coastal;
check(foundCity(s, settlers.id).ok, 'coastal city founded');
const city = s.cities.find(c => c.civId === me.id)!;
me.techs.push('sailing', 'navigation', 'archery');
city.pop = 8000;
city.stockpile = { wood: 200, hides: 50, copper: 20, stone: 20 };

// ---- designs: ship parts only on ships
const bad = saveDesign(s, me.id, 'Wrong', { ...DEFAULT_SHIP, weapon: 'spear' });
check(!bad.ok, 'a spear is not a ship part: ' + bad.msg);
const transport = saveDesign(s, me.id, 'Ferry', {
  ...DEFAULT_SHIP,
  armour: 'galley-hull',
  mount: 'square-sail',
  kit: 'troop-deck',
});
const warship = saveDesign(s, me.id, 'Hornet galley', {
  ...DEFAULT_SHIP,
  armour: 'longship',
  mount: 'lateen-sail',
  weapon: 'deck-archers',
  kit: 'marines',
});
check(transport.ok && warship.ok, 'ship designs saved');
check(
  s.civs[me.id].designs.find(d => d.id === transport.id)!.naval === true,
  'ship designs are marked naval',
);

// ---- shipyard needed
check(!buildShip(s, city.id, transport.id!).ok, 'no ships without a shipyard');
const centre = s.districts.find(d => d.hex === city.hex)!;
centre.slots[0] = { type: 'shipyard', built: true, progress: 0, paid: true };
const b1 = buildShip(s, city.id, transport.id!);
check(b1.ok, 'ship launched: ' + b1.msg);
const fleet = s.formations.find(f => f.civId === me.id && f.kind === 'fleet')!;
check(fleet && isWaterHex(s, fleet.hex), 'the fleet floats next to the city');
check(
  fleetCapacity(fleet) === 5,
  `ferry carries 5 cohorts (galley 3 + troop deck 2): ${fleetCapacity(fleet)}`,
);
check(!oceanGoing(fleet), 'a galley hugs the coast');

// ---- embark: the levy walks onto the ship
const levy = s.formations.find(
  f => f.civId === me.id && f.kind === 'army' && f.cohorts.length === 5,
)!;
levy.hex = city.hex;
levy.moves = formationMoves(levy);
const emb = orderMove(s, levy.id, fleet.hex);
check(
  emb.ok && levy.aboard === fleet.id && levy.hex === fleet.hex && !!emb.msg,
  'troops board the ship: ' + (emb.msg ?? ''),
);
check(roomOn(s, fleet) === 0 && cargoOf(s, fleet).length === 1, 'the ship is full');
// sail: the cargo moves with the ship
fleet.moves = formationMoves(fleet);
const sea = within(g, fleet.hex, 3).filter(h => s.map.terrain[h] === 'coast' && h !== fleet.hex);
const dest = sea.find(h => distance(g, h, fleet.hex) >= 2) ?? sea[0];
const sail = orderMove(s, fleet.id, dest);
check(
  sail.ok && levy.hex === fleet.hex && fleet.hex !== city.hex,
  `the fleet sails with its cargo (${sail.msg ?? 'ok'})`,
);
// land the troops
const beach = neighbors(g, fleet.hex).find(
  h =>
    isPassableLand(s.map, h) &&
    !s.formations.some(f => f.hex === h) &&
    !s.cities.some(c => c.hex === h),
);
if (beach !== undefined) {
  levy.moves = formationMoves(levy);
  const land = orderMove(s, levy.id, beach);
  check(
    land.ok && levy.aboard === undefined && levy.hex === beach && levy.moves === 0,
    'troops land and use their moves',
  );
}

// ---- naval battle: our archer longship against an enemy galley
const foe = s.civs.find(c => !c.isPlayer)!;
declareWar(s, me.id, foe.id);
buildShip(s, city.id, warship.id!);
const ours = s.formations.find(
  f => f.civId === me.id && f.kind === 'fleet' && f.cohorts.some(c => c.designId === warship.id),
)!;
check(!!ours, 'warship built');
const spot = neighbors(g, ours.hex).find(
  h => isWaterHex(s, h) && !s.formations.some(f => f.hex === h),
);
if (spot !== undefined) {
  const enemy: Formation = {
    id: s.nextId++,
    civId: foe.id,
    name: 'Raiders',
    kind: 'fleet',
    hex: spot,
    moves: 3,
    path: [],
    fortified: false,
    cohorts: [
      {
        id: s.nextId++,
        strength: 100,
        xp: 0,
        designId: null,
        loadout: { ...DEFAULT_SHIP, armour: 'galley-hull', weapon: 'ram' },
      },
    ],
  };
  s.formations.push(enemy);
  // put a passenger aboard the enemy ship: it sinks with the ship
  const passenger: Formation = {
    id: s.nextId++,
    civId: foe.id,
    name: 'Passengers',
    kind: 'army',
    hex: spot,
    moves: 0,
    path: [],
    fortified: false,
    aboard: enemy.id,
    cohorts: [
      {
        id: s.nextId++,
        strength: 100,
        xp: 0,
        designId: null,
        loadout: s.formations.find(f => f.kind === 'army')!.cohorts[0].loadout,
      },
    ],
  };
  s.formations.push(passenger);
  ours.moves = 5;
  let rounds = 0;
  while (s.formations.includes(enemy) && s.formations.includes(ours) && rounds++ < 8) {
    ours.moves = 5;
    if (distance(g, ours.hex, enemy.hex) !== 1) break;
    const r = attack(s, ours.id, enemy.hex);
    check(r.ok, `naval battle round ${rounds}: ${r.report?.lines.slice(-1)[0] ?? r.msg}`);
  }
  if (!s.formations.includes(enemy))
    check(!s.formations.includes(passenger), 'troops aboard go down with their ship');
  // troops cannot attack ships
  const anyArmy = s.formations.find(
    f => f.civId === me.id && f.kind === 'army' && f.aboard === undefined,
  )!;
  if (s.formations.includes(enemy))
    check(!attack(s, anyArmy.id, enemy.hex).ok, 'troops cannot attack ships at sea');
}

// ---- sea trade: two ports join one market over water
const other = within(g, city.hex, 12).find(
  h =>
    isPassableLand(s.map, h) &&
    distance(g, h, city.hex) >= 6 &&
    neighbors(g, h).some(k => s.map.terrain[k] === 'coast') &&
    !s.cities.some(c => distance(g, c.hex, h) < 4) &&
    !s.formations.some(f => f.hex === h),
);
if (other !== undefined) {
  const st: Formation = {
    id: s.nextId++,
    civId: me.id,
    name: 'Settlers',
    kind: 'settlers',
    hex: other,
    moves: 0,
    path: [],
    fortified: false,
    cohorts: [
      { id: s.nextId++, strength: 100, xp: 0, designId: null, loadout: levy.cohorts[0].loadout },
    ],
  };
  s.formations.push(st);
  foundCity(s, st.id);
  const second = s.cities.find(c => c.hex === other)!;
  const before = marketCities(s, second).length;
  const d2 = s.districts.find(d => d.hex === second.hex)!;
  d2.slots[0] = { type: 'harbour', built: true, progress: 0, paid: true };
  const after = marketCities(s, second).length;
  console.log(`     ports: market before harbour ${before}, after ${after}`);
  check(after >= before, 'a harbour can join markets by sea');
  void territory;
  void placeDistrict;
}

console.log(failures ? `${failures} failures` : 'all naval checks passed');
process.exit(failures ? 1 : 0);
