# History Unfolded: icon sheets

Six sheets of simple icons for the new Ivory Codex interface. Each sheet is **one 1024 × 1024
image** holding an **8 × 8 grid of 64 icons** (128 × 128 px per cell). They are small, flat icons, not
illustrations: sepia ink and one light wash, so they sit with the map's hand-drawn symbols and the
ivory panels.

## How the grid works

```
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
```

- Rows are **A to H**, columns **1 to 8**. Cell **C5** is row 3, column 5.
- The background is flat cream (**#F3E9D2**). Our cutter (`tools/cut_sprites.py`) lifts the ink off
  the paper, so do not ask for transparency, and keep the cream plain.
- No grid lines, numbers or text in the picture. The order alone tells us which icon is which.
- A cell marked *(empty)* stays blank cream.
- Save each sheet under the file name given, in `art/source/`.
- The keys in the cell maps (`tech/archery`, `icon/gold`, `item/spear`…) are the names the
  game already looks up, so cut icons appear in the interface without code changes.

## The same two lines go into every prompt

**Style**
> Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.

**Format**
> Format: one square image, 1024 x 1024 pixels, an invisible 8 x 8 grid of 64 equal square cells (128 x 128 pixels each). Keep each symbol inside its cell with about 16 pixels of empty space on every side, so no symbol touches or crosses a cell edge. Do not draw grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2) everywhere, with no texture, vignette or border.

## If the generator struggles

- 64 icons in one picture is a lot. If symbols come out wrong or uneven, ask for **one row of 8 at a
  time** (same prompt, "a single row of 8 cells, 1024 × 128 pixels"), or **a quarter of the sheet**
  (4 × 4 cells, 512 × 512 pixels) and place the pieces together.
- Generate the **Interface** sheet first and use it as the style reference for all the others
  ("match the style of the attached sheet exactly").
- Small differences in the grid are fine: the cutter finds the gaps between icons.

---

## Sheet 1: Techs I

File: `icons-1-techs.png` · 64 of 64 cells used · Research tree nodes and the research tracker.

### Prompt to paste

```
A sprite sheet of 64 icons for a historical strategy game: techs i.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one square image, 1024 x 1024 pixels, an invisible 8 x 8 grid of 64 equal square cells (128 x 128 pixels each). Keep each symbol inside its cell with about 16 pixels of empty space on every side, so no symbol touches or crosses a cell edge. Do not draw grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2) everywhere, with no texture, vignette or border.
Cells in reading order (row A left to right, then row B, and so on):
Row A: 1 Mysticism: a crescent moon over a standing stone; 2 Tanning: a stretched hide on a frame; 3 Pottery: a clay pot; 4 Mining: a pickaxe; 5 Animal Husbandry: a goat and a crook; 6 Archery: a bow and arrow; 7 Masonry: a stack of cut stones and a chisel; 8 Sailing: a small sail.
Row B: 1 Writing: a quill and a clay tablet; 2 Irrigation: a water channel through a field; 3 The Wheel: a spoked wooden wheel; 4 Horseback Riding: a horse head with a bridle; 5 Bronze Working: a bronze ingot and tongs; 6 Classical Age: a column capital; 7 Iron Working: an anvil with a hot iron bar; 8 Currency: a stamped coin.
Row C: 1 Mathematics: a compass and a triangle; 2 Construction: a stone arch; 3 Carpentry: a saw and a plank; 4 Priesthood: a smoking incense bowl; 5 Literature: an open book; 6 Philosophy: a seated thinker with a scroll; 7 Code of Laws: a stone tablet of laws; 8 Bowyery: a long curved bow being strung.
Row D: 1 Mail Making: a patch of chain mail; 2 Drill: two spears held crossed in rank; 3 Selective Breeding: a ram with a ribbon; 4 Engineering: a crane with a pulley; 5 Siegecraft: a catapult; 6 Navigation: a star and a ship's wheel; 7 Medieval Age: a castle tower; 8 Feudalism: a crown over a sheaf of wheat.
Row E: 1 Mechanics: two meshing gears; 2 Chivalry: a knight's helm with a plume; 3 Theology: a bell tower; 4 Education: a mortarboard cap on a book; 5 Guilds: a hammer and a key crossed; 6 Administration: a seal and a ledger; 7 Mineralogy: a crystal and a lump of ore; 8 Armour Smithing: a breastplate on an anvil.
Row F: 1 Pike Tactics: three pikes leaning forward; 2 Yeomanry: a longbow and a hood; 3 Castles: a castle gate with a portcullis; 4 Urbanism: a row of town houses; 5 Alchemy: a round flask with bubbles; 6 Compass: a magnetic compass; 7 Renaissance Age: a compass rose; 8 Gunpowder: a powder keg.
Row G: 1 Printing Press: a printing press; 2 Banking: a money chest with a key; 3 Astronomy: a telescope and a star; 4 Metallurgy: molten metal pouring from a crucible; 5 Musketry: a musket; 6 Artillery: a cannon on wheels; 7 Conscription: a drum and a list; 8 Professional Officers: an officer's sword and epaulette.
Row H: 1 Scientific Method: a balance and a magnifier; 2 Joint-Stock Companies: a share certificate with a seal; 3 Cartography: a rolled map and dividers; 4 Star Forts: a star-shaped fort seen from above; 5 Industrial Age: a cogwheel; 6 Steam Power: a steam engine with a smoking chimney; 7 Railways: a short stretch of rails; 8 Machine Tools: a lathe.
```

