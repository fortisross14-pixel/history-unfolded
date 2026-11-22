/**
 * The map art: troop, ship and settlement figures and the extra terrain symbols, in the painted
 * style of the map's current figures. The keys are the ones the map renderer already asks for
 * (formationArtKey in src/engine/units.ts, the settlement and terrain lookups in mapRenderer.ts).
 * Writes art/MAP-SHEETS.md (the brief) and art/map-sheets.json (what tools/cut_icon_sheets.py cuts).
 * Run: node --no-warnings scripts/map-art-plan.ts
 */
import { writeFileSync } from 'node:fs';

type Cell = [string, string];
interface Sheet {
  file: string;
  title: string;
  use: string;
  cols: number;
  rows: number;
  width: number;
  height: number;
  style: 'figure' | 'ink';
  /** cut sprite height in px */
  out: number;
  cells: Cell[];
}

const FIGURE =
  "Style: small painted miniature figures for the map of a historical strategy game, in the manner of a hand-coloured engraving: fine dark sepia outlines, soft watercolour shading, a warm, slightly muted palette (ochre, umber, oxblood, olive, slate blue, linen, weathered bronze, iron grey). Each figure stands on a small oval patch of grass and earth. Three-quarter view from slightly above, facing right, the same scale and the same light from the top left in every cell. Clear, simple silhouettes that still read at 48 pixels tall: no fine detail, no scenery. Where a flag, banner, sash or shield face would carry a people's colour, leave it plain off-white (the game paints the colour itself). Not tied to any real nation; no real insignia. No text, letters, numbers or labels anywhere.";
const FIGURE_BG =
  'Background: one flat, solid, pure magenta (#FF00FF) everywhere, with no gradient, texture, floor, horizon or shadow. Nothing in the figures is magenta.';
const INK =
  'Style: map symbols drawn in dark sepia ink with a light watercolour wash on plain cream paper, like an old hand-drawn atlas, matching the trees, hills and mountains already on our map: small pictograms seen from the side, same line weight, same light from the top left. Simple and readable at 40 pixels. No text, letters, numbers or labels anywhere.';
const INK_BG =
  'Background: one flat, plain cream paper colour (#F3E9D2) everywhere, with no texture, stains, vignette or border.';

