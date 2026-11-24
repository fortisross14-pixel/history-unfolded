/**
 * The Codex: searchable help. Basics are written here; techs, buildings, wonders, tenets,
 * victories, crises, policies, directions and leader types come from the game's own data, so the
 * Codex never says something the game does not do.
 */
import { DOMAINS, TAGS } from '../data/culture.ts';
import { MAJORS } from '../data/tomes.ts';
import { TENETS } from '../data/faiths.ts';
import { GOODS } from '../data/goods.ts';
import { PERSONALITIES } from '../data/leaders.ts';
import { PATHS } from '../data/paths.ts';
import { POLICY_LIST } from '../data/policies.ts';
import { GROUPS, SLOT_TYPES } from '../data/slots.ts';
import { ERAS, TECH_LIST, TECHS } from '../data/techs.ts';
import { TERRAIN } from '../data/terrain.ts';
import { WONDER_LIST } from '../data/wonders.ts';
import { CRISIS } from '../engine/crises.ts';
import { DIFFICULTIES } from '../engine/difficulty.ts';
import { VICTORIES } from '../engine/victory.ts';

export interface CodexEntry {
  id: string;
  title: string;
  group: string;
  text: string;
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
    });
  for (const b of Object.values(SLOT_TYPES))
    out.push({
      id: `building-${b.id}`,
      title: b.name,
      group: `Buildings: ${GROUPS[b.group].name}`,
      text: `${b.note ?? ''}${b.tech ? ` Needs ${TECHS[b.tech]?.name ?? b.tech}.` : ''} ${b.labour ? `Workers: ${b.labour}.` : ''}`.trim(),
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
      text: `${g.name}: a ${g.kind} good.`,
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

/** Entries matching a search, best first: title matches before text matches. */
export function searchCodex(q: string): CodexEntry[] {
  const all = codexEntries();
  const n = q.trim().toLowerCase();
  if (!n) return all.filter(e => e.group === 'Basics');
  const words = n.split(/\s+/);
  return all
    .map(e => {
      const t = e.title.toLowerCase(),
        x = `${e.text} ${e.group}`.toLowerCase();
      let score = 0;
      for (const w of words) {
        if (t === w) score += 10;
        else if (t.startsWith(w)) score += 6;
        else if (t.includes(w)) score += 4;
        else if (x.includes(w)) score += 1;
        else return { e, score: -1 };
      }
      return { e, score: score + (e.group === 'Basics' ? 1 : 0) };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 60)
    .map(r => r.e);
}