### Cell map

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| **A** | Mysticism<br>`tech/mysticism` | Tanning<br>`tech/tanning` | Pottery<br>`tech/pottery` | Mining<br>`tech/mining` | Animal Husbandry<br>`tech/animal-husbandry` | Archery<br>`tech/archery` | Masonry<br>`tech/masonry` | Sailing<br>`tech/sailing` |
| **B** | Writing<br>`tech/writing` | Irrigation<br>`tech/irrigation` | The Wheel<br>`tech/the-wheel` | Horseback Riding<br>`tech/horseback-riding` | Bronze Working<br>`tech/bronze-working` | Classical Age<br>`tech/classical-age` | Iron Working<br>`tech/iron-working` | Currency<br>`tech/currency` |
| **C** | Mathematics<br>`tech/mathematics` | Construction<br>`tech/construction` | Carpentry<br>`tech/carpentry` | Priesthood<br>`tech/priesthood` | Literature<br>`tech/literature` | Philosophy<br>`tech/philosophy` | Code of Laws<br>`tech/law` | Bowyery<br>`tech/bowyery` |
| **D** | Mail Making<br>`tech/mail-making` | Drill<br>`tech/drill` | Selective Breeding<br>`tech/selective-breeding` | Engineering<br>`tech/engineering` | Siegecraft<br>`tech/siegecraft` | Navigation<br>`tech/navigation` | Medieval Age<br>`tech/medieval-age` | Feudalism<br>`tech/feudalism` |
| **E** | Mechanics<br>`tech/mechanics` | Chivalry<br>`tech/chivalry` | Theology<br>`tech/theology` | Education<br>`tech/education` | Guilds<br>`tech/guilds` | Administration<br>`tech/administration` | Mineralogy<br>`tech/mineralogy` | Armour Smithing<br>`tech/armour-smithing` |
| **F** | Pike Tactics<br>`tech/pike-tactics` | Yeomanry<br>`tech/yeomanry` | Castles<br>`tech/castles` | Urbanism<br>`tech/urbanism` | Alchemy<br>`tech/alchemy` | Compass<br>`tech/compass` | Renaissance Age<br>`tech/renaissance-age` | Gunpowder<br>`tech/gunpowder` |
| **G** | Printing Press<br>`tech/printing` | Banking<br>`tech/banking` | Astronomy<br>`tech/astronomy` | Metallurgy<br>`tech/metallurgy` | Musketry<br>`tech/musketry` | Artillery<br>`tech/artillery` | Conscription<br>`tech/conscription` | Professional Officers<br>`tech/officer-corps` |
| **H** | Scientific Method<br>`tech/scientific-method` | Joint-Stock Companies<br>`tech/joint-stock` | Cartography<br>`tech/cartography` | Star Forts<br>`tech/star-forts` | Industrial Age<br>`tech/industrial-age` | Steam Power<br>`tech/steam-power` | Railways<br>`tech/railways` | Machine Tools<br>`tech/machine-tools` |

---

## Sheet 2: Techs II, ages, culture and map badges

File: `icons-2-techs-culture-map.png` · 64 of 64 cells used · The last techs, age seals in the research tabs, culture domains and identities, map resource badges.

### Prompt to paste

