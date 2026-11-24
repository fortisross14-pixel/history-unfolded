/**
 * Checks research goals and costs, and culture Tomes: a pick due at the start, missions bought for
 * culture and completed from the real game state, the major buff, Tomes closing when any people
 * enters a new age, saves (and old saves), and AI peoples working through their Tomes.
 */
import { CULTURE, DOMAIN_LIST } from '../src/data/culture.ts';
import { AGE_GATE, TECHS } from '../src/data/techs.ts';
import { MAJORS } from '../src/data/tomes.ts';
import {
  buyMajor,
  buyMission,
  missionLabel,
  missionProgress,
  offerFor,
  pickProblem,
  pickTome,
  worldAge,
} from '../src/engine/culture.ts';
import {
  availableTechs,
  deserialize,
  endTurn,
  foundCity,
  newGame,
  player,
  serialize,
  setResearchGoal,
  techCost,
} from '../src/engine/game.ts';
import { grantHonours } from '../src/engine/dynasty.ts';
import { civMods, identity } from '../src/engine/mods.ts';
import { MANDATES } from '../src/engine/tomes.ts';
import type { GameState } from '../src/engine/types.ts';
import { capOf } from '../src/engine/units.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};

const fresh = (seed: number) =>
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
const s = newGame({
  map: {
    type: 'pangaea',
    size: 'small',
    seaLevel: 'normal',
    climate: 'normal',
    rainfall: 'normal',
    resources: 'normal',
    mountains: 'normal',
    seed: 5,
  },
  civCount: 4,
  playerName: 'Test',
});
const pl = player(s);
foundCity(s, s.formations.find(f => f.civId === pl.id && f.kind === 'settlers')!.id);

// ---- research
check(techCost(s, pl, 'mining') < techCost(s, pl, 'iron-working'), 'later eras cost more');
check(
  techCost(s, pl, 'iron-working') === Math.round(TECHS['iron-working'].cost * 1.6),
  'classical techs cost 1.6x their base',
);
check(!availableTechs(pl).some(t => t.era > 1), 'only the Ancient age is open at the start');
check(
  !availableTechs(pl).some(t => t.id === 'classical-age'),
  'the Classical Age needs Ancient techs first',
);
const goal = setResearchGoal(s, pl.id, 'iron-working');
check(
  goal.ok && !!pl.researching && TECHS[pl.researching].era === 1,
  `goal Iron Working starts with an Ancient tech (${pl.researching})`,
);
pl.science = 100000;
for (let t = 0; t < 14 && !pl.techs.includes('iron-working'); t++) endTurn(s);
check(
  pl.techs.includes('classical-age') && pl.techs.includes('iron-working'),
  `goal reached through the Classical Age: ${pl.techs.join(', ')}`,
);
check(
  pl.techs.filter(t => TECHS[t].era === 1 && !TECHS[t].gate).length >= 9,
  'the age gate took 9 Ancient techs',
);
check(pl.researchGoal === null || pl.techs.includes('iron-working'), 'goal cleared once reached');

