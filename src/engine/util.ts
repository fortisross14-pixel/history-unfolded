import type { TechnologyId, Province, Civilization, WorldState } from '../types.ts';

export const displayYear = (y: number) => (y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`);

export const eraName = (y: number) =>
  y < -1200
    ? 'Ancient Dawn'
    : y < 500
      ? 'Classical Age'
      : y < 1400
        ? 'Age of Kingdoms'
        : y < 1750
          ? 'Age of Discovery'
          : y < 1900
            ? 'Industrial Age'
            : 'Modern Age';

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

export const has = (c: Civilization, t: TechnologyId) =>
  c.knownTechnologies.some(k => k.technologyId === t);

export const cityLevel = (p: number) =>
  p > 300000
    ? 'Metropolis'
    : p > 70000
      ? 'City'
      : p > 15000
        ? 'Town'
        : p > 3000
          ? 'Settlement'
          : 'Village';

export const pct = (v: number) => Math.max(-99.9, Math.min(999.9, v));

export const urbanTarget = (year: number, tech: number) =>
  Math.max(
    0.02,
    Math.min(
      0.72,
      (year < -1500
        ? 0.045
        : year < 0
          ? 0.08
          : year < 1000
            ? 0.12
            : year < 1500
              ? 0.18
              : year < 1800
                ? 0.25
                : year < 1950
                  ? 0.42
                  : 0.58) +
        tech / 5000,
    ),
  );

export const provinceReligionFollowers = (s: WorldState, id: number) =>
  s.provinces.filter(p => p.religionId === id).reduce((n, p) => n + p.population, 0);

export function signedPct(n: number) {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
}

export function recalcRealmFromProvinces(s: WorldState, c: Civilization) {
  const ps = c.provinces.map(id => s.provinces[id]).filter(Boolean);
  c.population = Math.max(0, Math.round(ps.reduce((n, p) => n + p.population, 0)));
  c.gdp = Math.max(
    0.1,
    ps.reduce((n, p) => n + p.gdp, 0),
  );
  c.urbanPopulation = c.cityIds
    .map(id => s.cities.find(x => x.id === id)?.population ?? 0)
    .reduce((a, b) => a + b, 0);
  c.urbanPopulation = Math.min(c.population, c.urbanPopulation);
  c.ruralPopulation = Math.max(0, c.population - c.urbanPopulation);
}

export function distance(s: WorldState, a: number, b: number) {
  const A = s.provinces[a],
    B = s.provinces[b];
  return Math.max(Math.abs(A.x - B.x), Math.abs(A.y - B.y));
}
