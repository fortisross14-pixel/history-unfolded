/**
 * Stories: events in chapters that run across the ages. An opening chapter is drawn like any
 * event (once a game); each choice is remembered and decides what the next chapter is about and
 * what it offers. Later chapters wait for a number of turns and, often, for the next age.
 * A story whose settlement, house or people is gone simply ends.
 *
 * Kept free of runtime imports from realmEvents.ts (types only), which registers these.
 */
import type { Area } from '../data/dynasties.ts';
import { ageOf } from '../data/techs.ts';
import { remember } from './diplomacy.ts';
import { awardTrinket } from './dynasty.ts';
import { isCoastal } from './economy.ts';
import { within } from './hex.ts';
import type { Rng } from './rng.ts';
import type { Choice, Ctx, EventDef, Subject } from './realmEvents.ts';
import type { City, Civ, GameState } from './types.ts';

// ---------------------------------------------------------------- helpers

const pick = <T>(r: Rng, xs: T[]): T | undefined =>
  xs.length ? xs[Math.floor(r() * xs.length)] : undefined;
const mine = (s: GameState, civ: Civ) => s.cities.filter(c => c.civId === civ.id);
const capital = (s: GameState, civ: Civ): City | undefined =>
  mine(s, civ).sort((a, b) => a.id - b.id)[0];
const age = (civ: Civ) => ageOf(civ.techs);
/** the next age, or this one in the last age */
const nextAge = (civ: Civ) => Math.min(5, age(civ) + 1);
/** sums grow with the ages, so a choice keeps its weight */
const scale = (civ: Civ, base: number) => Math.round(base * (1 + 0.5 * (age(civ) - 1)));
const payGold = (n: number) => (c: Ctx) =>
  c.civ.gold < n ? `Needs ${n} gold (you have ${Math.floor(c.civ.gold)}).` : null;
const people = (n: number) => `${n.toLocaleString()} people`;
const calm = (h: { unrest: number }, n: number) => (h.unrest = Math.max(0, h.unrest - n));
const culture = (c: Ctx, n: number) =>
  (c.civ.culture.points = Math.max(0, c.civ.culture.points + n));
const tension = (c: Ctx, n: number) =>
  (c.civ.culture.tension.religion = Math.max(0, (c.civ.culture.tension.religion ?? 0) + n));
const trinket = (c: Ctx, area: Area, salt: number) => awardTrinket(c.s, c.civ, area, salt).name;

/** What the player chose so far in a story. */
const flagOf = (s: GameState, story: string) => s.realmEvents?.story?.[story];
const setFlag = (c: Ctx, story: string, v: string) => {
  c.s.realmEvents!.story ??= {};
  c.s.realmEvents!.story[story] = v;
};
/** Queue the next chapter: after some turns and, if given, once the people reach an age. */
const next = (c: Ctx, id: string, turns: number, subject: Subject, inAge?: number) =>
  c.s.realmEvents!.queued.push({ id, turn: c.s.turn + turns, subject, age: inAge });
/** An opening chapter may come only in its ages, and once a game. */
const opens = (s: GameState, civ: Civ, story: string, from: number, to: number, turn = 0) =>
  !flagOf(s, story) && age(civ) >= from && age(civ) <= to && s.turn >= turn;

const chapter = (
  id: string,
  name: string,
  n: number,
  of: number,
  def: Omit<EventDef, 'id' | 'story' | 'cooldown'> & { cooldown?: number },
): EventDef => ({
  cooldown: Infinity,
  ...def,
  id,
  followUp: def.followUp ?? n > 1,
  story: { id: id.split(':')[0], name, chapter: n, of },
});

// ---------------------------------------------------------------- 1. the founder's legend

