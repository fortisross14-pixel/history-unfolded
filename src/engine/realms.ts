import type {
  Rank,
  GovernmentType,
  Province,
  City,
  Character,
  War,
  Civilization,
  WorldState,
} from '../types.ts';
import { RNG } from './rng.ts';
import { neigh, cityLevel, recalcRealmFromProvinces } from './util.ts';
import { cityNameFor, politicalCoreName } from './naming.ts';
import { addEvent } from './events.ts';
import { createDynasty, crown, deposeRuler, newRuler } from './dynasty.ts';
import { addDeed, fullName } from './characters.ts';
import { idx } from './lookup.ts';
import { addRelation } from './diplomacy.ts';
import { historicalScore } from './records.ts';

export const rankFor = (c: Civilization, continentLand: number, existingEmpires: number): Rank => {
  const share = c.provinces.length / Math.max(1, continentLand);
  if (c.provinces.length >= 28 && share >= 0.12 && existingEmpires < 3) return 'Empire';
  if (c.provinces.length >= 18) return 'Kingdom';
  if (c.provinces.length >= 8) return 'Duchy';
  if (c.provinces.length >= 4 && c.population >= 2200) return 'City-State';
  if (c.provinces.length >= 2) return 'Settlement';
  return 'Tribe';
};

/** The government a realm drifts toward, from its era, size and national character. */
export const governmentFor = (c: Civilization, year: number): GovernmentType => {
  const a = c.axes;
  if (year >= 1800 && c.technology >= 650) {
    if (a.order > 70) return 'Federation';
    if (c.stability < 28) return 'Dictatorship';
    if (c.stability > 72 && c.population > 250000)
      return c.rank === 'Empire' ? 'Federation' : 'Democracy';
    return 'Constitutional Monarchy';
  }
  if (year >= 1200 && c.technology >= 430) {
    if (c.stability < 30) return 'Military Junta';
    if (c.gdp > c.population / 350) return 'Merchant Republic';
    return c.rank === 'Empire' ? 'Imperial Court' : 'Constitutional Monarchy';
  }
  // Strong national character overrides the usual path.
  if (a.faith < 22 && c.faithId)
    return c.rank === 'Kingdom' || c.rank === 'Empire' ? 'Religious Monarchy' : 'Theocracy';
  if (a.economy > 72 && a.order > 50 && c.rank !== 'Empire') return 'Merchant Republic';
  if (a.order > 78) return year < 0 ? 'Clan Confederation' : 'Oligarchy';
  if (a.order < 22 && a.ambition > 60 && (c.rank === 'Kingdom' || c.rank === 'Empire'))
    return c.rank === 'Empire' ? 'Imperial Court' : 'Absolute Monarchy';
  if (c.rank === 'Tribe') return c.population > 20000 ? 'Chiefdom' : 'Tribal Council';
  if (c.rank === 'Settlement') return c.stability > 60 ? 'Clan Confederation' : 'Chiefdom';
  if (c.rank === 'City-State')
    return c.gdp > c.population / 500
      ? 'Merchant Republic'
      : c.faithId
        ? 'Sacred Kingship'
        : 'Open Monarchy';
  if (c.rank === 'Duchy')
    return year < 500 ? 'Feudal Monarchy' : c.stability < 35 ? 'Military Junta' : 'Open Monarchy';
  if (c.rank === 'Kingdom') return year < 1200 ? 'Feudal Monarchy' : 'Absolute Monarchy';
  return c.stability < 28 ? 'Dictatorship' : 'Imperial Court';
};

export function createCity(s: WorldState, c: Civilization, p: Province, r: RNG, capital = false) {
  const coastal = neigh(p, s).some(n => n.terrain === 'ocean');
  const naming = capital ? { name: p.name } : cityNameFor(s, c, p, coastal, r);
  const city: City = {
    id: s.nextIds.city++,
    name: naming.name,
    namedAfterId: naming.namedAfterId,
    provinceId: p.id,
    continentId: p.continentId!,
    foundedYear: s.year,
    founderRealmId: c.id,
    currentRealmId: c.id,
    population: Math.max(
      250,
      Math.min(Math.round(c.population * 0.12), Math.round(p.population * 0.45)),
    ),
    prosperity: r.int(35, 65),
    infrastructure: r.int(10, 25),
    defense: r.int(5, 18),
    culturalImportance: r.int(5, 20),
    scientificImportance: r.int(2, 12),
    religiousImportance: 0,
    isCapital: capital,
    buildings: [],
    ownershipHistory: [{ realmId: c.id, from: s.year }],
    tradeRouteIds: [],
    wonderIds: [],
    artworkIds: [],
  };
  s.cities.push(city);
  c.cityIds.push(city.id);
  p.cityId = city.id;
  if (capital) c.capitalCityId = city.id;
  addEvent(
    s,
    'city',
    `${city.name} is founded`,
    `${c.name} founded ${city.name}, a new ${cityLevel(city.population).toLowerCase()} on ${s.continents[city.continentId].name}.`,
    capital ? 7 : 4,
    [c.id],
    { cityIds: [city.id], continentIds: [city.continentId], tags: ['city foundation'] },
  );
  return city;
}

