import type { Building, Character, Civilization, Culture, MapSize, WorldState } from '../types.ts';
import { TECHNOLOGIES } from './data.ts';
import { RNG } from './rng.ts';
import { has, neighborRealms, neigh, urbanTarget } from './util.ts';
import {
  rankFor,
  governmentFor,
  createCity,
  triggerCivilWar,
  ensureModernGlobalContact,
} from './realms.ts';
import { politicalCoreName, capitalName } from './naming.ts';
import { addEvent, processRealmEvents } from './events.ts';
import { discover } from './technology.ts';
import { BUILDINGS, build } from './economy.ts';
import { createWonder, level } from './culture.ts';
import { foundReligion, processOfficialConversion } from './religion.ts';
import { startWar, battle } from './war.ts';
import { RunTracker, summarize } from './metrics.ts';
import { historicalScore, captureEvolutionSnapshot } from './records.ts';
import { createWorld } from './world.ts';
import { courtOf, idx, isAlive, rebuildIndex } from './lookup.ts';
import { realmModifiers, type ModTotals } from './modifiers.ts';
import { checkAmbition, createCharacter, deathCheck } from './characters.ts';
import { rulerLifeCycle, succession } from './dynasty.ts';
import { isNotable, notableActs, spawnNotables } from './court.ts';
import { pruneCharacters } from './prune.ts';
import { coastalShare, driftAxes } from './axes.ts';
import { canAttack, diplomacyUpkeep, diplomacyYear, findRelation } from './diplomacy.ts';
import { colonize } from './colonies.ts';

/** Everything one realm's yearly steps share. */
interface RealmYear {
  c: Civilization;
  culture: Culture;
  mods: ModTotals;
  buildings: Building[];
  neighbors: Civilization[];
  gdpBoost: number;
  armyBoost: number;
  sciBoost: number;
  routeCount: number;
  atWar: boolean;
}

function prepare(s: WorldState, c: Civilization): RealmYear {
  const culture = idx(s).culture.get(c.cultureId)!;
  const buildings = c.cityIds.flatMap(id => idx(s).city.get(id)?.buildings ?? []);
  const wonders = s.wonders.filter(w => w.realmId === c.id && w.status === 'standing');
  const routes = s.tradeRoutes.filter(
    t =>
      t.active && (c.cityIds.includes(t.originCityId) || c.cityIds.includes(t.destinationCityId)),
  );
  const sum = (key: 'gdpBonus' | 'armyBonus' | 'scienceBonus') =>
    buildings.reduce((n, b) => n + b[key], 0) + wonders.reduce((n, w) => n + w[key], 0);
  return {
    c,
    culture,
    mods: realmModifiers(s, c).total,
    buildings,
    neighbors: neighborRealms(s, c),
    gdpBoost: sum('gdpBonus') + routes.reduce((n, t) => n + t.gdpBonus, 0),
    armyBoost: sum('armyBonus'),
    sciBoost: sum('scienceBonus'),
    routeCount: routes.length,
    atWar: s.wars.some(w => w.active && w.participantIds.includes(c.id)),
  };
}

const ERA_POP_RATE = (year: number) =>
  year < -1500
    ? 0.00125
    : year < 0
      ? 0.00145
      : year < 1200
        ? 0.00135
        : year < 1800
          ? 0.00165
          : 0.0011;
const VIABLE_PER_PROVINCE = (year: number) =>
  year < -1500 ? 350 : year < 0 ? 900 : year < 1200 ? 1800 : year < 1800 ? 3500 : 7000;

function growPopulation(s: WorldState, y: RealmYear) {
  const { c, mods, buildings } = y;
  const owned = c.provinces.map(id => s.provinces[id]);
  const continent = s.continents.find(ct => ct.id === (owned[0]?.continentId ?? -1));
  const avgFertility = owned.length
    ? owned.reduce((n, p) => n + p.fertility, 0) / owned.length
    : 45;
  const infrastructure = buildings
    .filter(b => ['Granary', 'Aqueduct', 'Hospital'].includes(b.type))
    .reduce((n, b) => n + b.level * 0.018, 0);
  const stable = 0.82 + c.stability / 430 + (50 - c.axes.order) / 600;
  const rate =
    ERA_POP_RATE(s.year) *
    stable *
    (has(c, 'agriculture') ? 1.22 : 0.78) *
    (0.72 + avgFertility / 115) *
    (1 + Math.min(0.32, infrastructure)) *
    (1 + (continent?.populationBonus ?? 0)) *
    (1 + mods.growth);
  c.population = Math.round(c.population * (1 + rate));
  const floor = Math.max(300, c.provinces.length * VIABLE_PER_PROVINCE(s.year));
  if (c.population < floor) c.population = Math.round(c.population + (floor - c.population) * 0.06);
}

