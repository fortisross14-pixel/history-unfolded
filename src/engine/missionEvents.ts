/**
 * Mission events: when a culture mission (culture.ts, tomes.ts) has stalled, the realm is offered
 * a way to move it, at a price, against something good on its own. "Raiders gather on your
 * border": let them come (a battle to win) or trade with them (gold).
 *
 * - When: a people with an active mission that has not moved for STALL_TURNS (or is still under
 *   half after SLOW_TURNS) may get one, CHANCE a turn, at most one every GAP turns.
 * - The player's come through the realm-event queue (realmEvents.ts) and share its pacing: never
 *   two pending, never two close together. AI peoples answer theirs at once (aiAnswer).
 * - Each event offers the choice that serves the mission first (tagged with the mission) and one
 *   or two that do not.
 * - State: civ.missionEvents (optional; older saves have none).
 */
import { AREA_NAMES, MAX_LEVEL, REVOLT_AT, XP_PER_LEVEL, type Area } from '../data/dynasties.ts';
import { GOODS } from '../data/goods.ts';
import { DEFAULT_LOADOUT, ITEMS } from '../data/items.ts';
import { MAJOR_AT } from '../data/tomes.ts';
import { SLOT_TYPES } from '../data/slots.ts';
import { ageOf } from '../data/techs.ts';
import { WONDERS } from '../data/wonders.ts';
import { missionLabel, missionProgress } from './culture.ts';
import { PACT_TURNS, remember } from './diplomacy.ts';
import {
  assignGovernor,
  awardTrinket,
  chooseSide,
  giveTrinket,
  grantHonours,
  governorOf,
  honoursCost,
  levelOf,
  powerOf,
  riseHouse,
  rulerOf,
  totalLevels,
} from './dynasty.ts';
import {
  centreProblem,
  cityDistricts,
  emptySlot,
  invalidateMarkets,
  isCentre,
  slotProblem,
} from './economy.ts';
import {
  addCohorts,
  atWar,
  buildShip,
  declareWar,
  formationStrength,
  isWaterHex,
  log,
  MIN_CITY_POP,
  spawnFormation,
  techCost,
  trainSettlers,
} from './game.ts';
import { distance, within } from './hex.ts';
import { isPassableLand } from './mapgen.ts';
import { civMods } from './mods.ts';
import { RAIDERS_END_AGE, raiderCiv } from './raiders.ts';
import type { Choice, Ctx, EventDef, EventKind, Subject } from './realmEvents.ts';
import { hashSeed, mulberry32, type Rng } from './rng.ts';
import { MANDATES, survey } from './tomes.ts';
import type { City, Civ, Dynasty, Formation, GameState, TomeMission } from './types.ts';
import { COHORT_SIZE, COMMAND_CAP, isRanged, loadoutCost, loadoutProblem } from './units.ts';
import { wonderProblem, startWonder } from './wonders.ts';
import { BEASTS, refArmy } from './wildlife.ts';

/** turns without progress before a mission counts as stalled */
export const STALL_TURNS = 5;
/** turns after which a mission still under half counts as stalled */
export const SLOW_TURNS = 8;
/** chance a turn of a mission event while one is stalled */
export const CHANCE = 0.4;
/** turns between two mission events of one people */
export const GAP = 7;
/** a foe called up by an event that nobody fights leaves after this many turns */
const FOE_TURNS = 20;
/**
 * Strength of a foe an event calls up, against the people's usual army: about 9 fights in 10 for
 * that army (a beast pack as wildlife.ts sizes them; raiders, on foot and unarmoured, a little less).
 */
const FOE_RATIO = { raiders: 0.8, wolves: 0.9 };
/** turns a "boost" choice lasts */
export const BOOST_TURNS = 10;

export interface MissionEventState {
  /** turn of the last mission event */
  last?: number;
  /** per active mission (by its culture choice id): best progress so far, when it came, when bought */
  track?: Record<string, { have: number; turn: number; since: number }>;
  /** foes called up by events, gone after a while if no one fights them */
  foes?: { fid: number; until: number }[];
  /** a yield raised for a few turns ("boost or bank") */
  boost?: { key: 'sciencePct' | 'goldPct' | 'culturePct'; pct: number; until: number };
}

/** A choice with a rough worth in gold, for the AI. */
type MChoice = Choice & { worth?: number };

export interface MissionEventSpec {
  task: string;
  kind: EventKind;
  title: (c: Ctx) => string;
  text: (c: Ctx) => string;
  /** what it is about (a town, a house…), or null when it cannot happen now */
  subject?: (s: GameState, civ: Civ, r: Rng) => Subject | null;
  /** the choice that serves the mission */
  advance: (c: Ctx) => MChoice;
  /** the tempting others */
  others: (c: Ctx) => MChoice[];
  /**
   * What the advancing choice moves: the mandate's own measure by default, or the opportunity it
   * makes (a foe to beat, a lair to clear) for mandates counted by deeds.
   */
  gauge?: (s: GameState, civ: Civ) => number;
  /**
   * a mission choice too grave to make by default (a war): it comes last, so a choice left open
   * at turn end takes the safe one, and the AI makes it only when the major hangs on it
   */
  grave?: boolean;
}

// ---------------------------------------------------------------- helpers

const grid = (s: GameState) => ({ w: s.map.w, h: s.map.h });
const mine = (s: GameState, civ: Civ) => s.cities.filter(c => c.civId === civ.id);
const capital = (s: GameState, civ: Civ) => mine(s, civ).sort((a, b) => a.id - b.id)[0];
const age = (civ: Civ) => Math.max(1, ageOf(civ.techs));
const leadAge = (s: GameState) =>
  Math.max(1, ...s.civs.filter(c => c.alive && !c.independent).map(c => ageOf(c.techs)));
/** Sums grow with the ages, so a choice keeps its weight. */
const scale = (civ: Civ, base: number) => Math.round(base * (1 + 0.5 * (age(civ) - 1)));
const pick = <T>(r: Rng, xs: T[]): T | undefined =>
  xs.length ? xs[Math.floor(r() * xs.length)] : undefined;
const payGold = (n: number) => (c: Ctx) =>
  c.civ.gold < n ? `Needs ${n} gold (you have ${Math.floor(c.civ.gold)}).` : null;
const payCulture = (n: number) => (c: Ctx) =>
  c.civ.culture.points < n
    ? `Needs ${n} culture (you have ${Math.floor(c.civ.culture.points)}).`
    : null;
const both =
  (...fs: ((c: Ctx) => string | null)[]) =>
  (c: Ctx) =>
    fs.map(f => f(c)).find(Boolean) ?? null;
const culture = (c: Ctx, n: number) =>
  (c.civ.culture.points = Math.max(0, c.civ.culture.points + n));
const houses = (civ: Civ) => civ.dynasties ?? [];
const houseOf = (c: Ctx) => c.house!;
const measureOf = (s: GameState, civ: Civ, task: string) => {
  const md = MANDATES[task];
  return md?.measure ? md.measure(s, civ, survey(s, civ)) : 0;
};
const deed = (civ: Civ, k: string) => civ.culture.deeds?.[k] ?? 0;
const currentTechCost = (c: Ctx) =>
  c.civ.researching ? techCost(c.s, c.civ, c.civ.researching) : 40 * age(c.civ);
/** +n xp in an area: enough for whole levels when n is a multiple of XP_PER_LEVEL */
const study = (d: Dynasty, a: Area, levels = 1) => {
  d.xp ??= {};
  d.xp[a] = (d.xp[a] ?? 0) + XP_PER_LEVEL * levels;
};
const weakestArea = (d: Dynasty): Area =>
  (Object.keys(AREA_NAMES) as Area[]).sort((a, b) => levelOf(d, a) - levelOf(d, b))[0];
const bestArea = (d: Dynasty): Area =>
  (Object.keys(AREA_NAMES) as Area[])
    .filter(a => levelOf(d, a) < MAX_LEVEL)
    .sort((a, b) => levelOf(d, b) - levelOf(d, a))[0] ?? 'gold';

/** A free hex of open land dmin..dmax from a hex. */
function openSpot(s: GameState, near: number, dmin = 2, dmax = 3): number | undefined {
  const g = grid(s);
  const opts = within(g, near, dmax).filter(
    h =>
      distance(g, near, h) >= dmin &&
      !isWaterHex(s, h) &&
      isPassableLand(s.map, h) &&
      !s.formations.some(f => f.hex === h) &&
      !s.cities.some(c => c.hex === h) &&
      !s.raiders?.camps.some(c => c.hex === h) &&
      !s.raiders?.lairs?.some(l => l.hex === h),
  );
  return opts.length ? opts[(s.turn * 7 + near) % opts.length] : undefined;
}

/**
 * Call up a hostile band (raiders or a beast pack) next to a settlement, sized against the
 * people's usual army (wildlife.ts refArmy) so that army beats it about nine times in ten.
 */