// ---- culture Tomes
const c = fresh(7);
const me = player(c);
foundCity(c, c.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
check(me.culture.pickDue === 1 && !me.culture.tome, 'a Tome pick is due at the start');
check(
  DOMAIN_LIST.every(d => !pickProblem(me, d)),
  'all nine Tomes can be opened in the first age',
);
check(pickTome(c, me.id, 'war').ok && me.culture.tome?.domain === 'war', 'open the Tome of War');
const tome = me.culture.tome!;
check(
  tome.offered.length === 5 &&
    tome.offered.every(m => CULTURE[m.node]?.domain === 'war' && MANDATES[m.task]),
  `it offers five War missions (${tome.offered.map(m => `${m.node}:${m.task}`).join(', ')})`,
);
check(
  new Set(tome.offered.map(m => m.task)).size === tome.offered.length,
  'each with its own mandate',
);
check(
  tome.offered.every(m => CULTURE[m.node].tier <= 2),
  'first-age missions give early choices',
);
// fix three mandates we can drive from here: techs learned, gold held, peoples met
tome.offered[0].task = 'techs';
tome.offered[1].task = 'treasury';
tome.offered[2].task = 'met';
const [mTech, mGold, mMet] = tome.offered;
me.culture.points = 100;
check(buyMission(c, me.id, mTech.node).ok && me.culture.points === 70, 'a mission costs 30');
check(!buyMission(c, me.id, mTech.node).ok, 'and is bought once');
check(missionProgress(c, me, mTech, 1).have === 0, 'techs count from when it was bought');
const node0 = CULTURE[mTech.node];
const key0 = Object.keys(node0.mods)[0] as keyof typeof node0.mods;
const val = (k: string) => {
  const m = civMods(c, me.id) as unknown as Record<string, number | Record<string, number>>;
  const v = m[k];
  return typeof v === 'number' ? v : Object.values(v ?? {}).reduce((a, b) => a + b, 0);
};
const before0 = val(key0);
const learn = () => {
  if (!me.researching)
    me.researching = availableTechs(me).find(t => t.era === 1 && t.gate === undefined)!.id;
  me.science += techCost(c, me, me.researching) + 1;
  endTurn(c);
};
for (let k = 0; k < 6 && !tome.done.includes(mTech.node); k++) learn();
check(tome.done.includes(mTech.node), `three techs learned: ${node0.name} is done`);
check(me.culture.taken.includes(mTech.node), 'its choice is kept for good');
check(val(key0) > before0, `and its buff applies (${String(key0)} ${before0} → ${val(key0)})`);
check(tome.major === 'locked', 'one mission done: the major stays locked');
me.culture.points += 60;
buyMission(c, me.id, mGold.node);
buyMission(c, me.id, mMet.node);
me.gold = 500;
me.met = c.civs.filter(x => x.id !== me.id && !x.raiders && !x.independent).map(x => x.id);
endTurn(c);
check(
  tome.done.includes(mGold.node) && tome.done.includes(mMet.node),
  'gold in the treasury and peoples met complete two more',
);
check(tome.major === 'open', 'three done open the major buff');
const atk0 = civMods(c, me.id).attackPct;
const army = c.formations.find(f => f.civId === me.id && f.kind === 'army')!;
const cap0 = capOf(army, c);
me.culture.points = 50;
check(!buyMajor(c, me.id).ok, 'the major needs about 120 culture');
me.culture.points = 200;
check(buyMajor(c, me.id).ok && tome.major === 'bought', `buy the ${MAJORS.war.name}`);
check(
  civMods(c, me.id).attackPct === atk0 + 20 && capOf(army, c) === cap0 + 1,
  `+20% attack and +1 cohort a formation (${atk0} → ${civMods(c, me.id).attackPct})`,
);
const keptTags = identity(me).reduce((a, i) => a + i.count, 0);
check(
  keptTags === me.culture.taken.reduce((a, id) => a + CULTURE[id].tags.length, 0),
  'kept choices carry their identity tags',
);

// another people enters the Classical age: every Tome closes
const rival = c.civs.find(x => !x.isPlayer && !x.independent && !x.raiders && x.alive)!;
const takenBefore = me.culture.taken.length;
rival.techs.push(AGE_GATE[2]);
endTurn(c);
check(worldAge(c) === 2, 'the world is in the Classical age');
check(!me.culture.tome && me.culture.pickDue === 2, 'our Tome closed; a Classical pick is due');
check(
  me.culture.history?.[0]?.major === 'won' && me.culture.history[0].done.length === 3,
  'the closed Tome is remembered: three done, major won',
);
check(civMods(c, me.id).attackPct === atk0 + 20, 'the major buff stays for good');
check(!!pickProblem(me, 'war'), 'War cannot be opened twice in a row');
check(
  rival.culture.pickDue === 2 && !rival.culture.tome,
  'the rival’s Tome closed too, and it must choose again',
);
check(pickTome(c, me.id, 'knowledge').ok, 'open the Tome of Knowledge');
const t2 = me.culture.tome!;
check(t2.offered.length === 6, 'six missions from the second age');
me.culture.points = 1000;
check(
  buyMission(c, me.id, t2.offered[0].node).ok && me.culture.points === 960,
  'missions cost a little more in a later age (40)',
);
// three done, major not bought: then the world moves on
t2.offered[1].task = 'treasury';
t2.offered[2].task = 'met';
t2.offered[3].task = 'explore';
for (const m of t2.offered.slice(1, 4)) buyMission(c, me.id, m.node);
me.gold = 5000;
me.explored = me.explored.map(() => 1);
endTurn(c);
check(t2.major === 'open', `three more done (${t2.done.length}); the major opens`);
const sci0 = civMods(c, me.id).sciencePct;
const held = me.culture.taken.length;
rival.techs.push(AGE_GATE[3]);
endTurn(c);
const last = me.culture.history!.at(-1)!;
check(
  last.domain === 'knowledge' && last.major === 'lost',
  'a new age before the major was bought: the major is lost',
);
check(
  me.culture.taken.length === held && held >= takenBefore + 3,
  `the minor buffs stay (${held} kept)`,
);
check(civMods(c, me.id).sciencePct === sci0, 'and nothing of the lost major applies');
check(me.culture.pickDue === 3, 'a Medieval pick is due');

// the Knowledge major: the first tech of each age is cheaper
{
  const k = fresh(7);
  const p = player(k);
  const first = TECHS['pottery'] ? 'pottery' : availableTechs(p)[0].id;
  const c0 = techCost(k, p, first);
  p.culture.history = [{ domain: 'knowledge', age: 1, done: [], major: 'won', turn: 1 }];
  check(
    techCost(k, p, first) < c0 * 0.8,
    `Age of Reason: the first tech of an age −25% (${c0} → ${techCost(k, p, first)})`,
  );
}

// ---- the noble houses: every Tome has work for them, in every age
{
  const k = fresh(11);
  const p = player(k);
  const short: string[] = [];
  for (let age = 1; age <= 5; age++)
    for (const d of DOMAIN_LIST) {
      const n = offerFor(k, p, d, age).filter(m => MANDATES[m.task].house).length;
      if (n < (d === 'politics' || d === 'society' ? 2 : 1)) short.push(`${d}@${age}:${n}`);
    }
  check(
    !short.length,
    `house missions in every Tome and age (short: ${short.join(' ') || 'none'})`,
  );
  foundCity(k, k.formations.find(f => f.civId === p.id && f.kind === 'settlers')!.id);
  pickTome(k, p.id, 'politics');
  const t = p.culture.tome!;
  t.offered[0].task = 'honours';
  t.offered[1].task = 'house-level';
  p.culture.points = 100;
  buyMission(k, p.id, t.offered[0].node);
  buyMission(k, p.id, t.offered[1].node);
  p.gold = 500;
  const house = p.dynasties[0];
  check(grantHonours(k, p.id, house.id).ok, 'grant honours to the ruling house');
  house.traits = { ...house.traits, research: 3 };
  endTurn(k);
  check(
    t.done.includes(t.offered[0].node) && t.done.includes(t.offered[1].node),
    `house missions complete from the houses' state (${missionLabel(t.offered[0], 1)}; ${missionLabel(t.offered[1], 1)})`,
  );
}

// ---- saves keep it all
pickTome(c, me.id, 'economy');
buyMission(c, me.id, me.culture.tome!.offered[0].node);
const back = deserialize(serialize(c));
const me2 = player(back);
check(
  JSON.stringify(me2.culture) === JSON.stringify(me.culture),
  'save and load keep the Tome, missions, history and kept buffs',
);
check(civMods(back, me2.id).attackPct === civMods(c, me.id).attackPct, 'and the buffs they give');

// ---- an old save: its choices stay as kept buffs, a Tome pick is due
{
  const raw = JSON.parse(serialize(fresh(3)));
  raw.state.civs[0].culture = {
    points: 55,
    taken: ['star-lore', 'chiefdom', 'no-such-choice'],
    legacy: ['war-bands'],
    tension: { religion: 12, cosmology: 90 },
    upheaval: { domain: 'cosmology', turnsLeft: 3 },
    choosing: null,
  };
  const old: GameState = deserialize(JSON.stringify(raw));
  const oc = old.civs[0].culture as unknown as Record<string, unknown>;
  check(
    old.civs[0].culture.taken.join() === 'star-lore,chiefdom' &&
      old.civs[0].culture.pickDue === 1 &&
      !('upheaval' in oc) &&
      old.civs[0].culture.tension.religion === 12,
    'an old save keeps its choices, drops its upheaval and gets a Tome pick',
  );
  check(civMods(old, 0).commandCap >= 1, 'its old choices still give their buffs');
}

// ---- AI peoples work through their Tomes over a long game
const lg = fresh(5);
foundCity(lg, lg.formations.find(f => f.civId === player(lg).id && f.kind === 'settlers')!.id);
for (let t = 0; t < 220; t++) endTurn(lg);
const ais = lg.civs.filter(x => !x.isPlayer && x.alive && !x.independent && !x.raiders);
for (const x of ais) {
  const h = x.culture.history ?? [];
  console.log(
    `     ${x.name}: ${x.techs.length} techs, ${x.culture.taken.length} kept, majors ${h.filter(y => y.major === 'won').length + (x.culture.tome?.major === 'bought' ? 1 : 0)}, tomes ${[...h.map(y => `${y.domain}${y.done.length}`), x.culture.tome ? `${x.culture.tome.domain}${x.culture.tome.done.length}*` : ''].join(' ')}, identity ${identity(
      x,
    )
      .slice(0, 3)
      .map(i => `${i.tag}${i.count}`)
      .join(' ')}`,
  );
}
check(
  ais.every(x => x.culture.taken.length >= 3 && x.techs.length >= 15),
  'every AI people researches and completes culture missions',
);
check(
  ais.some(
    x =>
      (x.culture.history ?? []).some(y => y.major === 'won') || x.culture.tome?.major === 'bought',
  ),
  'some AI people wins a major buff',
);
check(
  ais.every(x => x.culture.tome || x.culture.pickDue),
  'every AI people has a Tome open (or one due this turn)',
);
const houseDone = ais.reduce(
  (a, x) =>
    a +
    (x.culture.history ?? []).reduce((b, h) => b + (h.houses ?? 0), 0) +
    (x.culture.tome?.offered.filter(
      m => x.culture.tome!.done.includes(m.node) && MANDATES[m.task].house,
    ).length ?? 0),
  0,
);
check(houseDone >= ais.length, `AI peoples complete house missions too (${houseDone})`);
const tops = new Set(ais.map(x => identity(x)[0]?.tag));
check(tops.size >= Math.min(2, ais.length), `peoples grow apart: top tags ${[...tops].join(', ')}`);

console.log(failures ? `${failures} failures` : 'all culture checks passed');
process.exit(failures ? 1 : 0);
