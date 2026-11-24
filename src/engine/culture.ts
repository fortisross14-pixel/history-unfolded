/**
 * Culture: points and Tomes. In each world age a people opens a Tome (one of the nine domains of
 * data/culture.ts). The Tome offers missions: buy one with culture and it becomes active; once its
 * mandate is met (engine/tomes.ts) its culture choice is kept for good. Three missions done open
 * the Tome's major buff (data/tomes.ts), bought with culture and kept forever. When any great
 * people enters a new age, every open Tome closes: minor buffs stay, an unbought major is lost.
 */
import { CULTURE, CULTURE_LIST, DOMAIN_LIST, DOMAINS, type Domain } from '../data/culture.ts';
import { personalityOf } from '../data/leaders.ts';
import { ageOf } from '../data/techs.ts';
import {
  MAJOR_AT,
  MAJOR_COST,
  MAJORS,
  MIN_POOL,
  MISSION_COST,
  MISSIONS_IN,
  HOUSE_QUOTA,
  HOUSE_TASKS,
  TOME_TASKS,
} from '../data/tomes.ts';
import { describeMods } from '../data/mods.ts';
import { isCoastal } from './economy.ts';
import { civMods, majorDomains, pct } from './mods.ts';
import { hashSeed, mulberry32, type Rng } from './rng.ts';
import { MANDATE_LIST, MANDATES, mandateNeed, mandateOpen, survey, type Survey } from './tomes.ts';
import type { Civ, CultureState, GameState, Tome, TomeMission } from './types.ts';

type Result = { ok: boolean; msg: string };

export function newCultureState(): CultureState {
  return { points: 0, taken: [], tension: {}, tome: null, pickDue: 1, history: [] };
}

/** The world age: the furthest age any great people has reached. */
export function worldAge(s: GameState): number {
  let a = 1;
  for (const c of s.civs) if (!c.independent && !c.raiders) a = Math.max(a, ageOf(c.techs));
  return a;
}

/** Count a deed for the missions that ask for it (battles won, lairs cleared…). */
export function noteDeed(civ: Civ | undefined, k: string, n = 1) {
  if (!civ) return;
  civ.culture.deeds ??= {};
  civ.culture.deeds[k] = (civ.culture.deeds[k] ?? 0) + n;
}

export const missionCost = (s: GameState, civ: Civ, age = civ.culture.tome?.age ?? worldAge(s)) =>
  Math.round(MISSION_COST[Math.min(5, Math.max(1, age))] * pct(civMods(s, civ.id).cultureCostPct));
export const majorCost = (s: GameState, civ: Civ, age = civ.culture.tome?.age ?? worldAge(s)) =>
  Math.round(MAJOR_COST[Math.min(5, Math.max(1, age))] * pct(civMods(s, civ.id).cultureCostPct));

export const hasMajor = (civ: Civ, d: Domain) => majorDomains(civ).includes(d);

/** The domain of the Tome that closed last: it cannot be opened again straight away. */
export const lastDomain = (c: CultureState): Domain | undefined =>
  c.history?.length ? c.history[c.history.length - 1].domain : undefined;

const kept = (c: CultureState, id: string) => c.taken.includes(id) || !!c.legacy?.includes(id);

/** Culture choices of a domain still to be won: not kept, and not the other side of a kept fork. */
export function tomePool(civ: Civ, d: Domain) {
  const c = civ.culture;
  const forks = new Set(
    CULTURE_LIST.filter(n => n.fork && kept(c, n.id)).map(n => n.fork as string),
  );
  return CULTURE_LIST.filter(
    n => n.domain === d && !kept(c, n.id) && !(n.fork && forks.has(n.fork)),
  );
}

