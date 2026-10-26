import type { Character, Civilization, MapKind, MapSize, Moment, WorldState } from '../types.ts';
import { RNG } from './rng.ts';
import { neighborRealms, neigh } from './util.ts';
import { rankFor, createCity, triggerCivilWar, ensureGlobalContact } from './realms.ts';
import { politicalCoreName, capitalName } from './naming.ts';
import { addEvent } from './events.ts';
import { foundReligion, processOfficialConversion } from './religion.ts';
import { startWar } from './war.ts';
import { RunTracker, summarize } from './metrics.ts';
import { captureEvolutionSnapshot } from './records.ts';
import { createWorld } from './world.ts';
import { courtOf, idx, rebuildIndex } from './lookup.ts';
import { realmModifiers, type ModTotals } from './modifiers.ts';
import { checkAmbition, createCharacter, deathCheck, level } from './characters.ts';
import { endReign, rulerLifeCycle, succession } from './dynasty.ts';
import { isNotable, notableActs, spawnNotables } from './court.ts';
import { pruneCharacters } from './prune.ts';
import { driftAxes } from './axes.ts';
import { canAttack, diplomacyUpkeep, diplomacyYear, findRelation } from './diplomacy.ts';
import { colonize } from './colonies.ts';
import { tickGreatWar } from './greatwar.ts';
import { spreadDiscoveries, tickDiscovery } from './discovery.ts';
import { maybeStartRevolution, tickRevolution } from './revolutions.ts';
import { activeMoments } from './moments.ts';
import { updatePower, yearsOnTop } from './power.ts';
import {
  armyCapacity,
  closeBrokenRoutes,
  growDevelopment,
  navyCapacity,
  realmOutput,
} from './economy.ts';
import { buildable, build, type BuildingDef } from './buildings.ts';
import { changeGovernment, governmentFor } from './government.ts';
import { createWonder } from './wonders.ts';
import { overdueBreakthroughs, researchYear } from './research.ts';
import { courtEvents, disasters } from './disasters.ts';
import { closeSeason } from './seasons.ts';

/** Everything one realm's yearly steps share. */
interface RealmYear {
  c: Civilization;
  mods: ModTotals;
  neighbors: Civilization[];
  atWar: boolean;
}

/** Development, output, armies, fleets, stability and research. */
function economyYear(s: WorldState, y: RealmYear, r: RNG) {
  const { c, mods } = y;
  growDevelopment(s, c, mods);
  const out = realmOutput(s, c, mods);
  c.development = Math.round(out.development);
  c.wealth = out.wealth.total;
  c.manpower = out.manpower.total;
  c.influence = out.influence.total;
  c.armyCapacity = armyCapacity(c, c.manpower);
  c.armySize =
    c.armySize < c.armyCapacity
      ? Math.min(c.armyCapacity, Math.round(c.armySize + c.armyCapacity * 0.05))
      : c.armyCapacity;
  c.navyCapacity = navyCapacity(s, c, mods);
  c.navy =
    c.navy < c.navyCapacity
      ? Math.min(c.navyCapacity, Math.round(c.navy + c.navyCapacity * 0.04 + 1))
      : c.navyCapacity;
  // Stability drifts toward what the state and the court can sustain.
  const target = 52 + mods.stability;
  c.stability = Math.max(5, Math.min(100, c.stability + (target - c.stability) * 0.015));
  researchYear(s, c, out.research.total, r);
}

/** What a realm builds depends on what kind of country it is. */
const BUILDING_AXIS: Partial<Record<BuildingDef['type'], [keyof Civilization['axes'], 1 | -1]>> = {
  Granary: ['economy', -1],
  Market: ['economy', 1],
  'Guild Hall': ['economy', 1],
  Factory: ['economy', 1],
  Harbor: ['horizon', 1],
  Temple: ['faith', -1],
  Library: ['faith', 1],
  University: ['faith', 1],
  Barracks: ['ambition', 1],
  Fortress: ['ambition', 1],
};

function pickBuilding(c: Civilization, options: BuildingDef[], r: RNG) {
  const weight = (d: BuildingDef) => {
    const axis = BUILDING_AXIS[d.type];
    if (!axis) return 1;
    return 1 + Math.max(0, ((c.axes[axis[0]] - 50) / 50) * axis[1]) * 3;
  };
  let roll = r.next() * options.reduce((n, d) => n + weight(d), 0);
  for (const d of options) {
    roll -= weight(d);
    if (roll <= 0) return d;
  }
  return options[0];
}

