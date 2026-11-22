"""Cut the Ivory Codex icon sheets (art/source/icons-*.png) into icons the game loads.

Usage:  python3 tools/cut_icon_sheets.py [sheet ...]   (sheet = file name without .png; none = all found)
Needs:  Pillow and numpy

Reads art/icon-sheets.json (written by scripts/icon-plan.ts): six 1024 px sheets of 8 x 8 icons on
cream paper. Each cell carries its full key (tech/archery, icon/gold, item/spear ...), so one sheet
can feed several groups. Uses the same gutter-finding cut and ink lift as tools/cut_sprites.py, writes
public/sprites/art/<group>/<name>.webp and merges the entries into public/sprites/art-manifest.json.
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


def cut(sheet):
    path = os.path.join(SRC, sheet["file"])
    im = Image.open(path).convert("RGB")
    rgb = np.asarray(im).astype(np.float32)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    ref = np.median(border, axis=0)
    fg = (np.sqrt(((rgb - ref) ** 2).sum(axis=2)) > 60).astype(np.float32)
    boxes = cell_boxes(fg, COLS, ROWS)
    out, problems = {}, []
    for key, (x0, y0, x1, y1) in zip(sheet["cells"], boxes):
        sprite = cut_cell(rgb[y0:y1, x0:x1], "emblem")
        if sprite is None:
            problems.append(f"{key}: empty cell")
            continue
        if sprite.width >= (x1 - x0) - 2 or sprite.height >= (y1 - y0) - 2:
            problems.append(f"{key}: fills its whole cell")
        scale = min(1.0, HEIGHT / max(sprite.width, sprite.height))
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
    sheets = json.load(open(os.path.join(ROOT, "art", "icon-sheets.json")))
    only = set(sys.argv[1:])
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