/** Why a people cannot open this Tome now, or null. */
export function pickProblem(civ: Civ, d: Domain): string | null {
  const c = civ.culture;
  if (!c.pickDue) return 'No Tome to choose now.';
  if (lastDomain(c) === d) return `${DOMAINS[d].name} was your last Tome.`;
  if (tomePool(civ, d).length < MIN_POOL) return `Little left to learn in ${DOMAINS[d].name}.`;
  return null;
}

/** The culture choice tiers that suit each age. */
const TARGET_TIER = [0, 1, 1.75, 2.5, 3.25, 4];

/** The missions a Tome of `d` would offer this people in `age`: fitting choices, fitting mandates. */
export function offerFor(s: GameState, civ: Civ, d: Domain, age: number): TomeMission[] {
  const r = mulberry32(
    hashSeed(s.settings.map.seed, civ.id * 7919 + age * 131 + DOMAIN_LIST.indexOf(d)),
  );
  const target = TARGET_TIER[Math.min(5, Math.max(1, age))];
  const pool = tomePool(civ, d)
    .map(n => ({ n, v: Math.abs(n.tier - target) + r() * 0.6 }))
    .sort((a, b) => a.v - b.v);
  const nodes: typeof CULTURE_LIST = [];
  const forks = new Set<string>();
  for (const { n } of pool) {
    if (nodes.length >= MISSIONS_IN(age)) break;
    if (n.fork && forks.has(n.fork)) continue;
    if (n.fork) forks.add(n.fork);
    nodes.push(n);
  }
  nodes.sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
  const open = (id: string) => MANDATES[id] && mandateOpen(MANDATES[id], age);
  const tasks = TOME_TASKS[d].filter(open);
  const houseTasks = HOUSE_TASKS[d].filter(open);
  const used = new Set<string>();
  const pick = new Map<string, string>();
  const keysOf = (n: (typeof nodes)[number]) => Object.keys(n.mods);
  const fit = (list: string[], id: string, k: number, n: (typeof nodes)[number]) =>
    MANDATES[id].keys.filter(x => keysOf(n).includes(x)).length * 2 +
    (list.length - k) * 0.15 +
    r() * 0.8;
  // first the houses' share: the best-fitting (choice, house mandate) pairs
  for (let q = 0; q < Math.min(HOUSE_QUOTA(d), nodes.length - 1); q++) {
    let best: [string, string] | null = null;
    let bv = -Infinity;
    for (const n of nodes) {
      if (pick.has(n.id)) continue;
      houseTasks.forEach((id, k) => {
        if (used.has(id)) return;
        const v = fit(houseTasks, id, k, n);
        if (v > bv) [best, bv] = [[n.id, id], v];
      });
    }
    if (!best) break;
    const [nid, tid] = best as [string, string];
    pick.set(nid, tid);
    used.add(tid);
  }
  return nodes.map(n => {
    let best = pick.get(n.id) ?? '';
    if (!best) {
      let bv = -Infinity;
      tasks.forEach((id, k) => {
        if (used.has(id)) return;
        const v = fit(tasks, id, k, n);
        if (v > bv) [best, bv] = [id, v];
      });
    }
    if (!best)
      best =
        MANDATE_LIST.find(m => !used.has(m.id) && !m.house && mandateOpen(m, age))?.id ??
        MANDATE_LIST[0].id;
    used.add(best);
    return { node: n.id, task: best };
  });
}

/** How far a mission has come: what is done and what is needed. */
export function missionProgress(
  s: GameState,
  civ: Civ,
  m: TomeMission,
  age: number,
  x?: Survey,
): { have: number; need: number } {
  const md = MANDATES[m.task];
  if (!md) return { have: 0, need: 1 };
  const need = mandateNeed(md, age);
  if (civ.culture.tome?.done.includes(m.node)) return { have: need, need };
  const taken = civ.culture.tome?.taken.includes(m.node);
  let have: number;
  if (md.streak) have = taken ? (m.count ?? 0) : 0;
  else {
    const v = md.measure!(s, civ, x ?? survey(s, civ));
    have = md.since ? (taken ? v - (m.base ?? v) : 0) : v;
  }
  return { have: Math.max(0, Math.min(need, have)), need };
}