const sheets: Sheet[] = [
  {
    file: 'map-1-foot.png',
    title: 'Foot troops',
    use: "Formations on the map, from the first levy to the field gun. The map picks the figure from the formation's main design.",
    cols: 4,
    rows: 4,
    width: 1024,
    height: 1024,
    style: 'figure',
    out: 192,
    cells: [
      ['unit/levy', 'levy: a man in a rough tunic with a wooden club, barefoot'],
      ['unit/spearman', 'spearman: tunic, spear held upright, round wicker shield'],
      [
        'unit/hoplite',
        'heavy spearman: bronze helmet, bronze scale armour, large round bronze shield, spear',
      ],
      ['unit/pikeman', 'pikeman: very long pike held upright, iron helmet, padded coat'],
      ['unit/axeman', 'axeman: tunic and leather cap, a broad bronze axe over the shoulder'],
      ['unit/swordsman', 'swordsman: short sword and a hide shield, leather armour'],
      ['unit/heavy-swordsman', 'heavy swordsman: iron sword, chain mail, kite shield, iron helmet'],
      ['unit/plate-infantry', 'plate infantry: full plate armour, closed helm, long sword'],
      ['unit/slinger', 'slinger: tunic, swinging a sling above the head'],
      ['unit/javelineer', 'javelin thrower: a bundle of javelins, one raised to throw'],
      ['unit/archer', 'archer: simple wooden bow drawn, quiver on the back'],
      ['unit/longbowman', 'longbowman: tall longbow drawn, hood'],
      ['unit/crossbowman', 'crossbowman: crossbow raised, a tall pavise shield beside him'],
      ['unit/arquebusier', 'arquebusier: early matchlock gun, wide-brimmed hat'],
      ['unit/musketeer', 'musketeer: musket on the shoulder, coat and hat'],
      ['unit/field-gun', 'field gun: a small bronze cannon on wheels with one gunner'],
    ],
  },
  {
    file: 'map-2-horse-civil-ships.png',
    title: 'Horsemen, civilians and ships',
    use: 'Mounted formations, settlers, workers, engineers, and fleets at sea.',
    cols: 4,
    rows: 4,
    width: 1024,
    height: 1024,
    style: 'figure',
    out: 192,
    cells: [
      ['unit/light-cavalry', 'light cavalry: a rider on a plain horse with a short spear'],
      ['unit/heavy-cavalry', 'heavy cavalry: an armoured rider on a heavy horse with a sword'],
      ['unit/knight', 'knight: plate armour, lance raised, horse in a cloth barding'],
      ['unit/horse-archer', 'horse archer: a rider drawing a short bow'],
      ['unit/scout', 'scout: a walker with a cloak and a staff, looking ahead'],
      ['unit/settlers', 'settlers: a man and a woman pulling a laden handcart'],
      ['unit/workers', 'workers: two labourers with a pick and a shovel'],
      ['unit/engineers', "engineers: a man with a surveyor's staff and a measuring chain"],
      ['ship/dugout', 'dugout canoe with two paddlers, on a small patch of sea'],
      ['ship/galley', 'small oared galley with one square sail, on a small patch of sea'],
      [
        'ship/war-galley',
        'war galley with a bronze ram and a row of oars, on a small patch of sea',
      ],
      [
        'ship/longship',
        'longship with a striped sail and shields along the side, on a small patch of sea',
      ],
      [
        'ship/cog',
        'cog: round hull, one square sail, castles fore and aft, on a small patch of sea',
      ],
      ['ship/carrack', 'carrack: three masts, high castles, on a small patch of sea'],
      ['ship/galleon', 'galleon: three masts, full sails, on a small patch of sea'],
      [
        'ship/gunship',
        'gun ship: a row of cannon ports along the hull, three masts, on a small patch of sea',
      ],
    ],
  },
  {
    file: 'map-3-settlements.png',
    title: 'Settlements',
    use: 'Towns and cities on the map. Port versions are used on the coast.',
    cols: 4,
    rows: 2,
    width: 1024,
    height: 512,
    style: 'figure',
    out: 256,
    cells: [
      ['city/village', 'village: three timber-and-thatch huts and a well inside a wooden palisade'],
      [
        'city/town',
        'town: a cluster of houses with tiled roofs, a small stone tower and a low wall',
      ],
      ['city/city', 'city: stone walls with towers, many roofs, a temple'],
      ['city/metropolis', 'metropolis: big walls, domes, towers and a palace, many roofs'],
      ['city/port-village', 'fishing village: huts by a small wooden jetty with a boat'],
      ['city/port-town', 'port town: houses along a quay, a jetty and a ship'],
      ['city/port-city', 'port city: walls, a harbour with a stone quay and two ships'],
      ['city/port-metropolis', 'great port: walls, domes, a lighthouse and a busy harbour'],
    ],
  },
  {
    file: 'map-4-terrain.png',
    title: 'Terrain extras',
    use: 'Symbols the map adds to deserts, snow, tundra, jungle, marsh, sea and ice. Several variants of each so the map does not repeat.',
    cols: 8,
    rows: 4,
    width: 1024,
    height: 512,
    style: 'ink',
    out: 80,
    cells: [
      ['terrain/dune-0', 'a sand dune'],
      ['terrain/dune-1', 'two sand dunes'],
      ['terrain/dune-2', 'a long low dune'],
      ['terrain/dune-3', 'dunes with a few stones'],
      ['terrain/snowpeak-0', 'a snow-capped peak'],
      ['terrain/snowpeak-1', 'two snow-capped peaks'],
      ['terrain/snowpeak-2', 'a jagged snowy ridge'],
      ['terrain/snowpeak-3', 'a rounded snowy summit'],
      ['terrain/tundra-0', 'tufts of tundra grass'],
      ['terrain/tundra-1', 'low shrubs and a stone'],
      ['terrain/tundra-2', 'mossy hummocks'],
      ['terrain/tundra-3', 'a stunted birch'],
      ['terrain/jungle-0', 'jungle trees with broad leaves'],
      ['terrain/jungle-1', 'a tall jungle tree and ferns'],
      ['terrain/jungle-2', 'dense jungle canopy'],
      ['terrain/jungle-3', 'jungle palms and vines'],
      ['terrain/reeds-0', 'a clump of reeds'],
      ['terrain/reeds-1', 'reeds and cattails'],
      ['terrain/reeds-2', 'reeds by a little pool'],
      ['terrain/waves-0', 'small sea waves'],
      ['terrain/waves-1', 'a curling wave'],
      ['terrain/waves-2', 'three little waves'],
      ['terrain/waves-3', 'waves and a fish'],
      ['terrain/ice-0', 'a floe of sea ice'],
      ['terrain/ice-1', 'broken pack ice'],
      ['terrain/ice-2', 'a small iceberg'],
    ],
  },
];
for (const s of sheets)
  if (s.cells.length > s.cols * s.rows) throw new Error(`${s.file}: too many cells`);

