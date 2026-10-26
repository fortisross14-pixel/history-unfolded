import type { Rank, Province, City, Character, Civilization, WorldState } from '../types.ts';
import { RNG } from './rng.ts';
import { neigh } from './util.ts';
import { cityNameFor, politicalCoreName } from './naming.ts';
import { addEvent } from './events.ts';
import { createDynasty, crown, deposeRuler, newRuler } from './dynasty.ts';
import { addDeed, fullName } from './characters.ts';
import { idx } from './lookup.ts';
import { addRelation } from './diplomacy.ts';
import { launchWar, newWar } from './war.ts';
import { changeGovernment } from './government.ts';
import { knows } from './eras.ts';

/** A realm's rank follows its size; only three empires may share a continent. */
export const rankFor = (c: Civilization, continentLand: number, existingEmpires: number): Rank => {
  const share = c.provinces.length / Math.max(1, continentLand);
  if (c.provinces.length >= 28 && share >= 0.12 && existingEmpires < 3) return 'Empire';
  if (c.provinces.length >= 18) return 'Kingdom';
  if (c.provinces.length >= 8) return 'Duchy';
  if (c.provinces.length >= 4 && c.development >= 15) return 'City-State';
  if (c.provinces.length >= 2) return 'Settlement';
  return 'Tribe';
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
    isCapital: capital,
    buildings: [],
    ownershipHistory: [{ realmId: c.id, from: s.year }],
    tradeRouteIds: [],
    wonderIds: [],
    wealth: 0,
    manpower: 0,
    influence: 0,
  };
  s.cities.push(city);
  idx(s).city.set(city.id, city);
  c.cityIds.push(city.id);
  p.cityId = city.id;
  if (capital) c.capitalCityId = city.id;
  addEvent(
    s,
    'city',
    `${city.name} is founded`,
    `${c.name} founded ${city.name} on ${s.continents[city.continentId]?.name ?? 'its lands'}.`,
    capital ? 7 : 4,
    [c.id],
    {
      cityIds: [city.id],
      continentIds: [city.continentId],
      tags: ['city foundation'],
    },
  );
  return city;
}