function growEconomy(s: WorldState, y: RealmYear) {
  const { c, mods, gdpBoost, routeCount } = y;
  const owned = c.provinces.map(id => s.provinces[id]);
  const continent = s.continents.find(ct => ct.id === (owned[0]?.continentId ?? -1));
  const prosperity = c.cityIds.length
    ? c.cityIds.reduce((n, id) => n + (idx(s).city.get(id)?.prosperity ?? 30), 0) / c.cityIds.length
    : 25;
  const commercial =
    (1 + (continent?.gdpBonus ?? 0)) *
    (1 + Math.min(3.1, gdpBoost * 2.35) + Math.min(0.45, routeCount * 0.055));
  const target = Math.max(
    1,
    (c.population / 980) *
      (0.72 + c.technology / 760) *
      commercial *
      (0.95 + mods.wealth) *
      (0.82 + prosperity / 210),
  );
  const catchup =
    0.018 +
    Math.min(0.075, gdpBoost * 0.022 + Math.max(0, mods.wealth) * 0.02 + routeCount * 0.0018);
  c.gdp += Math.max(
    -c.gdp * 0.035,
    Math.min(c.gdp * (0.045 + Math.min(0.06, gdpBoost * 0.018)), (target - c.gdp) * catchup),
  );
  // Spread the realm's wealth over its provinces by population and fertility.
  const weight = owned.reduce(
    (n, p) => n + Math.max(1, p.population) * (0.7 + p.fertility / 180),
    0,
  );
  for (const p of owned)
    p.gdp = Math.max(
      0.01,
      (c.gdp * Math.max(1, p.population) * (0.7 + p.fertility / 180)) / Math.max(1, weight),
    );
  c.gdp = owned.reduce((n, p) => n + p.gdp, 0);
}

function researchAndArmy(s: WorldState, y: RealmYear) {
  const { c, mods, sciBoost, armyBoost, buildings } = y;
  const continent = s.continents.find(ct => ct.id === s.provinces[c.provinces[0]]?.continentId);
  c.technology = Math.min(
    1000,
    c.technology +
      (0.07 + sciBoost * 0.27) * (1 + mods.research) * (1 + (continent?.technologyBonus ?? 0)),
  );
  if (!Number.isFinite(c.armyCapacity)) c.armyCapacity = Math.max(10, c.armySize);
  c.armyCapacity = Math.max(
    10,
    Math.round(
      c.population *
        (0.009 + (Math.max(0, c.axes.ambition - 50) / 50) * 0.0055) *
        // Sea powers keep smaller armies and larger fleets.
        (1.1 - c.axes.horizon / 500) *
        (1 + Math.min(0.5, armyBoost)) *
        (1 + (continent?.armyBonus ?? 0)) *
        0.95 *
        (1 + mods.army),
    ),
  );
  if (c.armySize < c.armyCapacity)
    c.armySize = Math.min(c.armyCapacity, Math.round(c.armySize + c.armyCapacity * 0.05));
  else c.armySize = Math.min(c.armySize, c.armyCapacity);
  // The fleet: only coastal realms have one, and seafaring ones build far more.
  const coast = coastalShare(s, c);
  const docks = buildings
    .filter(b => ['Harbor', 'Shipyard'].includes(b.type))
    .reduce((n, b) => n + b.level * 0.06, 0);
  c.navyCapacity = coast
    ? Math.round(
        c.population *
          0.004 *
          (c.axes.horizon / 100) ** 2 *
          Math.min(1, coast * 2) *
          (has(c, 'deep_sailing') ? 1.5 : 1) *
          (1 + Math.min(0.6, docks)) *
          Math.max(0.1, 1 + mods.navy),
      )
    : 0;
  if (c.navy < c.navyCapacity)
    c.navy = Math.min(c.navyCapacity, Math.round(c.navy + c.navyCapacity * 0.04 + 1));
  else c.navy = c.navyCapacity;
  // Stability drifts toward what the state and the court can sustain.
  const target = 52 + mods.stability;
  c.stability = Math.max(5, Math.min(100, c.stability + (target - c.stability) * 0.015));
  c.prestige += s.wonders
    .filter(w => w.realmId === c.id && w.status === 'standing')
    .reduce((n, w) => n + w.historicalRelevance / 1000, 0);
}

