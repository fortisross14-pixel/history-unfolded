/**
 * The art plan: every sprite sheet the game wants, generated from the game's own data so names
 * never drift. Writes art/sheets.json (what tools/cut_sprites.py cuts) and art/PROMPTS.md (what to
 * paste into ChatGPT). Run: node --no-warnings scripts/art-plan.ts
 */
import { writeFileSync } from 'node:fs';
import { CULTURE_LIST, DOMAIN_LIST, DOMAINS, TAGS } from '../src/data/culture.ts';
import { GOODS } from '../src/data/goods.ts';
import { ITEM_LIST } from '../src/data/items.ts';
import { SLOT_TYPES } from '../src/data/slots.ts';
import { ERAS, TECH_LIST } from '../src/data/techs.ts';

type Style = 'miniature' | 'emblem' | 'ink';
interface Sheet {
  file: string;
  group: string;
  wave: 1 | 2 | 3;
  style: Style;
  cols: number;
  rows: number;
  /** output height in px for each cut sprite */
  height: number;
  title: string;
  use: string;
  /** [key, what to draw] in reading order; fewer than cols*rows leaves the last cells empty */
  items: [string, string][];
  /** extra line for the prompt */
  extra?: string;
  /** single image instead of a grid */
  whole?: { width: number; aspect: string };
}

const STYLE: Record<Style, string> = {
  miniature:
    "Style: low-poly 3D game miniatures, faceted flat-shaded polygons with crisp edges, like painted tabletop pieces. Warm, slightly muted historical palette (ochre, rust, olive, oxblood, weathered bronze, iron grey, natural linen, walnut wood) that sits well on old parchment. One soft key light from the top left, gentle shadow side, no cast shadow on the background. Clean, readable silhouettes that still read at 48 pixels tall. Every subject is shown in the same three-quarter view from slightly above, facing right, at the same scale within the sheet. Plain off-white cloth where a banner, sash or shield face would carry a people's colour (the game paints the colour itself). No text, letters, numbers, logos or labels anywhere.",
  emblem:
    "Style: hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with a light watercolour wash, like a cartographer's marginal drawing. Each icon is one bold, simple symbol centred in its cell, filling about 70% of it, readable at 32 pixels. Warm limited palette: sepia ink, ochre, muted red, faded blue, olive green on cream. No frame, no circle behind it unless asked. No text, letters, numbers or labels anywhere.",
  ink: 'Style: map symbols drawn in dark sepia ink with a light watercolour wash on plain cream paper, like an old hand-drawn atlas. Same line weight, same paper, same light from the top left as the existing map art (trees, hills, mountains drawn as small pictograms seen from the side). No text, letters, numbers or labels anywhere.',
};

const BACKGROUND: Record<Style, string> = {
  miniature:
    'Background: one flat, solid, pure magenta (#FF00FF) everywhere, with no gradient, texture, floor, horizon or shadow. Nothing in the picture is magenta.',
  emblem:
    'Background: one flat, plain cream colour (#F3E9D2) everywhere, with no texture, vignette or border.',
  ink: 'Background: one flat, plain cream paper colour (#F3E9D2) everywhere, with no texture, stains, vignette or border.',
};

const sheets: Sheet[] = [];
const add = (s: Sheet) => sheets.push(s);

