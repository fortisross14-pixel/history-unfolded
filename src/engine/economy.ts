import type { Character, City, Civilization, Province, TradeRoute, WorldState } from '../types.ts';
import { RNG } from './rng.ts';
import { addEvent } from './events.ts';
import { addDeed, level } from './characters.ts';
import { idx } from './lookup.ts';
import { neigh } from './util.ts';
import { buildingTotal } from './buildings.ts';
import type { ModTotals } from './modifiers.ts';

// ---- Development -----------------------------------------------------------------

/** How developed each kind of land can become in the first era. */
const TERRAIN_DEV: Record<string, number> = {
  plains: 6,
  forest: 4,
  desert: 2,
  mountain: 2,
  tundra: 1.5,
  ocean: 0,
};

export const startingDevelopment = (terrain: string, r: RNG) =>
  terrain === 'ocean'
    ? 0
    : Math.max(1, Math.round((TERRAIN_DEV[terrain] ?? 2) * (0.35 + r.next() * 0.3)));

/** The most development a province can reach in this era; cities and granaries raise it. */
export function developmentCap(s: WorldState, p: Province, era: number) {
  const city = p.cityId ? idx(s).city.get(p.cityId) : undefined;
  const base = (TERRAIN_DEV[p.terrain] ?? 2) * (1 + 0.5 * (era - 1));
  const urban = city ? 3 + era * 1.5 + buildingTotal(city.buildings, 'devCap') : 0;
  return base + urban;
}

/** Owned provinces grow toward their cap; stable, growing realms grow faster. */
export function growDevelopment(s: WorldState, c: Civilization, mods: ModTotals) {
  const pace = 0.006 * (0.5 + c.stability / 100) * Math.max(0.2, 1 + mods.growth);
  for (const id of c.provinces) {
    const p = s.provinces[id];
    const cap = developmentCap(s, p, c.era);
    if (p.development < cap) p.development += (cap - p.development) * pace;
    else p.development -= (p.development - cap) * 0.02;
  }
}

/** Takes a share of development from a province (war, plague, disaster). */
export function damageProvince(p: Province, share: number) {
  p.development = Math.max(1, p.development * (1 - share));
}

// ---- Output -------------------------------------------------------------------------

export interface Part {
  label: string;
  value: number;
}

/** Where a realm total comes from: base parts, then percentage modifiers. */
export interface Breakdown {
  base: Part[];
  /** Percentage multiplier from modifiers (0.18 = +18%). */
  bonus: number;
  total: number;
}

export interface RealmOutput {
  development: number;
  wealth: Breakdown;
  manpower: Breakdown;
  influence: Breakdown;
  research: Breakdown;
}

const isCoastal = (s: WorldState, p: Province) => neigh(p, s).some(n => n.terrain === 'ocean');

/** One city's yearly wealth, manpower and influence from its development, buildings and trade. */
export function cityOutput(s: WorldState, city: City) {
  const p = s.provinces[city.provinceId];
  const capital = city.isCapital ? 1.5 : 1;
  const trade = city.tradeRouteIds.reduce(
    (n, id) => n + (s.tradeRoutes.find(t => t.id === id && t.active)?.bonus ?? 0),
    0,
  );
  city.wealth =
    p.development * 0.8 * capital * (1 + buildingTotal(city.buildings, 'wealth') + trade);
  city.manpower = p.development * 0.5 * (1 + buildingTotal(city.buildings, 'manpower'));
  city.influence = p.development * 0.3 * capital * (1 + buildingTotal(city.buildings, 'influence'));
}

const sum = (parts: Part[]) => parts.reduce((n, x) => n + x.value, 0);

function breakdown(base: Part[], bonus: number): Breakdown {
  const kept = base.filter(x => Math.abs(x.value) >= 0.05);
  return { base: kept, bonus, total: Math.max(0, sum(base) * Math.max(0.1, 1 + bonus)) };
}

/**
 * Realm totals with their sources: cities (and their buildings), the
 * countryside, then percentage modifiers from rulers, laws, breakthroughs.
 */