export function spawnFoe(
  s: GameState,
  civ: Civ,
  near: City,
  kind: 'raiders' | 'wolves',
  ratio = FOE_RATIO[kind],
): Formation | null {
  const hex = openSpot(s, near.hex);
  if (hex === undefined) return null;
  const rc = raiderCiv(s);
  const loadout =
    kind === 'wolves'
      ? { ...BEASTS.wolves.loadout }
      : { ...DEFAULT_LOADOUT, weapon: leadAge(s) >= 2 ? 'axe' : 'spear' };
  const f = spawnFormation(
    s,
    rc.id,
    hex,
    1,
    kind === 'wolves' ? BEASTS.wolves.pack : 'Raider band',
  );
  f.cohorts[0].loadout = { ...loadout };
  const one = Math.max(1, formationStrength(s, f));
  const want = Math.min(COMMAND_CAP, Math.max(1, (refArmy(s, civ.id) * ratio) / one));
  const full = Math.floor(want);
  const part = Math.round((want - full) * COHORT_SIZE);
  if (full > 1) addCohorts(s, f, full - 1);
  if (part >= 25 && full < COMMAND_CAP) {
    addCohorts(s, f, 1);
    f.cohorts[f.cohorts.length - 1].strength = part;
  }
  for (const co of f.cohorts) co.loadout = { ...loadout };
  f.moves = 0;
  // raiders of the early ages ride at the town (raiders.ts); later, and beasts, they wait
  if (kind === 'raiders' && leadAge(s) <= RAIDERS_END_AGE)
    s.raiders!.bands.push({ fid: f.id, camp: hex });
  civ.missionEvents ??= {};
  (civ.missionEvents.foes ??= []).push({ fid: f.id, until: s.turn + FOE_TURNS });
  return f;
}

/** Hostile bands and packs within reach of a people's settlements. */
const foesNear = (s: GameState, civ: Civ, r = 4) => {
  const rc = s.raiders?.civ;
  if (rc === undefined) return 0;
  const g = grid(s);
  const ms = mine(s, civ);
  return s.formations.filter(
    f => f.civId === rc && f.kind === 'army' && ms.some(c => distance(g, c.hex, f.hex) <= r),
  ).length;
};
const lairsNear = (s: GameState, civ: Civ, r = 6) => {
  const g = grid(s);
  const ms = mine(s, civ);
  const near = (h: number) => ms.some(c => distance(g, c.hex, h) <= r);
  return (
    (s.raiders?.lairs ?? []).filter(l => near(l.hex)).length +
    (s.raiders?.camps ?? []).filter(c => near(c.hex)).length
  );
};

/** A free slot in one of the people's settlements where one of `types` may stand now. */
function freeSlot(
  s: GameState,
  civ: Civ,
  types: string[],
  order?: (a: City, b: City) => number,
): { city: number; district: number; slot: number; type: string } | null {
  const cities = [...mine(s, civ)].sort(order ?? ((a, b) => a.id - b.id));
  for (const c of cities) {
    // centre improvements (walls, barracks, markets…) go in the centre row, after slot 8
    for (const t of types) {
      if (!SLOT_TYPES[t]?.centreRow) continue;
      const centre = cityDistricts(s, c).find(isCentre);
      const why = centreProblem(s, c, t);
      if (!centre || (why && why !== 'Already in the queue.')) continue;
      const at = centre.slots.findIndex((x, i) => i >= 9 && x.type === t && !x.built);
      return { city: c.id, district: centre.id, slot: why ? at : -1, type: t };
    }
    for (const d of cityDistricts(s, c))
      for (let i = 0; i < 9; i++) {
        const x = d.slots[i];
        if (x.built) continue;
        for (const t of types) {
          if (x.type && x.type !== t) continue;
          if (slotProblem(s, civ.id, d.hex, isCentre(d), t, d.id)) continue;
          return { city: c.id, district: d.id, slot: i, type: t };
        }
      }
  }
  return null;
}
const encodeSlot = (f: { district: number; slot: number; type: string }) =>
  `${f.district}:${f.slot}:${f.type}`;
function finishSlot(s: GameState, code: string): boolean {
  const [d, i, t] = code.split(':');
  const dist = s.districts.find(x => x.id === Number(d));
  const at = Number(i);
  if (!dist || (at >= 0 && dist.slots[at]?.built)) return false;
  const sl = emptySlot(t);
  sl.built = true;
  sl.paid = true;
  sl.progress = SLOT_TYPES[t]?.build.prod ?? 0;
  if (at < 0) dist.slots.push(sl);
  else dist.slots[at] = sl;
  invalidateMarkets();
  return true;
}

const cityOf = (c: Ctx) => c.city!;
/** the army an event is about: its id first in `extra` */
const armyOf = (c: Ctx) =>
  c.s.formations.find(f => f.id === Number(c.extra?.split(':')[0]) && f.civId === c.civ.id);
const otherName = (c: Ctx) => c.other!.name;

/** Reveal the nearest unknown land and sea: `pts` points of the world. */
function reveal(s: GameState, civ: Civ, pts: number) {
  const home = capital(s, civ);
  if (!home) return;
  const g = grid(s);
  const want = Math.ceil((civ.explored.length * pts) / 100);
  const dark: number[] = [];
  for (let i = 0; i < civ.explored.length; i++) if (!civ.explored[i]) dark.push(i);
  dark.sort((a, b) => distance(g, home.hex, a) - distance(g, home.hex, b) || a - b);
  for (const h of dark.slice(0, want)) civ.explored[h] = 1;
}

/** A yield raised for BOOST_TURNS: read by civMods (mods.ts). */
const boost = (c: Ctx, key: 'sciencePct' | 'goldPct' | 'culturePct', pct: number) => {
  c.civ.missionEvents ??= {};
  c.civ.missionEvents.boost = { key, pct, until: c.s.turn + BOOST_TURNS };
};

// ---------------------------------------------------------------- the events

/** A guild offers to finish a building that a mission counts. */
function buildingEvent(
  task: string,
  types: string[] | ((s: GameState, civ: Civ) => string[]),
  kind: EventKind,
  title: string,
  who: string,
  alt: (c: Ctx) => MChoice,
  order?: (s: GameState) => (a: City, b: City) => number,
): MissionEventSpec {
  return {
    task,
    kind,
    title: c => `${title} in ${cityOf(c).name}`,
    text: c =>
      `${who} in ${cityOf(c).name} would put up a ${SLOT_TYPES[c.extra!.split(':')[2]].name.toLowerCase()} at once, for a price.`,
    subject: (s, civ) => {
      const ts = typeof types === 'function' ? types(s, civ) : types;
      const f = freeSlot(s, civ, ts, order?.(s));
      return f ? { city: f.city, extra: encodeSlot(f) } : null;
    },
    advance: c => {
      const t = SLOT_TYPES[c.extra!.split(':')[2]];
      const gold = scale(c.civ, 12 + t.build.prod * 2);
      return {
        label: `Build the ${t.name.toLowerCase()}`,
        effect: `−${gold} gold; a ${t.name.toLowerCase()} stands in ${cityOf(c).name}`,
        blocked: payGold(gold),
        worth: 20,
        apply: x => {
          x.civ.gold -= gold;
          finishSlot(x.s, x.extra!);
          return `The ${t.name.toLowerCase()} of ${cityOf(x).name} is finished.`;
        },
      };
    },
    others: c => [alt(c)],
  };
}

const sellLabour = (c: Ctx): MChoice => {
  const gold = scale(c.civ, 25);
  return {
    label: 'Hire them out',
    effect: `+${gold} gold`,
    worth: gold,
    apply: x => ((x.civ.gold += gold), 'They work for others and pay their dues.'),
  };
};
const feast = (c: Ctx): MChoice => {
  const n = scale(c.civ, 18);
  return {
    label: 'A festival instead',
    effect: `+${n} culture`,
    worth: n * 1.5,
    apply: x => (culture(x, n), 'The town sings for a week.'),
  };
};
const grain = (c: Ctx): MChoice => {
  const n = 40 + 20 * age(c.civ);
  return {
    label: 'Clear more fields',
    effect: `+${n} food in ${cityOf(c).name}`,
    worth: n * 0.6,
    apply: x => ((cityOf(x).food += n), 'The new fields are sown.'),
  };
};
/** Half the current research, as the owner's example: a tech 50% done. */
const halfTech = (c: Ctx, goldBase = 15): MChoice => {
  const sci = Math.round(currentTechCost(c) * 0.5);
  const gold = scale(c.civ, goldBase);
  return {
    label: 'Half a tech',
    effect: gold ? `+${sci} science; −${gold} gold` : `+${sci} science`,
    blocked: payGold(gold),
    worth: sci - gold,
    apply: x => ((x.civ.science += sci), (x.civ.gold -= gold), 'The scholars fill a book.'),
  };
};
const goldFor = (n: number, label: string, out: string) => (c: Ctx) => {
  const gold = scale(c.civ, n);
  return {
    label,
    effect: `+${gold} gold`,
    worth: gold,
    apply: (x: Ctx) => ((x.civ.gold += gold), out),
  } as MChoice;
};