// ---------------------------------------------------------------- wave 1: what the map needs most
add({
  file: 'style-seed.png',
  group: 'seed',
  wave: 1,
  style: 'miniature',
  cols: 2,
  rows: 1,
  height: 256,
  title: 'Style seed (approve this first)',
  use: 'Sets the look for every miniature. Ask for changes until you like it, then attach it to every later miniature prompt.',
  items: [
    [
      'spearman',
      'one spearman: tunic, round wooden shield, spear held upright, on a small round dark-walnut base',
    ],
    [
      'village',
      'a small village: three timber-and-thatch houses around a well, on a round grassy base',
    ],
  ],
});
add({
  file: 'units-foot.png',
  group: 'unit',
  wave: 1,
  style: 'miniature',
  cols: 4,
  rows: 3,
  height: 192,
  extra:
    'Each figure stands on the same small round dark-walnut base, the base filling the bottom of the cell.',
  title: 'Foot troops',
  use: 'Map counters and unit cards. The game picks the closest figure for each design from its weapon, armour and mount.',
  items: [
    ['levy', 'a peasant levy with a club and a wooden pitchfork, plain tunic, no armour'],
    ['spearman', 'a light spearman with a spear and a round wooden shield, padded jacket'],
    [
      'hoplite',
      'a heavy spearman: bronze helmet, bronze breastplate, large round bronze shield, long spear',
    ],
    ['pikeman', 'a pikeman holding a very long pike angled forward, steel helmet, mail shirt'],
    ['axeman', 'an axeman with a two-handed bronze axe, helmet, leather armour, no shield'],
    ['swordsman', 'a swordsman with a short sword and a hide shield, leather armour'],
    ['heavy-swordsman', 'a heavy swordsman: iron sword, kite shield, mail coat, iron helmet'],
    [
      'plate-infantry',
      'a dismounted man-at-arms in full plate armour with a great helm and a long sword',
    ],
    ['slinger', 'a slinger whirling a sling, no armour, pouch of stones'],
    ['javelineer', 'a javelin thrower about to throw, wicker shield, two spare javelins'],
    ['archer', 'an archer drawing a short bow, quiver at the hip, leather cap'],
    ['longbowman', 'a longbowman drawing a tall longbow, padded jacket, iron helmet'],
  ],
});
add({
  file: 'units-more.png',
  group: 'unit',
  wave: 1,
  style: 'miniature',
  cols: 5,
  rows: 2,
  height: 192,
  extra:
    'Each figure stands on the same small round dark-walnut base (riders and the cart on a slightly larger oval one).',
  title: 'Gunpowder, cavalry and civilians',
  use: 'Map counters and unit cards.',
  items: [
    ['crossbowman', 'a crossbowman aiming a crossbow from behind a tall standing pavise shield'],
    ['arquebusier', 'an arquebusier firing an arquebus resting on a forked stand, smoke puff'],
    ['musketeer', 'a musketeer with a musket and fixed bayonet, steel cuirass, brimmed hat'],
    ['field-gun', 'a small bronze field cannon on a two-wheeled carriage with one gunner'],
    ['light-cavalry', 'a light horseman with a spear and a small round shield on a bay horse'],
    ['heavy-cavalry', 'a heavy cavalryman in mail on a big horse, sword raised'],
    ['knight', 'an armoured knight in plate with a lance and kite shield on a barded horse'],
    ['horse-archer', 'a horse archer shooting a composite bow from the saddle at a gallop'],
    ['scout', 'a scout on foot with a walking staff, cloak and a small spyglass'],
    ['settlers', 'settlers: a family with an ox cart loaded with sacks and tools'],
  ],
});
add({
  file: 'ships.png',
  group: 'ship',
  wave: 1,
  style: 'miniature',
  cols: 4,
  rows: 2,
  height: 192,
  extra:
    'Each ship is seen from the side and a little above, sailing right, with only a thin patch of sea directly under the hull.',
  title: 'Ships',
  use: 'Fleets on the map and in the ship designer.',
  items: [
    ['dugout', 'a dugout canoe with two paddlers'],
    ['galley', 'a coastal galley with a row of oars and one square sail'],
    ['war-galley', 'a war galley with a bronze ram at the bow and a small deck platform'],
    ['longship', 'a longship with a striped square sail and shields along the side'],
    ['cog', 'a cog: tall single mast, square sail, high wooden castles at bow and stern'],
    ['carrack', 'a carrack with three masts and a high stern castle'],
    ['galleon', 'a galleon with four masts, many sails and a tall ornate stern'],
    ['gunship', 'a gun frigate with a row of open gun ports and three masts'],
  ],
});
add({
  file: 'cities.png',
  group: 'city',
  wave: 1,
  style: 'miniature',
  cols: 4,
  rows: 2,
  height: 256,
  title: 'Cities',
  use: 'City markers on the map, by size; the second row stands by the water.',
  items: [
    ['village', 'a village of a few timber houses and a palisade, on a round grassy base'],
    ['town', 'a walled town: stone church, market square, tiled roofs'],
    ['city', 'a city: stone walls with towers, a keep, many roofs'],
    ['metropolis', 'a great city: double walls, a cathedral, a palace, dense streets'],
    [
      'port-village',
      'a fishing village with a wooden jetty and two boats, on a round base half sand, half water',
    ],
    ['port-town', 'a harbour town with a stone quay, warehouses and a small lighthouse'],
    ['port-city', 'a port city with walls, docks, cranes and moored ships'],
    ['port-metropolis', 'a great port with a fortified harbour, arsenal and many ships'],
  ],
});
const goodsNeeded = [
  'stone',
  'hides',
  'copper',
  'tin',
  'iron',
  'coal',
  'saltpeter',
  'horses',
  'meat',
  'ivory',
];
add({
  file: 'goods-2.png',
  group: 'good',
  wave: 1,
  style: 'ink',
  cols: 5,
  rows: 2,
  height: 72,
  title: 'Goods icons (second set)',
  use: 'Resource icons on the map, in stores, costs and trade. Match the first goods sheet exactly.',
  items: goodsNeeded.map(
    g =>
      [
        g,
        (
          {
            stone: 'a stack of cut stone blocks',
            hides: 'a stretched animal hide',
            copper: 'copper ore nuggets, reddish',
            tin: 'grey tin ingots',
            iron: 'iron ore and an iron bar',
            coal: 'a heap of black coal lumps',
            saltpeter: 'a small sack of white saltpeter crystals',
            horses: 'a horse head in profile',
            meat: 'a ham leg',
            ivory: 'a curved elephant tusk',
          } as Record<string, string>
        )[g],
      ] as [string, string],
  ),
});
add({
  file: 'terrain-2.png',
  group: 'terrain',
  wave: 1,
  style: 'ink',
  cols: 7,
  rows: 4,
  height: 80,
  title: 'More terrain symbols',
  use: 'Map details for terrains that are now only a colour wash. Same scale as the existing trees and hills.',
  items: [
    ...[0, 1, 2, 3].map(
      i => [`dune-${i}`, 'a low sand dune with a wind ripple'] as [string, string],
    ),
    ...[0, 1, 2, 3].map(i => [`snowpeak-${i}`, 'a snow-capped mountain peak'] as [string, string]),
    ...[0, 1, 2, 3].map(
      i => [`tundra-${i}`, 'low tundra shrubs and moss tufts'] as [string, string],
    ),
    ...[0, 1, 2, 3].map(
      i =>
        [`jungle-${i}`, 'a dense jungle thicket with broad leaves and vines'] as [string, string],
    ),
    ...[0, 1, 2].map(i => [`reeds-${i}`, 'a clump of river reeds'] as [string, string]),
    ...[0, 1].map(i => [`oasis-${i}`, 'a tiny oasis: two palms by a pool'] as [string, string]),
    ...[0, 1, 2, 3].map(i => [`waves-${i}`, 'a few small stylised sea waves'] as [string, string]),
    ...[0, 1, 2].map(i => [`ice-${i}`, 'small ice floes'] as [string, string]),
  ],
});
add({
  file: 'ui-icons.png',
  group: 'icon',
  wave: 1,
  style: 'emblem',
  cols: 6,
  rows: 4,
  height: 64,
  title: 'Interface icons',
  use: 'Top bar, panels and stats (they replace the emoji now used).',
  items: [
    ['melee', 'a sword'],
    ['ranged', 'a bow with an arrow'],
    ['charge', 'a rearing horse'],
    ['protection', 'a shield'],
    ['morale', 'a raised fist holding a banner'],
    ['upkeep', 'a small coin purse'],
    ['gold', 'a stack of gold coins'],
    ['science', 'an open book with a star'],
    ['culture', 'a theatre mask and a laurel'],
    ['food', 'a sheaf of wheat'],
    ['production', 'a hammer and anvil'],
    ['housing', 'a small house'],
    ['workers', 'a pickaxe and a hoe crossed'],
    ['moves', 'a boot print'],
    ['sight', 'an eye'],
    ['war', 'two crossed swords'],
    ['peace', 'an olive branch'],
    ['pact', 'two clasped hands'],
    ['alliance', 'two interlocked rings'],
    ['trade', 'a balance scale'],
    ['research', 'an astrolabe'],
    ['designs', 'a helmet over crossed spears'],
    ['peoples', 'three standing figures'],
    ['end-turn', 'an hourglass'],
  ],
});

