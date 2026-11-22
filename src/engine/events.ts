/**
 * History events: things that happen to a people (a comet, a plague, envoys from a free
 * people, a rival's marriage offer) and ask for a choice. The player answers in a dialog; AI
 * peoples choose for themselves. Each people has at most one event every EVENT_GAP turns.
 */
import { GOODS } from '../data/goods.ts';
import { alliesOf, opinion, remember } from './diplomacy.ts';
import { absorb, absorbCost, standing } from './independents.ts';
import { hashSeed, mulberry32, type Rng } from './rng.ts';
import type { City, Civ, GameState, PendingEvent } from './types.ts';

export const EVENT_GAP = 9;
export const EVENT_CHANCE = 0.16;

export interface EventCtx {
  city?: City;
  other?: Civ;
}

export interface EventChoice {
  label: string;
  /** what it does, shown under the label */
  effect: (s: GameState, civ: Civ, ctx: EventCtx) => string;
  /** apply it; may return a line for the record */
  apply: (s: GameState, civ: Civ, ctx: EventCtx) => void;
  /** why it cannot be chosen right now */
  blocked?: (s: GameState, civ: Civ, ctx: EventCtx) => string | null;
  /** how much an AI people likes this choice */
  ai?: number;
}

export interface HistoryEvent {
  id: string;
  title: string;
  /** what the event needs: one of the people's cities, a met great people, a met free people */
  needs: ('city' | 'other' | 'free')[];
  /** may it happen now (ctx already picked)? */
  when?: (s: GameState, civ: Civ, ctx: EventCtx) => boolean;
  weight: number;
  text: (s: GameState, civ: Civ, ctx: EventCtx) => string;
  choices: EventChoice[];
}

// ---------------------------------------------------------------- effect helpers

const addGold = (civ: Civ, n: number) => (civ.gold = Math.max(0, civ.gold + n));
const addCulture = (civ: Civ, n: number) => (civ.culture.points += n);
const addScience = (civ: Civ, n: number) => (civ.science += n);
const addPop = (c: City, n: number) => (c.pop = Math.max(1000, Math.round((c.pop + n) / 50) * 50));
const addGoods = (c: City, g: string, n: number) =>
  (c.stockpile[g] = Math.max(0, (c.stockpile[g] ?? 0) + n));
const needGold = (n: number) => (_s: GameState, civ: Civ) =>
  civ.gold >= n ? null : `Needs ${n} gold.`;
const needGoods = (g: string, n: number) => (_s: GameState, _c: Civ, ctx: EventCtx) =>
  (ctx.city?.stockpile[g] ?? 0) >= n ? null : `Needs ${n} ${GOODS[g]?.name ?? g} in the city.`;
const theCity = (ctx: EventCtx) => ctx.city!;
const them = (ctx: EventCtx) => ctx.other!;
const biggestArmy = (s: GameState, civId: number) =>
  s.formations
    .filter(f => f.civId === civId && f.kind === 'army')
    .sort((a, b) => b.cohorts.length - a.cohorts.length)[0];

// ---------------------------------------------------------------- the events

