/**
 * Headless checks of the builders: crews by settlement size, one order takes the whole crew, two
 * share it, pausing one speeds the other, production speeds building, an empty queue is fine,
 * older saves get their planned plots queued, and centre improvements build and work.
 * Usage: node --no-warnings scripts/buildcheck.ts
 */
import {
  build,
  builderCrews,
  builderPlan,
  buildPreview,
  centreProblem,
  centreRow,
  cityDistricts,
  cityEconomy,
  cityQueue,
  constructionQueue,
  emptySlot,
  isCentre,
  planCentre,
  queueMove,
  queuePause,
  queueRemove,
  turnsToBuild,
} from '../src/engine/economy.ts';
import {
  cityWalls,
  deserialize,
  endTurn,
  foundCity,
  newGame,
  player,
  serialize,
  setSlot,
} from '../src/engine/game.ts';
import { SLOT_TYPES } from '../src/data/slots.ts';
import type { City, GameState } from '../src/engine/types.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};
const fresh = (seed = 8): GameState =>
  newGame({
    map: {
      type: 'pangaea',
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
const s = fresh();
const me = player(s);
foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
const c = s.cities.find(x => x.civId === me.id)!;
const centre = cityDistricts(s, c).find(isCentre)!;
const rich = (x: City) =>
  Object.assign(x.stockpile, { wood: 200, stone: 200, steel: 50, coal: 50 });
rich(c);
// a clean centre: the town hall, two houses built, the rest empty
for (let i = 0; i < 9; i++) if (centre.slots[i].type !== 'town-hall') centre.slots[i] = emptySlot();
centre.slots.length = 9;
centre.slots[0] = { type: 'houses', built: true, progress: 10, paid: true };
centre.slots[2] = { type: 'houses', built: true, progress: 10, paid: true };
c.queue = [];

// ---- crews by size
const crewsOf = (t: City['tier']) => builderCrews({ ...c, tier: t });
check(
  crewsOf('settlement') === 1 &&
    crewsOf('town') === 2 &&
    crewsOf('large-town') === 3 &&
    crewsOf('city') === 4 &&
    crewsOf('metropolis') === 6,
  `builders: 100 a size step (settlement ${crewsOf('settlement') * 100}, town ${crewsOf('town') * 100}, city ${crewsOf('city') * 100}, metropolis ${crewsOf('metropolis') * 100})`,
);
c.tier = 'large-town'; // 300 builders
c.pop = 6000;

// ---- an empty queue is fine
check(
  build(s, c, 10).length === 0 && !constructionQueue(s, c).length,
  'nothing queued: nothing built, nothing breaks',
);
check(builderPlan(s, c, 10).busy === 0, 'nothing queued: no builders busy');

// ---- one order gets the whole crew
setSlot(s, centre.id, 1, 'houses');
let p = builderPlan(s, c, 6);
check(
  p.lines.length === 1 && p.lines[0].builders === 300 && p.lines[0].perTurn === 6,
  `one order: all 300 builders, the whole production (${p.lines[0]?.builders} builders, +${p.lines[0]?.perTurn})`,
);
build(s, c, 6);
check(
  centre.slots[1].progress === 6,
  `it rises by the production (${centre.slots[1].progress}/10)`,
);

// ---- two orders share it
setSlot(s, centre.id, 3, 'houses');
p = builderPlan(s, c, 6);
check(
  p.lines.length === 2 && p.lines.every(l => l.builders === 150 && l.perTurn === 3),
  `two orders: 150 builders and half the production each (${p.lines.map(l => `${l.builders}/+${l.perTurn}`).join(', ')})`,
);
check(p.busy === 300 && p.builders === 300, 'builders 300/300 busy');
build(s, c, 6);
check(
  centre.slots[3].progress === 3 && centre.slots[1].progress === 9,
  `each got half (${centre.slots[1].progress}, ${centre.slots[3].progress})`,
);

// ---- pause one: the other goes faster
const q = cityQueue(s, c);
check(q.length === 2 && q[0].slot === 1 && q[1].slot === 3, 'the queue keeps the order planned');
queuePause(s, c, 0, true);
p = builderPlan(s, c, 6);
check(
  p.lines[0].state === 'paused' && p.lines[1].builders === 300 && p.lines[1].perTurn === 6,
  'paused: its builders go to the other',
);
build(s, c, 6);
check(
  centre.slots[3].progress === 9 && centre.slots[1].progress === 9,
  'the paused one waits, the other gets it all',
);
queuePause(s, c, 0, false);
check(queueMove(s, c, 1, -1).ok && cityQueue(s, c)[0].slot === 3, 'an order moves up the queue');

// ---- more orders than crews: the rest wait
setSlot(s, centre.id, 5, 'houses');
setSlot(s, centre.id, 6, 'houses');
p = builderPlan(s, c, 6);
check(
  p.lines.filter(l => l.state === 'building').length === 3 && p.lines[3].state === 'waiting',
  'never more orders going than crews (3 crews, the 4th waits)',
);
// a crew that finishes moves on in the same turn
const done = build(s, c, 12);
check(done.length === 2, `two finish, their crews start on the next (${done.length} finished)`);
check(cityQueue(s, c).length === 2, 'finished orders leave the queue');

// ---- cancelling gives the goods back
const wood = c.stockpile.wood;
const at = cityQueue(s, c).findIndex(o => o.slot === 6);
const paid = centre.slots[6].paid;
check(
  queueRemove(s, c, at).ok && !centre.slots[6].type && c.stockpile.wood === wood + (paid ? 2 : 0),
  'a cancelled order clears its plot and returns its goods',
);
check(cityQueue(s, c).length === 1, 'and leaves the queue');
queueRemove(s, c, 0);

// ---- production speeds building: a workshop, and the realm's production bonus
const tw = () => turnsToBuild(s, c, 'houses', cityEconomy(s, c).total.prod);
me.techs.push('pottery', 'masonry', 'bronze-working', 'archery', 'the-wheel');
const before = tw();
const prodBefore = cityEconomy(s, c).total.prod;
centre.slots[7] = { type: 'workshop', built: true, progress: 12, paid: true };
centre.slots[8] = { type: 'workshop', built: true, progress: 12, paid: true };
const after = tw();
check(
  cityEconomy(s, c).total.prod > prodBefore && after! <= before!,
  `workshops raise production (${prodBefore} → ${cityEconomy(s, c).total.prod}) and build faster (${before} → ${after} turns for houses)`,
);
check(
  (turnsToBuild(s, c, 'castle', 20) ?? 99) < (turnsToBuild(s, c, 'castle', 10) ?? 0),
  'twice the production, fewer turns',
);

// ---- centre improvements
check(!centreProblem(s, c, 'market'), 'a market can go in the centre row');
const goldBefore = cityEconomy(s, c).total.gold;
const prev = buildPreview(s, c, 'market');
check(
  prev.after.gold > prev.before.gold && prev.before.gold === goldBefore,
  `preview: gold ${prev.before.gold} → ${prev.after.gold}`,
);
// a market planned on a plot (a blueprint, a governor) moves to the centre row
check(!!setSlot(s, centre.id, 1, 'market').msg, 'a market on a plot is flagged');
cityQueue(s, c);
check(
  !centre.slots[1].type && centreRow(s, c).length === 1 && cityQueue(s, c).length === 1,
  'and moves to the centre row, queued',
);
check(!planCentre(s, c, 'market').ok, 'one market per settlement');
for (let k = 0; k < 10 && !centreRow(s, c)[0].st.built; k++) build(s, c, 5);
check(centreRow(s, c)[0].st.built, 'the market is built');
check(
  cityEconomy(s, c).total.gold > goldBefore,
  `it pays (${goldBefore} → ${cityEconomy(s, c).total.gold} gold)`,
);
check(planCentre(s, c, 'palisade').ok, 'a palisade is queued');
for (let k = 0; k < 10 && cityQueue(s, c).length; k++) build(s, c, 5);
check(cityWalls(s, c).walls === SLOT_TYPES.palisade.walls, 'the palisade guards the town');
check(!!centreProblem(s, c, 'palisade'), 'no second palisade');
check(planCentre(s, c, 'walls').ok, 'stone walls are queued');
for (let k = 0; k < 20 && cityQueue(s, c).length; k++) build(s, c, 5);
check(
  cityWalls(s, c).walls === SLOT_TYPES.walls.walls &&
    !centreRow(s, c).some(e => e.st.type === 'palisade'),
  'the walls replace the palisade',
);
check(!!centreProblem(s, c, 'palisade'), 'no palisade behind stone walls');
check(
  planCentre(s, c, 'barracks').ok && planCentre(s, c, 'monument').ok,
  'barracks and a monument',
);
const cultureBefore = cityEconomy(s, c).total.culture;
for (let k = 0; k < 20 && cityQueue(s, c).length; k++) build(s, c, 5);
check(
  centreRow(s, c).every(e => e.st.built) && cityEconomy(s, c).total.culture > cultureBefore,
  `the centre row stands; the monument adds culture (${cultureBefore} → ${cityEconomy(s, c).total.culture})`,
);
check(
  planCentre(s, c, 'armoury').ok && queueRemove(s, c, cityQueue(s, c).length - 1).ok,
  'a centre order can be cancelled',
);
check(!centreRow(s, c).some(e => e.st.type === 'armoury'), 'and leaves the centre row');

// ---- an older save: planned plots queued in the old order, centre buildings moved to the row
{
  const o = fresh(11);
  const om = player(o);
  foundCity(o, o.formations.find(f => f.civId === om.id && f.kind === 'settlers')!.id);
  const oc = o.cities.find(x => x.civId === om.id)!;
  rich(oc);
  om.techs.push('pottery', 'masonry', 'the-wheel');
  const od = cityDistricts(o, oc).find(isCentre)!;
  for (let i = 0; i < 9; i++) if (od.slots[i].type !== 'town-hall') od.slots[i] = emptySlot();
  od.slots.length = 9;
  od.slots[0] = { type: 'workshop', built: false, progress: 0, paid: false };
  od.slots[1] = { type: 'market', built: true, progress: 12, paid: true };
  od.slots[2] = { type: 'houses', built: false, progress: 0, paid: false };
  od.slots[3] = { type: 'walls', built: false, progress: 5, paid: true };
  od.slots[5] = { type: 'houses', built: false, progress: 0, paid: false };
  const json = JSON.parse(serialize(o));
  for (const x of json.state.cities) delete x.queue;
  const back = deserialize(JSON.stringify(json));
  const bc = back.cities.find(x => x.id === oc.id)!;
  check(bc.queue === undefined, 'an older save has no queue');
  const bq = cityQueue(back, bc);
  const names = bq.map(x => x.type);
  check(
    names[0] === 'houses' && names[1] === 'houses' && names.includes('workshop'),
    `its planned plots are queued, housing first as before (${names.join(', ')})`,
  );
  const row = centreRow(back, bc);
  check(
    row.some(e => e.st.type === 'market' && e.st.built) &&
      row.some(e => e.st.type === 'walls' && e.st.progress === 5),
    'its market and walls move to the centre row, built and half-built as they were',
  );
  const bd = cityDistricts(back, bc).find(isCentre)!;
  check(!bd.slots[1].type && !bd.slots[3].type, 'their plots are free again');
  check(names.includes('walls'), 'the half-built walls stay queued');
  const r2 = deserialize(serialize(back));
  check(
    JSON.stringify(
      cityQueue(
        r2,
        r2.cities.find(x => x.id === oc.id)!,
      ),
    ) === JSON.stringify(bq),
    'the queue saves and loads',
  );
}

// ---- the AI and governors keep building
{
  const a = fresh(23);
  const builtNow = () =>
    a.districts.reduce((n, d) => n + d.slots.filter(x => x.built && x.type).length, 0);
  const b0 = builtNow();
  for (let t = 0; t < 60; t++) endTurn(a);
  const rows = a.cities.reduce((n, x) => n + centreRow(a, x).filter(e => e.st.built).length, 0);
  check(builtNow() > b0 + 20, `the AI builds (${b0} → ${builtNow()} buildings in 60 turns)`);
  check(rows > 0, `and puts up centre improvements (${rows} built)`);
}

if (failures) {
  console.log(`${failures} failed`);
  process.exit(1);
}
console.log('builders and the queue work');