function citiesAndLand(s: WorldState, y: RealmYear, r: RNG) {
  const { c, mods, gdpBoost } = y;
  const court = courtOf(s, c.id);
  for (const city of c.cityIds.map(id => idx(s).city.get(id)!).filter(Boolean)) {
    city.prosperity = Math.max(5, Math.min(100, city.prosperity + 0.01 + gdpBoost * 0.007));
    if (!r.chance(0.0025 * (1 + mods.build))) continue;
    const coastal = neigh(s.provinces[city.provinceId], s).some(n => n.terrain === 'ocean');
    const possible = BUILDINGS.filter(
      b => c.technology >= b.tech && (!b.requires || has(c, b.requires)) && (!b.coastal || coastal),
    );
    if (!possible.length) continue;
    const def = pickBuilding(c, possible, r);
    // The ruler sponsors projects unless a fitting notable is at court.
    const fits = (role: string, kinds: string[]) =>
      kinds.includes(def.type) && court.find(x => x.role === role);
    const builder =
      fits('Merchant', ['Market', 'Harbor', 'Merchant Guild', 'Bank', 'Stock Exchange']) ||
      fits('General', ['Barracks', 'Fortifications', 'Military Academy']) ||
      fits('Scholar', ['Library', 'University', 'Printing House', 'Hospital']) ||
      court.find(x => x.id === c.rulerId);
    build(s, c, city, def, builder || undefined);
  }
  const free = c.provinces
    .flatMap(id => neigh(s.provinces[id], s))
    .filter(p => p.terrain !== 'ocean' && p.ownerId === null);
  // Expansionist peoples settle empty land faster.
  if (free.length && r.chance(0.012 * (0.5 + c.axes.ambition / 100))) {
    const p = r.pick(free);
    p.ownerId = c.id;
    p.cultureId = c.cultureId;
    c.provinces.push(p.id);
  }
  colonize(s, c, mods, r);
}

/** What a realm builds depends on what kind of country it is. */
const BUILDING_AXIS: Record<string, [keyof Civilization['axes'], 1 | -1]> = {
  'Trading Post': ['economy', 1],
  Market: ['economy', 1],
  'Merchant Guild': ['economy', 1],
  Bank: ['economy', 1],
  'Stock Exchange': ['economy', 1],
  Granary: ['economy', -1],
  Aqueduct: ['economy', -1],
  Harbor: ['horizon', 1],
  Shipyard: ['horizon', 1],
  Shrine: ['faith', -1],
  Temple: ['faith', -1],
  Monastery: ['faith', -1],
  Cathedral: ['faith', -1],
  Library: ['faith', 1],
  University: ['faith', 1],
  'Printing House': ['faith', 1],
  Observatory: ['faith', 1],
  Barracks: ['ambition', 1],
  Fortifications: ['ambition', 1],
  'Military Academy': ['ambition', 1],
  Forge: ['ambition', 1],
  Courthouse: ['order', -1],
  'Road Network': ['order', -1],
};

function pickBuilding(c: Civilization, options: typeof BUILDINGS, r: RNG) {
  const weight = (type: string) => {
    const axis = BUILDING_AXIS[type];
    if (!axis) return 1;
    const lean = ((c.axes[axis[0]] - 50) / 50) * axis[1];
    return 1 + Math.max(0, lean) * 3;
  };
  let roll = r.next() * options.reduce((n, b) => n + weight(b.type), 0);
  for (const b of options) {
    roll -= weight(b.type);
    if (roll <= 0) return b;
  }
  return options[0];
}

