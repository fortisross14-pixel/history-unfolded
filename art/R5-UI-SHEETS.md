# History Unfolded: Release 5 interface art

The interface now draws its Imperator look in CSS: gilt frames with corner ornaments, oxblood
title bands, a leather top bar, gilt medallion rings, leather stat cells. Three sheets replace the
parts CSS can only imitate. **Each one is optional**: the game uses each piece as soon as it exists
and keeps the CSS version for anything missing.

| Sheet | What | Status |
|---|---|---|
| **U1. Interface frames** | gilded frame, medallion ring, title divider, button plate | **to make: below** |
| **U2. Interface textures** | parchment, oxblood damask, dark leather | **to make: below** |
| **U3. Culture banners** | a hanging banner for each of the 9 culture domains | **to make: below** |

## Rules for every sheet

- **Attach a reference.** For U1 and U3 attach `map-1-foot.png`; for U2 attach any delivered
  sheet. Add: *"Match the palette and the light of the attached sheet."*
- Read each grid **left to right, top to bottom**. A cell marked *(empty)* stays plain background.
- **No grid lines, numbers or text.** Nothing may touch or cross a cell edge (U2 excepted: its
  tiles fill their cells).
- U1 and U3 on **flat magenta** (the cutter removes it); U2 is full-bleed texture.
- Save each sheet in `art/source/` under the file name given, then run
  `python3 tools/cut_ui_sheets.py` (or hand the files over and I cut them). Reload the game: the
  pieces are picked up from the art manifest, nothing else to switch on.
