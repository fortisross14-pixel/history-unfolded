/**
 * Pointy-top hexes in an "odd-r" offset grid: odd rows are shifted half a hex to the right.
 * A hex is addressed by its index `r * width + c`. The map does not wrap.
 */
export const SQRT3 = Math.sqrt(3);

export interface Grid {
  w: number;
  h: number;
}

export const idx = (g: Grid, c: number, r: number) => r * g.w + c;
export const col = (g: Grid, i: number) => i % g.w;
export const row = (g: Grid, i: number) => Math.floor(i / g.w);
export const inBounds = (g: Grid, c: number, r: number) => c >= 0 && r >= 0 && c < g.w && r < g.h;

// neighbour offsets for even and odd rows, in order E, NE, NW, W, SW, SE
const EVEN: [number, number][] = [
  [1, 0],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];
const ODD: [number, number][] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [0, 1],
  [1, 1],
];

export function neighbors(g: Grid, i: number): number[] {
  const c = col(g, i),
    r = row(g, i);
  const out: number[] = [];
  for (const [dc, dr] of r & 1 ? ODD : EVEN) {
    const nc = c + dc,
      nr = r + dr;
    if (inBounds(g, nc, nr)) out.push(idx(g, nc, nr));
  }
  return out;
}

function toCube(g: Grid, i: number): [number, number, number] {
  const c = col(g, i),
    r = row(g, i);
  const x = c - (r - (r & 1)) / 2;
  const z = r;
  return [x, -x - z, z];
}

export function distance(g: Grid, a: number, b: number): number {
  const [ax, ay, az] = toCube(g, a);
  const [bx, by, bz] = toCube(g, b);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

/** All hexes within `radius` of `center`, center included. */
export function within(g: Grid, center: number, radius: number): number[] {
  const out: number[] = [];
  const c0 = col(g, center),
    r0 = row(g, center);
  for (let r = r0 - radius; r <= r0 + radius; r++) {
    for (let c = c0 - radius - 1; c <= c0 + radius + 1; c++) {
      if (!inBounds(g, c, r)) continue;
      const i = idx(g, c, r);
      if (distance(g, center, i) <= radius) out.push(i);
    }
  }
  return out;
}

// --- pixel geometry (used by the renderer and by map generation for "real" distances) ---

/** Hex centre in units of the hex radius (corner distance = 1). */
export function centerUnit(g: Grid, i: number): [number, number] {
  const c = col(g, i),
    r = row(g, i);
  return [SQRT3 * (c + 0.5 * (r & 1)) + SQRT3 / 2, 1.5 * r + 1];
}

export function pixelSizeUnit(g: Grid): [number, number] {
  return [SQRT3 * (g.w + 0.5), 1.5 * (g.h - 1) + 2];
}

/** Which hex contains a point given in hex-radius units, or -1. */
export function hexAtUnit(g: Grid, x: number, y: number): number {
  // approximate row/col, then test the nearby candidates by distance to centre
  const r0 = Math.round((y - 1) / 1.5);
  let best = -1,
    bd = Infinity;
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    const c0 = Math.round((x - SQRT3 / 2) / SQRT3 - 0.5 * (r & 1));
    for (let c = c0 - 1; c <= c0 + 1; c++) {
      if (!inBounds(g, c, r)) continue;
      const i = idx(g, c, r);
      const [cx, cy] = centerUnit(g, i);
      const d = (cx - x) ** 2 + (cy - y) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
  }
  return bd <= 1 ? best : -1;
}