function politics(s: WorldState, y: RealmYear, r: RNG) {
  const { c } = y;
  const homeCont = s.provinces[c.provinces[0]]?.continentId ?? 0;
  const land = s.continents.find(x => x.id === homeCont)?.provinceIds.length ?? 1;
  const empires = s.civilizations.filter(
    x => x.rank === 'Empire' && x.provinces.some(id => s.provinces[id].continentId === homeCont),
  ).length;
  const newRank = rankFor(c, land, empires - (c.rank === 'Empire' ? 1 : 0));
  if (newRank !== c.rank) {
    c.rank = newRank;
    if (
      newRank === 'City-State' &&
      !s.cities.some(x => x.currentRealmId === c.id && c.provinces.includes(x.provinceId))
    ) {
      const capital = c.provinces
        .map(id => s.provinces[id])
        .sort((a, b) => b.population - a.population)[0];
      createCity(s, c, capital, r, true);
    }
    const core = c.successorIdentity ?? politicalCoreName(c, s);
    const name = c.successorIdentity
      ? core
      : newRank === 'Tribe'
        ? `${c.originTribe} Tribe`
        : newRank === 'Settlement'
          ? `${c.originTribe} Settlements`
          : newRank === 'City-State'
            ? (idx(s).city.get(c.capitalCityId)?.name ?? capitalName(c.originTribe, r, s))
            : newRank === 'Duchy'
              ? core
              : newRank === 'Kingdom'
                ? `Kingdom of ${core}`
                : `${core} Empire`;
    // A name the player chose by hand always wins.
    if (!s.overrides.realm[c.id]) c.name = name;
    c.nameHistory.push({
      name: c.name,
      rank: newRank,
      from: s.year,
      reason: 'Political evolution',
    });
    addEvent(
      s,
      'society',
      `${c.name} rises`,
      `${c.originTribe} institutions evolved into a ${newRank.toLowerCase()}.`,
      8,
      [c.id],
      {
        tags: ['realm evolution'],
        worldChronicle: newRank === 'Empire',
      },
    );
  }
  const expected = governmentFor(c, s.year);
  if (expected !== c.government && r.chance(0.025)) {
    const old = c.government;
    c.governmentHistory.at(-1)!.to = s.year;
    c.government = expected;
    c.governmentHistory.push({
      government: expected,
      from: s.year,
      reason: 'Institutional development',
    });
    addEvent(
      s,
      'politics',
      `${c.name} adopts a ${expected}`,
      `${c.name} replaced its ${old} with a ${expected} as its institutions and population developed.`,
      7,
      [c.id],
      {
        tags: ['government change', 'institutional reform'],
        worldChronicle: ['Democracy', 'Federation', 'Imperial Court'].includes(expected),
      },
    );
  }
  // Civil war: deep instability, or two intolerant faiths of similar size.
  const faithPop = new Map<number, number>();
  for (const id of c.provinces) {
    const p = s.provinces[id];
    if (p.religionId !== null)
      faithPop.set(p.religionId, (faithPop.get(p.religionId) ?? 0) + p.population);
  }
  const shares = [...faithPop.entries()]
    .map(([id, pop]) => ({ pop, tolerance: idx(s).religion.get(id)?.tolerance ?? 100 }))
    .sort((a, b) => b.pop - a.pop);
  const polarized =
    c.axes.faith < 60 &&
    shares.length >= 2 &&
    shares[1].pop >= c.population * 0.22 &&
    shares[0].tolerance < 42 &&
    shares[1].tolerance < 42;
  const pressure = (c.stability < 25 && c.axes.order > 60) || (c.stability < 32 && polarized);
  if (pressure && c.provinces.length >= 8 && r.chance(polarized ? 0.032 : 0.018))
    triggerCivilWar(s, c, r, polarized ? 'religious polarization' : 'political instability');
  // New cities when the realm is under-urbanised.
  const urban = c.cityIds.reduce((n, id) => n + (idx(s).city.get(id)?.population ?? 0), 0);
  if (
    ['Duchy', 'Kingdom', 'Empire'].includes(c.rank) &&
    c.provinces.length >= 8 &&
    c.cityIds.length < Math.max(2, Math.floor(c.provinces.length / 8)) &&
    urban / c.population < urbanTarget(s.year, c.technology) * 0.72 &&
    c.population > c.cityIds.length * 7000 &&
    r.chance(0.004)
  ) {
    const site = c.provinces
      .map(id => s.provinces[id])
      .filter(p => !p.cityId)
      .sort((a, b) => b.fertility - a.fertility || b.population - a.population)[0];
    if (site) createCity(s, c, site, r);
  }
}

