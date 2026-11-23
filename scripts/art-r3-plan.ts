/**
 * Release 3 art: the pictures the game still draws with fallbacks, as five sheets in the two looks
 * already in use (ink-and-wash emblems on cream, painted miniatures on magenta). Built from the
 * game's data so the keys match the code. Writes art/R3-SHEETS.md (the brief to paste) and adds
 * its sheets to art/icon-sheets.json and art/map-sheets.json, so tools/cut_icon_sheets.py cuts
 * them like the earlier ones (re-running replaces them; the other sheets are kept).
 * Run: node --no-warnings scripts/art-r3-plan.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CULTURE_LIST, DOMAINS } from '../src/data/culture.ts';
import { TECHS } from '../src/data/techs.ts';
import { WONDER_LIST } from '../src/data/wonders.ts';

type Cell = [string, string]; // key, what to draw

// ---------------------------------------------------------------- culture choices: one symbol each
const CULTURE: Record<string, string> = {
  'star-lore': 'a cluster of five stars joined by thin lines',
  'solar-calendar': 'a sun disc above a sheaf of wheat',
  'lunar-calendar': 'a crescent moon above three small waves',
  'sun-cult': 'a radiant sun with a face-less disc and long rays',
  'monumental-astronomy': 'a ring of standing stones with the sun rising in the gap',
  'tide-lore': 'a wave curling over a pebble beach',
  'night-navigation': 'a bright star over a small boat prow',
  'divine-kingship': 'a crown with a sun disc above it',
  'rational-astronomy': 'a quadrant measuring instrument and a star',
  'celestial-navigation': 'an astrolabe',
  'mystic-orders': 'a hooded figure holding a crescent moon',
  heliocentrism: 'a sun with one planet on a circular orbit around it',
  'celestial-spheres': 'nested rings around a small globe (an armillary sphere)',
  chiefdom: 'a feathered chief’s staff',
  'council-of-elders': 'three walking sticks leaning together',
  warlord: 'a horned helmet over a sword',
  assembly: 'a raised open hand over a small crowd of heads',
  'tribal-law': 'a carved wooden tally stick with notches',
  'divine-right': 'a crown under a beam of light from above',
  'war-chiefs': 'two crossed war banners',
  republic: 'a laurel wreath around a bundle of rods',
  senate: 'a curved row of stone benches',
  'court-bureaucracy': 'a wax seal on a folded document',
  absolutism: 'a heavy crown on a closed fist',
  'enlightened-despotism': 'a crown resting on an open book',
  constitution: 'a long scroll with a ribbon seal',
  democracy: 'a ballot urn with a pebble falling in',
  'ancestor-spirits': 'a burial mound with a small flame above it',
  'many-gods': 'three small idols side by side',
  'one-god': 'a single ray of light from a cloud',
  'shrines-of-all': 'a small open shrine with several niches',
  'priesthood-caste': 'a tall priest’s mitre',
  'holy-war': 'a sword crossed with a holy banner',
  'state-religion': 'a crown and a temple roof joined',
  pilgrimage: 'a walking staff with a scallop shell',
  syncretism: 'two different temple roofs merging into one',
  'militant-orders': 'a shield bearing a plain cross-shaped bar (no real emblem)',
  inquisition: 'a closed book with a heavy iron lock',
  theocracy: 'a priest’s mitre above a crown',
  'secular-state': 'a balance scale over a plain building front',
  kinship: 'two hands clasped at the wrist',
  'clan-society': 'a round shield with a simple knot pattern',
  'household-society': 'a farmhouse with a smoking chimney',
  'warrior-caste': 'a helmet resting on a spear',
  'land-tenure': 'a field divided into strips with a boundary stone',
  'craft-guilds': 'a hammer and a chisel crossed',
  'caste-system': 'a stepped pyramid of four layers',
  'social-mobility': 'a ladder with an arrow going up',
  'urban-life': 'a cluster of town roofs with a tower',
  'feudal-levy': 'a lord’s banner over three spears',
  'free-cities': 'a town gate with an open key above it',
  'peasant-communes': 'a hay fork and a sickle crossed',
  'city-charter': 'a charter scroll in front of a town wall',
  'seat-of-empire': 'a domed palace',
  barter: 'two arrows swapping a jar and a sack',
  'land-wealth': 'a field with a bull in front',
  'trade-wealth': 'a merchant’s scale with coins',
  tribute: 'a bowed figure offering a chest',
  coinage: 'a stack of three stamped coins',
  'granary-system': 'a round granary with a conical roof',
  'merchant-houses': 'a merchant’s mark on a bale of cloth',
  estates: 'a manor house behind a row of fields',
  'mining-charters': 'a pickaxe on a scroll',
  mercantilism: 'a closed money chest with a ship on its lid',
  'free-markets': 'an open market stall with an awning',
  'banking-families': 'a ledger with a key across it',
  'war-bands': 'three small round shields overlapping',
  'shock-warfare': 'a ram’s head',
  'skirmish-warfare': 'three javelins in flight',
  'shield-wall': 'four round shields in a row, overlapping',
  'horse-culture': 'a galloping horse',
  'archery-tradition': 'a bow with three arrows',
  'drilled-ranks': 'a drum with crossed drumsticks',
  'siege-engineers': 'a battering ram under a small roof',
  'mountain-warfare': 'a mountain peak with a spear planted on top',
  'professional-army': 'a soldier’s helmet with a coin',
  'citizen-militia': 'a plough with a spear laid across it',
  'conquest-doctrine': 'a sword planted in a globe',
  'coastal-fishing': 'a fishing net with a fish',
  'coast-huggers': 'a small boat close to a cliff',
  'open-sea': 'a ship on a wide horizon line',
  'harbour-towns': 'a quay with a mooring post and rope',
  'sea-raiders': 'a longship prow with a carved head',
  shipwrights: 'a ship’s ribs on a slipway',
  thalassocracy: 'a trident over waves',
  'trade-leagues': 'three ship flags tied together',
  explorers: 'a spyglass over a rolled map',
  'navigation-schools': 'a sextant and a book',
  admiralty: 'an anchor with a crown above it',
  'oral-tradition': 'an open mouth with three sound lines',
  scribes: 'a reed pen and an ink pot',
  bards: 'a small harp',
  'natural-philosophy': 'a falling stone with a dotted arc',
  medicine: 'a mortar and pestle',
  'record-keeping': 'a stack of clay tablets',
  genealogies: 'a small family tree with round leaves',
  academies: 'a colonnaded school front',
  'engineering-tradition': 'a stone bridge arch over water',
  herbalism: 'a bundle of herbs tied with string',
  empiricism: 'a magnifying glass over a leaf',
  scholasticism: 'a book with a candle on it',
  storytelling: 'a campfire with sparks',
  'grand-monuments': 'an obelisk',
  'folk-arts': 'a painted clay jug with a flower pattern',
  'epic-poetry': 'a lyre with a laurel sprig',
  theatre: 'two theatre masks, one smiling, one sad',
  sculpture: 'a bust on a plinth',
  patronage: 'a purse handing coins to a paintbrush',
  'court-arts': 'a gilded frame with a crown on top',
  humanism: 'a human figure inside a circle and a square',
  'golden-age': 'a radiant sun over a laurel wreath',
};

// ---------------------------------------------------------------- interface emblems still missing
const MORE_UI: Cell[] = [
  ['icon/crown', 'a simple three-point crown'],
  ['icon/sun', 'a sun disc with short rays (faith)'],
  ['icon/crate', 'a wooden crate with a lid (store)'],
  ['icon/goods', 'a bundle of sacks and a small barrel'],
  ['icon/report', 'a folded news sheet'],
  ['icon/minus', 'a short thick horizontal bar'],
  ['icon/helm', 'a soldier’s helmet'],
  ['icon/drop', 'a single water drop'],
  ['icon/info', 'a lower-case i in a plain circle drawn in ink'],
  ['icon/faith', 'a temple roof with a small flame'],
  ['icon/wonder', 'a pyramid with a star above it'],
  ['icon/colony', 'a small flag on a stockade'],
  ['icon/raiders', 'a burning torch over a broken shield'],
  ['icon/ruins', 'two broken columns'],
  ['icon/rail', 'a short stretch of railway track'],
  ['icon/power', 'a factory chimney with smoke'],
  ['icon/governor', 'a seated figure with a scroll'],
  ['icon/siege', 'a ladder against a wall'],
  ['icon/growth', 'a sprouting seedling'],
  ['icon/upgrade', 'a house with an up arrow'],
  ['icon/edict', 'a scroll with a hanging seal'],
  ['icon/tenet', 'a small altar with a flame'],
  ['icon/crisis', 'a cracked bell'],
  ['icon/unrest', 'a clenched fist'],
  ['icon/priority-growth', 'a sheaf of wheat with a house'],
  ['icon/priority-trade', 'a coin on a balance scale'],
  ['icon/priority-expand', 'a flag with an arrow pointing out'],
  ['icon/priority-war', 'a sword with a flame'],
  ['icon/priority-balanced', 'a balance scale level'],
  ['icon/supply-industry', 'a cog and a hammer'],
  ['icon/supply-homes', 'a hearth with a pot'],
  ['icon/supply-army', 'a pack saddle with sacks'],
  ['icon/victory-score', 'a laurel wreath'],
  ['icon/victory-science', 'a rocket-shaped brass telescope pointing up'],
  ['icon/victory-culture', 'a lyre inside a laurel wreath'],
  ['icon/victory-diplomacy', 'clasped hands over an olive branch'],
  ['icon/victory-domination', 'a crown on a sword hilt'],
  ['icon/opinion', 'a face in profile with a speech mark'],
  ['icon/intent', 'an eye with an arrow'],
  ['icon/personality', 'a theatre mask'],
  ['icon/ship-cargo', 'a ship’s hold with crates'],
];
const EMPTY_SLOTS: Cell[] = [
  ['item/no-shield', 'an outline of a shield drawn with a dashed line (no shield)'],
  ['item/no-helmet', 'an outline of a helmet drawn with a dashed line (no helmet)'],
  ['item/no-armour', 'an outline of a tunic drawn with a dashed line (no armour)'],
  ['item/barefoot', 'a bare footprint'],
  ['item/foot', 'a boot print (on foot, no horse)'],
  ['item/no-kit', 'an empty open sack (no kit)'],
  ['item/unarmed', 'an open empty hand (unarmed)'],
];
const TECH_MORE: Record<string, string> = {
  'great-observatory': 'a domed observatory with a telescope',
  'transcontinental-telegraph': 'a telegraph pole with wires',
  'powered-flight': 'a simple early biplane',
};

// ---------------------------------------------------------------- painted pieces
const WONDER: Record<string, string> = {
  'great-pyramid': 'a great stepped stone pyramid in warm sandstone, a small ramp at its foot',
  'hanging-gardens':
    'terraced brick gardens on three levels, palms and vines spilling over the edges',
  'great-library': 'a colonnaded library hall with scroll shelves visible between columns',
  'great-wall': 'a long stone wall with two square towers snaking over a hill',
  'dome-of-heaven': 'a large domed temple with a lantern on top and two small towers',
  'grand-bazaar': 'a covered market of many small domes with striped awnings',
  'house-of-printing': 'a timber-framed print house with a large press seen through the door',
  admiralty: 'a stone admiralty building on a quay with a ship moored beside it',
  'crystal-palace': 'a great glass-and-iron exhibition hall with an arched roof',
  'grand-terminus': 'a grand brick railway station with a clock tower and an arched train shed',
};
const AGES = ['ancient', 'classical', 'medieval', 'renaissance', 'industrial'];
const LEADER: Record<string, string[]> = {
  ancient: [
    'an old chieftain with a grey beard, a fur cloak and a bronze torc',
    'a young queen with braided hair, a linen robe and a gold diadem',
    'a priest-king with a shaved head and a tall white crown',
  ],
  classical: [
    'a bearded statesman in a draped toga-like robe with a laurel wreath',
    'a stern general with a crested bronze helmet tucked under his arm',
    'a philosopher-queen with curled hair and a simple circlet',
  ],
  medieval: [
    'a crowned king with a short beard, a fur-lined mantle and a sceptre',
    'an abbess-ruler in a dark wimple with a heavy pendant',
    'a warlord in a mail coif with a scar across his cheek',
  ],
  renaissance: [
    'a merchant prince in a velvet cap and a high-collared doublet',
    'a queen in a wide lace ruff with pearls',
    'a scholar-duke with spectacles, a dark robe and a gold chain',
  ],
  industrial: [
    'a statesman with side whiskers, a frock coat and a cravat',
    'a woman president in a high-necked dark dress with a brooch',
    'a general in a buttoned uniform coat with epaulettes and a moustache',
  ],
};
const RAIDER = 'a raider chief with a wild beard, a wolf-pelt hood and face paint';

// ---------------------------------------------------------------- the sheets
interface CreamSheet {
  file: string;
  title: string;
  use: string;
  cells: (Cell | null)[];
}
const cultureCells: Cell[] = CULTURE_LIST.map(n => {
  const sym = CULTURE[n.id];
  if (!sym) throw new Error(`no symbol for culture/${n.id}`);
  return [`culture/${n.id}`, sym];
});
const techCells: Cell[] = Object.keys(TECH_MORE).map(id => {
  if (!TECHS[id]) throw new Error(`no tech ${id}`);
  return [`tech/${id}`, TECH_MORE[id]];
});
const cream: CreamSheet[] = [
  {
    file: 'icons-7-culture-1.png',
    title: 'Culture choices I',
    use: 'Culture screen: the first 64 choices (cosmology, politics, religion, society, economy, war).',
    cells: cultureCells.slice(0, 64),
  },
  {
    file: 'icons-8-culture-2.png',
    title: 'Culture choices II and the last techs',
    use: 'Culture screen: the remaining choices; the three late techs.',
    cells: [...cultureCells.slice(64), ...techCells],
  },
  {
    file: 'icons-9-interface-2.png',
    title: 'Interface II',
    use: 'Chips and buttons added since the first interface sheet; empty equipment slots.',
    cells: [...MORE_UI, ...EMPTY_SLOTS],
  },
];
for (const s of cream) if (s.cells.length > 64) throw new Error(`${s.file}: ${s.cells.length}`);

interface FigureSheet {
  file: string;
  title: string;
  use: string;
  cols: number;
  rows: number;
  cell: number;
  height: number;
  lead: string;
  cells: (Cell | null)[];
}
const wonderCells: Cell[] = WONDER_LIST.map(w => {
  const d = WONDER[w.id];
  if (!d) throw new Error(`no picture for wonder/${w.id}`);
  return [`wonder/${w.id}`, d];
});
const leaderCells: Cell[] = [
  ...AGES.flatMap(a => LEADER[a].map((d, i): Cell => [`leader/${a}-${i + 1}`, d])),
  ['leader/raider', RAIDER],
];
const figures: FigureSheet[] = [
  {
    file: 'map-5-wonders.png',
    title: 'Wonders',
    use: 'Wonder cards in the Cities & wonders screen and the wonder-complete notice.',
    cols: 4,
    rows: 3,
    cell: 256,
    height: 192,
    lead: 'Each wonder stands on a small irregular patch of earth and grass, seen from slightly above in three-quarter view, the whole building inside the cell.',
    cells: [...wonderCells, null, null],
  },
  {
    file: 'map-6-leaders.png',
    title: 'Leaders',
    use: 'Diplomacy: each people shows a ruler of its age; the raider chief for raiders.',
    cols: 4,
    rows: 4,
    cell: 256,
    height: 192,
    lead: 'Each portrait is a head-and-shoulders bust in three-quarter view facing right, cut off at mid-chest with a soft vignette fading to the background, no frame. Fictional people, not any real historical figure. Where a sash, collar or cloak would carry a people’s colour, leave it plain off-white.',
    cells: leaderCells,
  },
];

// ---------------------------------------------------------------- the style lines (as the earlier sheets)
const EMBLEM =
  'Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.';
const EMBLEM_GRID =
  'Format: one square image, 1024 x 1024 pixels, an invisible 8 x 8 grid of 64 equal square cells (128 x 128 pixels each). Keep each symbol inside its cell with about 16 pixels of empty space on every side, so no symbol touches or crosses a cell edge. Do not draw grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2) everywhere, with no texture, vignette or border.';
const FIGURE =
  'Style: small painted miniatures for a historical strategy game, in the manner of a hand-coloured engraving: fine dark sepia outlines, soft watercolour shading, a warm, slightly muted palette (ochre, umber, oxblood, olive, slate blue, linen, weathered bronze, iron grey). The same scale and the same light from the top left in every cell. Clear, simple shapes that still read at 64 pixels: no fine clutter, no scenery beyond what is described. Not tied to any real nation; no real insignia, flags or religious symbols. No text, letters, numbers or labels anywhere.';
const MAGENTA =
  'Background: one flat, solid, pure magenta (#FF00FF) everywhere, with no gradient, texture, floor, horizon or shadow. Nothing in the pictures is magenta.';
const ROWS = 'ABCDEFGH';

let md = `# History Unfolded: Release 3 art

Five sheets for what the game still draws with stand-ins: the culture choices, a second interface
sheet, wonders and leader portraits. They use **the same two looks as the sheets you already
made**, with the same style lines word for word, so they sit with them:

| Sheet | Image | Grid | Look | Background |
|---|---|---|---|---|
| 7. Culture choices I | 1024 × 1024 | 8 × 8 of 128 px | ink emblems | cream #F3E9D2 |
| 8. Culture choices II, last techs | 1024 × 1024 | 8 × 8 of 128 px | ink emblems | cream #F3E9D2 |
| 9. Interface II | 1024 × 1024 | 8 × 8 of 128 px | ink emblems | cream #F3E9D2 |
| M5. Wonders | 1024 × 768 | 4 × 3 of 256 px | painted miniatures | magenta #FF00FF |
| M6. Leaders | 1024 × 1024 | 4 × 4 of 256 px | painted miniatures | magenta #FF00FF |

## Rules for every sheet

- **Attach a reference.** For sheets 7–9 attach \`icons-6-interface.png\`; for M5 and M6 attach
  \`map-1-foot.png\`. Add: *"Match the style of the attached sheet exactly: line weight, wash,
  palette and scale."*
- Read each grid **left to right, top to bottom** (row A, then B…). The order alone says which
  picture is which, so keep it exactly. A cell marked *(empty)* stays plain background.
- **No grid lines, borders, numbers or text** in the picture. Nothing may touch or cross a cell edge.
- Ink emblems on **plain cream**; painted pieces on **flat magenta** (the cutter removes it).
- Save each sheet in \`art/source/\` under the file name given, then run
  \`python3 tools/cut_icon_sheets.py\` for sheets 7–9 and \`python3 tools/cut_icon_sheets.py --map\`
  for M5 and M6 (or hand the files over and I cut them).
- **If a sheet comes back wrong** (wrong count, merged pictures, textured background, a cell out of
  order): ask for it again with the same prompt, or ask for **one row at a time** ("a single row of
  8 cells, 1024 × 128 pixels" for emblems; "a single row of 4 cells, 1024 × 256 pixels" for
  painted pieces) and place the rows together. Do not retouch by hand.

## The style lines

**Ink emblems (sheets 7–9)**
> ${EMBLEM}
>
> ${EMBLEM_GRID}

**Painted miniatures (M5, M6)**
> ${FIGURE}
>
> ${MAGENTA}

`;
const cellMap = (cells: (Cell | null)[], cols: number, rows: number) => {
  let t = `| | ${Array.from({ length: cols }, (_, c) => c + 1).join(' | ')} |\n|---|${'---|'.repeat(cols)}\n`;
  for (let r = 0; r < rows; r++)
    t += `| **${ROWS[r]}** | ${Array.from({ length: cols }, (_, c) => {
      const x = cells[r * cols + c];
      return x ? `${x[1].split(' (')[0]}<br>\`${x[0]}\`` : '·';
    }).join(' | ')} |\n`;
  return t;
};
const rowsText = (cells: (Cell | null)[], cols: number, rows: number) => {
  let t = '';
  for (let r = 0; r < rows; r++) {
    const row = Array.from({ length: cols }, (_, c) => cells[r * cols + c] ?? null);
    t += row.some(Boolean)
      ? `Row ${ROWS[r]}: ${row.map((x, c) => `${c + 1} ${x ? x[1] : '(empty)'}`).join('; ')}.\n`
      : `Row ${ROWS[r]}: all empty.\n`;
  }
  return t;
};
for (const [i, s] of cream.entries()) {
  const used = s.cells.filter(Boolean).length;
  md += `---\n\n## Sheet ${7 + i}: ${s.title}\n\nFile: \`${s.file}\` · ${used} of 64 cells · ${s.use}\n\n### Prompt to paste\n\n\`\`\`\nA sprite sheet of ${used} icons for a historical strategy game: ${s.title.toLowerCase()}.\n${EMBLEM}\n${EMBLEM_GRID}\nCells in reading order (row A left to right, then row B, and so on):\n${rowsText(s.cells, 8, 8)}\`\`\`\n\n### Cell map\n\n${cellMap(s.cells, 8, 8)}\n`;
}
for (const s of figures) {
  const w = s.cols * s.cell,
    h = s.rows * s.cell;
  md += `---\n\n## Sheet ${s.file.startsWith('map-5') ? 'M5' : 'M6'}: ${s.title}\n\nFile: \`${s.file}\` · ${w} × ${h} px · ${s.cols} × ${s.rows} cells of ${s.cell} × ${s.cell} px · ${s.use}\n\n### Prompt to paste\n\n\`\`\`\nA sprite sheet for a historical strategy game: ${s.title.toLowerCase()}.\n${FIGURE}\n${s.lead}\n${MAGENTA}\nFormat: one image, ${w} x ${h} pixels, an invisible ${s.cols} x ${s.rows} grid of equal cells (${s.cell} x ${s.cell} pixels each). One subject per cell, centred, filling about 80% of the cell, never touching or crossing a cell edge. No grid lines, borders or numbers.\nCells in reading order (row A left to right, then row B, and so on):\n${rowsText(s.cells, s.cols, s.rows)}\`\`\`\n\n### Cell map\n\n${cellMap(s.cells, s.cols, s.rows)}\n`;
}
writeFileSync('art/R3-SHEETS.md', md);

// add (or replace) the sheets in the cutter's lists, keeping the earlier ones
const merge = (path: string, add: object[], files: string[]) => {
  const old = JSON.parse(readFileSync(path, 'utf8')) as { file: string }[];
  writeFileSync(
    path,
    JSON.stringify([...old.filter(x => !files.includes(x.file)), ...add], null, 1) + '\n',
  );
};
merge(
  'art/icon-sheets.json',
  cream.map(s => ({ file: s.file, cells: s.cells.map(c => c?.[0] ?? null) })),
  cream.map(s => s.file),
);
merge(
  'art/map-sheets.json',
  figures.map(s => ({
    file: s.file,
    cols: s.cols,
    rows: s.rows,
    style: 'figure',
    height: s.height,
    cells: s.cells.map(c => c?.[0] ?? null),
  })),
  figures.map(s => s.file),
);
void DOMAINS;
console.log(
  [...cream, ...figures].map(s => `${s.file}: ${s.cells.filter(Boolean).length}`).join('\n'),
);