/** A house grows in an area (the mission), or something else for the realm. */
function houseStudy(
  task: string,
  area: (c: Ctx) => Area,
  title: (c: Ctx) => string,
  find: (s: GameState, civ: Civ) => Dynasty | undefined,
  alt: (c: Ctx) => MChoice,
  extra?: (s: GameState, civ: Civ, d: Dynasty) => Subject,
): MissionEventSpec {
  return {
    task,
    kind: 'court',
    title,
    text: c =>
      `House ${houseOf(c).name} asks for patrons to study ${AREA_NAMES[area(c)].toLowerCase()}.`,
    subject: (s, civ) => {
      const d = find(s, civ);
      return d ? { house: d.id, ...(extra?.(s, civ, d) ?? {}) } : null;
    },
    advance: c => {
      const gold = scale(c.civ, 30);
      const a = area(c);
      return {
        label: `House ${houseOf(c).name} studies`,
        effect: `−${gold} gold; House ${houseOf(c).name}: +1 level in ${AREA_NAMES[a]}`,
        blocked: payGold(gold),
        worth: 15,
        apply: x => {
          x.civ.gold -= gold;
          study(houseOf(x), a);
          return `House ${houseOf(x).name} grows in ${AREA_NAMES[a].toLowerCase()}.`;
        },
      };
    },
    others: c => [alt(c)],
  };
}

/** The house governing a settlement that has one of `ids` built, with the best level in `a`. */
function governorWith(s: GameState, civ: Civ, a: Area, ids: string[]) {
  let best: { d: Dynasty; c: City } | undefined;
  for (const c of mine(s, civ)) {
    const g = governorOf(s, c);
    if (!g || levelOf(g, a) >= MAX_LEVEL) continue;
    const has = cityDistricts(s, c).some(d =>
      d.slots.some(x => x.built && x.type && ids.includes(x.type)),
    );
    if (has && (!best || levelOf(g, a) > levelOf(best.d, a))) best = { d: g, c };
  }
  return best;
}

const raiderBattle = (
  task: string,
  title: string,
  text: (c: Ctx) => string,
  kind: 'raiders' | 'wolves',
  gauge: (s: GameState, civ: Civ) => number,
  alt: (c: Ctx) => MChoice,
): MissionEventSpec => ({
  task,
  kind: 'war',
  title: c => `${title} near ${cityOf(c).name}`,
  text,
  subject: (s, civ, r) => {
    const c = pick(
      r,
      mine(s, civ).filter(x => openSpot(s, x.hex) !== undefined),
    );
    return c ? { city: c.id } : null;
  },
  advance: c => ({
    label: kind === 'wolves' ? 'Drive them into the open' : 'Let them come',
    effect: `a ${kind === 'wolves' ? 'wolf pack' : 'raider band'} near ${cityOf(c).name}, a little weaker than your army`,
    worth: -10,
    apply: x => {
      const f = spawnFoe(x.s, x.civ, cityOf(x), kind);
      return f
        ? `${f.name} of ${f.cohorts.length} cohorts by ${cityOf(x).name}: beat them.`
        : 'They never come.';
    },
  }),
  others: c => [alt(c)],
  gauge,
});

