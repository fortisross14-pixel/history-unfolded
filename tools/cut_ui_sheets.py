"""Cut the Round 5 interface sheets (art/source/ui-*.png, see art/R5-UI-SHEETS.md).

Usage:  python3 tools/cut_ui_sheets.py [sheet ...]   (sheet = file name without .png; none = all found)
Needs:  Pillow and numpy

Reads art/ui-sheets.json. "figure" sheets are pieces on flat magenta: each cell is keyed and
trimmed like the map figures (tools/cut_icon_sheets.py). "texture" sheets are full-bleed tiles:
each cell is cut on the exact grid, a few pixels inside its edges, with no keying. Writes
public/sprites/art/<group>/<name>.webp and merges the entries into public/sprites/art-manifest.json;
src/ui/uiArt.ts then turns each one into a CSS custom property the interface uses.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_sprites import MANIFEST, OUT, ROOT, SRC, cell_boxes  # noqa: E402
from cut_icon_sheets import key_magenta  # noqa: E402


def cut(sheet):
    cols, rows, style, height = sheet["cols"], sheet["rows"], sheet["style"], sheet["height"]
    im = Image.open(os.path.join(SRC, sheet["file"])).convert("RGB")
    rgb = np.asarray(im).astype(np.float32)
    if style == "texture":
        cw, ch = im.width / cols, im.height / rows
        boxes = [
            (round(c * cw) + 6, round(r * ch) + 6, round((c + 1) * cw) - 6, round((r + 1) * ch) - 6)
            for r in range(rows)
            for c in range(cols)
        ]
    else:
        border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
        ref = np.median(border, axis=0)
        fg = (np.sqrt(((rgb - ref) ** 2).sum(axis=2)) > 60).astype(np.float32)
        boxes = cell_boxes(fg, cols, rows)
    out = {}
    for key, (x0, y0, x1, y1) in zip(sheet["cells"], boxes):
        if key is None:
            continue
        cell = rgb[y0:y1, x0:x1]
        if style == "texture":
            piece = Image.fromarray(cell.astype(np.uint8), "RGB")
        else:
            piece = key_magenta(cell)
            if piece is None:
                print(f"   check: {key}: empty cell")
                continue
        side = max(piece.width, piece.height)
        scale = min(1.0, height / side)
        piece = piece.resize(
            (max(1, round(piece.width * scale)), max(1, round(piece.height * scale))), Image.LANCZOS
        )
        group, name = key.split("/", 1)
        os.makedirs(os.path.join(OUT, group), exist_ok=True)
        piece.save(os.path.join(OUT, group, f"{name}.webp"), "WEBP", quality=88, method=6)
        out[key] = {"path": f"art/{group}/{name}.webp", "w": piece.width, "h": piece.height}
    print(f"[{sheet['file']}] {len(out)}/{len([k for k in sheet['cells'] if k])} pieces")
    return out


def main():
    only = set(sys.argv[1:])
    sheets = json.load(open(os.path.join(ROOT, "art", "ui-sheets.json")))
    manifest = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
    done = 0
    for sheet in sheets:
        if only and sheet["file"].rsplit(".", 1)[0] not in only:
            continue
        if not os.path.exists(os.path.join(SRC, sheet["file"])):
            print(f"[{sheet['file']}] not found in art/source")
            continue
        manifest.update(cut(sheet))
        done += 1
    if done:
        json.dump(dict(sorted(manifest.items())), open(MANIFEST, "w"), indent=1)
    print(f"{done} sheet(s) cut, {len(manifest)} sprites in the manifest")


if __name__ == "__main__":
    main()
