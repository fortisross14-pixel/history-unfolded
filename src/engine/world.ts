import { SAVE_VERSION } from './save.ts';
import type {
  Terrain,
  MapSize,
  Province,
  Continent,
  Culture,
  NaturalWonder,
  Civilization,
  WorldConfig,
  WorldState,
} from '../types.ts';
import {
  ROOTS,
  REAL_ROOTS,
  REAL_CONTINENTS,
  CONTINENT_NAMES,
  NATURAL_POOL,
  REALM_COLORS,
  CONTINENT_TRAITS,
} from './data.ts';
import { chooseDatabase, uniqueProvinceName } from './naming.ts';
import { RNG } from './rng.ts';
import { neigh } from './util.ts';
import { createDynasty, createRuler } from './characters.ts';
import { discover } from './technology.ts';
import { battle } from './war.ts';
import { historicalScore, captureEvolutionSnapshot } from './records.ts';

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

export function createWorld(cfg: WorldConfig, seed = Date.now()): WorldState {
  const r = new RNG(seed),
    { w, h } = dims(cfg.mapSize),
    provinces: Province[] = [],
    usedProvinceNames = new Set<string>();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const g = terrainAt(x, y, w, h, cfg.mapVariant, cfg.mapSize, r),
        id = y * w + x;
      provinces.push({
        id,
        name:
          g.terrain === 'ocean'
            ? `Ocean ${id + 1}`
            : uniqueProvinceName(cfg.nameMode, id, r, usedProvinceNames),
        x,
        y,
        terrain: g.terrain,
        continentId: g.continent,
        fertility:
          g.terrain === 'plains'
            ? r.int(60, 95)
            : g.terrain === 'forest'
              ? r.int(40, 75)
              : g.terrain === 'ocean'
                ? 0
                : r.int(10, 45),
        ownerId: null,
        population: g.terrain === 'ocean' ? 0 : r.int(120, 650),
        gdp: g.terrain === 'ocean' ? 0 : r.int(1, 5),
        cultureId: null,
        religionId: null,
        cityId: null,
        naturalWonderId: null,
        holySiteReligionIds: [],
      });
    }
  const ids = [
      ...new Set(provinces.map(p => p.continentId).filter((x): x is number => x !== null)),
    ],
    continents: Continent[] = ids.map((id, i) => {
      const trait = CONTINENT_TRAITS[i % CONTINENT_TRAITS.length];
      return {
        id,
        name:
          (chooseDatabase(cfg.nameMode, r) ? REAL_CONTINENTS : CONTINENT_NAMES)[id] ??
          `Continent ${id + 1}`,
        provinceIds: provinces.filter(p => p.continentId === id).map(p => p.id),
        traitName: trait.name,
        traitDescription: trait.description,
        populationBonus: trait.populationBonus,
        gdpBonus: trait.gdpBonus,
        technologyBonus: trait.technologyBonus,
        armyBonus: trait.armyBonus,
        cultureBonus: trait.cultureBonus,
      };
    });
  const s: WorldState = {
    version: SAVE_VERSION,
    seed,
    year: -3000,
    config: cfg,
    width: w,
    height: h,
    provinces,
    continents,
    civilizations: [],
    cities: [],
    tradeRoutes: [],
    people: [],
    cultures: [],
    religions: [],
    rulers: [],
    dynasties: [],
    wars: [],
    battles: [],
    artworks: [],
    wonders: [],
    naturalWonders: [],
    rivalries: [],
    events: [],
    realmEvents: [],
    evolutionSnapshots: [],
    hallOfFame: [],
    usedHistoricalNames: [],
    nextIds: {
      civ: 1,
      city: 1,
      person: 1,
      culture: 1,
      religion: 1,
      event: 1,
      building: 1,
      route: 1,
      ruler: 1,
      dynasty: 1,
      war: 1,
      battle: 1,
      artwork: 1,
      wonder: 1,
      naturalWonder: 1,
      rivalry: 1,
      realmEvent: 1,
      hallOfFame: 1,
    },
  };
  const land = provinces.filter(p => p.terrain !== 'ocean');
  for (const def of NATURAL_POOL.slice(
    0,
    Math.min(NATURAL_POOL.length, Math.max(3, continents.length * 2)),
  )) {
    const free = land.filter(p => p.naturalWonderId === null);
    if (!free.length) break;
    const p = r.pick(free),
      nw: NaturalWonder = {
        id: s.nextIds.naturalWonder++,
        name: def[0],
        provinceId: p.id,
        effect: def[1],
        gdpBonus: def[2],
        armyBonus: def[3],
        cultureBonus: def[4],
        prestigeBonus: def[5],
      };
    s.naturalWonders.push(nw);
    p.naturalWonderId = nw.id;
  }
  for (let i = 0; i < Math.min(cfg.tribeCount, land.length); i++) {
    const free = land.filter(p => p.ownerId === null && neigh(p, s).every(n => n.ownerId === null));
    const home = r.pick(free.length ? free : land.filter(p => p.ownerId === null));
    if (!home) break;
    const rootPool = chooseDatabase(cfg.nameMode, r) ? REAL_ROOTS : ROOTS;
    const root = rootPool[i % rootPool.length] + (i >= rootPool.length ? i : '');
    const culture = {
      id: s.nextIds.culture++,
      name: `${root} Culture`,
      color: REALM_COLORS[i % REALM_COLORS.length],
      population: home.population,
      founded: s.year,
      originRealmId: s.nextIds.civ,
      peacefulViolent: r.int(-5, 5),
      economicCreative: r.int(-5, 5),
      unstableStable: r.int(-5, 5),
      strength: r.int(25, 55),
      heritage: [],
      artworkIds: [],
      provinces: 1,
    };
    s.cultures.push(culture);
    const civ: Civilization = {
      id: s.nextIds.civ++,
      name: `${root} Tribe`,
      originTribe: root,
      color: culture.color,
      rank: 'Tribe',
      founded: s.year,
      government: 'Tribal Council',
      capitalCityId: 0,
      cultureId: culture.id,
      faithId: null,
      population: home.population,
      urbanPopulation: 0,
      ruralPopulation: home.population,
      gdp: Math.max(0.1, home.gdp),
      armySize: r.int(15, 55),
      armyCapacity: 0,
      technology: r.int(2, 8),
      stability: r.int(45, 80),
      prestige: r.int(2, 12),
      provinces: [home.id],
      cityIds: [],
      knownTechnologies: [],
      technologyProgress: {},
      knownContinentIds: [home.continentId!],
      knownRealmIds: [],
      continentExposure: {},
      technologyExposure: {},
      rulerId: 0,
      dynastyId: null,
      historyEventIds: [],
      warIds: [],
      rivalryIds: [],
      historicalScore: 0,
      legacyScore: 0,
      governmentHistory: [{ government: 'Tribal Council', from: s.year, reason: 'Founding' }],
      nameHistory: [{ name: `${root} Tribe`, rank: 'Tribe', from: s.year, reason: 'Founding' }],
    };
    civ.armyCapacity = civ.armySize;
    home.ownerId = civ.id;
    home.cultureId = culture.id;
    s.civilizations.push(civ);
    createDynasty(s, civ, r);
    createRuler(s, civ, r, 'founding');
  }
  for (const c of s.civilizations)
    c.knownRealmIds = s.civilizations
      .filter(
        x =>
          x.id !== c.id &&
          s.provinces[x.provinces[0]].continentId === s.provinces[c.provinces[0]].continentId,
      )
      .map(x => x.id);
  for (const con of s.continents) {
    const candidates = s.civilizations.filter(
      c => s.provinces[c.provinces[0]].continentId === con.id,
    );
    if (candidates.length) discover(s, r.pick(candidates), 'agriculture');
  }
  captureEvolutionSnapshot(s);
  return s;
}