const SPECS: MissionEventSpec[] = [
  // ---- war
  raiderBattle(
    'win-battles',
    'Raiders gather',
    c => `Riders gather on the hills by ${cityOf(c).name}, waiting to see who is strong.`,
    'raiders',
    (s, civ) => deed(civ, 'wins') + foesNear(s, civ),
    c => {
      const gold = scale(c.civ, 30);
      return {
        label: 'Trade with them',
        effect: `+${gold} gold; they ride on`,
        worth: gold,
        apply: x => ((x.civ.gold += gold), 'Horses for grain; the riders move on.'),
      };
    },
  ),
  raiderBattle(
    'kills',
    'A war host',
    c => `A host of raiders camps by ${cityOf(c).name}, spoiling for a fight.`,
    'raiders',
    (s, civ) => civ.kills + foesNear(s, civ) * 1000,
    c => {
      const gold = scale(c.civ, 25);
      const n = scale(c.civ, 10);
      return {
        label: 'Pay them off',
        effect: `−${gold} gold; +${n} culture`,
        blocked: payGold(gold),
        worth: n * 1.5 - gold + 25,
        apply: x => ((x.civ.gold -= gold), culture(x, n), 'They take the silver and go.'),
      };
    },
  ),
  raiderBattle(
    'beasts',
    'Wolves on the roads',
    c => `Wolves take sheep from the folds of ${cityOf(c).name} every night.`,
    'wolves',
    (s, civ) => deed(civ, 'beasts') + foesNear(s, civ),
    c => {
      const gold = scale(c.civ, 15);
      return {
        label: 'Pay the trappers',
        effect: `−${gold} gold; +40 food in ${cityOf(c).name}`,
        blocked: payGold(gold),
        worth: 24 - gold + 15,
        apply: x => ((x.civ.gold -= gold), (cityOf(x).food += 40), 'The folds are safe again.'),
      };
    },
  ),
  {
    task: 'lairs',
    kind: 'war',
    title: c => `A den near ${cityOf(c).name}`,
    text: c =>
      `Hunters from ${cityOf(c).name} found a wolf den in the hills, not far from the road.`,
    subject: (s, civ, r) => {
      const c = pick(
        r,
        mine(s, civ).filter(x => openSpot(s, x.hex, 3, 4) !== undefined),
      );
      return c ? { city: c.id } : null;
    },
    advance: c => ({
      label: 'Mark it for the army',
      effect: `a wolf den 3–4 hexes from ${cityOf(c).name}: clear it`,
      worth: -5,
      apply: x => {
        const hex = openSpot(x.s, cityOf(x).hex, 3, 4);
        if (hex === undefined) return 'The den is empty.';
        raiderCiv(x.s);
        (x.s.raiders!.lairs ??= []).push({ hex, kind: 'wolves', next: x.s.turn });
        return 'The den is on the map.';
      },
    }),
    others: c => [
      {
        label: 'Leave it to the hunters',
        effect: `+${scale(c.civ, 15)} gold; 3 furs in ${cityOf(c).name}`,
        worth: scale(c.civ, 15) + 10,
        apply: x => {
          x.civ.gold += scale(x.civ, 15);
          cityOf(x).stockpile.furs = (cityOf(x).stockpile.furs ?? 0) + 3;
          return 'The hunters bring pelts.';
        },
      },
    ],
    gauge: (s, civ) => deed(civ, 'lairs') + lairsNear(s, civ),
  },
  {
    task: 'declare-war',
    kind: 'war',
    title: c => `An insult from the ${otherName(c)}`,
    text: c => `The ${otherName(c)} mocked your envoy before their whole court.`,
    subject: (s, civ, r) => {
      const opts = civ.met.filter(id => {
        const o = s.civs[id];
        return (
          o?.alive &&
          !o.raiders &&
          !o.independent &&
          (civ.isPlayer || !o.isPlayer) &&
          !atWar(s, civ.id, id) &&
          !s.treaties.some(
            t =>
              t.kind === 'alliance' &&
              ((t.a === civ.id && t.b === id) || (t.b === civ.id && t.a === id)),
          )
        );
      });
      const id = pick(r, opts);
      return id === undefined ? null : { civ: id };
    },
    advance: c => ({
      label: 'Answer with war',
      effect: `war with the ${otherName(c)}`,
      worth: -60,
      apply: x => declareWar(x.s, x.civ.id, x.other!.id).msg ?? 'War.',
    }),
    grave: true,
    others: c => {
      const gold = scale(c.civ, 30);
      return [
        {
          label: 'Take their apology',
          effect: `+${gold} gold; the ${otherName(c)} think better of you`,
          worth: gold + 10,
          apply: x => {
            x.civ.gold += gold;
            remember(x.s, x.other!.id, x.civ.id, 'gift', 'Took our apology', 10);
            return 'They pay for the insult.';
          },
        },
      ];
    },
  },
  {
    task: 'strong-army',
    kind: 'war',
    title: () => 'Veterans offer to drill your troops',
    text: c => `Old soldiers would drill the ${armyOf(c)?.name ?? 'army'} until it fights as one.`,
    subject: (s, civ) => {
      const f = s.formations
        .filter(x => x.civId === civ.id && x.kind === 'army')
        .sort((a, b) => formationStrength(s, b) - formationStrength(s, a))[0];
      return f ? { extra: String(f.id) } : null;
    },
    advance: c => {
      const gold = scale(c.civ, 30);
      return {
        label: 'Drill them',
        effect: `−${gold} gold; ${armyOf(c)?.name ?? 'the army'}: +2 experience, +1 cohort`,
        blocked: payGold(gold),
        worth: 20,
        apply: x => {
          const f = armyOf(x);
          if (!f) return 'The army is gone.';
          x.civ.gold -= gold;
          for (const co of f.cohorts) co.xp = Math.min(5, co.xp + 2);
          if (f.cohorts.length < COMMAND_CAP) {
            addCohorts(x.s, f, 1);
            f.cohorts[f.cohorts.length - 1].loadout = { ...f.cohorts[0].loadout };
          }
          return `The ${f.name} drills hard.`;
        },
      };
    },
    others: c => [goldFor(25, 'Settle them on farms', 'The veterans take up the plough.')(c)],
  },
  {
    task: 'ranged',
    kind: 'war',
    title: () => 'Bowyers at court',
    text: () => 'A guild of bowyers offers its best work to the crown.',
    subject: (s, civ) => {
      const weapon = Object.keys(ITEMS).find(
        id => ITEMS[id].ranged && !loadoutProblem({ ...DEFAULT_LOADOUT, weapon: id }, civ.techs),
      );
      const f = s.formations.find(
        x => x.civId === civ.id && x.kind === 'army' && x.cohorts.some(co => !isRanged(co.loadout)),
      );
      return weapon && f ? { extra: `${f.id}:${weapon}` } : null;
    },
    advance: c => {
      const gold = scale(c.civ, 25);
      const weapon = c.extra!.split(':')[1];
      const w = ITEMS[weapon].name.toLowerCase();
      return {
        label: 'Arm two cohorts',
        effect: `−${gold} gold; 2 cohorts take the ${w}`,
        blocked: payGold(gold),
        worth: 10,
        apply: x => {
          x.civ.gold -= gold;
          const f = armyOf(x);
          if (!f) return 'The army is gone.';
          let n = 0;
          for (const co of f.cohorts)
            if (n < 2 && !isRanged(co.loadout)) {
              co.loadout = { ...co.loadout, weapon };
              co.designId = null;
              n++;
            }
          return `${f.name} has ${n} more cohorts of archers.`;
        },
      };
    },
    others: c => [goldFor(25, 'Sell the bows abroad', 'The bows fetch a good price.')(c)],
  },
  {
    task: 'cohorts',
    kind: 'war',
    title: c => `Volunteers in ${cityOf(c).name}`,
    text: c => `Young men of ${cityOf(c).name} ask to serve under the banner.`,
    subject: (s, civ) => {
      const c = [...mine(s, civ)].sort((a, b) => b.pop - a.pop)[0];
      return c && c.pop >= MIN_CITY_POP + 300 ? { city: c.id } : null;
    },
    advance: c => ({
      label: 'Raise them',
      effect: `−300 people in ${cityOf(c).name}; 3 new cohorts`,
      worth: 0,
      apply: x => {
        cityOf(x).pop -= 300;
        spawnFormation(x.s, x.civ.id, cityOf(x).hex, 3, 'Volunteers');
        return 'Three cohorts muster.';
      },
    }),
    others: c => [
      {
        label: 'Send them to the fields',
        effect: `+${scale(c.civ, 20)} gold; +40 food in ${cityOf(c).name}`,
        worth: scale(c.civ, 20) + 24,
        apply: x => (
          (x.civ.gold += scale(x.civ, 20)),
          (cityOf(x).food += 40),
          'The harvest is brought in early.'
        ),
      },
    ],
  },
  {
    task: 'capture',
    kind: 'war',
    title: c => `Traitors in ${cityOf(c).name}`,
    text: c => `Gate-wardens of ${cityOf(c).name} will look away, if they are paid.`,
    subject: (s, civ, r) => {
      const c = pick(
        r,
        s.cities.filter(x => x.civId !== civ.id && atWar(s, civ.id, x.civId) && x.guard > 0),
      );
      return c ? { city: c.id } : null;
    },
    advance: c => {
      const gold = scale(c.civ, 35);
      return {
        label: 'Pay the wardens',
        effect: `−${gold} gold; ${cityOf(c).name} loses its guard`,
        blocked: payGold(gold),
        worth: 0,
        apply: x => ((x.civ.gold -= gold), (cityOf(x).guard = 0), 'The gates will open.'),
      };
    },
    others: c => [goldFor(20, 'Buy their maps', 'The maps show every road.')(c)],
    gauge: (s, civ) =>
      (civ.captured ?? 0) + s.cities.filter(x => atWar(s, civ.id, x.civId) && x.guard <= 0).length,
  },
  buildingEvent('walls', ['palisade', 'walls'], 'war', 'Masons', 'Masons', feast),
  buildingEvent(
    'barracks',
    ['barracks', 'armoury'],
    'war',
    'Drill-masters',
    'Drill-masters',
    sellLabour,
  ),
  // ---- knowledge
  {
    task: 'techs',
    kind: 'knowledge',
    title: () => 'A scholar from afar',
    text: () => 'A famous scholar offers to finish the work of your academies.',
    subject: (_s, civ) => (civ.researching ? {} : null),
    advance: c => {
      const need = Math.max(1, Math.ceil(currentTechCost(c) - c.civ.science));
      const gold = scale(c.civ, 30);
      const cul = scale(c.civ, 10);
      return {
        label: 'Finish the work',
        effect: `+${need} science (the current tech done); −${gold} gold; −${cul} culture`,
        blocked: both(payGold(gold), payCulture(cul)),
        worth: need - gold - cul * 1.5,
        apply: x => {
          x.civ.science += need;
          x.civ.gold -= gold;
          culture(x, -cul);
          return 'The scholar finishes the work.';
        },
      };
    },
    others: c => [feast({ ...c, city: capital(c.s, c.civ) })],
    gauge: (s, civ) =>
      civ.techs.length +
      (civ.researching && civ.science >= techCost(s, civ, civ.researching) ? 1 : 0),
  },
  {
    task: 'science',
    kind: 'knowledge',
    title: () => 'The academies ask for patrons',
    text: () => 'Your scholars ask for patrons, or for a prize to share now.',
    advance: c => {
      const gold = scale(c.civ, 30);
      return {
        label: 'Fund the academies',
        effect: `−${gold} gold; +30% science; ${BOOST_TURNS} turns`,
        blocked: payGold(gold),
        worth: (c.civ.stats?.science ?? 4) * 3 - gold,
        apply: x => ((x.civ.gold -= gold), boost(x, 'sciencePct', 30), 'Lamps burn late.'),
      };
    },
    others: c => [halfTech(c, 0)],
    gauge: (s, civ) => civMods(s, civ.id).sciencePct,
  },
  buildingEvent(
    'schools',
    ['school', 'library', 'university'],
    'knowledge',
    'Teachers',
    'Teachers',
    c => halfTech(c),
  ),
  {
    task: 'explore',
    kind: 'knowledge',
    title: () => 'A traveller’s map',
    text: () => 'A traveller sells a map of lands your scouts have never seen.',
    advance: c => {
      const gold = scale(c.civ, 25);
      return {
        label: 'Buy the map',
        effect: `−${gold} gold; 6% more of the world explored`,
        blocked: payGold(gold),
        worth: 5,
        apply: x => ((x.civ.gold -= gold), reveal(x.s, x.civ, 6), 'New coasts on the map.'),
      };
    },
    others: c => [halfTech(c, 0)],
  },
  {
    task: 'met',
    kind: 'people',
    title: c => `Envoys of the ${otherName(c)}`,
    text: c => `Envoys of the ${otherName(c)}, a people you have never met, wait at the border.`,
    subject: (s, civ, r) => {
      const opts = s.civs.filter(
        o => o.alive && o.id !== civ.id && !o.raiders && !civ.met.includes(o.id),
      );
      const o =
        pick(
          r,
          opts.filter(x => !x.independent),
        ) ?? pick(r, opts);
      return o ? { civ: o.id } : null;
    },
    advance: c => {
      const gold = scale(c.civ, 20);
      return {
        label: 'Receive them',
        effect: `−${gold} gold in gifts; you meet the ${otherName(c)}`,
        blocked: payGold(gold),
        worth: 10,
        apply: x => {
          x.civ.gold -= gold;
          const o = x.other!;
          if (!x.civ.met.includes(o.id)) x.civ.met.push(o.id);
          if (!o.met.includes(x.civ.id)) o.met.push(x.civ.id);
          log(x.s, x.civ.id, `${x.civ.name} and the ${o.name} have met.`);
          return `The ${o.name} are known to you now.`;
        },
      };
    },
    others: c => [feast({ ...c, city: capital(c.s, c.civ) })],
  },
  buildingEvent(
    'buildings',
    (s, civ) =>
      Object.values(SLOT_TYPES)
        .filter(
          t =>
            !t.fixed &&
            !t.centreRow &&
            t.group !== 'residential' &&
            t.role !== 'great' &&
            (!t.tech || civ.techs.includes(t.tech)),
        )
        .sort((a, b) => a.build.prod - b.build.prod)
        .map(t => t.id)
        .slice(0, 12),
    'land',
    'Builders',
    'A crew of builders',
    sellLabour,
  ),
  // ---- economy
  {
    task: 'gold',
    kind: 'trade',
    title: () => 'Merchants seek a charter',
    text: () => 'The merchants offer a share now, or a charter that pays for years.',
    advance: c => {
      const cul = scale(c.civ, 15);
      return {
        label: 'Grant the charter',
        effect: `−${cul} culture; +30% gold; ${BOOST_TURNS} turns`,
        blocked: payCulture(cul),
        worth: (c.civ.stats?.income ?? 4) * 3 - cul * 1.5,
        apply: x => (culture(x, -cul), boost(x, 'goldPct', 30), 'The markets grow busy.'),
      };
    },
    others: c => [goldFor(40, 'Take the share', 'A chest of silver.')(c)],
    gauge: (s, civ) => civMods(s, civ.id).goldPct,
  },
  {
    task: 'treasury',
    kind: 'trade',
    title: () => 'A banker’s loan',
    text: () => 'A banking family offers a large loan, paid back in favours at court.',
    advance: c => {
      const gold = scale(c.civ, 60);
      const cul = scale(c.civ, 15);
      return {
        label: 'Take the loan',
        effect: `+${gold} gold; −${cul} culture; every house +10 unrest`,
        blocked: payCulture(cul),
        worth: gold - cul * 1.5 - 20,
        apply: x => {
          x.civ.gold += gold;
          culture(x, -cul);
          for (const d of houses(x.civ)) d.unrest = Math.min(REVOLT_AT - 1, d.unrest + 10);
          return 'The treasury fills.';
        },
      };
    },
    others: c => [feast({ ...c, city: capital(c.s, c.civ) })],
  },
  {
    task: 'goods',
    kind: 'trade',
    title: () => 'A caravan of strange goods',
    text: () => 'A caravan brings goods your markets have never stocked.',
    subject: (s, civ) => {
      const cap = capital(s, civ);
      if (!cap) return null;
      const held = new Set<string>();
      for (const c of mine(s, civ))
        for (const [k, n] of Object.entries(c.stockpile)) if (n >= 1) held.add(k);
      const fresh = Object.keys(GOODS)
        .filter(k => GOODS[k].kind === 'raw' && !held.has(k))
        .slice(0, 2);
      return fresh.length === 2 ? { city: cap.id, extra: fresh.join(',') } : null;
    },
    advance: c => {
      const gold = scale(c.civ, 25);
      const ks = c.extra!.split(',');
      return {
        label: 'Buy a little of all',
        effect: `−${gold} gold; ${ks.map(k => `+5 ${GOODS[k].name.toLowerCase()}`).join('; ')}`,
        blocked: payGold(gold),
        worth: 10,
        apply: x => {
          x.civ.gold -= gold;
          for (const k of ks) cityOf(x).stockpile[k] = (cityOf(x).stockpile[k] ?? 0) + 5;
          invalidateMarkets();
          return 'The stalls fill with new wares.';
        },
      };
    },
    others: c => [goldFor(25, 'Tax the caravan', 'The caravan pays its toll.')(c)],
  },
  buildingEvent('markets', ['market', 'bank'], 'trade', 'Traders', 'Traders', feast),
  buildingEvent('mines', ['mine'], 'land', 'Prospectors', 'Prospectors', sellLabour),
  {
    task: 'treaties',
    kind: 'people',
    title: c => `The ${otherName(c)} offer friendship`,
    text: c => `The ${otherName(c)} offer a pact of peace, sealed with gifts from you.`,
    subject: (s, civ, r) => {
      const id = pick(
        r,
        civ.met.filter(
          id =>
            s.civs[id]?.alive &&
            !s.civs[id].raiders &&
            (civ.isPlayer || !s.civs[id].isPlayer) &&
            !atWar(s, civ.id, id) &&
            !s.treaties.some(t => (t.a === civ.id && t.b === id) || (t.b === civ.id && t.a === id)),
        ),
      );
      return id === undefined ? null : { civ: id };
    },
    advance: c => {
      const gold = scale(c.civ, 25);
      return {
        label: 'Seal the pact',
        effect: `−${gold} gold; a pact with the ${otherName(c)}`,
        blocked: payGold(gold),
        worth: 5,
        apply: x => {
          x.civ.gold -= gold;
          x.s.treaties.push({
            kind: 'pact',
            a: x.civ.id,
            b: x.other!.id,
            since: x.s.turn,
            until: x.s.turn + PACT_TURNS,
          });
          return `A pact with the ${x.other!.name}.`;
        },
      };
    },
    others: c => [
      {
        label: 'Ask for gifts instead',
        effect: `+${scale(c.civ, 20)} gold; the ${otherName(c)} think less of you`,
        worth: scale(c.civ, 20) - 5,
        apply: x => {
          x.civ.gold += scale(x.civ, 20);
          remember(x.s, x.other!.id, x.civ.id, 'greed', 'Asked for gifts', -10);
          return 'They pay, coldly.';
        },
      },
    ],
  },
  buildingEvent(
    'farms',
    ['farm', 'pasture', 'fishing-dock'],
    'land',
    'Farmers',
    'Settlers from the hills',
    feast,
  ),
  {
    task: 'roads',
    kind: 'land',
    title: c => `Road gangs at ${cityOf(c).name}`,
    text: c => `A gang of labourers would pave the tracks around ${cityOf(c).name}.`,
    subject: (s, civ) => {
      for (const c of mine(s, civ)) {
        const free = within(grid(s), c.hex, 2).filter(
          h => !s.roads[h] && !isWaterHex(s, h) && isPassableLand(s.map, h),
        );
        if (free.length >= 3) return { city: c.id };
      }
      return null;
    },
    advance: c => {
      const gold = scale(c.civ, 25);
      return {
        label: 'Lay the roads',
        effect: `−${gold} gold; 3 hexes of road by ${cityOf(c).name}`,
        blocked: payGold(gold),
        worth: 10,
        apply: x => {
          x.civ.gold -= gold;
          const g = grid(x.s);
          const free = within(g, cityOf(x).hex, 2)
            .filter(h => !x.s.roads[h] && !isWaterHex(x.s, h) && isPassableLand(x.s.map, h))
            .sort((a, b) => distance(g, cityOf(x).hex, a) - distance(g, cityOf(x).hex, b));
          for (const h of free.slice(0, 3)) x.s.roads[h] = 1;
          invalidateMarkets();
          return 'The roads are laid.';
        },
      };
    },
    others: c => [grain(c)],
  },
  // ---- society
  buildingEvent(
    'workshops',
    (_s, civ) =>
      Object.values(SLOT_TYPES)
        .filter(t => t.group === 'craft' && (!t.tech || civ.techs.includes(t.tech)))
        .map(t => t.id),
    'land',
    'Craftsmen',
    'Craftsmen',
    sellLabour,
    s => (a, b) =>
      cityDistricts(s, b)
        .flatMap(d => d.slots)
        .filter(x => x.built && x.type && SLOT_TYPES[x.type]?.group === 'craft').length -
      cityDistricts(s, a)
        .flatMap(d => d.slots)
        .filter(x => x.built && x.type && SLOT_TYPES[x.type]?.group === 'craft').length,
  ),
  ...(['settlements', 'found'] as const).map((task): MissionEventSpec => ({
    task,
    kind: 'people',
    title: c => `Pioneers in ${cityOf(c).name}`,
    text: c => `Families of ${cityOf(c).name} ask leave to found a town of their own.`,
    subject: (s, civ) => {
      const c = [...mine(s, civ)].sort((a, b) => b.pop - a.pop)[0];
      return c && c.pop >= MIN_CITY_POP + 1000 ? { city: c.id } : null;
    },
    advance: c => {
      const gold = scale(c.civ, 15);
      return {
        label: 'Let them go',
        effect: `−${gold} gold; settlers leave ${cityOf(c).name} (−1,000 people)`,
        blocked: payGold(gold),
        worth: 0,
        apply: x => {
          const r = trainSettlers(x.s, cityOf(x).id);
          if (r.ok) x.civ.gold -= gold;
          return r.msg ?? '';
        },
      };
    },
    others: c => [goldFor(25, 'Keep them home', 'They stay, and pay their taxes.')(c)],
    gauge: (s, civ) =>
      measureOf(s, civ, task) +
      s.formations.filter(f => f.civId === civ.id && f.kind === 'settlers').length,
  })),
  ...(['pop', 'grow'] as const).map((task): MissionEventSpec => ({
    task,
    kind: 'people',
    title: c => `Migrants at ${cityOf(c).name}`,
    text: c => `Families fleeing a hard winter ask to settle in ${cityOf(c).name}.`,
    subject: (s, civ) => {
      const c = [...mine(s, civ)].sort((a, b) => a.pop - b.pop)[0];
      return c ? { city: c.id } : null;
    },
    advance: c => {
      const gold = scale(c.civ, 25);
      return {
        label: 'Take them in',
        effect: `−${gold} gold; +1,000 people in ${cityOf(c).name}`,
        blocked: payGold(gold),
        worth: 30,
        apply: x => ((x.civ.gold -= gold), (cityOf(x).pop += 1000), 'New streets fill.'),
      };
    },
    others: c => [goldFor(25, 'Charge them for passage', 'They pay and move on.')(c)],
  })),
  buildingEvent('houses', ['houses'], 'people', 'Builders', 'Builders', grain),
  // ---- faith and arts
  buildingEvent('shrines', ['shrine', 'temple'], 'faith', 'Priests', 'Priests', feast),
  {
    task: 'faith',
    kind: 'faith',
    title: c => `A preacher in ${cityOf(c).name}`,
    text: c => `A preacher of your faith draws crowds in ${cityOf(c).name}.`,
    subject: (s, civ, r) => {
      if (civ.faith === undefined) return null;
      const c = pick(
        r,
        mine(s, civ).filter(x => x.faith !== civ.faith),
      );
      return c ? { city: c.id } : null;
    },
    advance: c => {
      const cul = scale(c.civ, 15);
      return {
        label: 'Support the preacher',
        effect: `−${cul} culture; ${cityOf(c).name} keeps your faith`,
        blocked: payCulture(cul),
        worth: 10 - cul * 1.5,
        apply: x => (culture(x, -cul), (cityOf(x).faith = x.civ.faith), 'The town turns.'),
      };
    },
    others: c => [goldFor(20, 'Tax the crowds', 'The collection plate is heavy.')(c)],
  },
  {
    task: 'culture',
    kind: 'faith',
    title: () => 'Poets at court',
    text: () => 'Poets offer to stay at court for a season, or to sell their verses now.',
    advance: c => {
      const gold = scale(c.civ, 30);
      return {
        label: 'Keep them at court',
        effect: `−${gold} gold; +30% culture; ${BOOST_TURNS} turns`,
        blocked: payGold(gold),
        worth: (c.civ.stats?.culture ?? 3) * 4.5 - gold,
        apply: x => ((x.civ.gold -= gold), boost(x, 'culturePct', 30), 'The court sings.'),
      };
    },
    others: c => {
      const n = scale(c.civ, 25);
      return [
        {
          label: 'Buy their verses',
          effect: `−${scale(c.civ, 10)} gold; +${n} culture`,
          blocked: payGold(scale(c.civ, 10)),
          worth: n * 1.5 - scale(c.civ, 10),
          apply: x => ((x.civ.gold -= scale(x.civ, 10)), culture(x, n), 'A book of songs.'),
        },
      ];
    },
    gauge: (s, civ) => civMods(s, civ.id).culturePct,
  },
  buildingEvent(
    'monuments',
    ['monument', 'amphitheatre'],
    'faith',
    'Sculptors',
    'Sculptors',
    sellLabour,
  ),
  {
    task: 'wonder',
    kind: 'knowledge',
    title: c => `Master builders in ${cityOf(c).name}`,
    text: c =>
      `Master builders would start the ${WONDERS[c.extra!].name} in ${cityOf(c).name}, goods and all.`,
    subject: (s, civ) => {
      for (const c of mine(s, civ)) {
        if (c.wonder) continue;
        const id = Object.keys(WONDERS).find(w => {
          const why = wonderProblem(s, c.id, w);
          return !why || (why.startsWith('Needs ') && why.includes('in its market'));
        });
        if (id) return { city: c.id, extra: id };
      }
      return null;
    },
    advance: c => {
      const gold = scale(c.civ, 40);
      return {
        label: 'Begin the wonder',
        effect: `−${gold} gold; ${cityOf(c).name} begins the ${WONDERS[c.extra!].name}`,
        blocked: payGold(gold),
        worth: 20,
        apply: x => {
          const w = WONDERS[x.extra!];
          for (const [k, n] of Object.entries(w.goods))
            cityOf(x).stockpile[k] = (cityOf(x).stockpile[k] ?? 0) + n;
          invalidateMarkets();
          const r = startWonder(x.s, cityOf(x).id, w.id);
          if (r.ok) x.civ.gold -= gold;
          return r.msg;
        },
      };
    },
    others: c => [sellLabour(c)],
  },
  // ---- the noble houses
  houseStudy(
    'house-level',
    c => bestArea(houseOf(c)),
    c => `House ${houseOf(c).name} seeks mastery`,
    (_s, civ) =>
      [...houses(civ)].sort((a, b) => levelOf(b, bestArea(b)) - levelOf(a, bestArea(a)))[0],
    c => halfTech(c),
  ),
  houseStudy(
    'house-total',
    c => weakestArea(houseOf(c)),
    c => `House ${houseOf(c).name} widens its learning`,
    (_s, civ) => [...houses(civ)].sort((a, b) => totalLevels(b) - totalLevels(a))[0],
    goldFor(35, 'Ask for a gift', 'The house sends silver.'),
  ),
  houseStudy(
    'house-war',
    () => 'military',
    c => `House ${houseOf(c).name} studies war`,
    (_s, civ) =>
      [...houses(civ)]
        .filter(d => levelOf(d, 'military') < MAX_LEVEL)
        .sort((a, b) => levelOf(b, 'military') - levelOf(a, 'military'))[0],
    c => {
      const gold = scale(c.civ, 10);
      return {
        label: 'Drill the levies',
        effect: `−${gold} gold; every army +1 experience`,
        blocked: payGold(gold),
        worth: 15,
        apply: x => {
          x.civ.gold -= gold;
          for (const f of x.s.formations)
            if (f.civId === x.civ.id && f.kind === 'army')
              for (const co of f.cohorts) co.xp = Math.min(5, co.xp + 1);
          return 'The levies drill.';
        },
      };
    },
  ),
  houseStudy(
    'house-learning',
    () => 'research',
    c => `House ${houseOf(c).name} and the schools of ${cityOf(c).name}`,
    (s, civ) => governorWith(s, civ, 'research', ['school', 'library', 'university', 'academy'])?.d,
    c => halfTech(c),
    (s, civ) => ({
      city: governorWith(s, civ, 'research', ['school', 'library', 'university', 'academy'])!.c.id,
    }),
  ),
  houseStudy(
    'house-trade',
    () => 'gold',
    c => `House ${houseOf(c).name} and the markets of ${cityOf(c).name}`,
    (s, civ) => governorWith(s, civ, 'gold', ['market', 'bank', 'mint', 'guild-hall'])?.d,
    goldFor(40, 'Tax the markets', 'The stalls pay up.'),
    (s, civ) => ({
      city: governorWith(s, civ, 'gold', ['market', 'bank', 'mint', 'guild-hall'])!.c.id,
    }),
  ),
  houseStudy(
    'house-faith',
    () => 'culture',
    c => `House ${houseOf(c).name} and the shrines of ${cityOf(c).name}`,
    (s, civ) => governorWith(s, civ, 'culture', ['shrine', 'temple', 'cathedral', 'monument'])?.d,
    feast,
    (s, civ) => ({
      city: governorWith(s, civ, 'culture', ['shrine', 'temple', 'cathedral', 'monument'])!.c.id,
    }),
  ),
  {
    task: 'trinkets',
    kind: 'court',
    title: () => 'A treasure unearthed',
    text: () => 'Farmers have dug up an old treasure; the houses would prize it.',
    subject: (_s, civ) => {
      const d = [...houses(civ)].sort((a, b) => b.unrest - a.unrest)[0];
      return d ? { house: d.id } : null;
    },
    advance: c => ({
      label: `Give it to House ${houseOf(c).name}`,
      effect: `House ${houseOf(c).name}: a treasure; −10 unrest`,
      worth: 15,
      apply: x => {
        const t = awardTrinket(x.s, x.civ, bestArea(houseOf(x)), x.s.turn);
        giveTrinket(x.s, x.civ.id, t.id, houseOf(x).id);
        return `The ${t.name} goes to House ${houseOf(x).name}.`;
      },
    }),
    others: c => [goldFor(40, 'Sell it abroad', 'A collector pays well.')(c)],
  },
  {
    task: 'honours',
    kind: 'court',
    title: c => `House ${houseOf(c).name} asks for honours`,
    text: c => `House ${houseOf(c).name} asks for a seat at the high table.`,
    subject: (_s, civ) => {
      const d = [...houses(civ)].sort((a, b) => b.unrest - a.unrest)[0];
      return d ? { house: d.id } : null;
    },
    advance: c => {
      const gold = honoursCost(c.s, c.civ);
      return {
        label: 'Grant honours',
        effect: `−${gold} gold; House ${houseOf(c).name} −35 unrest`,
        blocked: payGold(gold),
        worth: 20 - gold,
        apply: x => grantHonours(x.s, x.civ.id, houseOf(x).id).msg ?? '',
      };
    },
    others: c => {
      const gold = scale(c.civ, 30);
      return [
        {
          label: 'Ask for a loan instead',
          effect: `+${gold} gold; House ${houseOf(c).name} +10 unrest`,
          worth: gold - 10,
          apply: x => {
            x.civ.gold += gold;
            houseOf(x).unrest = Math.min(REVOLT_AT - 1, houseOf(x).unrest + 10);
            return 'The house lends, and remembers.';
          },
        },
      ];
    },
  },
  {
    task: 'calm-houses',
    kind: 'court',
    title: () => 'The houses quarrel',
    text: () => 'The great houses bring their quarrels to the throne.',
    subject: (_s, civ) => (houses(civ).length ? {} : null),
    advance: c => {
      const gold = scale(c.civ, 30);
      return {
        label: 'Hear every grievance',
        effect: `−${gold} gold; every house's unrest falls to 20 or less`,
        blocked: payGold(gold),
        worth: 15 - gold + 20,
        apply: x => {
          x.civ.gold -= gold;
          for (const d of houses(x.civ)) d.unrest = Math.min(d.unrest, 20);
          return 'The court is quiet.';
        },
      };
    },
    others: c => {
      const gold = scale(c.civ, 25);
      return [
        {
          label: 'Fine the loudest',
          effect: `+${gold} gold; every house +10 unrest`,
          worth: gold - 15,
          apply: x => {
            x.civ.gold += gold;
            for (const d of houses(x.civ)) d.unrest = Math.min(REVOLT_AT - 1, d.unrest + 10);
            return 'The fines are paid, sullenly.';
          },
        },
      ];
    },
    gauge: (_s, civ) => -Math.max(0, ...houses(civ).map(d => Math.max(0, d.unrest - 29))),
  },
  {
    task: 'house-seat',
    kind: 'people',
    title: c => `Newcomers to ${cityOf(c).name}`,
    text: c =>
      `House ${governorOf(c.s, cityOf(c))?.name ?? ''} invites families to settle in ${cityOf(c).name}.`,
    subject: (s, civ) => {
      const c = [...mine(s, civ)].filter(x => governorOf(s, x)).sort((a, b) => b.pop - a.pop)[0];
      return c ? { city: c.id } : null;
    },
    advance: c => {
      const gold = scale(c.civ, 25);
      return {
        label: 'Welcome them',
        effect: `−${gold} gold; +1,000 people in ${cityOf(c).name}`,
        blocked: payGold(gold),
        worth: 30,
        apply: x => ((x.civ.gold -= gold), (cityOf(x).pop += 1000), 'The seat grows.'),
      };
    },
    others: c => [goldFor(25, 'Tax the newcomers', 'They pay and move on.')(c)],
  },
  {
    task: 'court',
    kind: 'court',
    title: () => 'A family seeks a title',
    text: () => 'A rich family asks to be raised among the great houses.',
    subject: (_s, civ) => (houses(civ).length && houses(civ).length < 6 ? {} : null),
    advance: c => {
      const gold = scale(c.civ, 40);
      return {
        label: 'Raise a new house',
        effect: `−${gold} gold; a new house at court`,
        blocked: payGold(gold),
        worth: 0,
        apply: x => {
          x.civ.gold -= gold;
          const d = riseHouse(x.s, x.civ);
          return `House ${d.name} joins the court.`;
        },
      };
    },
    others: c => [goldFor(35, 'Sell them a lesser title', 'They pay for the honour.')(c)],
  },
  {
    task: 'houses-govern',
    kind: 'court',
    title: c => `House ${houseOf(c).name} wants a seat`,
    text: c => `House ${houseOf(c).name} asks to govern ${cityOf(c).name}.`,
    subject: (s, civ) => {
      const idle = houses(civ).find(d => !mine(s, civ).some(c => governorOf(s, c)?.id === d.id));
      if (!idle) return null;
      const cs = mine(s, civ);
      // a town whose governor governs another as well
      const c = [...cs]
        .filter(x => cs.filter(y => governorOf(s, y)?.id === governorOf(s, x)?.id).length > 1)
        .sort((a, b) => a.pop - b.pop)[0];
      return c ? { house: idle.id, city: c.id } : null;
    },
    advance: c => ({
      label: `Give it ${cityOf(c).name}`,
      effect: `House ${houseOf(c).name} governs ${cityOf(c).name}; its old governor +10 unrest`,
      worth: 0,
      apply: x => assignGovernor(x.s, x.civ.id, cityOf(x).id, houseOf(x).id).msg ?? '',
    }),
    others: c => [goldFor(30, 'Let it pay for patience', 'The house waits, and pays.')(c)],
  },
  {
    task: 'balance',
    kind: 'court',
    title: c => `House ${houseOf(c).name} grows too great`,
    text: c => `House ${houseOf(c).name} holds more of the realm than any other.`,
    subject: (s, civ) => {
      if (houses(civ).length < 2) return null;
      const p = powerOf(s, civ);
      const top = [...houses(civ)].sort((a, b) => p.get(b.id)!.share - p.get(a.id)!.share)[0];
      const weak = [...houses(civ)].sort((a, b) => p.get(a.id)!.share - p.get(b.id)!.share)[0];
      const c = [...mine(s, civ)]
        .filter(x => governorOf(s, x)?.id === top.id)
        .sort((a, b) => b.pop - a.pop)[0];
      return c && weak.id !== top.id ? { house: top.id, house2: weak.id, city: c.id } : null;
    },
    advance: c => ({
      label: `Give ${cityOf(c).name} to House ${c.house2!.name}`,
      effect: `House ${houseOf(c).name} +10 unrest; House ${c.house2!.name} governs ${cityOf(c).name}`,
      worth: -5,
      apply: x => assignGovernor(x.s, x.civ.id, cityOf(x).id, x.house2!.id).msg ?? '',
    }),
    others: c => [goldFor(40, 'Tax its wealth', 'The great house pays.')(c)],
    gauge: (s, civ) => -Math.max(0, ...[...powerOf(s, civ).values()].map(v => v.share)),
  },
  {
    task: 'ruling-power',
    kind: 'court',
    title: c => `The crown and ${cityOf(c).name}`,
    text: c =>
      `The throne could take ${cityOf(c).name} from House ${houseOf(c).name} to govern itself.`,
    subject: (s, civ) => {
      if (houses(civ).length < 2) return null;
      const ruler = rulerOf(civ);
      const c = [...mine(s, civ)]
        .filter(x => governorOf(s, x) && governorOf(s, x)!.id !== ruler.id)
        .sort((a, b) => b.pop - a.pop)[0];
      return c ? { city: c.id, house: governorOf(s, c)!.id } : null;
    },
    advance: c => ({
      label: 'Take it for the crown',
      effect: `the ruling house governs ${cityOf(c).name}; House ${houseOf(c).name} +10 unrest`,
      worth: -5,
      apply: x => assignGovernor(x.s, x.civ.id, cityOf(x).id, rulerOf(x.civ).id).msg ?? '',
    }),
    others: c => [
      goldFor(35, 'Let them keep it, for a fee', 'The house pays to keep its seat.')(c),
    ],
    gauge: (s, civ) => powerOf(s, civ).get(rulerOf(civ).id)?.share ?? 0,
  },
  {
    task: 'civil-war',
    kind: 'court',
    title: c => `House ${houseOf(c).name} claims the throne`,
    text: c => `House ${houseOf(c).name} says its blood is older than the crown’s.`,
    subject: (_s, civ) => {
      if (civ.civilWar || houses(civ).length < 2) return null;
      const ruler = rulerOf(civ);
      const d = [...houses(civ)]
        .filter(x => x.id !== ruler.id)
        .sort((a, b) => b.unrest - a.unrest)[0];
      return d ? { house: d.id } : null;
    },
    advance: c => ({
      label: 'Let it come to war',
      effect: `civil war with House ${houseOf(c).name}: the realm splits until one side wins`,
      worth: -80,
      apply: x => {
        x.civ.civilWar = { rebel: houseOf(x).id, since: x.s.turn, pending: true };
        if (!x.civ.isPlayer) chooseSide(x.s, x.civ.id, rulerOf(x.civ).id);
        return `House ${houseOf(x).name} rises. Choose your side.`;
      },
    }),
    grave: true,
    others: c => {
      const gold = scale(c.civ, 30);
      return [
        {
          label: 'Buy off the claim',
          effect: `−${gold} gold; House ${houseOf(c).name} unrest 0`,
          blocked: payGold(gold),
          worth: 30 - gold,
          apply: x => ((x.civ.gold -= gold), (houseOf(x).unrest = 0), 'The claim is dropped.'),
        },
      ];
    },
    gauge: (_s, civ) => deed(civ, 'civilwars') + (civ.civilWar ? 1 : 0),
  },
  // ---- the sea
  buildingEvent(
    'ports',
    ['harbour', 'fishing-dock', 'shipyard'],
    'trade',
    'Shipwrights',
    'Shipwrights',
    feast,
  ),
  {
    task: 'fleets',
    kind: 'trade',
    title: c => `A hull for sale in ${cityOf(c).name}`,
    text: c => `The yards of ${cityOf(c).name} have a ship ready, if the crown will pay.`,
    subject: (s, civ) => {
      const d = civ.designs.find(x => x.naval && !loadoutProblem(x.loadout, civ.techs));
      if (!d) return null;
      const c = mine(s, civ).find(
        x =>
          cityDistricts(s, x).some(dd => dd.slots.some(y => y.built && y.type === 'shipyard')) &&
          x.pop >= MIN_CITY_POP + 100 &&
          within(grid(s), x.hex, 1).some(h => isWaterHex(s, h)),
      );
      return c ? { city: c.id, extra: String(d.id) } : null;
    },
    advance: c => {
      const gold = scale(c.civ, 30);
      return {
        label: 'Buy the ship',
        effect: `−${gold} gold; a ship sails from ${cityOf(c).name}`,
        blocked: payGold(gold),
        worth: 10,
        apply: x => {
          const d = x.civ.designs.find(y => y.id === Number(x.extra));
          if (!d) return 'The design is lost.';
          for (const [k, n] of Object.entries(loadoutCost(d.loadout)))
            cityOf(x).stockpile[k] = (cityOf(x).stockpile[k] ?? 0) + n;
          invalidateMarkets();
          const r = buildShip(x.s, cityOf(x).id, d.id);
          if (r.ok) x.civ.gold -= gold;
          return r.msg ?? '';
        },
      };
    },
    others: c => [goldFor(25, 'Sell it abroad', 'A foreign captain pays well.')(c)],
  },
];