export function triggerCivilWar(
  s: WorldState,
  c: Civilization,
  r: RNG,
  cause = 'political instability',
) {
  if (c.provinces.length < 8 || s.wars.some(w => w.active && w.participantIds.includes(c.id)))
    return;
  const core = politicalCoreName(c, s),
    ordered = [...c.provinces].sort((a, b) => s.provinces[a].x - s.provinces[b].x);
  const rebelIds = ordered.slice(Math.floor(ordered.length * 0.52));
  if (rebelIds.length < 3) return;
  const rebelPop = rebelIds.reduce((n, id) => n + s.provinces[id].population, 0),
    share = rebelIds.length / c.provinces.length;
  const rebel: Civilization = {
    ...structuredClone(c),
    id: s.nextIds.civ++,
    name: share < 0.38 ? `Lesser ${core}` : `Eastern ${core}`,
    successorIdentity: share < 0.38 ? `Lesser ${core}` : `Eastern ${core}`,
    founded: s.year,
    population: Math.max(1000, rebelPop),
    urbanPopulation: 0,
    ruralPopulation: Math.max(1000, rebelPop),
    gdp: Math.max(0.5, c.gdp * share),
    armySize: Math.max(10, Math.round(c.armySize * share)),
    armyCapacity: Math.max(10, Math.round(c.armyCapacity * share)),
    stability: 35,
    prestige: Math.max(0, c.prestige * 0.35),
    provinces: rebelIds,
    cityIds: [],
    rulerId: 0,
    heirId: 0,
    regentId: 0,
    dynastyId: null,
    historyEventIds: [],
    warIds: [],
    historicalScore: 0,
    legacyScore: 0,
    governmentHistory: [
      {
        government: r.pick<GovernmentType>([
          'Republic',
          'Military Junta',
          'Open Monarchy',
          'Dictatorship',
        ]),
        from: s.year,
        reason: 'Civil war',
      },
    ],
    nameHistory: [
      {
        name: share < 0.38 ? `Lesser ${core}` : `Eastern ${core}`,
        rank: c.rank,
        from: s.year,
        reason: 'Civil war secession',
      },
    ],
  };
  rebel.government = rebel.governmentHistory[0].government;
  c.name = share < 0.38 ? `Greater ${core}` : `Western ${core}`;
  c.successorIdentity = c.name;
  c.nameHistory.push({ name: c.name, rank: c.rank, from: s.year, reason: 'Civil war division' });
  c.provinces = c.provinces.filter(id => !rebelIds.includes(id));
  c.population = Math.max(1000, c.population - rebel.population);
  c.gdp = Math.max(0.5, c.gdp - rebel.gdp);
  c.armySize = Math.max(1, c.armySize - rebel.armySize);
  c.armyCapacity = Math.max(10, c.armyCapacity - rebel.armyCapacity);
  c.stability = 28;
  for (const id of rebelIds) {
    const pr = s.provinces[id];
    pr.ownerId = rebel.id;
    if (pr.cityId) {
      const city = s.cities.find(x => x.id === pr.cityId)!;
      city.currentRealmId = rebel.id;
      rebel.cityIds.push(city.id);
      c.cityIds = c.cityIds.filter(x => x !== city.id);
    }
  }
  rebel.capitalCityId = rebel.cityIds[0] ?? 0;
  recalcRealmFromProvinces(s, c);
  recalcRealmFromProvinces(s, rebel);
  s.civilizations.push(rebel);
  const neighborIds = [
    ...new Set(
      c.provinces
        .flatMap(id => neigh(s.provinces[id], s))
        .map(p => p.ownerId)
        .filter((id): id is number => !!id && id !== c.id),
    ),
  ];
  const sponsor = neighborIds
    .map(id => s.civilizations.find(x => x.id === id))
    .filter((x): x is Civilization => !!x && !!x.dynastyId)
    .sort((a, b) => sponsorScore(s, b) - sponsorScore(s, a))[0];
  const foreignBacked = !!sponsor && r.chance(0.28);
  if (foreignBacked) {
    rebel.dynastyId = sponsor!.dynastyId;
    const dynasty = s.dynasties.find(d => d.id === rebel.dynastyId);
    if (dynasty && !dynasty.realmIds.includes(rebel.id)) dynasty.realmIds.push(rebel.id);
  }
  newRuler(
    s,
    rebel,
    r,
    foreignBacked ? `foreign-backed dynastic intervention by ${sponsor!.name}` : 'civil war',
    !foreignBacked,
  );
  const war: War = {
    id: s.nextIds.war++,
    name: `${core} Civil War`,
    type: 'Civil War',
    rationale: `${cause === 'religious polarization' ? 'Religious polarization and mutual intolerance' : 'Political collapse'} divided ${core} between rival governments and dynasties${foreignBacked ? `, with the ${s.dynasties.find(d => d.id === rebel.dynastyId)?.name} backed by ${sponsor!.name}` : ''}.`,
    goal: 'Defeat and reunify the rival successor state.',
    startYear: s.year,
    attackerIds: [c.id],
    defenderIds: [rebel.id],
    participantIds: [c.id, rebel.id],
    winnerIds: [],
    loserIds: [],
    attackerLosses: 0,
    defenderLosses: 0,
    battles: 0,
    battleIds: [],
    territoriesChanged: 0,
    gdpTransferred: 0,
    religionChanged: false,
    decisiveVictory: false,
    active: true,
  };
  s.wars.push(war);
  c.warIds.push(war.id);
  rebel.warIds.push(war.id);
  addRelation(s, 'Rival', c.id, rebel.id, 'Civil war');
  // Rebels are the restless half of the nation.
  rebel.axes = { ...c.axes, order: Math.min(100, c.axes.order + 10) };
  rebel.navy = Math.round(c.navy * share);
  c.navy = Math.max(0, c.navy - rebel.navy);
  addEvent(
    s,
    'politics',
    `${core} fractures in civil war`,
    `${c.name} and ${rebel.name} fractured over ${cause}. ${foreignBacked ? `${sponsor!.name} backed the rebel dynasty. ` : ''}They began a war for reunification.`,
    10,
    [c.id, rebel.id],
    { warIds: [war.id], tags: ['civil war', 'realm split', 'dynasty'], worldChronicle: true },
  );
}