/** A mission's words: "Win 3 battles". */
export function missionLabel(m: TomeMission, age: number): string {
  const md = MANDATES[m.task];
  return md ? md.label(mandateNeed(md, age)) : m.task;
}

/** Open a Tome for the age that is due. */
export function pickTome(s: GameState, civId: number, d: Domain): Result {
  const civ = s.civs[civId];
  const c = civ.culture;
  const why = pickProblem(civ, d);
  if (why) return { ok: false, msg: why };
  const age = c.pickDue!;
  const t: Tome = {
    domain: d,
    age,
    offered: offerFor(s, civ, d, age),
    taken: [],
    done: [],
    major: 'locked',
    opened: s.turn,
  };
  c.tome = t;
  c.pickDue = null;
  s.log.push({
    turn: s.turn,
    civId,
    text: `The ${civ.name} open the Tome of ${DOMAINS[d].name}.`,
  });
  return { ok: true, msg: `Tome of ${DOMAINS[d].name} opened.` };
}

/** Buy a mission of the open Tome: it becomes active and is checked each turn. */
export function buyMission(s: GameState, civId: number, node: string): Result {
  const civ = s.civs[civId];
  const t = civ.culture.tome;
  if (!t) return { ok: false, msg: 'No Tome is open.' };
  const m = t.offered.find(x => x.node === node);
  if (!m) return { ok: false, msg: 'Not a mission of this Tome.' };
  if (t.taken.includes(node)) return { ok: false, msg: 'Already under way.' };
  const cost = missionCost(s, civ, t.age);
  if (civ.culture.points < cost)
    return {
      ok: false,
      msg: `Needs ${cost} culture (you have ${Math.floor(civ.culture.points)}).`,
    };
  civ.culture.points -= cost;
  const md = MANDATES[m.task];
  if (md?.since) m.base = md.measure!(s, civ, survey(s, civ));
  if (md?.streak) m.count = 0;
  t.taken.push(node);
  return { ok: true, msg: `Mission: ${missionLabel(m, t.age)}.` };
}

/** Buy the Tome's major buff: permanent. */
export function buyMajor(s: GameState, civId: number): Result {
  const civ = s.civs[civId];
  const t = civ.culture.tome;
  if (!t) return { ok: false, msg: 'No Tome is open.' };
  if (t.major === 'bought') return { ok: false, msg: 'Already won.' };
  if (t.major !== 'open') return { ok: false, msg: `Complete ${MAJOR_AT} missions first.` };
  const cost = majorCost(s, civ, t.age);
  if (civ.culture.points < cost)
    return {
      ok: false,
      msg: `Needs ${cost} culture (you have ${Math.floor(civ.culture.points)}).`,
    };
  civ.culture.points -= cost;
  t.major = 'bought';
  const name = MAJORS[t.domain].name;
  s.log.push({ turn: s.turn, civId, text: `The ${civ.name} win the ${name}.` });
  return { ok: true, msg: `${name}: yours for good.` };
}

/** Close the open Tome: what was done stays; the major is won only if it was bought. */
export function closeTome(s: GameState, civ: Civ): string | null {
  const c = civ.culture;
  const t = c.tome;
  if (!t) return null;
  c.history ??= [];
  c.history.push({
    domain: t.domain,
    age: t.age,
    done: [...t.done],
    major: t.major === 'bought' ? 'won' : 'lost',
    turn: s.turn,
    houses: t.offered.filter(m => t.done.includes(m.node) && MANDATES[m.task]?.house).length,
  });
  c.tome = null;
  const lost = t.major !== 'bought';
  return `The Tome of ${DOMAINS[t.domain].name} closes: ${t.done.length} mission${t.done.length === 1 ? '' : 's'} kept${lost ? `, the ${MAJORS[t.domain].name} lost` : ''}.`;
}