export const MISSION_EVENT_SPECS: Record<string, MissionEventSpec> = Object.fromEntries(
  SPECS.map(x => [x.task, x]),
);
export const missionEventId = (task: string) => `mission-${task}`;

/** The active mission an event serves (its culture choice id in the subject). */
export function missionOf(civ: Civ, node: string | undefined): TomeMission | undefined {
  const t = civ.culture.tome;
  if (!t || !node || !t.taken.includes(node) || t.done.includes(node)) return undefined;
  return t.offered.find(m => m.node === node);
}

function choicesFor(spec: MissionEventSpec, c: Ctx): MChoice[] {
  const m = missionOf(c.civ, c.mission);
  const t = c.civ.culture.tome;
  const adv = { ...spec.advance(c), mission: m && t ? missionLabel(m, t.age) : undefined };
  return spec.grave ? [...spec.others(c), adv] : [adv, ...spec.others(c)];
}

/** The events as realm events (realmEvents.ts registers them): never drawn at random. */
export const MISSION_EVENT_DEFS: EventDef[] = SPECS.map(spec => ({
  id: missionEventId(spec.task),
  kind: spec.kind,
  title: spec.title,
  text: [spec.text],
  cooldown: 0,
  followUp: true,
  subject: () => null,
  choices: c => choicesFor(spec, c),
}));

