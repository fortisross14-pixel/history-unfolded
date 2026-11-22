/** Validates game data: every reference points at something real, every tag and tech exists. */
import { CULTURE, CULTURE_LIST, TAGS } from '../src/data/culture.ts';
import { ITEM_LIST } from '../src/data/items.ts';
import { SLOT_LIST } from '../src/data/slots.ts';
import { TECHS, TECH_LIST } from '../src/data/techs.ts';
import { DEPOSITS } from '../src/data/goods.ts';

const errs: string[] = [];
for (const c of CULTURE_LIST) {
  for (const r of [...c.requires, ...c.requiresAny])
    if (!CULTURE[r]) errs.push(`culture ${c.id}: unknown requirement ${r}`);
  for (const t of c.tags) if (!TAGS[t]) errs.push(`culture ${c.id}: unknown tag ${t}`);
}
const forks = new Map<string, string[]>();
for (const c of CULTURE_LIST) if (c.fork) forks.set(c.fork, [...(forks.get(c.fork) ?? []), c.id]);
for (const [f, ids] of forks) if (ids.length < 2) errs.push(`fork ${f} has only ${ids.join(',')}`);
for (const t of TECH_LIST)
  for (const r of t.requires) if (!TECHS[r]) errs.push(`tech ${t.id}: unknown requirement ${r}`);
for (const t of TECH_LIST)
  if (t.favoured && !TAGS[t.favoured]) errs.push(`tech ${t.id}: unknown tag ${t.favoured}`);
for (const t of TECH_LIST)
  for (const r of t.requires)
    if (TECHS[r] && TECHS[r].era > t.era) errs.push(`tech ${t.id} needs a later-era tech ${r}`);
for (const i of ITEM_LIST)
  if (i.tech && !TECHS[i.tech]) errs.push(`item ${i.id}: unknown tech ${i.tech}`);
for (const s of SLOT_LIST)
  if (s.tech && !TECHS[s.tech]) errs.push(`slot ${s.id}: unknown tech ${s.tech}`);
for (const d of Object.values(DEPOSITS))
  if (d.revealedBy && !TECHS[d.revealedBy])
    errs.push(`deposit ${d.name}: unknown tech ${d.revealedBy}`);
// every culture node reachable in principle (requirements not all inside its own fork)
for (const c of CULTURE_LIST)
  if (c.fork && c.requires.some(r => CULTURE[r]?.fork === c.fork))
    errs.push(`culture ${c.id} requires a node of its own fork`);
// unlock counts
const unlocks = (id: string) =>
  ITEM_LIST.filter(i => i.tech === id).length +
  SLOT_LIST.filter(s => s.tech === id).length +
  (TECHS[id].mods ? 1 : 0) +
  Object.values(DEPOSITS).filter(d => d.revealedBy === id).length;
for (const t of TECH_LIST)
  if (t.gate === undefined && !unlocks(t.id)) errs.push(`tech ${t.id} unlocks nothing`);
// ages: prerequisites stay inside an age; every age after the first has one gate, and it can be met
for (const t of TECH_LIST)
  for (const r of t.requires)
    if (TECHS[r] && TECHS[r].era !== t.era) errs.push(`tech ${t.id} needs ${r} from another age`);
for (let e = 2; e <= 4; e++) {
  const gates = TECH_LIST.filter(t => t.gate !== undefined && t.era === e - 1);
  if (gates.length !== 1) errs.push(`age ${e} has ${gates.length} gates`);
  else if (gates[0].gate! > TECH_LIST.filter(t => t.era === e - 1 && !t.gate).length)
    errs.push(`gate ${gates[0].id} asks for more techs than its age has`);
}
console.log(
  `${TECH_LIST.length} techs, ${CULTURE_LIST.length} culture nodes, ${forks.size} forks, ${Object.keys(TAGS).length} tags, ${ITEM_LIST.length} items, ${SLOT_LIST.length} slot types`,
);
console.log(errs.length ? errs.join('\n') : 'data OK');
process.exit(errs.length ? 1 : 0);