export const HISTORY_EVENTS: HistoryEvent[] = [
  {
    id: 'harvest',
    title: 'A Bountiful Harvest',
    needs: ['city'],
    weight: 3,
    text: (_s, _c, x) =>
      `The fields around ${theCity(x).name} have given more than anyone can remember. The granaries overflow and the elders ask what should be done with the surplus.`,
    choices: [
      {
        label: 'Fill the granaries',
        effect: () => '+40 food stored',
        apply: (_s, _c, x) => void (theCity(x).food += 40),
        ai: 2,
      },
      {
        label: 'Hold a harvest feast',
        effect: () => '+20 culture',
        apply: (_s, c) => void addCulture(c, 20),
        ai: 1,
      },
      {
        label: 'Sell it to passing merchants',
        effect: () => '+30 gold',
        apply: (_s, c) => void addGold(c, 30),
        ai: 1,
      },
    ],
  },
  {
    id: 'plague',
    title: 'Sickness in the Streets',
    needs: ['city'],
    when: (_s, _c, x) => theCity(x).pop >= 3000,
    weight: 2,
    text: (_s, _c, x) =>
      `A fever spreads through the crowded lanes of ${theCity(x).name}. Healers are few, and the sick are many.`,
    choices: [
      {
        label: 'Close the gates and pay the healers',
        effect: () => '−25 gold, −250 people',
        blocked: needGold(25),
        apply: (_s, c, x) => {
          addGold(c, -25);
          addPop(theCity(x), -250);
        },
        ai: 2,
      },
      {
        label: 'Let it run its course',
        effect: (_s, _c, x) => `−${Math.round((theCity(x).pop * 0.12) / 50) * 50} people`,
        apply: (_s, _c, x) => void addPop(theCity(x), -theCity(x).pop * 0.12),
        ai: 1,
      },
    ],
  },
  {
    id: 'comet',
    title: 'A Fire in the Heavens',
    needs: [],
    weight: 2,
    text: () =>
      'A comet with a long burning tail hangs over the land for nine nights. The priests call it an omen; the stargazers call it a question.',
    choices: [
      {
        label: 'Proclaim it an omen of greatness',
        effect: () => '+25 culture',
        apply: (_s, c) => void addCulture(c, 25),
        ai: 1,
      },
      {
        label: 'Let the stargazers study it',
        effect: () => '+30 research',
        apply: (_s, c) => void addScience(c, 30),
        ai: 1,
      },
    ],
  },
  {
    id: 'scholars',
    title: 'Wandering Scholars',
    needs: ['city'],
    weight: 2,
    text: (_s, _c, x) =>
      `A band of scholars, driven from some distant court, arrives at the gates of ${theCity(x).name} with their books and asks for shelter.`,
    choices: [
      {
        label: 'Give them a hall and a stipend',
        effect: () => '−20 gold, +50 research',
        blocked: needGold(20),
        apply: (_s, c) => {
          addGold(c, -20);
          addScience(c, 50);
        },
        ai: 2,
      },
      {
        label: 'Turn them away',
        effect: () => 'Nothing happens',
        apply: () => {},
        ai: 0.3,
      },
    ],
  },
  {
    id: 'vein',
    title: 'A Rich Vein',
    needs: ['city'],
    weight: 2,
    text: (_s, _c, x) =>
      `Shepherds near ${theCity(x).name} found bright stone in a ravine. The old women say the hill is sacred.`,
    choices: [
      {
        label: 'Dig it out',
        effect: () => '+20 stone, +12 copper',
        apply: (_s, _c, x) => {
          addGoods(theCity(x), 'stone', 20);
          addGoods(theCity(x), 'copper', 12);
        },
        ai: 2,
      },
      {
        label: 'Leave the hill to the spirits',
        effect: () => '+20 culture',
        apply: (_s, c) => void addCulture(c, 20),
        ai: 1,
      },
    ],
  },
  {
    id: 'fire',
    title: 'The Great Fire',
    needs: ['city'],
    when: (_s, _c, x) => theCity(x).pop >= 2500,
    weight: 1.5,
    text: (_s, _c, x) =>
      `A lamp overturned in a market stall, and by morning half of ${theCity(x).name}'s wooden quarter was ash.`,
    choices: [
      {
        label: 'Rebuild in stone',
        effect: () => '−25 stone, +10 culture',
        blocked: needGoods('stone', 25),
        apply: (_s, c, x) => {
          addGoods(theCity(x), 'stone', -25);
          addCulture(c, 10);
        },
        ai: 2,
      },
      {
        label: 'Rebuild as before',
        effect: () => '−30 wood, −250 people',
        apply: (_s, _c, x) => {
          addGoods(theCity(x), 'wood', -30);
          addPop(theCity(x), -250);
        },
        ai: 1,
      },
    ],
  },
  {
    id: 'bandits',
    title: 'Bandits on the Roads',
    needs: ['city'],
    weight: 2,
    text: (_s, _c, x) =>
      `Caravans bound for ${theCity(x).name} are being robbed in the hills. The merchants demand that something be done.`,
    choices: [
      {
        label: 'Send the guard to hunt them',
        effect: () => 'City guard weakened for a while, +15 gold of recovered loot',
        apply: (_s, c, x) => {
          theCity(x).guard = Math.min(theCity(x).guard, 0.5);
          addGold(c, 15);
        },
        ai: 1,
      },
      {
        label: 'Pay them to move on',
        effect: () => '−20 gold',
        blocked: needGold(20),
        apply: (_s, c) => void addGold(c, -20),
        ai: 1,
      },
    ],
  },
  {
    id: 'general',
    title: 'A Gifted Captain',
    needs: [],
    when: (s, c) => !!biggestArmy(s, c.id),
    weight: 1.5,
    text: () =>
      'A young captain has won the love of the troops: they say she has never lost a skirmish and never wasted a life.',
    choices: [
      {
        label: 'Give her command of our largest army',
        effect: (s, c) =>
          `${biggestArmy(s, c.id)?.name ?? 'The army'}: every cohort gains experience`,
        apply: (s, c) => {
          const f = biggestArmy(s, c.id);
          if (f) for (const co of f.cohorts) co.xp += 1;
        },
        ai: 2,
      },
      {
        label: 'Keep her at court as an advisor',
        effect: () => '+15 culture, +15 research',
        apply: (_s, c) => {
          addCulture(c, 15);
          addScience(c, 15);
        },
        ai: 1,
      },
    ],
  },
  {
    id: 'drought',
    title: 'The Dry Year',
    needs: ['city'],
    weight: 1.5,
    text: (_s, _c, x) =>
      `No rain has fallen on ${theCity(x).name} since the spring. The wells are low and the wheat is thin.`,
    choices: [
      {
        label: 'Open the granaries',
        effect: () => 'Lose the food stored',
        apply: (_s, _c, x) => void (theCity(x).food = 0),
        ai: 1,
      },
      {
        label: 'Buy grain from abroad',
        effect: () => '−30 gold',
        blocked: needGold(30),
        apply: (_s, c) => void addGold(c, -30),
        ai: 1,
      },
    ],
  },
  {
    id: 'founders',
    title: 'Festival of the Founders',
    needs: [],
    when: s => s.turn >= 20,
    weight: 1,
    text: (_s, c) =>
      `The ${c.name} remember the day their first city was founded. The people ask for games and songs.`,
    choices: [
      {
        label: 'Hold the games',
        effect: () => '−15 gold, +30 culture',
        blocked: needGold(15),
        apply: (_s, c) => {
          addGold(c, -15);
          addCulture(c, 30);
        },
        ai: 2,
      },
      {
        label: 'Work as on any other day',
        effect: () => '+15 gold',
        apply: (_s, c) => void addGold(c, 15),
        ai: 1,
      },
    ],
  },
  // ------------------------------------------------ other great peoples
  {
    id: 'merchants',
    title: 'Merchants from Afar',
    needs: ['other', 'city'],
    when: (s, c, x) => !atWarWith(s, c.id, them(x).id),
    weight: 2,
    text: (_s, _c, x) =>
      `Traders of the ${them(x).name} have set up their stalls in ${theCity(x).name}, selling cheap and buying everything.`,
    choices: [
      {
        label: 'Open the market to them',
        effect: (_s, _c, x) => `+35 gold, the ${them(x).name} are pleased`,
        apply: (s, c, x) => {
          addGold(c, 35);
          remember(s, them(x).id, c.id, 'market', 'Welcomed our merchants', 10, 0.2);
        },
        ai: 2,
      },
      {
        label: 'Protect our own craftsmen',
        effect: (_s, _c, x) => `+15 culture, the ${them(x).name} are annoyed`,
        apply: (s, c, x) => {
          addCulture(c, 15);
          remember(s, them(x).id, c.id, 'market', 'Closed their markets to us', -8, 0.2);
        },
        ai: 1,
      },
    ],
  },
  {
    id: 'marriage',
    title: 'A Royal Marriage',
    needs: ['other'],
    when: (s, c, x) => !atWarWith(s, c.id, them(x).id) && opinion(s, them(x).id, c.id) >= 5,
    weight: 1.5,
    text: (_s, _c, x) =>
      `The ${them(x).name} propose a marriage between their ruling house and ours, to bind our peoples together.`,
    choices: [
      {
        label: 'Accept the match',
        effect: (_s, _c, x) => `−20 gold dowry, the ${them(x).name} warm to you greatly`,
        blocked: needGold(20),
        apply: (s, c, x) => {
          addGold(c, -20);
          remember(s, them(x).id, c.id, 'marriage', 'Married into our house', 25, 0.1);
          remember(s, c.id, them(x).id, 'marriage', 'Married into our house', 25, 0.1);
        },
        ai: 2,
      },
      {
        label: 'Politely decline',
        effect: (_s, _c, x) => `The ${them(x).name} feel slighted`,
        apply: (s, c, x) =>
          remember(s, them(x).id, c.id, 'marriage', 'Refused our marriage offer', -10, 0.2),
        ai: 1,
      },
    ],
  },
  {
    id: 'incident',
    title: 'A Border Incident',
    needs: ['other'],
    when: (s, c, x) => !atWarWith(s, c.id, them(x).id),
    weight: 1.5,
    text: (_s, _c, x) =>
      `Our herdsmen and those of the ${them(x).name} came to blows over a spring. Two men are dead, and both sides want blood money.`,
    choices: [
      {
        label: 'Pay the blood money',
        effect: (_s, _c, x) => `−20 gold, the ${them(x).name} are satisfied`,
        blocked: needGold(20),
        apply: (s, c, x) => {
          addGold(c, -20);
          remember(s, them(x).id, c.id, 'incident', 'Settled a quarrel fairly', 10, 0.2);
        },
        ai: 1,
      },
      {
        label: 'Stand firm',
        effect: (_s, _c, x) => `+10 culture, the ${them(x).name} resent it`,
        apply: (s, c, x) => {
          addCulture(c, 10);
          remember(s, them(x).id, c.id, 'incident', 'Killed our herdsmen', -15, 0.2);
        },
        ai: 1,
      },
    ],
  },
  {
    id: 'refugees',
    title: 'Refugees at the Gates',
    needs: ['other', 'city'],
    when: (s, c, x) =>
      s.wars.some(w => w.a === them(x).id || w.b === them(x).id) && !atWarWith(s, c.id, them(x).id),
    weight: 2,
    text: (_s, _c, x) =>
      `Families fleeing the wars of the ${them(x).name} have come to ${theCity(x).name} with nothing but what they can carry.`,
    choices: [
      {
        label: 'Take them in',
        effect: () => '+500 people, −10 food',
        apply: (_s, _c, x) => {
          addPop(theCity(x), 500);
          theCity(x).food -= 10;
        },
        ai: 2,
      },
      {
        label: 'Send them on their way',
        effect: () => 'Nothing happens',
        apply: () => {},
        ai: 0.5,
      },
    ],
  },
  // ------------------------------------------------ free peoples
  {
    id: 'envoys',
    title: 'Envoys of a Free People',
    needs: ['free'],
    when: (s, c, x) => ['Wary', 'Cold'].includes(standing(s, them(x).id, c.id)),
    weight: 3,
    text: (_s, _c, x) =>
      `Elders of the ${them(x).name} have come under a green branch to see what kind of people we are.`,
    choices: [
      {
        label: 'Receive them with gifts',
        effect: (_s, _c, x) => `−15 gold, the ${them(x).name} warm to you`,
        blocked: needGold(15),
        apply: (s, c, x) => {
          addGold(c, -15);
          remember(s, them(x).id, c.id, 'envoys', 'Received our envoys with honour', 20, 0.15);
        },
        ai: 2,
      },
      {
        label: 'Hear them out, and nothing more',
        effect: (_s, _c, x) => `The ${them(x).name} think a little better of you`,
        apply: (s, c, x) => remember(s, them(x).id, c.id, 'envoys', 'Heard our envoys', 6, 0.15),
        ai: 1,
      },
    ],
  },
  {
    id: 'protection',
    title: 'A Plea for Protection',
    needs: ['free'],
    when: (s, c, x) =>
      s.wars.some(w => w.a === them(x).id || w.b === them(x).id) &&
      !atWarWith(s, c.id, them(x).id) &&
      !alliesOf(s, them(x).id).includes(c.id),
    weight: 3,
    text: (s, _c, x) => {
      const foe = s.wars.find(w => w.a === them(x).id || w.b === them(x).id)!;
      const foeName = s.civs[foe.a === them(x).id ? foe.b : foe.a].name;
      return `The ${them(x).name} are at war with the ${foeName} and beg us for help. Whatever we answer, they will remember it.`;
    },
    choices: [
      {
        label: 'Send weapons and gold',
        effect: (_s, _c, x) => `−30 gold, the ${them(x).name} will not forget it`,
        blocked: needGold(30),
        apply: (s, c, x) => {
          addGold(c, -30);
          them(x).gold += 30;
          remember(s, them(x).id, c.id, 'protection', 'Helped us in our hour of need', 35, 0.1);
        },
        ai: 1,
      },
      {
        label: 'It is not our war',
        effect: (_s, _c, x) => `The ${them(x).name} are disappointed`,
        apply: (s, c, x) =>
          remember(s, them(x).id, c.id, 'protection', 'Abandoned us in war', -10, 0.15),
        ai: 1,
      },
    ],
  },
  {
    id: 'heirs',
    title: 'The Quarrel of Heirs',
    needs: ['free'],
    when: (s, c, x) => ['Friends', 'Allies'].includes(standing(s, them(x).id, c.id)),
    weight: 2,
    text: (_s, _c, x) =>
      `The old chief of the ${them(x).name} has died. Two heirs claim the hall, and both send word to us.`,
    choices: [
      {
        label: 'Back the elder heir with gold',
        effect: (_s, _c, x) => `−30 gold, the ${them(x).name} grow closer to you`,
        blocked: needGold(30),
        apply: (s, c, x) => {
          addGold(c, -30);
          remember(s, them(x).id, c.id, 'heirs', 'Put our chief on the seat', 25, 0.1);
        },
        ai: 1,
      },
      {
        label: 'Stay out of it',
        effect: (_s, _c, x) => `The ${them(x).name} cool towards you a little`,
        apply: (s, c, x) =>
          remember(s, them(x).id, c.id, 'heirs', 'Did not take our side', -6, 0.2),
        ai: 1,
      },
    ],
  },
  {
    id: 'join',
    title: 'One People',
    needs: ['free'],
    when: (s, c, x) => {
      const t = s.treaties.find(
        t =>
          t.kind === 'alliance' &&
          ((t.a === c.id && t.b === them(x).id) || (t.b === c.id && t.a === them(x).id)),
      );
      return !!t && s.turn - t.since >= 15 && opinion(s, them(x).id, c.id) >= 50;
    },
    weight: 4,
    text: (_s, _c, x) =>
      `After years of fighting side by side, the elders of the ${them(x).name} ask to become one people with us. They ask only that their city keep its name and its feasts.`,
    choices: [
      {
        label: 'Welcome them as kin',
        effect: (s, _c, x) =>
          `−${Math.round(absorbCost(s, them(x).id) / 2 / 10) * 10} gold (half the usual price); their city and troops join you, the tribute ends`,
        blocked: (s, c, x) => needGold(Math.round(absorbCost(s, them(x).id) / 2 / 10) * 10)(s, c),
        apply: (s, c, x) => {
          addGold(c, -Math.round(absorbCost(s, them(x).id) / 2 / 10) * 10);
          absorb(s, c.id, them(x).id, true);
        },
        ai: 1,
      },
      {
        label: 'Better allies than subjects',
        effect: (_s, _c, x) =>
          `The alliance and its tribute go on; the ${them(x).name} are touched`,
        apply: (s, c, x) => remember(s, them(x).id, c.id, 'kin', 'Respected our freedom', 10, 0.1),
        ai: 1,
      },
    ],
  },
];

