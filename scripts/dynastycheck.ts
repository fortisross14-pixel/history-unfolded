/** Headless checks of dynasties, governors, trinkets, civil war, democracy and building lines. */
import { CIVIL_WAR_TURNS, REVOLT_AT, TRINKET_PCT } from '../src/data/dynasties.ts';
import {
  assignGovernor,
  dynastyCap,
  dynastyTurn,
  giveTrinket,
  grantHonours,
  lineBonus,
  powerOf,
  rulerOf,
  yieldThrone,
  chooseSide,
} from '../src/engine/dynasty.ts';
import { cityEconomy, slotProblem } from '../src/engine/economy.ts';
import {
  deserialize,
  foundCity,
  housingLevyExtra,
  newGame,
  player,
  placeDistrict,
  serialize,
  settlersCost,
} from '../src/engine/game.ts';
import type { City, GameState } from '../src/engine/types.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};

const s: GameState = newGame({
  map: {
    type: 'pangaea',
    size: 'standard',
    seaLevel: 'normal',
    climate: 'normal',
    rainfall: 'normal',
    resources: 'normal',
    mountains: 'normal',
    seed: 11,
  },
  civCount: 6,
  playerName: 'Test',
});
const me = player(s);
check(
  Object.values(me.dynasties[0].traits).reduce((a, b) => a + (b ?? 0), 0) === 3,
  `the founding house is born with 3 points (${JSON.stringify(me.dynasties[0].traits)})`,
);
for (const c of s.civs) for (const d of c.dynasties) d.traits = {};
foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
const capital = s.cities.find(c => c.civId === me.id)!;

// ---- one house at the start
check(
  me.dynasties.length === 1 && me.ruling === me.dynasties[0].id,
  'one ruling house at the start',
);
check(dynastyCap(s, me) === 1, 'no new houses before the realm grows');

// ---- grow: three settlements in the second age bring two more houses
const others = s.cities.filter(c => c.civId !== me.id).slice(0, 2);
for (const c of others) c.civId = me.id;
me.techs.push('classical-age');
dynastyTurn(s, me);
check(
  me.dynasties.length === 3,
  `three houses in the Classical age with 3 settlements (${me.dynasties.length})`,
);
const [ruler, a, b] = me.dynasties;
check(rulerOf(me).id === ruler.id, 'the founding house still rules');

// ---- trinkets: a research trinket for the house governing a research town
const t1 = { id: s.nextId++, name: 'Astrolabe', line: 'research' as const };
const t2 = { id: s.nextId++, name: 'Star chart', line: 'research' as const };
me.trinkets.push(t1, t2);
check(
  giveTrinket(s, me.id, t1.id, a.id).ok && giveTrinket(s, me.id, t2.id, a.id).ok,
  'two trinkets to a house',
);
const town: City = others[0];
check(assignGovernor(s, me.id, town.id, a.id).ok, `House ${a.name} governs ${town.name}`);
check(
  lineBonus(s, town).research === 2 * TRINKET_PCT,
  `its research there: +${lineBonus(s, town).research}%`,
);
check(
  !lineBonus(s, capital).research,
  'no research bonus where it does not govern (the throne has none)',
);
const t3 = { id: s.nextId++, name: 'Ground lens', line: 'research' as const };
me.trinkets.push(t3);
giveTrinket(s, me.id, t3.id, ruler.id);
check(
  lineBonus(s, town).research === 2 * TRINKET_PCT + TRINKET_PCT / 2,
  'the throne lends half its trinkets to the whole realm',
);
// the bonus reaches the buildings
{
  const t = structuredClone(s);
  t.civs[me.id].techs.push('writing');
  const tc = t.cities.find(c => c.id === town.id)!;
  tc.pop = 20000;
  // a town (no rank bonus) with room for this district
  tc.tier = 'town';
  t.districts = t.districts.filter(
    d => d.cityId !== tc.id || d.slots.some(x => x.type === 'town-hall'),
  );
  const pd = placeDistrict(t, tc.id, 'Scholars', [
    'school',
    null,
    null,
    null,
    null,
    null,
    null,
    'houses',
    'houses',
  ]);
  const d = t.districts.find(x => x.id === pd.id)!;
  for (const x of d.slots) if (x.type) x.built = true;
  const sci = cityEconomy(t, tc).slots.get(d.id)![0].out.science;
  check(Math.abs(sci - 1.25) < 1e-6, `a school under that house makes 1.25 science (${sci})`);
}