```
A sprite sheet of 64 icons for a historical strategy game: techs ii, ages, culture and map badges.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one square image, 1024 x 1024 pixels, an invisible 8 x 8 grid of 64 equal square cells (128 x 128 pixels each). Keep each symbol inside its cell with about 16 pixels of empty space on every side, so no symbol touches or crosses a cell edge. Do not draw grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2) everywhere, with no texture, vignette or border.
Cells in reading order (row A left to right, then row B, and so on):
Row A: 1 Food Preservation: a sealed tin can; 2 Oil Drilling: an oil derrick; 3 Rifling: a rifle barrel with a spiral groove; 4 Electricity: a lightning bolt over a coil; 5 Ancient age seal (a round seal with a small standing stone); 6 Classical age seal (a round seal with a small column capital); 7 Medieval age seal (a round seal with a small castle tower); 8 Renaissance age seal (a round seal with a small compass rose).
Row B: 1 Industrial age seal (a round seal with a small cogwheel); 2 Cosmology (culture): the sun and moon together; 3 Politics (culture): a throne; 4 Religion (culture): a temple roof; 5 Society (culture): a family of three figures; 6 Economy (culture): a balance scale; 7 War (culture): a helmet and a spear; 8 Seafaring (culture): an anchor.
Row C: 1 Knowledge (culture): an open book and a lamp; 2 Arts (culture): a lyre and a laurel; 3 Solar (identity): a radiant sun; 4 Lunar (identity): a crescent moon; 5 Maritime (identity): a wave and a ship; 6 Rationalist (identity): a pair of dividers; 7 Devout (identity): praying hands; 8 Zealous (identity): a burning torch.
Row D: 1 Tolerant (identity): two open hands; 2 Absolutist (identity): a crown and a sceptre; 3 Republican (identity): a voting urn; 4 Martial (identity): crossed swords and a shield; 5 Mercantile (identity): a sack of coins; 6 Agrarian (identity): a plough; 7 Artistic (identity): a paintbrush and a mask; 8 Expansionist (identity): a flag planted on new land.
Row E: 1 hills; 2 mountain peaks; 3 forest; 4 jungle palms; 5 marsh reeds; 6 wheat (resource); 7 rice (resource); 8 fish (resource).
Row F: 1 pigs (resource); 2 cattle (resource); 3 sheep (resource); 4 game (resource); 5 horses (resource); 6 stone (resource); 7 copper (resource); 8 tin (resource).
Row G: 1 iron (resource); 2 coal (resource); 3 saltpeter (resource); 4 ivory (resource); 5 furs (resource); 6 gold (resource); 7 silver (resource); 8 spices (resource).
Row H: 1 silk (resource); 2 dyes (resource); 3 wine (resource); 4 sugar (resource); 5 whales (resource); 6 pearls (resource); 7 salt (resource); 8 oil (resource).
```

### Cell map

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| **A** | Food Preservation<br>`tech/preservation` | Oil Drilling<br>`tech/oil-drilling` | Rifling<br>`tech/rifling` | Electricity<br>`tech/electricity` | Ancient age seal<br>`era/ancient` | Classical age seal<br>`era/classical` | Medieval age seal<br>`era/medieval` | Renaissance age seal<br>`era/renaissance` |
| **B** | Industrial age seal<br>`era/industrial` | Cosmology<br>`domain/cosmology` | Politics<br>`domain/politics` | Religion<br>`domain/religion` | Society<br>`domain/society` | Economy<br>`domain/economy` | War<br>`domain/war` | Seafaring<br>`domain/seafaring` |
| **C** | Knowledge<br>`domain/knowledge` | Arts<br>`domain/arts` | Solar<br>`tag/solar` | Lunar<br>`tag/lunar` | Maritime<br>`tag/maritime` | Rationalist<br>`tag/rationalist` | Devout<br>`tag/devout` | Zealous<br>`tag/zealous` |
| **D** | Tolerant<br>`tag/tolerant` | Absolutist<br>`tag/absolutist` | Republican<br>`tag/republican` | Martial<br>`tag/martial` | Mercantile<br>`tag/mercantile` | Agrarian<br>`tag/agrarian` | Artistic<br>`tag/artistic` | Expansionist<br>`tag/expansionist` |
| **E** | hills<br>`badge/hills` | mountain peaks<br>`badge/mountains` | forest<br>`badge/forest` | jungle palms<br>`badge/jungle` | marsh reeds<br>`badge/marsh` | wheat<br>`deposit/wheat` | rice<br>`deposit/rice` | fish<br>`deposit/fish` |
| **F** | pigs<br>`deposit/pigs` | cattle<br>`deposit/cattle` | sheep<br>`deposit/sheep` | game<br>`deposit/game` | horses<br>`deposit/horses` | stone<br>`deposit/stone` | copper<br>`deposit/copper` | tin<br>`deposit/tin` |
| **G** | iron<br>`deposit/iron` | coal<br>`deposit/coal` | saltpeter<br>`deposit/saltpeter` | ivory<br>`deposit/ivory` | furs<br>`deposit/furs` | gold<br>`deposit/gold` | silver<br>`deposit/silver` | spices<br>`deposit/spices` |
| **H** | silk<br>`deposit/silk` | dyes<br>`deposit/dyes` | wine<br>`deposit/wine` | sugar<br>`deposit/sugar` | whales<br>`deposit/whales` | pearls<br>`deposit/pearls` | salt<br>`deposit/salt` | oil<br>`deposit/oil` |

