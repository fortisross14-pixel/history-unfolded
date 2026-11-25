/**
 * Events: small stories that ask the player to choose.
 *
 * - Pacing: one event every 5 to 15 turns (4 to 9 in the Ancient age, the first at turn 5); never
 *   two at once.
 * - Variety: each event has a cooldown (some happen once a game); the same kind of event
 *   (land, people, court, trade, war, faith, knowledge) is unlikely twice in a row; each has
 *   several wordings.
 * - Grounded: an event is about something real in the game (a named town, a house, a people met,
 *   a good) and only fires when it makes sense (a blight needs farms, a feud two houses).
 * - Honest: every choice shows what it costs and gives before it is made; choices the player
 *   cannot afford say why. Some events lead to a follow-up a few turns later.
 * - Only the player gets events; a choice left open when the turn ends takes the first option.
 */
import { DEPOSITS, GOODS } from '../data/goods.ts';
import { AREAS, type Area } from '../data/dynasties.ts';
import { isRural, SLOT_TYPES } from '../data/slots.ts';
import { ageOf } from '../data/techs.ts';
import { remember } from './diplomacy.ts';
import { awardTrinket, honoursCost, levelOf, rulerOf } from './dynasty.ts';
import { invalidateMarkets, isUrban, marketStock } from './economy.ts';
import { growthCost, log, techCost } from './game.ts';
import { distance, neighbors } from './hex.ts';
import { isPassableLand, validDeposits } from './mapgen.ts';
import { hashSeed, mulberry32, type Rng } from './rng.ts';
import type { City, Civ, Dynasty, GameState } from './types.ts';
import { difficultyOf } from './difficulty.ts';
import { STORY_EVENTS } from './storyEvents.ts';
import { MISSION_EVENT_DEFS, missionEventDue, missionOf } from './missionEvents.ts';

export type EventKind = 'land' | 'people' | 'court' | 'trade' | 'war' | 'faith' | 'knowledge';

/** What an event is about, kept by id so it survives a save. */
export interface Subject {
  city?: number;
  house?: number;
  house2?: number;
  civ?: number;
  good?: string;
  hex?: number;
  /** a mission event (missionEvents.ts): the culture choice of the mission it serves */
  mission?: string;
  /** anything else a mission event keeps (a slot, a wonder, an army) */
  extra?: string;
}

export interface RealmEventState {
  /** turn the next event may come */
  next: number;
  history: { id: string; turn: number }[];
  pending?: { id: string; turn: number; subject: Subject; variant: number };
  /** follow-ups waiting for their turn (and, for story chapters, an age) */
  queued: { id: string; turn: number; subject: Subject; age?: number }[];
  /** what the player chose in each story so far (storyEvents.ts), by story id */
  story?: Record<string, string>;
  lastKind?: EventKind;
}

export interface Ctx {
  s: GameState;
  civ: Civ;
  city?: City;
  house?: Dynasty;
  house2?: Dynasty;
  other?: Civ;
  good?: string;
  hex?: number;
  mission?: string;
  extra?: string;
}

export interface Choice {
  label: string;
  /** the mission this choice serves, named on it (missionEvents.ts) */
  mission?: string;
  /** what it costs and gives, shown before choosing */
  effect: string;
  /** why it cannot be chosen now, or null */
  blocked?: (c: Ctx) => string | null;
  apply: (c: Ctx) => string;
}

export interface EventDef {
  id: string;
  kind: EventKind;
  title: (c: Ctx) => string;
  /** several wordings; one is picked when the event fires */
  text: ((c: Ctx) => string)[];
  /** turns before it can come again; Infinity for once a game */
  cooldown: number;
  /** finds what the event is about, or null when it cannot happen now */
  subject: (s: GameState, civ: Civ, r: Rng) => Subject | null;
  weight?: number;
  choices: (c: Ctx) => Choice[];
  /** a follow-up only: never drawn at random */
  followUp?: boolean;
  /** a chapter of a story that runs across the ages (storyEvents.ts) */
  story?: { id: string; name: string; chapter: number; of: number };
}

// ---------------------------------------------------------------- helpers

/** harmful events: rarer on Casual, more common on Hard */
const HARSH = new Set(['blight', 'plague', 'fire', 'bandits', 'flood']);
const pick = <T>(r: Rng, xs: T[]): T | undefined =>
  xs.length ? xs[Math.floor(r() * xs.length)] : undefined;
const mine = (s: GameState, civ: Civ) => s.cities.filter(c => c.civId === civ.id);
const built = (s: GameState, c: City, pred: (id: string) => boolean) =>
  s.districts
    .filter(d => d.cityId === c.id)
    .flatMap(d => d.slots.map((x, i) => ({ d, i, x })))
    .filter(e => e.x.built && e.x.type && pred(e.x.type));
const has = (s: GameState, c: City, id: string) => built(s, c, t => t === id).length > 0;
const payGold = (n: number) => (c: Ctx) =>
  c.civ.gold < n ? `Needs ${n} gold (you have ${Math.floor(c.civ.gold)}).` : null;