// ---------------------------------------------------------------- wave 2: buildings and equipment
const slotList = Object.values(SLOT_TYPES);
const chunk = <T>(xs: T[], n: number) =>
  Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
chunk(slotList, 12).forEach((part, i) =>
  add({
    file: `buildings-${i + 1}.png`,
    group: 'building',
    wave: 2,
    style: 'miniature',
    cols: 4,
    rows: 3,
    height: 128,
    extra:
      'Each building is a small diorama on the same square tile of ground, seen from above at three-quarter view.',
    title: `District buildings ${i + 1}`,
    use: 'The 3×3 district grid and the building list in the city screen.',
    items: part.map(
      t => [t.id, `${t.name.toLowerCase()}: ${t.note.replace(/\.$/, '')}`] as [string, string],
    ),
  }),
);
const gear = ITEM_LIST.filter(i => !i.empty);
chunk(gear, 12).forEach((part, i) =>
  add({
    file: `equipment-${i + 1}.png`,
    group: 'item',
    wave: 2,
    style: 'miniature',
    cols: 4,
    rows: 3,
    height: 96,
    extra:
      'Each item alone, shown like a museum object at the same angle and scale; ship parts shown as a small model of that part.',
    title: `Equipment ${i + 1}`,
    use: 'Item cards in the unit and ship designer.',
    items: part.map(
      it =>
        [
          it.id,
          `${it.naval ? 'ship part — ' : ''}${it.name.toLowerCase()}${it.note ? ` (${it.note.replace(/\.$/, '').toLowerCase()})` : ''}`,
        ] as [string, string],
    ),
  }),
);