export const EVENTS: Record<string, HistoryEvent> = Object.fromEntries(
  HISTORY_EVENTS.map(e => [e.id, e]),
);

function atWarWith(s: GameState, a: number, b: number) {
  return s.wars.some(w => (w.a === a && w.b === b) || (w.b === a && w.a === b));
}

// ---------------------------------------------------------------- running them

export function eventCtx(s: GameState, p: PendingEvent): EventCtx {
  return {
    city: p.cityId !== undefined ? s.cities.find(c => c.id === p.cityId) : undefined,
    other: p.other !== undefined ? s.civs[p.other] : undefined,
  };
}

/** Is the pending event still meaningful (its city still ours, the other people alive)? */
export function eventValid(s: GameState, p: PendingEvent): boolean {
  const x = eventCtx(s, p);
  const e = EVENTS[p.eventId];
  if (!e) return false;
  if (e.needs.includes('city') && (!x.city || x.city.civId !== p.civId)) return false;
  if ((e.needs.includes('other') || e.needs.includes('free')) && !x.other?.alive) return false;
  return true;
}

function pick<T>(r: Rng, xs: T[]): T | undefined {
  return xs.length ? xs[Math.floor(r() * xs.length)] : undefined;
}

/** Try to start an event for a people; returns it if one happened. */
function rollEvent(s: GameState, civ: Civ, r: Rng): PendingEvent | null {
  const cities = s.cities.filter(c => c.civId === civ.id);
  if (!cities.length) return null;
  const met = civ.met.map(id => s.civs[id]).filter(o => o.alive);
  const options: { e: HistoryEvent; ctx: EventCtx; w: number }[] = [];
  for (const e of HISTORY_EVENTS) {
    const ctx: EventCtx = {};
    if (e.needs.includes('city')) ctx.city = pick(r, cities);
    if (e.needs.includes('other'))
      ctx.other = pick(
        r,
        met.filter(o => !o.independent),
      );
    if (e.needs.includes('free'))
      ctx.other = pick(
        r,
        met.filter(o => o.independent),
      );
    if (e.needs.includes('city') && !ctx.city) continue;
    if ((e.needs.includes('other') || e.needs.includes('free')) && !ctx.other) continue;
    if (e.when && !e.when(s, civ, ctx)) continue;
    options.push({ e, ctx, w: e.weight });
  }
  const total = options.reduce((a, o) => a + o.w, 0);
  if (!total) return null;
  let roll = r() * total;
  const chosen = options.find(o => (roll -= o.w) <= 0) ?? options[options.length - 1];
  return {
    id: s.nextId++,
    eventId: chosen.e.id,
    civId: civ.id,
    turn: s.turn,
    cityId: chosen.ctx.city?.id,
    other: chosen.ctx.other?.id,
  };
}