/** Gold sums grow with the ages, so a choice keeps its weight. */
const scale = (_s: GameState, civ: Civ, base: number) =>
  Math.round(base * (1 + 0.5 * (ageOf(civ.techs) - 1)));
const people = (n: number) => `${n.toLocaleString()} people`;
const loseShare = (c: City, k: number) => {
  const n = Math.max(0, Math.min(c.pop - 1000, Math.round((c.pop * k) / 50) * 50));
  c.pop -= n;
  return n;
};
const currentTechCost = (c: Ctx) =>
  c.civ.researching ? techCost(c.s, c.civ, c.civ.researching) : 40 * ageOf(c.civ.techs);
const bestArea = (d: Dynasty): Area => [...AREAS].sort((a, b) => levelOf(d, b) - levelOf(d, a))[0];
const capital = (s: GameState, civ: Civ) => mine(s, civ).sort((a, b) => a.id - b.id)[0];

// ---------------------------------------------------------------- the events

const EVENTS: EventDef[] = [
  {
    id: 'bumper-harvest',
    kind: 'land',
    cooldown: 30,
    title: c => `A bumper harvest in ${c.city!.name}`,
    text: [
      c => `The fields around ${c.city!.name} have never given so much. The barns overflow.`,
      c => `Sun and rain came just when they should: ${c.city!.name} brings in twice the grain.`,
    ],
    subject: (s, civ, r) => {
      const c = pick(
        r,
        mine(s, civ).filter(
          x => !isUrban(x) && built(s, x, t => SLOT_TYPES[t].line === 'food').length >= 2,
        ),
      );
      return c ? { city: c.id } : null;
    },
    choices: c => {
      const food = growthCost(c.s, c.city!);
      const gold = scale(c.s, c.civ, 20);
      return [
        {
          label: 'Fill the granaries',
          effect: `+${food} food in store: ${c.city!.name} grows sooner`,
          apply: x => ((x.city!.food += food), `${x.city!.name} will feed more mouths.`),
        },
        {
          label: 'Sell the surplus',
          effect: `+${gold} gold`,
          apply: x => ((x.civ.gold += gold), `Merchants pay well for the grain.`),
        },
      ];
    },
  },
  {
    id: 'blight',
    kind: 'land',
    cooldown: 40,
    title: c => `Blight in ${c.city!.name}`,
    text: [
      c => `A grey rot spreads through the crops of ${c.city!.name}. Half the harvest is lost.`,
      c => `Locusts darken the sky over ${c.city!.name}; the farmers watch the fields go bare.`,
    ],
    subject: (s, civ, r) => {
      const c = pick(
        r,
        mine(s, civ).filter(
          x => x.pop >= 2000 && built(s, x, t => SLOT_TYPES[t].line === 'food').length >= 1,
        ),
      );
      return c ? { city: c.id } : null;
    },
    choices: c => {
      const gold = scale(c.s, c.civ, 25);
      return [
        {
          label: 'Buy grain abroad',
          effect: `−${gold} gold; no one goes hungry`,
          blocked: payGold(gold),
          apply: x => ((x.civ.gold -= gold), 'Ships bring grain; the town is fed.'),
        },
        {
          label: 'Tighten belts',
          effect: `the store is emptied and ${c.city!.name} loses ${people(250)}`,
          apply: x => (
            (x.city!.food = 0),
            (x.city!.pop = Math.max(1000, x.city!.pop - 250)),
            'A hard winter. Some leave, some do not wake.'
          ),
        },
      ];
    },
  },
  {
    id: 'prospectors',
    kind: 'land',
    cooldown: 60,
    weight: 0.8,
    title: c => `Prospectors near ${c.city!.name}`,
    text: [
      c =>
        `Prospectors come back from the hills by ${c.city!.name} with ore in their packs. They want backing to dig.`,
      c =>
        `A shepherd near ${c.city!.name} found strange stones. Prospectors say there is more where that came from.`,
    ],
    subject: (s, civ, r) => {
      for (const c of [...mine(s, civ)].sort(() => r() - 0.5)) {
        const spot = neighbors({ w: s.map.w, h: s.map.h }, c.hex).find(
          h => isPassableLand(s.map, h) && !s.map.deposit[h] && !s.cities.some(o => o.hex === h),
        );
        if (spot === undefined) continue;
        const kinds = validDeposits(
          s.map.terrain[spot],
          s.map.relief[spot],
          s.map.vegetation[spot],
        ).filter(
          k =>
            DEPOSITS[k].by === 'mine' &&
            (!DEPOSITS[k].revealedBy || civ.techs.includes(DEPOSITS[k].revealedBy!)),
        );
        const k = pick(r, kinds);
        if (k) return { city: c.id, hex: spot, good: k };
      }
      return null;
    },
    choices: c => {
      const gold = scale(c.s, c.civ, 30);
      return [
        {
          label: 'Fund the dig',
          effect: `−${gold} gold: a ${DEPOSITS[c.good!].name.toLowerCase()} seam opens by ${c.city!.name} (3 mines in a district work it)`,
          blocked: payGold(gold),
          apply: x => (
            (x.civ.gold -= gold),
            (x.s.map.deposit[x.hex!] = { kind: x.good!, richness: 1 }),
            `The dig strikes ${DEPOSITS[x.good!].name.toLowerCase()}.`
          ),
        },
        {
          label: 'Send them away',
          effect: 'nothing',
          apply: () => 'The prospectors try their luck elsewhere.',
        },
      ];
    },
  },
  {
    id: 'plague',
    kind: 'people',
    cooldown: 70,
    weight: 0.8,
    title: c => `Plague in ${c.city!.name}`,
    text: [
      c => `Fever runs through the crowded streets of ${c.city!.name}. The sick fill the squares.`,
      c => `Sailors brought a sickness to ${c.city!.name}. It spreads from house to house.`,
    ],
    subject: (s, civ, r) => {
      const c = pick(
        r,
        mine(s, civ).filter(x => x.pop >= 5000),
      );
      return c ? { city: c.id } : null;
    },
    choices: c => {
      const gold = scale(c.s, c.civ, 40);
      const faith = has(c.s, c.city!, 'shrine') || has(c.s, c.city!, 'temple');
      const out: Choice[] = [
        {
          label: 'Hire physicians',
          effect: `−${gold} gold; about 3% of the people die`,
          blocked: payGold(gold),
          apply: x => {
            x.civ.gold -= gold;
            const n = loseShare(x.city!, 0.03);
            queue(x.s, 'plague-passes', 6, { city: x.city!.id });
            return `The physicians save many; ${people(n)} are lost.`;
          },
        },
        {
          label: 'Close the gates',
          effect: 'about 10% of the people die; the plague goes no further',
          apply: x => {
            const n = loseShare(x.city!, 0.1);
            queue(x.s, 'plague-passes', 6, { city: x.city!.id });
            return `${people(n)} die behind the walls.`;
          },
        },
      ];
      if (faith)
        out.push({
          label: 'Lead prayers',
          effect: 'about 6% of the people die; +20 culture',
          apply: x => {
            const n = loseShare(x.city!, 0.06);
            x.civ.culture.points += 20;
            queue(x.s, 'plague-passes', 6, { city: x.city!.id });
            return `The temples are full; ${people(n)} are lost.`;
          },
        });
      return out;
    },
  },
  {
    id: 'plague-passes',
    kind: 'people',
    cooldown: 0,
    followUp: true,
    title: c => `The plague leaves ${c.city!.name}`,
    text: [
      c =>
        `The last of the sick in ${c.city!.name} rise from their beds. The town counts its dead.`,
    ],
    subject: () => null,
    choices: c => [
      {
        label: 'Honour the dead',
        effect: '+15 culture',
        apply: x => ((x.civ.culture.points += 15), 'A day of mourning, and a monument of names.'),
      },
      {
        label: 'Call in new settlers',
        effect: `+${people(250)} in ${c.city!.name}`,
        apply: x => ((x.city!.pop += 250), 'Families from the countryside fill the empty houses.'),
      },
    ],
  },
  {
    id: 'fire',
    kind: 'people',
    cooldown: 45,
    title: c => `Fire in ${c.city!.name}`,
    text: [
      c => `A fire breaks out in ${c.city!.name} and leaps from roof to roof.`,
      c => `A careless lamp in ${c.city!.name}, a dry wind, and half a street is burning.`,
    ],
    subject: (s, civ, r) => {
      const c = pick(
        r,
        mine(s, civ).filter(x => built(s, x, t => !SLOT_TYPES[t].fixed && !isRural(t)).length >= 3),
      );
      return c ? { city: c.id } : null;
    },
    choices: c => {
      const gold = scale(c.s, c.civ, 20);
      return [
        {
          label: 'Pay for fire crews',
          effect: `−${gold} gold; nothing is lost`,
          blocked: payGold(gold),
          apply: x => ((x.civ.gold -= gold), 'The bucket chains hold the fire.'),
        },
        {
          label: 'Let it burn out',
          effect: 'one building must be rebuilt',
          apply: x => {
            const e = pick(
              mulberry32(hashSeed(x.s.turn, x.city!.id)),
              built(x.s, x.city!, t => !SLOT_TYPES[t].fixed && !isRural(t)),
            );
            if (!e) return 'The fire dies down.';
            e.x.built = false;
            e.x.progress = 0;
            return `The ${SLOT_TYPES[e.x.type!].name.toLowerCase()} burned down; it will be rebuilt.`;
          },
        },
      ];
    },
  },
  {
    id: 'feud',
    kind: 'court',
    cooldown: 35,
    title: c => `House ${c.house!.name} and House ${c.house2!.name} feud`,
    text: [
      c =>
        `A marriage was promised and broken: House ${c.house!.name} and House ${c.house2!.name} draw swords at court.`,
      c =>
        `Land, cattle and an old insult: House ${c.house!.name} and House ${c.house2!.name} demand that you judge between them.`,
    ],
    subject: (s, civ, r) => {
      if (civ.dynasties.length < 2) return null;
      const [a, b] = [...civ.dynasties].sort(() => r() - 0.5);
      return { house: a.id, house2: b.id };
    },
    choices: c => {
      const gold = Math.ceil(honoursCost(c.s, c.civ) / 2);
      return [
        {
          label: `Side with House ${c.house!.name}`,
          effect: `House ${c.house!.name} −15 unrest, House ${c.house2!.name} +20`,
          apply: x => (
            (x.house!.unrest = Math.max(0, x.house!.unrest - 15)),
            (x.house2!.unrest += 20),
            `House ${x.house2!.name} will not forget.`
          ),
        },
        {
          label: `Side with House ${c.house2!.name}`,
          effect: `House ${c.house2!.name} −15 unrest, House ${c.house!.name} +20`,
          apply: x => (
            (x.house2!.unrest = Math.max(0, x.house2!.unrest - 15)),
            (x.house!.unrest += 20),
            `House ${x.house!.name} will not forget.`
          ),
        },
        {
          label: 'Pay for a settlement',
          effect: `−${gold} gold; both −5 unrest`,
          blocked: payGold(gold),
          apply: x => (
            (x.civ.gold -= gold),
            (x.house!.unrest = Math.max(0, x.house!.unrest - 5)),
            (x.house2!.unrest = Math.max(0, x.house2!.unrest - 5)),
            'Gold buys a grudging peace.'
          ),
        },
      ];
    },
  },
  {
    id: 'heir',
    kind: 'court',
    cooldown: 40,
    title: c => `An heir of House ${c.house!.name} comes of age`,
    text: [
      c =>
        `The heir of House ${c.house!.name} is grown, restless and gifted. What will you make of them?`,
      c =>
        `House ${c.house!.name} presents its heir at court and asks what place the realm has for them.`,
    ],
    subject: (s, civ, r) => {
      const d = pick(r, civ.dynasties);
      return d ? { house: d.id } : null;
    },
    choices: c => {
      const a = bestArea(c.house!);
      return [
        {
          label: 'Send them to study',
          effect: `House ${c.house!.name}: +20 experience in ${a === 'military' ? 'war' : a}`,
          apply: x => ((x.house!.xp[a] = (x.house!.xp[a] ?? 0) + 20), 'The heir returns learned.'),
        },
        {
          label: 'Give them a command',
          effect: `House ${c.house!.name}: +20 experience in war`,
          apply: x => (
            (x.house!.xp.military = (x.house!.xp.military ?? 0) + 20),
            'The heir rides out with the levies.'
          ),
        },
        {
          label: 'Keep them at court',
          effect: `House ${c.house!.name}: −10 unrest`,
          apply: x => (
            (x.house!.unrest = Math.max(0, x.house!.unrest - 10)),
            'The house is pleased to be near the throne.'
          ),
        },
      ];
    },
  },
  {
    id: 'scholars',
    kind: 'knowledge',
    cooldown: 40,
    title: () => 'Wandering scholars',
    text: [
      () => 'A band of scholars, driven out of a foreign court, asks for shelter and a library.',
      () => 'Travelling scholars arrive with cases of books and arguments to match.',
    ],
    subject: (s, civ) => (civ.techs.length >= 3 && mine(s, civ).length ? {} : null),
    choices: c => {
      const sci = Math.round(currentTechCost(c) * 0.25);
      const gold = scale(c.s, c.civ, 30);
      return [
        {
          label: 'Welcome them',
          effect: `+${sci} science`,
          apply: x => ((x.civ.science += sci), 'Their lessons speed your research.'),
        },
        {
          label: 'Buy their books',
          effect: `−${gold} gold; a science trinket for your houses`,
          blocked: payGold(gold),
          apply: x => {
            x.civ.gold -= gold;
            const t = awardTrinket(x.s, x.civ, 'research', x.s.turn);
            return `The ${t.name} goes to your treasury.`;
          },
        },
      ];
    },
  },
  {
    id: 'caravan',
    kind: 'trade',
    cooldown: 35,
    title: c => `A caravan from the ${c.other!.name}`,
    text: [
      c =>
        `A caravan of the ${c.other!.name} reaches your market, heavy with ${GOODS[c.good!].name.toLowerCase()}.`,
      c =>
        `Traders of the ${c.other!.name} set up stalls in your capital and offer ${GOODS[c.good!].name.toLowerCase()}.`,
    ],
    subject: (s, civ, r) => {
      const o = pick(
        r,
        s.civs.filter(
          x =>
            x.alive &&
            x.id !== civ.id &&
            civ.met.includes(x.id) &&
            !s.wars.some(w => (w.a === civ.id && w.b === x.id) || (w.b === civ.id && w.a === x.id)),
        ),
      );
      const cap = capital(s, civ);
      if (!o || !cap) return null;
      const stock = marketStock(s, cap);
      const g = pick(
        r,
        Object.keys(GOODS).filter(k => GOODS[k].kind === 'luxury' && (stock[k] ?? 0) < 3),
      );
      return g ? { civ: o.id, good: g } : null;
    },
    choices: c => {
      const gold = scale(c.s, c.civ, 25);
      const tax = scale(c.s, c.civ, 15);
      return [
        {
          label: `Buy their ${GOODS[c.good!].name.toLowerCase()}`,
          effect: `−${gold} gold; +8 ${GOODS[c.good!].name.toLowerCase()} in your capital`,
          blocked: payGold(gold),
          apply: x => {
            x.civ.gold -= gold;
            const cap = capital(x.s, x.civ)!;
            cap.stockpile[x.good!] = (cap.stockpile[x.good!] ?? 0) + 8;
            return 'The goods are unloaded.';
          },
        },
        {
          label: 'Tax them heavily',
          effect: `+${tax} gold; the ${c.other!.name} think less of you`,
          apply: x => (
            (x.civ.gold += tax),
            remember(x.s, x.other!.id, x.civ.id, 'tolls', 'Taxed our merchants', -8, 0.2),
            'The traders pay, and grumble.'
          ),
        },
        {
          label: 'Wave them through',
          effect: `the ${c.other!.name} think better of you`,
          apply: x => (
            remember(x.s, x.other!.id, x.civ.id, 'welcome', 'Welcomed our merchants', 8, 0.2),
            'Word of your welcome travels home.'
          ),
        },
      ];
    },
  },
  {
    id: 'bandits',
    kind: 'war',
    cooldown: 35,
    title: () => 'Bandits on the roads',
    text: [
      () => 'Bandits waylay travellers on your roads. Merchants refuse to go out without guards.',
      () => 'A robber chief and his band hold a stretch of your road to ransom.',
    ],
    subject: (s, civ, r) => {
      // a stretch of road near home, not in a settlement
      const g = { w: s.map.w, h: s.map.h };
      const own = mine(s, civ);
      const roads: number[] = [];
      for (let i = 0; i < s.roads.length; i++)
        if (
          s.roads[i] &&
          !s.cities.some(c => c.hex === i) &&
          own.some(c => distance(g, c.hex, i) <= 4)
        )
          roads.push(i);
      const hex = pick(r, roads);
      return hex !== undefined ? { hex } : null;
    },
    choices: c => {
      const gold = scale(c.s, c.civ, 20);
      const army = c.s.formations.find(
        f => f.civId === c.civ.id && f.kind === 'army' && f.name !== 'Scouts',
      );
      return [
        {
          label: 'Send troops',
          effect: `${army ? army.name : 'an army'} loses a few men; the ruling house learns war`,
          blocked: () => (army ? null : 'You have no army to send.'),
          apply: x => {
            for (const co of army!.cohorts) co.strength = Math.max(20, co.strength - 5);
            const r = rulerOf(x.civ);
            r.xp.military = (r.xp.military ?? 0) + 10;
            return 'The bandits are hunted down.';
          },
        },
        {
          label: 'Pay them off',
          effect: `−${gold} gold`,
          blocked: payGold(gold),
          apply: x => ((x.civ.gold -= gold), 'The bandits move on, richer.'),
        },
        {
          label: 'Leave them be',
          effect: 'a stretch of road is torn up',
          apply: x => (
            (x.s.roads[x.hex!] = 0),
            invalidateMarkets(),
            'They pull up the paving to sell the stones.'
          ),
        },
      ];
    },
  },
  {
    id: 'festival',
    kind: 'faith',
    cooldown: 30,
    title: () => 'The great festival',
    text: [
      () => 'The year turns, and the people ask for a festival worthy of the old gods.',
      () => 'Harvest is in. The towns want music, games and a feast in the square.',
    ],
    subject: (s, civ) => (mine(s, civ).length >= 2 ? {} : null),
    choices: c => {
      const gold = scale(c.s, c.civ, 20);
      return [
        {
          label: 'Hold the festival',
          effect: `−${gold} gold; +25 culture`,
          blocked: payGold(gold),
          apply: x => (
            (x.civ.gold -= gold),
            (x.civ.culture.points += 25),
            'Songs about it will be sung for years.'
          ),
        },
        {
          label: 'Not this year',
          effect: 'nothing',
          apply: () => 'The people grumble, and go back to work.',
        },
      ];
    },
  },
  {
    id: 'refugees',
    kind: 'people',
    cooldown: 40,
    title: c => `Refugees reach ${c.city!.name}`,
    text: [
      c =>
        `Families fleeing a distant war arrive at the gates of ${c.city!.name} with nothing but what they carry.`,
      c => `A column of refugees, driven out by fighting, asks ${c.city!.name} for a roof.`,
    ],
    subject: (s, civ, r) => {
      if (!s.wars.length) return null;
      const c = pick(r, mine(s, civ));
      return c ? { city: c.id } : null;
    },
    choices: c => [
      {
        label: 'Take them in',
        effect: `+${people(500)} in ${c.city!.name}; its food store is used up`,
        apply: x => ((x.city!.pop += 500), (x.city!.food = 0), 'They will be your people now.'),
      },
      { label: 'Turn them away', effect: 'nothing', apply: () => 'They move on down the road.' },
    ],
  },
  {
    id: 'relic',
    kind: 'faith',
    cooldown: Infinity,
    title: () => 'A holy relic',
    text: [
      () =>
        'Diggers turn up a reliquary of the founders, its seals unbroken. Every house wants it.',
    ],
    subject: (s, civ) =>
      mine(s, civ).some(c => has(s, c, 'shrine') || has(s, c, 'temple'))
        ? { house: civ.dynasties[civ.dynasties.length - 1]?.id }
        : null,
    choices: c => [
      {
        label: `Give it to House ${rulerOf(c.civ).name}`,
        effect: 'a religion trinket for the throne',
        apply: x => {
          const t = awardTrinket(x.s, x.civ, 'culture', 7);
          const i = x.civ.trinkets.indexOf(t);
          x.civ.trinkets.splice(i, 1);
          rulerOf(x.civ).trinkets.push(t);
          return `The ${t.name} rests in the throne room.`;
        },
      },
      {
        label: 'Show it to the people',
        effect: '+30 culture',
        apply: x => ((x.civ.culture.points += 30), 'Pilgrims come from every town.'),
      },
    ],
  },
  {
    id: 'envoy',
    kind: 'court',
    cooldown: 35,
    title: c => `An envoy of the ${c.other!.name}`,
    text: [
      c =>
        `An envoy of the ${c.other!.name} arrives with gifts and a long speech about friendship.`,
      c => `The ${c.other!.name} send an embassy, curious about your court and your strength.`,
    ],
    subject: (s, civ, r) => {
      const o = pick(
        r,
        s.civs.filter(
          x =>
            x.alive &&
            x.id !== civ.id &&
            civ.met.includes(x.id) &&
            !s.wars.some(w => (w.a === civ.id && w.b === x.id) || (w.b === civ.id && w.a === x.id)),
        ),
      );
      return o ? { civ: o.id } : null;
    },
    choices: c => {
      const gold = scale(c.s, c.civ, 15);
      return [
        {
          label: 'Return gifts in kind',
          effect: `−${gold} gold; the ${c.other!.name} think much better of you`,
          blocked: payGold(gold),
          apply: x => (
            (x.civ.gold -= gold),
            remember(x.s, x.other!.id, x.civ.id, 'gifts', 'Exchanged gifts', 15, 0.15),
            'The envoy leaves delighted.'
          ),
        },
        {
          label: 'Receive them politely',
          effect: `the ${c.other!.name} think a little better of you`,
          apply: x => (
            remember(x.s, x.other!.id, x.civ.id, 'courtesy', 'Received our envoy', 5, 0.2),
            'Courtesies are exchanged.'
          ),
        },
        {
          label: 'Keep them waiting',
          effect: `the ${c.other!.name} take offence`,
          apply: x => (
            remember(x.s, x.other!.id, x.civ.id, 'snub', 'Snubbed our envoy', -10, 0.2),
            'The envoy leaves in a temper.'
          ),
        },
      ];
    },
  },
  {
    id: 'inventor',
    kind: 'knowledge',
    cooldown: 50,
    title: () => 'An inventor asks for a patron',
    text: [
      () =>
        'A tinkerer with burnt fingers shows the court a machine that may change everything, or nothing.',
      () =>
        'An engineer brings drawings of a device no one understands. He needs money to build it.',
    ],
    subject: (s, civ) => (ageOf(civ.techs) >= 3 ? {} : null),
    choices: c => {
      const gold = scale(c.s, c.civ, 30);
      const sci = Math.round(currentTechCost(c) * 0.5);
      return [
        {
          label: 'Become his patron',
          effect: `−${gold} gold; +${sci} science`,
          blocked: payGold(gold),
          apply: x => (
            (x.civ.gold -= gold),
            (x.civ.science += sci),
            'It works, more or less. The idea spreads.'
          ),
        },
        {
          label: 'Send him away',
          effect: 'nothing',
          apply: () => 'He leaves to find a richer court.',
        },
      ];
    },
  },
  {
    id: 'flood',
    kind: 'land',
    cooldown: 45,
    title: c => `The river floods at ${c.city!.name}`,
    text: [
      c => `Spring rains swell the river and it breaks its banks at ${c.city!.name}.`,
      c => `The river at ${c.city!.name} rises in the night and the lower fields are under water.`,
    ],
    subject: (s, civ, r) => {
      const c = pick(
        r,
        mine(s, civ).filter(x => s.map.river[x.hex]),
      );
      return c ? { city: c.id } : null;
    },
    choices: c => [
      {
        label: 'Raise levees',
        effect: 'uses 6 stone and 6 wood from the market',
        blocked: x => {
          const st = marketStock(x.s, x.city!);
          return (st.stone ?? 0) < 6 || (st.wood ?? 0) < 6
            ? 'Needs 6 stone and 6 wood in the market.'
            : null;
        },
        apply: x => {
          x.city!.stockpile.stone = Math.max(0, (x.city!.stockpile.stone ?? 0) - 6);
          x.city!.stockpile.wood = Math.max(0, (x.city!.stockpile.wood ?? 0) - 6);
          return 'The levees hold.';
        },
      },
      {
        label: 'Wait for the water to fall',
        effect: `${c.city!.name}'s food store is lost`,
        apply: x => ((x.city!.food = 0), 'The water falls, leaving mud and empty barns.'),
      },
    ],
  },
  {
    id: 'comet',
    kind: 'faith',
    cooldown: Infinity,
    weight: 0.6,
    title: () => 'A comet in the sky',
    text: [
      () =>
        'A comet hangs over the realm for nine nights. Priests and astronomers argue about what it means.',
    ],
    subject: (s, civ) => (s.turn > 40 && mine(s, civ).length ? {} : null),
    choices: () => [
      {
        label: 'A sign of favour',
        effect: '+20 culture',
        apply: x => ((x.civ.culture.points += 20), 'The people take heart.'),
      },
      {
        label: 'Study its path',
        effect: '+20 science',
        apply: x => ((x.civ.science += 20), 'The astronomers fill a book with figures.'),
      },
    ],
  },
];

