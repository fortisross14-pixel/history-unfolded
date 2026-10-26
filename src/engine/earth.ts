import type { Continent, Province, Terrain } from '../types.ts';
import earth from '../data/earth.json' with { type: 'json' };
import { RNG } from './rng.ts';
import { startingDevelopment } from './economy.ts';

const TERRAIN: Record<string, Terrain> = {
  o: 'ocean',
  p: 'plains',
  f: 'forest',
  d: 'desert',
  m: 'mountain',
  t: 'tundra',
};

/** Longitude and latitude of a hex centre on the Earth map. */
export function lonLat(x: number, y: number): [number, number] {
  return [
    -180 + (x + 0.5) * earth.lonStep,
    earth.latTop - (y + 0.5 + (x % 2 ? 0.5 : 0)) * earth.latStep,
  ];
}

/** Continents grouped by the landmass they share, for who knows whom at the start. */
export const LANDMASS: Record<string, number> = {
  Europe: 0,
  Asia: 0,
  Africa: 0,
  'North America': 1,
  'South America': 1,
  Oceania: 2,
};

/** The real-world map: about 600 named regions with terrain, coasts and rivers. */
export function earthMap(r: RNG) {
  const { width, height } = earth;
  const provinces: Province[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const id = y * width + x;
      const terrain = TERRAIN[earth.terrain[id]] ?? 'ocean';
      const continent = earth.continent[id];
      provinces.push({
        id,
        name: earth.names[id] ?? `Ocean ${id + 1}`,
        x,
        y,
        terrain,
        continentId: continent >= 0 ? continent : null,
        ownerId: null,
        development: startingDevelopment(terrain, r),
        river: earth.rivers[id] === '1' || undefined,
        cultureId: null,
        religionId: null,
        cityId: null,
      });
    }
  const continents: Continent[] = earth.continents.map((name, id) => ({
    id,
    name,
    provinceIds: provinces.filter(p => p.continentId === id).map(p => p.id),
  }));
  return { width, height, provinces, continents };
}
