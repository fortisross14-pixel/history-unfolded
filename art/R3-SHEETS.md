# History Unfolded: Release 3 art

Five sheets for what the game still draws with stand-ins: the culture choices, a second interface
sheet, wonders and leader portraits. They use **the same two looks as the sheets you already
made**, with the same style lines word for word, so they sit with them:

| Sheet | What | Status |
|---|---|---|
| 7. Culture choices I | the first 13 choices | ✓ done (the other 51 cells drew the wrong things) |
| **7b. Culture choices I, redo** | **the 51 choices sheet 7 missed** | **to make: below** |
| 8. Culture choices II, last techs | 47 choices and 3 techs | ✓ done |
| 9. Interface II | 48 icons | ✓ done |
| M5. Wonders | 10 wonders | ✓ done |
| M6. Leaders | 19 rulers and a raider chief | ✓ done |
| **M7. Faces for your own ruler** | **12 invented faces: 6 women, 6 men, of different ages and times** | **to make: below** |

## Rules for every sheet

- **Attach a reference.** For sheets 7–9 attach `icons-6-interface.png`; for M5 and M6 attach
  `map-1-foot.png`. Add: *"Match the style of the attached sheet exactly: line weight, wash,
  palette and scale."*
- Read each grid **left to right, top to bottom** (row A, then B…). The order alone says which
  picture is which, so keep it exactly. A cell marked *(empty)* stays plain background.
- **No grid lines, borders, numbers or text** in the picture. Nothing may touch or cross a cell edge.
- Ink emblems on **plain cream**; painted pieces on **flat magenta** (the cutter removes it).
- Save each sheet in `art/source/` under the file name given, then run
  `python3 tools/cut_icon_sheets.py` for sheets 7–9 and `python3 tools/cut_icon_sheets.py --map`
  for M5 and M6 (or hand the files over and I cut them).
- **If a sheet comes back wrong** (wrong count, merged pictures, textured background, a cell out of
  order): ask for it again with the same prompt, or ask for **one row at a time** ("a single row of
  8 cells, 1024 × 128 pixels" for emblems; "a single row of 4 cells, 1024 × 256 pixels" for
  painted pieces) and place the rows together. Do not retouch by hand.

## The style lines

**Ink emblems (sheets 7–9)**
> Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
>
> Format: one square image, 1024 x 1024 pixels, an invisible 8 x 8 grid of 64 equal square cells (128 x 128 pixels each). Keep each symbol inside its cell with about 16 pixels of empty space on every side, so no symbol touches or crosses a cell edge. Do not draw grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2) everywhere, with no texture, vignette or border.