const LEGEND = 'legend';
const LEGEND_NAME = "The Founder's Legend";
const legend: EventDef[] = [
  chapter(`${LEGEND}:1`, LEGEND_NAME, 1, 3, {
    kind: 'people',
    weight: 1.4,
    title: c => `Songs of the founder of ${c.city!.name}`,
    text: [
      c =>
        `Around the fires of ${c.city!.name} the old ones sing of the first who settled here. Every singer tells it a little differently. The people ask: who was the founder?`,
    ],
    subject: (s, civ) => {
      const cap = capital(s, civ);
      return cap && opens(s, civ, LEGEND, 1, 1, 12) ? { city: cap.id } : null;
    },
    choices: c => [
      {
        label: 'A warrior who won the land',
        effect: '+10 culture; the legend will honour arms',
        apply: x => (
          culture(x, 10),
          setFlag(x, LEGEND, 'warrior'),
          next(x, `${LEGEND}:2`, 15, { city: x.city!.id }, 2),
          'The songs ring with bronze and battle.'
        ),
      },
      {
        label: 'A sage who gave the first laws',
        effect: `+${scale(c.civ, 12)} science; the legend will honour learning`,
        apply: x => (
          (x.civ.science += scale(x.civ, 12)),
          setFlag(x, LEGEND, 'sage'),
          next(x, `${LEGEND}:2`, 15, { city: x.city!.id }, 2),
          'Children learn the founder’s sayings by heart.'
        ),
      },
      {
        label: 'A mother of the people',
        effect: `+${people(250)} in ${c.city!.name}; the legend will honour family`,
        apply: x => (
          (x.city!.pop += 250),
          setFlag(x, LEGEND, 'mother'),
          next(x, `${LEGEND}:2`, 15, { city: x.city!.id }, 2),
          'Families come from far away to live in the founder’s town.'
        ),
      },
    ],
  }),
  chapter(`${LEGEND}:2`, LEGEND_NAME, 2, 3, {
    kind: 'faith',
    title: () => 'The founder’s tomb',
    text: [
      c =>
        `Diggers outside ${c.city!.name} break into a sealed tomb. Inside lies ${
          flagOf(c.s, LEGEND) === 'warrior'
            ? 'a warrior in rusted bronze, a great sword across the chest'
            : flagOf(c.s, LEGEND) === 'sage'
              ? 'an old figure among tablets covered in laws'
              : 'a woman buried with a hundred small gifts from a hundred families'
        }. The people are sure: it is the founder.`,
    ],
    subject: () => null,
    choices: c => {
      const f = flagOf(c.s, LEGEND);
      const gold = scale(c.civ, 25);
      const out: Choice[] = [
        {
          label: 'Raise a shrine over it',
          effect: `−${gold} gold; +30 culture`,
          blocked: payGold(gold),
          apply: x => (
            (x.civ.gold -= gold),
            culture(x, 30),
            setFlag(x, LEGEND, `${f}-shrine`),
            next(x, `${LEGEND}:3`, 20, { city: x.city!.id }, 3),
            'Pilgrims come with flowers and songs.'
          ),
        },
        {
          label: 'Let the scholars study it',
          effect: `+${scale(c.civ, 25)} science`,
          apply: x => (
            (x.civ.science += scale(x.civ, 25)),
            setFlag(x, LEGEND, `${f}-study`),
            next(x, `${LEGEND}:3`, 20, { city: x.city!.id }, 3),
            'The scholars measure, copy and argue.'
          ),
        },
      ];
      if (f === 'warrior')
        out.push({
          label: 'Carry the founder’s sword before the army',
          effect: 'a war treasure for your houses',
          apply: x => (
            setFlag(x, LEGEND, 'warrior-sword'),
            next(x, `${LEGEND}:3`, 20, { city: x.city!.id }, 3),
            `The ${trinket(x, 'military', 71)} goes to the treasury.`
          ),
        });
      if (f === 'sage')
        out.push({
          label: 'Copy the laws on the tablets',
          effect: `+${scale(c.civ, 40)} science`,
          apply: x => (
            (x.civ.science += scale(x.civ, 40)),
            setFlag(x, LEGEND, 'sage-laws'),
            next(x, `${LEGEND}:3`, 20, { city: x.city!.id }, 3),
            'The old laws are wiser than anyone expected.'
          ),
        });
      if (f === 'mother')
        out.push({
          label: 'A feast for every family',
          effect: `+${people(250)} in ${c.city!.name}; +10 culture`,
          apply: x => (
            (x.city!.pop += 250),
            culture(x, 10),
            setFlag(x, LEGEND, 'mother-feast'),
            next(x, `${LEGEND}:3`, 20, { city: x.city!.id }, 3),
            'For three days nobody in the town cooks for themselves.'
          ),
        });
      return out;
    },
  }),
  chapter(`${LEGEND}:3`, LEGEND_NAME, 3, 3, {
    kind: 'knowledge',
    title: () => 'Was there ever a founder?',
    text: [
      c =>
        `A scholar of ${c.city!.name} publishes a book: the tomb is older than the town, the songs borrowed from other peoples, the founder a story. Half the town is furious; the other half is buying the book.`,
    ],
    subject: () => null,
    choices: c => {
      const f = flagOf(c.s, LEGEND) ?? '';
      return [
        {
          label: 'Ban the book',
          effect: '+20 culture; the scholars grumble',
          apply: x => (culture(x, 20), 'The legend stands, a little stiffer than before.'),
        },
        {
          label: 'Let the truth be told',
          effect: `+${scale(c.civ, 45)} science; −10 culture`,
          apply: x => (
            (x.civ.science += scale(x.civ, 45)),
            culture(x, -10),
            'History becomes a subject, not a song.'
          ),
        },
        {
          label: 'Tell the legend anew',
          effect: f.endsWith('shrine')
            ? '+40 culture (the shrine keeps it alive)'
            : 'a treasure of the arts',
          apply: x =>
            f.endsWith('shrine')
              ? (culture(x, 40), 'At the shrine the old songs gain new verses.')
              : `Poets write it again; the ${trinket(x, 'culture', 73)} is made in its honour.`,
        },
      ];
    },
  }),
];

// ---------------------------------------------------------------- 2. the lost expedition

