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
| M7. Faces for your own ruler | 12 invented faces | ✓ done |

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