/** Buildings, new cities, settling empty land and overseas colonies. */
function landYear(s: WorldState, y: RealmYear, r: RNG) {
  const { c, mods } = y;
  const court = courtOf(s, c.id);
  for (const id of c.cityIds) {
    if (!r.chance(0.004 * (1 + mods.build))) continue;
    const city = idx(s).city.get(id);
    if (!city) continue;
    const coastal = neigh(s.provinces[city.provinceId], s).some(n => n.terrain === 'ocean');
    const options = buildable(c, city, coastal);
    if (!options.length) continue;
    const def = pickBuilding(c, options, r);
    // A fitting notable builds it; otherwise the ruler sponsors it.
    const fits = (role: string, kinds: string[]) =>
      kinds.includes(def.type) ? court.find(x => x.role === role) : undefined;
    const builder =
      fits('Merchant', ['Market', 'Guild Hall', 'Harbor', 'Factory']) ??
      fits('General', ['Barracks', 'Fortress']) ??
      fits('Scholar', ['Library', 'University']) ??
      fits('Prophet', ['Temple']) ??
      court.find(x => x.id === c.rulerId);
    build(s, c, city, def, builder);
  }
  // A realm founds a new city when it has many provinces per city.
  if (
    c.provinces.length >= 6 &&
    c.cityIds.length < Math.floor(c.provinces.length / 6) &&
    r.chance(0.01)
  ) {
    const site = c.provinces
      .map(id => s.provinces[id])
      .filter(p => !p.cityId && p.development >= 3)
      .sort((a, b) => b.development - a.development)[0];
    if (site) createCity(s, c, site, r);
  }
  // Expansionist peoples settle empty land faster.
  const free = c.provinces
    .flatMap(id => neigh(s.provinces[id], s))
    .filter(p => p.terrain !== 'ocean' && p.ownerId === null);
  if (free.length && r.chance(0.012 * (0.5 + c.axes.ambition / 100))) {
    const p = r.pick(free);
    p.ownerId = c.id;
    p.cultureId = c.cultureId;
    c.provinces.push(p.id);
  }
  colonize(s, c, mods, r);
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
    // Every settled realm has a capital city.
    if (newRank !== 'Tribe' && !c.cityIds.length) {
      const best = c.provinces
        .map(id => s.provinces[id])
        .sort((a, b) => b.development - a.development)[0];
      createCity(s, c, best, r, true);
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
      7,
      [c.id],
      {
        tags: ['realm evolution'],
        worldChronicle: newRank === 'Empire',
      },
    );
  }
  const expected = governmentFor(c);
  if (expected !== c.government && r.chance(0.02))
    changeGovernment(s, c, expected, 'the realm outgrew its old institutions');
  // Civil war: deep instability, two intolerant faiths of similar size, or a sprawling or complacent empire.
  const faithDev = new Map<number, number>();
  for (const id of c.provinces) {
    const p = s.provinces[id];
    if (p.religionId !== null)
      faithDev.set(p.religionId, (faithDev.get(p.religionId) ?? 0) + p.development);
  }
  const shares = [...faithDev.entries()]
    .map(([id, dev]) => ({ dev, tolerance: idx(s).religion.get(id)?.tolerance ?? 100 }))
    .sort((a, b) => b.dev - a.dev);
  const polarized =
    c.axes.faith < 60 &&
    shares.length >= 2 &&
    shares[1].dev >= c.development * 0.22 &&
    shares[0].tolerance < 42 &&
    shares[1].tolerance < 42;
  const pressure =
    (c.stability < 25 && c.axes.order > 60) ||
    (c.stability < 32 && polarized) ||
    (c.provinces.length > 50 && c.stability < 15 + c.provinces.length / 5) ||
    (yearsOnTop(s, c) > 250 && c.stability < 35);
  if (pressure && c.provinces.length >= 8 && r.chance(polarized ? 0.032 : 0.018))
    triggerCivilWar(s, c, r, polarized ? 'religious polarization' : 'political instability');
}

/** Word of distant continents travels slowly through known realms. */
function continentKnowledge(s: WorldState, c: Civilization) {
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
      4,
      [c.id],
      {
        continentIds: [con.id],
        tags: ['knowledge'],
      },
    );
  }
}

/** The ruler's family, the notables of the court, diplomacy, national drift and disasters. */
function courtYear(s: WorldState, y: RealmYear, r: RNG) {
  const { c, mods, atWar } = y;
  rulerLifeCycle(s, c, r);
  spawnNotables(s, c, atWar, r);
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
  diplomacyYear(s, c, y.neighbors, mods, r);
  const routes = s.tradeRoutes.filter(
    t =>
      t.active && (c.cityIds.includes(t.originCityId) || c.cityIds.includes(t.destinationCityId)),
  ).length;
  driftAxes(s, c, routes);
  disasters(s, c, r);
  courtEvents(s, c, r);
}

