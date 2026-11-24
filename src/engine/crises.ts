/**
 * Crises: hard times that grow out of a realm's own state, change how it plays for a while, and
 * always leave more than one way out. A crowded realm risks plague, a hungry one famine, an
 * overspent one debt, a faith under strain schism, a factory economy without comforts strikes.
 * Nothing here is random punishment: a crisis can only strike while its cause is real (its
 * pressure reaches 1), the chance is shown, and fixing the cause ends some crises early.
 */
import { ageOf } from '../data/techs.ts';
import { pressureFactor } from '../data/policies.ts';
import { reopenTome } from './culture.ts';
import { difficultyOf } from './difficulty.ts';
import { cityDistricts } from './economy.ts';
import { log, MIN_CITY_POP, trainSettlers } from './game.ts';
import { hashSeed, mulberry32 } from './rng.ts';
import type { Civ, GameState } from './types.ts';

/** no crisis before this turn, and at least this many turns between two for one realm */
export const FIRST_CRISIS = 40;
export const CRISIS_GAP = 35;
/** chance per turn that a crisis whose cause is real breaks out */
export const CRISIS_CHANCE = 0.12;

interface Response {
  label: string;
  effect: (s: GameState, civ: Civ) => string;
  blocked?: (s: GameState, civ: Civ) => string | null;
  /** what it does: end the crisis, ease it (half effects), or cut it short */
  apply: (s: GameState, civ: Civ) => 'end' | 'ease' | { left: number; ease?: boolean };
  /** how much an AI likes it */
  ai: number;
}

export interface CrisisDef {
  id: string;
  name: string;
  /** ages it can strike in */
  ages: [number, number];
  /** what drives it: 1 or more = its cause is real; the text says why */
  pressure: (s: GameState, civ: Civ) => { value: number; why: string };
  effects: string;
  turns: number;
  /** each turn while it lasts; eased halves it */
  tick?: (s: GameState, civ: Civ, eased: boolean) => void;
  /** it ends early when its cause is gone */
  over?: (s: GameState, civ: Civ) => string | null;
  responses: Response[];
}

const mine = (s: GameState, civ: Civ) => s.cities.filter(c => c.civId === civ.id);
const age = (civ: Civ) => ageOf(civ.techs);
const people = (s: GameState, civ: Civ) => mine(s, civ).reduce((a, c) => a + c.pop, 0);
const stirHouses = (civ: Civ, n: number) => {
  for (const d of civ.dynasties) d.unrest = Math.max(0, Math.min(100, d.unrest + n));
};
const needGold = (n: number) => (_s: GameState, civ: Civ) =>
  civ.gold >= n ? null : `Needs ${n} gold.`;
const faithBuildings = (s: GameState, civ: Civ) =>
  mine(s, civ).reduce(
    (a, c) =>
      a +
      cityDistricts(s, c).reduce(
        (b, d) =>
          b +
          d.slots.filter(
            x => x.built && (x.type === 'shrine' || x.type === 'temple' || x.type === 'cathedral'),
          ).length,
        0,
      ),
    0,
  );

