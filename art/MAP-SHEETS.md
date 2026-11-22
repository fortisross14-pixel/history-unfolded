# History Unfolded: map art

Four sheets for the map: troops by age, horsemen, civilians and ships, settlements, and the extra
terrain symbols. Today the map only has colonial figures (musketeers, pikemen, conquistadors), so
every age shows them; with these sheets each formation shows its own kind of soldier, from the
club-armed levy to the field gun. The trees, hills, mountains and marsh on the map stay as they are.

## The sheets

| Sheet | Image | Grid | Cell | Style | Background |
|---|---|---|---|---|---|
| 1. Foot troops | 1024 × 1024 | 4 × 4 | 256 × 256 px | painted figures | magenta #FF00FF |
| 2. Horsemen, civilians and ships | 1024 × 1024 | 4 × 4 | 256 × 256 px | painted figures | magenta #FF00FF |
| 3. Settlements | 1024 × 512 | 4 × 2 | 256 × 256 px | painted figures | magenta #FF00FF |
| 4. Terrain extras | 1024 × 512 | 8 × 4 | 128 × 128 px | ink symbols | cream #F3E9D2 |

- Read each grid left to right, top to bottom (row A, then row B…). The order alone tells us which
  picture is which, so keep it exactly.
- **Figures go on flat magenta** so the cutter can remove the background without eating light
  clothes or sails. **Ink symbols go on flat cream**, like the map's paper.
- No grid lines, borders, numbers or text in the pictures. Keep every figure inside its cell with a
  little empty space around it.