const EXP = 'expedition';
const EXP_NAME = 'The Lost Expedition';
/** a far land hex nobody of this people has seen: what the expedition found */
function farLand(s: GameState, civ: Civ, r: Rng): number | undefined {
  const all: number[] = [];
  for (let i = 0; i < s.map.terrain.length; i++)
    if (!civ.explored[i] && s.map.terrain[i] !== 'ocean' && s.map.terrain[i] !== 'coast')
      all.push(i);
  return pick(r, all);
}
const expedition: EventDef[] = [
  chapter(`${EXP}:1`, EXP_NAME, 1, 3, {
    kind: 'land',
    weight: 1.2,
    title: c => `An expedition leaves ${c.city!.name}`,
    text: [
      c =>
        `Sailors in ${c.city!.name} want to find what lies past the edge of the known sea. They have a ship; they want more.`,
    ],
    subject: (s, civ, r) => {
      if (!opens(s, civ, EXP, 1, 2, 20) || !civ.techs.includes('sailing')) return null;
      const c = pick(
        r,
        mine(s, civ).filter(x => isCoastal(s, x)),
      );
      return c ? { city: c.id } : null;
    },
    choices: c => {
      const gold = scale(c.civ, 20);
      return [
        {
          label: 'Fund three ships',
          effect: `−${gold} gold`,
          blocked: payGold(gold),
          apply: x => (
            (x.civ.gold -= gold),
            setFlag(x, EXP, 'funded'),
            next(x, `${EXP}:2`, 14, { city: x.city!.id }),
            'Three ships slip out on the morning tide.'
          ),
        },
        {
          label: 'Let the volunteers go alone',
          effect: 'nothing now',
          apply: x => (
            setFlag(x, EXP, 'alone'),
            next(x, `${EXP}:2`, 14, { city: x.city!.id }),
            'One small ship, and a crowd on the quay to wave.'
          ),
        },
      ];
    },
  }),
  chapter(`${EXP}:2`, EXP_NAME, 2, 3, {
    kind: 'land',
    title: () => 'A survivor returns',
    text: [
      c =>
        `A thin, sunburnt sailor walks into ${c.city!.name}. ${flagOf(c.s, EXP) === 'funded' ? 'Of three ships, one came back' : 'The ship is gone; the sailor came home on a stranger’s boat'}, with tales of lands no one here has seen.`,
    ],
    subject: () => null,
    choices: c => [
      {
        label: 'Draw a map from the tales',
        effect: 'reveals a far land',
        apply: x => {
          const r = () => ((x.s.turn * 9301 + 49297) % 233280) / 233280;
          const h = farLand(x.s, x.civ, r);
          if (h !== undefined)
            for (const k of within({ w: x.s.map.w, h: x.s.map.h }, h, 3)) x.civ.explored[k] = 1;
          setFlag(x, EXP, `${flagOf(x.s, EXP)}-map`);
          next(x, `${EXP}:3`, 10, { city: x.city!.id }, 4);
          return h === undefined
            ? 'The map shows nothing new.'
            : 'A new coast appears on your maps.';
        },
      },
      {
        label: 'Honour the lost crews',
        effect: '+20 culture',
        apply: x => (
          culture(x, 20),
          setFlag(x, EXP, `${flagOf(x.s, EXP)}-honour`),
          next(x, `${EXP}:3`, 10, { city: x.city!.id }, 4),
          'A stone by the harbour carries their names.'
        ),
      },
    ],
  }),
  chapter(`${EXP}:3`, EXP_NAME, 3, 3, {
    kind: 'trade',
    title: () => 'Children of the lost crew',
    text: [
      c =>
        `Merchants of ${c.city!.name} come home from a far coast with a strange story: a village there speaks your tongue, and keeps a ship’s figurehead in its square. The lost crew did not die after all.`,
    ],
    subject: () => null,
    choices: c => {
      const met = c.civ.met.filter(id => c.s.civs[id]?.alive && !c.s.civs[id].independent);
      const out: Choice[] = [
        {
          label: 'Trade their charts and stories',
          effect: `+${scale(c.civ, 40)} gold`,
          apply: x => ((x.civ.gold += scale(x.civ, 40)), 'Their charts are worth a fortune.'),
        },
      ];
      if (met.length)
        out.push({
          label: 'Claim kinship with their neighbours',
          effect: `the ${c.s.civs[met[0]].name} think better of you`,
          apply: x => (
            remember(x.s, met[0], x.civ.id, 'kin', 'Kin through the lost crew', 15, 0.1),
            `The ${x.s.civs[met[0]].name} welcome the cousins of their neighbours.`
          ),
        });
      return out;
    },
  }),
];

// ---------------------------------------------------------------- 3. a marriage of houses

const WED = 'marriage';
const WED_NAME = 'A Marriage of Houses';
const marriage: EventDef[] = [
  chapter(`${WED}:1`, WED_NAME, 1, 3, {
    kind: 'court',
    weight: 1.3,
    title: c => `House ${c.house!.name} and House ${c.house2!.name} would marry`,
    text: [
      c =>
        `The heir of House ${c.house!.name} and a daughter of House ${c.house2!.name} wish to marry. Two great houses as one family: a strength for the realm, or a danger to the throne.`,
    ],
    subject: (s, civ, r) => {
      if (!opens(s, civ, WED, 1, 3, 25) || civ.dynasties.length < 2) return null;
      const [a, b] = [...civ.dynasties].sort(() => r() - 0.5);
      return { house: a.id, house2: b.id };
    },
    choices: c => [
      {
        label: 'Bless the marriage',
        effect: 'both houses −10 unrest',
        apply: x => (
          calm(x.house!, 10),
          calm(x.house2!, 10),
          setFlag(x, WED, 'wed'),
          next(x, `${WED}:2`, 15, { house: x.house!.id, house2: x.house2!.id }),
          'Bells ring for a week.'
        ),
      },
      {
        label: 'Demand a dowry for the crown',
        effect: `+${scale(c.civ, 25)} gold; both houses +5 unrest`,
        apply: x => (
          (x.civ.gold += scale(x.civ, 25)),
          (x.house!.unrest += 5),
          (x.house2!.unrest += 5),
          setFlag(x, WED, 'wed'),
          next(x, `${WED}:2`, 15, { house: x.house!.id, house2: x.house2!.id }),
          'They pay, and remember the price.'
        ),
      },
      {
        label: 'Forbid it',
        effect: `House ${c.house!.name} +15 unrest`,
        apply: x => (
          (x.house!.unrest += 15),
          setFlag(x, WED, 'forbid'),
          next(x, `${WED}:2`, 10, { house: x.house!.id, house2: x.house2!.id }),
          'Two young people weep, and two old houses scowl.'
        ),
      },
    ],
  }),
  chapter(`${WED}:2`, WED_NAME, 2, 3, {
    kind: 'court',
    title: c => (flagOf(c.s, WED) === 'forbid' ? 'The lovers have fled' : 'An heir of two houses'),
    text: [
      c =>
        flagOf(c.s, WED) === 'forbid'
          ? `The heir of House ${c.house!.name} and the daughter of House ${c.house2!.name} have run away together. Both houses blame the other, and both blame you.`
          : `A child is born to House ${c.house!.name} and House ${c.house2!.name}: heir to two great houses at once. Everyone at court wants a hand in raising it.`,
    ],
    subject: () => null,
    choices: c =>
      flagOf(c.s, WED) === 'forbid'
        ? [
            {
              label: 'Pardon them and let them marry',
              effect: 'both houses −10 unrest; −10 culture (a ruler who backs down)',
              apply: x => (
                calm(x.house!, 10),
                calm(x.house2!, 10),
                culture(x, -10),
                setFlag(x, WED, 'pardon'),
                next(
                  x,
                  `${WED}:3`,
                  15,
                  { house: x.house!.id, house2: x.house2!.id },
                  nextAge(x.civ),
                ),
                'The court laughs, then cheers.'
              ),
            },
            {
              label: 'Bring them back in chains',
              effect: `House ${c.house2!.name} −10 unrest, House ${c.house!.name} +20`,
              apply: x => (
                calm(x.house2!, 10),
                (x.house!.unrest += 20),
                setFlag(x, WED, 'chains'),
                next(
                  x,
                  `${WED}:3`,
                  15,
                  { house: x.house!.id, house2: x.house2!.id },
                  nextAge(x.civ),
                ),
                'The law is kept. Nobody is happy.'
              ),
            },
          ]
        : [
            {
              label: 'Raise the child at court',
              effect: 'both houses −5 unrest; a treasure for the throne',
              apply: x => (
                calm(x.house!, 5),
                calm(x.house2!, 5),
                setFlag(x, WED, 'ward'),
                next(
                  x,
                  `${WED}:3`,
                  15,
                  { house: x.house!.id, house2: x.house2!.id },
                  nextAge(x.civ),
                ),
                `The houses send the ${trinket(x, 'culture', 79)} as a christening gift.`
              ),
            },
            {
              label: 'Let the houses raise it',
              effect: '+15 culture',
              apply: x => (
                culture(x, 15),
                setFlag(x, WED, 'houses'),
                next(
                  x,
                  `${WED}:3`,
                  15,
                  { house: x.house!.id, house2: x.house2!.id },
                  nextAge(x.civ),
                ),
                'The child grows up between two castles.'
              ),
            },
          ],
  }),
  chapter(`${WED}:3`, WED_NAME, 3, 3, {
    kind: 'court',
    title: c =>
      ['ward', 'houses'].includes(flagOf(c.s, WED) ?? '')
        ? 'The heir of two houses comes of age'
        : 'The old quarrel ends',
    text: [
      c =>
        ['ward', 'houses'].includes(flagOf(c.s, WED) ?? '')
          ? `The child of House ${c.house!.name} and House ${c.house2!.name} is grown, clever and popular. ${flagOf(c.s, WED) === 'ward' ? 'Raised at your court, they are loyal to you first.' : 'Raised by the houses, they speak for the houses first.'}`
          : `Years have passed since the lovers of House ${c.house!.name} and House ${c.house2!.name}. ${flagOf(c.s, WED) === 'pardon' ? 'Their children play in your palace.' : 'The heir is out of prison and old before his time.'} The houses ask to be done with it.`,
    ],
    subject: () => null,
    choices: c =>
      flagOf(c.s, WED) === 'ward'
        ? [
            {
              label: 'Make them your chancellor',
              effect: `+${scale(c.civ, 40)} gold and both houses −10 unrest`,
              apply: x => (
                (x.civ.gold += scale(x.civ, 40)),
                calm(x.house!, 10),
                calm(x.house2!, 10),
                'A good chancellor is worth a treasury.'
              ),
            },
          ]
        : flagOf(c.s, WED) === 'chains'
          ? [
              {
                label: 'A public reconciliation',
                effect: `House ${c.house!.name} −20 unrest; −${scale(c.civ, 20)} gold`,
                blocked: payGold(scale(c.civ, 20)),
                apply: x => (
                  calm(x.house!, 20),
                  (x.civ.gold -= scale(x.civ, 20)),
                  'Gifts, a feast and a long speech close the matter.'
                ),
              },
              {
                label: 'Let it lie',
                effect: `House ${c.house!.name} +5 unrest`,
                apply: x => ((x.house!.unrest += 5), 'Some wounds do not close.'),
              },
            ]
          : [
              {
                label: 'Give them a seat at court',
                effect: 'both houses −10 unrest; +15 culture',
                apply: x => (
                  calm(x.house!, 10),
                  calm(x.house2!, 10),
                  culture(x, 15),
                  'A family of two houses, at the heart of the realm.'
                ),
              },
            ],
  }),
];