const ROWS = 'ABCDEFGH';
let md = `# History Unfolded: map art

Four sheets for the map: troops by age, horsemen, civilians and ships, settlements, and the extra
terrain symbols. Today the map only has colonial figures (musketeers, pikemen, conquistadors), so
every age shows them; with these sheets each formation shows its own kind of soldier, from the
club-armed levy to the field gun. The trees, hills, mountains and marsh on the map stay as they are.

## The sheets

| Sheet | Image | Grid | Cell | Style | Background |
|---|---|---|---|---|---|
${sheets.map((s, i) => `| ${i + 1}. ${s.title} | ${s.width} × ${s.height} | ${s.cols} × ${s.rows} | ${s.width / s.cols} × ${s.height / s.rows} px | ${s.style === 'figure' ? 'painted figures' : 'ink symbols'} | ${s.style === 'figure' ? 'magenta #FF00FF' : 'cream #F3E9D2'} |`).join('\n')}

- Read each grid left to right, top to bottom (row A, then row B…). The order alone tells us which
  picture is which, so keep it exactly.
- **Figures go on flat magenta** so the cutter can remove the background without eating light
  clothes or sails. **Ink symbols go on flat cream**, like the map's paper.
- No grid lines, borders, numbers or text in the pictures. Keep every figure inside its cell with a
  little empty space around it.
- Generate **sheet 1 first** and use it as the style reference for sheets 2 and 3 ("match the style
  of the attached sheet exactly"). Attach a screenshot of our map to sheet 4 so the ink matches.
- Save each sheet in \`art/source/\` under the file name given. Then run
  \`python3 tools/cut_icon_sheets.py --map\` (or hand the files over and we cut them).

`;
for (const [n, s] of sheets.entries()) {
  const style = s.style === 'figure' ? `${FIGURE}\n${FIGURE_BG}` : `${INK}\n${INK_BG}`;
  md += `---\n\n## Sheet ${n + 1}: ${s.title}\n\nFile: \`${s.file}\` · ${s.width} × ${s.height} px · ${s.cols} × ${s.rows} cells of ${s.width / s.cols} × ${s.height / s.rows} px · ${s.use}\n\n`;
  md += `### Prompt to paste\n\n\`\`\`\nA sprite sheet for the map of a historical strategy game: ${s.title.toLowerCase()}.\n${style}\nFormat: one image, ${s.width} x ${s.height} pixels, an invisible ${s.cols} x ${s.rows} grid of equal cells (${s.width / s.cols} x ${s.height / s.rows} pixels each). One subject per cell, centred, filling about 80% of the cell, never touching or crossing a cell edge. No grid lines, borders or numbers.\nCells in reading order (row A left to right, then row B, and so on):\n`;
  for (let r = 0; r < s.rows; r++) {
    const row = Array.from({ length: s.cols }, (_, c) => s.cells[r * s.cols + c]);
    md += `Row ${ROWS[r]}: ${row.map((x, c) => `${c + 1} ${x ? x[1] : '(empty)'}`).join('; ')}.\n`;
  }
  md += `\`\`\`\n\n### Cell map\n\n| | ${Array.from({ length: s.cols }, (_, c) => c + 1).join(' | ')} |\n|${'---|'.repeat(s.cols + 1)}\n`;
  for (let r = 0; r < s.rows; r++)
    md += `| **${ROWS[r]}** | ${Array.from({ length: s.cols }, (_, c) => {
      const x = s.cells[r * s.cols + c];
      return x ? `${x[1].split(':')[0].split(',')[0]}<br>\`${x[0]}\`` : '·';
    }).join(' | ')} |\n`;
  md += '\n';
}
writeFileSync('art/MAP-SHEETS.md', md);
writeFileSync(
  'art/map-sheets.json',
  JSON.stringify(
    sheets.map(s => ({
      file: s.file,
      cols: s.cols,
      rows: s.rows,
      style: s.style === 'figure' ? 'figure' : 'emblem',
      height: s.out,
      cells: s.cells.map(c => c[0]),
    })),
    null,
    1,
  ),
);
console.log(sheets.map(s => `${s.file}: ${s.cells.length} cells`).join('\n'));