export const CRISES: CrisisDef[] = [
  {
    id: 'famine',
    name: 'Famine',
    ages: [1, 3],
    pressure: (s, civ) => {
      const n = civ.stats?.starving ?? 0;
      const all = mine(s, civ).length;
      return {
        value: all ? n / Math.max(2, Math.ceil(all / 3)) : 0,
        why: `${n} of ${all} settlements are short of food.`,
      };
    },
    effects: 'Growth −40%; noble houses grow restless (+2 unrest a turn).',
    turns: 10,
    tick: (_s, civ, eased) => stirHouses(civ, eased ? 1 : 2),
    over: (s, civ) =>
      (civ.stats?.starving ?? 0) === 0 && s.turn - (civ.crisis?.since ?? s.turn) >= 3
        ? 'The granaries fill again: the famine is over.'
        : null,
    responses: [
      {
        label: 'Buy grain abroad',
        effect: (_s, civ) => `−${15 * age(civ)} gold; the famine ends`,
        blocked: (s, civ) => needGold(15 * age(civ))(s, civ),
        apply: (_s, civ) => {
          civ.gold -= 15 * age(civ);
          return 'end';
        },
        ai: 3,
      },
      {
        label: 'Send the hungry to new lands',
        effect: () => 'Settlers leave your largest settlement (its usual cost); the famine eases',
        blocked: (s, civ) => {
          const c = mine(s, civ).sort((a, b) => b.pop - a.pop)[0];
          return c && c.pop >= MIN_CITY_POP + 1500 ? null : 'No settlement can spare settlers.';
        },
        apply: (s, civ) => {
          const c = mine(s, civ).sort((a, b) => b.pop - a.pop)[0];
          trainSettlers(s, c.id);
          return 'ease';
        },
        ai: 2,
      },
      {
        label: 'Ration and endure',
        effect: () => 'Nothing paid; the famine eases, but every house +5 unrest now',
        apply: (_s, civ) => {
          stirHouses(civ, 5);
          return 'ease';
        },
        ai: 1,
      },
    ],
  },
  {
    id: 'debt',
    name: 'Debt Crisis',
    ages: [2, 5],
    pressure: (_s, civ) => {
      const up = civ.stats?.upkeep ?? 0;
      const inc = Math.max(1, civ.stats?.income ?? 0);
      return {
        value: civ.gold < 40 ? up / inc / 0.9 : 0,
        why: `Troops cost ${up} gold a turn against ${inc} of income, and the treasury holds ${Math.floor(civ.gold)}.`,
      };
    },
    effects: 'Creditors take 15% of the gold; unpaid troops lose 1 morale.',
    turns: 12,
    over: (_s, civ) =>
      (civ.stats?.income ?? 0) >= (civ.stats?.upkeep ?? 0) * 1.2 && civ.gold >= 80
        ? 'The treasury recovers: the debt crisis is over.'
        : null,
    responses: [
      {
        label: 'Borrow from the noble houses',
        effect: (_s, civ) => `+${30 * age(civ)} gold; the crisis ends; every house +10 unrest`,
        apply: (_s, civ) => {
          civ.gold += 30 * age(civ);
          stirHouses(civ, 10);
          return 'end';
        },
        ai: 2,
      },
      {
        label: 'Debase the coinage',
        effect: (_s, civ) => `+${20 * age(civ)} gold now; the crisis eases but runs its course`,
        apply: (_s, civ) => {
          civ.gold += 20 * age(civ);
          return 'ease';
        },
        ai: 2,
      },
      {
        label: 'Send the veterans home',
        effect: () => 'Your largest army loses its experience; the crisis ends',
        blocked: (s, civ) =>
          s.formations.some(f => f.civId === civ.id && f.kind === 'army')
            ? null
            : 'You have no army.',
        apply: (s, civ) => {
          const f = s.formations
            .filter(x => x.civId === civ.id && x.kind === 'army')
            .sort((a, b) => b.cohorts.length - a.cohorts.length)[0];
          for (const co of f.cohorts) co.xp = 0;
          return 'end';
        },
        ai: 1,
      },
    ],
  },
  {
    id: 'plague',
    name: 'Plague',
    ages: [2, 5],
    pressure: (s, civ) => {
      const crowd = civ.stats?.crowd ?? 0;
      const n = people(s, civ);
      return {
        value: (crowd / 0.8) * Math.min(1, n / 15000),
        why: `Your most crowded settlement is at ${Math.round(crowd * 100)}% of its housing, in a realm of ${n.toLocaleString()} people.`,
      };
    },
    effects:
      'Growth −60%; trade falters (−15% gold); the two largest settlements lose 3% of their people each turn.',
    turns: 10,
    tick: (s, civ, eased) => {
      if (civ.crisis?.response === 'Quarantine the ports') return;
      for (const c of mine(s, civ)
        .sort((a, b) => b.pop - a.pop)
        .slice(0, 2))
        c.pop = Math.max(MIN_CITY_POP, Math.round((c.pop * (eased ? 0.99 : 0.97)) / 50) * 50);
    },
    responses: [
      {
        label: 'Pay the physicians',
        effect: (_s, civ) => `−${15 * age(civ)} gold; the plague passes in 2 turns`,
        blocked: (s, civ) => needGold(15 * age(civ))(s, civ),
        apply: (_s, civ) => {
          civ.gold -= 15 * age(civ);
          return { left: 2, ease: true };
        },
        ai: 3,
      },
      {
        label: 'Quarantine the ports',
        effect: () => 'Nobody else dies; trade stays shut and the plague lasts half as long',
        apply: (s, civ) => ({ left: Math.ceil((civ.crisis!.until - s.turn) / 2) }),
        ai: 2,
      },
      {
        label: 'Processions and prayer',
        effect: () => 'Every house −10 unrest; the sickness runs its course, a little gentler',
        apply: (_s, civ) => {
          stirHouses(civ, -10);
          return 'ease';
        },
        ai: 1,
      },
    ],
  },
  {
    id: 'schism',
    name: 'Schism',
    ages: [3, 4],
    pressure: (s, civ) => {
      const t = civ.culture.tension.religion ?? 0;
      const faith = t >= 50 ? faithBuildings(s, civ) : 0;
      return {
        value: (t / 60) * (faith >= 2 ? 1 : 0.6),
        why: `Religious tension stands at ${Math.round(t)}, with ${faith} houses of worship to argue over.`,
      };
    },
    effects: 'Culture −25%; the noble houses take sides (+3 unrest a turn).',
    turns: 15,
    tick: (_s, civ, eased) => stirHouses(civ, eased ? 1 : 3),
    over: (_s, civ) =>
      (civ.culture.tension.religion ?? 0) < 30
        ? 'The faithful are reconciled: the schism ends.'
        : null,
    responses: [
      {
        label: 'Call a council of reconciliation',
        effect: (_s, civ) => `−${20 * age(civ)} gold; religious tension −50; the schism ends`,
        blocked: (s, civ) => needGold(20 * age(civ))(s, civ),
        apply: (_s, civ) => {
          civ.gold -= 20 * age(civ);
          civ.culture.tension.religion = Math.max(0, (civ.culture.tension.religion ?? 0) - 50);
          return 'end';
        },
        ai: 3,
      },
      {
        label: 'Suppress the dissenters',
        effect: () => '−20 culture; every house −10 unrest; the schism ends',
        apply: (_s, civ) => {
          civ.culture.points = Math.max(0, civ.culture.points - 20);
          stirHouses(civ, -10);
          return 'end';
        },
        ai: 2,
      },
      {
        label: 'Let the faith divide',
        effect: () =>
          'Religious tension clears; your open culture Tome closes (missions done are kept) and a new one is chosen',
        blocked: (_s, civ) => (civ.culture.tome ? null : 'No culture Tome is open.'),
        apply: (s, civ) => {
          civ.culture.tension.religion = 0;
          reopenTome(s, civ.id);
          return 'end';
        },
        ai: 1,
      },
    ],
  },
  {
    id: 'strikes',
    name: 'Strikes',
    ages: [5, 5],
    pressure: (_s, civ) => {
      const n = civ.stats?.industry ?? 0;
      const hard = (civ.stats?.comfort ?? 0) < 0 || (civ.stats?.crowd ?? 0) >= 0.97;
      return {
        value: n / (hard ? 2 : 4),
        why: `${n} factories and mills${hard ? ', crowded tenements and too few comforts' : ''}.`,
      };
    },
    effects: 'Production −30%; gold −10% while the factories stand idle.',
    turns: 10,
    over: (_s, civ) =>
      (civ.stats?.comfort ?? 0) >= 0 && (civ.stats?.crowd ?? 0) < 0.95
        ? 'Conditions improve: the workers go back to the factories.'
        : null,
    responses: [
      {
        label: 'Concede higher wages',
        effect: (_s, civ) => `−${8 * Math.max(1, civ.stats?.industry ?? 1)} gold; the strikes end`,
        blocked: (s, civ) => needGold(8 * Math.max(1, civ.stats?.industry ?? 1))(s, civ),
        apply: (_s, civ) => {
          civ.gold -= 8 * Math.max(1, civ.stats?.industry ?? 1);
          return 'end';
        },
        ai: 2,
      },
      {
        label: 'Pass labour laws',
        effect: () => '−30 culture; the strikes end',
        blocked: (_s, civ) => (civ.culture.points >= 30 ? null : 'Needs 30 culture.'),
        apply: (_s, civ) => {
          civ.culture.points -= 30;
          return 'end';
        },
        ai: 2,
      },
      {
        label: 'Break the strike',
        effect: () => 'Troops clear the gates; the strikes end; every house +15 unrest',
        blocked: (s, civ) =>
          s.formations.some(f => f.civId === civ.id && f.kind === 'army')
            ? null
            : 'You have no army.',
        apply: (_s, civ) => {
          stirHouses(civ, 15);
          return 'end';
        },
        ai: 1,
      },
    ],
  },
];