function diffuseKnowledge(s: WorldState, y: RealmYear) {
  const { c, neighbors } = y;
  for (const t of TECHNOLOGIES) {
    if (s.year < t.earliestYear || has(c, t.id)) continue;
    const knowing = neighbors.filter(n => has(n, t.id)).length;
    if (!knowing) continue;
    c.technologyExposure[t.id] = (c.technologyExposure[t.id] ?? 0) + (knowing >= 2 ? 2 : 1);
    if (c.technologyExposure[t.id] < 36) continue;
    c.knownTechnologies.push({ technologyId: t.id, discoveredYear: s.year, source: 'diffusion' });
    c.technology = Math.min(1000, c.technology + 14);
    delete c.technologyExposure[t.id];
    addEvent(
      s,
      'technology',
      `${t.name} reaches ${c.name}`,
      `${t.name} spread into ${c.name} after sustained border contact with ${knowing >= 2 ? 'multiple neighboring civilizations' : 'a neighboring civilization'}.`,
      5,
      [c.id],
      {
        technologyIds: [t.id],
        tags: ['technology diffusion'],
      },
    );
  }
  for (const con of s.continents) {
    if (c.knownContinentIds.includes(con.id)) continue;
    const informed = c.knownRealmIds.some(id =>
      idx(s).civ.get(id)?.knownContinentIds.includes(con.id),
    );
    if (!informed) continue;
    const k = String(con.id);
    c.continentExposure[k] = (c.continentExposure[k] ?? 0) + 1;
    if (c.continentExposure[k] < 60) continue;
    c.knownContinentIds.push(con.id);
    addEvent(
      s,
      'exploration',
      `${c.name} learns of ${con.name}`,
      `After sixty years of contact, knowledge of ${con.name} reached ${c.name}.`,
      5,
      [c.id],
      {
        continentIds: [con.id],
        tags: ['knowledge diffusion'],
      },
    );
  }
}

/** The ruler's family and the notables of the court. */
function courtYear(s: WorldState, y: RealmYear, r: RNG) {
  const { c, mods, atWar } = y;
  rulerLifeCycle(s, c, r);
  spawnNotables(s, c, atWar, r);
  diplomacyYear(s, c, y.neighbors, mods, r);
  driftAxes(s, c, y.routeCount);
  for (const ch of courtOf(s, c.id)) {
    if (isNotable(ch)) notableActs(s, c, ch, mods, r);
    // The greatest talents, and anyone who dreams of it, may raise a wonder.
    const wantsWonder = ch.ambition?.type === 'build-wonder' && ch.ambition.status === 'pending';
    const career = s.year - ch.born - 18;
    if (
      (level(ch) === 5 || (wantsWonder && level(ch) >= 3)) &&
      career >= 8 &&
      c.cityIds.length &&
      r.chance(0.02)
    )
      if (!ch.deeds.some(d => d.text.startsWith('Completed'))) createWonder(s, c, ch, r);
  }
}

/**
 * Who to attack: a ruler's dream comes first, then the realm's character.
 * Zealots look for infidels, merchants for rich prey, conquerors for the weak,
 * and everyone remembers old rivals.
 */
function chooseTarget(
  s: WorldState,
  c: Civilization,
  targets: Civilization[],
  ruler: Character | undefined,
  r: RNG,
) {
  const dream =
    ruler?.ambition?.type === 'conquer'
      ? targets.find(n => n.id === ruler.ambition?.targetId)
      : undefined;
  if (dream) return dream;
  const a = c.axes;
  const score = (n: Civilization) =>
    1 +
    (a.faith < 35 && n.faithId !== c.faithId ? 3 : 0) +
    (a.economy > 65 ? Math.min(3, n.gdp / Math.max(1, c.gdp)) : 0) +
    (a.ambition > 65 ? Math.min(3, c.armySize / Math.max(1, n.armySize)) : 0) +
    (findRelation(s, c.id, n.id, 'Rival') ? 3 : 0);
  let roll = r.next() * targets.reduce((n, t) => n + score(t), 0);
  for (const t of targets) {
    roll -= score(t);
    if (roll <= 0) return t;
  }
  return targets[0];
}

