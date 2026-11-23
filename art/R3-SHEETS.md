# History Unfolded: Release 3 art

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

## Sheet 7: Culture choices I

File: `icons-7-culture-1.png` · 64 of 64 cells · Culture screen: the first 64 choices (cosmology, politics, religion, society, economy, war).

### Prompt to paste

```
A sprite sheet of 64 icons for a historical strategy game: culture choices i.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one square image, 1024 x 1024 pixels, an invisible 8 x 8 grid of 64 equal square cells (128 x 128 pixels each). Keep each symbol inside its cell with about 16 pixels of empty space on every side, so no symbol touches or crosses a cell edge. Do not draw grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2) everywhere, with no texture, vignette or border.
Cells in reading order (row A left to right, then row B, and so on):
Row A: 1 a cluster of five stars joined by thin lines; 2 a sun disc above a sheaf of wheat; 3 a crescent moon above three small waves; 4 a radiant sun with a face-less disc and long rays; 5 a ring of standing stones with the sun rising in the gap; 6 a wave curling over a pebble beach; 7 a bright star over a small boat prow; 8 a crown with a sun disc above it.
Row B: 1 a quadrant measuring instrument and a star; 2 an astrolabe; 3 a hooded figure holding a crescent moon; 4 a sun with one planet on a circular orbit around it; 5 nested rings around a small globe (an armillary sphere); 6 a feathered chief’s staff; 7 three walking sticks leaning together; 8 a horned helmet over a sword.
Row C: 1 a raised open hand over a small crowd of heads; 2 a carved wooden tally stick with notches; 3 a crown under a beam of light from above; 4 two crossed war banners; 5 a laurel wreath around a bundle of rods; 6 a curved row of stone benches; 7 a wax seal on a folded document; 8 a heavy crown on a closed fist.
Row D: 1 a crown resting on an open book; 2 a long scroll with a ribbon seal; 3 a ballot urn with a pebble falling in; 4 a burial mound with a small flame above it; 5 three small idols side by side; 6 a single ray of light from a cloud; 7 a small open shrine with several niches; 8 a tall priest’s mitre.
Row E: 1 a sword crossed with a holy banner; 2 a crown and a temple roof joined; 3 a walking staff with a scallop shell; 4 two different temple roofs merging into one; 5 a shield bearing a plain cross-shaped bar (no real emblem); 6 a closed book with a heavy iron lock; 7 a priest’s mitre above a crown; 8 a balance scale over a plain building front.
Row F: 1 two hands clasped at the wrist; 2 a round shield with a simple knot pattern; 3 a farmhouse with a smoking chimney; 4 a helmet resting on a spear; 5 a field divided into strips with a boundary stone; 6 a hammer and a chisel crossed; 7 a stepped pyramid of four layers; 8 a ladder with an arrow going up.
Row G: 1 a cluster of town roofs with a tower; 2 a lord’s banner over three spears; 3 a town gate with an open key above it; 4 a hay fork and a sickle crossed; 5 a charter scroll in front of a town wall; 6 a domed palace; 7 two arrows swapping a jar and a sack; 8 a field with a bull in front.
Row H: 1 a merchant’s scale with coins; 2 a bowed figure offering a chest; 3 a stack of three stamped coins; 4 a round granary with a conical roof; 5 a merchant’s mark on a bale of cloth; 6 a manor house behind a row of fields; 7 a pickaxe on a scroll; 8 a closed money chest with a ship on its lid.
```