/** A crisis's pressure on a realm, after its age policies (free trade spreads plague…). */
export function pressureOf(s: GameState, civ: Civ, def: CrisisDef) {
  const p = def.pressure(s, civ);
  return { value: p.value * pressureFactor(civ, def.id), why: p.why };
}

export const CRISIS: Record<string, CrisisDef> = Object.fromEntries(CRISES.map(c => [c.id, c]));

/** The crisis a realm is in, with what drives it, how long it lasts and what it can do. */
export function activeCrisis(s: GameState, civ: Civ) {
  const st = civ.crisis;
  if (!st) return null;
  const def = CRISIS[st.id];
  if (!def) return null;
  return {
    def,
    state: st,
    left: Math.max(0, st.until - s.turn),
    why: pressureOf(s, civ, def).why,
    choices: def.responses.map(r => ({
      label: r.label,
      effect: r.effect(s, civ),
      blocked: st.response
        ? 'You have already answered this crisis.'
        : (r.blocked?.(s, civ) ?? null),
    })),
  };
}

/** The crises a realm's state is drifting toward (pressure 0.6 or more), for warnings. */
export function crisisRisks(s: GameState, civ: Civ) {
  const a = age(civ);
  return CRISES.filter(d => a >= d.ages[0] && a <= d.ages[1])
    .map(d => ({ def: d, ...pressureOf(s, civ, d) }))
    .filter(r => r.value >= 0.6)
    .sort((x, y) => y.value - x.value);
}