// ---------------------------------------------------------------- when

/** Keep count of each active mission's progress; forget missions no longer active. */
function track(s: GameState, civ: Civ) {
  const t = civ.culture.tome;
  const st = (civ.missionEvents ??= {});
  const old = st.track ?? {};
  const next: NonNullable<MissionEventState['track']> = {};
  if (t) {
    const x = survey(s, civ);
    for (const m of t.offered) {
      if (!t.taken.includes(m.node) || t.done.includes(m.node)) continue;
      const p = missionProgress(s, civ, m, t.age, x);
      const was = old[m.node];
      if (!was) next[m.node] = { have: p.have, turn: s.turn, since: s.turn };
      else if (p.have > was.have) next[m.node] = { ...was, have: p.have, turn: s.turn };
      else next[m.node] = was;
    }
  }
  st.track = next;
}

/** Active missions that have stalled. */
export function stalledMissions(s: GameState, civ: Civ): TomeMission[] {
  const t = civ.culture.tome;
  const tr = civ.missionEvents?.track;
  if (!t || !tr) return [];
  return t.offered.filter(m => {
    const e = tr[m.node];
    if (!e || !MANDATES[m.task] || !missionOf(civ, m.node)) return false;
    const p = missionProgress(s, civ, m, t.age);
    return (
      s.turn - e.turn >= STALL_TURNS || (s.turn - e.since >= SLOW_TURNS && p.have < p.need / 2)
    );
  });
}