export const REALM_EVENTS: Record<string, EventDef> = Object.fromEntries(
  [...EVENTS, ...STORY_EVENTS, ...MISSION_EVENT_DEFS].map(e => [e.id, e]),
);

// ---------------------------------------------------------------- pacing

export const newRealmEventState = (): RealmEventState => ({ next: 5, history: [], queued: [] });

function queue(s: GameState, id: string, inTurns: number, subject: Subject) {
  s.realmEvents ??= newRealmEventState();
  s.realmEvents.queued.push({ id, turn: s.turn + inTurns, subject });
}

function ctxOf(s: GameState, civ: Civ, sub: Subject): Ctx | null {
  const c: Ctx = { s, civ };
  if (sub.city !== undefined) {
    c.city = s.cities.find(x => x.id === sub.city && x.civId === civ.id);
    if (!c.city) return null;
  }
  if (sub.house !== undefined) {
    c.house = civ.dynasties.find(d => d.id === sub.house);
    if (!c.house) return null;
  }
  if (sub.house2 !== undefined) {
    c.house2 = civ.dynasties.find(d => d.id === sub.house2);
    if (!c.house2) return null;
  }
  if (sub.civ !== undefined) {
    c.other = s.civs[sub.civ];
    if (!c.other?.alive) return null;
  }
  c.good = sub.good;
  c.hex = sub.hex;
  // a mission event lapses once its mission is done
  if (sub.mission !== undefined && !missionOf(civ, sub.mission)) return null;
  c.mission = sub.mission;
  c.extra = sub.extra;
  return c;
}