**Painted miniatures (M5, M6)**
> Style: small painted miniatures for a historical strategy game, in the manner of a hand-coloured engraving: fine dark sepia outlines, soft watercolour shading, a warm, slightly muted palette (ochre, umber, oxblood, olive, slate blue, linen, weathered bronze, iron grey). The same scale and the same light from the top left in every cell. Clear, simple shapes that still read at 64 pixels: no fine clutter, no scenery beyond what is described. Not tied to any real nation; no real insignia, flags or religious symbols. No text, letters, numbers or labels anywhere.
>
> Background: one flat, solid, pure magenta (#FF00FF) everywhere, with no gradient, texture, floor, horizon or shadow. Nothing in the pictures is magenta.

---

## Sheet 7b: Culture choices I, redo

File: `icons-7b-culture-redo.png` · 51 of 64 cells · The 51 culture choices that sheet 7 drew wrong (Chiefdom to Seat of Empire, then Barter to Mercantilism).

### Prompt to paste

```
A sprite sheet of 51 icons for a historical strategy game: culture choices i, redo.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one square image, 1024 x 1024 pixels, an invisible 8 x 8 grid of 64 equal square cells (128 x 128 pixels each). Keep each symbol inside its cell with about 16 pixels of empty space on every side, so no symbol touches or crosses a cell edge. Do not draw grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2) everywhere, with no texture, vignette or border.
Cells in reading order (row A left to right, then row B, and so on):
Row A: 1 a feathered chief’s staff; 2 three walking sticks leaning together; 3 a horned helmet over a sword; 4 a raised open hand over a small crowd of heads; 5 a carved wooden tally stick with notches; 6 a crown under a beam of light from above; 7 two crossed war banners; 8 a laurel wreath around a bundle of rods.
Row B: 1 a curved row of stone benches; 2 a wax seal on a folded document; 3 a heavy crown on a closed fist; 4 a crown resting on an open book; 5 a long scroll with a ribbon seal; 6 a ballot urn with a pebble falling in; 7 a burial mound with a small flame above it; 8 three small idols side by side.
Row C: 1 a single ray of light from a cloud; 2 a small open shrine with several niches; 3 a tall priest’s mitre; 4 a sword crossed with a holy banner; 5 a crown and a temple roof joined; 6 a walking staff with a scallop shell; 7 two different temple roofs merging into one; 8 a shield bearing a plain cross-shaped bar (no real emblem).
Row D: 1 a closed book with a heavy iron lock; 2 a priest’s mitre above a crown; 3 a balance scale over a plain building front; 4 two hands clasped at the wrist; 5 a round shield with a simple knot pattern; 6 a farmhouse with a smoking chimney; 7 a helmet resting on a spear; 8 a field divided into strips with a boundary stone.
Row E: 1 a hammer and a chisel crossed; 2 a stepped pyramid of four layers; 3 a ladder with an arrow going up; 4 a cluster of town roofs with a tower; 5 a lord’s banner over three spears; 6 a town gate with an open key above it; 7 a hay fork and a sickle crossed; 8 a charter scroll in front of a town wall.
Row F: 1 a domed palace; 2 two arrows swapping a jar and a sack; 3 a field with a bull in front; 4 a merchant’s scale with coins; 5 a bowed figure offering a chest; 6 a stack of three stamped coins; 7 a round granary with a conical roof; 8 a merchant’s mark on a bale of cloth.
Row G: 1 a manor house behind a row of fields; 2 a pickaxe on a scroll; 3 a closed money chest with a ship on its lid; 4 (empty); 5 (empty); 6 (empty); 7 (empty); 8 (empty).
Row H: all empty.
```

### Cell map

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| **A** | a feathered chief’s staff<br>`culture/chiefdom` | three walking sticks leaning together<br>`culture/council-of-elders` | a horned helmet over a sword<br>`culture/warlord` | a raised open hand over a small crowd of heads<br>`culture/assembly` | a carved wooden tally stick with notches<br>`culture/tribal-law` | a crown under a beam of light from above<br>`culture/divine-right` | two crossed war banners<br>`culture/war-chiefs` | a laurel wreath around a bundle of rods<br>`culture/republic` |
| **B** | a curved row of stone benches<br>`culture/senate` | a wax seal on a folded document<br>`culture/court-bureaucracy` | a heavy crown on a closed fist<br>`culture/absolutism` | a crown resting on an open book<br>`culture/enlightened-despotism` | a long scroll with a ribbon seal<br>`culture/constitution` | a ballot urn with a pebble falling in<br>`culture/democracy` | a burial mound with a small flame above it<br>`culture/ancestor-spirits` | three small idols side by side<br>`culture/many-gods` |
| **C** | a single ray of light from a cloud<br>`culture/one-god` | a small open shrine with several niches<br>`culture/shrines-of-all` | a tall priest’s mitre<br>`culture/priesthood-caste` | a sword crossed with a holy banner<br>`culture/holy-war` | a crown and a temple roof joined<br>`culture/state-religion` | a walking staff with a scallop shell<br>`culture/pilgrimage` | two different temple roofs merging into one<br>`culture/syncretism` | a shield bearing a plain cross-shaped bar<br>`culture/militant-orders` |
| **D** | a closed book with a heavy iron lock<br>`culture/inquisition` | a priest’s mitre above a crown<br>`culture/theocracy` | a balance scale over a plain building front<br>`culture/secular-state` | two hands clasped at the wrist<br>`culture/kinship` | a round shield with a simple knot pattern<br>`culture/clan-society` | a farmhouse with a smoking chimney<br>`culture/household-society` | a helmet resting on a spear<br>`culture/warrior-caste` | a field divided into strips with a boundary stone<br>`culture/land-tenure` |
| **E** | a hammer and a chisel crossed<br>`culture/craft-guilds` | a stepped pyramid of four layers<br>`culture/caste-system` | a ladder with an arrow going up<br>`culture/social-mobility` | a cluster of town roofs with a tower<br>`culture/urban-life` | a lord’s banner over three spears<br>`culture/feudal-levy` | a town gate with an open key above it<br>`culture/free-cities` | a hay fork and a sickle crossed<br>`culture/peasant-communes` | a charter scroll in front of a town wall<br>`culture/city-charter` |
| **F** | a domed palace<br>`culture/seat-of-empire` | two arrows swapping a jar and a sack<br>`culture/barter` | a field with a bull in front<br>`culture/land-wealth` | a merchant’s scale with coins<br>`culture/trade-wealth` | a bowed figure offering a chest<br>`culture/tribute` | a stack of three stamped coins<br>`culture/coinage` | a round granary with a conical roof<br>`culture/granary-system` | a merchant’s mark on a bale of cloth<br>`culture/merchant-houses` |
| **G** | a manor house behind a row of fields<br>`culture/estates` | a pickaxe on a scroll<br>`culture/mining-charters` | a closed money chest with a ship on its lid<br>`culture/mercantilism` | · | · | · | · | · |
| **H** | · | · | · | · | · | · | · | · |

### Or one row at a time (recommended: the full sheet drifted last time)

Attach the delivered `icons-8-culture-2.png` as the style reference to each. Paste the prompts in order and place the seven strips one under the other (the last strip has 3 icons and 5 empty cells).

```
A strip of 8 icons for a historical strategy game, matching the style of the attached sheet exactly.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one image, 1024 x 128 pixels, an invisible row of 8 equal square cells (128 x 128 pixels each), about 16 pixels of empty space around each symbol. No grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2).
Cells left to right: 1 a feathered chief’s staff; 2 three walking sticks leaning together; 3 a horned helmet over a sword; 4 a raised open hand over a small crowd of heads; 5 a carved wooden tally stick with notches; 6 a crown under a beam of light from above; 7 two crossed war banners; 8 a laurel wreath around a bundle of rods.
Draw exactly these symbols in exactly this order; do not substitute other symbols.
```

```
A strip of 8 icons for a historical strategy game, matching the style of the attached sheet exactly.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one image, 1024 x 128 pixels, an invisible row of 8 equal square cells (128 x 128 pixels each), about 16 pixels of empty space around each symbol. No grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2).
Cells left to right: 1 a curved row of stone benches; 2 a wax seal on a folded document; 3 a heavy crown on a closed fist; 4 a crown resting on an open book; 5 a long scroll with a ribbon seal; 6 a ballot urn with a pebble falling in; 7 a burial mound with a small flame above it; 8 three small idols side by side.
Draw exactly these symbols in exactly this order; do not substitute other symbols.
```

```
A strip of 8 icons for a historical strategy game, matching the style of the attached sheet exactly.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one image, 1024 x 128 pixels, an invisible row of 8 equal square cells (128 x 128 pixels each), about 16 pixels of empty space around each symbol. No grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2).
Cells left to right: 1 a single ray of light from a cloud; 2 a small open shrine with several niches; 3 a tall priest’s mitre; 4 a sword crossed with a holy banner; 5 a crown and a temple roof joined; 6 a walking staff with a scallop shell; 7 two different temple roofs merging into one; 8 a shield bearing a plain cross-shaped bar (no real emblem).
Draw exactly these symbols in exactly this order; do not substitute other symbols.
```

```
A strip of 8 icons for a historical strategy game, matching the style of the attached sheet exactly.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one image, 1024 x 128 pixels, an invisible row of 8 equal square cells (128 x 128 pixels each), about 16 pixels of empty space around each symbol. No grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2).
Cells left to right: 1 a closed book with a heavy iron lock; 2 a priest’s mitre above a crown; 3 a balance scale over a plain building front; 4 two hands clasped at the wrist; 5 a round shield with a simple knot pattern; 6 a farmhouse with a smoking chimney; 7 a helmet resting on a spear; 8 a field divided into strips with a boundary stone.
Draw exactly these symbols in exactly this order; do not substitute other symbols.
```

```
A strip of 8 icons for a historical strategy game, matching the style of the attached sheet exactly.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one image, 1024 x 128 pixels, an invisible row of 8 equal square cells (128 x 128 pixels each), about 16 pixels of empty space around each symbol. No grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2).
Cells left to right: 1 a hammer and a chisel crossed; 2 a stepped pyramid of four layers; 3 a ladder with an arrow going up; 4 a cluster of town roofs with a tower; 5 a lord’s banner over three spears; 6 a town gate with an open key above it; 7 a hay fork and a sickle crossed; 8 a charter scroll in front of a town wall.
Draw exactly these symbols in exactly this order; do not substitute other symbols.
```

```
A strip of 8 icons for a historical strategy game, matching the style of the attached sheet exactly.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one image, 1024 x 128 pixels, an invisible row of 8 equal square cells (128 x 128 pixels each), about 16 pixels of empty space around each symbol. No grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2).
Cells left to right: 1 a domed palace; 2 two arrows swapping a jar and a sack; 3 a field with a bull in front; 4 a merchant’s scale with coins; 5 a bowed figure offering a chest; 6 a stack of three stamped coins; 7 a round granary with a conical roof; 8 a merchant’s mark on a bale of cloth.
Draw exactly these symbols in exactly this order; do not substitute other symbols.
```

```
A strip of 3 icons for a historical strategy game, matching the style of the attached sheet exactly.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one image, 1024 x 128 pixels, an invisible row of 8 equal square cells (128 x 128 pixels each), about 16 pixels of empty space around each symbol. No grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2).
Cells left to right: 1 a manor house behind a row of fields; 2 a pickaxe on a scroll; 3 a closed money chest with a ship on its lid; 4 (empty); 5 (empty); 6 (empty); 7 (empty); 8 (empty).
Draw exactly these symbols in exactly this order; do not substitute other symbols.
```

---

## Sheet 7b: Interface II

File: `icons-9-interface-2.png` · 48 of 64 cells · Chips and buttons added since the first interface sheet; empty equipment slots.

### Prompt to paste

```
A sprite sheet of 48 icons for a historical strategy game: interface ii.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one square image, 1024 x 1024 pixels, an invisible 8 x 8 grid of 64 equal square cells (128 x 128 pixels each). Keep each symbol inside its cell with about 16 pixels of empty space on every side, so no symbol touches or crosses a cell edge. Do not draw grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2) everywhere, with no texture, vignette or border.
Cells in reading order (row A left to right, then row B, and so on):
Row A: 1 a simple three-point crown; 2 a sun disc with short rays (faith); 3 a wooden crate with a lid (store); 4 a bundle of sacks and a small barrel; 5 a folded news sheet; 6 a short thick horizontal bar; 7 a soldier’s helmet; 8 a single water drop.
Row B: 1 a lower-case i in a plain circle drawn in ink; 2 a temple roof with a small flame; 3 a pyramid with a star above it; 4 a small flag on a stockade; 5 a burning torch over a broken shield; 6 two broken columns; 7 a short stretch of railway track; 8 a factory chimney with smoke.
Row C: 1 a seated figure with a scroll; 2 a ladder against a wall; 3 a sprouting seedling; 4 a house with an up arrow; 5 a scroll with a hanging seal; 6 a small altar with a flame; 7 a cracked bell; 8 a clenched fist.
Row D: 1 a sheaf of wheat with a house; 2 a coin on a balance scale; 3 a flag with an arrow pointing out; 4 a sword with a flame; 5 a balance scale level; 6 a cog and a hammer; 7 a hearth with a pot; 8 a pack saddle with sacks.
Row E: 1 a laurel wreath; 2 a rocket-shaped brass telescope pointing up; 3 a lyre inside a laurel wreath; 4 clasped hands over an olive branch; 5 a crown on a sword hilt; 6 a face in profile with a speech mark; 7 an eye with an arrow; 8 a theatre mask.
Row F: 1 a ship’s hold with crates; 2 an outline of a shield drawn with a dashed line (no shield); 3 an outline of a helmet drawn with a dashed line (no helmet); 4 an outline of a tunic drawn with a dashed line (no armour); 5 a bare footprint; 6 a boot print (on foot, no horse); 7 an empty open sack (no kit); 8 an open empty hand (unarmed).
Row G: all empty.
Row H: all empty.
```

### Cell map

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| **A** | a simple three-point crown<br>`icon/crown` | a sun disc with short rays<br>`icon/sun` | a wooden crate with a lid<br>`icon/crate` | a bundle of sacks and a small barrel<br>`icon/goods` | a folded news sheet<br>`icon/report` | a short thick horizontal bar<br>`icon/minus` | a soldier’s helmet<br>`icon/helm` | a single water drop<br>`icon/drop` |
| **B** | a lower-case i in a plain circle drawn in ink<br>`icon/info` | a temple roof with a small flame<br>`icon/faith` | a pyramid with a star above it<br>`icon/wonder` | a small flag on a stockade<br>`icon/colony` | a burning torch over a broken shield<br>`icon/raiders` | two broken columns<br>`icon/ruins` | a short stretch of railway track<br>`icon/rail` | a factory chimney with smoke<br>`icon/power` |
| **C** | a seated figure with a scroll<br>`icon/governor` | a ladder against a wall<br>`icon/siege` | a sprouting seedling<br>`icon/growth` | a house with an up arrow<br>`icon/upgrade` | a scroll with a hanging seal<br>`icon/edict` | a small altar with a flame<br>`icon/tenet` | a cracked bell<br>`icon/crisis` | a clenched fist<br>`icon/unrest` |
| **D** | a sheaf of wheat with a house<br>`icon/priority-growth` | a coin on a balance scale<br>`icon/priority-trade` | a flag with an arrow pointing out<br>`icon/priority-expand` | a sword with a flame<br>`icon/priority-war` | a balance scale level<br>`icon/priority-balanced` | a cog and a hammer<br>`icon/supply-industry` | a hearth with a pot<br>`icon/supply-homes` | a pack saddle with sacks<br>`icon/supply-army` |
| **E** | a laurel wreath<br>`icon/victory-score` | a rocket-shaped brass telescope pointing up<br>`icon/victory-science` | a lyre inside a laurel wreath<br>`icon/victory-culture` | clasped hands over an olive branch<br>`icon/victory-diplomacy` | a crown on a sword hilt<br>`icon/victory-domination` | a face in profile with a speech mark<br>`icon/opinion` | an eye with an arrow<br>`icon/intent` | a theatre mask<br>`icon/personality` |
| **F** | a ship’s hold with crates<br>`icon/ship-cargo` | an outline of a shield drawn with a dashed line<br>`item/no-shield` | an outline of a helmet drawn with a dashed line<br>`item/no-helmet` | an outline of a tunic drawn with a dashed line<br>`item/no-armour` | a bare footprint<br>`item/barefoot` | a boot print<br>`item/foot` | an empty open sack<br>`item/no-kit` | an open empty hand<br>`item/unarmed` |
| **G** | · | · | · | · | · | · | · | · |
| **H** | · | · | · | · | · | · | · | · |

### Or one row at a time (recommended: the full sheet drifted last time)

Attach the delivered `icons-8-culture-2.png` as the style reference to each. Paste the prompts in order and place the seven strips one under the other (the last strip has 3 icons and 5 empty cells).

```
A strip of 8 icons for a historical strategy game, matching the style of the attached sheet exactly.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one image, 1024 x 128 pixels, an invisible row of 8 equal square cells (128 x 128 pixels each), about 16 pixels of empty space around each symbol. No grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2).
Cells left to right: 1 a simple three-point crown; 2 a sun disc with short rays (faith); 3 a wooden crate with a lid (store); 4 a bundle of sacks and a small barrel; 5 a folded news sheet; 6 a short thick horizontal bar; 7 a soldier’s helmet; 8 a single water drop.
Draw exactly these symbols in exactly this order; do not substitute other symbols.
```

```
A strip of 8 icons for a historical strategy game, matching the style of the attached sheet exactly.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one image, 1024 x 128 pixels, an invisible row of 8 equal square cells (128 x 128 pixels each), about 16 pixels of empty space around each symbol. No grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2).
Cells left to right: 1 a lower-case i in a plain circle drawn in ink; 2 a temple roof with a small flame; 3 a pyramid with a star above it; 4 a small flag on a stockade; 5 a burning torch over a broken shield; 6 two broken columns; 7 a short stretch of railway track; 8 a factory chimney with smoke.
Draw exactly these symbols in exactly this order; do not substitute other symbols.
```

```
A strip of 8 icons for a historical strategy game, matching the style of the attached sheet exactly.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one image, 1024 x 128 pixels, an invisible row of 8 equal square cells (128 x 128 pixels each), about 16 pixels of empty space around each symbol. No grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2).
Cells left to right: 1 a seated figure with a scroll; 2 a ladder against a wall; 3 a sprouting seedling; 4 a house with an up arrow; 5 a scroll with a hanging seal; 6 a small altar with a flame; 7 a cracked bell; 8 a clenched fist.
Draw exactly these symbols in exactly this order; do not substitute other symbols.
```

```
A strip of 8 icons for a historical strategy game, matching the style of the attached sheet exactly.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one image, 1024 x 128 pixels, an invisible row of 8 equal square cells (128 x 128 pixels each), about 16 pixels of empty space around each symbol. No grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2).
Cells left to right: 1 a sheaf of wheat with a house; 2 a coin on a balance scale; 3 a flag with an arrow pointing out; 4 a sword with a flame; 5 a balance scale level; 6 a cog and a hammer; 7 a hearth with a pot; 8 a pack saddle with sacks.
Draw exactly these symbols in exactly this order; do not substitute other symbols.
```

```
A strip of 8 icons for a historical strategy game, matching the style of the attached sheet exactly.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one image, 1024 x 128 pixels, an invisible row of 8 equal square cells (128 x 128 pixels each), about 16 pixels of empty space around each symbol. No grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2).
Cells left to right: 1 a laurel wreath; 2 a rocket-shaped brass telescope pointing up; 3 a lyre inside a laurel wreath; 4 clasped hands over an olive branch; 5 a crown on a sword hilt; 6 a face in profile with a speech mark; 7 an eye with an arrow; 8 a theatre mask.
Draw exactly these symbols in exactly this order; do not substitute other symbols.
```

```
A strip of 8 icons for a historical strategy game, matching the style of the attached sheet exactly.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one image, 1024 x 128 pixels, an invisible row of 8 equal square cells (128 x 128 pixels each), about 16 pixels of empty space around each symbol. No grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2).
Cells left to right: 1 a ship’s hold with crates; 2 an outline of a shield drawn with a dashed line (no shield); 3 an outline of a helmet drawn with a dashed line (no helmet); 4 an outline of a tunic drawn with a dashed line (no armour); 5 a bare footprint; 6 a boot print (on foot, no horse); 7 an empty open sack (no kit); 8 an open empty hand (unarmed).
Draw exactly these symbols in exactly this order; do not substitute other symbols.
```

---

## Sheet M7: Faces for your own ruler

File: `map-7-faces.png` · 1024 × 768 px · 4 × 3 cells of 256 × 256 px · New game: the twelve faces a player picks from for a ruler of their own.

### Prompt to paste

```
A sprite sheet for a historical strategy game: faces for your own ruler.
Style: small painted miniatures for a historical strategy game, in the manner of a hand-coloured engraving: fine dark sepia outlines, soft watercolour shading, a warm, slightly muted palette (ochre, umber, oxblood, olive, slate blue, linen, weathered bronze, iron grey). The same scale and the same light from the top left in every cell. Clear, simple shapes that still read at 64 pixels: no fine clutter, no scenery beyond what is described. Not tied to any real nation; no real insignia, flags or religious symbols. No text, letters, numbers or labels anywhere.
Each portrait is a head-and-shoulders bust of an ordinary-looking, invented person (not anyone famous, not resembling any real ruler), three-quarter view facing right, cut off at mid-chest, with the same framing, size and eye height in every cell as the attached rulers sheet. Expressions calm and confident. Simple clothes of the stated time with no crowns, no insignia and no national symbols, so the face suits any people; where a sash, collar or cloak would carry a people’s colour, leave it plain off-white. Row A and the first two cells of row B are women; the rest are men. Mix of ages and of origins (Mediterranean, North African, West African, Near Eastern, South Asian, East Asian, Northern European, Central Asian, South American).
Background: one flat, solid, pure magenta (#FF00FF) everywhere, with no gradient, texture, floor, horizon or shadow. Nothing in the pictures is magenta.
Format: one image, 1024 x 768 pixels, an invisible 4 x 3 grid of equal cells (256 x 256 pixels each). One subject per cell, centred, filling about 80% of the cell, never touching or crossing a cell edge. No grid lines, borders or numbers.
Cells in reading order (row A left to right, then row B, and so on):
Row A: 1 a young woman of about 20 with long dark braids and a plain linen tunic (ancient); 2 a woman of about 35 with short curly black hair and a draped wool mantle (classical); 3 a woman of about 50 with grey hair in a bun and a dark hooded cloak (medieval); 4 a woman of about 30 with red-brown hair under a simple veil and a plain velvet bodice (renaissance).
Row B: 1 a woman of about 60 with white hair, a high-necked dark jacket and a small brooch (industrial); 2 a woman of about 25 with a shaved head, gold earrings and a wrap of patterned cloth (ancient); 3 a man of about 25 with a short black beard and a leather jerkin (ancient); 4 a man of about 45 with a grey-flecked beard and a plain wool cloak with a bronze pin (classical).
Row C: 1 a man of about 65 with a long white beard and a monk-like brown robe (medieval); 2 a man of about 35, clean-shaven, with shoulder-length hair and a plain doublet (renaissance); 3 a man of about 50 with a moustache, a dark frock coat and a plain cravat (industrial); 4 a man of about 30 with a shaved head, a thin beard and a quilted padded coat (medieval).
```

### Cell map

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| **A** | a young woman of about 20 with long dark braids and a plain linen tunic<br>`face/1` | a woman of about 35 with short curly black hair and a draped wool mantle<br>`face/2` | a woman of about 50 with grey hair in a bun and a dark hooded cloak<br>`face/3` | a woman of about 30 with red-brown hair under a simple veil and a plain velvet bodice<br>`face/4` |
| **B** | a woman of about 60 with white hair, a high-necked dark jacket and a small brooch<br>`face/5` | a woman of about 25 with a shaved head, gold earrings and a wrap of patterned cloth<br>`face/6` | a man of about 25 with a short black beard and a leather jerkin<br>`face/7` | a man of about 45 with a grey-flecked beard and a plain wool cloak with a bronze pin<br>`face/8` |
| **C** | a man of about 65 with a long white beard and a monk-like brown robe<br>`face/9` | a man of about 35, clean-shaven, with shoulder-length hair and a plain doublet<br>`face/10` | a man of about 50 with a moustache, a dark frock coat and a plain cravat<br>`face/11` | a man of about 30 with a shaved head, a thin beard and a quilted padded coat<br>`face/12` |