---

## Sheet 3: Equipment

File: `icons-3-equipment.png` · 64 of 64 cells used · Unit designer slots and cohort gear.

### Prompt to paste

```
A sprite sheet of 64 icons for a historical strategy game: equipment.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one square image, 1024 x 1024 pixels, an invisible 8 x 8 grid of 64 equal square cells (128 x 128 pixels each). Keep each symbol inside its cell with about 16 pixels of empty space on every side, so no symbol touches or crosses a cell edge. Do not draw grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2) everywhere, with no texture, vignette or border.
Cells in reading order (row A left to right, then row B, and so on):
Row A: 1 Improvised weapons (weapon); 2 Sling (weapon); 3 Javelins (weapon); 4 Spear (weapon); 5 Bow (weapon); 6 Bronze axe (weapon); 7 Bronze sword (weapon); 8 Wicker shield (shield).
Row B: 1 Hide shield (shield); 2 Bronze shield (shield); 3 Leather cap (helmet); 4 Bronze helmet (helmet); 5 Padded jacket (armour); 6 Leather armour (armour); 7 Bronze scale (armour); 8 Ivory lamellar (armour).
Row C: 1 Sandals (boots); 2 Marching boots (boots); 3 Horse (mount); 4 Scouting gear (kit); 5 War banner (kit); 6 Field medics (kit); 7 Iron sword (weapon); 8 Composite bow (weapon).
Row D: 1 Longbow (weapon); 2 Crossbow (weapon); 3 Pike (weapon); 4 Lance (weapon); 5 Arquebus (weapon); 6 Musket (weapon); 7 Field gun (weapon); 8 Rifle (weapon).
Row E: 1 Kite shield (shield); 2 Pavise (shield); 3 Iron helmet (helmet); 4 Great helm (helmet); 5 Chain mail (armour); 6 Plate armour (armour); 7 Cuirass (armour); 8 Hobnailed boots (boots).
Row F: 1 Heavy horse (mount); 2 Barded horse (mount); 3 Siege ladders (kit); 4 Bayonet (kit); 5 Ram (weapon); 6 Boarding crew (weapon); 7 Deck archers (weapon); 8 Ballista (weapon).
Row G: 1 Deck guns (weapon); 2 Broadside (weapon); 3 Dugout canoe (armour); 4 Galley (armour); 5 Longship (armour); 6 Cog (armour); 7 Carrack (armour); 8 Galleon (armour).
Row H: 1 Oars (mount); 2 Square sail (mount); 3 Lateen sail (mount); 4 Full rig (mount); 5 Open deck (kit); 6 Troop deck (kit); 7 Marines (kit); 8 Crow's nest (kit).
```

