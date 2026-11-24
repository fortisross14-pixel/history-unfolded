/**
 * Mission events (src/engine/missionEvents.ts): a stalled culture mission brings an event aimed at
 * it. Checks the raider event for a battle mission (the band comes, beating it completes the
 * mission), the house study and half-a-tech choices, no event without an active mission, the
 * pacing, that every event's mission choice moves its mandate, the AI's answers, and saves.
 */
import { DOMAIN_LIST } from '../src/data/culture.ts';
import { XP_PER_LEVEL } from '../src/data/dynasties.ts';
import { DEFAULT_SHIP } from '../src/data/items.ts';
import { TECHS } from '../src/data/techs.ts';
import {
  buyMission,
  cultureTurn,
  missionProgress,
  pickProblem,
  pickTome,
} from '../src/engine/culture.ts';
import { assignGovernor, levelOf, riseHouse, rulerOf } from '../src/engine/dynasty.ts';
import { cityDistricts } from '../src/engine/economy.ts';
import {
  attack,
  declareWar,
  deserialize,
  endTurn,
  formationStrength,
  foundCity,
  fullMoves,
  newGame,
  player,
  saveDesign,
  serialize,
  techCost,
  trainSettlers,
} from '../src/engine/game.ts';
import { distance, neighbors, within } from '../src/engine/hex.ts';
import { isPassableLand } from '../src/engine/mapgen.ts';
import {
  aiAnswer,
  GAP,
  MISSION_EVENT_SPECS,
  missionCtx,
  missionEventDue,
  missionEventId,
  missionEventTurn,
  missionGauge,
} from '../src/engine/missionEvents.ts';
import {
  pendingRealmEvent,
  REALM_EVENTS,
  realmEventTurn,
  resolveRealmEvent,
} from '../src/engine/realmEvents.ts';
import { mulberry32 } from '../src/engine/rng.ts';
import { MANDATE_LIST, MANDATES } from '../src/engine/tomes.ts';
import type { Civ, GameState } from '../src/engine/types.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};