/** Called each turn for the player: maybe start an event. Returns its title for the turn report. */
export function realmEventTurn(s: GameState, civ: Civ): string | null {
  s.realmEvents ??= newRealmEventState();
  const st = s.realmEvents;
  if (st.pending) return null;
  const r = mulberry32(hashSeed(s.settings.map.seed, s.turn * 7919 + 13));
  // a follow-up that is due comes first
  // never two close together: at least 3 turns since the last one, follow-ups included
  // history events (events.ts) share the gap: one stream of stories for the player, not two
  const own = st.history.length ? st.history[st.history.length - 1].turn : -Infinity;
  const other = s.lastEvent?.[civ.id] ?? -Infinity;
  if (other > own) st.next = Math.max(st.next, other + 5);
  const last = Math.max(own, other);
  if (s.turn - last < 3) return null;
  const due = st.queued.findIndex(
    q => q.turn <= s.turn && (q.age === undefined || ageOf(civ.techs) >= q.age),
  );
  let id: string | null = null,
    subject: Subject = {};
  if (due >= 0) {
    const q = st.queued.splice(due, 1)[0];
    if (ctxOf(s, civ, q.subject)) {
      id = q.id;
      subject = q.subject;
      st.next = Math.max(st.next, s.turn + 5);
    }
  }
  // a stalled culture mission may bring an event aimed at it (missionEvents.ts), within the
  // same pacing: when the next event is due, or after 5 quiet turns
  if (!id && (s.turn >= st.next || s.turn - last >= 5)) {
    const m = missionEventDue(s, civ);
    if (m) {
      id = m.id;
      subject = m.subject;
      st.next = Math.max(st.next, s.turn + 5);
    }
  }
  if (!id) {
    // never a long quiet: after 8 turns with no story the next one may come at once
    if (s.turn < st.next && s.turn - last < 8) return null;
    const lastTurn = (eid: string) => st.history.filter(h => h.id === eid).pop()?.turn ?? -Infinity;
    const options: { e: EventDef; sub: Subject; w: number }[] = [];
    for (const e of [...EVENTS, ...STORY_EVENTS]) {
      if (e.followUp) continue;
      // sickness is now the Plague crisis (crises.ts): one plague, not three
      if (e.id === 'plague') continue;
      if (s.turn - lastTurn(e.id) < e.cooldown) continue;
      const sub = e.subject(s, civ, r);
      if (!sub || !ctxOf(s, civ, sub)) continue;
      // the same kind twice running is unlikely; events seen often fade
      const seen = st.history.filter(h => h.id === e.id).length;
      const harsh = HARSH.has(e.id) ? difficultyOf(s).harshEvents : 1;
      const w = ((e.weight ?? 1) * harsh * (st.lastKind === e.kind ? 0.25 : 1)) / (1 + seen * 0.5);
      options.push({ e, sub, w });
    }
    if (!options.length) {
      st.next = s.turn + 3;
      return null;
    }
    let roll = r() * options.reduce((a, o) => a + o.w, 0);
    const chosen = options.find(o => (roll -= o.w) <= 0) ?? options[options.length - 1];
    id = chosen.e.id;
    subject = chosen.sub;
    // the opening age moves quicker (4 to 9 turns), so the first hours are never quiet; later
    // ages have more of their own to do (5 to 15)
    st.next =
      ageOf(civ.techs) <= 1 ? s.turn + 4 + Math.floor(r() * 6) : s.turn + 5 + Math.floor(r() * 11);
  }
  const e = REALM_EVENTS[id];
  if (s.lastEvent) s.lastEvent[civ.id] = s.turn;
  st.pending = { id, turn: s.turn, subject, variant: Math.floor(r() * e.text.length) };
  st.lastKind = e.kind;
  const c = ctxOf(s, civ, subject);
  // its subject is gone already (a settlement lost, a people vanished): no event after all
  if (!c) {
    st.pending = undefined;
    return null;
  }
  try {
    return e.title(c);
  } catch (err) {
    // an event that cannot describe itself must never stop the turn
    console.error(`event ${id} dropped`, err);
    st.pending = undefined;
    return null;
  }
}

