/** Headless checks of the core rules: setup, movement, merge, split, refit, levy, turns. */
import { DEFAULT_LOADOUT } from '../src/data/items.ts';
import { isRural } from '../src/data/slots.ts';
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
  capStores,
  powderNeed,
  cityDistricts,
  cityEconomy,
  civGoods,
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
  // plain numbers below: the houses start with no strengths
  for (const c of s.civs) for (const d of c.dynasties) d.traits = {};
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
    'pasture',
    'pasture',
    'pasture',
    'farm',
    'farm',
    'farm',
    'woodlot',
    'woodlot',
    'houses',
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
  capital.stockpile.wood = 50;
  for (let t = 0; t < 25; t++) endTurn(s);
  const built = farm.slots.filter(x => x.built).length;
  check(built >= 3, `${built} farm slots built after 25 turns`);
  const econ = cityEconomy(s, capital);
  void econ.slots;
  check(econ.workersUsed <= econ.workers, `workers ${econ.workersUsed}/${econ.workers}`);
  const lim = cityEconomy(s, capital).total.housing;
  check(capital.pop <= lim, `population ${capital.pop} within housing ${lim}`);

  // --- extraction: a little of anything anywhere, the land's goods for those who work them
  {
    const t = structuredClone(s);
    const tc = t.cities.find(c => c.id === capital.id)!;
    const td = t.districts.find(d => d.id === pd.id)!;
    const spot = landOf(t, tc).find(h => h !== tc.hex && isPassableLand(t.map, h))!;
    const others = landOf(t, tc).filter(h => h !== spot);
    for (const h of others) t.map.deposit[h] = null;
    t.civs[me.id].techs.push('mineralogy', 'mining', 'the-wheel');
    tc.pop = 20000;
    // every district needs its two housing cells: the last two
    const fill = (types: string[]) => {
      const all = [...types, ...Array(7 - types.length).fill(null), 'houses', 'houses'];
      for (let i = 0; i < 9; i++)
        td.slots[i] = all[i]
          ? { type: all[i], built: true, progress: 0, paid: true }
          : { type: null, built: false, progress: 0, paid: false };
    };
    const out = () => cityEconomy(t, tc).slots.get(td.id)!;
    const sum = (k: string) =>
      out().reduce((a, x) => a + (k === 'food' ? x.out.food : (x.out.goods[k] ?? 0)), 0);
    t.map.deposit[spot] = null;
    fill(['farm', 'farm']);
    check(Math.abs(sum('food') - 1) < 1e-6, `two plain farms give 1 food (${sum('food')})`);
    fill(['mine', 'mine']);
    check(Math.abs(sum('stone') - 1) < 1e-6, `two mines anywhere give 1 stone (${sum('stone')})`);
    t.map.deposit[spot] = { kind: 'coal', richness: 1 };
    fill(['mine', 'mine']);
    check(!sum('coal'), 'two mines next to coal dig no coal');
    check(/need 3 mines/.test(out()[0].note ?? ''), `the slot says why: "${out()[0].note}"`);
    fill(['mine', 'mine', 'mine']);
    check(sum('coal') === 3, `three mines next to coal: 3 coal (${sum('coal')})`);
    fill(['mine', 'mine', 'mine', 'mine', 'mine', 'mine', 'mine']);
    check(sum('coal') === 7, `seven mines: 7 coal a turn (${sum('coal')})`);
    // stores hold 8 per cell that makes a good, and 8 of anything per settlement
    {
      const n = t.cities.filter(c => c.civId === me.id).length;
      tc.stockpile.coal = 10000;
      capStores(t, me.id);
      const held = t.cities
        .filter(c => c.civId === me.id)
        .reduce((a, c) => a + (c.stockpile.coal ?? 0), 0);
      check(
        Math.abs(held - 8 * (7 + n)) < 1e-6,
        `7 coal mines store ${Math.round(held)} coal (8 × (7 + ${n}))`,
      );
    }
    // boosters: an infirmary adds ½ to everything each mine digs
    fill(['mine', 'mine', 'mine', 'infirmary']);
    t.civs[me.id].techs.push('tanning');
    check(
      sum('coal') === 4.5 && sum('stone') === 3,
      `an infirmary: 3 mines dig 4.5 coal and 3 stone (${sum('coal')}, ${sum('stone')})`,
    );
    // no housing, no work
    td.slots[7] = { type: null, built: false, progress: 0, paid: false };
    check(
      !sum('coal') && /housing/.test(out()[0].idle ?? ''),
      'a district without 2 houses stands idle',
    );
    t.map.deposit[spot] = { kind: 'pigs', richness: 1 };
    fill(['pasture', 'pasture']);
    check(sum('food') === 2, `two pastures by pigs: 2 food (${sum('food')})`);
    t.map.deposit[spot] = { kind: 'cattle', richness: 1 };
    check(
      sum('food') === 1 && sum('hides') === 2,
      `two pastures by cattle: 1 food and 2 leather (${sum('food')}, ${sum('hides')})`,
    );
    t.map.deposit[spot] = { kind: 'sheep', richness: 1 };
    check(sum('wool') === 2, `two pastures by sheep: 2 wool (${sum('wool')})`);
    // a workshop with no wood limps along at a third
    fill(['workshop']);
    for (const c of t.cities) if (c.civId === me.id) c.stockpile.wood = 0;
    const r0 = out()[0];
    check(
      r0.staffed && r0.rate < 0.5 && /Short of wood/.test(r0.note ?? ''),
      `short of wood, a workshop runs at a third (${r0.note})`,
    );
    // comforts: a luxury a turn per 4,000 people, variety adds gold and culture
    tc.pop = 8000;
    for (const c of t.cities)
      if (c.civId === me.id) c.stockpile = { sugar: 20, spices: 20, wood: 50 };
    const cm = cityEconomy(t, tc).comfort;
    check(
      cm.want === 2 && cm.got.sugar === 1 && cm.got.spices === 1 && cm.pct === 10,
      `8,000 people take two luxuries, one of each kind: +${cm.pct}%`,
    );
    for (const c of t.cities) if (c.civId === me.id) c.stockpile = { wood: 50 };
    check(cityEconomy(t, tc).comfort.pct === -10, 'no luxuries: −10% gold and culture');
    // cities burn coal, else wood
    tc.tier = 'city';
    for (const c of t.cities) if (c.civId === me.id) c.stockpile = { coal: 10, wood: 10 };
    const fu = cityEconomy(t, tc).fuel;
    check(
      fu.good === 'coal' && fu.need === 2,
      `a city of 8,000 burns 2 coal (${fu.need} ${fu.good})`,
    );
    for (const c of t.cities) if (c.civId === me.id) c.stockpile = { wood: 10 };
    check(cityEconomy(t, tc).fuel.good === 'wood', 'no coal: it burns wood');
    tc.tier = 'town';
    // a sale by the turn shows in both peoples' ledgers
    const buyer = t.civs.find(c => c.id !== me.id && c.alive)!;
    t.treaties.push({
      kind: 'trade',
      a: me.id,
      b: buyer.id,
      since: t.turn,
      until: t.turn + 20,
      aGives: { goodsPerTurn: { wool: 3 } },
      bGives: { goldPerTurn: 4 },
    });
    check(
      civGoods(t, me.id).wool?.traded === -3 && civGoods(t, buyer.id).wool?.traded === 3,
      'selling 3 wool a turn: −3 for us, +3 for them',
    );
    // a power plant burns oil first (4 electricity), else coal (3)
    t.civs[me.id].techs.push('electricity');
    fill(['power-plant']);
    for (const c of t.cities) if (c.civId === me.id) c.stockpile = { oil: 5, coal: 5 };
    check(
      Math.abs(sum('electricity') - 4) < 1e-6,
      `oil in the market: 4 electricity (${sum('electricity')})`,
    );
    for (const c of t.cities) if (c.civId === me.id) c.stockpile = { coal: 5 };
    check(
      Math.abs(sum('electricity') - 3) < 1e-6,
      `coal only: 3 electricity (${sum('electricity')})`,
    );
    // firearms burn powder by the turn
    const gunner = t.formations.find(f => f.civId === me.id && f.kind === 'army')!;
    for (const co of gunner.cohorts) co.loadout = { ...co.loadout, weapon: 'musket' };
    check(
      powderNeed(t, me.id) ===
        Math.round(gunner.cohorts.reduce((a, c) => a + 0.25 * (c.strength / 100), 0) * 10) / 10,
      `musketeers burn ${powderNeed(t, me.id)} saltpeter a turn`,
    );
    check(
      (civGoods(t, me.id).saltpeter?.used ?? 0) >= powderNeed(t, me.id),
      'powder shows in the goods ledger',
    );
    // the goods ledger: made − used + traded
    const lg = civGoods(t, me.id);
    check(
      Object.values(lg).every(l => Math.abs(l.net - (l.made - l.used + l.traded)) < 0.11),
      'goods ledger adds up',
    );
  }

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

  // --- boosters: 3 universities, a library adds ½ to each, a research lab doubles them
  {
    const t = structuredClone(s);
    const tc = t.cities.find(c => c.id === capital.id)!;
    const td = t.districts.find(d => d.id === pd.id)!;
    t.civs[me.id].techs.push('education', 'philosophy', 'electricity');
    // the library reads paper, the lab runs on electricity
    tc.stockpile.paper = 10;
    tc.stockpile.electricity = 10;
    tc.pop = 20000;
    const put = (i: number, type: string | null) =>
      (td.slots[i] = type
        ? { type, built: true, progress: 0, paid: true }
        : { type: null, built: false, progress: 0, paid: false });
    for (let i = 0; i < 9; i++) put(i, null);
    put(0, 'university');
    put(1, 'university');
    put(2, 'university');
    put(7, 'houses');
    put(8, 'houses');
    // the town is a town: no rank bonus, so the sums are plain
    const sci = () =>
      cityEconomy(t, tc)
        .slots.get(td.id)!
        .reduce((a, x) => a + x.out.science, 0);
    const base = sci();
    put(3, 'library');
    const lib = sci();
    put(4, 'laboratory');
    const lab = sci();
    check(
      Math.abs(lib - base - 1.5) < 1e-6 && Math.abs(lab - lib * 2) < 1e-6,
      `3 universities ${base} → with a library ${lib} → with a research lab ${lab}`,
    );
  }

  // --- town to city: needs people, gold and goods; farms give way; room for four districts
  {
    const t = structuredClone(s);
    const tc = t.cities.find(c => c.id === capital.id)!;
    check(!!upgradeInfo(t, tc).problem, 'a young town cannot become a city yet');
    tc.pop = 7000;
    t.civs[me.id].gold = 1000;
    check(/City Charter/.test(upgradeInfo(t, tc).problem ?? ''), 'a city needs the City Charter');
    t.civs[me.id].culture.taken.push('city-charter', 'seat-of-empire');
    // six housing cells across the town's districts
    const cen = cityDistricts(t, tc).find(isCentre)!;
    for (const i of [0, 1, 2, 3, 5, 6])
      cen.slots[i] = { type: 'houses', built: true, progress: 0, paid: true };
    tc.stockpile.stone = 100;
    tc.stockpile.wood = 100;
    const farmD = t.districts.find(d => d.id === pd.id)!;
    const rural = farmD.slots.filter(x => isRural(x.type)).length;
    const up = upgradeSettlement(t, tc.id);
    check(up.ok && tc.tier === 'city', 'the town becomes a city: ' + up.msg);
    check(
      farmD.slots.every(x => !isRural(x.type)) && farmD.slots.some(x => x.type) && rural > 0,
      `farms and woodcutters are pulled down, the houses stay (${rural} rural buildings)`,
    );
    check(!!slotProblem(t, me.id, tc.hex, false, 'grain-field'), 'a city cannot lay out fields');
    check(placeDistrict(t, tc.id, 'Library quarter', []).ok, 'a city takes a third district');
    check(placeDistrict(t, tc.id, 'Fourth', []).ok, '... and a fourth');
    for (const d of cityDistricts(t, tc).slice(2))
      for (const i of [7, 8]) d.slots[i] = { type: 'houses', built: true, progress: 0, paid: true };
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
  const popBefore = capital.pop;
  check(levy(s, capital.id).ok, 'raise 2nd levy');
  check(capital.pop === popBefore - 500, 'levy took 500 people');
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