// ---------------------------------------------------------------- wave 3: research and culture
for (let era = 1; era <= 4; era++) {
  const techs = TECH_LIST.filter(t => t.era === era);
  chunk(techs, 12).forEach((part, i) =>
    add({
      file: `techs-${ERAS[era].toLowerCase()}${i ? `-${i + 1}` : ''}.png`,
      group: 'tech',
      wave: 3,
      style: 'emblem',
      cols: 4,
      rows: Math.ceil(part.length / 4),
      height: 128,
      title: `${ERAS[era]} research`,
      use: 'Research tree cards.',
      items: part.map(t => [t.id, `${t.name}: ${t.note.replace(/\.$/, '')}`] as [string, string]),
    }),
  );
}
add({
  file: 'culture-domains.png',
  group: 'domain',
  wave: 3,
  style: 'emblem',
  cols: 3,
  rows: 3,
  height: 128,
  title: 'Culture domains',
  use: 'Domain headers in the culture web.',
  items: DOMAIN_LIST.map(
    d => [d, `${DOMAINS[d].name}: ${DOMAINS[d].note.replace(/\.$/, '')}`] as [string, string],
  ),
});
add({
  file: 'culture-tags.png',
  group: 'tag',
  wave: 3,
  style: 'emblem',
  cols: 7,
  rows: 2,
  height: 64,
  title: 'Identity tags',
  use: "Identity badges next to a people's name (each inside a small round seal).",
  items: Object.entries(TAGS).map(
    ([k, t]) =>
      [k, `${t.name}: ${t.note.replace(/\.$/, '')}, inside a small round wax seal`] as [
        string,
        string,
      ],
  ),
});
for (const d of DOMAIN_LIST) {
  const nodes = CULTURE_LIST.filter(n => n.domain === d);
  add({
    file: `culture-${d}.png`,
    group: 'culture',
    wave: 3,
    style: 'emblem',
    cols: 5,
    rows: Math.ceil(nodes.length / 5),
    height: 96,
    title: `Culture: ${DOMAINS[d].name}`,
    use: 'Culture web cards.',
    items: nodes.map(n => [n.id, `${n.name}: ${n.note.replace(/\.$/, '')}`] as [string, string]),
  });
}
for (const [key, what] of [
  ['field', 'two armies clash on open grassland: spear lines, archers behind, cavalry on a flank'],
  ['siege', 'an assault on stone city walls with ladders and a battering ram'],
  ['naval', 'two fleets of galleys and sailing ships fighting at close range'],
  ['charge', 'heavy cavalry charging into a wall of pikes'],
  ['forest', 'an ambush in a dense forest, archers among the trees'],
  ['landing', 'troops wading ashore from boats onto a beach under fire'],
] as [string, string][])
  add({
    file: `battle-${key}.png`,
    group: 'battle',
    wave: 3,
    style: 'miniature',
    cols: 1,
    rows: 1,
    height: 540,
    title: `Battle scene: ${key}`,
    use: 'Header of the battle report.',
    items: [[key, what]],
    whole: { width: 1280, aspect: 'wide landscape, about 2.4 : 1' },
  });