### Cell map

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| **A** | Improvised weapons<br>`item/improvised` | Sling<br>`item/sling` | Javelins<br>`item/javelins` | Spear<br>`item/spear` | Bow<br>`item/bow` | Bronze axe<br>`item/axe` | Bronze sword<br>`item/bronze-sword` | Wicker shield<br>`item/wicker-shield` |
| **B** | Hide shield<br>`item/hide-shield` | Bronze shield<br>`item/bronze-shield` | Leather cap<br>`item/leather-cap` | Bronze helmet<br>`item/bronze-helmet` | Padded jacket<br>`item/padded` | Leather armour<br>`item/leather` | Bronze scale<br>`item/bronze-scale` | Ivory lamellar<br>`item/ivory-lamellar` |
| **C** | Sandals<br>`item/sandals` | Marching boots<br>`item/marching-boots` | Horse<br>`item/horse` | Scouting gear<br>`item/scouting-gear` | War banner<br>`item/war-banner` | Field medics<br>`item/field-medics` | Iron sword<br>`item/iron-sword` | Composite bow<br>`item/composite-bow` |
| **D** | Longbow<br>`item/longbow` | Crossbow<br>`item/crossbow` | Pike<br>`item/pike` | Lance<br>`item/lance` | Arquebus<br>`item/arquebus` | Musket<br>`item/musket` | Field gun<br>`item/field-gun` | Rifle<br>`item/rifle` |
| **E** | Kite shield<br>`item/kite-shield` | Pavise<br>`item/pavise` | Iron helmet<br>`item/iron-helmet` | Great helm<br>`item/great-helm` | Chain mail<br>`item/chain-mail` | Plate armour<br>`item/plate-armour` | Cuirass<br>`item/cuirass` | Hobnailed boots<br>`item/hobnailed-boots` |
| **F** | Heavy horse<br>`item/heavy-horse` | Barded horse<br>`item/barded-horse` | Siege ladders<br>`item/siege-ladders` | Bayonet<br>`item/bayonet` | Ram<br>`item/ram` | Boarding crew<br>`item/boarding-crew` | Deck archers<br>`item/deck-archers` | Ballista<br>`item/ballista` |
| **G** | Deck guns<br>`item/deck-guns` | Broadside<br>`item/broadside` | Dugout canoe<br>`item/dugout` | Galley<br>`item/galley-hull` | Longship<br>`item/longship` | Cog<br>`item/cog` | Carrack<br>`item/carrack` | Galleon<br>`item/galleon` |
| **H** | Oars<br>`item/oars` | Square sail<br>`item/square-sail` | Lateen sail<br>`item/lateen-sail` | Full rig<br>`item/full-rig` | Open deck<br>`item/open-deck` | Troop deck<br>`item/troop-deck` | Marines<br>`item/marines` | Crow's nest<br>`item/lookout` |

---

## Sheet 4: Buildings and settlements

File: `icons-4-buildings.png` · 64 of 64 cells used · District build picker, city panel, tooltips.

### Prompt to paste

```
A sprite sheet of 64 icons for a historical strategy game: buildings and settlements.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one square image, 1024 x 1024 pixels, an invisible 8 x 8 grid of 64 equal square cells (128 x 128 pixels each). Keep each symbol inside its cell with about 16 pixels of empty space on every side, so no symbol touches or crosses a cell edge. Do not draw grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2) everywhere, with no texture, vignette or border.
Cells in reading order (row A left to right, then row B, and so on):
Row A: 1 Town hall; 2 Farm; 3 Pasture; 4 Plantation; 5 Fishing boats; 6 Granary; 7 Windmill; 8 Food packaging.
Row B: 1 Woodcutter; 2 Hunting lodge; 3 Lumber mill; 4 Steam sawmill; 5 Mine; 6 Pumping station; 7 Infirmary; 8 School.
Row C: 1 University; 2 Observatory; 3 Library; 4 Research lab; 5 Shrine; 6 Monument; 7 Temple; 8 Cathedral.
Row D: 1 Amphitheatre; 2 Printing house; 3 City walls; 4 Castle; 5 Market; 6 Bank; 7 Mint; 8 Harbour.
Row E: 1 Guild hall; 2 Stock exchange; 3 Workshop; 4 Smithy; 5 Tannery; 6 Weaver; 7 Foundry; 8 Factory.
Row F: 1 Armoury; 2 Barracks; 3 Shipyard; 4 Engineers' lodge; 5 Counting house; 6 Royal Granaries; 7 Royal Forest; 8 King's Mine.
Row G: 1 Academy of Sciences; 2 Ironworks; 3 War College; 4 Paper mill; 5 Power plant; 6 Railway station; 7 Houses; 8 Tenements.
Row H: 1 Aqueduct; 2 outpost: a tent and a palisade; 3 village: three huts; 4 town: houses and a small tower; 5 city: walls, roofs and a temple; 6 metropolis: walls, domes and towers; 7 empty building plot with stakes and string; 8 district centre: a small town hall on a square.
```

