import type {
  TechnologyId,
  BuildingType,
  BuildingRarity,
  City,
  TradeRoute,
  Character,
  Civilization,
  WorldState,
} from '../types.ts';
import { RNG } from './rng.ts';
import { addEvent } from './events.ts';
import { addDeed } from './characters.ts';
import { level } from './culture.ts';

export const BUILDINGS: {
  type: BuildingType;
  tech: number;
  requires?: TechnologyId;
  coastal?: boolean;
  g: number;
  a: number;
  s: number;
  c: number;
}[] = [
  { type: 'Granary', tech: 20, g: 0.01, a: 0, s: 0, c: 0 },
  { type: 'Road Network', tech: 25, g: 0.015, a: 0.01, s: 0, c: 0 },
  { type: 'Workshop', tech: 35, g: 0.015, a: 0, s: 0.01, c: 0 },
  { type: 'Forge', tech: 70, requires: 'bronze', g: 0.01, a: 0.025, s: 0.01, c: 0 },
  { type: 'Aqueduct', tech: 130, g: 0.015, a: 0, s: 0.01, c: 0.01 },
  { type: 'Observatory', tech: 260, g: 0, a: 0, s: 0.06, c: 0.02 },
  {
    type: 'Shipyard',
    tech: 180,
    requires: 'deep_sailing',
    coastal: true,
    g: 0.025,
    a: 0.035,
    s: 0.01,
    c: 0,
  },
  { type: 'Courthouse', tech: 160, g: 0.02, a: 0.005, s: 0, c: 0.01 },
  { type: 'Shrine', tech: 15, g: 0, a: 0, s: 0, c: 0.02 },
  { type: 'Temple', tech: 70, g: 0.005, a: 0, s: 0.005, c: 0.04 },
  { type: 'Monastery', tech: 170, requires: 'writing', g: 0.005, a: 0, s: 0.025, c: 0.05 },
  { type: 'Cathedral', tech: 320, g: 0.01, a: 0, s: 0.01, c: 0.08 },
  { type: 'Trading Post', tech: 30, g: 0.02, a: 0, s: 0, c: 0 },
  { type: 'Market', tech: 80, requires: 'money', g: 0.04, a: 0, s: 0, c: 0 },
  {
    type: 'Harbor',
    tech: 100,
    requires: 'deep_sailing',
    coastal: true,
    g: 0.05,
    a: 0.01,
    s: 0,
    c: 0,
  },
  { type: 'Barracks', tech: 60, g: 0, a: 0.05, s: 0, c: 0 },
  { type: 'Fortifications', tech: 120, g: 0, a: 0.04, s: 0, c: 0 },
  { type: 'Library', tech: 100, requires: 'writing', g: 0, a: 0, s: 0.04, c: 0.03 },
  { type: 'University', tech: 300, g: 0, a: 0, s: 0.08, c: 0.04 },
  { type: 'Merchant Guild', tech: 180, requires: 'money', g: 0.06, a: 0, s: 0, c: 0 },
  { type: 'Bank', tech: 420, requires: 'money', g: 0.08, a: 0, s: 0, c: 0 },
  { type: 'Stock Exchange', tech: 600, requires: 'money', g: 0.12, a: 0, s: 0, c: 0 },
  { type: 'Military Academy', tech: 350, g: 0, a: 0.09, s: 0.02, c: 0 },
  { type: 'Printing House', tech: 450, requires: 'printing', g: 0.01, a: 0, s: 0.05, c: 0.08 },
  { type: 'Hospital', tech: 600, g: 0.02, a: 0, s: 0.02, c: 0 },
  { type: 'Artist Workshop', tech: 80, g: 0.01, a: 0, s: 0, c: 0.04 },
  { type: 'Theater', tech: 250, g: 0.02, a: 0, s: 0, c: 0.08 },
];

export const BUILDING_RARITIES: BuildingRarity[] = [
  'Common',
  'Uncommon',
  'Rare',
  'Epic',
  'Legendary',
];

/** Builder rarity sets the starting quality; Patron characters build one tier finer. */
export const buildingLevel = (p?: Character): 1 | 2 | 3 | 4 | 5 =>
  p ? (Math.min(5, level(p) + (p.traits.includes('Patron') ? 1 : 0)) as 1 | 2 | 3 | 4 | 5) : 1;