/** Splits a realm in two along an east–west line and starts the war to reunite it. */
export function triggerCivilWar(
  s: WorldState,
  c: Civilization,
  r: RNG,
  cause = 'political instability',
) {
  if (c.provinces.length < 8 || s.wars.some(w => w.active && w.participantIds.includes(c.id)))
    return;
  const core = politicalCoreName(c, s);
  const ordered = [...c.provinces].sort((a, b) => s.provinces[a].x - s.provinces[b].x);
  const rebelIds = ordered.slice(Math.floor(ordered.length * 0.52));
  if (rebelIds.length < 3) return;
  const share = rebelIds.length / c.provinces.length;
  // The rebels take their name from their own chief city; the loyalists keep the old name.
  const rebelSeat =
    rebelIds.map(id => s.provinces[id]).find(p => p.cityId) ?? s.provinces[rebelIds[0]];
  const seatName =
    (rebelSeat.cityId ? idx(s).city.get(rebelSeat.cityId)?.name : undefined) ?? rebelSeat.name;
  const taken = new Set(s.civilizations.filter(x => x.provinces.length).map(x => x.name));
  const rebelName =
    [
      `Free ${seatName}`,
      `Republic of ${seatName}`,
      `Kingdom of ${seatName}`,
      `${seatName} Rebels`,
    ].find(n => !taken.has(n)) ?? `Free ${seatName}`;
  const rebel: Civilization = {
    ...structuredClone(c),
    id: s.nextIds.civ++,
    name: rebelName,
    successorIdentity: rebelName,
    founded: s.year,
    armySize: Math.max(10, Math.round(c.armySize * share)),
    navy: Math.round(c.navy * share),
    stability: 35,
    research: 0,
    provinces: rebelIds,
    cityIds: [],
    rulerId: 0,
    heirId: 0,
    regentId: 0,
    dynastyId: null,
    historyEventIds: [],
    warIds: [],
    power: 0,
    topSince: undefined,
    peakProvinces: rebelIds.length,
    peakYear: s.year,
    // Rebels are the restless half of the nation.
    axes: { ...c.axes, order: Math.min(100, c.axes.order + 10) },
    governmentHistory: [{ government: c.government, from: s.year, reason: 'Civil war' }],
    nameHistory: [{ name: rebelName, rank: c.rank, from: s.year, reason: 'Civil war secession' }],
  };
  c.provinces = c.provinces.filter(id => !rebelIds.includes(id));
  c.armySize = Math.max(1, c.armySize - rebel.armySize);
  c.navy = Math.max(0, c.navy - rebel.navy);
  c.stability = 28;
  for (const id of rebelIds) {
    const p = s.provinces[id];
    p.ownerId = rebel.id;
    if (!p.cityId) continue;
    const city = idx(s).city.get(p.cityId)!;
    city.currentRealmId = rebel.id;
    city.isCapital = false;
    rebel.cityIds.push(city.id);
    c.cityIds = c.cityIds.filter(x => x !== city.id);
  }
  rebel.capitalCityId = rebel.cityIds[0] ?? 0;
  const newCapital = idx(s).city.get(rebel.capitalCityId);
  if (newCapital) newCapital.isCapital = true;
  s.civilizations.push(rebel);
  idx(s).civ.set(rebel.id, rebel);
  const neighborIds = [
    ...new Set(
      c.provinces
        .flatMap(id => neigh(s.provinces[id], s))
        .map(p => p.ownerId)
        .filter((id): id is number => !!id && id !== c.id && id !== rebel.id),
    ),
  ];
  const sponsor = neighborIds
    .map(id => idx(s).civ.get(id))
    .filter((x): x is Civilization => !!x && !!x.dynastyId)
    .sort((a, b) => sponsorScore(s, b) - sponsorScore(s, a))[0];
  const foreignBacked = !!sponsor && r.chance(0.28);
  if (foreignBacked) {
    rebel.dynastyId = sponsor!.dynastyId;
    const dynasty = idx(s).dynasty.get(rebel.dynastyId!);
    if (dynasty && !dynasty.realmIds.includes(rebel.id)) dynasty.realmIds.push(rebel.id);
  }
  newRuler(
    s,
    rebel,
    r,
    foreignBacked ? `foreign-backed intervention by ${sponsor!.name}` : 'civil war',
    !foreignBacked,
  );
  const backers = foreignBacked
    ? `, with the ${idx(s).dynasty.get(rebel.dynastyId!)?.name} backed by ${sponsor!.name}`
    : '';
  const war = newWar(
    s,
    c,
    rebel,
    {
      type: 'Civil War',
      rationale: `${cause === 'religious polarization' ? 'Religious hatred' : 'Political collapse'} divided ${core} between rival governments${backers}.`,
      goal: 'Defeat and reunify the rival successor state.',
    },
    `${core} Civil War`,
  );
  addRelation(s, 'Rival', c.id, rebel.id, 'Civil war');
  addEvent(
    s,
    'politics',
    `${core} fractures in civil war`,
    `${c.name} and ${rebel.name} split over ${cause}.${foreignBacked ? ` ${sponsor!.name} backed the rebels.` : ''}`,
    10,
    [c.id, rebel.id],
    {
      warIds: [war.id],
      tags: ['civil war', 'realm split'],
      worldChronicle: true,
    },
  );
  launchWar(s, war, r);
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
  const next = c.era >= 5 ? 'Democracy' : 'Republic';
  const d = c.dynastyId ? idx(s).dynasty.get(c.dynastyId) : undefined;
  deposeRuler(s, c, r, `overthrown by ${p.name}`);
  if (d) {
    d.status = 'deposed';
    d.endedYear = s.year;
  }
  c.dynastyId = null;
  changeGovernment(s, c, next === old ? 'Republic' : next, `revolution led by ${p.name}`);
  addDeed(s, p, `Led the revolution that founded the ${c.government} of ${c.name}`, 25);
  c.stability = Math.max(25, c.stability + 20);
  addEvent(
    s,
    'politics',
    `${c.name} undergoes revolution`,
    `${fullName(p)} overthrew the ${old} and took power at the head of a ${c.government}.`,
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

/** Once anyone has powered flight, every surviving realm knows every other. */
export function ensureGlobalContact(s: WorldState) {
  const living = s.civilizations.filter(c => c.provinces.length);
  if (!living.some(c => knows(c, 'flight'))) return;
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
    'With powered flight, every inhabited continent is in reach. All surviving realms now know of one another.',
    10,
    realmIds.slice(0, 6),
    {
      continentIds,
      breakthroughIds: ['flight'],
      tags: ['global contact'],
      worldChronicle: true,
    },
  );
}