### Cell map

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| **A** | Town hall<br>`building/town-hall` | Farm<br>`building/farm` | Pasture<br>`building/pasture` | Plantation<br>`building/plantation` | Fishing boats<br>`building/fishing-dock` | Granary<br>`building/granary` | Windmill<br>`building/windmill` | Food packaging<br>`building/cannery` |
| **B** | Woodcutter<br>`building/woodlot` | Hunting lodge<br>`building/hunting-lodge` | Lumber mill<br>`building/lumber-mill` | Steam sawmill<br>`building/sawmill` | Mine<br>`building/mine` | Pumping station<br>`building/pumping-station` | Infirmary<br>`building/infirmary` | School<br>`building/school` |
| **C** | University<br>`building/university` | Observatory<br>`building/observatory` | Library<br>`building/library` | Research lab<br>`building/laboratory` | Shrine<br>`building/shrine` | Monument<br>`building/monument` | Temple<br>`building/temple` | Cathedral<br>`building/cathedral` |
| **D** | Amphitheatre<br>`building/amphitheatre` | Printing house<br>`building/printing-house` | City walls<br>`building/walls` | Castle<br>`building/castle` | Market<br>`building/market` | Bank<br>`building/bank` | Mint<br>`building/mint` | Harbour<br>`building/harbour` |
| **E** | Guild hall<br>`building/guild-hall` | Stock exchange<br>`building/stock-exchange` | Workshop<br>`building/workshop` | Smithy<br>`building/smithy` | Tannery<br>`building/tannery` | Weaver<br>`building/weaver` | Foundry<br>`building/foundry` | Factory<br>`building/factory` |
| **F** | Armoury<br>`building/armoury` | Barracks<br>`building/barracks` | Shipyard<br>`building/shipyard` | Engineers' lodge<br>`building/engineers` | Counting house<br>`building/counting-house` | Royal Granaries<br>`building/royal-granaries` | Royal Forest<br>`building/royal-forest` | King's Mine<br>`building/kings-mine` |
| **G** | Academy of Sciences<br>`building/academy` | Ironworks<br>`building/ironworks` | War College<br>`building/war-college` | Paper mill<br>`building/paper-mill` | Power plant<br>`building/power-plant` | Railway station<br>`building/railway-station` | Houses<br>`building/houses` | Tenements<br>`building/tenements` |
| **H** | Aqueduct<br>`building/aqueduct` | outpost<br>`settlement/outpost` | village<br>`settlement/village` | town<br>`settlement/town` | city<br>`settlement/city` | metropolis<br>`settlement/metropolis` | empty building plot with stakes and string<br>`building/empty` | district centre<br>`district/centre` |

---

## Sheet 5: Goods and troop types

File: `icons-5-goods-troops.png` · 64 of 64 cells used · Stockpiles, trade, the unit card portrait and formation lists.

### Prompt to paste

```
A sprite sheet of 64 icons for a historical strategy game: goods and troop types.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one square image, 1024 x 1024 pixels, an invisible 8 x 8 grid of 64 equal square cells (128 x 128 pixels each). Keep each symbol inside its cell with about 16 pixels of empty space on every side, so no symbol touches or crosses a cell edge. Do not draw grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2) everywhere, with no texture, vignette or border.
Cells in reading order (row A left to right, then row B, and so on):
Row A: 1 Wood; 2 Stone; 3 Hides; 4 Copper; 5 Tin; 6 Iron; 7 Coal; 8 Saltpeter.
Row B: 1 Horses; 2 Grain; 3 Fish; 4 Meat; 5 Ivory; 6 Furs; 7 Gold; 8 Silver.
Row C: 1 Spices; 2 Silk; 3 Dyes; 4 Wine; 5 Wool; 6 Sugar; 7 Whale oil; 8 Pearls.
Row D: 1 Tools; 2 Cloth; 3 Leatherwork; 4 Salt; 5 Paper; 6 Steel; 7 Oil; 8 Electricity.
Row E: 1 levy: a club and a tunic; 2 scouts: a walking staff and a cloak; 3 slingers; 4 javelin throwers; 5 archers: a simple bow; 6 spearmen: a spear and a round shield; 7 axemen; 8 swordsmen: a short sword and shield.
Row F: 1 heavy infantry: a big shield and armour; 2 pikemen: a long pike; 3 crossbowmen; 4 longbowmen; 5 arquebusiers; 6 musketeers; 7 riflemen; 8 field gun with crew.
Row G: 1 light cavalry; 2 heavy cavalry; 3 lancers; 4 horse archers; 5 knights on barded horses; 6 field medics; 7 siege ladder team; 8 banner bearer.
Row H: 1 settlers with a handcart; 2 workers with picks; 3 galley with oars; 4 longship; 5 cog with one sail; 6 carrack; 7 galleon; 8 transport ship with troops on deck.
```

