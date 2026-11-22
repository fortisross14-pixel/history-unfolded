/**
 * The icon sheets for the Ivory Codex interface: six 1024 px images of 8 x 8 icons, generated from
 * the game's own data so keys never drift. Writes art/ICON-SHEETS.md (the brief to paste into an
 * image generator) and art/icon-sheets.json (what tools/cut_icon_sheets.py cuts).
 * Run: node --no-warnings scripts/icon-plan.ts
 */
import { writeFileSync } from 'node:fs';
import { DOMAIN_LIST, DOMAINS, TAGS } from '../src/data/culture.ts';
import { DEPOSITS, GOODS } from '../src/data/goods.ts';
import { ITEM_LIST } from '../src/data/items.ts';
import { SLOT_TYPES } from '../src/data/slots.ts';
import { ERAS, TECH_LIST } from '../src/data/techs.ts';

type Cell = [string, string]; // key, what to draw
interface Sheet {
  file: string;
  title: string;
  use: string;
  cells: Cell[];
  note?: string;
}

const SYM: Record<string, string> = {
  mysticism: 'a crescent moon over a standing stone',
  tanning: 'a stretched hide on a frame',
  pottery: 'a clay pot',
  mining: 'a pickaxe',
  'animal-husbandry': 'a goat and a crook',
  archery: 'a bow and arrow',
  masonry: 'a stack of cut stones and a chisel',
  sailing: 'a small sail',
  writing: 'a quill and a clay tablet',
  irrigation: 'a water channel through a field',
  'the-wheel': 'a spoked wooden wheel',
  'horseback-riding': 'a horse head with a bridle',
  'bronze-working': 'a bronze ingot and tongs',
  'classical-age': 'a column capital',
  'iron-working': 'an anvil with a hot iron bar',
  currency: 'a stamped coin',
  mathematics: 'a compass and a triangle',
  construction: 'a stone arch',
  carpentry: 'a saw and a plank',
  priesthood: 'a smoking incense bowl',
  literature: 'an open book',
  philosophy: 'a seated thinker with a scroll',
  law: 'a stone tablet of laws',
  bowyery: 'a long curved bow being strung',
  'mail-making': 'a patch of chain mail',
  drill: 'two spears held crossed in rank',
  'selective-breeding': 'a ram with a ribbon',
  engineering: 'a crane with a pulley',
  siegecraft: 'a catapult',
  navigation: "a star and a ship's wheel",
  'medieval-age': 'a castle tower',
  feudalism: 'a crown over a sheaf of wheat',
  mechanics: 'two meshing gears',
  chivalry: "a knight's helm with a plume",
  theology: 'a bell tower',
  education: 'a mortarboard cap on a book',
  guilds: 'a hammer and a key crossed',
  administration: 'a seal and a ledger',
  mineralogy: 'a crystal and a lump of ore',
  'armour-smithing': 'a breastplate on an anvil',
  'pike-tactics': 'three pikes leaning forward',
  yeomanry: 'a longbow and a hood',
  castles: 'a castle gate with a portcullis',
  urbanism: 'a row of town houses',
  alchemy: 'a round flask with bubbles',
  compass: 'a magnetic compass',
  'renaissance-age': 'a compass rose',
  gunpowder: 'a powder keg',
  printing: 'a printing press',
  banking: 'a money chest with a key',
  astronomy: 'a telescope and a star',
  metallurgy: 'molten metal pouring from a crucible',
  musketry: 'a musket',
  artillery: 'a cannon on wheels',
  conscription: 'a drum and a list',
  'officer-corps': "an officer's sword and epaulette",
  'scientific-method': 'a balance and a magnifier',
  'joint-stock': 'a share certificate with a seal',
  cartography: 'a rolled map and dividers',
  'star-forts': 'a star-shaped fort seen from above',
  'industrial-age': 'a cogwheel',
  'steam-power': 'a steam engine with a smoking chimney',
  railways: 'a short stretch of rails',
  'machine-tools': 'a lathe',
  preservation: 'a sealed tin can',
  'oil-drilling': 'an oil derrick',
  rifling: 'a rifle barrel with a spiral groove',
  electricity: 'a lightning bolt over a coil',
};
const techs: Cell[] = TECH_LIST.map(t => [
  `tech/${t.id}`,
  `${t.name}: ${SYM[t.id] ?? 'a simple symbol'}`,
]);
const eras: Cell[] = ERAS.slice(1).map((e, i) => [
  `era/${e.toLowerCase()}`,
  `${e} age seal (a round seal with a small ${['standing stone', 'column capital', 'castle tower', 'compass rose', 'cogwheel'][i]})`,
]);
const DOM: Record<string, string> = {
  cosmology: 'the sun and moon together',
  politics: 'a throne',
  religion: 'a temple roof',
  society: 'a family of three figures',
  economy: 'a balance scale',
  war: 'a helmet and a spear',
  seafaring: 'an anchor',
  knowledge: 'an open book and a lamp',
  arts: 'a lyre and a laurel',
};
const domains: Cell[] = DOMAIN_LIST.map(d => [
  `domain/${d}`,
  `${DOMAINS[d].name} (culture): ${DOM[d]}`,
]);
const TAGSYM: Record<string, string> = {
  solar: 'a radiant sun',
  lunar: 'a crescent moon',
  maritime: 'a wave and a ship',
  rationalist: 'a pair of dividers',
  devout: 'praying hands',
  zealous: 'a burning torch',
  tolerant: 'two open hands',
  absolutist: 'a crown and a sceptre',
  republican: 'a voting urn',
  martial: 'crossed swords and a shield',
  mercantile: 'a sack of coins',
  agrarian: 'a plough',
  artistic: 'a paintbrush and a mask',
  expansionist: 'a flag planted on new land',
};
const tags: Cell[] = Object.entries(TAGS).map(([k, v]) => [
  `tag/${k}`,
  `${v.name} (identity): ${TAGSYM[k]}`,
]);
const relief: Cell[] = [
  ['badge/hills', 'hills'],
  ['badge/mountains', 'mountain peaks'],
  ['badge/forest', 'forest'],
  ['badge/jungle', 'jungle palms'],
  ['badge/marsh', 'marsh reeds'],
];
const deposits: Cell[] = Object.keys(DEPOSITS).map(k => [
  `deposit/${k}`,
  `${k.replace('-', ' ')} (resource)`,
]);
const nothing = /^(no-|unarmed$|barefoot$|foot$)/;
const equipment: Cell[] = ITEM_LIST.filter(x => !nothing.test(x.id)).map(x => [
  `item/${x.id}`,
  `${x.name} (${x.slot})`,
]);
const buildings: Cell[] = Object.values(SLOT_TYPES).map(s => [`building/${s.id}`, s.name]);
const settlements: Cell[] = [
  ['settlement/outpost', 'outpost: a tent and a palisade'],
  ['settlement/village', 'village: three huts'],
  ['settlement/town', 'town: houses and a small tower'],
  ['settlement/city', 'city: walls, roofs and a temple'],
  ['settlement/metropolis', 'metropolis: walls, domes and towers'],
  ['building/empty', 'empty building plot with stakes and string'],
  ['district/centre', 'district centre: a small town hall on a square'],
];
const goods: Cell[] = Object.entries(GOODS).map(([k, v]) => [`good/${k}`, `${v.name}`]);
const troops: Cell[] = [
  ['troop/levy', 'levy: a club and a tunic'],
  ['troop/scouts', 'scouts: a walking staff and a cloak'],
  ['troop/slingers', 'slingers'],
  ['troop/javelins', 'javelin throwers'],
  ['troop/archers', 'archers: a simple bow'],
  ['troop/spearmen', 'spearmen: a spear and a round shield'],
  ['troop/axemen', 'axemen'],
  ['troop/swordsmen', 'swordsmen: a short sword and shield'],
  ['troop/heavy-infantry', 'heavy infantry: a big shield and armour'],
  ['troop/pikemen', 'pikemen: a long pike'],
  ['troop/crossbowmen', 'crossbowmen'],
  ['troop/longbowmen', 'longbowmen'],
  ['troop/arquebusiers', 'arquebusiers'],
  ['troop/musketeers', 'musketeers'],
  ['troop/riflemen', 'riflemen'],
  ['troop/field-gun', 'field gun with crew'],
  ['troop/light-cavalry', 'light cavalry'],
  ['troop/heavy-cavalry', 'heavy cavalry'],
  ['troop/lancers', 'lancers'],
  ['troop/horse-archers', 'horse archers'],
  ['troop/knights', 'knights on barded horses'],
  ['troop/medics', 'field medics'],
  ['troop/siege', 'siege ladder team'],
  ['troop/banner', 'banner bearer'],
  ['troop/settlers', 'settlers with a handcart'],
  ['troop/workers', 'workers with picks'],
  ['troop/galley', 'galley with oars'],
  ['troop/longship', 'longship'],
  ['troop/cog', 'cog with one sail'],
  ['troop/carrack', 'carrack'],
  ['troop/galleon', 'galleon'],
  ['troop/transport', 'transport ship with troops on deck'],
];
const ui: Cell[] = [
  ['icon/gold', 'stack of gold coins'],
  ['icon/science', 'open book with a star'],
  ['icon/culture', 'lyre'],
  ['icon/food', 'sheaf of wheat'],
  ['icon/production', 'hammer'],
  ['icon/housing', 'small house'],
  ['icon/workers', 'crossed pick and hoe'],
  ['icon/people', 'two standing figures'],
  ['icon/army', 'crossed swords'],
  ['icon/cities', 'tower'],
  ['icon/moves', 'boot print'],
  ['icon/sight', 'eye'],
  ['icon/melee', 'sword'],
  ['icon/ranged', 'bow and arrow'],
  ['icon/charge', 'double chevron'],
  ['icon/protection', 'shield'],
  ['icon/morale', 'banner'],
  ['icon/upkeep', 'coin purse'],
  ['icon/experience', 'laurel sprig'],
  ['icon/fortify', 'palisade'],
  ['icon/split', 'forking arrow'],
  ['icon/merge', 'two arrows joining'],
  ['icon/road', 'road with a dashed line'],
  ['icon/equip', 'anvil'],
  ['icon/go-to', 'target'],
  ['icon/found-city', 'flag on a hill'],
  ['icon/levy', 'raised spear and banner'],
  ['icon/settle', 'handcart'],
  ['icon/end-turn', 'hourglass'],
  ['icon/next-unit', 'pointing hand'],
  ['icon/notices', 'bell'],
  ['icon/menu', 'three lines'],
  ['icon/save', 'sealed scroll'],
  ['icon/load', 'open scroll'],
  ['icon/settings', 'cog'],
  ['icon/close', 'x'],
  ['icon/back', 'arrow left'],
  ['icon/forward', 'arrow right'],
  ['icon/zoom-in', 'magnifier with plus'],
  ['icon/zoom-out', 'magnifier with minus'],
  ['icon/layers', 'stacked sheets'],
  ['icon/minimap', 'folded map'],
  ['icon/war', 'crossed swords over a flame'],
  ['icon/peace', 'olive branch'],
  ['icon/pact', 'clasped hands'],
  ['icon/alliance', 'interlocked rings'],
  ['icon/trade', 'balance scale'],
  ['icon/gift', 'gift chest'],
  ['icon/demand', 'pointing finger and coin'],
  ['icon/absorb', 'crown over two banners'],
  ['icon/opinion-up', 'up arrow with a heart'],
  ['icon/opinion-down', 'down arrow with a cracked heart'],
  ['icon/research', 'astrolabe'],
  ['icon/designs', 'helmet over crossed spears'],
  ['icon/peoples', 'three heads'],
  ['icon/dynasties', 'family tree'],
  ['icon/ledger', 'open ledger'],
  ['icon/city', 'city gate'],
  ['icon/district', 'three-by-three grid of roofs'],
  ['icon/blueprint', 'rolled plan'],
  ['icon/lock', 'padlock'],
  ['icon/check', 'tick'],
  ['icon/warning', 'exclamation in a triangle'],
  ['icon/help', 'question mark in a circle'],
];