function end(s: GameState, civ: Civ, msg: string, out: string[]) {
  const st = civ.crisis!;
  civ.crisisLast = { ...(civ.crisisLast ?? {}), [st.id]: s.turn };
  civ.crisisNext = s.turn + CRISIS_GAP;
  civ.crisis = undefined;
  log(s, civ.id, msg);
  if (civ.isPlayer) out.push(msg);
}

/** Answer the crisis with one of its responses. */
export function respondCrisis(
  s: GameState,
  civId: number,
  index: number,
): { ok: boolean; msg: string } {
  const civ = s.civs[civId];
  const a = activeCrisis(s, civ);
  if (!a) return { ok: false, msg: 'No crisis to answer.' };
  const r = a.def.responses[index];
  if (!r) return { ok: false, msg: 'No such answer.' };
  if (a.state.response) return { ok: false, msg: 'You have already answered this crisis.' };
  const why = r.blocked?.(s, civ);
  if (why) return { ok: false, msg: why };
  const effect = r.effect(s, civ);
  const res = r.apply(s, civ);
  a.state.response = r.label;
  const out: string[] = [];
  if (res === 'end') end(s, civ, `${a.def.name}: “${r.label}”. The crisis is over.`, out);
  else if (res === 'ease') a.state.eased = true;
  else {
    a.state.until = Math.min(a.state.until, s.turn + res.left);
    if (res.ease) a.state.eased = true;
  }
  if (res !== 'end') log(s, civId, `${a.def.name}: “${r.label}”.`);
  return { ok: true, msg: `${a.def.name}: ${effect}.` };
}

/** Each turn for a great people: a crisis runs, ends, or breaks out. */
export function crisisTurn(s: GameState, civ: Civ): string[] {
  const out: string[] = [];
  const a = age(civ);
  if (civ.crisis) {
    const def = CRISIS[civ.crisis.id];
    if (!def) {
      civ.crisis = undefined;
      return out;
    }
    def.tick?.(s, civ, !!civ.crisis.eased);
    const over = def.over?.(s, civ);
    if (over) end(s, civ, over, out);
    else if (s.turn >= civ.crisis.until)
      end(s, civ, `The ${def.name.toLowerCase()} has run its course.`, out);
    return out;
  }
  if (s.turn < FIRST_CRISIS || s.turn < (civ.crisisNext ?? 0)) return out;
  const r = mulberry32(hashSeed(s.settings.map.seed, s.turn * 4099 + civ.id * 71 + 3));
  const chance = CRISIS_CHANCE * (civ.isPlayer ? difficultyOf(s).harshEvents : 1);
  for (const def of CRISES) {
    if (a < def.ages[0] || a > def.ages[1]) continue;
    if (s.turn - (civ.crisisLast?.[def.id] ?? -Infinity) < 60) continue;
    const p = pressureOf(s, civ, def);
    if (p.value < 1 || r() > chance) continue;
    civ.crisis = { id: def.id, since: s.turn, until: s.turn + def.turns };
    log(s, civ.id, `${def.name} strikes the ${civ.name}.`);
    if (civ.isPlayer) {
      s.crisisCard = true;
      out.push(`Crisis: ${def.name}! ${p.why} ${def.effects}`);
    } else aiRespond(s, civ);
    break;
  }
  return out;
}

function aiRespond(s: GameState, civ: Civ) {
  const a = activeCrisis(s, civ);
  if (!a) return;
  const best = a.def.responses
    .map((r, i) => ({ i, w: r.ai, ok: !r.blocked?.(s, civ) }))
    .filter(x => x.ok)
    .sort((x, y) => y.w - x.w)[0];
  if (best) respondCrisis(s, civ.id, best.i);
}