// ---------------------------------------------------------------- 4. the merchant guild

const GUILD = 'guild';
const GUILD_NAME = 'The Merchant Guild';
const guild: EventDef[] = [
  chapter(`${GUILD}:1`, GUILD_NAME, 1, 3, {
    kind: 'trade',
    weight: 1.2,
    title: c => `The merchants of ${c.city!.name} ask for a charter`,
    text: [
      c =>
        `The merchants of ${c.city!.name} want to form a guild: one price, one set of weights, and the right to keep outsiders out. They offer a gift to the crown.`,
    ],
    subject: (s, civ, r) => {
      if (!opens(s, civ, GUILD, 2, 3) || !civ.techs.includes('currency')) return null;
      const c = pick(
        r,
        mine(s, civ).filter(x => x.pop >= 2000),
      );
      return c ? { city: c.id } : null;
    },
    choices: c => [
      {
        label: 'Grant the charter',
        effect: `+${scale(c.civ, 20)} gold now`,
        apply: x => (
          (x.civ.gold += scale(x.civ, 20)),
          setFlag(x, GUILD, 'charter'),
          next(x, `${GUILD}:2`, 15, { city: x.city!.id }, nextAge(x.civ)),
          'The guild hall opens with a fine dinner.'
        ),
      },
      {
        label: 'Keep trade free',
        effect: '+10 culture',
        apply: x => (
          culture(x, 10),
          setFlag(x, GUILD, 'free'),
          next(x, `${GUILD}:2`, 15, { city: x.city!.id }, nextAge(x.civ)),
          'Anyone may sell in the market square.'
        ),
      },
    ],
  }),
  chapter(`${GUILD}:2`, GUILD_NAME, 2, 3, {
    kind: 'trade',
    title: c =>
      flagOf(c.s, GUILD) === 'charter' ? 'The guild grows rich' : 'Peddlers and smugglers',
    text: [
      c =>
        flagOf(c.s, GUILD) === 'charter'
          ? `The guild of ${c.city!.name} owns half the warehouses now. Its masters ride in carriages and ask for a voice at court.`
          : `Free trade has filled ${c.city!.name} with peddlers, and with smugglers who pay no tolls. The honest merchants complain.`,
    ],
    subject: () => null,
    choices: c =>
      flagOf(c.s, GUILD) === 'charter'
        ? [
            {
              label: 'Tax its profits',
              effect: `+${scale(c.civ, 50)} gold`,
              apply: x => (
                (x.civ.gold += scale(x.civ, 50)),
                setFlag(x, GUILD, 'taxed'),
                next(x, `${GUILD}:3`, 15, { city: x.city!.id }, nextAge(x.civ)),
                'The guild pays, and grumbles.'
              ),
            },
            {
              label: 'Give it a seat at court',
              effect: `+${scale(c.civ, 20)} gold; the guild will remember`,
              apply: x => (
                (x.civ.gold += scale(x.civ, 20)),
                setFlag(x, GUILD, 'seat'),
                next(x, `${GUILD}:3`, 15, { city: x.city!.id }, nextAge(x.civ)),
                'A merchant sits beside the nobles.'
              ),
            },
          ]
        : [
            {
              label: 'Hunt the smugglers',
              effect: `−${scale(c.civ, 15)} gold; +15 culture`,
              blocked: payGold(scale(c.civ, 15)),
              apply: x => (
                (x.civ.gold -= scale(x.civ, 15)),
                culture(x, 15),
                setFlag(x, GUILD, 'order'),
                next(x, `${GUILD}:3`, 15, { city: x.city!.id }, nextAge(x.civ)),
                'The harbour is quieter, and more honest.'
              ),
            },
            {
              label: 'Let the market sort it out',
              effect: `+${scale(c.civ, 20)} gold`,
              apply: x => (
                (x.civ.gold += scale(x.civ, 20)),
                setFlag(x, GUILD, 'market'),
                next(x, `${GUILD}:3`, 15, { city: x.city!.id }, nextAge(x.civ)),
                'Cheap goods and full streets.'
              ),
            },
          ],
  }),
  chapter(`${GUILD}:3`, GUILD_NAME, 3, 3, {
    kind: 'trade',
    title: () => 'From guild to company',
    text: [
      c =>
        `The merchants of ${c.city!.name} want to pool their money into one great company, with ships and agents abroad. ${flagOf(c.s, GUILD) === 'seat' ? 'Their friend at court has already said yes.' : 'They need the crown’s blessing.'}`,
    ],
    subject: () => null,
    choices: c => {
      const big = flagOf(c.s, GUILD) === 'seat' || flagOf(c.s, GUILD) === 'market';
      return [
        {
          label: 'Bless the company and buy shares',
          effect: `+${scale(c.civ, big ? 90 : 60)} gold`,
          apply: x => (
            (x.civ.gold += scale(x.civ, big ? 90 : 60)),
            'The company’s first ships come home loaded.'
          ),
        },
        {
          label: 'Keep the merchants small',
          effect: '+20 culture; a treasure of the trade',
          apply: x => (
            culture(x, 20),
            `Many small shops, and the ${trinket(x, 'gold', 83)} for the treasury.`
          ),
        },
      ];
    },
  }),
];

