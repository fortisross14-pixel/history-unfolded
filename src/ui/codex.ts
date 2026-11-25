/**
 * The Codex: searchable help. Basics are written here; techs, buildings, wonders, tenets,
 * victories, crises, policies, directions and leader types come from the game's own data, so the
 * Codex never says something the game does not do.
 */
import { DOMAINS, TAGS } from '../data/culture.ts';
import { MAJORS } from '../data/tomes.ts';
import { TENETS } from '../data/faiths.ts';
import { DEPOSITS, GOODS, isComfort } from '../data/goods.ts';
import { goodChains, goodSources, goodUsers, whereBuilt, type ChainRef } from '../data/chains.ts';
import { ITEM_LIST, SLOT_NAMES, NAVAL_SLOT_NAMES, type ItemInfo } from '../data/items.ts';
import { PERSONALITIES } from '../data/leaders.ts';
import { PATHS } from '../data/paths.ts';
import { POLICY_LIST } from '../data/policies.ts';
import { GROUPS, LINES, SLOT_TYPES, type SlotType } from '../data/slots.ts';
import { ERAS, TECH_LIST, TECHS } from '../data/techs.ts';
import { TERRAIN } from '../data/terrain.ts';
import { WONDER_LIST } from '../data/wonders.ts';
import { CRISIS } from '../engine/crises.ts';
import { DIFFICULTIES } from '../engine/difficulty.ts';
import { BEASTS } from '../engine/wildlife.ts';
import { VICTORIES } from '../engine/victory.ts';

/** One line of an entry's section; `entry` links it to another entry. */
export interface CodexItem {
  text: string;
  entry?: string;
  /** a good's icon to show before it */
  good?: string;
}
export interface CodexSection {
  title: string;
  items: CodexItem[];
}
export interface CodexEntry {
  id: string;
  title: string;
  group: string;
  text: string;
  /** generated from the data: sources, users, chains, costs, stats */
  sections?: CodexSection[];
}