- Generate **sheet 1 first** and use it as the style reference for sheets 2 and 3 ("match the style
  of the attached sheet exactly"). Attach a screenshot of our map to sheet 4 so the ink matches.
- Save each sheet in `art/source/` under the file name given. Then run
  `python3 tools/cut_icon_sheets.py --map` (or hand the files over and we cut them).

---

## Sheet 1: Foot troops

File: `map-1-foot.png` · 1024 × 1024 px · 4 × 4 cells of 256 × 256 px · Formations on the map, from the first levy to the field gun. The map picks the figure from the formation's main design.

### Prompt to paste

```
A sprite sheet for the map of a historical strategy game: foot troops.
Style: small painted miniature figures for the map of a historical strategy game, in the manner of a hand-coloured engraving: fine dark sepia outlines, soft watercolour shading, a warm, slightly muted palette (ochre, umber, oxblood, olive, slate blue, linen, weathered bronze, iron grey). Each figure stands on a small oval patch of grass and earth. Three-quarter view from slightly above, facing right, the same scale and the same light from the top left in every cell. Clear, simple silhouettes that still read at 48 pixels tall: no fine detail, no scenery. Where a flag, banner, sash or shield face would carry a people's colour, leave it plain off-white (the game paints the colour itself). Not tied to any real nation; no real insignia. No text, letters, numbers or labels anywhere.
Background: one flat, solid, pure magenta (#FF00FF) everywhere, with no gradient, texture, floor, horizon or shadow. Nothing in the figures is magenta.
Format: one image, 1024 x 1024 pixels, an invisible 4 x 4 grid of equal cells (256 x 256 pixels each). One subject per cell, centred, filling about 80% of the cell, never touching or crossing a cell edge. No grid lines, borders or numbers.
Cells in reading order (row A left to right, then row B, and so on):
Row A: 1 levy: a man in a rough tunic with a wooden club, barefoot; 2 spearman: tunic, spear held upright, round wicker shield; 3 heavy spearman: bronze helmet, bronze scale armour, large round bronze shield, spear; 4 pikeman: very long pike held upright, iron helmet, padded coat.
Row B: 1 axeman: tunic and leather cap, a broad bronze axe over the shoulder; 2 swordsman: short sword and a hide shield, leather armour; 3 heavy swordsman: iron sword, chain mail, kite shield, iron helmet; 4 plate infantry: full plate armour, closed helm, long sword.
Row C: 1 slinger: tunic, swinging a sling above the head; 2 javelin thrower: a bundle of javelins, one raised to throw; 3 archer: simple wooden bow drawn, quiver on the back; 4 longbowman: tall longbow drawn, hood.
Row D: 1 crossbowman: crossbow raised, a tall pavise shield beside him; 2 arquebusier: early matchlock gun, wide-brimmed hat; 3 musketeer: musket on the shoulder, coat and hat; 4 field gun: a small bronze cannon on wheels with one gunner.
```

### Cell map

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| **A** | levy<br>`unit/levy` | spearman<br>`unit/spearman` | heavy spearman<br>`unit/hoplite` | pikeman<br>`unit/pikeman` |
| **B** | axeman<br>`unit/axeman` | swordsman<br>`unit/swordsman` | heavy swordsman<br>`unit/heavy-swordsman` | plate infantry<br>`unit/plate-infantry` |
| **C** | slinger<br>`unit/slinger` | javelin thrower<br>`unit/javelineer` | archer<br>`unit/archer` | longbowman<br>`unit/longbowman` |
| **D** | crossbowman<br>`unit/crossbowman` | arquebusier<br>`unit/arquebusier` | musketeer<br>`unit/musketeer` | field gun<br>`unit/field-gun` |

---

## Sheet 2: Horsemen, civilians and ships

File: `map-2-horse-civil-ships.png` · 1024 × 1024 px · 4 × 4 cells of 256 × 256 px · Mounted formations, settlers, workers, engineers, and fleets at sea.

### Prompt to paste

```
A sprite sheet for the map of a historical strategy game: horsemen, civilians and ships.
Style: small painted miniature figures for the map of a historical strategy game, in the manner of a hand-coloured engraving: fine dark sepia outlines, soft watercolour shading, a warm, slightly muted palette (ochre, umber, oxblood, olive, slate blue, linen, weathered bronze, iron grey). Each figure stands on a small oval patch of grass and earth. Three-quarter view from slightly above, facing right, the same scale and the same light from the top left in every cell. Clear, simple silhouettes that still read at 48 pixels tall: no fine detail, no scenery. Where a flag, banner, sash or shield face would carry a people's colour, leave it plain off-white (the game paints the colour itself). Not tied to any real nation; no real insignia. No text, letters, numbers or labels anywhere.
Background: one flat, solid, pure magenta (#FF00FF) everywhere, with no gradient, texture, floor, horizon or shadow. Nothing in the figures is magenta.
Format: one image, 1024 x 1024 pixels, an invisible 4 x 4 grid of equal cells (256 x 256 pixels each). One subject per cell, centred, filling about 80% of the cell, never touching or crossing a cell edge. No grid lines, borders or numbers.
Cells in reading order (row A left to right, then row B, and so on):
Row A: 1 light cavalry: a rider on a plain horse with a short spear; 2 heavy cavalry: an armoured rider on a heavy horse with a sword; 3 knight: plate armour, lance raised, horse in a cloth barding; 4 horse archer: a rider drawing a short bow.
Row B: 1 scout: a walker with a cloak and a staff, looking ahead; 2 settlers: a man and a woman pulling a laden handcart; 3 workers: two labourers with a pick and a shovel; 4 engineers: a man with a surveyor's staff and a measuring chain.
Row C: 1 dugout canoe with two paddlers, on a small patch of sea; 2 small oared galley with one square sail, on a small patch of sea; 3 war galley with a bronze ram and a row of oars, on a small patch of sea; 4 longship with a striped sail and shields along the side, on a small patch of sea.
Row D: 1 cog: round hull, one square sail, castles fore and aft, on a small patch of sea; 2 carrack: three masts, high castles, on a small patch of sea; 3 galleon: three masts, full sails, on a small patch of sea; 4 gun ship: a row of cannon ports along the hull, three masts, on a small patch of sea.
```

### Cell map

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| **A** | light cavalry<br>`unit/light-cavalry` | heavy cavalry<br>`unit/heavy-cavalry` | knight<br>`unit/knight` | horse archer<br>`unit/horse-archer` |
| **B** | scout<br>`unit/scout` | settlers<br>`unit/settlers` | workers<br>`unit/workers` | engineers<br>`unit/engineers` |
| **C** | dugout canoe with two paddlers<br>`ship/dugout` | small oared galley with one square sail<br>`ship/galley` | war galley with a bronze ram and a row of oars<br>`ship/war-galley` | longship with a striped sail and shields along the side<br>`ship/longship` |
| **D** | cog<br>`ship/cog` | carrack<br>`ship/carrack` | galleon<br>`ship/galleon` | gun ship<br>`ship/gunship` |

---

## Sheet 3: Settlements

File: `map-3-settlements.png` · 1024 × 512 px · 4 × 2 cells of 256 × 256 px · Towns and cities on the map. Port versions are used on the coast.

### Prompt to paste

```
A sprite sheet for the map of a historical strategy game: settlements.
Style: small painted miniature figures for the map of a historical strategy game, in the manner of a hand-coloured engraving: fine dark sepia outlines, soft watercolour shading, a warm, slightly muted palette (ochre, umber, oxblood, olive, slate blue, linen, weathered bronze, iron grey). Each figure stands on a small oval patch of grass and earth. Three-quarter view from slightly above, facing right, the same scale and the same light from the top left in every cell. Clear, simple silhouettes that still read at 48 pixels tall: no fine detail, no scenery. Where a flag, banner, sash or shield face would carry a people's colour, leave it plain off-white (the game paints the colour itself). Not tied to any real nation; no real insignia. No text, letters, numbers or labels anywhere.
Background: one flat, solid, pure magenta (#FF00FF) everywhere, with no gradient, texture, floor, horizon or shadow. Nothing in the figures is magenta.
Format: one image, 1024 x 512 pixels, an invisible 4 x 2 grid of equal cells (256 x 256 pixels each). One subject per cell, centred, filling about 80% of the cell, never touching or crossing a cell edge. No grid lines, borders or numbers.
Cells in reading order (row A left to right, then row B, and so on):
Row A: 1 village: three timber-and-thatch huts and a well inside a wooden palisade; 2 town: a cluster of houses with tiled roofs, a small stone tower and a low wall; 3 city: stone walls with towers, many roofs, a temple; 4 metropolis: big walls, domes, towers and a palace, many roofs.
Row B: 1 fishing village: huts by a small wooden jetty with a boat; 2 port town: houses along a quay, a jetty and a ship; 3 port city: walls, a harbour with a stone quay and two ships; 4 great port: walls, domes, a lighthouse and a busy harbour.
```

### Cell map

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| **A** | village<br>`city/village` | town<br>`city/town` | city<br>`city/city` | metropolis<br>`city/metropolis` |
| **B** | fishing village<br>`city/port-village` | port town<br>`city/port-town` | port city<br>`city/port-city` | great port<br>`city/port-metropolis` |

---

## Sheet 4: Terrain extras

File: `map-4-terrain.png` · 1024 × 512 px · 8 × 4 cells of 128 × 128 px · Symbols the map adds to deserts, snow, tundra, jungle, marsh, sea and ice. Several variants of each so the map does not repeat.

### Prompt to paste

```
A sprite sheet for the map of a historical strategy game: terrain extras.
Style: map symbols drawn in dark sepia ink with a light watercolour wash on plain cream paper, like an old hand-drawn atlas, matching the trees, hills and mountains already on our map: small pictograms seen from the side, same line weight, same light from the top left. Simple and readable at 40 pixels. No text, letters, numbers or labels anywhere.
Background: one flat, plain cream paper colour (#F3E9D2) everywhere, with no texture, stains, vignette or border.
Format: one image, 1024 x 512 pixels, an invisible 8 x 4 grid of equal cells (128 x 128 pixels each). One subject per cell, centred, filling about 80% of the cell, never touching or crossing a cell edge. No grid lines, borders or numbers.
Cells in reading order (row A left to right, then row B, and so on):
Row A: 1 a sand dune; 2 two sand dunes; 3 a long low dune; 4 dunes with a few stones; 5 a snow-capped peak; 6 two snow-capped peaks; 7 a jagged snowy ridge; 8 a rounded snowy summit.
Row B: 1 tufts of tundra grass; 2 low shrubs and a stone; 3 mossy hummocks; 4 a stunted birch; 5 jungle trees with broad leaves; 6 a tall jungle tree and ferns; 7 dense jungle canopy; 8 jungle palms and vines.
Row C: 1 a clump of reeds; 2 reeds and cattails; 3 reeds by a little pool; 4 small sea waves; 5 a curling wave; 6 three little waves; 7 waves and a fish; 8 a floe of sea ice.
Row D: 1 broken pack ice; 2 a small iceberg; 3 (empty); 4 (empty); 5 (empty); 6 (empty); 7 (empty); 8 (empty).
```

### Cell map

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| **A** | a sand dune<br>`terrain/dune-0` | two sand dunes<br>`terrain/dune-1` | a long low dune<br>`terrain/dune-2` | dunes with a few stones<br>`terrain/dune-3` | a snow-capped peak<br>`terrain/snowpeak-0` | two snow-capped peaks<br>`terrain/snowpeak-1` | a jagged snowy ridge<br>`terrain/snowpeak-2` | a rounded snowy summit<br>`terrain/snowpeak-3` |
| **B** | tufts of tundra grass<br>`terrain/tundra-0` | low shrubs and a stone<br>`terrain/tundra-1` | mossy hummocks<br>`terrain/tundra-2` | a stunted birch<br>`terrain/tundra-3` | jungle trees with broad leaves<br>`terrain/jungle-0` | a tall jungle tree and ferns<br>`terrain/jungle-1` | dense jungle canopy<br>`terrain/jungle-2` | jungle palms and vines<br>`terrain/jungle-3` |
| **C** | a clump of reeds<br>`terrain/reeds-0` | reeds and cattails<br>`terrain/reeds-1` | reeds by a little pool<br>`terrain/reeds-2` | small sea waves<br>`terrain/waves-0` | a curling wave<br>`terrain/waves-1` | three little waves<br>`terrain/waves-2` | waves and a fish<br>`terrain/waves-3` | a floe of sea ice<br>`terrain/ice-0` |
| **D** | broken pack ice<br>`terrain/ice-1` | a small iceberg<br>`terrain/ice-2` | · | · | · | · | · | · |