function warAndInfluence(s: WorldState, y: RealmYear, r: RNG) {
  const { c, culture, mods, neighbors, atWar } = y;
  const ruler = idx(s).char.get(c.rulerId);
  const targets = neighbors.filter(n => canAttack(s, c, n));
  if (targets.length && !atWar && r.chance(0.0028 * Math.max(0.05, 1 + mods.warAppetite)))
    startWar(s, c, chooseTarget(s, c, targets, ruler, r), r);
  processOfficialConversion(s, c, r);
  for (const n of neighbors) {
    const nc = idx(s).culture.get(n.cultureId);
    if (!nc) continue;
    const gap = nc.strength - culture.strength;
    if (gap < 18 || (n.government === c.government && n.faithId === c.faithId)) continue;
    c.stability = Math.max(5, c.stability - Math.min(0.055, (gap - 12) / 900));
    if (r.chance(0.0007 + gap / 90000))
      addEvent(
        s,
        'culture',
        `${n.name} influences ${c.name}`,
        `${nc.name}'s stronger institutions and values intensified pressure inside ${c.name}, where government or religion differed.`,
        6,
        [n.id, c.id],
        {
          cultureIds: [nc.id, culture.id],
          tags: ['cultural pressure', 'foreign influence'],
        },
      );
  }
}

function bookkeeping(s: WorldState, y: RealmYear, r: RNG) {
  const { c, mods, buildings } = y;
  c.historicalScore = historicalScore(s, c);
  c.legacyScore = Math.max(c.legacyScore, c.historicalScore);
  const d = c.dynastyId ? idx(s).dynasty.get(c.dynastyId) : undefined;
  if (d) {
    d.totalYearsInPower++;
    d.peakTerritory = Math.max(d.peakTerritory, c.provinces.length);
    d.peakGDP = Math.max(d.peakGDP, c.gdp);
    d.peakPopulation = Math.max(d.peakPopulation ?? 0, c.population);
    d.historicalRelevance = Math.min(
      100,
      Math.round(
        d.totalYearsInPower / 10 +
          d.rulerIds.length * 3 +
          d.wonderIds.length * 12 +
          d.peakTerritory / 2,
      ),
    );
  }
  // Split population between cities (by prosperity) and countryside.
  const owned = c.provinces.map(id => s.provinces[id]);
  const cities = c.cityIds.map(id => idx(s).city.get(id)!).filter(Boolean);
  const desiredUrban = cities.length
    ? Math.round(c.population * urbanTarget(s.year, c.technology))
    : 0;
  const previousUrban = cities.reduce((n, x) => n + x.population, 0);
  c.urbanPopulation = Math.max(
    0,
    Math.min(c.population, Math.round(previousUrban + (desiredUrban - previousUrban) * 0.025)),
  );
  c.ruralPopulation = Math.max(0, c.population - c.urbanPopulation);
  const weight = cities.reduce((n, x) => n + Math.max(10, x.prosperity), 0);
  for (const city of cities)
    city.population = Math.max(
      100,
      Math.round((c.urbanPopulation * Math.max(10, city.prosperity)) / Math.max(1, weight)),
    );
  const rural = owned.filter(p => !p.cityId);
  const each = Math.max(1, Math.round(c.ruralPopulation / Math.max(1, rural.length)));
  for (const p of owned)
    p.population = p.cityId ? (idx(s).city.get(p.cityId)?.population ?? 0) : each;
  const remainder = c.population - owned.reduce((n, p) => n + p.population, 0);
  if (remainder !== 0 && owned.length) {
    const capital = idx(s).city.get(c.capitalCityId);
    const anchor = owned.find(p => p.id === capital?.provinceId) ?? owned[0];
    anchor.population = Math.max(1, anchor.population + remainder);
    if (anchor.cityId) {
      const city = idx(s).city.get(anchor.cityId);
      if (city) city.population = anchor.population;
    }
    c.urbanPopulation = cities.reduce((n, x) => n + x.population, 0);
    c.ruralPopulation = Math.max(0, c.population - c.urbanPopulation);
  }
  // The state faith spreads to pagan and neighbouring provinces.
  const faith = c.faithId ? idx(s).religion.get(c.faithId) : undefined;
  if (!faith) return;
  const pagan = owned.filter(p => p.religionId === null);
  const foreign = owned.filter(
    p =>
      p.religionId !== c.faithId &&
      p.religionId !== null &&
      neigh(p, s).some(n => n.religionId === c.faithId),
  );
  const temples = buildings
    .filter(b => ['Shrine', 'Temple', 'Monastery', 'Cathedral'].includes(b.type))
    .reduce((n, b) => n + b.cultureBonus / 10, 0);
  const pressure = (faith.expansion / 350 + temples) * Math.max(0.2, 1 + mods.faithSpread);
  if (pagan.length && r.chance(Math.min(0.2, pressure))) r.pick(pagan).religionId = c.faithId;
  else if (foreign.length && r.chance(Math.min(0.065, pressure * 0.35)))
    r.pick(foreign).religionId = c.faithId;
}

