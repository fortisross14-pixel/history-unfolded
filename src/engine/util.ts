import type { Province, Civilization, WorldState } from '../types.ts';

export const displayYear = (y: number) => (y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`);

// Neighbour lists never change for a map, so they are computed once per map.
const neighbourCache = new WeakMap<Province[], Province[][]>();

function buildNeighbours(s: WorldState) {
  const all = s.provinces.map(p => {
    const odd = p.x % 2;
    const ds = odd
      ? [
          [1, 0],
          [-1, 0],
          [0, -1],
          [0, 1],
          [1, 1],
          [-1, 1],
        ]
      : [
          [1, 0],
          [-1, 0],
          [0, -1],
          [0, 1],
          [1, -1],
          [-1, -1],
        ];
    const out: Province[] = [];
    for (const [dx, dy] of ds) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (x < 0 || x >= s.width || y < 0 || y >= s.height) continue;
      const n = s.provinces[y * s.width + x];
      if (n) out.push(n);
    }
    return out;
  });
  neighbourCache.set(s.provinces, all);
  return all;
}

/** The (up to six) hexes around a province. */
export function neigh(p: Province, s: WorldState): Province[] {
  return (neighbourCache.get(s.provinces) ?? buildNeighbours(s))[p.id];
}

/** Living realms that share a land border with this realm. */
export function neighborRealms(s: WorldState, c: Civilization): Civilization[] {
  const ids = new Set<number>();
  for (const id of c.provinces)
    for (const n of neigh(s.provinces[id], s))
      if (n.ownerId && n.ownerId !== c.id) ids.add(n.ownerId);
  return [...ids]
    .map(id => s.civilizations.find(x => x.id === id))
    .filter((x): x is Civilization => !!x && x.provinces.length > 0);
}

export function distance(s: WorldState, a: number, b: number) {
  const A = s.provinces[a],
    B = s.provinces[b];
  return Math.max(Math.abs(A.x - B.x), Math.abs(A.y - B.y));
}