/** Resolve an event with a choice. Returns a line for the player, or an error. */
export function resolveEvent(
  s: GameState,
  eventUid: number,
  choice: number,
): { ok: boolean; msg: string } {
  const p = s.events.find(e => e.id === eventUid);
  if (!p) return { ok: false, msg: 'No such event.' };
  const e = EVENTS[p.eventId];
  const civ = s.civs[p.civId];
  const ctx = eventCtx(s, p);
  const c = e.choices[choice];
  if (!c) return { ok: false, msg: 'No such choice.' };
  const why = c.blocked?.(s, civ, ctx);
  if (why) return { ok: false, msg: why };
  s.events = s.events.filter(x => x !== p);
  c.apply(s, civ, ctx);
  s.log.push({
    turn: s.turn,
    civId: civ.id,
    text: `${e.title}: the ${civ.name} chose “${c.label}”.`,
  });
  return { ok: true, msg: `${e.title}: ${c.effect(s, civ, ctx)}.` };
}

/** An AI people picks what it likes best among the choices it can afford. */
function aiChoose(s: GameState, p: PendingEvent, r: Rng): number {
  const e = EVENTS[p.eventId];
  const civ = s.civs[p.civId];
  const ctx = eventCtx(s, p);
  const ok = e.choices
    .map((c, i) => ({ i, w: c.ai ?? 1 }))
    .filter(({ i }) => !e.choices[i].blocked?.(s, civ, ctx));
  const total = ok.reduce((a, o) => a + o.w, 0);
  let roll = r() * total;
  return (ok.find(o => (roll -= o.w) <= 0) ?? ok[ok.length - 1] ?? { i: 0 }).i;
}