const BASICS: [string, string][] = [
  [
    'Settlements and their sizes',
    'A settlement is its centre hex and up to six districts on the hexes around it. Sizes: settlement (1 district), town (2), large town (3), city (4), large city (5), metropolis (6–7, one per people). Each step needs people, housing and goods; the settlement panel shows what the next one needs. Settlements stand at least two hexes apart.',
  ],
  [
    'Districts',
    'A district is a 3×3 grid of buildings on one hex next to its settlement. Where it goes matters: by the coast for a shipyard, on an ore for a mine. Every district needs two housing cells for its other buildings to work. Farms, woodlots and mines are rural: a city builds them in its outer districts, not its centre.',
  ],
  [
    'Food and growth',
    'Farms and fishing feed people; what is left over is stored. When the store is full the settlement grows by 250 people, if there is housing. Towns trading by road share food with hungry neighbours. A settlement short of food shrinks.',
  ],
  [
    'Gold',
    'Gold comes from markets, temples, trade and houses with shops; troops and ships cost upkeep every turn. Hover your gold in the top bar to see where it comes from. Gold buys settlers, crews, honours for houses, edicts and deals.',
  ],
  [
    'Science and the ages',
    'Science pays for techs. Each age has a gate tech that needs a number of the age’s other techs; it opens the next age, with new techs, a new policy and sometimes a national direction. There are five ages: Ancient, Classical, Medieval, Renaissance, Industrial.',
  ],
  [
    'Culture Tomes',
    'In each age you open one culture Tome, one of nine domains. Culture buys its missions; a mission done keeps its buff for good and its identity tags (solar, devout, martial…), which change how other peoples see you. Three missions done open the Tome’s major buff, bought with culture and kept forever. When any people enters a new age every open Tome closes: an unbought major buff is lost.',
  ],
  [
    'Cohorts, formations and designs',
    'Armies are formations of cohorts, 100 people each. A design is a set of gear (weapon, shield, helmet, armour, boots, mount, kit); equipping a cohort costs goods and changes upkeep. Mix front-line and ranged cohorts: the front line screens the archers.',
  ],
  [
    'Moving, roads and railways',
    'Each formation has moves a turn; hills, forests and marsh cost more. Roads halve the cost; workers build them early, then workers and engineers only. Railways (engineers, Industrial age) cost a fifth of a move and add 15% production to linked settlements.',
  ],
  [
    'Battles',
    'Move next to an enemy and click it to attack; the preview shows the expected outcome. Melee, ranged, charge, protection and morale decide it; rough ground, home land, walls and the people’s bonuses tilt it.',
  ],
  [
    'Sieges',
    'Three or more enemy cohorts around a settlement besiege it: no growth, the guard starves, and in five turns the walls are breached. Drive the troops off to lift it.',
  ],
  [
    'Diplomacy and opinion',
    'Every people has an opinion of you, with its reasons: shared or clashing ideas, faith, borders, treaties, gifts and what you have done. Trade is negotiated: pacts, alliances and trade deals. Breaking a pact is remembered by everyone.',
  ],
  [
    'Leaders and their intent',
    'Each rival has a leader personality and an intent toward you, shown in Peoples with the reasons. A rival that decides on war masses troops on your border and says so a few turns before it attacks.',
  ],
  [
    'Peace terms',
    'A war can end with plain peace, tribute (gold a turn for some turns) or a ceded settlement. A people losing badly accepts harder terms.',
  ],
  [
    'Free peoples',
    'Small peoples with one city that never expands. Befriend them with gifts for tribute, ally with them, absorb an old ally for gold, or conquer them.',
  ],
  [
    'Raiders',
    'In the early ages raider camps appear in empty land. Their bands pillage weakly held towns; a garrison at least as strong as a band keeps it away. March an army into a camp to burn it and take its hoard. Raiders fade by the Renaissance.',
  ],
  [
    'Towns and colonies',
    'A new settlement is a town when it stands within 4 hexes of one of your towns, so your lands touch. Further out it is a colony: one district, gathering only (farms, woodlots, mines, houses, docks), and its goods reach you only by road or by sea with a harbour. Once one of your towns reaches it, make it a town for gold. From the Renaissance colonies can build anything and grow to four districts; from the Industrial age every settlement is a town.',
  ],
  [
    'Ruins',
    'Ruins lie scattered over the wild land at the start. The first unit to step onto them searches them: buried gold, lost scrolls (science), caches of rare goods (ivory and hides for ivory lamellar, copper and tin for bronze, furs, horses), an ancient armoury that re-arms your first cohorts with bronze swords and scale armour, an old map of far land, survivors who join, or a relic for your houses. Rivals explore too: be quick.',
  ],
  [
    'Dynasties and houses',
    'Great houses govern your settlements and gain experience in what those settlements do. Keep their unrest down with honours and trinkets; a house pushed too far rises in civil war.',
  ],
  [
    'Faith',
    'With Mysticism and a shrine you can found a faith, if the world still has room. It spreads by itself from settlement to settlement; you choose three tenets over the ages. Shared faith warms opinion; a realm split between faiths builds tension toward a schism.',
  ],
  [
    'World wonders',
    'Each wonder exists once in the world. A town or bigger starts one by paying its goods; half its production goes to it. The first to finish takes it; the others get half their work back as gold.',
  ],
  [
    'Crises',
    'Hard times that grow out of the realm’s own state (crowding, hunger, debt, faith, factories). Each shows its risk while it builds, and each has two or three answers when it strikes.',
  ],
  [
    'Coalitions',
    'When one people runs away with the game, the others band together against it: embargo, colder opinion and, when strong enough together, joint wars. The reason is shown.',
  ],
  [
    'Sentry, skip and automation',
    'Fortify, sentry (wakes when enemies come near) or skip keep units out of the to-do list. Crews can build roads on their own, scouts explore on their own, and governors can plan settlements.',
  ],
  [
    'Turn news',
    'Each turn’s news is sorted as needs you now, to act on, or for your information; click a line to go to the settlement, unit or screen it is about.',
  ],
];

const KIND: Record<string, string> = {
  food: 'Food',
  raw: 'A raw good',
  luxury: 'A luxury: a comfort and a trade good',
  made: 'A made good',
};
const goodName = (g: string) => GOODS[g]?.name ?? g;
const techItem = (t: string): CodexItem => ({
  text: `${TECHS[t]?.name ?? t} (${ERAS[TECHS[t]?.era ?? 1]})`,
  entry: `tech-${t}`,
});
const costItems = (o: Record<string, number> | undefined, unit = ''): CodexItem[] =>
  Object.entries(o ?? {}).map(([g, n]) => ({
    text: `${n} ${goodName(g)}${unit}`,
    entry: `good-${g}`,
    good: g,
  }));