### Cell map

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| **A** | Wood<br>`good/wood` | Stone<br>`good/stone` | Hides<br>`good/hides` | Copper<br>`good/copper` | Tin<br>`good/tin` | Iron<br>`good/iron` | Coal<br>`good/coal` | Saltpeter<br>`good/saltpeter` |
| **B** | Horses<br>`good/horses` | Grain<br>`good/grain` | Fish<br>`good/fish` | Meat<br>`good/meat` | Ivory<br>`good/ivory` | Furs<br>`good/furs` | Gold<br>`good/gold` | Silver<br>`good/silver` |
| **C** | Spices<br>`good/spices` | Silk<br>`good/silk` | Dyes<br>`good/dyes` | Wine<br>`good/wine` | Wool<br>`good/wool` | Sugar<br>`good/sugar` | Whale oil<br>`good/whale-oil` | Pearls<br>`good/pearls` |
| **D** | Tools<br>`good/tools` | Cloth<br>`good/cloth` | Leatherwork<br>`good/leatherwork` | Salt<br>`good/salt` | Paper<br>`good/paper` | Steel<br>`good/steel` | Oil<br>`good/oil` | Electricity<br>`good/electricity` |
| **E** | levy<br>`troop/levy` | scouts<br>`troop/scouts` | slingers<br>`troop/slingers` | javelin throwers<br>`troop/javelins` | archers<br>`troop/archers` | spearmen<br>`troop/spearmen` | axemen<br>`troop/axemen` | swordsmen<br>`troop/swordsmen` |
| **F** | heavy infantry<br>`troop/heavy-infantry` | pikemen<br>`troop/pikemen` | crossbowmen<br>`troop/crossbowmen` | longbowmen<br>`troop/longbowmen` | arquebusiers<br>`troop/arquebusiers` | musketeers<br>`troop/musketeers` | riflemen<br>`troop/riflemen` | field gun with crew<br>`troop/field-gun` |
| **G** | light cavalry<br>`troop/light-cavalry` | heavy cavalry<br>`troop/heavy-cavalry` | lancers<br>`troop/lancers` | horse archers<br>`troop/horse-archers` | knights on barded horses<br>`troop/knights` | field medics<br>`troop/medics` | siege ladder team<br>`troop/siege` | banner bearer<br>`troop/banner` |
| **H** | settlers with a handcart<br>`troop/settlers` | workers with picks<br>`troop/workers` | galley with oars<br>`troop/galley` | longship<br>`troop/longship` | cog with one sail<br>`troop/cog` | carrack<br>`troop/carrack` | galleon<br>`troop/galleon` | transport ship with troops on deck<br>`troop/transport` |

---

## Sheet 6: Interface

File: `icons-6-interface.png` · 64 of 64 cells used · Top bar, unit card stats and actions, dialogs, diplomacy.

### Prompt to paste

