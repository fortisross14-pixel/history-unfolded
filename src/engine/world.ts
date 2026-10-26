import { SAVE_VERSION } from './save.ts';
import type {
  Terrain,
  MapSize,
  Province,
  Continent,
  Culture,
  Civilization,
  WorldConfig,
  WorldState,
} from '../types.ts';
import { ROOTS, REAL_ROOTS, REAL_CONTINENTS, CONTINENT_NAMES, REALM_COLORS } from './data.ts';
import { chooseDatabase, uniqueProvinceName } from './naming.ts';
import { RNG } from './rng.ts';
import { neigh } from './util.ts';
import { createDynasty, newRuler } from './dynasty.ts';
import { rebuildIndex } from './lookup.ts';
import { initialAxes } from './axes.ts';
import { captureEvolutionSnapshot } from './records.ts';
import { startingDevelopment } from './economy.ts';
import { learn } from './research.ts';
import { createEarthWorld } from './scenarios.ts';

export const dims = (s: MapSize) =>
  s === 'small'
    ? { w: 22, h: 16 }
    : s === 'medium'
      ? { w: 46, h: 32 }
      : s === 'large'
        ? { w: 72, h: 50 }
        : { w: 112, h: 76 };

export const shapes = (variant: number, size: MapSize) => {
  const base = [
    [
      { cx: 0.22, cy: 0.46, rx: 0.18, ry: 0.34 },
      { cx: 0.7, cy: 0.42, rx: 0.2, ry: 0.28 },
      { cx: 0.66, cy: 0.78, rx: 0.12, ry: 0.12 },
    ],
    [
      { cx: 0.2, cy: 0.34, rx: 0.16, ry: 0.25 },
      { cx: 0.58, cy: 0.3, rx: 0.22, ry: 0.2 },
      { cx: 0.72, cy: 0.7, rx: 0.18, ry: 0.2 },
      { cx: 0.3, cy: 0.76, rx: 0.1, ry: 0.12 },
    ],
    [
      { cx: 0.25, cy: 0.48, rx: 0.21, ry: 0.35 },
      { cx: 0.72, cy: 0.5, rx: 0.2, ry: 0.34 },
      { cx: 0.49, cy: 0.2, rx: 0.08, ry: 0.1 },
      { cx: 0.49, cy: 0.82, rx: 0.09, ry: 0.1 },
    ],
  ][variant % 3];
  if (size === 'huge')
    return [
      ...base,
      { cx: 0.48, cy: 0.52, rx: 0.09, ry: 0.14 },
      { cx: 0.89, cy: 0.22, rx: 0.06, ry: 0.1 },
      { cx: 0.1, cy: 0.82, rx: 0.06, ry: 0.09 },
    ];
  return base;
};

export function terrainAt(
  x: number,
  y: number,
  w: number,
  h: number,
  variant: number,
  size: MapSize,
  r: RNG,
) {
  let con: number | null = null,
    best = 99;
  shapes(variant, size).forEach((s, i) => {
    const d = ((x / w - s.cx) / s.rx) ** 2 + ((y / h - s.cy) / s.ry) ** 2 + r.next() * 0.22;
    if (d < 1 && d < best) {
      best = d;
      con = i;
    }
  });
  if (con === null) return { terrain: 'ocean' as Terrain, continent: null };
  const q = r.next();
  return {
    terrain: (q < 0.11
      ? 'mountain'
      : q < 0.31
        ? 'forest'
        : q < 0.41
          ? 'desert'
          : q < 0.46
            ? 'tundra'
            : 'plains') as Terrain,
    continent: con,
  };
}

/** Procedural continents on a hex grid: the "Fantasy world" map. */
export function proceduralMap(cfg: WorldConfig, r: RNG) {
  const { w, h } = dims(cfg.mapSize);
  const provinces: Province[] = [];
  const usedNames = new Set<string>();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const g = terrainAt(x, y, w, h, cfg.mapVariant, cfg.mapSize, r);
      const id = y * w + x;
      provinces.push({
        id,
        name:
          g.terrain === 'ocean'
            ? `Ocean ${id + 1}`
            : uniqueProvinceName(cfg.nameMode, id, r, usedNames),
        x,
        y,
        terrain: g.terrain,
        continentId: g.continent,
        ownerId: null,
        development: startingDevelopment(g.terrain, r),
        cultureId: null,
        religionId: null,
        cityId: null,
      });
    }
  const ids = [
    ...new Set(provinces.map(p => p.continentId).filter((x): x is number => x !== null)),
  ];
  const continents: Continent[] = ids.map(id => ({
    id,
    name:
      (chooseDatabase(cfg.nameMode, r) ? REAL_CONTINENTS : CONTINENT_NAMES)[id] ??
      `Continent ${id + 1}`,
    provinceIds: provinces.filter(p => p.continentId === id).map(p => p.id),
  }));
  return { width: w, height: h, provinces, continents };
}