/** The open Tome closes before its age is out (a schism): a new one is chosen for this age. */
export function reopenTome(s: GameState, civId: number): Result {
  const civ = s.civs[civId];
  const msg = closeTome(s, civ);
  if (!msg) return { ok: false, msg: 'No Tome is open.' };
  civ.culture.pickDue = worldAge(s);
  return { ok: true, msg };
}

/** Old saves: their culture choices stay as kept buffs; a Tome pick is due. */
export function migrateCulture(s: GameState, civ: Civ) {
  const c = civ.culture as CultureState & { upheaval?: unknown; choosing?: unknown };
  if (!c) {
    civ.culture = newCultureState();
    return;
  }
  delete c.upheaval;
  delete c.choosing;
  c.taken ??= [];
  c.taken = c.taken.filter(id => CULTURE[id]);
  const rel = c.tension?.religion;
  c.tension = rel ? { religion: rel } : {};
  c.history ??= [];
  if (c.tome === undefined) {
    c.tome = null;
    if (!civ.independent && !civ.raiders) c.pickDue = worldAge(s);
  }
}

/** Once a turn: add points, close Tomes when the world enters a new age, check active missions. */
export function cultureTurn(s: GameState, civ: Civ, points: number): string[] {
  const out: string[] = [];
  const c = civ.culture;
  c.points += points;
  // a civil war come through, for the missions that ask for one
  if (civ.civilWar) c.deeds = { ...c.deeds, inCivilWar: 1 };
  else if (c.deeds?.inCivilWar) {
    delete c.deeds.inCivilWar;
    noteDeed(civ, 'civilwars');
  }
  const wa = worldAge(s);
  if (c.tome && c.tome.age < wa) {
    const msg = closeTome(s, civ);
    if (msg) {
      s.log.push({ turn: s.turn, civId: civ.id, text: msg });
      if (civ.isPlayer) out.push(`${msg} Choose a culture Tome for the new age.`);
    }
    c.pickDue = wa;
  } else if (!c.tome && (!c.pickDue || c.pickDue < wa)) c.pickDue = wa;
  const t = c.tome;
  if (!t) return out;
  const active = t.offered.filter(m => t.taken.includes(m.node) && !t.done.includes(m.node));
  if (!active.length) return out;
  const x = survey(s, civ);
  for (const m of active) {
    const md = MANDATES[m.task];
    if (md?.streak) m.count = md.streak(s, civ) ? (m.count ?? 0) + 1 : 0;
    const p = missionProgress(s, civ, m, t.age, x);
    if (p.have < p.need) continue;
    t.done.push(m.node);
    if (!c.taken.includes(m.node)) c.taken.push(m.node);
    const node = CULTURE[m.node];
    s.log.push({ turn: s.turn, civId: civ.id, text: `The ${civ.name} embraced ${node.name}.` });
    if (civ.isPlayer)
      out.push(
        `Culture mission complete: ${missionLabel(m, t.age)}. ${node.name}: ${describeMods(node.mods)}.`,
      );
    if (t.major === 'locked' && t.done.length >= MAJOR_AT) {
      t.major = 'open';
      if (civ.isPlayer)
        out.push(`Culture: the ${MAJORS[t.domain].name} can be bought (${majorCost(s, civ)}).`);
    }
  }
  return out;
}

// ---------------------------------------------------------------- AI

const LEAN: Record<string, Partial<Record<Domain, number>>> = {
  conqueror: { war: 4, politics: 1 },
  builder: { society: 3, arts: 2, economy: 1 },
  merchant: { economy: 4, seafaring: 2 },
  zealot: { religion: 4, cosmology: 1 },
  diplomat: { politics: 3, arts: 2, knowledge: 1 },
  opportunist: { war: 2, economy: 2 },
};