const refItem = (r: ChainRef): CodexItem => ({
  text: `${r.name} · ${r.how}`,
  entry: r.entry,
});

/** A good: every way to get it, everything that uses it, the chains it is part of. */
export function goodSections(g: string): CodexSection[] {
  const src = goodSources(g);
  const use = goodUsers(g);
  const out: CodexSection[] = [
    {
      title: 'Get it from',
      items: src.length ? src.map(refItem) : [{ text: 'Nothing makes it yet' }],
    },
    { title: 'Used by', items: use.length ? use.map(refItem) : [{ text: 'Trade only' }] },
  ];
  const hunts = Object.values(BEASTS).filter(b => b.goods[g]);
  out.push({
    title: 'Also',
    items: [
      ...hunts.map(b => ({ text: `${b.pack} slain: ${b.goods[g]} once, from ${b.lair}` })),
      { text: 'Trade deals with other peoples', entry: 'basics-diplomacy-and-opinion' },
    ],
  });
  const chains = goodChains(g);
  if (chains.length) out.push({ title: 'Chain', items: chains.map(text => ({ text })) });
  return out;
}

/** A building: what it needs, where it stands, what it takes and makes. */
export function buildingSections(b: SlotType): CodexSection[] {
  const builds: CodexItem[] = [];
  if (b.tech) builds.push(techItem(b.tech));
  if (!b.fixed) {
    builds.push({ text: `${b.build.prod} production` });
    builds.push(...costItems(b.build.goods));
  }
  if (b.labour) builds.push({ text: `${b.labour} workers` });
  builds.push({ text: `Where: ${whereBuilt(b)}` });
  const out: CodexSection[] = [{ title: b.fixed ? 'Stands' : 'Build', items: builds }];
  const takes = [...costItems(b.inputs, ' a turn')];
  if (b.alt) takes.push(...costItems(b.alt.inputs, ' a turn, burned first when the market has it'));
  if (takes.length) out.push({ title: 'Takes', items: takes });
  const makes: CodexItem[] = [];
  const y = b.out;
  for (const k of ['food', 'prod', 'science', 'gold', 'culture', 'housing'] as const)
    if (y[k]) makes.push({ text: `${y[k]!.toLocaleString()} ${k === 'prod' ? 'production' : k}` });
  makes.push(...costItems(y.goods, ' a turn'));
  if (b.alt) makes.push(...costItems(b.alt.out.goods, ' a turn on the better fuel'));
  for (const d of Object.values(DEPOSITS))
    if (d.by === b.id) {
      const gives = [
        d.gives.food ? `+${d.gives.food} food` : '',
        d.gives.gold ? `+${d.gives.gold} gold` : '',
        ...Object.entries(d.gives.goods ?? {}).map(([g, n]) => `+${n} ${goodName(g)}`),
      ].filter(Boolean);
      const g = Object.keys(d.gives.goods ?? {})[0];
      makes.push({
        text: `By ${d.name.toLowerCase()}: ${gives.join(', ')}${d.special ? ' (3+ in the district, on the deposit)' : ''}${d.tech ? `, ${TECHS[d.tech]?.name}` : ''}${d.revealedBy ? `, seen with ${TECHS[d.revealedBy]?.name}` : ''}`,
        entry: g ? `good-${g}` : undefined,
        good: g,
      });
    }
  if (makes.length) out.push({ title: 'Makes', items: makes });
  if (b.line && b.role && b.role !== 'base') {
    const bases = Object.values(SLOT_TYPES).filter(
      t => t.line === b.line && t.role === 'base' && !t.fixed,
    );
    out.push({
      title: `Boosts ${LINES[b.line].name.toLowerCase()}`,
      items: bases.map(t => ({ text: t.name, entry: `building-${t.id}` })),
    });
  }
  return out;
}