/** A Ctx for an event's subject, or null when it no longer holds (as realmEvents' ctxOf). */
export function missionCtx(s: GameState, civ: Civ, sub: Subject): Ctx | null {
  const c: Ctx = { s, civ, mission: sub.mission, extra: sub.extra, good: sub.good, hex: sub.hex };
  if (sub.mission !== undefined && !missionOf(civ, sub.mission)) return null;
  if (sub.city !== undefined) {
    c.city = s.cities.find(x => x.id === sub.city);
    if (!c.city) return null;
  }
  if (sub.house !== undefined) {
    c.house = houses(civ).find(d => d.id === sub.house);
    if (!c.house) return null;
  }
  if (sub.house2 !== undefined) {
    c.house2 = houses(civ).find(d => d.id === sub.house2);
    if (!c.house2) return null;
  }
  if (sub.civ !== undefined) {
    c.other = s.civs[sub.civ];
    if (!c.other?.alive) return null;
  }
  return c;
}

/**
 * Whether a mission event is due for this people this turn, and which: a stalled mission with an
 * event that can happen now, at most one every GAP turns, CHANCE a turn. Marks it as given.
 */
export function missionEventDue(
  s: GameState,
  civ: Civ,
  force = false,
): { id: string; subject: Subject } | null {
  if (civ.independent || civ.raiders || !civ.alive) return null;
  const st = (civ.missionEvents ??= {});
  if (!force && s.turn - (st.last ?? -Infinity) < GAP) return null;
  const r = mulberry32(hashSeed(s.settings.map.seed, s.turn * 7717 + civ.id * 31 + 5));
  const stalled = force
    ? (civ.culture.tome?.offered.filter(m => missionOf(civ, m.node)) ?? [])
    : stalledMissions(s, civ);
  if (!stalled.length) return null;
  if (!force && r() >= CHANCE) return null;
  const opts: { m: TomeMission; sub: Subject }[] = [];
  for (const m of stalled) {
    const spec = MISSION_EVENT_SPECS[m.task];
    if (!spec) continue;
    const sub = spec.subject ? spec.subject(s, civ, r) : {};
    if (!sub) continue;
    const full = { ...sub, mission: m.node };
    if (missionCtx(s, civ, full)) opts.push({ m, sub: full });
  }
  const o = pick(r, opts);
  if (!o) return null;
  st.last = s.turn;
  return { id: missionEventId(o.m.task), subject: o.sub };
}

