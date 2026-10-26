import type { BreakthroughId, BuildingType, GovernmentType } from '../types.ts';
import { breakthroughDef, ERAS } from './eras.ts';

// v4 → v5: the simplified economy. Population and GDP become development;
// 27 buildings become 10, 18 governments become 7, the technology score
// becomes breakthroughs; artworks, natural wonders and realm events go.

const GOVERNMENT_MAP: Record<string, GovernmentType> = {
  'Tribal Council': 'Chiefdom',
  Chiefdom: 'Chiefdom',
  'Clan Confederation': 'Chiefdom',
  'Sacred Kingship': 'Monarchy',
  'Open Monarchy': 'Monarchy',
  'Feudal Monarchy': 'Monarchy',
  'Absolute Monarchy': 'Monarchy',
  'Constitutional Monarchy': 'Monarchy',
  'Imperial Court': 'Empire',
  'Military Junta': 'Empire',
  Dictatorship: 'Empire',
  Oligarchy: 'Merchant Republic',
  'Merchant Republic': 'Merchant Republic',
  Republic: 'Republic',
  Democracy: 'Democracy',
  Federation: 'Democracy',
  Theocracy: 'Theocracy',
  'Religious Monarchy': 'Theocracy',
};

const BUILDING_MAP: Record<string, BuildingType | undefined> = {
  Granary: 'Granary',
  Aqueduct: 'Granary',
  Hospital: 'Granary',
  Market: 'Market',
  'Trading Post': 'Market',
  Workshop: 'Market',
  'Road Network': 'Market',
  'Merchant Guild': 'Guild Hall',
  Bank: 'Guild Hall',
  'Stock Exchange': 'Guild Hall',
  Harbor: 'Harbor',
  Shipyard: 'Harbor',
  Barracks: 'Barracks',
  'Military Academy': 'Barracks',
  Forge: 'Barracks',
  Fortifications: 'Fortress',
  Shrine: 'Temple',
  Temple: 'Temple',
  Monastery: 'Temple',
  Cathedral: 'Temple',
  Courthouse: 'Temple',
  Library: 'Library',
  Observatory: 'Library',
  'Printing House': 'Library',
  'Artist Workshop': 'Library',
  Theater: 'Library',
  University: 'University',
};

const WONDER_KIND: Record<string, string[]> = {
  Scientific: ['library', 'observatory'],
  Military: ['wall'],
  Religious: ['temple', 'cathedral'],
  Commercial: ['bazaar', 'exchange'],
  Cultural: ['gardens'],
  Engineering: ['colossus', 'observatory'],
};

const TERRAIN_DEV: Record<string, number> = {
  plains: 3,
  forest: 2,
  desert: 1,
  mountain: 1,
  tundra: 1,
  ocean: 0,
};
const peoplePer = (era: number) =>
  ERAS[Math.max(0, Math.min(ERAS.length - 1, era - 1))].peoplePerDevelopment;
/** Old 0–1000 technology score to an approximate count of breakthroughs. */
const techToBreakthroughs = (tech: number | undefined) =>
  Math.max(0, Math.min(15, Math.round((tech ?? 0) / 70)));