/** How likely the AI thinks a mission is to be done soon (0..1+). */
function aiOdds(s: GameState, civ: Civ, m: TomeMission, age: number, x: Survey): number {
  const md = MANDATES[m.task];
  if (!md) return 0;
  const p = missionProgress(s, civ, m, age, x);
  if (!md.since && !md.streak) return p.have / p.need;
  const war = s.wars.some(w => w.a === civ.id || w.b === civ.id);
  switch (m.task) {
    case 'techs':
    case 'buildings':
    case 'grow':
      return 0.7;
    case 'peace':
      return war ? 0.1 : 0.7;
    case 'win-battles':
    case 'kills':
      return war ? 0.6 : 0.15;
    case 'capture':
      return war ? 0.3 : 0.05;
    case 'beasts':
    case 'lairs':
      return 0.4;
    case 'found':
      return s.formations.some(f => f.civId === civ.id && f.kind === 'settlers') ? 0.8 : 0.3;
    case 'calm-houses':
      return (civ.dynasties ?? []).every(d => d.unrest < 30) ? 0.6 : 0.1;
    case 'honours':
      return (civ.dynasties ?? []).some(d => d.unrest >= 40) ? 0.5 : 0.2;
    case 'trinkets':
      return civ.trinkets.length ? 0.9 : 0.3;
    case 'civil-war':
      return civ.civilWar ? 0.6 : 0.02;
    case 'declare-war':
      return civ.warPlan || (personalityOf(s.settings.map.seed, civ)?.war ?? 1) > 1.1 ? 0.4 : 0.05;
  }
  return 0.3;
}

/** The AI's culture: open a Tome that suits it, buy the likeliest missions, buy the major. */
export function aiCulture(s: GameState, civ: Civ, rng: Rng) {
  if (civ.independent || civ.raiders) return;
  const c = civ.culture;
  if (c.pickDue && !c.tome) {
    const pers = personalityOf(s.settings.map.seed, civ);
    const coastal = s.cities.some(x => x.civId === civ.id && isCoastal(s, x));
    const towns = s.cities.filter(x => x.civId === civ.id).length;
    let best: Domain | null = null;
    let bv = -Infinity;
    for (const d of DOMAIN_LIST) {
      if (pickProblem(civ, d)) continue;
      const pool = tomePool(civ, d);
      const v =
        pool.reduce((a, n) => a + n.tags.filter(t => civ.leanings.includes(t)).length, 0) * 1.5 +
        ((pers && LEAN[pers.id]?.[d]) ?? 0) +
        (d === 'seafaring' && !coastal ? -6 : 0) +
        // the ranks of settlement: a charter once there are towns to make a city of
        (d === 'society' && towns >= 3 && pool.some(n => n.id === 'city-charter') ? 3 : 0) +
        rng() * 3;
      if (v > bv) [best, bv] = [d, v];
    }
    if (best) pickTome(s, civ.id, best);
  }
  const t = c.tome;
  if (!t) return;
  if (t.major === 'open') {
    if (c.points >= majorCost(s, civ, t.age)) buyMajor(s, civ.id);
    return;
  }
  const cost = missionCost(s, civ, t.age);
  if (c.points < cost) return;
  const x = survey(s, civ);
  const active = t.taken.filter(id => !t.done.includes(id)).length;
  const open = t.offered
    .filter(m => !t.taken.includes(m.node))
    .map(m => ({
      m,
      v: aiOdds(s, civ, m, t.age, x) + (m.node === 'city-charter' ? 0.4 : 0) + rng() * 0.1,
    }))
    .sort((a, b) => b.v - a.v);
  if (!open.length) return;
  // a sure thing at once; otherwise two at a time, more when culture piles up; long shots last
  const best = open[0];
  if (best.v < 0.25 && c.points < cost * 3) return;
  if (best.v >= 1 || active < 2 || c.points >= cost * 3) buyMission(s, civ.id, best.m.node);
}

export const CULTURE_COUNT = CULTURE_LIST.length;