/** Deaths and measured ambitions for every living character. */
function charactersYear(s: WorldState, r: RNG) {
  const alive = s.characters.filter(ch => ch.died === undefined);
  for (const ch of alive) {
    const realm = idx(s).civ.get(ch.realmId);
    const living = realm && realm.provinces.length ? realm : undefined;
    deathCheck(s, ch, living, r);
    if (ch.died !== undefined) {
      if (living && living.rulerId === ch.id) succession(s, living, r);
      continue;
    }
    if (living && (ch.role === 'Ruler' || isNotable(ch))) checkAmbition(s, ch, living);
  }
}

/** Rare global catalysts keep religions, discoveries and wonders appearing on time. */
function catalysts(s: WorldState, r: RNG) {
  const living = s.civilizations.filter(x => x.provinces.length);
  if (!living.length) return;
  const desiredReligions = Math.min(6, Math.max(4, Math.round(s.continents.length * 1.05)));
  if (
    s.religions.length < desiredReligions &&
    ((s.religions.length === 0 && s.year >= -2850) ||
      ((s.year + 3000) % 650 === 0 && s.year > -2850) ||
      r.chance(0.00035))
  ) {
    const host = r.pick(living);
    const prophet = createCharacter(s, r, {
      role: 'Prophet',
      realm: host,
      minRarity: r.chance(0.18) ? 'Generational' : 'Legend',
    });
    foundReligion(s, host, prophet, r);
  }
  for (const t of TECHNOLOGIES) {
    if (t.id === 'agriculture') continue;
    if (s.year < t.earliestYear + (['steam_power', 'flight'].includes(t.id) ? 120 : 320)) continue;
    if (living.some(c => has(c, t.id))) continue;
    const candidates = living.filter(
      c => c.cityIds.length && c.technology >= Math.max(20, TECHNOLOGIES.indexOf(t) * 70),
    );
    if (!candidates.length) continue;
    const host = [...candidates].sort((a, b) => b.technology - a.technology)[0];
    const scholar =
      courtOf(s, host.id)
        .filter(x => x.role === 'Scholar')
        .sort((a, b) => b.skill - a.skill)[0] ??
      createCharacter(s, r, { role: 'Scholar', realm: host, minRarity: 'Epic' });
    discover(s, host, t.id, scholar);
  }
  if (
    s.year > -1200 &&
    s.wonders.length < 18 &&
    ((s.year + 1200) % 450 === 0 || r.chance(0.00035))
  ) {
    const hosts = living.filter(c => c.technology >= 100 && c.cityIds.length);
    if (hosts.length) {
      const host = r.pick(hosts);
      const patron =
        courtOf(s, host.id)
          .filter(x => level(x) >= 4)
          .sort((a, b) => b.fame - a.fame)[0] ??
        createCharacter(s, r, {
          role: r.pick(['Scholar', 'Merchant', 'General', 'Prophet', 'Statesman'] as const),
          realm: host,
          minRarity: 'Legend',
        });
      createWonder(s, host, patron, r);
    }
  }
}