export function economyFromV4(w: any) {
  // Breakthroughs and eras first: development depends on them.
  const eraOfRealm = new Map<number, number>();
  for (const c of w.civilizations ?? []) {
    c.breakthroughs = (c.knownTechnologies ?? []).map((k: any) => ({
      id: k.technologyId as BreakthroughId,
      year: k.discoveredYear,
      source:
        k.source === 'scholar' ? 'invented' : k.source === 'diffusion' ? 'spread' : 'founding',
      characterId: k.sourceCharacterId,
    }));
    c.era = c.breakthroughs.reduce(
      (n: number, b: any) => Math.max(n, breakthroughDef(b.id)?.era ?? 1),
      1,
    );
    eraOfRealm.set(c.id, c.era);
  }
  for (const p of w.provinces ?? []) {
    const era = p.ownerId ? (eraOfRealm.get(p.ownerId) ?? 1) : 1;
    const fromPeople = (p.population ?? 0) / peoplePer(era);
    p.development =
      p.terrain === 'ocean'
        ? 0
        : Math.max(TERRAIN_DEV[p.terrain] ?? 1, Math.min(40, Math.round(fromPeople * 10) / 10));
    for (const k of ['fertility', 'population', 'gdp', 'naturalWonderId', 'holySiteReligionIds'])
      delete p[k];
  }
  for (const con of w.continents ?? [])
    for (const k of [
      'traitName',
      'traitDescription',
      'populationBonus',
      'gdpBonus',
      'technologyBonus',
      'armyBonus',
      'cultureBonus',
    ])
      delete con[k];
  for (const c of w.civilizations ?? []) {
    c.government = GOVERNMENT_MAP[c.government] ?? 'Monarchy';
    for (const g of c.governmentHistory ?? [])
      g.government = GOVERNMENT_MAP[g.government] ?? 'Monarchy';
    c.development = Math.round(
      (c.provinces ?? []).reduce(
        (n: number, id: number) => n + (w.provinces[id]?.development ?? 0),
        0,
      ),
    );
    c.wealth = 0;
    c.manpower = 0;
    c.influence = 0;
    c.research = 0;
    for (const k of [
      'population',
      'urbanPopulation',
      'ruralPopulation',
      'gdp',
      'technology',
      'prestige',
      'technologyProgress',
      'technologyExposure',
      'historicalScore',
      'legacyScore',
      'knownTechnologies',
    ])
      delete c[k];
  }
  for (const city of w.cities ?? []) {
    const merged = new Map<BuildingType, any>();
    for (const b of city.buildings ?? []) {
      const type = BUILDING_MAP[b.type];
      if (!type) continue;
      const prev = merged.get(type);
      if (!prev || b.level > prev.level)
        merged.set(type, {
          id: b.id,
          type,
          builtYear: b.builtYear,
          builderId: b.builderId,
          level: Math.max(1, Math.min(5, b.level ?? 1)),
        });
    }
    city.buildings = [...merged.values()];
    city.wealth = 0;
    city.manpower = 0;
    city.influence = 0;
    for (const k of [
      'population',
      'prosperity',
      'infrastructure',
      'defense',
      'culturalImportance',
      'scientificImportance',
      'religiousImportance',
      'artworkIds',
    ])
      delete city[k];
  }
  for (const t of w.tradeRoutes ?? []) {
    t.bonus = t.gdpBonus ?? 0.05;
    delete t.gdpBonus;
  }
  for (const cul of w.cultures ?? [])
    for (const k of ['population', 'heritage', 'artworkIds']) delete cul[k];
  for (const rel of w.religions ?? []) for (const k of ['followers', 'loyalty']) delete rel[k];
  for (const d of w.dynasties ?? []) {
    d.peakWealth = 0;
    for (const k of ['peakGDP', 'peakPopulation', 'warsWon', 'wonderIds', 'historicalRelevance'])
      delete d[k];
  }
  for (const r of w.reigns ?? []) {
    const era = eraOfRealm.get(r.realmId) ?? 1;
    r.startBreakthroughs = techToBreakthroughs(r.startTechnology);
    r.endBreakthroughs =
      r.endTechnology === undefined ? undefined : techToBreakthroughs(r.endTechnology);
    r.startWealth = r.startGDP ?? 0;
    r.endWealth = r.endGDP;
    r.startDevelopment = Math.round((r.startPopulation ?? 0) / peoplePer(era));
    r.endDevelopment =
      r.endPopulation === undefined ? undefined : Math.round(r.endPopulation / peoplePer(era));
    for (const k of [
      'startTechnology',
      'endTechnology',
      'startGDP',
      'endGDP',
      'startPopulation',
      'endPopulation',
    ])
      delete r[k];
  }
  for (const war of w.wars ?? []) {
    war.goldTransferred = war.gdpTransferred ?? 0;
    delete war.gdpTransferred;
  }
  // Old wonders map to the new set by category; duplicates are dropped.
  const taken = new Set<string>();
  w.wonders = (w.wonders ?? []).flatMap((x: any) => {
    const kind = (WONDER_KIND[x.category] ?? []).find(k => !taken.has(k));
    if (!kind) return [];
    taken.add(kind);
    return [
      {
        id: x.id,
        kind,
        name: x.name,
        cityId: x.cityId,
        builderId: x.builderId,
        completedYear: x.completedYear,
      },
    ];
  });
  const keptWonders = new Set(w.wonders.map((x: any) => x.id));
  for (const city of w.cities ?? [])
    city.wonderIds = (city.wonderIds ?? []).filter((id: number) => keptWonders.has(id));
  for (const e of w.events ?? []) {
    e.breakthroughIds = e.technologyIds ?? [];
    delete e.technologyIds;
  }
  w.evolutionSnapshots = (w.evolutionSnapshots ?? []).map((snap: any) => ({
    year: snap.year,
    realms: (snap.realms ?? []).map((r: any) => ({
      realmId: r.realmId,
      name: r.name,
      color: r.color,
      rank: r.rank,
      continentId: r.continentId,
      greatPower: r.greatPower,
      development: Math.round((r.population ?? 0) / 2000),
      wealth: Math.round(r.gdp ?? 0),
      breakthroughs: techToBreakthroughs(r.technology),
      military: r.military ?? 0,
    })),
    worldDevelopment: Math.round((snap.worldPopulation ?? 0) / 2000),
    worldWealth: Math.round(snap.worldGDP ?? 0),
  }));
  for (const k of ['artworks', 'naturalWonders', 'realmEvents', 'usedHistoricalNames']) delete w[k];
  for (const k of ['artwork', 'naturalWonder', 'realmEvent']) delete w.nextIds[k];
  return w;
}