// ---------------------------------------------------------------- 5. the wandering preacher

const PREACH = 'preacher';
const PREACH_NAME = 'The Wandering Preacher';
const preacher: EventDef[] = [
  chapter(`${PREACH}:1`, PREACH_NAME, 1, 3, {
    kind: 'faith',
    weight: 1.2,
    title: c => `A preacher in ${c.city!.name}`,
    text: [
      c =>
        `A barefoot preacher draws crowds in ${c.city!.name}. The priests grow fat, he says, while the faithful go hungry. The priests want him gone.`,
    ],
    subject: (s, civ, r) => {
      if (!opens(s, civ, PREACH, 2, 4) || civ.faith === undefined) return null;
      const c = pick(
        r,
        mine(s, civ).filter(x => x.faith === civ.faith),
      );
      return c ? { city: c.id } : null;
    },
    choices: () => [
      {
        label: 'Give him a pulpit',
        effect: '+15 culture; religious tension +10',
        apply: x => (
          culture(x, 15),
          tension(x, 10),
          setFlag(x, PREACH, 'heard'),
          next(x, `${PREACH}:2`, 12, { city: x.city!.id }),
          'The square fills every morning.'
        ),
      },
      {
        label: 'Silence him',
        effect: 'religious tension −5 for now',
        apply: x => (
          tension(x, -5),
          setFlag(x, PREACH, 'silenced'),
          next(x, `${PREACH}:2`, 12, { city: x.city!.id }),
          'He is taken from the square at night.'
        ),
      },
    ],
  }),
  chapter(`${PREACH}:2`, PREACH_NAME, 2, 3, {
    kind: 'faith',
    title: c =>
      flagOf(c.s, PREACH) === 'heard' ? 'The preacher’s followers' : 'A martyr in the making',
    text: [
      c =>
        flagOf(c.s, PREACH) === 'heard'
          ? `The preacher of ${c.city!.name} has thousands of followers now, and a list of reforms. The priests say it is heresy; the people say it is about time.`
          : `The preacher died in a cell in ${c.city!.name}. Now his words are copied in secret, and his grave has flowers every morning.`,
    ],
    subject: () => null,
    choices: c =>
      flagOf(c.s, PREACH) === 'heard'
        ? [
            {
              label: 'Make his reforms law',
              effect: 'religious tension −20; +10 culture',
              apply: x => (
                tension(x, -20),
                culture(x, 10),
                setFlag(x, PREACH, 'reformed'),
                next(x, `${PREACH}:3`, 15, { city: x.city!.id }, nextAge(x.civ)),
                'The temples open their storehouses to the poor.'
              ),
            },
            {
              label: 'Keep the old ways',
              effect: 'religious tension +15',
              apply: x => (
                tension(x, 15),
                setFlag(x, PREACH, 'split'),
                next(x, `${PREACH}:3`, 15, { city: x.city!.id }, nextAge(x.civ)),
                'Two congregations now pray in two places.'
              ),
            },
          ]
        : [
            {
              label: 'Honour him now he is gone',
              effect: `−${scale(c.civ, 15)} gold; religious tension −10`,
              blocked: payGold(scale(c.civ, 15)),
              apply: x => (
                (x.civ.gold -= scale(x.civ, 15)),
                tension(x, -10),
                setFlag(x, PREACH, 'honoured'),
                next(x, `${PREACH}:3`, 15, { city: x.city!.id }, nextAge(x.civ)),
                'A chapel over his grave.'
              ),
            },
            {
              label: 'Erase his name',
              effect: 'religious tension +15',
              apply: x => (
                tension(x, 15),
                setFlag(x, PREACH, 'erased'),
                next(x, `${PREACH}:3`, 15, { city: x.city!.id }, nextAge(x.civ)),
                'His books burn; his name does not.'
              ),
            },
          ],
  }),
  chapter(`${PREACH}:3`, PREACH_NAME, 3, 3, {
    kind: 'faith',
    title: () => 'A reformed faith?',
    text: [
      c =>
        ['reformed', 'honoured'].includes(flagOf(c.s, PREACH) ?? '')
          ? `A generation on, the preacher of ${c.city!.name} is remembered as a saint. His followers ask that his teaching be written into the faith itself.`
          : `A generation on, the preacher’s followers in ${c.city!.name} are a church of their own, and they want to be left alone.`,
    ],
    subject: () => null,
    choices: c =>
      ['reformed', 'honoured'].includes(flagOf(c.s, PREACH) ?? '')
        ? [
            {
              label: 'Write it into the faith',
              effect: 'religious tension −25; +25 culture',
              apply: x => (tension(x, -25), culture(x, 25), 'One faith, renewed.'),
            },
          ]
        : [
            {
              label: 'Grant them tolerance',
              effect: 'religious tension −20; −10 culture',
              apply: x => (tension(x, -20), culture(x, -10), 'Two churches, one realm.'),
            },
            {
              label: 'Force them back into the fold',
              effect: 'religious tension +20; +15 culture',
              apply: x => (tension(x, 20), culture(x, 15), 'Order is kept, for now.'),
            },
          ],
  }),
];