// ---- power and unrest: a house holding more people than the throne grows restless
for (const c of s.cities) if (c.civId === me.id) c.pop = c === capital ? 2000 : 6000;
assignGovernor(s, me.id, others[1].id, a.id);
const p = powerOf(s, me);
check(
  p.get(a.id)!.share > p.get(ruler.id)!.share,
  'House governing two big towns outweighs the throne',
);
const u0 = a.unrest;
dynastyTurn(s, me);
check(a.unrest > u0, `its unrest rises (${u0} → ${Math.round(a.unrest)})`);
me.gold = 1000;
const before = a.unrest;
check(grantHonours(s, me.id, a.id).ok && a.unrest < before, 'honours calm it');
// push it over the edge: civil war
a.unrest = REVOLT_AT - 0.5;
const msgs = dynastyTurn(s, me);
check(!!me.civilWar && me.civilWar.rebel === a.id, 'at the limit it rises: civil war');
check(
  msgs.some(m => /Civil war/.test(m)),
  'the player is told',
);
check(!!me.civilWar?.pending, 'the realm waits for the player to choose a side');
check(!assignGovernor(s, me.id, town.id, b.id).ok, 'no reassigning until a side is chosen');
const saved = structuredClone(s);
const mineBefore = s.cities.filter(c => c.civId === me.id).length;
const rebelTowns = s.cities.filter(c => c.civId === me.id && c.governor === a.id).length;
// stand with the throne: the rebels' settlements break away as a realm at war
const side = chooseSide(s, me.id, ruler.id);
const rivalId = me.civilWar?.rival;
check(side.ok && rivalId !== undefined, 'choosing the throne splits the realm: ' + side.msg);
const rival = s.civs[rivalId!];
check(
  s.cities.filter(c => c.civId === rival.id).length === rebelTowns &&
    s.cities.filter(c => c.civId === me.id).length === mineBefore - rebelTowns,
  `the rebels hold their ${rebelTowns} settlements as the ${rival.name}`,
);
check(
  rival.dynasties.length === 1 && rival.ruling === a.id && !me.dynasties.some(d => d.id === a.id),
  'the rebel house rules the breakaway realm',
);
check(
  me.dynasties.some(d => d.id === b.id),
  'the other houses stay with the side the player chose',
);
check(
  s.wars.some(w => (w.a === me.id && w.b === rival.id) || (w.b === me.id && w.a === rival.id)),
  'the two realms are at war',
);
// the bigger army wins after the war's turns: give the throne the bigger army
for (const f of s.formations)
  if (f.civId === rival.id && f.kind === 'army') f.cohorts = f.cohorts.slice(0, 1);
const army = s.formations.find(f => f.civId === me.id && f.kind === 'army')!;
for (let k = 0; k < 6; k++) army.cohorts.push({ ...army.cohorts[0], id: s.nextId++ });
for (let k = 0; k < CIVIL_WAR_TURNS + 1 && me.civilWar; k++) {
  s.turn++;
  dynastyTurn(s, me);
}
check(!me.civilWar && !rival.alive, 'after the war the realm is one again');
check(
  rulerOf(me).id === ruler.id && s.cities.every(c => c.civId !== rival.id),
  'the throne, with the bigger army, keeps the crown and the breakaway settlements',
);
// a stalemate: armies within 10% of each other leave two realms
{
  const t = structuredClone(saved);
  const civ = t.civs[me.id];
  chooseSide(t, me.id, rulerOf(civ).id);
  const rv = t.civs[civ.civilWar!.rival!];
  // the same army on both sides
  const proto = t.formations.find(f => f.kind === 'army')!;
  t.formations = t.formations.filter(
    f => f.kind !== 'army' || (f.civId !== me.id && f.civId !== rv.id),
  );
  for (const [who, hex] of [
    [me.id, t.cities.find(c => c.civId === me.id)!.hex],
    [rv.id, t.cities.find(c => c.civId === rv.id)!.hex],
  ])
    t.formations.push({
      ...proto,
      id: t.nextId++,
      civId: who,
      hex,
      aboard: undefined,
      cohorts: proto.cohorts.map(c => ({ ...c, id: t.nextId++ })),
    });
  for (let k = 0; k < CIVIL_WAR_TURNS + 1 && civ.civilWar; k++) {
    t.turn++;
    dynastyTurn(t, civ);
  }
  check(
    !civ.civilWar && rv.alive && rv.splitFrom === undefined,
    'evenly matched armies: stalemate, two realms',
  );
  check(
    !t.wars.some(w => (w.a === me.id && w.b === rv.id) || (w.b === me.id && w.a === rv.id)),
    'and peace between them',
  );
}
// standing with the rebels: the old throne's settlements break away instead
{
  const t = structuredClone(saved);
  const civ = t.civs[me.id];
  const r = chooseSide(t, me.id, a.id);
  check(
    r.ok && civ.ruling === a.id,
    'standing with the rebels puts their house on the throne at once',
  );
  const rv = t.civs[civ.civilWar!.rival!];
  check(rv.ruling === ruler.id, `the old throne, House ${ruler.name}, holds the breakaway realm`);
}
{
  const t = structuredClone(saved);
  const r = yieldThrone(t, me.id);
  check(
    r.ok && rulerOf(t.civs[me.id]).id === a.id,
    'yielding before the split hands the throne over',
  );
}