const STAT: [keyof ItemInfo, string][] = [
  ['attack', 'Attack'],
  ['charge', 'Charge'],
  ['antiCharge', 'Against charges'],
  ['meleeAdd', 'Melee +'],
  ['antiChargeAdd', 'Against charges +'],
  ['chargeAdd', 'Charge +'],
  ['move', 'Moves'],
  ['sight', 'Sight'],
  ['morale', 'Morale %'],
  ['capacity', 'Carries cohorts'],
  ['weight', 'Weight'],
  ['upkeep', 'Upkeep (gold a turn)'],
];

/** A gear piece: what it costs, when it opens, what it does. */
export function gearSections(i: ItemInfo): CodexSection[] {
  const out: CodexSection[] = [];
  out.push({
    title: i.naval ? 'Cost per ship' : 'Cost per cohort',
    items: Object.keys(i.cost).length ? costItems(i.cost) : [{ text: 'Free' }],
  });
  out.push({
    title: 'Opens with',
    items: [i.tech ? techItem(i.tech) : { text: 'From the start' }],
  });
  const stats: CodexItem[] = [];
  for (const [k, name] of STAT) {
    const v = i[k];
    if (typeof v === 'number' && v) stats.push({ text: `${name}: ${v}` });
  }
  if (i.damage) stats.push({ text: `Damage: ${i.damage}${i.ranged ? ', ranged' : ''}` });
  for (const [d, n] of Object.entries(i.protection ?? {}))
    if (n) stats.push({ text: `Protection against ${d}: ${n}` });
  if (i.armourPierce)
    stats.push({ text: `Ignores ${Math.round(i.armourPierce * 100)}% of armour` });
  if (i.siege) stats.push({ text: `Ignores ${Math.round(i.siege * 100)}% of walls` });
  if (i.powder)
    stats.push({ text: `${i.powder} saltpeter a turn as powder`, entry: 'good-saltpeter' });
  if (i.twoHanded) stats.push({ text: 'Two-handed' });
  if (i.freeHands) stats.push({ text: 'Stands on the ground: fits two-handed weapons' });
  if (i.rough) stats.push({ text: 'Rough ground costs a point less' });
  if (i.ocean) stats.push({ text: 'Crosses open ocean' });
  if (stats.length) out.push({ title: 'Does', items: stats });
  return out;
}