const sheets: Sheet[] = [
  {
    file: 'icons-1-techs.png',
    title: 'Techs I',
    use: 'Research tree nodes and the research tracker.',
    cells: techs.slice(0, 64),
  },
  {
    file: 'icons-2-techs-culture-map.png',
    title: 'Techs II, ages, culture and map badges',
    use: 'The last techs, age seals in the research tabs, culture domains and identities, map resource badges.',
    cells: [...techs.slice(64), ...eras, ...domains, ...tags, ...relief, ...deposits],
  },
  {
    file: 'icons-3-equipment.png',
    title: 'Equipment',
    use: 'Unit designer slots and cohort gear.',
    cells: equipment,
  },
  {
    file: 'icons-4-buildings.png',
    title: 'Buildings and settlements',
    use: 'District build picker, city panel, tooltips.',
    cells: [...buildings, ...settlements],
  },
  {
    file: 'icons-5-goods-troops.png',
    title: 'Goods and troop types',
    use: 'Stockpiles, trade, the unit card portrait and formation lists.',
    cells: [...goods, ...troops],
  },
  {
    file: 'icons-6-interface.png',
    title: 'Interface',
    use: 'Top bar, unit card stats and actions, dialogs, diplomacy.',
    cells: ui,
  },
];
for (const s of sheets)
  if (s.cells.length > 64) throw new Error(`${s.file}: ${s.cells.length} cells`);