```
A sprite sheet of 64 icons for a historical strategy game: interface.
Style: simple hand-drawn emblem icons for a historical strategy game, dark sepia ink line work with one flat light watercolour wash, like the small symbols in the margin of an old atlas. One bold, simple symbol per cell, centred, filling about 70% of the cell, readable at 32 pixels: no fine detail, no scenery, no background objects. Same line weight, same light from the top left, same scale in every cell. Warm limited palette: sepia ink, ochre, muted brick red, faded slate blue, olive green, on cream. No frames, no circles or plaques behind the symbols. No text, letters, numbers or labels anywhere.
Format: one square image, 1024 x 1024 pixels, an invisible 8 x 8 grid of 64 equal square cells (128 x 128 pixels each). Keep each symbol inside its cell with about 16 pixels of empty space on every side, so no symbol touches or crosses a cell edge. Do not draw grid lines, borders or numbers. Background: one flat, plain cream colour (#F3E9D2) everywhere, with no texture, vignette or border.
Cells in reading order (row A left to right, then row B, and so on):
Row A: 1 stack of gold coins; 2 open book with a star; 3 lyre; 4 sheaf of wheat; 5 hammer; 6 small house; 7 crossed pick and hoe; 8 two standing figures.
Row B: 1 crossed swords; 2 tower; 3 boot print; 4 eye; 5 sword; 6 bow and arrow; 7 double chevron; 8 shield.
Row C: 1 banner; 2 coin purse; 3 laurel sprig; 4 palisade; 5 forking arrow; 6 two arrows joining; 7 road with a dashed line; 8 anvil.
Row D: 1 target; 2 flag on a hill; 3 raised spear and banner; 4 handcart; 5 hourglass; 6 pointing hand; 7 bell; 8 three lines.
Row E: 1 sealed scroll; 2 open scroll; 3 cog; 4 x; 5 arrow left; 6 arrow right; 7 magnifier with plus; 8 magnifier with minus.
Row F: 1 stacked sheets; 2 folded map; 3 crossed swords over a flame; 4 olive branch; 5 clasped hands; 6 interlocked rings; 7 balance scale; 8 gift chest.
Row G: 1 pointing finger and coin; 2 crown over two banners; 3 up arrow with a heart; 4 down arrow with a cracked heart; 5 astrolabe; 6 helmet over crossed spears; 7 three heads; 8 family tree.
Row H: 1 open ledger; 2 city gate; 3 three-by-three grid of roofs; 4 rolled plan; 5 padlock; 6 tick; 7 exclamation in a triangle; 8 question mark in a circle.
```

### Cell map

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| **A** | stack of gold coins<br>`icon/gold` | open book with a star<br>`icon/science` | lyre<br>`icon/culture` | sheaf of wheat<br>`icon/food` | hammer<br>`icon/production` | small house<br>`icon/housing` | crossed pick and hoe<br>`icon/workers` | two standing figures<br>`icon/people` |
| **B** | crossed swords<br>`icon/army` | tower<br>`icon/cities` | boot print<br>`icon/moves` | eye<br>`icon/sight` | sword<br>`icon/melee` | bow and arrow<br>`icon/ranged` | double chevron<br>`icon/charge` | shield<br>`icon/protection` |
| **C** | banner<br>`icon/morale` | coin purse<br>`icon/upkeep` | laurel sprig<br>`icon/experience` | palisade<br>`icon/fortify` | forking arrow<br>`icon/split` | two arrows joining<br>`icon/merge` | road with a dashed line<br>`icon/road` | anvil<br>`icon/equip` |
| **D** | target<br>`icon/go-to` | flag on a hill<br>`icon/found-city` | raised spear and banner<br>`icon/levy` | handcart<br>`icon/settle` | hourglass<br>`icon/end-turn` | pointing hand<br>`icon/next-unit` | bell<br>`icon/notices` | three lines<br>`icon/menu` |
| **E** | sealed scroll<br>`icon/save` | open scroll<br>`icon/load` | cog<br>`icon/settings` | x<br>`icon/close` | arrow left<br>`icon/back` | arrow right<br>`icon/forward` | magnifier with plus<br>`icon/zoom-in` | magnifier with minus<br>`icon/zoom-out` |
| **F** | stacked sheets<br>`icon/layers` | folded map<br>`icon/minimap` | crossed swords over a flame<br>`icon/war` | olive branch<br>`icon/peace` | clasped hands<br>`icon/pact` | interlocked rings<br>`icon/alliance` | balance scale<br>`icon/trade` | gift chest<br>`icon/gift` |
| **G** | pointing finger and coin<br>`icon/demand` | crown over two banners<br>`icon/absorb` | up arrow with a heart<br>`icon/opinion-up` | down arrow with a cracked heart<br>`icon/opinion-down` | astrolabe<br>`icon/research` | helmet over crossed spears<br>`icon/designs` | three heads<br>`icon/peoples` | family tree<br>`icon/dynasties` |
| **H** | open ledger<br>`icon/ledger` | city gate<br>`icon/city` | three-by-three grid of roofs<br>`icon/district` | rolled plan<br>`icon/blueprint` | padlock<br>`icon/lock` | tick<br>`icon/check` | exclamation in a triangle<br>`icon/warning` | question mark in a circle<br>`icon/help` |