// ---------------------------------------------------------------- the AI, and the turn

/** Whether the AI thinks the mission worth the price: near the major, or half done, or a hunch. */
function aiWants(s: GameState, civ: Civ, node: string | undefined, r: Rng, grave = false): boolean {
  const t = civ.culture.tome;
  const m = missionOf(civ, node);
  if (!t || !m) return false;
  if (t.major === 'locked' && t.done.length >= MAJOR_AT - 1) return true;
  if (grave) return false;
  const p = missionProgress(s, civ, m, t.age);
  if (p.have / p.need >= 0.5) return true;
  return r() < 0.35;
}

/** The AI answers a mission event: the mission when it is worth it, else the best plain value. */
export function aiAnswer(s: GameState, civ: Civ, id: string, sub: Subject, r: Rng): number {
  const spec = MISSION_EVENT_SPECS[id.replace(/^mission-/, '')];
  const c = spec && missionCtx(s, civ, sub);
  if (!c) return -1;
  const chs = choicesFor(spec, c);
  const free = chs.map((ch, i) => ({ ch, i })).filter(x => !x.ch.blocked?.(c));
  if (!free.length) return -1;
  const mi = chs.findIndex(ch => ch.mission);
  let pickI = free.find(x => x.i === mi && aiWants(s, civ, sub.mission, r, spec.grave))?.i;
  if (pickI === undefined) {
    const rest = free.filter(x => x.i !== mi);
    pickI = (rest.length ? rest : free).sort((a, b) => (b.ch.worth ?? 0) - (a.ch.worth ?? 0))[0].i;
  }
  const out = chs[pickI].apply(c);
  log(s, civ.id, `${spec.title(c)}: ${chs[pickI].label}. ${out}`);
  return pickI;
}

/**
 * Once a turn for every people: count mission progress, send away foes nobody fought, end a
 * boost that has run out, and let AI peoples meet and answer their mission events.
 */
export function missionEventTurn(s: GameState, civ: Civ) {
  if (civ.independent || civ.raiders) return;
  track(s, civ);
  const st = civ.missionEvents!;
  if (st.foes?.length) {
    for (const f of st.foes)
      if (s.turn > f.until) {
        s.formations = s.formations.filter(x => x.id !== f.fid);
        if (s.raiders) s.raiders.bands = s.raiders.bands.filter(b => b.fid !== f.fid);
      }
    st.foes = st.foes.filter(f => s.turn <= f.until && s.formations.some(x => x.id === f.fid));
    if (!st.foes.length) delete st.foes;
  }
  if (st.boost && s.turn > st.boost.until) delete st.boost;
  if (civ.isPlayer) return;
  const due = missionEventDue(s, civ);
  if (!due) return;
  const r = mulberry32(hashSeed(s.settings.map.seed, s.turn * 4441 + civ.id * 17));
  aiAnswer(s, civ, due.id, due.subject, r);
}

/** For the checks: what an event's mission choice moves. */
export function missionGauge(s: GameState, civ: Civ, task: string): number {
  const spec = MISSION_EVENT_SPECS[task];
  return spec?.gauge ? spec.gauge(s, civ) : measureOf(s, civ, task);
}