// ---------------------------------------------------------------- 6. the river town

const RIVER = 'river';
const RIVER_NAME = 'The River Town';
const river: EventDef[] = [
  chapter(`${RIVER}:1`, RIVER_NAME, 1, 3, {
    kind: 'land',
    weight: 1.1,
    title: c => `The river rises at ${c.city!.name}`,
    text: [
      c =>
        `Each spring the river creeps higher at ${c.city!.name}. The old ones say a great flood comes once in a lifetime, and this lifetime has not had one yet.`,
    ],
    subject: (s, civ, r) => {
      if (!opens(s, civ, RIVER, 1, 3, 20)) return null;
      const c = pick(
        r,
        mine(s, civ).filter(x => s.map.river[x.hex] > 0),
      );
      return c ? { city: c.id } : null;
    },
    choices: c => {
      const gold = scale(c.civ, 20);
      return [
        {
          label: 'Raise levees',
          effect: `−${gold} gold`,
          blocked: payGold(gold),
          apply: x => (
            (x.civ.gold -= gold),
            setFlag(x, RIVER, 'levee'),
            next(x, `${RIVER}:2`, 12, { city: x.city!.id }),
            'Earth banks rise along the water.'
          ),
        },
        {
          label: 'Move the poorest to higher ground',
          effect: `−${people(250)} in ${c.city!.name} (they settle elsewhere)`,
          apply: x => (
            (x.city!.pop = Math.max(1000, x.city!.pop - 250)),
            setFlag(x, RIVER, 'moved'),
            next(x, `${RIVER}:2`, 12, { city: x.city!.id }),
            'Carts climb the hill all week.'
          ),
        },
        {
          label: 'Trust the river',
          effect: 'nothing now',
          apply: x => (
            setFlag(x, RIVER, 'trust'),
            next(x, `${RIVER}:2`, 12, { city: x.city!.id }),
            'The river has always been kind.'
          ),
        },
      ];
    },
  }),
  chapter(`${RIVER}:2`, RIVER_NAME, 2, 3, {
    kind: 'land',
    title: c => `The great flood at ${c.city!.name}`,
    text: [
      c =>
        flagOf(c.s, RIVER) === 'levee'
          ? `The flood came, higher than anyone alive had seen, and the levees of ${c.city!.name} held. Downriver, other towns were not so lucky; their people come begging at your gates.`
          : flagOf(c.s, RIVER) === 'moved'
            ? `The flood came and took the low town of ${c.city!.name}. But the poorest were already on the hill: the losses are houses, not lives.`
            : `The flood came at night. Half of ${c.city!.name} is under water.`,
    ],
    subject: () => null,
    choices: c => {
      const f = flagOf(c.s, RIVER);
      if (f === 'levee')
        return [
          {
            label: 'Take the refugees in',
            effect: `+${people(500)} in ${c.city!.name}`,
            apply: x => (
              (x.city!.pop += 500),
              next(x, `${RIVER}:3`, 15, { city: x.city!.id }, Math.max(4, nextAge(x.civ))),
              'The town grows overnight.'
            ),
          },
          {
            label: 'Sell them grain',
            effect: `+${scale(c.civ, 30)} gold`,
            apply: x => (
              (x.civ.gold += scale(x.civ, 30)),
              next(x, `${RIVER}:3`, 15, { city: x.city!.id }, Math.max(4, nextAge(x.civ))),
              'The granaries empty; the treasury fills.'
            ),
          },
        ];
      const lost = f === 'moved' ? 0.03 : 0.12;
      return [
        {
          label: 'Rebuild at once',
          effect: `about ${Math.round(lost * 100)}% of the people lost; −${scale(c.civ, 20)} gold`,
          blocked: payGold(scale(c.civ, 20)),
          apply: x => {
            const n = Math.round((x.city!.pop * lost) / 50) * 50;
            x.city!.pop = Math.max(1000, x.city!.pop - n);
            x.civ.gold -= scale(x.civ, 20);
            setFlag(x, RIVER, `${f}-rebuilt`);
            next(x, `${RIVER}:3`, 15, { city: x.city!.id }, Math.max(4, nextAge(x.civ)));
            return `${people(n)} lost; new houses rise on stone feet.`;
          },
        },
        {
          label: 'Leave the low town to the river',
          effect: `about ${Math.round(lost * 150)}% of the people lost`,
          apply: x => {
            const n = Math.round((x.city!.pop * lost * 1.5) / 50) * 50;
            x.city!.pop = Math.max(1000, x.city!.pop - n);
            setFlag(x, RIVER, `${f}-left`);
            next(x, `${RIVER}:3`, 15, { city: x.city!.id }, Math.max(4, nextAge(x.civ)));
            return `${people(n)} lost; the river keeps the low streets.`;
          },
        },
      ];
    },
  }),
  chapter(`${RIVER}:3`, RIVER_NAME, 3, 3, {
    kind: 'trade',
    title: c => `A canal for ${c.city!.name}`,
    text: [
      c =>
        `Engineers propose to tame the river at ${c.city!.name} for good: a canal with locks, quays and mills.${flagOf(c.s, RIVER) === 'levee' ? ' The old levees make half the work already done.' : ''}`,
    ],
    subject: () => null,
    choices: c => {
      const cost = scale(c.civ, flagOf(c.s, RIVER) === 'levee' ? 20 : 40);
      return [
        {
          label: 'Dig the canal',
          effect: `−${cost} gold; +${people(500)} and a treasure of the trade`,
          blocked: payGold(cost),
          apply: x => (
            (x.civ.gold -= cost),
            (x.city!.pop += 500),
            `Barges come; so does the ${trinket(x, 'gold', 89)}.`
          ),
        },
        {
          label: 'Not now',
          effect: 'nothing',
          apply: () => 'The river keeps its own counsel.',
        },
      ];
    },
  }),
];