function worldTotals(s: WorldState) {
  const culturePop = new Map<number, [number, number]>();
  const faithPop = new Map<number, [number, number]>();
  for (const p of s.provinces) {
    if (p.cultureId !== null) {
      const v = culturePop.get(p.cultureId) ?? [0, 0];
      v[0] += p.population;
      v[1]++;
      culturePop.set(p.cultureId, v);
    }
    if (p.religionId !== null) {
      const v = faithPop.get(p.religionId) ?? [0, 0];
      v[0] += p.population;
      v[1]++;
      faithPop.set(p.religionId, v);
    }
  }
  const worldPop = Math.max(
    1,
    s.civilizations.reduce((n, c) => n + c.population, 0),
  );
  for (const cul of s.cultures) {
    [cul.population, cul.provinces] = culturePop.get(cul.id) ?? [0, 0];
    const eventCulture = s.realmEvents
      .filter(e => e.active && idx(s).civ.get(e.realmId)?.cultureId === cul.id)
      .reduce((n, e) => n + e.effects.cultureAnnual * 2, 0);
    const origin = idx(s).civ.get(cul.originRealmId);
    const originCont = s.continents.find(
      ct => ct.id === s.provinces[origin?.provinces[0] ?? -1]?.continentId,
    );
    cul.strength = Math.min(
      100,
      Math.round(
        20 +
          cul.heritage.length * 3 +
          eventCulture +
          (cul.population / worldPop) * 100 +
          (originCont?.cultureBonus ?? 0) * 30,
      ),
    );
  }
  for (const rel of s.religions) [rel.followers, rel.provinces] = faithPop.get(rel.id) ?? [0, 0];
  // A realm's official faith follows its largest religion once that passes 30%.
  for (const c of s.civilizations) {
    if (!c.provinces.length) continue;
    const counts = new Map<number, number>();
    for (const id of c.provinces) {
      const rid = s.provinces[id].religionId;
      if (rid) counts.set(rid, (counts.get(rid) ?? 0) + s.provinces[id].population);
    }
    const majority = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (majority && majority[1] >= c.population * 0.3) c.faithId = majority[0];
  }
}

export function simulateYear(s: WorldState, r: RNG) {
  s.year++;
  rebuildIndex(s);
  for (const c of s.civilizations) {
    if (!c.provinces.length) continue;
    const y = prepare(s, c);
    processRealmEvents(s, c, y.culture, r);
    growPopulation(s, y);
    growEconomy(s, y);
    researchAndArmy(s, y);
    citiesAndLand(s, y, r);
    politics(s, y, r);
    diffuseKnowledge(s, y);
    courtYear(s, y, r);
    warAndInfluence(s, y, r);
    bookkeeping(s, y, r);
  }
  charactersYear(s, r);
  catalysts(s, r);
  for (const w of s.wars.filter(x => x.active)) if (r.chance(0.35)) battle(s, w, r);
  diplomacyUpkeep(s);
  worldTotals(s);
  ensureModernGlobalContact(s);
  if (s.year % 100 === 0) {
    captureEvolutionSnapshot(s);
    pruneCharacters(s);
  }
}

/** Runs the world forward in place. onYear is called after every year. */
export function simulateYears(s: WorldState, years: number, onYear?: (s: WorldState) => void) {
  const r = new RNG((s.seed + s.year * 31 + years * 911) >>> 0);
  for (let i = 0; i < years; i++) {
    simulateYear(s, r);
    onYear?.(s);
    for (const c of s.civilizations) {
      if (
        Number.isFinite(c.population) &&
        Number.isFinite(c.gdp) &&
        Number.isFinite(c.technology) &&
        Number.isFinite(c.armySize) &&
        Number.isFinite(c.armyCapacity)
      )
        continue;
      c.population = Math.max(0, Number.isFinite(c.population) ? c.population : 0);
      c.gdp = Math.max(0.1, Number.isFinite(c.gdp) ? c.gdp : 0.1);
      c.technology = Math.max(0, Math.min(1000, Number.isFinite(c.technology) ? c.technology : 0));
      c.armyCapacity = Math.max(0, Number.isFinite(c.armyCapacity) ? c.armyCapacity : 0);
      c.armySize = Math.max(
        0,
        Math.min(c.armyCapacity, Number.isFinite(c.armySize) ? c.armySize : 0),
      );
    }
  }
  return s;
}

/** Returns a new world, years later. The original is left untouched. */
export function advanceWorld(w: WorldState, years: number) {
  return simulateYears(structuredClone(w), years);
}

/** Headless reference run used by npm run sim. */
export function runBalanceTest(seed = 424242, years = 5000, mapSize: MapSize = 'medium') {
  const world = createWorld(
    { name: 'Balance Test', mapSize, mapVariant: 1, tribeCount: 36, nameMode: 'mixed' },
    seed,
  );
  const tracker = new RunTracker();
  simulateYears(world, years, s => tracker.observe(s));
  return { world, metrics: summarize(world, tracker) };
}