export const buildingMultiplier = (level: number, seed: number) => {
  const ranges = [
    [0.7, 0.95],
    [1.1, 1.5],
    [1.7, 2.2],
    [2.8, 3.5],
    [5.5, 7.0],
  ];
  const [lo, hi] = ranges[level - 1];
  const noise = ((seed * 9301 + 49297) % 233280) / 233280;
  return lo + (hi - lo) * noise;
};

export function applyBuildingStats(
  b: any,
  def = BUILDINGS.find(x => x.type === b.type) ?? BUILDINGS[0],
) {
  const m = buildingMultiplier(b.level, b.id + b.lastUpgradedYear);
  b.rarity = BUILDING_RARITIES[b.level - 1];
  b.gdpBonus = def.g * m;
  b.armyBonus = def.a * m;
  b.scienceBonus = def.s * m;
  b.cultureBonus = def.c * m;
  b.impact = Math.round((b.gdpBonus + b.armyBonus + b.scienceBonus + b.cultureBonus) * 1000);
}

export function build(
  s: WorldState,
  c: Civilization,
  city: City,
  def = BUILDINGS[0],
  p?: Character,
) {
  const existing = city.buildings.find(x => x.type === def.type);
  if (existing) {
    const from = existing.rarity;
    const next = Math.min(5, existing.level + buildingLevel(p)) as 1 | 2 | 3 | 4 | 5;
    if (next === existing.level) return;
    existing.level = next;
    existing.lastUpgradedYear = s.year;
    existing.lastBuilderId = p?.id;
    existing.upgradeHistory.push({
      year: s.year,
      characterId: p?.id,
      from,
      to: BUILDING_RARITIES[next - 1],
    });
    applyBuildingStats(existing, def);
    if (p) {
      if (next >= 3) addDeed(s, p, `Raised ${existing.name} to ${existing.rarity}`, next);
    }
    addEvent(
      s,
      'city',
      `${existing.name} reaches ${existing.rarity}`,
      `${p?.name ?? c.name} upgraded ${existing.name} in ${city.name} from ${from} to ${existing.rarity}.`,
      6,
      [c.id],
      {
        personIds: p ? [p.id] : [],
        cityIds: [city.id],
        tags: ['building upgrade', def.type, existing.rarity],
      },
    );
    return;
  }
  const level = buildingLevel(p),
    b: any = {
      id: s.nextIds.building++,
      type: def.type,
      name: `${city.name} ${def.type}`,
      builtYear: s.year,
      lastUpgradedYear: s.year,
      builderId: p?.id,
      lastBuilderId: p?.id,
      realmIdAtConstruction: c.id,
      rarity: BUILDING_RARITIES[level - 1],
      level,
      impact: 0,
      gdpBonus: 0,
      armyBonus: 0,
      scienceBonus: 0,
      cultureBonus: 0,
      upgradeHistory: [{ year: s.year, characterId: p?.id, to: BUILDING_RARITIES[level - 1] }],
    };
  applyBuildingStats(b, def);
  city.buildings.push(b);
  if (p) {
    if (level >= 3) addDeed(s, p, `Built the ${b.name}`, level);
  }
  addEvent(
    s,
    'city',
    `${b.name} opens`,
    `${p?.name ?? c.name} established a ${b.rarity.toLowerCase()} ${def.type.toLowerCase()} in ${city.name}.`,
    5 + level,
    [c.id],
    { personIds: p ? [p.id] : [], cityIds: [city.id], tags: ['building', def.type, b.rarity] },
  );
}

export function createRoute(s: WorldState, c: Civilization, p: Character, r: RNG) {
  if (c.cityIds.length < 2) return;
  const cities = c.cityIds.map(id => s.cities.find(x => x.id === id)!).filter(Boolean);
  const a = r.pick(cities),
    b = r.pick(cities.filter(x => x.id !== a.id));
  if (
    !b ||
    s.tradeRoutes.some(
      x =>
        x.active &&
        ((x.originCityId === a.id && x.destinationCityId === b.id) ||
          (x.originCityId === b.id && x.destinationCityId === a.id)),
    )
  )
    return;
  const route: TradeRoute = {
    id: s.nextIds.route++,
    name: `${a.name}–${b.name} Route`,
    originCityId: a.id,
    destinationCityId: b.id,
    founderId: p.id,
    createdYear: s.year,
    gdpBonus: 0.04 + level(p) * 0.012,
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
    `${p.name} linked ${a.name} and ${b.name}, increasing commerce across ${c.name}.`,
    7,
    [c.id],
    { personIds: [p.id], cityIds: [a.id, b.id], tags: ['trade route'] },
  );
}