/** How keen a neighbouring court is to back a rebel claimant. */
function sponsorScore(s: WorldState, c: Civilization) {
  const ruler = idx(s).char.get(c.rulerId);
  if (!ruler) return 0;
  return (
    ruler.skill +
    (ruler.traits.includes('Charismatic') ? 30 : 0) +
    (ruler.traits.includes('Ambitious') ? 15 : 0)
  );
}

/** A statesman overthrows the government and takes power personally. */
export function revolution(s: WorldState, c: Civilization, p: Character, r: RNG) {
  const old = c.government;
  const choices: GovernmentType[] = p.traits.includes('Reformer')
    ? ['Republic', 'Democracy', 'Dictatorship', 'Military Junta']
    : ['Constitutional Monarchy', 'Republic', 'Federation', 'Open Monarchy'];
  c.government = r.pick(choices.filter(x => x !== old));
  c.governmentHistory.at(-1)!.to = s.year;
  c.governmentHistory.push({
    government: c.government,
    from: s.year,
    reason: `Revolution led by ${p.name}`,
  });
  const d = s.dynasties.find(x => x.id === c.dynastyId);
  deposeRuler(s, c, r, `overthrown by ${p.name}`);
  if (d) {
    d.status = 'deposed';
    d.endedYear = s.year;
  }
  c.dynastyId = null;
  addDeed(s, p, `Led the revolution that founded the ${c.government} of ${c.name}`, 25);
  c.stability = Math.max(25, c.stability + 20);
  addEvent(
    s,
    'politics',
    `${c.name} undergoes revolution`,
    `${fullName(p)} overthrew the ${old} and established a ${c.government}, taking power personally.`,
    10,
    [c.id],
    {
      personIds: [p.id],
      dynastyIds: d ? [d.id] : [],
      tags: ['revolution', 'government change'],
      worldChronicle: true,
    },
  );
  const house = createDynasty(s, c, r, p.name.split(' ').at(-1));
  p.dynastyId = house.id;
  crown(s, c, p, r, 'revolution');
}

export function ensureModernGlobalContact(s: WorldState) {
  if (s.year < 1900) return;
  const living = s.civilizations.filter(c => c.provinces.length);
  const continentIds = s.continents.map(c => c.id);
  const realmIds = living.map(c => c.id);
  const incomplete = living.some(c => continentIds.some(id => !c.knownContinentIds.includes(id)));
  if (!incomplete) return;
  for (const c of living) {
    c.knownContinentIds = [...continentIds];
    c.knownRealmIds = realmIds.filter(id => id !== c.id);
  }
  addEvent(
    s,
    'exploration',
    'The world becomes fully connected',
    'By 1900 CE, navigation, diplomacy and accumulated geographic knowledge connected every inhabited continent. All surviving realms now know of one another.',
    10,
    realmIds,
    {
      continentIds,
      technologyIds: ['deep_sailing'],
      tags: ['global contact', 'connected world'],
      worldChronicle: true,
    },
  );
}
