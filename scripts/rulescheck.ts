/** Headless checks of the core rules: setup, movement, merge, split, refit, levy, turns. */
import { DEFAULT_LOADOUT } from '../src/data/items.ts';
import {
  cityAt,
  deserialize,
  endTurn,
  formationsAt,
  foundCity,
  levy,
  newGame,
  orderMove,
  player,
  assignDesign,
  endWar,
  placeDistrict,
  saveBlueprint,
  setSlot,
  stepCost,
  canFoundCity,
  trainSettlers,
  upgradeInfo,
  upgradeSettlement,
  atWar,
  attack,
  declareWar,
  previewBattle,
  saveDesign,
  serialize,
  setResearch,
} from '../src/engine/game.ts';

import { isPassableLand } from '../src/engine/mapgen.ts';
import { distance, neighbors, within } from '../src/engine/hex.ts';
import { findPath } from '../src/engine/path.ts';
import {
  cityDistricts,
  cityEconomy,
  invalidateMarkets,
  isCentre,
  landOf,
  shareFood,
  marketCities,
  marketStock,
  slotProblem,
} from '../src/engine/economy.ts';
import type { GameState } from '../src/engine/types.ts';
import { formationMoves, groupCohorts, outdated, people } from '../src/engine/units.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};

for (const seed of [1, 2, 3, 42]) {
  console.log(`-- seed ${seed}`);
  const s: GameState = newGame({
    map: {
      type: 'random',
      size: 'standard',
      seaLevel: 'normal',
      climate: 'normal',
      rainfall: 'normal',
      resources: 'normal',
      mountains: 'normal',
      seed,
    },
    civCount: 6,
    playerName: 'Test',
  });
  const me = player(s);
  check(s.civs.length === 6, '6 civs');
  check(s.cities.length === 5, 'AI civs founded their capitals');
  const mine = () => s.formations.filter(f => f.civId === me.id);
  check(mine().length === 3, 'player starts with settlers, levy, scouts');
  const settlers = mine().find(f => f.kind === 'settlers')!;
  const r = foundCity(s, settlers.id);
  check(r.ok, 'found capital: ' + r.msg);
  const capital = cityAt(s, settlers.hex)!;
  const levy1 = mine().find(f => f.name === '1st Levy')!;
  check(levy1.cohorts.length === 5, 'levy has 5 cohorts (500 people)');

  // --- districts: the centre exists, a farm district is laid out inside the town and gets built
  const centreD = cityDistricts(s, capital).find(isCentre);
  check(
    !!centreD && centreD.slots[4].type === 'town-hall' && centreD.slots[4].built,
    'centre district with town hall',
  );
  check(capital.tier === 'town', 'a new settlement is a town');
  check(
    landOf(s, capital).includes(capital.hex) && landOf(s, capital).length <= 7,
    `the town works its hex and the ring around it (${landOf(s, capital).length} hexes)`,
  );
  const farmSlots = [
    'pig-pen',
    'pig-pen',
    'pig-pen',
    'pig-pen',
    'grain-field',
    'pig-pen',
    'cattle-pasture',
    'cattle-pasture',
    'woodlot',
  ];
  const pd = placeDistrict(s, capital.id, 'Farm', farmSlots);
  check(pd.ok, 'place a "Farm" district: ' + pd.msg);
  const farm = s.districts.find(d => d.id === pd.id)!;
  const bp = saveBlueprint(
    s,
    me.id,
    'Farm',
    farm.slots.map(x => x.type),
  );
  check(bp.ok && me.blueprints.length === 1, 'save the layout as a blueprint');
  check(!placeDistrict(s, capital.id, 'Again', []).ok, 'a town holds two districts');
  void slotProblem;
  check(!setSlot(s, centreD!.id, 4, 'houses').ok, 'the town hall cannot be replaced');
  // grain next to pigs: the pig pen at index 1 or 3 or 5 or 7 borders the grain field at 4
  capital.stockpile.wood = 50;
  for (let t = 0; t < 25; t++) endTurn(s);
  const built = farm.slots.filter(x => x.built).length;
  check(built >= 3, `${built} farm slots built after 25 turns`);
  const econ = cityEconomy(s, capital);
  const rep = econ.slots.get(farm.id)!;
  const pigNextToGrain = [1, 3, 5, 7].find(
    i => farm.slots[i].built && farm.slots[i].type === 'pig-pen' && farm.slots[4].built,
  );
  if (pigNextToGrain !== undefined) {
    const lone = [0, 2].find(i => farm.slots[i].built && farm.slots[i].type === 'pig-pen');
    if (lone !== undefined && rep[lone].staffed && rep[pigNextToGrain].staffed)
      check(rep[pigNextToGrain].out.food > rep[lone].out.food, 'pigs next to grain make more food');
  }
  check(econ.workersUsed <= econ.workers, `workers ${econ.workersUsed}/${econ.workers}`);
  const lim = cityEconomy(s, capital).total.housing;
  check(capital.pop <= lim, `population ${capital.pop} within housing ${lim}`);

  // --- spacing: settlements may not touch, one hex between is fine
  {
    const g1 = { w: s.map.w, h: s.map.h };
    const probe = { ...mine().find(f => f.kind === 'army')!, kind: 'settlers' as const };
    const next = neighbors(g1, capital.hex).find(h => isPassableLand(s.map, h))!;
    check(!!canFoundCity(s, { ...probe, hex: next }), 'no town right next to another');
    const two = within(g1, capital.hex, 2).find(
      h =>
        distance(g1, h, capital.hex) === 2 &&
        isPassableLand(s.map, h) &&
        !s.cities.some(c => c !== capital && distance(g1, c.hex, h) < 2),
    );
    if (two !== undefined)
      check(canFoundCity(s, { ...probe, hex: two }) === null, 'a town two hexes away is fine');
  }

  // --- district synergy: a second school in the same district makes each one better
  {
    const t = structuredClone(s);
    const tc = t.cities.find(c => c.id === capital.id)!;
    const td = cityDistricts(t, tc).find(isCentre)!;
    t.civs[me.id].techs.push('writing');
    tc.pop = 20000;
    const put = (i: number) =>
      (td.slots[i] = { type: 'school', built: true, progress: 0, paid: true });
    put(0);
    const one = cityEconomy(t, tc).slots.get(td.id)![0].out.science;
    put(2);
    const two = cityEconomy(t, tc).slots.get(td.id)![0].out.science;
    check(two > one, `schools together work better (${one} → ${two} science each)`);
  }

  // --- town to city: needs people, gold and goods; farms give way; room for four districts
  {
    const t = structuredClone(s);
    const tc = t.cities.find(c => c.id === capital.id)!;
    check(!!upgradeInfo(t, tc).problem, 'a young town cannot become a city yet');
    tc.pop = 7000;
    t.civs[me.id].gold = 1000;
    tc.stockpile.stone = 100;
    tc.stockpile.wood = 100;
    const farmD = t.districts.find(d => d.id === pd.id)!;
    const rural = farmD.slots.filter(x => x.type).length;
    const up = upgradeSettlement(t, tc.id);
    check(up.ok && tc.tier === 'city', 'the town becomes a city: ' + up.msg);
    check(
      farmD.slots.every(x => !x.type) && rural > 0,
      `the farm district is cleared (${rural} rural buildings pulled down)`,
    );
    check(!!slotProblem(t, me.id, tc.hex, false, 'grain-field'), 'a city cannot lay out fields');
    check(placeDistrict(t, tc.id, 'Library quarter', []).ok, 'a city takes a third district');
    check(placeDistrict(t, tc.id, 'Fourth', []).ok, '... and a fourth');
    check(!placeDistrict(t, tc.id, 'Fifth', []).ok, 'but not a fifth');
    // one metropolis per people
    tc.pop = 16000;
    tc.stockpile.stone = 100;
    tc.stockpile.wood = 100;
    check(
      upgradeSettlement(t, tc.id).ok && tc.tier === 'metropolis',
      'the city becomes a metropolis',
    );
    const other = t.cities.find(c => c.civId !== me.id)!;
    other.civId = me.id;
    other.tier = 'city';
    other.pop = 16000;
    check(
      /only one metropolis/.test(upgradeInfo(t, other).problem ?? ''),
      'a second metropolis is refused',
    );
    // towns feed cities in their market
    const fed = shareFood(
      t,
      new Map([
        [tc.id, -6],
        [other.id, 10],
      ]),
    );
    const joined = marketCities(t, tc).includes(other);
    check(
      !joined || (fed.get(tc.id)! >= 0 && fed.get(other.id)! === 4),
      'a town in the market covers a city short of food',
    );
  }

  // --- roads and markets: a second city joined by a road shares its store
  const g0 = { w: s.map.w, h: s.map.h };
  const far = within(g0, capital.hex, 5).find(
    h =>
      distance(g0, h, capital.hex) === 4 &&
      isPassableLand(s.map, h) &&
      !s.cities.some(c => distance(g0, c.hex, h) < 4) &&
      !s.formations.some(f => f.hex === h),
  );
  if (far !== undefined) {
    const settlers2 = (trainSettlers(s, capital.id), mine().find(f => f.kind === 'settlers'));
    if (!settlers2) capital.pop += 3000;
    const st2 =
      settlers2 ?? (trainSettlers(s, capital.id), mine().find(f => f.kind === 'settlers'))!;
    st2.hex = far;
    check(foundCity(s, st2.id).ok, 'second city founded');
    const second = cityAt(s, far)!;
    const path = findPath(g0, capital.hex, far, (_a, b) =>
      isPassableLand(s.map, b) ? 1 : Infinity,
    )!;
    const before = marketCities(s, second).length;
    for (const h of path) s.roads[h] = 1;
    invalidateMarkets();
    check(
      marketCities(s, second).length >= 2 && before >= 1,
      `road joins ${second.name} to ${capital.name}'s market`,
    );
    second.stockpile = {};
    capital.stockpile.hides = 7;
    check((marketStock(s, second).hides ?? 0) >= 7, 'the second city sees the shared store');
    // marching along the road costs half a move per hex
    const walker = mine().find(f => f.kind === 'army')!;
    check(stepCost(s, walker, path[0], path[1]) === 0.5, 'road step costs half a move');
    // an enemy at war standing on the road cuts the market
    const foe = s.civs.find(c => c.id !== me.id)!;
    declareWar(s, me.id, foe.id);
    const cut = path[Math.floor(path.length / 2)];
    const blocker = s.formations.find(f => f.civId === foe.id && f.kind === 'army')!;
    const oldHex = blocker.hex;
    blocker.hex = cut;
    invalidateMarkets();
    const riverLink = s.map.river[cut] === 1;
    if (!path.some(h => s.map.river[h]))
      check(
        marketCities(s, second).length === 1 || riverLink,
        'an enemy on the road splits the market',
      );
    blocker.hex = oldHex;
    invalidateMarkets();
    endWar(s, me.id, foe.id);
  }

  // raise a second levy and merge it by moving onto the first
  check(levy(s, capital.id).ok, 'raise 2nd levy');
  check(capital.pop === 1500, 'levy took 500 people');
  const levy2 = mine().find(f => f.name === '2nd Levy')!;
  endTurn(s);
  const mv = orderMove(s, levy2.id, levy1.hex);
  check(
    mv.ok && !s.formations.includes(levy2) && levy1.cohorts.length === 10,
    'moving onto a friendly formation merges (10 cohorts): ' + (mv.msg ?? ''),
  );

  // the scouts cannot join: over the cap
  const scouts = mine().find(f => f.name === 'Scouts')!;
  const toCap = orderMove(s, scouts.id, levy1.hex);
  check(!toCap.ok, 'merge past the command cap is refused');

  // design two unit types and split one 500-man levy between them: 200 + 300
  capital.pop += 2000;
  const lv = levy(s, capital.id);
  const levy3 = mine().find(f => f.name === '3rd Levy');
  if (!levy3)
    console.log(
      lv.msg,
      mine().map(f => f.name),
    );
  capital.stockpile = { wood: 20, hides: 20, stone: 10 };
  check(!!levy3 && levy3.cohorts.length === 5, 'third levy raised in the capital');
  const hop = saveDesign(s, me.id, 'Foot Falcons', {
    ...DEFAULT_LOADOUT,
    weapon: 'spear',
    shield: 'hide-shield',
    armour: 'padded',
    boots: 'sandals',
  });
  const sl = saveDesign(s, me.id, 'Stone Hail', {
    ...DEFAULT_LOADOUT,
    weapon: 'sling',
    armour: 'padded',
  });
  check(hop.ok && sl.ok, 'two designs saved: ' + hop.msg + ' / ' + sl.msg);
  const dup = saveDesign(s, me.id, 'foot falcons', DEFAULT_LOADOUT);
  check(!dup.ok, 'duplicate design names refused');
  const locked = saveDesign(s, me.id, 'Bowmen', { ...DEFAULT_LOADOUT, weapon: 'bow' });
  check(!locked.ok, 'bow design needs Archery: ' + locked.msg);
  const twoH = saveDesign(s, me.id, 'X', {
    ...DEFAULT_LOADOUT,
    weapon: 'sling',
    shield: 'hide-shield',
  });
  check(twoH.ok, 'sling with shield is allowed');
  const ids = levy3!.cohorts.map(c => c.id);
  const a1 = assignDesign(s, levy3!.id, ids.slice(0, 2), hop.id!);
  const a2 = assignDesign(s, levy3!.id, ids.slice(2), sl.id!);
  check(a1.ok && a2.ok, `200 Foot Falcons + 300 Stone Hail: ${a1.msg} ${a2.msg}`);
  const groups = groupCohorts(levy3!);
  check(
    groups.length === 2 &&
      groups.some(g => g.cohorts.length === 2) &&
      groups.some(g => g.cohorts.length === 3),
    'formation shows two groups (2 and 3 cohorts)',
  );
  check((capital.stockpile.wood ?? 0) < 20, 'gear was paid from the city store');
  // editing a design marks equipped cohorts as outdated until re-equipped
  saveDesign(
    s,
    me.id,
    'Foot Falcons',
    { ...DEFAULT_LOADOUT, weapon: 'spear', shield: 'wicker-shield' },
    hop.id,
  );
  check(
    outdated(
      me,
      groups.find(g => g.designId === hop.id)!,
    ),
    'edited design: equipped cohorts flagged outdated',
  );

  // --- combat: declare war on a neighbour and attack its capital guard
  const enemyCity = s.cities.find(c => c.civId !== me.id)!;
  const enemy = s.civs[enemyCity.civId];
  const g = { w: s.map.w, h: s.map.h };
  const spot = neighbors(g, enemyCity.hex).find(
    n => isPassableLand(s.map, n) && !formationsAt(s, n).length && !s.cities.some(c => c.hex === n),
  );
  if (spot !== undefined) {
    levy3!.hex = spot;
    levy3!.moves = 2;
    // empty the city so the guard defends
    s.formations = s.formations.filter(f => !(f.hex === enemyCity.hex && f.civId === enemy.id));
    const peace = attack(s, levy3!.id, enemyCity.hex);
    check(!peace.ok, 'cannot attack while at peace: ' + peace.msg);
    check(declareWar(s, me.id, enemy.id).ok && atWar(s, me.id, enemy.id), 'war declared');
    const pv = previewBattle(s, levy3!.id, enemyCity.hex);
    check(!!pv && pv.lines.length > 0, 'battle preview: ' + pv?.lines.join(' | '));
    const before = people(levy3!);
    const r = attack(s, levy3!.id, enemyCity.hex);
    check(r.ok && !!r.report, 'attack resolves: ' + r.report?.lines.join(' | '));
    check(
      !s.formations.includes(levy3!) || people(levy3!) <= before,
      'attacker took losses or died',
    );
    check(levy3!.moves === 0, 'attacking uses all moves');
    // keep attacking with fresh troops until the city falls
    for (let k = 0; k < 6 && enemyCity.civId === enemy.id; k++) {
      const f = s.formations.find(x => x.id === levy3!.id) ?? levy3!;
      if (!s.formations.includes(f)) break;
      f.moves = 2;
      for (const c of f.cohorts) c.strength = 100;
      if (f.hex === enemyCity.hex) break;
      attack(s, f.id, enemyCity.hex);
    }
    check(
      enemyCity.civId === me.id,
      `${enemyCity.name} captured (now ${s.civs[enemyCity.civId].name})`,
    );
    check(
      !enemy.alive ||
        s.cities.some(c => c.civId === enemy.id) ||
        s.formations.some(f => f.civId === enemy.id && f.kind === 'settlers'),
      'elimination is consistent',
    );
  }

  // research and a few turns
  check(setResearch(s, me.id, 'archery').ok, 'research Archery');
  let learned = false;
  for (let t = 0; t < 30 && !learned; t++) {
    endTurn(s);
    learned = me.techs.includes('archery');
  }
  check(learned, `Archery learned by turn ${s.turn}`);

  // movement points: mounted cohorts are faster, a mixed formation moves at the slowest
  const fake = {
    ...levy1,
    cohorts: [
      { ...levy1.cohorts[0], loadout: { ...DEFAULT_LOADOUT, mount: 'horse' } },
      levy1.cohorts[1],
    ],
  };
  check(formationMoves(fake) === 2, 'mixed horse + foot formation moves 2');

  // nothing stands on water or mountains, nothing shares a hex with foreigners
  const okHexes = s.formations.every(
    f => f.kind === 'fleet' || f.aboard !== undefined || isPassableLand(s.map, f.hex),
  );
  check(okHexes, 'all formations on passable land');
  const mixed = s.formations.some(f => formationsAt(s, f.hex).some(o => o.civId !== f.civId));
  check(!mixed, 'no hex shared between peoples');

  // a long game with the AI: no crashes, invariants hold
  for (let t = 0; t < 150; t++) endTurn(s);
  const water = (h: number) => ['coast', 'ocean', 'lake'].includes(s.map.terrain[h]);
  const bad2 = s.formations.filter(
    f =>
      f.cohorts.length === 0 ||
      (f.kind === 'fleet' || f.aboard !== undefined
        ? !water(f.hex) && !s.cities.some(c => c.hex === f.hex)
        : !isPassableLand(s.map, f.hex)) ||
      (f.aboard !== undefined && s.formations.find(o => o.id === f.aboard)?.hex !== f.hex),
  );
  for (const f of bad2)
    console.log(
      '     invalid:',
      f.name,
      'civ',
      f.civId,
      s.civs[f.civId].isPlayer,
      JSON.stringify(s.civs[f.civId].sea),
      f.kind,
      f.aboard,
      s.map.terrain[f.hex],
      s.map.relief[f.hex],
      f.cohorts.length,
    );
  check(!bad2.length, `after turn ${s.turn}: ${s.formations.length} formations, all valid`);
  check(
    !s.formations.some(f => formationsAt(s, f.hex).some(o => o.civId !== f.civId)),
    'still no hex shared between peoples',
  );
  check(
    s.formations.every(f => f.cohorts.every(c => c.strength > 0 && c.strength <= 100)),
    'cohort strengths within 1..100',
  );
  const aiCities = s.cities.filter(c => c.civId !== me.id).length;
  const aiDesigns = s.civs.filter(c => !c.isPlayer).reduce((n, c) => n + c.designs.length, 0);
  const equipped = s.formations
    .filter(f => f.civId !== me.id)
    .flatMap(f => f.cohorts)
    .filter(c => c.designId !== null).length;
  console.log(
    `     AI: ${aiCities} cities, ${aiDesigns} designs, ${equipped} equipped cohorts, wars so far: ${s.log.filter(e => e.text.includes('declared war')).length}, battles: ${s.log.filter(e => e.text.startsWith('Battle')).length}`,
  );
  check(aiCities > 0 && aiDesigns > 0, 'AI expands and designs troops');

  const back = deserialize(serialize(s));
  check(back.turn === s.turn && back.formations.length === s.formations.length, 'save round-trip');
}
console.log(failures ? `${failures} failures` : 'all rules checks passed');
process.exit(failures ? 1 : 0);