### Cell map

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| **A** | a cluster of five stars joined by thin lines<br>`culture/star-lore` | a sun disc above a sheaf of wheat<br>`culture/solar-calendar` | a crescent moon above three small waves<br>`culture/lunar-calendar` | a radiant sun with a face-less disc and long rays<br>`culture/sun-cult` | a ring of standing stones with the sun rising in the gap<br>`culture/monumental-astronomy` | a wave curling over a pebble beach<br>`culture/tide-lore` | a bright star over a small boat prow<br>`culture/night-navigation` | a crown with a sun disc above it<br>`culture/divine-kingship` |
| **B** | a quadrant measuring instrument and a star<br>`culture/rational-astronomy` | an astrolabe<br>`culture/celestial-navigation` | a hooded figure holding a crescent moon<br>`culture/mystic-orders` | a sun with one planet on a circular orbit around it<br>`culture/heliocentrism` | nested rings around a small globe<br>`culture/celestial-spheres` | a feathered chief’s staff<br>`culture/chiefdom` | three walking sticks leaning together<br>`culture/council-of-elders` | a horned helmet over a sword<br>`culture/warlord` |
| **C** | a raised open hand over a small crowd of heads<br>`culture/assembly` | a carved wooden tally stick with notches<br>`culture/tribal-law` | a crown under a beam of light from above<br>`culture/divine-right` | two crossed war banners<br>`culture/war-chiefs` | a laurel wreath around a bundle of rods<br>`culture/republic` | a curved row of stone benches<br>`culture/senate` | a wax seal on a folded document<br>`culture/court-bureaucracy` | a heavy crown on a closed fist<br>`culture/absolutism` |
| **D** | a crown resting on an open book<br>`culture/enlightened-despotism` | a long scroll with a ribbon seal<br>`culture/constitution` | a ballot urn with a pebble falling in<br>`culture/democracy` | a burial mound with a small flame above it<br>`culture/ancestor-spirits` | three small idols side by side<br>`culture/many-gods` | a single ray of light from a cloud<br>`culture/one-god` | a small open shrine with several niches<br>`culture/shrines-of-all` | a tall priest’s mitre<br>`culture/priesthood-caste` |
| **E** | a sword crossed with a holy banner<br>`culture/holy-war` | a crown and a temple roof joined<br>`culture/state-religion` | a walking staff with a scallop shell<br>`culture/pilgrimage` | two different temple roofs merging into one<br>`culture/syncretism` | a shield bearing a plain cross-shaped bar<br>`culture/militant-orders` | a closed book with a heavy iron lock<br>`culture/inquisition` | a priest’s mitre above a crown<br>`culture/theocracy` | a balance scale over a plain building front<br>`culture/secular-state` |
| **F** | two hands clasped at the wrist<br>`culture/kinship` | a round shield with a simple knot pattern<br>`culture/clan-society` | a farmhouse with a smoking chimney<br>`culture/household-society` | a helmet resting on a spear<br>`culture/warrior-caste` | a field divided into strips with a boundary stone<br>`culture/land-tenure` | a hammer and a chisel crossed<br>`culture/craft-guilds` | a stepped pyramid of four layers<br>`culture/caste-system` | a ladder with an arrow going up<br>`culture/social-mobility` |
| **G** | a cluster of town roofs with a tower<br>`culture/urban-life` | a lord’s banner over three spears<br>`culture/feudal-levy` | a town gate with an open key above it<br>`culture/free-cities` | a hay fork and a sickle crossed<br>`culture/peasant-communes` | a charter scroll in front of a town wall<br>`culture/city-charter` | a domed palace<br>`culture/seat-of-empire` | two arrows swapping a jar and a sack<br>`culture/barter` | a field with a bull in front<br>`culture/land-wealth` |
| **H** | a merchant’s scale with coins<br>`culture/trade-wealth` | a bowed figure offering a chest<br>`culture/tribute` | a stack of three stamped coins<br>`culture/coinage` | a round granary with a conical roof<br>`culture/granary-system` | a merchant’s mark on a bale of cloth<br>`culture/merchant-houses` | a manor house behind a row of fields<br>`culture/estates` | a pickaxe on a scroll<br>`culture/mining-charters` | a closed money chest with a ship on its lid<br>`culture/mercantilism` |

---

## Sheet 8: Culture choices II and the last techs

File: `icons-8-culture-2.png` · 50 of 64 cells · Culture screen: the remaining choices; the three late techs.

### Prompt to paste