// ---- democracy: the party with most people governs; bonuses shrink
{
  const t = structuredClone(saved);
  const civ = t.civs[me.id];
  civ.civilWar = undefined;
  civ.culture.taken.push('democracy');
  dynastyTurn(t, civ);
  const pw = powerOf(t, civ);
  const top = [...civ.dynasties].sort((x, y) => pw.get(y.id)!.people - pw.get(x.id)!.people)[0];
  check(civ.ruling === top.id, 'under Democracy the largest party rules');
  const tw = t.cities.find(c => c.id === town.id)!;
  check(
    (lineBonus(t, tw).research ?? 0) < 2 * TRINKET_PCT,
    `bonuses are smaller (+${lineBonus(t, tw).research}% research)`,
  );
}

// ---- building lines: one multiplier per district, one great building per realm
{
  const t = structuredClone(s);
  const civ = t.civs[me.id];
  civ.techs.push('electricity', 'renaissance-age', 'printing', 'education');
  const tc = t.cities.find(c => c.id === capital.id)!;
  tc.pop = 20000;
  tc.tier = 'city';
  tc.stockpile.electricity = 20;
  const pd = placeDistrict(t, tc.id, 'Sages', [
    'university',
    'university',
    'university',
    'laboratory',
    null,
    null,
    null,
    'houses',
    'houses',
  ]);
  const d = t.districts.find(x => x.id === pd.id)!;
  for (const x of d.slots) if (x.type) x.built = true;
  check(
    !!slotProblem(t, me.id, tc.hex, false, 'printing-house', d.id),
    'a second multiplier in a district is refused',
  );
  const base = () =>
    cityEconomy(t, tc)
      .slots.get(d.id)!
      .reduce((a2, x) => a2 + x.out.science, 0);
  const withLab = base();
  d.slots[4] = { type: 'academy', built: true, progress: 0, paid: true };
  const withAcademy = base();
  check(
    Math.abs(withAcademy - withLab * 3 - cityEconomy(t, tc).slots.get(d.id)![4].out.science) < 1e-6,
    `a great building triples the line (${withLab} → ${withAcademy}, +1.1 of its own, with the throne's trinket)`,
  );
  const other = t.cities.find(c => c.civId === me.id && c !== tc)!;
  check(
    /Only one in the realm/.test(slotProblem(t, me.id, other.hex, false, 'academy') ?? ''),
    'a second Academy of Sciences is refused',
  );
}

// ---- housing perks: spare housing cells mean bigger levies and cheaper settlers
{
  const t = structuredClone(s);
  const tc = t.cities.find(c => c.id === capital.id)!;
  const centre = t.districts.find(d => d.cityId === tc.id)!;
  check(
    housingLevyExtra(t, tc) === 0 && settlersCost(t, tc) === 1000,
    'no spare housing: plain levies, settlers 1,000',
  );
  for (const i of [0, 1, 2, 3, 5, 6])
    centre.slots[i] = { type: 'houses', built: true, progress: 0, paid: true };
  check(
    housingLevyExtra(t, tc) === 2 && settlersCost(t, tc) === 600,
    `four spare housing cells: +${housingLevyExtra(t, tc)} levy cohorts, settlers ${settlersCost(t, tc)}`,
  );
}

// ---- saves keep the houses
{
  const back = deserialize(serialize(s));
  check(
    back.civs[me.id].dynasties.length === me.dynasties.length &&
      back.civs[me.id].ruling === me.ruling,
    'houses survive a save',
  );
}

console.log(failures ? `${failures} failures` : 'all dynasty checks passed');
process.exit(failures ? 1 : 0);