// ---------------------------------------------------------------- 7. the old grudge

const GRUDGE = 'grudge';
const GRUDGE_NAME = 'The Old Grudge';
const grudge: EventDef[] = [
  chapter(`${GRUDGE}:1`, GRUDGE_NAME, 1, 3, {
    kind: 'war',
    weight: 1.2,
    title: c => `Men of the ${c.other!.name} burn a village`,
    text: [
      c =>
        `Riders of the ${c.other!.name} crossed the border and burned a village near ${c.city!.name}. Their chief says it was a few hotheads. Your people want an answer.`,
    ],
    subject: (s, civ, r) => {
      if (!opens(s, civ, GRUDGE, 1, 3, 25)) return null;
      const o = pick(
        r,
        civ.met.filter(id => s.civs[id]?.alive && !s.civs[id].independent),
      );
      const c = capital(s, civ);
      return o !== undefined && c ? { civ: o, city: c.id } : null;
    },
    choices: c => [
      {
        label: 'Forgive them',
        effect: `the ${c.other!.name} think better of you`,
        apply: x => (
          remember(x.s, x.other!.id, x.civ.id, 'mercy', 'Forgave a raid', 10, 0.1),
          setFlag(x, GRUDGE, 'forgive'),
          next(x, `${GRUDGE}:2`, 15, { civ: x.other!.id, city: x.city!.id }, nextAge(x.civ)),
          'A hard choice, and a generous one.'
        ),
      },
      {
        label: 'Swear vengeance',
        effect: `+15 culture; the ${c.other!.name} think worse of you`,
        apply: x => (
          culture(x, 15),
          remember(x.s, x.other!.id, x.civ.id, 'oath', 'Swore vengeance on us', -10, 0.05),
          setFlag(x, GRUDGE, 'vengeance'),
          next(x, `${GRUDGE}:2`, 15, { civ: x.other!.id, city: x.city!.id }, nextAge(x.civ)),
          'The oath is sworn on the ashes.'
        ),
      },
    ],
  }),
  chapter(`${GRUDGE}:2`, GRUDGE_NAME, 2, 3, {
    kind: 'war',
    title: c =>
      flagOf(c.s, GRUDGE) === 'forgive'
        ? `The ${c.other!.name} remember your mercy`
        : `The oath against the ${c.other!.name}`,
    text: [
      c =>
        flagOf(c.s, GRUDGE) === 'forgive'
          ? `An envoy of the ${c.other!.name} arrives with gifts. Their old chief, who never forgot how you forgave the raid, is dying, and wants it settled for good.`
          : `A generation has grown up on the oath against the ${c.other!.name}. The young lords ask when vengeance will come.`,
    ],
    subject: () => null,
    choices: c =>
      flagOf(c.s, GRUDGE) === 'forgive'
        ? [
            {
              label: 'Seal a lasting friendship',
              effect: `the ${c.other!.name} think much better of you`,
              apply: x => (
                remember(x.s, x.other!.id, x.civ.id, 'friendship', 'An old friendship', 20, 0.03),
                setFlag(x, GRUDGE, 'friends'),
                next(x, `${GRUDGE}:3`, 20, { civ: x.other!.id, city: x.city!.id }, nextAge(x.civ)),
                'Two peoples, one feast.'
              ),
            },
            {
              label: 'Accept the gifts',
              effect: `+${scale(c.civ, 30)} gold`,
              apply: x => (
                (x.civ.gold += scale(x.civ, 30)),
                setFlag(x, GRUDGE, 'gifts'),
                next(x, `${GRUDGE}:3`, 20, { civ: x.other!.id, city: x.city!.id }, nextAge(x.civ)),
                'Gold, horses and fine cloth.'
              ),
            },
          ]
        : [
            {
              label: 'Keep the oath alive',
              effect: `+20 culture; the ${c.other!.name} think worse of you`,
              apply: x => (
                culture(x, 20),
                remember(x.s, x.other!.id, x.civ.id, 'oath', 'Swore vengeance on us', -15, 0.03),
                setFlag(x, GRUDGE, 'kept'),
                next(x, `${GRUDGE}:3`, 20, { civ: x.other!.id, city: x.city!.id }, nextAge(x.civ)),
                'Songs of the burned village are sung at every feast.'
              ),
            },
            {
              label: 'Release the young lords from it',
              effect: `the ${c.other!.name} think better of you; −10 culture`,
              apply: x => (
                culture(x, -10),
                remember(x.s, x.other!.id, x.civ.id, 'mercy', 'Let an old oath go', 12, 0.05),
                setFlag(x, GRUDGE, 'released'),
                next(x, `${GRUDGE}:3`, 20, { civ: x.other!.id, city: x.city!.id }, nextAge(x.civ)),
                'Some call it weakness; most call it wisdom.'
              ),
            },
          ],
  }),
  chapter(`${GRUDGE}:3`, GRUDGE_NAME, 3, 3, {
    kind: 'war',
    title: c => `A hundred years with the ${c.other!.name}`,
    text: [
      c =>
        ['friends', 'gifts', 'released'].includes(flagOf(c.s, GRUDGE) ?? '')
          ? `A hundred years since the burned village. Historians of the ${c.other!.name} propose a joint monument to the peace that followed.`
          : `A hundred years since the burned village, and the grudge against the ${c.other!.name} is part of who your people are.`,
    ],
    subject: () => null,
    choices: c =>
      ['friends', 'gifts', 'released'].includes(flagOf(c.s, GRUDGE) ?? '')
        ? [
            {
              label: 'Build the monument together',
              effect: `+20 culture; the ${c.other!.name} think better of you`,
              apply: x => (
                culture(x, 20),
                remember(x.s, x.other!.id, x.civ.id, 'friendship', 'An old friendship', 15, 0.03),
                'Two names carved in one stone.'
              ),
            },
          ]
        : [
            {
              label: 'A day of remembrance',
              effect: `+30 culture; the ${c.other!.name} think worse of you`,
              apply: x => (
                culture(x, 30),
                remember(x.s, x.other!.id, x.civ.id, 'oath', 'Keeps an old grudge', -10, 0.05),
                'The village’s ashes are kept in a silver urn.'
              ),
            },
            {
              label: 'Let the century close it',
              effect: `the ${c.other!.name} think better of you`,
              apply: x => (
                remember(x.s, x.other!.id, x.civ.id, 'mercy', 'Let an old grudge go', 15, 0.05),
                'Old wounds, finally healed.'
              ),
            },
          ],
  }),
];