/** The event waiting for the player, ready to show. */
export function pendingRealmEvent(s: GameState, civ: Civ) {
  const p = s.realmEvents?.pending;
  if (!p) return null;
  const e = REALM_EVENTS[p.id];
  const c = e && ctxOf(s, civ, p.subject);
  if (!e || !c) {
    s.realmEvents!.pending = undefined;
    return null;
  }
  const choices = e.choices(c);
  return {
    id: e.id,
    kind: e.kind,
    story: e.story,
    title: e.title(c),
    text: e.text[p.variant % e.text.length](c),
    choices: choices.map(ch => ({
      label: ch.label,
      effect: ch.effect,
      mission: ch.mission,
      blocked: ch.blocked?.(c) ?? null,
    })),
  };
}

/** Make the choice. Returns what happened. */
export function resolveRealmEvent(
  s: GameState,
  civ: Civ,
  index: number,
): { ok: boolean; msg: string } {
  const p = s.realmEvents?.pending;
  if (!p) return { ok: false, msg: 'No event is waiting.' };
  const e = REALM_EVENTS[p.id];
  const c = ctxOf(s, civ, p.subject);
  if (!e || !c) {
    s.realmEvents!.pending = undefined;
    return { ok: false, msg: 'The moment has passed.' };
  }
  const ch = e.choices(c)[index];
  if (!ch) return { ok: false, msg: 'No such choice.' };
  const why = ch.blocked?.(c);
  if (why) return { ok: false, msg: why };
  const out = ch.apply(c);
  s.realmEvents!.history.push({ id: e.id, turn: s.turn });
  s.realmEvents!.pending = undefined;
  log(
    s,
    civ.id,
    e.story
      ? `${e.story.name}, chapter ${e.story.chapter}: ${e.title(c)}. ${ch.label}: ${out}`
      : `${e.title(c)}: ${ch.label}. ${out}`,
  );
  return { ok: true, msg: out };
}

/** A choice left open when the turn ends: the first one that can be made. */
export function settleRealmEvent(s: GameState, civ: Civ): string[] {
  const ev = pendingRealmEvent(s, civ);
  if (!ev) return [];
  const i = Math.max(
    0,
    ev.choices.findIndex(ch => !ch.blocked),
  );
  const r = resolveRealmEvent(s, civ, i);
  return r.ok ? [`${ev.title}: ${ev.choices[i].label}. ${r.msg}`] : [];
}