/** Each turn: drop stale events, roll new ones. AI peoples answer at once. */
export function historyTurn(s: GameState): string[] {
  const out: string[] = [];
  s.events = s.events.filter(p => eventValid(s, p));
  // the player must have answered last turn's event; if not, the first open choice is taken
  for (const p of [...s.events])
    if (s.turn - p.turn >= 2) {
      const e = EVENTS[p.eventId];
      const civ = s.civs[p.civId];
      const i = e.choices.findIndex(c => !c.blocked?.(s, civ, eventCtx(s, p)));
      const r = resolveEvent(s, p.id, Math.max(0, i));
      if (r.ok) out.push(`${r.msg} (decided for you)`);
      else s.events = s.events.filter(x => x !== p);
    }
  for (const civ of s.civs) {
    if (!civ.alive || civ.independent || s.turn < 4) continue;
    if (s.turn - (s.lastEvent[civ.id] ?? 0) < EVENT_GAP) continue;
    if (s.events.some(p => p.civId === civ.id)) continue;
    const r = mulberry32(hashSeed(s.settings.map.seed, s.turn * 977 + civ.id * 13 + 5));
    if (r() > EVENT_CHANCE) continue;
    const p = rollEvent(s, civ, r);
    if (!p) continue;
    s.lastEvent[civ.id] = s.turn;
    s.events.push(p);
    if (!civ.isPlayer) resolveEvent(s, p.id, aiChoose(s, p, r));
  }
  return out;
}

/** The event the player has to answer now, if any. */
export const playerEvent = (s: GameState) => {
  const me = s.civs.find(c => c.isPlayer);
  return s.events.find(p => p.civId === me?.id && eventValid(s, p));
};