// ---------------------------------------------------------------- 8. the teacher

const SCHOOL = 'school';
const SCHOOL_NAME = 'The Teacher';
const school: EventDef[] = [
  chapter(`${SCHOOL}:1`, SCHOOL_NAME, 1, 3, {
    kind: 'knowledge',
    weight: 1.2,
    title: c => `A teacher opens a school in ${c.city!.name}`,
    text: [
      c =>
        `A widow in ${c.city!.name} teaches the children of the street to read, for nothing, in her own kitchen. There are more children than chairs.`,
    ],
    subject: (s, civ, r) => {
      if (!opens(s, civ, SCHOOL, 2, 3) || !civ.techs.includes('writing')) return null;
      const c = pick(r, mine(s, civ));
      return c ? { city: c.id } : null;
    },
    choices: c => {
      const gold = scale(c.civ, 15);
      return [
        {
          label: 'Pay for a schoolhouse',
          effect: `−${gold} gold`,
          blocked: payGold(gold),
          apply: x => (
            (x.civ.gold -= gold),
            setFlag(x, SCHOOL, 'funded'),
            next(x, `${SCHOOL}:2`, 15, { city: x.city!.id }, nextAge(x.civ)),
            'A schoolhouse with real chairs.'
          ),
        },
        {
          label: 'Ask the temple to take her in',
          effect: '+10 culture',
          apply: x => (
            culture(x, 10),
            setFlag(x, SCHOOL, 'temple'),
            next(x, `${SCHOOL}:2`, 15, { city: x.city!.id }, nextAge(x.civ)),
            'The priests add letters to their prayers.'
          ),
        },
      ];
    },
  }),
  chapter(`${SCHOOL}:2`, SCHOOL_NAME, 2, 3, {
    kind: 'knowledge',
    title: c => `The students of ${c.city!.name}`,
    text: [
      c =>
        `The teacher of ${c.city!.name} is old now. Her first students are ${flagOf(c.s, SCHOOL) === 'funded' ? 'clerks, engineers and two famous astronomers' : 'priests and poets, and they still visit her every feast day'}.`,
    ],
    subject: () => null,
    choices: c => [
      {
        label: 'Give her a state funeral when the time comes',
        effect: flagOf(c.s, SCHOOL) === 'funded' ? `+${scale(c.civ, 40)} science` : '+30 culture',
        apply: x => (
          flagOf(x.s, SCHOOL) === 'funded' ? (x.civ.science += scale(x.civ, 40)) : culture(x, 30),
          next(x, `${SCHOOL}:3`, 15, { city: x.city!.id }, nextAge(x.civ)),
          'Her students carry the coffin.'
        ),
      },
    ],
  }),
  chapter(`${SCHOOL}:3`, SCHOOL_NAME, 3, 3, {
    kind: 'knowledge',
    title: c => `A university for ${c.city!.name}`,
    text: [
      c =>
        `The students of the students of the teacher of ${c.city!.name} want a university, with her name over the gate.`,
    ],
    subject: () => null,
    choices: c => {
      const gold = scale(c.civ, 35);
      return [
        {
          label: 'Found it',
          effect: `−${gold} gold; +${scale(c.civ, 70)} science`,
          blocked: payGold(gold),
          apply: x => (
            (x.civ.gold -= gold),
            (x.civ.science += scale(x.civ, 70)),
            'Her name over the gate, and her chair in the hall.'
          ),
        },
        {
          label: 'A statue will do',
          effect: '+20 culture',
          apply: x => (culture(x, 20), 'A bronze widow reads to bronze children.'),
        },
      ];
    },
  }),
];

/** Every chapter of every story. */
export const STORY_EVENTS: EventDef[] = [
  ...legend,
  ...expedition,
  ...marriage,
  ...guild,
  ...preacher,
  ...river,
  ...grudge,
  ...school,
];

/** The stories, for checks and the docs. */
export const STORIES = [
  LEGEND_NAME,
  EXP_NAME,
  WED_NAME,
  GUILD_NAME,
  PREACH_NAME,
  RIVER_NAME,
  GRUDGE_NAME,
  SCHOOL_NAME,
];