/** An empty world around a map: no realms yet. */
export function emptyWorld(
  cfg: WorldConfig,
  seed: number,
  year: number,
  map: { width: number; height: number; provinces: Province[]; continents: Continent[] },
): WorldState {
  return {
    version: SAVE_VERSION,
    seed,
    year,
    config: cfg,
    width: map.width,
    height: map.height,
    provinces: map.provinces,
    continents: map.continents,
    civilizations: [],
    cities: [],
    tradeRoutes: [],
    characters: [],
    cultures: [],
    religions: [],
    reigns: [],
    legacies: [],
    overrides: { realm: {}, city: {}, character: {}, dynasty: {}, continent: {}, war: {} },
    dynasties: [],
    wars: [],
    moments: [],
    wonders: [],
    relations: [],
    events: [],
    evolutionSnapshots: [],
    hallOfFame: [],
    seasons: [],
    nextIds: {
      civ: 1,
      city: 1,
      character: 1,
      culture: 1,
      religion: 1,
      event: 1,
      building: 1,
      route: 1,
      reign: 1,
      legacy: 1,
      dynasty: 1,
      war: 1,
      moment: 1,
      wonder: 1,
      relation: 1,
      hallOfFame: 1,
    },
  };
}

export interface NewRealm {
  name: string;
  root: string;
  color: string;
  provinceIds: number[];
  cultureId?: number;
  cultureName?: string;
  axes?: Civilization['axes'];
  /** House name for the founding dynasty; random when left out. */
  dynasty?: string;
}

/** Adds a realm (and, if needed, its culture) with a founding ruler. */
export function foundRealm(s: WorldState, o: NewRealm, r: RNG): Civilization {
  let cultureId = o.cultureId;
  if (cultureId === undefined) {
    const culture: Culture = {
      id: s.nextIds.culture++,
      name: o.cultureName ?? `${o.root} Culture`,
      color: o.color,
      founded: s.year,
      originRealmId: s.nextIds.civ,
      strength: 0,
      provinces: o.provinceIds.length,
    };
    s.cultures.push(culture);
    cultureId = culture.id;
  }
  const home = s.provinces[o.provinceIds[0]];
  const civ: Civilization = {
    id: s.nextIds.civ++,
    name: o.name,
    originTribe: o.root,
    color: o.color,
    rank: 'Tribe',
    founded: s.year,
    government: 'Chiefdom',
    capitalCityId: 0,
    cultureId,
    faithId: null,
    provinces: [...o.provinceIds],
    cityIds: [],
    development: 0,
    wealth: 0,
    manpower: 0,
    influence: 0,
    armySize: r.int(15, 55),
    armyCapacity: 0,
    navy: 0,
    navyCapacity: 0,
    stability: r.int(45, 80),
    research: 0,
    era: 1,
    breakthroughs: [],
    knownContinentIds: home.continentId !== null ? [home.continentId] : [],
    knownRealmIds: [],
    continentExposure: {},
    rulerId: 0,
    heirId: 0,
    regentId: 0,
    dynastyId: null,
    historyEventIds: [],
    warIds: [],
    axes:
      o.axes ??
      initialAxes(
        r,
        neigh(home, s).some(n => n.terrain === 'ocean'),
      ),
    power: 0,
    peakProvinces: o.provinceIds.length,
    peakYear: s.year,
    governmentHistory: [{ government: 'Chiefdom', from: s.year, reason: 'Founding' }],
    nameHistory: [{ name: o.name, rank: 'Tribe', from: s.year, reason: 'Founding' }],
  };
  for (const id of o.provinceIds) {
    s.provinces[id].ownerId = civ.id;
    s.provinces[id].cultureId = cultureId;
  }
  s.civilizations.push(civ);
  rebuildIndex(s);
  if (o.dynasty) createDynasty(s, civ, r, o.dynasty);
  newRuler(s, civ, r, 'the founding of the realm', !o.dynasty);
  return civ;
}

/** Realms on the same continent know each other from the start. */
export function introduceNeighbours(s: WorldState) {
  for (const c of s.civilizations) {
    const home = s.provinces[c.provinces[0]].continentId;
    c.knownRealmIds = s.civilizations
      .filter(x => x.id !== c.id && s.provinces[x.provinces[0]].continentId === home)
      .map(x => x.id);
  }
}

/** A new procedural world in 3000 BCE: scattered tribes, one with farming per continent. */
export function createWorld(cfg: WorldConfig, seed = Date.now()): WorldState {
  if (cfg.map === 'earth') return createEarthWorld(cfg, seed);
  const r = new RNG(seed);
  const s = emptyWorld(cfg, seed, -3000, proceduralMap(cfg, r));
  const land = s.provinces.filter(p => p.terrain !== 'ocean');
  for (let i = 0; i < Math.min(cfg.tribeCount, land.length); i++) {
    const free = land.filter(p => p.ownerId === null && neigh(p, s).every(n => n.ownerId === null));
    const home = r.pick(free.length ? free : land.filter(p => p.ownerId === null));
    if (!home) break;
    const rootPool = chooseDatabase(cfg.nameMode, r) ? REAL_ROOTS : ROOTS;
    const root = rootPool[i % rootPool.length] + (i >= rootPool.length ? i : '');
    foundRealm(
      s,
      {
        name: `${root} Tribe`,
        root,
        color: REALM_COLORS[i % REALM_COLORS.length],
        provinceIds: [home.id],
      },
      r,
    );
  }
  introduceNeighbours(s);
  for (const con of s.continents) {
    const candidates = s.civilizations.filter(
      c => s.provinces[c.provinces[0]].continentId === con.id,
    );
    if (candidates.length) learn(s, r.pick(candidates), 'agriculture', 'founding');
  }
  captureEvolutionSnapshot(s);
  return s;
}