add({
  file: 'title.png',
  group: 'title',
  wave: 3,
  style: 'miniature',
  cols: 1,
  rows: 1,
  height: 1080,
  title: 'Title screen',
  use: 'Menu background.',
  items: [
    [
      'title',
      'a sweeping low-poly landscape seen from a hill: a river valley with a walled city, fields, a harbour with ships, mountains beyond, morning light, room in the upper third for the game title (do not write it)',
    ],
  ],
  whole: { width: 1920, aspect: 'wide landscape, 16 : 9' },
});

// ---------------------------------------------------------------- write
writeFileSync('art/sheets.json', JSON.stringify(sheets, null, 1) + '\n');

const md: string[] = [];
md.push('# Art prompts for ChatGPT', '');
md.push(
  'Generated by `scripts/art-plan.ts` from the game data, so names match the code. Re-run it after adding items, buildings, techs or culture choices.',
  '',
);
md.push('## How to use', '');
md.push(
  '1. Paste **one prompt per message** in ChatGPT, in the order below. Start with the style seed and iterate until you like it.',
);
md.push(
  '2. For every later **miniature** sheet, attach the approved style seed image and add: *"Match the attached style exactly."*',
);
md.push(
  '3. Save each image in `art/source/` under its file name (e.g. `art/source/units-foot.png`).',
);
md.push(
  '4. Cut it: `python3 tools/cut_sprites.py units-foot` (needs Pillow and numpy). The sprites land in `public/sprites/art/` and `public/sprites/art-manifest.json`; the game picks them up on reload and falls back to the current art for anything missing.',
);
md.push(
  '5. If a sheet comes back with the wrong number of items, merged items, or a textured background, ask ChatGPT to redo it with the same prompt; do not fix it by hand.',
  '',
);
md.push('Three looks, one per kind of art:', '');
md.push(
  '- **Miniatures** (units, ships, cities, buildings, equipment, battle scenes): low-poly 3D pieces on flat magenta, cut by colour.',
);
md.push(
  '- **Map ink** (terrain symbols, goods): the existing sepia ink and watercolour on cream, cut by ink.',
);
md.push('- **Emblems** (interface, research, culture): ink-and-wash symbols on cream.', '');
for (const wave of [1, 2, 3] as const) {
  const list = sheets.filter(s => s.wave === wave);
  md.push(
    `## Wave ${wave}: ${wave === 1 ? 'to begin with (map, units, ships, cities, icons)' : wave === 2 ? 'buildings and equipment' : 'research, culture, battle scenes, title'} — ${list.length} images`,
    '',
  );
  for (const s of list) {
    md.push(`### \`${s.file}\` — ${s.title}`, '');
    md.push(`*Used for:* ${s.use}`, '');
    const grid = s.whole
      ? `One single picture, ${s.whole.aspect}, filling the whole frame (this one has a full scene background, not magenta).`
      : `A strict grid of ${s.cols} column${s.cols > 1 ? 's' : ''} and ${s.rows} row${s.rows > 1 ? 's' : ''} of equal square cells (${s.cols * s.rows} cells). One subject per cell, centred, all the same size, with generous empty space around each so no two touch. No frames, lines or borders between cells.${s.items.length < s.cols * s.rows ? ` Fill the cells left to right, top to bottom; the last ${s.cols * s.rows - s.items.length} cell${s.cols * s.rows - s.items.length > 1 ? 's stay' : ' stays'} empty.` : ''}`;
    const body = [
      STYLE[s.style],
      s.whole ? '' : BACKGROUND[s.style],
      grid,
      s.extra ?? '',
      'In order:',
      s.items.map(([, w], i) => `${i + 1}. ${w}`).join(' · '),
    ].filter(Boolean);
    md.push(body.map(l => `> ${l}`).join('\n>\n'), '');
  }
}
md.push('## Not needed as images', '');
md.push(
  "Text, numbers, names, flags and people's colours stay in code. Hex tiles stay as code-drawn washes (the art adds symbols on top). Simple geometric marks (selection rings, path dots, borders) stay code-drawn.",
  '',
);
writeFileSync('art/PROMPTS.md', md.join('\n'));
const total = sheets.length,
  sprites = sheets.reduce((a, s) => a + s.items.length, 0);
console.log(`${total} images, ${sprites} sprites → art/sheets.json, art/PROMPTS.md`);
for (const w of [1, 2, 3])
  console.log(
    `  wave ${w}: ${sheets.filter(s => s.wave === w).length} images, ${sheets.filter(s => s.wave === w).reduce((a, s) => a + s.items.length, 0)} sprites`,
  );
void GOODS;