const STYLE =
  'Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.';
const GRID =
  'Format: one square image, 1024 x 1024 pixels, an invisible 8 x 8 grid of 64 equal square cells (128 x 128 pixels each). Keep each symbol inside its cell with about 16 pixels of empty space on every side, so no symbol touches or crosses a cell edge. Do not draw grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2) everywhere, with no texture, vignette or border.';

let md = `# History Unfolded: icon sheets

Six sheets of simple icons for the new Ivory Codex interface. Each sheet is **one 1024 × 1024
image** holding an **8 × 8 grid of 64 icons** (128 × 128 px per cell). They are small, flat icons, not
illustrations: sepia ink and one light wash, so they sit with the map's hand-drawn symbols and the
ivory panels.

## How the grid works

\`\`\`
1024 px
┌────┬────┬────┬────┬────┬────┬────┬────┐
│ 1  │ 2  │ 3  │ 4  │ 5  │ 6  │ 7  │ 8  │  each cell 128 × 128 px
├────┼────┼────┼────┼────┼────┼────┼────┤  symbol about 96 px, centred,
│ 9  │ 10 │ …  │    │    │    │    │ 16 │  16 px empty margin all round
├────┼────┼────┼────┼────┼────┼────┼────┤
│ …  reading order: left to right,     │
│     top to bottom, row A to row H    │
├────┼────┼────┼────┼────┼────┼────┼────┤
│ 57 │ …  │    │    │    │    │    │ 64 │
└────┴────┴────┴────┴────┴────┴────┴────┘
\`\`\`

- Rows are **A to H**, columns **1 to 8**. Cell **C5** is row 3, column 5.
- The background is flat cream (**#F3E9D2**). Our cutter (\`tools/cut_sprites.py\`) lifts the ink off
  the paper, so do not ask for transparency, and keep the cream plain.
- No grid lines, numbers or text in the picture. The order alone tells us which icon is which.
- A cell marked *(empty)* stays blank cream.
- Save each sheet under the file name given, in \`art/source/\`.
- The keys in the cell maps (\`tech/archery\`, \`icon/gold\`, \`item/spear\`…) are the names the
  game already looks up, so cut icons appear in the interface without code changes.

## The same two lines go into every prompt

**Style**
> ${STYLE}

**Format**
> ${GRID}

## If the generator struggles

- 64 icons in one picture is a lot. If symbols come out wrong or uneven, ask for **one row of 8 at a
  time** (same prompt, "a single row of 8 cells, 1024 × 128 pixels"), or **a quarter of the sheet**
  (4 × 4 cells, 512 × 512 pixels) and place the pieces together.
- Generate the **Interface** sheet first and use it as the style reference for all the others
  ("match the style of the attached sheet exactly").
- Small differences in the grid are fine: the cutter finds the gaps between icons.

`;
const ROWS = 'ABCDEFGH';
for (const [n, s] of sheets.entries()) {
  md += `---\n\n## Sheet ${n + 1}: ${s.title}\n\nFile: \`${s.file}\` · ${s.cells.length} of 64 cells used · ${s.use}\n\n`;
  md += `### Prompt to paste\n\n\`\`\`\nA sprite sheet of ${s.cells.length} icons for a historical strategy game: ${s.title.toLowerCase()}.\n${STYLE}\n${GRID}\nCells in reading order (row A left to right, then row B, and so on):\n`;
  for (let r = 0; r < 8; r++) {
    const row = Array.from({ length: 8 }, (_, c) => s.cells[r * 8 + c]);
    if (!row.some(Boolean)) {
      md += `Row ${ROWS[r]}: all empty.\n`;
      continue;
    }
    md += `Row ${ROWS[r]}: ${row.map((x, c) => `${c + 1} ${x ? x[1] : '(empty)'}`).join('; ')}.\n`;
  }
  md +=
    '```\n\n### Cell map\n\n| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |\n|---|---|---|---|---|---|---|---|---|\n';
  for (let r = 0; r < 8; r++)
    md += `| **${ROWS[r]}** | ${Array.from({ length: 8 }, (_, c) => {
      const x = s.cells[r * 8 + c];
      return x ? `${x[1].split(':')[0].split(' (')[0]}<br>\`${x[0]}\`` : '·';
    }).join(' | ')} |\n`;
  md += '\n';
}
writeFileSync('art/ICON-SHEETS.md', md);
writeFileSync(
  'art/icon-sheets.json',
  JSON.stringify(
    sheets.map(s => ({ file: s.file, cells: s.cells.map(c => c[0]) })),
    null,
    1,
  ),
);
console.log(sheets.map(s => `${s.file}: ${s.cells.length}`).join('\n'));