const make = (seed: number): GameState =>
  newGame({
    map: {
      type: 'continents',
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

/** Open a Tome and make its first mission the given mandate, bought. */
function install(s: GameState, civ: Civ, task: string): string {
  if (!civ.culture.tome) {
    civ.culture.pickDue ??= 1;
    const d = DOMAIN_LIST.find(x => !pickProblem(civ, x))!;
    pickTome(s, civ.id, d);
  }
  const t = civ.culture.tome!;
  const m = t.offered.find(x => !t.taken.includes(x.node)) ?? t.offered[0];
  m.task = task;
  civ.culture.points += 1000;
  t.taken = t.taken.filter(x => x !== m.node);
  t.done = t.done.filter(x => x !== m.node);
  buyMission(s, civ.id, m.node);
  return m.node;
}
/** Mark a mission as stalled for a while. */
function stall(civ: Civ, node: string, turn: number) {
  civ.missionEvents ??= {};
  civ.missionEvents.track ??= {};
  civ.missionEvents.track[node] = { have: 0, turn: turn - 10, since: turn - 10 };
}

/** A player with three settlements, a second age of techs, three houses and an army. */
function richGame(seed = 4): GameState {
  const s = make(seed);
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  for (let k = 0; k < 3; k++) endTurn(s);
  for (const t of Object.values(TECHS))
    if (t.era <= 1 && t.gate === undefined && !me.techs.includes(t.id)) me.techs.push(t.id);
  const g = { w: s.map.w, h: s.map.h };
  const home = s.cities.find(c => c.civId === me.id)!;
  for (let n = 0; n < 2; n++) {
    home.pop = 9000;
    trainSettlers(s, home.id);
    const f = s.formations.filter(x => x.civId === me.id && x.kind === 'settlers').pop()!;
    const spots = within(g, home.hex, 7)
      .filter(h => distance(g, h, home.hex) >= 4 && isPassableLand(s.map, h))
      .sort((a, b) => distance(g, a, home.hex) - distance(g, b, home.hex));
    for (const h of spots) {
      f.hex = h;
      if (foundCity(s, f.id).ok) break;
    }
  }
  for (const c of s.cities) if (c.civId === me.id) c.pop = 5000;
  riseHouse(s, me);
  riseHouse(s, me);
  me.gold = 5000;
  me.culture.points = 5000;
  return s;
}

// ---- a stalled battle mission brings the raider event; letting them come spawns a band
{
  const s = richGame();
  const me = player(s);
  const node = install(s, me, 'win-battles');
  let got: ReturnType<typeof missionEventDue> = null;
  for (let k = 0; k < 30 && !got; k++) {
    s.turn++;
    stall(me, node, s.turn);
    me.missionEvents!.last = undefined;
    got = missionEventDue(s, me);
  }
  check(
    got?.id === missionEventId('win-battles'),
    `a stalled battle mission brings the raider event (${got?.id})`,
  );
  s.realmEvents!.pending = { id: got!.id, turn: s.turn, subject: got!.subject, variant: 0 };
  const ev = pendingRealmEvent(s, me)!;
  check(ev && ev.choices.length >= 2 && ev.choices.length <= 3, 'it offers two or three choices');
  check(
    !!ev.choices[0].mission && ev.choices.slice(1).every(c => !c.mission),
    'the first choice names the mission; the others do not',
  );
  check(
    /Let them come/.test(ev.choices[0].label),
    `the first is "Let them come" (${ev.choices[0].label})`,
  );
  const rc = s.raiders?.civ;
  const before = s.formations.filter(f => f.civId === rc).length;
  check(resolveRealmEvent(s, me, 0).ok, 'letting them come can be chosen');
  const band = s.formations.filter(f => f.civId === s.raiders!.civ).slice(before)[0];
  const near = s.cities.find(
    c => c.civId === me.id && band && distance({ w: s.map.w, h: s.map.h }, c.hex, band.hex) <= 3,
  );
  check(
    !!band && !!near,
    `a hostile band appears within 3 hexes of a settlement (${band?.cohorts.length} cohorts)`,
  );
  // a decent army beats it
  const g = { w: s.map.w, h: s.map.h };
  const army = s.formations.find(f => f.civId === me.id && f.kind === 'army')!;
  const t = me.culture.tome!;
  const m = t.offered.find(x => x.node === node)!;
  m.base = (me.culture.deeds?.wins ?? 0) - (missionProgress(s, me, m, t.age).need - 1);
  const winsBefore = me.culture.deeds?.wins ?? 0;
  for (
    let k = 0;
    k < 4 && s.formations.includes(band) && (me.culture.deeds?.wins ?? 0) === winsBefore;
    k++
  ) {
    const spot = neighbors(g, band.hex).find(
      h =>
        isPassableLand(s.map, h) &&
        !s.formations.some(o => o.hex === h) &&
        !s.cities.some(c => c.hex === h),
    );
    if (spot === undefined) break;
    army.hex = spot;
    army.moves = fullMoves(s, army);
    for (const co of army.cohorts) co.strength = 100;
    attack(s, army.id, band.hex);
  }
  check((me.culture.deeds?.wins ?? 0) > winsBefore, 'the band can be beaten');
  cultureTurn(s, me, 0);
  check(t.done.includes(node), 'beating it completes the battle mission');
}

// ---- the band is sized so a usual army beats it about 9 times in 10
{
  let won = 0,
    n = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const s = make(seed);
    const me = player(s);
    foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
    endTurn(s);
    const levy = s.formations.find(
      f => f.civId === me.id && f.kind === 'army' && f.cohorts.length >= 5,
    );
    if (!levy) continue;
    for (const c of levy.cohorts) c.loadout = { ...c.loadout, weapon: 'spear' };
    const node = install(s, me, 'win-battles');
    const c = missionCtx(s, me, {
      city: s.cities.find(x => x.civId === me.id)!.id,
      mission: node,
    })!;
    const ch = REALM_EVENTS[missionEventId('win-battles')].choices(c)[0];
    ch.apply(c);
    const band = s.formations[s.formations.length - 1];
    const g = { w: s.map.w, h: s.map.h };
    const spot = neighbors(g, band.hex).find(
      h =>
        isPassableLand(s.map, h) &&
        !s.formations.some(o => o.hex === h) &&
        !s.cities.some(x => x.hex === h),
    );
    if (spot === undefined) continue;
    levy.hex = spot;
    levy.moves = fullMoves(s, levy);
    const r = attack(s, levy.id, band.hex);
    n++;
    if (r.report?.outcome === 'defender-broke' || !s.formations.includes(band)) won++;
    void formationStrength;
  }
  const pc = Math.round((won / Math.max(1, n)) * 100);
  console.log(`     a spear levy beat the called-up band ${pc}% of ${n}`);
  check(n >= 20 && pc >= 75 && pc <= 98, 'the levy wins about 9 fights in 10');
}

// ---- house study: xp in the right line, for gold; half a tech: 50% of the current tech
{
  const s = richGame();
  const me = player(s);
  const node = install(s, me, 'house-learning');
  // a school in a town its governor runs
  const home = s.cities.find(c => c.civId === me.id)!;
  const slot = cityDistricts(s, home)[0].slots.find(x => !x.built && !x.type)!;
  Object.assign(slot, { type: 'school', built: true, paid: true });
  const spec = MISSION_EVENT_SPECS['house-learning'];
  const sub = spec.subject!(s, me, mulberry32(1));
  check(!!sub, 'a house governing a school town is found');
  const c = missionCtx(s, me, { ...sub!, mission: node })!;
  const chs = REALM_EVENTS[missionEventId('house-learning')].choices(c);
  const xp0 = c.house!.xp.research ?? 0;
  const lv0 = levelOf(c.house!, 'research');
  const gold0 = me.gold;
  chs[0].apply(c);
  check(
    (c.house!.xp.research ?? 0) - xp0 === XP_PER_LEVEL && levelOf(c.house!, 'research') === lv0 + 1,
    'the house studies: one level of Science',
  );
  check(me.gold < gold0, `and it costs gold (${gold0 - me.gold})`);
  const half = chs.find(x => x.label === 'Half a tech')!;
  check(!!half && !half.mission, 'the other choice is half a tech, not the mission');
  me.researching ??= Object.keys(TECHS).find(id => !me.techs.includes(id))!;
  const cost = techCost(s, me, me.researching!);
  const sci0 = me.science;
  const g1 = me.gold;
  half.apply(c);
  check(
    Math.abs(me.science - sci0 - cost * 0.5) <= 1,
    `half a tech gives 50% of the current tech (${Math.round(me.science - sci0)} of ${cost})`,
  );
  check(me.gold < g1, 'and costs gold too');
}

// ---- no event without an active mission
{
  const s = richGame();
  const me = player(s);
  let any = false;
  for (let k = 0; k < 40; k++) {
    s.turn++;
    if (missionEventDue(s, me) || missionEventDue(s, me, true)) any = true;
  }
  check(!any, 'no mission event while no mission is active');
  const node = install(s, me, 'win-battles');
  me.culture.tome!.done.push(node);
  for (let k = 0; k < 20; k++) {
    s.turn++;
    stall(me, node, s.turn);
    if (missionEventDue(s, me)) any = true;
  }
  check(!any, 'none for a mission already done');
}

// ---- every event's mission choice moves its mandate
{
  const base = richGame();
  const tasks = Object.keys(MISSION_EVENT_SPECS);
  check(
    tasks.length >= 25 && tasks.every(t => MANDATES[t]),
    `events for ${tasks.length} of ${MANDATE_LIST.length} mandate types`,
  );
  const houseTasks = MANDATE_LIST.filter(m => m.house).map(m => m.id);
  const coveredHouse = houseTasks.filter(t => MISSION_EVENT_SPECS[t]);
  check(
    coveredHouse.length >= houseTasks.length - 2,
    `house mandates covered: ${coveredHouse.length} of ${houseTasks.length}`,
  );
  const setup: Record<string, (s: GameState, me: Civ) => void> = {
    'house-learning': (s, me) => buildIn(s, me, 'school'),
    'house-trade': (s, me) => buildIn(s, me, 'market'),
    'house-faith': (s, me) => buildIn(s, me, 'shrine'),
    'calm-houses': (_s, me) => (me.dynasties[1].unrest = 60),
    'ruling-power': (s, me) => {
      const c = s.cities.filter(x => x.civId === me.id)[1];
      assignGovernor(s, me.id, c.id, me.dynasties.find(d => d.id !== rulerOf(me).id)!.id);
    },
    capture: (s, me) => {
      const o = s.civs.find(x => x.id !== me.id && x.alive && !x.raiders && !x.independent)!;
      if (!me.met.includes(o.id)) me.met.push(o.id);
      declareWar(s, me.id, o.id);
      const c = s.cities.find(x => x.civId === o.id)!;
      c.guard = Math.max(1, c.guard);
    },
    'declare-war': (s, me) => {
      const o = s.civs.find(x => x.id !== me.id && x.alive && !x.raiders && !x.independent)!;
      if (!me.met.includes(o.id)) me.met.push(o.id);
    },
    treaties: (s, me) => {
      const o = s.civs.find(x => x.id !== me.id && x.alive && !x.raiders && !x.independent)!;
      if (!me.met.includes(o.id)) me.met.push(o.id);
    },
    faith: (s, me) => {
      me.faith = 1;
      for (const c of s.cities) if (c.civId === me.id) c.faith = undefined;
    },
    mines: (s, me) => {
      const c = s.cities.find(x => x.civId === me.id)!;
      s.map.deposit[c.hex] = { kind: 'copper', richness: 1 };
    },
    ports: (s, me) => coast(s, me),
    fleets: (s, me) => {
      coast(s, me);
      buildIn(s, me, 'shipyard');
      const r = saveDesign(s, me.id, 'Hull', {
        ...DEFAULT_SHIP,
        armour: 'galley-hull',
        mount: 'square-sail',
      });
      if (!r.ok) console.log('     ship design:', r.msg);
    },
    wonder: (s, me) => {
      for (const c of s.cities) if (c.civId === me.id) c.tier = 'town';
    },
  };
  const results: string[] = [];
  let moved = 0;
  for (const task of tasks) {
    const s = deserialize(serialize(base));
    const me = player(s);
    setup[task]?.(s, me);
    const node = install(s, me, task);
    me.gold = 5000;
    me.culture.points = 5000;
    me.researching ??=
      Object.keys(TECHS).find(id => !me.techs.includes(id) && TECHS[id].era <= 2) ?? null;
    const spec = MISSION_EVENT_SPECS[task];
    const sub = spec.subject ? spec.subject(s, me, mulberry32(3)) : {};
    const c = sub && missionCtx(s, me, { ...sub, mission: node });
    if (!c) {
      results.push(`${task}: no subject`);
      continue;
    }
    const chs = REALM_EVENTS[missionEventId(task)].choices(c);
    const adv = chs.find(x => x.mission)!;
    const okShape = chs.length >= 2 && chs.length <= 3 && chs.filter(x => x.mission).length === 1;
    if (spec.grave && chs[0].mission) results.push(`${task}: a grave choice comes first`);
    const before = missionGauge(s, me, task);
    const blocked = adv?.blocked?.(c);
    if (adv && !blocked) adv.apply(c);
    const after = missionGauge(s, me, task);
    if (after > before && okShape && !(spec.grave && chs[0].mission)) moved++;
    else
      results.push(
        `${task}: ${before} → ${after}${blocked ? ` (${blocked})` : ''}${okShape ? '' : ' (shape)'}`,
      );
  }
  if (results.length) console.log('     ' + results.join('\n     '));
  check(
    moved === tasks.length,
    `every mission choice moves its mandate (${moved} of ${tasks.length})`,
  );
}

function buildIn(s: GameState, me: Civ, type: string) {
  const c = s.cities.find(x => x.civId === me.id)!;
  const slot = cityDistricts(s, c)[0].slots.find(x => !x.built && !x.type)!;
  Object.assign(slot, { type, built: true, paid: true });
}
function coast(s: GameState, me: Civ) {
  const c = s.cities.find(x => x.civId === me.id)!;
  const g = { w: s.map.w, h: s.map.h };
  if (!neighbors(g, c.hex).some(h => s.map.terrain[h] === 'coast'))
    s.map.terrain[neighbors(g, c.hex).find(h => !s.formations.some(f => f.hex === h))!] = 'coast';
}

// ---- the AI: the mission when it is near the major, otherwise the best plain value
{
  const s = richGame();
  const ai = s.civs.find(c => !c.isPlayer && c.alive && !c.independent && !c.raiders)!;
  ai.gold = 5000;
  const node = install(s, ai, 'treasury');
  const t = ai.culture.tome!;
  // two missions done already: this one would open the major
  t.done = t.offered
    .filter(m => m.node !== node)
    .slice(0, 2)
    .map(m => m.node);
  const sub = { mission: node };
  const pickNear = aiAnswer(s, ai, missionEventId('treasury'), sub, () => 0.99);
  check(pickNear === 0, 'an AI near its major takes the mission choice');
  t.done = [];
  const node2 = install(s, ai, 'gold');
  const pickFar = aiAnswer(s, ai, missionEventId('gold'), { mission: node2 }, () => 0.99);
  check(pickFar > 0, 'an AI far from it takes the best plain value');
  // AI peoples get and answer mission events in play
  const s2 = richGame();
  const ais = s2.civs.filter(c => !c.isPlayer && c.alive && !c.independent && !c.raiders);
  for (const a of ais) {
    a.gold = 2000;
    const n = install(s2, a, 'win-battles');
    stall(a, n, s2.turn);
  }
  let answered = 0;
  for (let k = 0; k < 12; k++) {
    s2.turn++;
    for (const a of ais) {
      const before = a.missionEvents?.last;
      missionEventTurn(s2, a);
      if (a.missionEvents?.last !== before) answered++;
      for (const m of a.culture.tome?.offered ?? [])
        if (a.missionEvents?.track?.[m.node]) stall(a, m.node, s2.turn);
    }
  }
  check(
    answered >= ais.length,
    `AI peoples answer their mission events (${answered} over 12 turns, ${ais.length} peoples)`,
  );
}

// ---- pacing in play: no more than one every GAP turns; never two pending; saves mid-event
{
  const s = richGame(7);
  const me = player(s);
  const node = install(s, me, 'win-battles');
  const turns: number[] = [];
  let doubled = false;
  let saved = false;
  for (let k = 0; k < 60; k++) {
    stall(me, node, s.turn);
    const p = s.realmEvents?.pending;
    if (p && p.id.startsWith('mission-')) {
      if (turns[turns.length - 1] !== p.turn) turns.push(p.turn);
      if (!saved) {
        // save and load with the event open
        const back = deserialize(serialize(s));
        const ev = pendingRealmEvent(back, player(back));
        check(
          ev?.id === p.id && !!ev.choices[0].mission,
          'a mission event survives a save and load',
        );
        check(resolveRealmEvent(back, player(back), 1).ok, 'and can be answered after loading');
        saved = true;
      }
    }
    const before = s.realmEvents?.pending;
    if (before && realmEventTurn(s, me) && s.realmEvents?.pending !== before) doubled = true;
    endTurn(s);
    // the mission stays unfinished for the test
    me.culture.tome!.done = me.culture.tome!.done.filter(x => x !== node);
    if (!me.culture.tome!.taken.includes(node)) me.culture.tome!.taken.push(node);
  }
  const gaps = turns.slice(1).map((t, i) => t - turns[i]);
  console.log(`     mission events at turns ${turns.join(', ')}`);
  check(turns.length >= 3, `a stalled mission brings events in play (${turns.length} in 60 turns)`);
  check(
    gaps.every(g => g >= GAP - 1),
    `no more than one every ~${GAP} turns (gaps ${gaps.join(', ')})`,
  );
  check(!doubled, 'never two pending at once');
  check(saved, 'a save was tried mid-event');
}

if (failures) {
  console.log(`${failures} mission event check(s) failed`);
  process.exit(1);
}
console.log('all mission event checks passed');