```
A sprite sheet of 50 icons for a historical strategy game: culture choices ii and the last techs.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one square image, 1024 x 1024 pixels, an invisible 8 x 8 grid of 64 equal square cells (128 x 128 pixels each). Keep each symbol inside its cell with about 16 pixels of empty space on every side, so no symbol touches or crosses a cell edge. Do not draw grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2) everywhere, with no texture, vignette or border.
Cells in reading order (row A left to right, then row B, and so on):
Row A: 1 an open market stall with an awning; 2 a ledger with a key across it; 3 three small round shields overlapping; 4 a ram’s head; 5 three javelins in flight; 6 four round shields in a row, overlapping; 7 a galloping horse; 8 a bow with three arrows.
Row B: 1 a drum with crossed drumsticks; 2 a battering ram under a small roof; 3 a mountain peak with a spear planted on top; 4 a soldier’s helmet with a coin; 5 a plough with a spear laid across it; 6 a sword planted in a globe; 7 a fishing net with a fish; 8 a small boat close to a cliff.
Row C: 1 a ship on a wide horizon line; 2 a quay with a mooring post and rope; 3 a longship prow with a carved head; 4 a ship’s ribs on a slipway; 5 a trident over waves; 6 three ship flags tied together; 7 a spyglass over a rolled map; 8 a sextant and a book.
Row D: 1 an anchor with a crown above it; 2 an open mouth with three sound lines; 3 a reed pen and an ink pot; 4 a small harp; 5 a falling stone with a dotted arc; 6 a mortar and pestle; 7 a stack of clay tablets; 8 a small family tree with round leaves.
Row E: 1 a colonnaded school front; 2 a stone bridge arch over water; 3 a bundle of herbs tied with string; 4 a magnifying glass over a leaf; 5 a book with a candle on it; 6 a campfire with sparks; 7 an obelisk; 8 a painted clay jug with a flower pattern.
Row F: 1 a lyre with a laurel sprig; 2 two theatre masks, one smiling, one sad; 3 a bust on a plinth; 4 a purse handing coins to a paintbrush; 5 a gilded frame with a crown on top; 6 a human figure inside a circle and a square; 7 a radiant sun over a laurel wreath; 8 a domed observatory with a telescope.
Row G: 1 a telegraph pole with wires; 2 a simple early biplane; 3 (empty); 4 (empty); 5 (empty); 6 (empty); 7 (empty); 8 (empty).
Row H: all empty.
```

### Cell map

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| **A** | an open market stall with an awning<br>`culture/free-markets` | a ledger with a key across it<br>`culture/banking-families` | three small round shields overlapping<br>`culture/war-bands` | a ram’s head<br>`culture/shock-warfare` | three javelins in flight<br>`culture/skirmish-warfare` | four round shields in a row, overlapping<br>`culture/shield-wall` | a galloping horse<br>`culture/horse-culture` | a bow with three arrows<br>`culture/archery-tradition` |
| **B** | a drum with crossed drumsticks<br>`culture/drilled-ranks` | a battering ram under a small roof<br>`culture/siege-engineers` | a mountain peak with a spear planted on top<br>`culture/mountain-warfare` | a soldier’s helmet with a coin<br>`culture/professional-army` | a plough with a spear laid across it<br>`culture/citizen-militia` | a sword planted in a globe<br>`culture/conquest-doctrine` | a fishing net with a fish<br>`culture/coastal-fishing` | a small boat close to a cliff<br>`culture/coast-huggers` |
| **C** | a ship on a wide horizon line<br>`culture/open-sea` | a quay with a mooring post and rope<br>`culture/harbour-towns` | a longship prow with a carved head<br>`culture/sea-raiders` | a ship’s ribs on a slipway<br>`culture/shipwrights` | a trident over waves<br>`culture/thalassocracy` | three ship flags tied together<br>`culture/trade-leagues` | a spyglass over a rolled map<br>`culture/explorers` | a sextant and a book<br>`culture/navigation-schools` |
| **D** | an anchor with a crown above it<br>`culture/admiralty` | an open mouth with three sound lines<br>`culture/oral-tradition` | a reed pen and an ink pot<br>`culture/scribes` | a small harp<br>`culture/bards` | a falling stone with a dotted arc<br>`culture/natural-philosophy` | a mortar and pestle<br>`culture/medicine` | a stack of clay tablets<br>`culture/record-keeping` | a small family tree with round leaves<br>`culture/genealogies` |
| **E** | a colonnaded school front<br>`culture/academies` | a stone bridge arch over water<br>`culture/engineering-tradition` | a bundle of herbs tied with string<br>`culture/herbalism` | a magnifying glass over a leaf<br>`culture/empiricism` | a book with a candle on it<br>`culture/scholasticism` | a campfire with sparks<br>`culture/storytelling` | an obelisk<br>`culture/grand-monuments` | a painted clay jug with a flower pattern<br>`culture/folk-arts` |
| **F** | a lyre with a laurel sprig<br>`culture/epic-poetry` | two theatre masks, one smiling, one sad<br>`culture/theatre` | a bust on a plinth<br>`culture/sculpture` | a purse handing coins to a paintbrush<br>`culture/patronage` | a gilded frame with a crown on top<br>`culture/court-arts` | a human figure inside a circle and a square<br>`culture/humanism` | a radiant sun over a laurel wreath<br>`culture/golden-age` | a domed observatory with a telescope<br>`tech/great-observatory` |
| **G** | a telegraph pole with wires<br>`tech/transcontinental-telegraph` | a simple early biplane<br>`tech/powered-flight` | · | · | · | · | · | · |
| **H** | · | · | · | · | · | · | · | · |