- **If a sheet comes back wrong** (pieces merged, magenta inside a piece, a texture with a
  vignette): ask again with the same prompt, or ask for one cell at a time ("a single 512 x 512
  image of ...") and place the cells together. Do not retouch by hand.

## The style lines

**Gilded pieces (U1, U3)**
> Style: ornamental interface pieces for a historical strategy game, in the manner of a grand strategy game's classical interface: burnished antique gold with soft highlights and dark bronze recesses, fine classical ornament (beading, acanthus, egg-and-dart, small rosettes), hand-painted rather than photographic, crisp edges that still read when scaled down to a quarter. The same gold, the same light from the top left and the same ornament in every cell. Symmetric. No text, letters, numbers, faces, figures or real insignia anywhere.
>
> Background: one flat, solid, pure magenta (#FF00FF) everywhere, with no gradient, texture, floor or shadow. Nothing in the pieces is magenta; nothing is see-through except where the prompt says magenta.

**Textures (U2)**
> Style: seamless tileable surface textures for a historical strategy game interface, hand-painted, soft and even, low contrast so text stays readable on top: no objects, no symbols, no vignette, no frame, no lighting falloff, no visible seams; the left edge continues into the right edge and the top into the bottom.

---

## Sheet U1: Interface frames

File: `ui-1-frames.png` · 4 cells · 1024 x 1024, a 2 x 2 grid of 512 x 512 cells.

### Prompt to paste

```
A sheet of 4 ornamental interface pieces for a historical strategy game.
Style: ornamental interface pieces for a historical strategy game, in the manner of a grand strategy game's classical interface: burnished antique gold with soft highlights and dark bronze recesses, fine classical ornament (beading, acanthus, egg-and-dart, small rosettes), hand-painted rather than photographic, crisp edges that still read when scaled down to a quarter. The same gold, the same light from the top left and the same ornament in every cell. Symmetric. No text, letters, numbers, faces, figures or real insignia anywhere.
Format: one square image, 1024 x 1024 pixels, an invisible 2 x 2 grid of 4 equal cells (512 x 512 pixels each). Keep about 20 pixels of magenta around each piece so nothing touches a cell edge. Do not draw grid lines or borders between the cells.
Background: one flat, solid, pure magenta (#FF00FF) everywhere, with no gradient, texture, floor or shadow. Nothing in the pieces is magenta.
Cells in reading order:
1 (top left) A square gilded picture frame seen straight on, filling the cell: a gold moulding band about 36 pixels wide all round with a thin dark bronze line on its inner edge, and an ornate gold corner piece (a rosette with acanthus leaves) at each of the four corners, each corner piece about 100 x 100 pixels. The four straight sides between the corners are plain repeating beading, identical on all sides. The whole inside of the frame is flat magenta.
2 (top right) A round gilded medallion ring seen straight on, filling the cell: a gold ring about 60 pixels thick with beading on its outer edge and a fine laurel band on its face, a thin dark bronze line on its inner edge. The whole centre inside the ring is flat magenta.
3 (bottom left) A horizontal gold ornamental divider, about 470 pixels wide and 60 pixels tall, centred in the cell: a small gold lozenge in the middle, a pair of curling acanthus scrolls on each side of it, then a fine gold line tapering out to each end. Everything above and below it is magenta.
4 (bottom right) A rectangular button plaque, about 470 pixels wide and 200 pixels tall, centred in the cell: a smooth warm ivory parchment face with a narrow gilt rim (about 14 pixels) and slightly rounded corners, a faint inner bevel, no ornament on the face. Everything around it is magenta.
```

### Cell map and use

| Cell | Piece | Key | How the game uses it |
|---|---|---|---|
| A1 | gilded frame | `ui/frame` | `border-image` on windows, side cards and the menu card: slice 22%, drawn 30 px wide (22 px on side cards), 10 px outside the box. Replaces the CSS gilt and corner ornaments. |
| A2 | medallion ring | `ui/medal` | laid over the realm rail buttons (9 px larger than the button) and the End turn medallion. |
| B1 | divider | `ui/divider` | the ornament under every window title (`--im-art-divider`), 20 px tall. |
| B2 | button plate | `ui/plate` | `border-image` (slice 30%, fill) behind ordinary plaque buttons (`.secondary`, `.wide`, `.small`). |

---

## Sheet U2: Interface textures

File: `ui-2-textures.png` · 3 of 4 cells · 1024 x 1024, a 2 x 2 grid of 512 x 512 tiles.

### Prompt to paste

```
A sheet of 3 seamless interface textures for a historical strategy game.
Style: seamless tileable surface textures for a historical strategy game interface, hand-painted, soft and even, low contrast so text stays readable on top: no objects, no symbols, no vignette, no frame, no lighting falloff, no visible seams; the left edge continues into the right edge and the top into the bottom.
Format: one square image, 1024 x 1024 pixels, an invisible 2 x 2 grid of 4 equal square tiles (512 x 512 pixels each). Each texture fills its whole tile edge to edge. Do not draw lines or borders between the tiles.
Tiles in reading order:
1 (top left) Warm ivory parchment (#F3EAD5 on average) with very faint fibres and soft mottling, almost flat.
2 (top right) Deep oxblood red silk damask (#6B1E19 on average) with a faint, small, regular tone-on-tone classical pattern, slightly darker than the base, low contrast.
3 (bottom left) Dark brown tooled leather (#3B2517 on average) with fine grain and a faint worn sheen, no stitching, no pattern.
4 (bottom right) Plain flat mid grey (#808080), nothing else.
```

### Cell map and use

| Cell | Texture | Key | How the game uses it |
|---|---|---|---|
| A1 | parchment | `ui/parchment` | the paper of windows, cards and the menu card, 512 px tiles under a light ivory wash. |
| A2 | oxblood damask | `ui/oxblood` | the title band of every window, 384 px tiles. |
| B1 | dark leather | `ui/leather` | the top bar (384 px tiles) and the leather stat cells (256 px tiles, darkened). |
| B2 | *(grey, ignored)* | — | — |

---

## Sheet U3: Culture banners

File: `ui-3-banners.png` · 9 of 12 cells · 1536 x 1024 (landscape), a 6 x 2 grid of tall cells, 256 x 512 pixels each.

### Prompt to paste

```
A sheet of 9 hanging cloth banners for a historical strategy game, one for each field of culture.
Style: ornamental interface pieces for a historical strategy game, in the manner of a grand strategy game's classical interface: burnished antique gold with soft highlights and dark bronze recesses, fine classical ornament (beading, acanthus, egg-and-dart, small rosettes), hand-painted rather than photographic, crisp edges that still read when scaled down to a quarter. The same gold, the same light from the top left and the same ornament in every cell. Symmetric. No text, letters, numbers, faces, figures or real insignia anywhere.
Every banner is the same shape and size: a short gold rod across the top with a small finial at each end, and a tall cloth hanging from it, about 150 pixels wide and 400 pixels tall, its lower end cut into a swallowtail point, a narrow gold fringe border down both sides, gentle folds. In the upper middle of each cloth one simple emblem embroidered in gold thread, as described. Each banner is centred in its cell.
Format: one image, 1536 x 1024 pixels, an invisible grid of 6 columns and 2 rows of equal cells (256 x 512 pixels each). Keep about 30 pixels of magenta around each banner so nothing touches a cell edge. Do not draw grid lines or borders.
Background: one flat, solid, pure magenta (#FF00FF) everywhere, with no gradient, texture, floor or shadow. Nothing in the banners is magenta.
Cells in reading order (top row left to right, then the bottom row):
Top row: 1 slate-blue cloth (#3D5A8A), emblem a sun beside a crescent moon; 2 brick-red cloth (#A3342A), emblem a laurel wreath around a bundle of rods; 3 violet cloth (#7A4EA0), emblem a small temple front with columns; 4 dusty-rose cloth (#B5838D), emblem two clasped hands; 5 ochre-gold cloth (#C9962B), emblem a balance scale; 6 dark-umber cloth (#6B3F22), emblem two crossed swords over a round shield.
Bottom row: 1 sea-teal cloth (#2F7D8A), emblem a galley's sail over waves; 2 olive-green cloth (#3D7A3A), emblem an open book; 3 terracotta cloth (#B0663A), emblem a lyre; 4 (empty); 5 (empty); 6 (empty).
Draw exactly these banners in exactly this order.
```

### Cell map and use

| | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| **A** | Cosmology<br>`banner/cosmology` | Politics<br>`banner/politics` | Religion<br>`banner/religion` | Society<br>`banner/society` | Economy<br>`banner/economy` | War<br>`banner/war` |
| **B** | Seafaring<br>`banner/seafaring` | Knowledge<br>`banner/knowledge` | Arts<br>`banner/arts` | · | · | · |

Used on the culture screen: each Tome card in the picker hangs its domain's banner at its top
right (92 px tall) and the open Tome's card shows its banner full height on the right, both
behind a fading ivory wash so the text stays readable.

## What stays CSS

The oxblood band's gold capitals, the bookmark tabs, the leather stat cells and their parchment
icon discs, the portrait rings and the End turn bezel need no art: they are drawn from the same
gold and oxblood the sheets use, so they sit with the painted pieces when those arrive.
