"""Cut the ChatGPT sheets in art/source into sprites the game loads.

Usage:  python3 tools/cut_sprites.py [sheet ...]      (sheet = file name without .png; none = all found)
Needs:  Pillow and numpy  (python3 -m pip install pillow numpy)

Reads art/sheets.json (written by scripts/art-plan.ts). For each sheet found in art/source it
splits the grid into cells (cut lines go through the emptiest columns/rows near each expected
boundary, so slightly uneven grids still cut), removes the background, trims, scales to the
sheet's height and writes public/sprites/art/<group>/<key>.png plus public/sprites/art-manifest.json.

Background removal:
- miniature sheets: the flat magenta is removed by flood fill from the cell border, so magenta-ish
  pixels inside a figure are kept; edges are de-fringed.
- ink and emblem sheets: alpha comes from how far a pixel is from the cream paper, and the paper
  colour is un-mixed from the edges, like ink lifted off the page.
Whole-picture sheets (battle scenes, title) are only resized.
"""
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art", "source")
OUT = os.path.join(ROOT, "public", "sprites", "art")
MANIFEST = os.path.join(ROOT, "public", "sprites", "art-manifest.json")


def cuts(profile, n):
    """n-1 cut positions at the emptiest point near each expected boundary."""
    if n <= 1:
        return []
    k = 9
    prof = np.convolve(profile.astype(np.float32), np.ones(k) / k, mode="same")
    span = len(prof) / n
    out = []
    for i in range(1, n):
        lo, hi = int(span * (i - 0.35)), int(span * (i + 0.35))
        out.append(lo + int(np.argmin(prof[lo:hi])))
    return out


def cell_boxes(fg, cols, rows):
    """Cell rectangles in reading order, with cut lines placed in the gutters."""
    xs = [0] + cuts(fg.sum(axis=0), cols) + [fg.shape[1]]
    boxes = []
    ys_per_col = []
    for c in range(cols):
        sub = fg[:, xs[c]:xs[c + 1]]
        ys_per_col.append([0] + cuts(sub.sum(axis=1), rows) + [fg.shape[0]])
    for r in range(rows):
        for c in range(cols):
            ys = ys_per_col[c]
            boxes.append((xs[c], ys[r], xs[c + 1], ys[r + 1]))
    return boxes


def flood_background(rgb, tol):
    """True where a pixel is background connected to the cell border."""
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    ref = np.median(border, axis=0)
    near = np.sqrt(((rgb - ref) ** 2).sum(axis=2)) < tol
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen, ref


def cut_cell(rgb, style):
    rgb = rgb.astype(np.float32)
    if style == "miniature":
        bg, ref = flood_background(rgb, 90)
        alpha = (~bg).astype(np.float32)
        # soften the edge by one pixel and pull the magenta out of edge pixels
        a_img = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
        alpha = np.asarray(a_img).astype(np.float32) / 255
        alpha[bg & (alpha < 0.5)] = 0
        aa = alpha[..., None]
        fg = np.where(aa > 0.05, (rgb - ref * (1 - aa)) / np.maximum(aa, 0.05), rgb)
    else:
        border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
        ref = np.median(border, axis=0)
        dist = np.sqrt(((rgb - ref) ** 2).sum(axis=2))
        dark = np.clip(ref.mean() - rgb.mean(axis=2), 0, None)
        alpha = np.clip((dist + 0.6 * dark - 14) / 55, 0, 1)
        aa = alpha[..., None]
        fg = np.where(aa > 0.05, (rgb - ref * (1 - aa)) / np.maximum(aa, 0.05), rgb)
    rgba = np.dstack([np.clip(fg, 0, 255), alpha * 255]).astype(np.uint8)
    ys, xs = np.nonzero(alpha > 0.04)
    if not len(ys):
        return None
    pad = 3
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, rgba.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, rgba.shape[1])
    return Image.fromarray(rgba[y0:y1, x0:x1], "RGBA")


def cut_sheet(sheet):
    path = os.path.join(SRC, sheet["file"])
    im = Image.open(path).convert("RGB")
    out = {}
    group_dir = os.path.join(OUT, sheet["group"])
    os.makedirs(group_dir, exist_ok=True)
    if sheet.get("whole"):
        key = sheet["items"][0][0]
        w = sheet["whole"]["width"]
        img = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        name = f"{key}.jpg"
        img.save(os.path.join(group_dir, name), quality=86)
        out[f"{sheet['group']}/{key}"] = {"path": f"art/{sheet['group']}/{name}", "w": img.width, "h": img.height}
        return out
    rgb = np.asarray(im).astype(np.float32)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    ref = np.median(border, axis=0)
    fg = (np.sqrt(((rgb - ref) ** 2).sum(axis=2)) > 60).astype(np.float32)
    boxes = cell_boxes(fg, sheet["cols"], sheet["rows"])
    problems = []
    for (key, _), (x0, y0, x1, y1) in zip(sheet["items"], boxes):
        sprite = cut_cell(rgb[y0:y1, x0:x1], sheet["style"])
        if sprite is None:
            problems.append(f"{key}: empty cell")
            continue
        # a subject touching its cell edge was probably cut through
        if sprite.width >= (x1 - x0) - 2 or sprite.height >= (y1 - y0) - 2:
            problems.append(f"{key}: fills its whole cell (merged with a neighbour or a background left?)")
        h = sheet["height"]
        scale = min(1.0, h / sprite.height)
        sprite = sprite.resize((max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))), Image.LANCZOS)
        sprite.save(os.path.join(group_dir, f"{key}.png"), optimize=True)
        out[f"{sheet['group']}/{key}"] = {"path": f"art/{sheet['group']}/{key}.png", "w": sprite.width, "h": sprite.height}
    print(f"[{sheet['file']}] {len(out)}/{len(sheet['items'])} sprites")
    for p in problems:
        print("   check:", p)
    return out


def main():
    sheets = json.load(open(os.path.join(ROOT, "art", "sheets.json")))
    only = set(sys.argv[1:])
    manifest = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
    done = 0
    for sheet in sheets:
        stem = sheet["file"].rsplit(".", 1)[0]
        if only and stem not in only:
            continue
        if not os.path.exists(os.path.join(SRC, sheet["file"])):
            if only:
                print(f"[{sheet['file']}] not found in art/source")
            continue
        manifest.update(cut_sheet(sheet))
        done += 1
    json.dump(dict(sorted(manifest.items())), open(MANIFEST, "w"), indent=1)
    print(f"{done} sheet(s) cut, {len(manifest)} sprites in the manifest")


if __name__ == "__main__":
    main()