export function realmOutput(s: WorldState, c: Civilization, mods: ModTotals): RealmOutput {
  const cities = c.cityIds.map(id => idx(s).city.get(id)).filter((x): x is City => !!x);
  let ruralDev = 0;
  let development = 0;
  for (const id of c.provinces) {
    const p = s.provinces[id];
    development += p.development;
    if (!p.cityId) ruralDev += p.development;
  }
  for (const city of cities) cityOutput(s, city);
  const cityParts = (key: 'wealth' | 'manpower' | 'influence') =>
    cities.map(x => ({ label: x.name, value: x[key] }));
  const research =
    1 + development / 40 + cities.reduce((n, x) => n + buildingTotal(x.buildings, 'research'), 0);
  return {
    development,
    wealth: breakdown(
      [...cityParts('wealth'), { label: 'Countryside', value: ruralDev * 0.25 }],
      mods.wealth,
    ),
    manpower: breakdown(
      [...cityParts('manpower'), { label: 'Countryside', value: ruralDev * 0.5 }],
      mods.army,
    ),
    influence: breakdown(
      [...cityParts('influence'), { label: 'Countryside', value: ruralDev * 0.05 }],
      mods.influence,
    ),
    research: breakdown([{ label: 'Scholars of the realm', value: research }], mods.research),
  };
}

/** Soldiers per point of manpower grow with the era; sea powers keep smaller armies. */
export function armyCapacity(c: Civilization, manpower: number) {
  return Math.round(manpower * 50 * (1 + c.era * 0.5) * (1.1 - c.axes.horizon / 500));
}

/** Ships come from coastal development, seafaring spirit and harbours. */
export function navyCapacity(s: WorldState, c: Civilization, mods: ModTotals) {
  let coastalDev = 0;
  for (const id of c.provinces)
    if (isCoastal(s, s.provinces[id])) coastalDev += s.provinces[id].development;
  if (!coastalDev) return 0;
  const harbors = c.cityIds.reduce(
    (n, id) => n + buildingTotal(idx(s).city.get(id)?.buildings ?? [], 'navy'),
    0,
  );
  return Math.round(
    coastalDev * 6 * c.era * (c.axes.horizon / 100) ** 2 * Math.max(0.1, 1 + mods.navy + harbors),
  );
}

// ---- Trade ----------------------------------------------------------------------------

/**
 * A merchant links two cities, at home or in a friendly known realm. Each end
 * city earns a share more wealth while the route lasts.
 */
export function createRoute(s: WorldState, c: Civilization, p: Character, r: RNG) {
  const home = c.cityIds.map(id => idx(s).city.get(id)).filter((x): x is City => !!x);
  if (!home.length) return;
  const partners = c.knownRealmIds
    .map(id => idx(s).civ.get(id))
    .filter((x): x is Civilization => !!x && x.provinces.length > 0)
    .filter(
      x =>
        !s.wars.some(
          w => w.active && w.participantIds.includes(x.id) && w.participantIds.includes(c.id),
        ),
    )
    .flatMap(x => x.cityIds.map(id => idx(s).city.get(id)).filter((y): y is City => !!y));
  const a = r.pick(home);
  const pool = [...home.filter(x => x.id !== a.id), ...partners];
  const b = pool.length ? r.pick(pool) : undefined;
  if (!b) return;
  const exists = s.tradeRoutes.some(
    x =>
      x.active &&
      ((x.originCityId === a.id && x.destinationCityId === b.id) ||
        (x.originCityId === b.id && x.destinationCityId === a.id)),
  );
  if (exists) return;
  const route: TradeRoute = {
    id: s.nextIds.route++,
    name: `${a.name}–${b.name} Route`,
    originCityId: a.id,
    destinationCityId: b.id,
    founderId: p.id,
    createdYear: s.year,
    bonus: 0.04 + level(p) * 0.02,
    active: true,
  };
  s.tradeRoutes.push(route);
  a.tradeRouteIds.push(route.id);
  b.tradeRouteIds.push(route.id);
  addDeed(s, p, `Opened the ${route.name}`, 4 + level(p));
  addEvent(
    s,
    'economy',
    `${route.name} opens`,
    `${p.name} linked ${a.name} and ${b.name}: both cities earn ${Math.round(route.bonus * 100)}% more wealth.`,
    6,
    [c.id],
    {
      personIds: [p.id],
      cityIds: [a.id, b.id],
      tags: ['trade route'],
    },
  );
}

/** Routes close when a city is lost to war between the two ends' owners. */
export function closeBrokenRoutes(s: WorldState) {
  const wars = s.wars.filter(w => w.active);
  for (const t of s.tradeRoutes) {
    if (!t.active) continue;
    const a = idx(s).city.get(t.originCityId);
    const b = idx(s).city.get(t.destinationCityId);
    if (!a || !b) {
      t.active = false;
      continue;
    }
    const war = wars.some(
      w =>
        w.participantIds.includes(a.currentRealmId) &&
        w.participantIds.includes(b.currentRealmId) &&
        a.currentRealmId !== b.currentRealmId,
    );
    if (war) t.active = false;
  }
}