---

## Sheet 9: Interface II

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

---

## Sheet M5: Wonders

File: `map-5-wonders.png` · 1024 × 768 px · 4 × 3 cells of 256 × 256 px · Wonder cards in the Cities & wonders screen and the wonder-complete notice.

### Prompt to paste

```
A sprite sheet for a historical strategy game: wonders.
Style: small painted miniatures for a historical strategy game, in the manner of a hand-coloured engraving: fine dark sepia outlines, soft watercolour shading, a warm, slightly muted palette (ochre, umber, oxblood, olive, slate blue, linen, weathered bronze, iron grey). The same scale and the same light from the top left in every cell. Clear, simple shapes that still read at 64 pixels: no fine clutter, no scenery beyond what is described. Not tied to any real nation; no real insignia, flags or religious symbols. No text, letters, numbers or labels anywhere.
Each wonder stands on a small irregular patch of earth and grass, seen from slightly above in three-quarter view, the whole building inside the cell.
Background: one flat, solid, pure magenta (#FF00FF) everywhere, with no gradient, texture, floor, horizon or shadow. Nothing in the pictures is magenta.
Format: one image, 1024 x 768 pixels, an invisible 4 x 3 grid of equal cells (256 x 256 pixels each). One subject per cell, centred, filling about 80% of the cell, never touching or crossing a cell edge. No grid lines, borders or numbers.
Cells in reading order (row A left to right, then row B, and so on):
Row A: 1 a great stepped stone pyramid in warm sandstone, a small ramp at its foot; 2 terraced brick gardens on three levels, palms and vines spilling over the edges; 3 a colonnaded library hall with scroll shelves visible between columns; 4 a long stone wall with two square towers snaking over a hill.
Row B: 1 a large domed temple with a lantern on top and two small towers; 2 a covered market of many small domes with striped awnings; 3 a timber-framed print house with a large press seen through the door; 4 a stone admiralty building on a quay with a ship moored beside it.
Row C: 1 a great glass-and-iron exhibition hall with an arched roof; 2 a grand brick railway station with a clock tower and an arched train shed; 3 (empty); 4 (empty).
```

### Cell map

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| **A** | a great stepped stone pyramid in warm sandstone, a small ramp at its foot<br>`wonder/great-pyramid` | terraced brick gardens on three levels, palms and vines spilling over the edges<br>`wonder/hanging-gardens` | a colonnaded library hall with scroll shelves visible between columns<br>`wonder/great-library` | a long stone wall with two square towers snaking over a hill<br>`wonder/great-wall` |
| **B** | a large domed temple with a lantern on top and two small towers<br>`wonder/dome-of-heaven` | a covered market of many small domes with striped awnings<br>`wonder/grand-bazaar` | a timber-framed print house with a large press seen through the door<br>`wonder/house-of-printing` | a stone admiralty building on a quay with a ship moored beside it<br>`wonder/admiralty` |
| **C** | a great glass-and-iron exhibition hall with an arched roof<br>`wonder/crystal-palace` | a grand brick railway station with a clock tower and an arched train shed<br>`wonder/grand-terminus` | · | · |