/**
 * Who to attack: a ruler's dream comes first, then the realm's character.
 * Zealots look for infidels, merchants for rich prey, everyone for the weak,
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
    (a.economy > 65 ? Math.min(3, n.wealth / Math.max(1, c.wealth)) : 0) +
    Math.min(3, c.armySize / Math.max(1, n.armySize)) * (a.ambition > 65 ? 1 : 0.4) +
    (findRelation(s, c.id, n.id, 'Rival') ? 3 : 0);
  let roll = r.next() * targets.reduce((n, t) => n + score(t), 0);
  for (const t of targets) {
    roll -= score(t);
    if (roll <= 0) return t;
  }
  return targets[0];
}

/** War declarations, faith, culture and the pull of stronger neighbours. */
function warAndInfluence(s: WorldState, y: RealmYear, r: RNG) {
  const { c, mods, neighbors, atWar } = y;
  const ruler = idx(s).char.get(c.rulerId);
  const targets = neighbors.filter(n => canAttack(s, c, n));
  if (targets.length && !atWar && r.chance(0.004 * Math.max(0.05, 1 + mods.warAppetite)))
    startWar(s, c, chooseTarget(s, c, targets, ruler, r), r);
  processOfficialConversion(s, c, r);
  // Influence spreads the realm's culture into its foreign provinces.
  const foreign = c.provinces.filter(id => s.provinces[id].cultureId !== c.cultureId);
  if (foreign.length && r.chance(0.03 * (c.influence / (c.influence + 30))))
    s.provinces[r.pick(foreign)].cultureId = c.cultureId;
  // A much stronger neighbouring culture unsettles a realm with a different faith or government.
  const culture = idx(s).culture.get(c.cultureId);
  for (const n of neighbors) {
    const nc = idx(s).culture.get(n.cultureId);
    if (!nc || !culture) continue;
    const gap = nc.strength - culture.strength;
    if (gap < 18 || (n.government === c.government && n.faithId === c.faithId)) continue;
    c.stability = Math.max(5, c.stability - Math.min(0.055, (gap - 12) / 900));
  }
  // The state faith spreads to pagan and neighbouring provinces.
  const faith = c.faithId ? idx(s).religion.get(c.faithId) : undefined;
  if (!faith) return;
  const owned = c.provinces.map(id => s.provinces[id]);
  const pagan = owned.filter(p => p.religionId === null);
  const others = owned.filter(
    p =>
      p.religionId !== c.faithId &&
      p.religionId !== null &&
      neigh(p, s).some(n => n.religionId === c.faithId),
  );
  const pressure = (faith.expansion / 350) * Math.max(0.2, 1 + mods.faithSpread);
  if (pagan.length && r.chance(Math.min(0.2, pressure))) r.pick(pagan).religionId = c.faithId;
  else if (others.length && r.chance(Math.min(0.065, pressure * 0.35)))
    r.pick(others).religionId = c.faithId;
}

