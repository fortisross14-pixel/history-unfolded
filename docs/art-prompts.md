# Art prompts

Prompts for an image generator, one sheet each. Every sheet is a grid on a plain white background so
the cells can be cut and keyed out. Generate a sheet, cut it into cells, and drop the files into
`public/sprites/<folder>/` under the key in the list (the sprite registry maps keys to files).

District buildings are not in this list. The city and district views are drawn in low-poly 3D in code
(see `docs/ui-proposals/city-lowpoly.html`). Sheet 5 only gives the UI flat icons for them.

Shared style line (already inside every prompt): *hand-drawn engraving, sepia and umber ink with light
watercolour washes, on nothing, as in an 18th-century atlas*. This matches the current map symbols.

---

## 1. Map terrain symbols (4×4)

```
A 4x4 grid sprite sheet of 16 map terrain symbols for a hex strategy game, each centred in its own
square cell with generous empty margin, on a plain pure white background, no borders, no text, no
labels, no shadows on the ground. Style: hand-drawn copperplate engraving, fine sepia and umber ink
hatching with light, muted watercolour washes, like the decorative symbols on an 18th-century atlas.
Same scale, same light from the top left, same line weight in every cell. Each symbol fits inside a
flat-topped hexagon seen from slightly above (3/4 view).
Cells, left to right, top to bottom:
1 broadleaf forest cluster, 2 pine forest cluster, 3 jungle palms, 4 mixed woodland with a clearing,
5 rolling hills, 6 single mountain peak, 7 mountain range with three peaks, 8 snow-capped peaks,
9 desert dunes, 10 rocky desert with mesas, 11 marsh with reeds, 12 tundra with low shrubs,
13 savanna with acacia trees, 14 floodplain grass with a winding stream, 15 volcano with a thin plume,
16 cliffs on a coastline.
```

## 2. Resource and deposit medallions (5×5)

```
A 5x5 grid sprite sheet of 25 round resource medallions for a historical strategy game map, each
centred in its own square cell on a plain pure white background, no text, no letters. Each medallion:
a small ivory disc with a thin bronze rim and a fine engraved inner ring, holding one object drawn in
sepia ink engraving with light watercolour colour. All medallions identical in size and rim, object
filling about 70% of the disc, light from the top left.
Objects: 1 wheat sheaf, 2 rice stalks, 3 fish, 4 pig, 5 cattle head, 6 sheep, 7 deer (game),
8 horse head, 9 cut stone blocks, 10 copper ore, 11 tin ore, 12 iron ore, 13 coal lumps,
14 saltpeter crystals, 15 elephant tusk (ivory), 16 fox fur pelt, 17 gold nugget, 18 silver ingot,
19 pepper and cinnamon (spices), 20 bolt of silk, 21 dye pots, 22 wine amphora, 23 timber logs,
24 hides, 25 clay pot (pottery).
```

## 3. Troops: ancient and classical (4×4)

```
A 4x4 grid sprite sheet of 16 single soldier figures for a turn-based historical strategy game, each
standing alone in its own square cell on a plain pure white background, full body, 3/4 view facing
right, same height and scale in every cell, a small oval ground shadow, no text, no borders.
Style: painted miniature figure in the manner of an engraved and hand-coloured atlas plate: fine
sepia ink outlines, soft watercolour shading, muted earthy palette (umber, ochre, oxblood, slate
blue, olive), a plain cream-white banner or shield field left blank so a team colour can be tinted in
later. Not tied to any real nation, no recognisable historical insignia.
Cells: 1 tribal levy with club and tunic, 2 scout with cloak and walking staff, 3 slinger,
4 archer with simple bow, 5 spearman with hide shield, 6 bronze spearman with round bronze shield and
crested helmet, 7 swordsman with short bronze sword, 8 axeman, 9 chariot with driver and archer,
10 horseman with javelins, 11 heavy infantry in linen armour with large shield, 12 iron legionary
with rectangular shield, 13 composite-bow archer, 14 mailed cavalryman with lance, 15 horse archer,
16 settler family with a handcart and bundles (civilian).
```

## 4. Troops: medieval and renaissance, plus ships (4×4)

```
Same style, framing and rules as the previous sheet (single figure per cell, 3/4 view facing right,
pure white background, blank cream banner or shield field for team colour, no real insignia).
Cells: 1 man-at-arms in mail with kite shield, 2 crossbowman with pavise, 3 longbowman,
4 pikeman with long pike and morion helmet, 5 halberdier, 6 knight in plate on a barded horse,
7 light cavalry with sabre, 8 arquebusier, 9 musketeer with forked rest, 10 field gun with two crew,
11 field medic with satchel, 12 engineer with pick and gabions, 13 galley with oars (seen from the
side, small), 14 cog with one square sail, 15 caravel with lateen sails, 16 galleon with three masts.
Ships sit on a small patch of engraved sea instead of a ground shadow.
```

## 5. Building icons for the UI (6×8)

```
A 6x8 grid sheet of 48 small flat icons for a strategy game's city-building menu, each centred in its
own square cell on a plain pure white background, no text. Style: clean low-poly isometric
miniature, flat-shaded facets, soft warm light from the top left, muted palette (ivory walls,
terracotta and teal roofs, ochre fields, sage grass, warm grey stone), each building standing on a
small square tile of its own ground, same tile size and camera angle in every cell.
Buildings: town hall, grain field, pig pen, cattle pasture, sheep run, horse stud, fishing dock,
granary, windmill, woodlot, lumber mill, quarry, copper mine, tin mine, iron mine, coal mine,
gold mine, silver mine, hunting lodge, plantation, saltpeter works, workshop, armoury, barracks,
shipyard, foundry, infirmary, school, library, university, printing house, observatory, market,
bank, stock exchange, harbour, guild hall, houses, aqueduct, tenements, shrine, monument, city walls,
temple, amphitheatre, cathedral, castle, empty building plot.
```

## 6. Unit portraits for the unit card (4×4)

```
A 4x4 grid sheet of 16 circular head-and-shoulders portraits of soldiers for a strategy game's unit
card, each a circle centred in its own square cell on a plain pure white background, no text.
Style: engraved and hand-coloured portrait as on an atlas plate: sepia ink hatching, light
watercolour, muted earthy colours, soft light from the left, the figure looking slightly to the
right, plain pale parchment behind the head inside the circle. Not based on any real person.
Portraits: tribal levy, scout, slinger, archer, bronze spearman, swordsman, horseman, heavy infantry,
legionary, mailed cavalryman, crossbowman, pikeman, knight, musketeer, field gunner, settler.
```

## Tips

- Generate each sheet two or three times and keep the most consistent one. Cells must share scale
  and light, or units look mismatched on the map.
- If a tool will not keep to the grid, ask for one row of four at a time with the same prompt.
- Keep the backgrounds pure white. A script can then key them out to transparent PNGs.
- Troop figures leave the banner and shield blank so the game can tint them in each people's colour.