/** A tech: what it opens. */
function techSections(id: string): CodexSection[] {
  const items: CodexItem[] = [
    ...Object.values(SLOT_TYPES)
      .filter(b => b.tech === id)
      .map(b => ({ text: b.name, entry: `building-${b.id}` })),
    ...ITEM_LIST.filter(i => i.tech === id && !i.empty).map(i => ({
      text: i.name,
      entry: `gear-${i.id}`,
    })),
    ...Object.values(DEPOSITS)
      .filter(d => d.revealedBy === id || d.tech === id)
      .map(d => ({
        text: `${d.name} deposits${d.revealedBy === id ? ' (revealed)' : ' (worked)'}`,
        entry: `building-${d.by}`,
      })),
  ];
  return items.length ? [{ title: 'Opens', items }] : [];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

let cache: CodexEntry[] | null = null;

/** Every entry of the Codex. */
export function codexEntries(): CodexEntry[] {
  if (cache) return cache;
  const out: CodexEntry[] = BASICS.map(([title, text]) => ({
    id: `basics-${slug(title)}`,
    title,
    group: 'Basics',
    text,
  }));
  for (const v of VICTORIES)
    out.push({
      id: `victory-${v.id}`,
      title: `${v.name} victory`,
      group: 'Victories',
      text: v.goal,
    });
  for (const d of Object.values(DIFFICULTIES))
    out.push({
      id: `difficulty-${d.id}`,
      title: `${d.name} (difficulty)`,
      group: 'Difficulty',
      text: `${d.promise} ${d.notes.join('. ')}.`,
    });
  for (const t of TECH_LIST)
    out.push({
      id: `tech-${t.id}`,
      title: t.name,
      group: `Techs: ${ERAS[t.era]}`,
      text: `${t.note}${t.requires.length ? ` Needs ${t.requires.map(r => TECHS[r]?.name ?? r).join(', ')}.` : ''}`,
      sections: techSections(t.id),
    });
  for (const b of Object.values(SLOT_TYPES))
    out.push({
      id: `building-${b.id}`,
      title: b.name,
      group: `Buildings: ${GROUPS[b.group].name}`,
      text: b.note ?? '',
      sections: buildingSections(b),
    });
  for (const i of ITEM_LIST)
    if (!i.empty)
      out.push({
        id: `gear-${i.id}`,
        title: i.name,
        group: i.naval
          ? `Ship parts: ${NAVAL_SLOT_NAMES[i.slot] ?? SLOT_NAMES[i.slot]}`
          : `Gear: ${SLOT_NAMES[i.slot]}`,
        text: i.note,
        sections: gearSections(i),
      });
  for (const w of WONDER_LIST)
    out.push({
      id: `wonder-${w.id}`,
      title: w.name,
      group: 'World wonders',
      text: `${w.note} Opened by ${TECHS[w.tech]?.name ?? w.tech}; ${w.prod} production${w.coast ? '; by the sea' : ''}.`,
    });
  for (const t of Object.values(TENETS))
    out.push({ id: `tenet-${t.id}`, title: t.name, group: 'Faith tenets', text: t.note });
  for (const c of Object.values(CRISIS))
    out.push({ id: `crisis-${c.id}`, title: c.name, group: 'Crises', text: c.effects });
  for (const p of POLICY_LIST)
    out.push({
      id: `policy-${p.id}`,
      title: p.name,
      group: 'Policies',
      text: `${p.question} ${p.left.name} or ${p.right.name}, or balanced. Opens in the ${ERAS[p.age]} age.`,
    });
  for (const p of Object.values(PATHS))
    out.push({
      id: `direction-${p.id}`,
      title: p.name,
      group: 'National directions',
      text: `${p.pitch} Edict: ${p.edict.name}, ${p.edict.text}`,
    });
  for (const p of Object.values(PERSONALITIES))
    out.push({ id: `leader-${p.id}`, title: p.name, group: 'Leader personalities', text: p.note });
  for (const [id, d] of Object.entries(DOMAINS))
    out.push({
      id: `domain-${id}`,
      title: d.name,
      group: 'Culture Tomes',
      text: `${d.name}: ${d.note} Major buff: ${MAJORS[id as keyof typeof MAJORS].name}.`,
    });
  for (const [id, t] of Object.entries(TAGS))
    out.push({ id: `tag-${id}`, title: t.name, group: 'Identity tags', text: t.note });
  for (const [id, g] of Object.entries(GOODS))
    out.push({
      id: `good-${id}`,
      title: g.name,
      group: 'Goods',
      text: `${g.note ?? g.name} ${KIND[g.kind]}${isComfort(id) && g.kind !== 'luxury' ? ', and a comfort' : ''}.`,
      sections: goodSections(id),
    });
  for (const [id, t] of Object.entries(TERRAIN))
    out.push({
      id: `terrain-${id}`,
      title: t.name,
      group: 'Terrain',
      text: `${t.name}${t.water ? ': water' : ''}.`,
    });
  cache = out;
  return out;
}

/** One entry by its id (links between entries). */
export const codexEntry = (id: string): CodexEntry | undefined =>
  codexEntries().find(e => e.id === id);

/** Entries matching a search, best first: title matches before text matches. */
export function searchCodex(q: string): CodexEntry[] {
  const all = codexEntries();
  const n = q.trim().toLowerCase();
  if (!n) return all.filter(e => e.group === 'Basics');
  const words = n.split(/\s+/);
  return all
    .map(e => {
      const t = e.title.toLowerCase(),
        x = `${e.text} ${e.group} ${(e.sections ?? [])
          .flatMap(sc => sc.items.map(i => i.text))
          .join(' ')}`.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (t === w) score += 10;
        else if (t.startsWith(w)) score += 6;
        else if (t.includes(w)) score += 4;
        else if (x.includes(w)) score += 1;
        else return { e, score: -1 };
      }
      // the whole phrase as the title (or its start) comes first
      if (t === n) score += 20;
      else if (t.startsWith(n)) score += 8;
      return { e, score: score + (e.group === 'Basics' ? 1 : 0) };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 60)
    .map(r => r.e);
}