function dynastyYear(s: WorldState, c: Civilization) {
  if (c.provinces.length > c.peakProvinces) {
    c.peakProvinces = c.provinces.length;
    c.peakYear = s.year;
  }
  const d = c.dynastyId ? idx(s).dynasty.get(c.dynastyId) : undefined;
  if (!d) return;
  d.totalYearsInPower++;
  d.peakTerritory = Math.max(d.peakTerritory, c.provinces.length);
  d.peakWealth = Math.max(d.peakWealth, c.wealth);
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

/** Rare global catalysts keep religions, breakthroughs and wonders appearing on time. */
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
  overdueBreakthroughs(s, r);
  if (
    s.year > -2000 &&
    s.wonders.length < 9 &&
    ((s.year + 3000) % 450 === 0 || r.chance(0.00035))
  ) {
    const hosts = living.filter(c => c.cityIds.length);
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

/** Culture strength, religion counts and each realm's official faith. */
function worldTotals(s: WorldState) {
  const cultureCount = new Map<number, number>();
  const faithCount = new Map<number, number>();
  const faithDev = new Map<number, Map<number, number>>();
  for (const p of s.provinces) {
    if (p.cultureId !== null)
      cultureCount.set(p.cultureId, (cultureCount.get(p.cultureId) ?? 0) + 1);
    if (p.religionId !== null)
      faithCount.set(p.religionId, (faithCount.get(p.religionId) ?? 0) + 1);
    if (p.ownerId !== null && p.religionId !== null) {
      const m = faithDev.get(p.ownerId) ?? new Map<number, number>();
      m.set(p.religionId, (m.get(p.religionId) ?? 0) + p.development);
      faithDev.set(p.ownerId, m);
    }
  }
  const living = s.civilizations.filter(c => c.provinces.length);
  const worldInfluence = Math.max(
    1,
    living.reduce((n, c) => n + c.influence, 0),
  );
  const cultureInfluence = new Map<number, number>();
  for (const c of living)
    cultureInfluence.set(c.cultureId, (cultureInfluence.get(c.cultureId) ?? 0) + c.influence);
  for (const cul of s.cultures) {
    cul.provinces = cultureCount.get(cul.id) ?? 0;
    cul.strength = Math.round(((cultureInfluence.get(cul.id) ?? 0) / worldInfluence) * 100);
  }
  for (const rel of s.religions) rel.provinces = faithCount.get(rel.id) ?? 0;
  // A realm's official faith follows its largest religion once that passes 30%.
  for (const c of living) {
    const majority = [...(faithDev.get(c.id) ?? new Map<number, number>()).entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];
    if (majority && majority[1] >= c.development * 0.3) c.faithId = majority[0];
  }
}

export function simulateYear(s: WorldState, r: RNG) {
  s.year++;
  rebuildIndex(s);
  const neighborsOf = new Map<number, Civilization[]>();
  for (const c of s.civilizations)
    if (c.provinces.length) neighborsOf.set(c.id, neighborRealms(s, c));
  for (const c of s.civilizations) {
    if (!c.provinces.length) {
      if (c.rulerId) {
        endReign(s, c, 'the fall of the realm');
        c.rulerId = 0;
        c.heirId = 0;
        c.regentId = 0;
      }
      continue;
    }
    const y: RealmYear = {
      c,
      mods: realmModifiers(s, c).total,
      neighbors: neighborsOf.get(c.id) ?? [],
      atWar: s.wars.some(w => w.active && w.participantIds.includes(c.id)),
    };
    economyYear(s, y, r);
    landYear(s, y, r);
    politics(s, y, r);
    continentKnowledge(s, c);
    courtYear(s, y, r);
    warAndInfluence(s, y, r);
    dynastyYear(s, c);
  }
  charactersYear(s, r);
  catalysts(s, r);
  // World Moments: Great Wars, Great Discoveries and World Revolutions.
  for (const m of activeMoments(s)) {
    if (m.kind === 'war') tickGreatWar(s, m, r);
    else if (m.kind === 'discovery') tickDiscovery(s, m);
    else tickRevolution(s, m, neighborsOf, r);
  }
  spreadDiscoveries(s, neighborsOf, r);
  maybeStartRevolution(s, r);
  diplomacyUpkeep(s);
  closeBrokenRoutes(s);
  updatePower(s);
  worldTotals(s);
  ensureGlobalContact(s);
  if (s.year % 100 === 0) {
    captureEvolutionSnapshot(s);
    closeSeason(s);
    pruneCharacters(s);
  }
}

/**
 * Runs the world forward in place. onYear is called after every year and may
 * return true to stop early.
 */
export function simulateYears(
  s: WorldState,
  years: number,
  onYear?: (s: WorldState) => boolean | void,
) {
  const r = new RNG((s.seed + s.year * 31 + years * 911) >>> 0);
  for (let i = 0; i < years; i++) {
    simulateYear(s, r);
    if (onYear?.(s)) break;
  }
  return s;
}

/** Returns a new world, years later. The original is left untouched. */
export function advanceWorld(w: WorldState, years: number) {
  return simulateYears(structuredClone(w), years);
}

/**
 * Like advanceWorld, but stops at the end of the first year in which a new
 * World Moment begins, so the player can watch it live.
 */
export function advanceUntilMoment(w: WorldState, years: number) {
  const known = new Set(w.moments.map(m => m.id));
  let started: Moment | undefined;
  const world = simulateYears(structuredClone(w), years, s => {
    started = s.moments.find(m => !known.has(m.id));
    return !!started;
  });
  return { world, started };
}

/** Headless reference run used by npm run sim. */
export function runBalanceTest(
  seed = 424242,
  years = 5000,
  mapSize: MapSize = 'medium',
  map: MapKind = 'fantasy',
  start = -3000,
) {
  const world = createWorld(
    { name: 'Balance Test', map, start, mapSize, mapVariant: 1, tribeCount: 36, nameMode: 'mixed' },
    seed,
  );
  const tracker = new RunTracker();
  simulateYears(world, years, s => tracker.observe(s));
  return { world, metrics: summarize(world, tracker) };
}
