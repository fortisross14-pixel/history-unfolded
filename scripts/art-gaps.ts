/**
 * Which pictures the game asks for that have no art yet: compares the art keys the data implies
 * (buildings, techs, items, goods, wonders, culture choices, battle scenes, icons in use) with
 * public/sprites/art-manifest.json. Prints the gaps by group.
 * Usage: node --no-warnings scripts/art-gaps.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { SLOT_TYPES } from '../src/data/slots.ts';
import { TECHS } from '../src/data/techs.ts';
import { ITEMS } from '../src/data/items.ts';
import { GOODS } from '../src/data/goods.ts';
import { WONDERS } from '../src/data/wonders.ts';
import { CULTURE_LIST, DOMAIN_LIST, TAGS } from '../src/data/culture.ts';

const manifest = JSON.parse(readFileSync('public/sprites/art-manifest.json', 'utf8')) as Record<
  string,
  unknown
>;
const have = new Set(Object.keys(manifest));
const want: Record<string, string[]> = {
  building: Object.keys(SLOT_TYPES),
  tech: Object.keys(TECHS),
  item: Object.keys(ITEMS),
  good: Object.keys(GOODS),
  wonder: Object.keys(WONDERS),
  culture: CULTURE_LIST.map(n => n.id),
  domain: [...DOMAIN_LIST],
  tag: Object.keys(TAGS),
};
// interface icons the code names: <Ico name="…"> / icon: '…' / <Icon name="…">
const icons = new Set<string>();
const walk = (dir: string) => {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${f.name}`;
    if (f.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f.name))
      for (const m of readFileSync(p, 'utf8').matchAll(
        /(?:<Ico\s+name|<Icon\s+name|<Chip\s+icon|\bicon)=?:?\s*["'{`]+([a-z][a-z0-9-]+)["'`]/g,
      ))
        icons.add(m[1]);
  }
};
walk('src');
want.icon = [...icons];
for (const [group, ids] of Object.entries(want)) {
  const miss = ids.filter(id => !have.has(`${group}/${id}`));
  console.log(`${group}: ${ids.length - miss.length}/${ids.length} have art`);
  if (miss.length) console.log(`   missing: ${miss.join(', ')}`);
}