---

## Sheet M6: Leaders

File: `map-6-leaders.png` · 1024 × 1024 px · 4 × 4 cells of 256 × 256 px · Diplomacy: each people shows a ruler of its age; the raider chief for raiders.

### Prompt to paste

```
A sprite sheet for a historical strategy game: leaders.
Style: small painted miniatures for a historical strategy game, in the manner of a hand-coloured engraving: fine dark sepia outlines, soft watercolour shading, a warm, slightly muted palette (ochre, umber, oxblood, olive, slate blue, linen, weathered bronze, iron grey). The same scale and the same light from the top left in every cell. Clear, simple shapes that still read at 64 pixels: no fine clutter, no scenery beyond what is described. Not tied to any real nation; no real insignia, flags or religious symbols. No text, letters, numbers or labels anywhere.
Each portrait is a head-and-shoulders bust in three-quarter view facing right, cut off at mid-chest with a soft vignette fading to the background, no frame. Fictional people, not any real historical figure. Where a sash, collar or cloak would carry a people’s colour, leave it plain off-white.
Background: one flat, solid, pure magenta (#FF00FF) everywhere, with no gradient, texture, floor, horizon or shadow. Nothing in the pictures is magenta.
Format: one image, 1024 x 1024 pixels, an invisible 4 x 4 grid of equal cells (256 x 256 pixels each). One subject per cell, centred, filling about 80% of the cell, never touching or crossing a cell edge. No grid lines, borders or numbers.
Cells in reading order (row A left to right, then row B, and so on):
Row A: 1 an old chieftain with a grey beard, a fur cloak and a bronze torc; 2 a young queen with braided hair, a linen robe and a gold diadem; 3 a priest-king with a shaved head and a tall white crown; 4 a bearded statesman in a draped toga-like robe with a laurel wreath.
Row B: 1 a stern general with a crested bronze helmet tucked under his arm; 2 a philosopher-queen with curled hair and a simple circlet; 3 a crowned king with a short beard, a fur-lined mantle and a sceptre; 4 an abbess-ruler in a dark wimple with a heavy pendant.
Row C: 1 a warlord in a mail coif with a scar across his cheek; 2 a merchant prince in a velvet cap and a high-collared doublet; 3 a queen in a wide lace ruff with pearls; 4 a scholar-duke with spectacles, a dark robe and a gold chain.
Row D: 1 a statesman with side whiskers, a frock coat and a cravat; 2 a woman president in a high-necked dark dress with a brooch; 3 a general in a buttoned uniform coat with epaulettes and a moustache; 4 a raider chief with a wild beard, a wolf-pelt hood and face paint.
```

### Cell map

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| **A** | an old chieftain with a grey beard, a fur cloak and a bronze torc<br>`leader/ancient-1` | a young queen with braided hair, a linen robe and a gold diadem<br>`leader/ancient-2` | a priest-king with a shaved head and a tall white crown<br>`leader/ancient-3` | a bearded statesman in a draped toga-like robe with a laurel wreath<br>`leader/classical-1` |
| **B** | a stern general with a crested bronze helmet tucked under his arm<br>`leader/classical-2` | a philosopher-queen with curled hair and a simple circlet<br>`leader/classical-3` | a crowned king with a short beard, a fur-lined mantle and a sceptre<br>`leader/medieval-1` | an abbess-ruler in a dark wimple with a heavy pendant<br>`leader/medieval-2` |
| **C** | a warlord in a mail coif with a scar across his cheek<br>`leader/medieval-3` | a merchant prince in a velvet cap and a high-collared doublet<br>`leader/renaissance-1` | a queen in a wide lace ruff with pearls<br>`leader/renaissance-2` | a scholar-duke with spectacles, a dark robe and a gold chain<br>`leader/renaissance-3` |
| **D** | a statesman with side whiskers, a frock coat and a cravat<br>`leader/industrial-1` | a woman president in a high-necked dark dress with a brooch<br>`leader/industrial-2` | a general in a buttoned uniform coat with epaulettes and a moustache<br>`leader/industrial-3` | a raider chief with a wild beard, a wolf-pelt hood and face paint<br>`leader/raider` |

