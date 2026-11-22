"""Cut the Ivory Codex icon sheets (art/source/icons-*.png) into icons the game loads.

Usage:  python3 tools/cut_icon_sheets.py [--map] [sheet ...]
        (sheet = file name without .png; none = all found; --map cuts the map sheets instead)
Needs:  Pillow and numpy

Reads art/icon-sheets.json (written by scripts/icon-plan.ts): six 1024 px sheets of 8 x 8 icons on
cream paper. Each cell carries its full key (tech/archery, icon/gold, item/spear ...), so one sheet
can feed several groups. Uses the same gutter-finding cut and ink lift as tools/cut_sprites.py, writes
public/sprites/art/<group>/<name>.webp and merges the entries into public/sprites/art-manifest.json.

With --map it reads art/map-sheets.json (written by scripts/map-art-plan.ts) instead: troop, ship
and settlement figures on flat magenta and terrain symbols on cream, each sheet with its own grid
and output height.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cut_sprites import MANIFEST, OUT, ROOT, SRC, cell_boxes, cut_cell  # noqa: E402

COLS = ROWS = 8
# icons show at 16-48 px; 96 keeps them sharp on high-density screens
HEIGHT = 96


def key_magenta(rgb):
    """A figure on flat magenta: every magenta pixel goes, also the ones enclosed by the figure
    (between legs, inside a bow, behind sails), and edge pixels are un-mixed from the magenta."""
    rgb = rgb.astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    # how magenta a pixel is: red and blue both well above green
    m = np.minimum(r, b) - g
    alpha = np.clip((165 - m) / 95, 0, 1)
    ref = np.array([255.0, 0.0, 255.0])
    aa = alpha[..., None]
    fg = np.where(aa > 0.05, (rgb - ref * (1 - aa)) / np.maximum(aa, 0.05), rgb)
    # what pink is left on the rim: pull red and blue down to what the green allows
    spill = np.clip(np.minimum(fg[..., 0], fg[..., 2]) - fg[..., 1] - 40, 0, None)
    fg[..., 0] -= spill * 0.5
    fg[..., 2] -= spill
    rgba = np.dstack([np.clip(fg, 0, 255), alpha * 255]).astype(np.uint8)
    ys, xs = np.nonzero(alpha > 0.04)
    if not len(ys):
        return None
    pad = 3
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, rgba.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, rgba.shape[1])
    return Image.fromarray(rgba[y0:y1, x0:x1], "RGBA")


def cut(sheet):
    cols, rows = sheet.get("cols", COLS), sheet.get("rows", ROWS)
    style, height = sheet.get("style", "emblem"), sheet.get("height", HEIGHT)
    path = os.path.join(SRC, sheet["file"])
    im = Image.open(path).convert("RGB")
    rgb = np.asarray(im).astype(np.float32)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    ref = np.median(border, axis=0)
    fg = (np.sqrt(((rgb - ref) ** 2).sum(axis=2)) > 60).astype(np.float32)
    boxes = cell_boxes(fg, cols, rows)
    out, problems = {}, []
    for key, (x0, y0, x1, y1) in zip(sheet["cells"], boxes):
        cell = rgb[y0:y1, x0:x1]
        sprite = key_magenta(cell) if style == "figure" else cut_cell(cell, style)
        if sprite is None:
            problems.append(f"{key}: empty cell")
            continue
        if sprite.width >= (x1 - x0) - 2 or sprite.height >= (y1 - y0) - 2:
            problems.append(f"{key}: fills its whole cell")
        # icons fit a square; map figures keep their height so they stand on the same ground
        side = max(sprite.width, sprite.height) if style == "emblem" else sprite.height
        scale = min(1.0, height / side)
        sprite = sprite.resize(
            (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))), Image.LANCZOS
        )
        group, name = key.split("/", 1)
        os.makedirs(os.path.join(OUT, group), exist_ok=True)
        # WebP keeps the alpha at a fraction of PNG's size (about 4 KB an icon)
        sprite.save(os.path.join(OUT, group, f"{name}.webp"), "WEBP", quality=88, method=6)
        out[key] = {"path": f"art/{group}/{name}.webp", "w": sprite.width, "h": sprite.height}
    print(f"[{sheet['file']}] {len(out)}/{len(sheet['cells'])} icons")
    for p in problems:
        print("   check:", p)
    return out


def main():
    args = sys.argv[1:]
    plan = "map-sheets.json" if "--map" in args else "icon-sheets.json"
    sheets = json.load(open(os.path.join(ROOT, "art", plan)))
    only = set(a for a in args if a != "--map")
    manifest = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
    done = 0
    for sheet in sheets:
        stem = sheet["file"].rsplit(".", 1)[0]
        if only and stem not in only:
            continue
        if not os.path.exists(os.path.join(SRC, sheet["file"])):
            print(f"[{sheet['file']}] not found in art/source")
            continue
        manifest.update(cut(sheet))
        done += 1
    json.dump(dict(sorted(manifest.items())), open(MANIFEST, "w"), indent=1)
    print(f"{done} sheet(s) cut, {len(manifest)} sprites in the manifest")


if __name__ == "__main__":
    main()
