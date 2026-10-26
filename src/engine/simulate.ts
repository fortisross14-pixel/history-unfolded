import type { MapSize, PersonRole, Civilization, WorldState } from '../types.ts';
import { TECHNOLOGIES } from './data.ts';
import { RNG } from './rng.ts';
import { neigh, has, urbanTarget, provinceReligionFollowers } from './util.ts';
import {
  rankFor,
  governmentFor,
  createCity,
  triggerCivilWar,
  revolution,
  ensureModernGlobalContact,
} from './realms.ts';
import { techCareerShare, createRuler, createPerson } from './characters.ts';
import { politicalCoreName, capitalName } from './naming.ts';
import { addEvent, processRealmEvents } from './events.ts';
import { discover } from './technology.ts';
import { BUILDINGS, build, createRoute } from './economy.ts';
import { createArtwork, createWonder } from './culture.ts';
import { foundReligion, processOfficialConversion } from './religion.ts';
import { startWar, battle } from './war.ts';
import { summarize } from './metrics.ts';
import { historicalScore, captureEvolutionSnapshot } from './records.ts';
import { createWorld } from './world.ts';

export function simulateYear(s: WorldState, r: RNG) {
  s.year++;
  s.realmEvents ??= [];
  s.hallOfFame ??= [];
  s.nextIds.realmEvent ??= 1;
  s.nextIds.hallOfFame ??= 1;
  for (const c of s.civilizations.filter(x => x.provinces.length)) {
    const culture = s.cultures.find(x => x.id === c.cultureId)!;
    const ruler = s.rulers.find(x => x.id === c.rulerId)!;
    const active = s.people.filter(p => p.active && p.realmId === c.id);
    const buildings = c.cityIds.flatMap(id => s.cities.find(x => x.id === id)?.buildings ?? []);
    const wonders = s.wonders.filter(w => w.realmId === c.id && w.status === 'standing');
    const gdpBoost =
      buildings.reduce((n, b) => n + b.gdpBonus, 0) +
      wonders.reduce((n, w) => n + w.gdpBonus, 0) +
      s.tradeRoutes
        .filter(
          t =>
            t.active &&
            (c.cityIds.includes(t.originCityId) || c.cityIds.includes(t.destinationCityId)),
        )
        .reduce((n, t) => n + t.gdpBonus, 0);
    const armyBoost =
      buildings.reduce((n, b) => n + b.armyBonus, 0) + wonders.reduce((n, w) => n + w.armyBonus, 0);
    const sciBoost =
      buildings.reduce((n, b) => n + b.scienceBonus, 0) +
      wonders.reduce((n, w) => n + w.scienceBonus, 0);
    processRealmEvents(s, c, culture, r);
    const admin = 0.72 + ruler.administration / 235,
      stable = 0.82 + c.stability / 430 + Math.max(-10, culture.unstableStable) / 120;
    const ownedNow = c.provinces.map(id => s.provinces[id]).filter(Boolean),
      continent = s.continents.find(ct => ct.id === (ownedNow[0]?.continentId ?? -1)),
      avgFertility = ownedNow.length
        ? ownedNow.reduce((n, p) => n + p.fertility, 0) / ownedNow.length
        : 45;
    const populationInfrastructure = buildings
      .filter(b => ['Granary', 'Aqueduct', 'Hospital'].includes(b.type))
      .reduce((n, b) => n + b.level * 0.018, 0);
    const eraPopRate =
      s.year < -1500
        ? 0.00125
        : s.year < 0
          ? 0.00145
          : s.year < 1200
            ? 0.00135
            : s.year < 1800
              ? 0.00165
              : 0.0011;
    const fertilityFactor = 0.72 + avgFertility / 115;
    const popRate =
      eraPopRate *
      stable *
      (has(c, 'agriculture') ? 1.22 : 0.78) *
      fertilityFactor *
      (1 + Math.min(0.32, populationInfrastructure)) *
      (1 + (continent?.populationBonus ?? 0));
    c.population = Math.round(c.population * (1 + popRate));
    const viableFloor = Math.max(
      300,
      c.provinces.length *
        (s.year < -1500
          ? 350
          : s.year < 0
            ? 900
            : s.year < 1200
              ? 1800
              : s.year < 1800
                ? 3500
                : 7000),
    );
    if (c.population < viableFloor)
      c.population = Math.round(c.population + (viableFloor - c.population) * 0.06);
    const merchantPower = active
      .filter(p => p.role === 'Merchant')
      .reduce(
        (n, p) =>
          n + p.stars * (1 + p.tradeRoutesCreated.length * 0.18 + p.buildingsCreated.length * 0.1),
        0,
      );
    const routeCount = s.tradeRoutes.filter(
      t =>
        t.active && (c.cityIds.includes(t.originCityId) || c.cityIds.includes(t.destinationCityId)),
    ).length;
    const cityProsperity = c.cityIds.length
      ? c.cityIds
          .map(id => s.cities.find(x => x.id === id)?.prosperity ?? 30)
          .reduce((a, b) => a + b, 0) / c.cityIds.length
      : 25;
    const commercialMultiplier =
      (1 + (continent?.gdpBonus ?? 0)) *
      (1 +
        Math.min(3.1, gdpBoost * 2.35) +
        Math.min(1.15, merchantPower * 0.031) +
        Math.min(0.45, routeCount * 0.055));
    const targetGDP = Math.max(
      1,
      (c.population / 980) *
        (0.72 + c.technology / 760) *
        commercialMultiplier *
        admin *
        (0.82 + cityProsperity / 210) *
        (1 + (culture.economicCreative < 0 ? -culture.economicCreative * 0.026 : 0)),
    );
    const gdpCatchup =
      0.018 + Math.min(0.075, gdpBoost * 0.022 + merchantPower * 0.00105 + routeCount * 0.0018);
    c.gdp += Math.max(
      -c.gdp * 0.035,
      Math.min(
        c.gdp * (0.045 + Math.min(0.06, gdpBoost * 0.018)),
        (targetGDP - c.gdp) * gdpCatchup,
      ),
    );
    const provinceWeight = ownedNow.reduce(
      (n, p) => n + Math.max(1, p.population) * (0.7 + p.fertility / 180),
      0,
    );
    for (const province of ownedNow) {
      const share =
        (Math.max(1, province.population) * (0.7 + province.fertility / 180)) /
        Math.max(1, provinceWeight);
      province.gdp = Math.max(0.01, c.gdp * share);
    }
    c.gdp = ownedNow.reduce((n, p) => n + p.gdp, 0);
    const scholarPower = active
      .filter(p => ['Scientist', 'Engineer'].includes(p.role))
      .reduce(
        (n, p) =>
          n +
          p.stars * (1 + p.technologiesRevealed.length * 0.12 + p.buildingsCreated.length * 0.06),
        0,
      );
    c.technology = Math.min(
      1000,
      c.technology +
        0.07 +
        (sciBoost * 0.27 + scholarPower * 0.135 * admin) * (1 + (continent?.technologyBonus ?? 0)),
    );
    if (!Number.isFinite(c.armyCapacity)) c.armyCapacity = Math.max(10, c.armySize);
    const targetArmy = Math.max(
      10,
      Math.round(
        c.population *
          (0.009 + Math.max(0, culture.peacefulViolent) * 0.0011) *
          (1 + Math.min(0.5, armyBoost)) *
          (1 + (continent?.armyBonus ?? 0)) *
          (0.75 + ruler.military / 250),
      ),
    );
    c.armyCapacity = Math.max(10, targetArmy);
    if (c.armySize < c.armyCapacity)
      c.armySize = Math.min(c.armyCapacity, Math.round(c.armySize + c.armyCapacity * 0.05));
    else c.armySize = Math.min(c.armySize, c.armyCapacity);
    c.stability = Math.max(
      5,
      Math.min(
        100,
        c.stability + culture.unstableStable / 700 + (ruler.administration - 50) / 4000,
      ),
    );
    c.prestige += wonders.reduce((n, w) => n + w.historicalRelevance / 1000, 0);
    for (const city of c.cityIds.map(id => s.cities.find(x => x.id === id)!).filter(Boolean)) {
      city.prosperity = Math.max(5, Math.min(100, city.prosperity + 0.01 + gdpBoost * 0.007));
      const possible = BUILDINGS.filter(
        b =>
          c.technology >= b.tech &&
          (!b.requires || has(c, b.requires)) &&
          (!b.coastal || neigh(s.provinces[city.provinceId], s).some(n => n.terrain === 'ocean')),
      );
      if (possible.length && r.chance(0.0025)) {
        const def = r.pick(possible),
          suitable = active.find(
            p =>
              (p.role === 'Merchant' &&
                ['Market', 'Harbor', 'Merchant Guild', 'Bank', 'Stock Exchange'].includes(
                  def.type,
                )) ||
              (p.role === 'General' &&
                ['Barracks', 'Fortifications', 'Military Academy'].includes(def.type)) ||
              (['Scientist', 'Engineer'].includes(p.role) &&
                ['Library', 'University', 'Printing House', 'Hospital'].includes(def.type)),
          );
        build(s, c, city, def, suitable);
      }
    }
    const border = c.provinces
      .flatMap(id => neigh(s.provinces[id], s))
      .filter(p => p.terrain !== 'ocean' && p.ownerId === null);
    if (border.length && r.chance(0.012)) {
      const p = r.pick(border);
      p.ownerId = c.id;
      p.cultureId = c.cultureId;
      c.provinces.push(p.id);
    }
    const homeCont = s.provinces[c.provinces[0]]?.continentId ?? 0,
      land = s.continents.find(x => x.id === homeCont)?.provinceIds.length ?? 1,
      emp = s.civilizations.filter(
        x =>
          x.rank === 'Empire' && x.provinces.some(id => s.provinces[id].continentId === homeCont),
      ).length,
      newRank = rankFor(c, land, emp - (c.rank === 'Empire' ? 1 : 0));
    if (newRank !== c.rank) {
      c.rank = newRank;
      if (
        newRank === 'City-State' &&
        !s.cities.some(
          city => city.currentRealmId === c.id && c.provinces.includes(city.provinceId),
        )
      ) {
        const capitalProvince = c.provinces
          .map(id => s.provinces[id])
          .sort((a, b) => b.population - a.population)[0];
        createCity(s, c, capitalProvince, r, true);
      }
      const core = c.successorIdentity ?? politicalCoreName(c, s);
      c.name = c.successorIdentity
        ? core
        : newRank === 'Tribe'
          ? `${c.originTribe} Tribe`
          : newRank === 'Settlement'
            ? `${c.originTribe} Settlements`
            : newRank === 'City-State'
              ? (s.cities.find(x => x.id === c.capitalCityId)?.name ??
                capitalName(c.originTribe, r, s))
              : newRank === 'Duchy'
                ? core
                : newRank === 'Kingdom'
                  ? `Kingdom of ${core}`
                  : `${core} Empire`;
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
        { tags: ['realm evolution'], worldChronicle: newRank === 'Empire' },
      );
    }
    const expectedGovernment = governmentFor(c, s.year);
    if (expectedGovernment !== c.government && r.chance(0.025)) {
      const old = c.government;
      c.governmentHistory.at(-1)!.to = s.year;
      c.government = expectedGovernment;
      c.governmentHistory.push({
        government: expectedGovernment,
        from: s.year,
        reason: 'Institutional development',
      });
      addEvent(
        s,
        'politics',
        `${c.name} adopts a ${expectedGovernment}`,
        `${c.name} replaced its ${old} with a ${expectedGovernment} as its institutions and population developed.`,
        7,
        [c.id],
        {
          tags: ['government change', 'institutional reform'],
          worldChronicle: ['Democracy', 'Federation', 'Imperial Court'].includes(
            expectedGovernment,
          ),
        },
      );
    }
    const religionShares = [
      ...new Map(
        c.provinces
          .map(id => s.provinces[id])
          .filter(p => p.religionId !== null)
          .map(p => [p.religionId!, 0]),
      ).keys(),
    ]
      .map(id => ({
        id,
        pop: c.provinces
          .filter(pid => s.provinces[pid].religionId === id)
          .reduce((n, pid) => n + s.provinces[pid].population, 0),
        tolerance: s.religions.find(rel => rel.id === id)?.tolerance ?? 100,
      }))
      .sort((a, b) => b.pop - a.pop);
    const polarized =
      religionShares.length >= 2 &&
      religionShares[1].pop >= c.population * 0.22 &&
      religionShares[0].tolerance < 42 &&
      religionShares[1].tolerance < 42;
    const civilPressure =
      (c.stability < 22 && culture.unstableStable <= -5) || (c.stability < 32 && polarized);
    if (civilPressure && c.provinces.length >= 8 && r.chance(polarized ? 0.032 : 0.018))
      triggerCivilWar(s, c, r, polarized ? 'religious polarization' : 'political instability');
    const currentUrban = c.cityIds.reduce(
        (n, id) => n + (s.cities.find(x => x.id === id)?.population ?? 0),
        0,
      ),
      targetUrban = urbanTarget(s.year, c.technology);
    if (
      ['Duchy', 'Kingdom', 'Empire'].includes(c.rank) &&
      c.provinces.length >= 8 &&
      c.cityIds.length < Math.max(2, Math.floor(c.provinces.length / 8)) &&
      currentUrban / c.population < targetUrban * 0.72 &&
      c.population > c.cityIds.length * 7000 &&
      r.chance(0.004)
    ) {
      const candidate = c.provinces
        .map(id => s.provinces[id])
        .filter(p => !p.cityId)
        .sort((a, b) => b.fertility - a.fertility || b.population - a.population)[0];
      if (candidate) createCity(s, c, candidate, r);
    }
    const eligible = TECHNOLOGIES.filter(t => s.year >= t.earliestYear && !has(c, t.id));
    for (const t of eligible) {
      const borderingIds = [
        ...new Set(
          c.provinces
            .flatMap(id => neigh(s.provinces[id], s))
            .map(p => p.ownerId)
            .filter((id): id is number => !!id && id !== c.id),
        ),
      ];
      const knowing = borderingIds.filter(id =>
        s.civilizations
          .find(x => x.id === id)
          ?.knownTechnologies.some(k => k.technologyId === t.id),
      ).length;
      if (knowing) {
        const key = t.id;
        c.technologyExposure[key] = (c.technologyExposure[key] ?? 0) + (knowing >= 2 ? 2 : 1);
        if (c.technologyExposure[key] >= 36) {
          c.knownTechnologies.push({
            technologyId: t.id,
            discoveredYear: s.year,
            source: 'diffusion',
          });
          c.technology = Math.min(1000, c.technology + 14);
          delete c.technologyExposure[key];
          addEvent(
            s,
            'technology',
            `${t.name} reaches ${c.name}`,
            `${t.name} spread into ${c.name} after sustained border contact with ${knowing >= 2 ? 'multiple neighboring civilizations' : 'a neighboring civilization'}.`,
            5,
            [c.id],
            { technologyIds: [t.id], tags: ['technology diffusion'] },
          );
        }
      }
    }
    const living = s.people.filter(p => p.active).length;
    if (
      c.cityIds.length &&
      living <
        Math.max(3, Math.round(s.civilizations.filter(x => x.provinces.length).length / 5)) &&
      r.chance(0.0014)
    )
      createPerson(s, c, r);
    for (const p of active) {
      const environment = Math.max(0.2, (ruler.administration / 100) * (c.stability / 100));
      const careerYears = Math.max(0, s.year - p.born - 18);
      if (
        ['Scientist', 'Engineer'].includes(p.role) &&
        careerYears >= 6 &&
        p.technologyContributionApplied === 0
      ) {
        let contribution = techCareerShare(p.stars);
        const eligible = TECHNOLOGIES.filter(
          t => t.id !== 'agriculture' && s.year >= t.earliestYear && !has(c, t.id),
        );
        for (const t of eligible) {
          if (contribution <= 0) break;
          const key = t.id,
            current = c.technologyProgress[key] ?? 0,
            needed = 1 - current,
            used = Math.min(needed, contribution);
          c.technologyProgress[key] = current + used;
          contribution -= used;
          p.technologyPoints += Math.round(used * 100);
          p.impact += used * 18;
          if (c.technologyProgress[key] >= 0.999) {
            discover(s, c, t.id, p);
            c.technologyProgress[key] = 1;
          }
        }
        p.technologyContributionApplied = techCareerShare(p.stars) - contribution;
        p.careerMilestones.push('technology-career-contribution');
      }
      p.impact += p.stars * 0.06 * (0.6 + environment);
      if (['Scientist', 'Engineer'].includes(p.role)) {
        const yearly = p.stars * 0.12 * (0.55 + environment);
        p.technologyPoints += yearly;
        c.technology = Math.min(1000, c.technology + yearly * 0.025);
        const candidates = eligible.filter(t => t.id !== 'agriculture');
        if (p.stars >= 4 && candidates.length && r.chance(p.stars === 5 ? 0.035 : 0.018))
          discover(s, c, r.pick(candidates).id, p);
        if (c.cityIds.length && p.stars >= 3 && r.chance(0.01 + p.stars * 0.002)) {
          const city = s.cities.find(x => x.id === r.pick(c.cityIds));
          const defs = BUILDINGS.filter(
            b =>
              ['Library', 'University', 'Printing House', 'Hospital'].includes(b.type) &&
              c.technology >= b.tech &&
              (!b.requires || has(c, b.requires)) &&
              !city?.buildings.some(x => x.type === b.type),
          );
          if (city && defs.length) build(s, c, city, r.pick(defs), p);
        }
      }
      if (p.role === 'Merchant') {
        const wealth = p.stars * 0.05 * c.gdp * environment;
        p.wealthCreated += wealth;
        c.gdp += wealth * 0.006;
        const routeTarget =
          p.stars === 1 ? 0 : p.stars === 2 ? 1 : p.stars === 3 ? 2 : p.stars === 4 ? 3 : 4;
        const buildingTarget =
          p.stars === 1 ? 0 : p.stars === 2 ? 1 : p.stars === 3 ? 2 : p.stars === 4 ? 3 : 4;
        if (
          p.tradeRoutesCreated.length < routeTarget &&
          p.stars >= 2 &&
          r.chance(0.018 + p.stars * 0.004)
        )
          createRoute(s, c, p, r);
        if (
          p.buildingsCreated.length < buildingTarget &&
          c.cityIds.length &&
          r.chance(0.02 + p.stars * 0.004)
        ) {
          const city = s.cities.find(x => x.id === r.pick(c.cityIds));
          const defs = BUILDINGS.filter(
            b =>
              [
                'Trading Post',
                'Market',
                'Harbor',
                'Merchant Guild',
                'Bank',
                'Stock Exchange',
              ].includes(b.type) &&
              c.technology >= b.tech &&
              (!b.requires || has(c, b.requires)) &&
              !city?.buildings.some(x => x.type === b.type),
          );
          if (city && defs.length) build(s, c, city, r.pick(defs), p);
        }
      }
      if (p.role === 'Artist' && c.cityIds.length) {
        const artTarget =
          p.stars === 1 ? 1 : p.stars === 2 ? 1 : p.stars === 3 ? 2 : p.stars === 4 ? 3 : 4;
        const buildingTarget = p.stars <= 2 ? 1 : p.stars === 3 ? 2 : p.stars === 4 ? 3 : 4;
        if (
          p.artworkIds.length < artTarget &&
          r.chance(0.022 + p.stars * 0.005 + Math.max(0, culture.economicCreative) * 0.0007)
        )
          createArtwork(s, c, p, r);
        if (p.buildingsCreated.length < buildingTarget && r.chance(0.016 + p.stars * 0.004)) {
          const city = s.cities.find(x => x.id === r.pick(c.cityIds));
          const defs = BUILDINGS.filter(
            b =>
              ['Artist Workshop', 'Theater', 'Library', 'Printing House'].includes(b.type) &&
              c.technology >= b.tech &&
              (!b.requires || has(c, b.requires)) &&
              !city?.buildings.some(x => x.type === b.type),
          );
          if (city && defs.length) build(s, c, city, r.pick(defs), p);
        }
      }
      if (p.role === 'Religious Figure') {
        if (
          !p.religionId &&
          p.stars >= 4 &&
          s.religions.length < 7 &&
          r.chance(p.stars === 5 ? 0.025 : 0.012)
        )
          foundReligion(s, c, p, r);
        else if (p.religionId) {
          const rel = s.religions.find(x => x.id === p.religionId);
          if (rel) {
            const gain = Math.max(
              1,
              Math.round(c.population * p.stars * 0.00045 * (0.6 + environment)),
            );
            rel.followers += gain;
            p.followersGained += gain;
            p.impact += (gain / Math.max(100, c.population)) * 20;
          }
        }
      }
      if (p.role === 'General') {
        // Great generals improve readiness even outside battle and are more likely to leave military institutions.
        const beforeArmy = c.armySize;
        c.armySize = Math.min(
          c.armyCapacity,
          c.armySize + Math.max(1, Math.round(c.armyCapacity * p.stars * 0.0015)),
        );
        p.armyAdded += Math.max(0, c.armySize - beforeArmy);
        if (c.cityIds.length && p.stars >= 3 && r.chance(0.009 + p.stars * 0.002)) {
          const city = s.cities.find(x => x.id === r.pick(c.cityIds));
          const defs = BUILDINGS.filter(
            b =>
              ['Barracks', 'Fortifications', 'Military Academy'].includes(b.type) &&
              c.technology >= b.tech &&
              !city?.buildings.some(x => x.type === b.type),
          );
          if (city && defs.length) build(s, c, city, r.pick(defs), p);
        }
      }
      if (p.role === 'Politician') {
        const pressure =
          Math.max(0, -culture.unstableStable) * 4 +
          Math.max(0, 45 - c.stability) +
          (50 - ruler.administration) * 0.25;
        if (pressure > 45 && p.stars >= 3 && r.chance(0.006 + pressure / 22000))
          revolution(s, c, p, r);
        else if (c.stability < 80) {
          const gain = p.stars * 0.035 * (0.5 + environment);
          c.stability = Math.min(100, c.stability + gain);
          p.stabilityAdded += gain;
          p.impact += gain * 0.8;
        }
      }
      // Career guarantees: high-potential people must leave visible evidence, not merely receive better odds.
      if (p.stars >= 3 && careerYears >= 6) {
        if (
          ['Scientist', 'Engineer'].includes(p.role) &&
          !p.careerMilestones.includes('first-project') &&
          c.cityIds.length
        ) {
          const city =
            s.cities.find(x => x.id === c.capitalCityId) ??
            s.cities.find(x => x.id === c.cityIds[0]);
          const wanted =
            p.role === 'Engineer'
              ? [
                  'Road Network',
                  'Workshop',
                  'Forge',
                  'Aqueduct',
                  'Observatory',
                  'Shipyard',
                  'Hospital',
                ]
              : ['Library', 'Observatory', 'University', 'Printing House'];
          const defs = BUILDINGS.filter(
            b =>
              wanted.includes(b.type) &&
              c.technology >= b.tech &&
              (!b.requires || has(c, b.requires)) &&
              (!b.coastal ||
                (city &&
                  neigh(s.provinces[city.provinceId], s).some(x => x.terrain === 'ocean'))) &&
              !city?.buildings.some(x => x.type === b.type),
          );
          if (city) {
            build(
              s,
              c,
              city,
              defs.length ? r.pick(defs) : BUILDINGS.find(b => b.type === 'Workshop')!,
              p,
            );
            p.careerMilestones.push('first-project');
            p.achievement = `Founded ${city.buildings.at(-1)?.name}`;
          }
        }
        if (
          p.role === 'General' &&
          !p.careerMilestones.includes('military-institution') &&
          c.cityIds.length
        ) {
          const city =
            s.cities.find(x => x.id === c.capitalCityId) ??
            s.cities.find(x => x.id === c.cityIds[0]);
          const defs = BUILDINGS.filter(
            b =>
              ['Barracks', 'Fortifications', 'Military Academy', 'Forge', 'Shipyard'].includes(
                b.type,
              ) &&
              c.technology >= b.tech &&
              (!b.requires || has(c, b.requires)) &&
              (!b.coastal ||
                (city &&
                  neigh(s.provinces[city.provinceId], s).some(x => x.terrain === 'ocean'))) &&
              !city?.buildings.some(x => x.type === b.type),
          );
          if (city) {
            build(
              s,
              c,
              city,
              defs.length ? r.pick(defs) : BUILDINGS.find(b => b.type === 'Barracks')!,
              p,
            );
            p.careerMilestones.push('military-institution');
            p.achievement = `Founded ${city.buildings.at(-1)?.name}`;
          }
        }
        if (
          p.role === 'Artist' &&
          !p.careerMilestones.includes('first-artwork') &&
          c.cityIds.length
        ) {
          createArtwork(s, c, p, r);
          if (p.artworkIds.length) p.careerMilestones.push('first-artwork');
        }
        if (
          p.role === 'Merchant' &&
          !p.careerMilestones.includes('commercial-project') &&
          c.cityIds.length
        ) {
          const city =
            s.cities.find(x => x.id === c.capitalCityId) ??
            s.cities.find(x => x.id === c.cityIds[0]);
          const defs = BUILDINGS.filter(
            b =>
              [
                'Trading Post',
                'Market',
                'Harbor',
                'Merchant Guild',
                'Bank',
                'Stock Exchange',
              ].includes(b.type) &&
              c.technology >= b.tech &&
              (!b.requires || has(c, b.requires)) &&
              (!b.coastal ||
                (city &&
                  neigh(s.provinces[city.provinceId], s).some(x => x.terrain === 'ocean'))) &&
              !city?.buildings.some(x => x.type === b.type),
          );
          if (city) {
            build(
              s,
              c,
              city,
              defs.length ? r.pick(defs) : BUILDINGS.find(b => b.type === 'Trading Post')!,
              p,
            );
            p.careerMilestones.push('commercial-project');
          }
        }
        if (p.role === 'Politician' && !p.careerMilestones.includes('political-achievement')) {
          const pressure =
            Math.max(0, -culture.unstableStable) * 4 +
            Math.max(0, 50 - c.stability) +
            (55 - ruler.administration) * 0.3;
          if (p.stars >= 4 && pressure >= 35) {
            revolution(s, c, p, r);
            p.careerMilestones.push('political-achievement');
          } else {
            const gain = Math.min(25, 6 + p.stars * 3);
            c.stability = Math.min(100, c.stability + gain);
            p.stabilityAdded += gain;
            p.impact += gain;
            p.careerMilestones.push('political-achievement');
            p.achievement = `Stabilized ${c.name} by ${gain.toFixed(0)} points`;
            addEvent(
              s,
              'politics',
              `${p.name} reforms ${c.name}`,
              `${p.name} enacted major reforms, increasing stability by ${gain.toFixed(0)} points.`,
              p.stars >= 4 ? 8 : 6,
              [c.id],
              { personIds: [p.id], tags: ['political reform', 'stability'] },
            );
          }
        }
      }
      if (
        p.role === 'Religious Figure' &&
        !p.religionId &&
        p.stars >= 4 &&
        careerYears >= (p.stars === 5 ? 3 : 7) &&
        s.religions.length < 6
      )
        foundReligion(s, c, p, r);
      if (
        p.role === 'Religious Figure' &&
        p.religionId &&
        p.stars >= 3 &&
        careerYears >= 8 &&
        !p.careerMilestones.includes('religious-institution') &&
        c.cityIds.length
      ) {
        const city =
          s.cities.find(x => x.id === c.capitalCityId) ?? s.cities.find(x => x.id === c.cityIds[0]);
        const defs = BUILDINGS.filter(
          b =>
            ['Shrine', 'Temple', 'Monastery', 'Cathedral'].includes(b.type) &&
            c.technology >= b.tech &&
            (!b.requires || has(c, b.requires)) &&
            !city?.buildings.some(x => x.type === b.type),
        );
        if (city) {
          build(
            s,
            c,
            city,
            defs.length ? r.pick(defs) : BUILDINGS.find(b => b.type === 'Shrine')!,
            p,
          );
          p.careerMilestones.push('religious-institution');
          p.achievement = `Established ${city.buildings.at(-1)?.name}`;
        }
      }
      if (
        p.stars === 5 &&
        !p.wonderIds.length &&
        careerYears >= 8 &&
        (r.chance(0.025) || careerYears >= 22)
      )
        createWonder(s, c, p, r);
      p.historicalRelevance = Math.min(
        100,
        Math.round(
          p.stars * 4 +
            Math.sqrt(Math.max(0, p.impact)) * 3 +
            p.technologyPoints / 8 +
            p.battlesWon * 2.2 +
            (p.wealthCreated / Math.max(1, c.gdp)) * 2 +
            (p.followersGained /
              Math.max(
                1,
                s.civilizations.reduce((n, x) => n + x.population, 0),
              )) *
              80 +
            p.artworkIds.reduce(
              (n, id) => n + (s.artworks.find(a => a.id === id)?.rating ?? 0) / 30,
              0,
            ) +
            p.buildingsCreated.length * 1.8 +
            p.tradeRoutesCreated.length * 3 +
            p.wonderIds.length * 18 +
            p.revolutionsLed * 18 +
            (p.armyAdded / Math.max(10, c.armyCapacity)) * 12 +
            p.stabilityAdded * 0.35,
        ),
      );
      if (s.year - p.born > r.int(58, 84)) {
        p.active = false;
        p.died = s.year;
        addEvent(
          s,
          'great-person',
          `${p.name} dies`,
          `${p.name}, ${p.role.toLowerCase()} of ${c.name}, died with historical relevance ${p.historicalRelevance}/100.`,
          p.historicalRelevance > 70 ? 8 : 4,
          [c.id],
          {
            personIds: [p.id],
            tags: ['death', p.role],
            worldChronicle: p.historicalRelevance >= 90,
          },
        );
      }
    }
    if (s.year >= ruler.plannedReignEnd) {
      const oldDynasty = s.dynasties.find(x => x.id === c.dynastyId);
      const dynastyAge = oldDynasty ? s.year - oldDynasty.foundedYear : 0;
      const noHeir = r.chance(dynastyAge < 120 ? 0.006 : 0.014);
      if (noHeir && oldDynasty) {
        oldDynasty.status = 'extinct';
        oldDynasty.endedYear = s.year;
        c.dynastyId = null;
        addEvent(
          s,
          'politics',
          `${oldDynasty.name} ends`,
          `${ruler.name} died without an accepted heir. The ${oldDynasty.name} ended, opening a succession crisis in ${c.name}.`,
          8,
          [c.id],
          {
            dynastyIds: [oldDynasty.id],
            tags: ['dynasty ended', 'succession crisis'],
            worldChronicle: true,
          },
        );
        if (r.chance(0.5) && c.provinces.length >= 8) {
          c.stability = Math.max(8, c.stability - 28);
        }
      }
      createRuler(s, c, r, noHeir ? 'succession crisis' : 'succession');
    }
    const sailingKnown = c.knownTechnologies.find(k => k.technologyId === 'deep_sailing');
    if (
      sailingKnown &&
      s.continents.some(x => !c.knownContinentIds.includes(x.id)) &&
      s.year - sailingKnown.discoveredYear > 80 &&
      !active.some(p => p.role === 'General') &&
      r.chance(0.025)
    )
      createPerson(s, c, r, 'General');
    if (
      has(c, 'deep_sailing') &&
      active.some(p => p.role === 'General') &&
      r.chance(sailingKnown && s.year - sailingKnown.discoveredYear > 140 ? 0.02 : 0.0045)
    ) {
      const unknown = s.continents.filter(x => !c.knownContinentIds.includes(x.id));
      if (unknown.length) {
        const con = r.pick(unknown),
          gen = r.pick(active.filter(p => p.role === 'General'));
        c.knownContinentIds.push(con.id);
        con.discoveredByRealmId ??= c.id;
        con.discoveredByPersonId ??= gen.id;
        con.discoveredYear ??= s.year;
        const native = s.civilizations.filter(x =>
          x.provinces.some(id => s.provinces[id].continentId === con.id),
        );
        native.forEach(x => {
          if (!c.knownRealmIds.includes(x.id)) c.knownRealmIds.push(x.id);
          if (!x.knownRealmIds.includes(c.id)) x.knownRealmIds.push(c.id);
          const hc = s.provinces[c.provinces[0]].continentId!;
          if (!x.knownContinentIds.includes(hc)) x.knownContinentIds.push(hc);
        });
        addEvent(
          s,
          'exploration',
          `${c.name} discovers ${con.name}`,
          `${gen.name} crossed the open ocean and made first contact with ${native.length} realms on ${con.name}.`,
          10,
          [c.id, ...native.map(x => x.id)],
          {
            personIds: [gen.id],
            continentIds: [con.id],
            technologyIds: ['deep_sailing'],
            tags: ['first contact', 'continent discovery'],
            worldChronicle: true,
          },
        );
      }
    }
    for (const con of s.continents.filter(x => !c.knownContinentIds.includes(x.id))) {
      const informed = c.knownRealmIds.some(id =>
        s.civilizations.find(x => x.id === id)?.knownContinentIds.includes(con.id),
      );
      if (informed) {
        const k = String(con.id);
        c.continentExposure[k] = (c.continentExposure[k] ?? 0) + 1;
        if (c.continentExposure[k] >= 60) {
          c.knownContinentIds.push(con.id);
          addEvent(
            s,
            'exploration',
            `${c.name} learns of ${con.name}`,
            `After sixty years of contact, knowledge of ${con.name} reached ${c.name}.`,
            5,
            [c.id],
            { continentIds: [con.id], tags: ['knowledge diffusion'] },
          );
        }
      }
    }
    const enemyBorder = c.provinces
      .flatMap(id => neigh(s.provinces[id], s))
      .filter(p => p.ownerId && p.ownerId !== c.id);
    const targetIds = [...new Set(enemyBorder.map(p => p.ownerId!))];
    if (
      targetIds.length &&
      !s.wars.some(w => w.active && w.participantIds.includes(c.id)) &&
      culture.peacefulViolent + ruler.military / 20 > 5 &&
      r.chance(0.0028)
    ) {
      const d = s.civilizations.find(x => x.id === r.pick(targetIds));
      if (d) startWar(s, c, d, r);
    }
    // Strong neighboring cultures create political and religious pressure rather than acting as a decorative score.
    const neighbors = [
      ...new Set(
        c.provinces
          .flatMap(id => neigh(s.provinces[id], s))
          .map(p => p.ownerId)
          .filter((id): id is number => !!id && id !== c.id),
      ),
    ]
      .map(id => s.civilizations.find(x => x.id === id))
      .filter((x): x is Civilization => !!x);
    processOfficialConversion(s, c, r);
    for (const n of neighbors) {
      const nc = s.cultures.find(x => x.id === n.cultureId);
      if (!nc) continue;
      const gap = nc.strength - culture.strength;
      if (gap >= 18 && (n.government !== c.government || n.faithId !== c.faithId)) {
        const pressure = Math.min(0.055, (gap - 12) / 900);
        c.stability = Math.max(5, c.stability - pressure);
        if (r.chance(0.0007 + gap / 90000)) {
          addEvent(
            s,
            'culture',
            `${n.name} influences ${c.name}`,
            `${nc.name}'s stronger institutions and values intensified pressure inside ${c.name}, where government or religion differed.`,
            6,
            [n.id, c.id],
            { cultureIds: [nc.id, culture.id], tags: ['cultural pressure', 'foreign influence'] },
          );
        }
      }
    }
    c.historicalScore = historicalScore(s, c);
    c.legacyScore = Math.max(c.legacyScore, c.historicalScore);
    const d = s.dynasties.find(x => x.id === c.dynastyId);
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
    const owned = s.provinces.filter(p => p.ownerId === c.id);
    const desiredUrban = c.cityIds.length
      ? Math.round(c.population * urbanTarget(s.year, c.technology))
      : 0;
    const previousUrban = c.cityIds.reduce(
      (n, id) => n + (s.cities.find(x => x.id === id)?.population ?? 0),
      0,
    );
    c.urbanPopulation = Math.max(
      0,
      Math.min(c.population, Math.round(previousUrban + (desiredUrban - previousUrban) * 0.025)),
    );
    c.ruralPopulation = Math.max(0, c.population - c.urbanPopulation);
    const ownedCities = c.cityIds.map(id => s.cities.find(x => x.id === id)!).filter(Boolean),
      weight = ownedCities.reduce((n, x) => n + Math.max(10, x.prosperity), 0);
    ownedCities.forEach(
      city =>
        (city.population = Math.max(
          100,
          Math.round((c.urbanPopulation * Math.max(10, city.prosperity)) / Math.max(1, weight)),
        )),
    );
    const ruralHexes = owned.filter(p => !p.cityId),
      each = Math.max(1, Math.round(c.ruralPopulation / Math.max(1, ruralHexes.length)));
    owned.forEach(
      p =>
        (p.population = p.cityId ? (s.cities.find(x => x.id === p.cityId)?.population ?? 0) : each),
    );
    const provinceTotal = owned.reduce((n, p) => n + p.population, 0),
      populationRemainder = c.population - provinceTotal;
    if (populationRemainder !== 0 && owned.length) {
      const anchor =
        owned.find(p => p.id === s.cities.find(city => city.id === c.capitalCityId)?.provinceId) ??
        owned[0];
      anchor.population = Math.max(1, anchor.population + populationRemainder);
      if (anchor.cityId) {
        const anchorCity = s.cities.find(city => city.id === anchor.cityId);
        if (anchorCity) anchorCity.population = anchor.population;
      }
      c.urbanPopulation = c.cityIds.reduce(
        (n, id) => n + (s.cities.find(city => city.id === id)?.population ?? 0),
        0,
      );
      c.ruralPopulation = Math.max(0, c.population - c.urbanPopulation);
    }
    if (c.faithId) {
      const faith = s.religions.find(x => x.id === c.faithId);
      if (faith) {
        const ownPagan = owned.filter(p => p.religionId === null);
        const foreignAdjacent = owned.filter(
          p =>
            p.religionId !== c.faithId &&
            p.religionId !== null &&
            neigh(p, s).some(n => n.religionId === c.faithId),
        );
        const pressure =
          faith.expansion / 350 +
          buildings
            .filter(b => ['Shrine', 'Temple', 'Monastery', 'Cathedral'].includes(b.type))
            .reduce((n, b) => n + b.cultureBonus / 10, 0);
        if (ownPagan.length && r.chance(Math.min(0.2, pressure)))
          r.pick(ownPagan).religionId = c.faithId;
        else if (foreignAdjacent.length && r.chance(Math.min(0.065, pressure * 0.35)))
          r.pick(foreignAdjacent).religionId = c.faithId;
      }
    }
  } // Rare global historical catalysts keep religions and wonders meaningful without flooding the world.
  const livingRealms = s.civilizations.filter(x => x.provinces.length);
  const desiredReligions = Math.min(6, Math.max(4, Math.round(s.continents.length * 1.05)));
  if (
    s.religions.length < desiredReligions &&
    livingRealms.length &&
    ((s.religions.length === 0 && s.year >= -2850) ||
      ((s.year + 3000) % 650 === 0 && s.year > -2850) ||
      r.chance(0.00035))
  ) {
    const eligibleHosts = livingRealms.filter(c => c.provinces.length);
    if (eligibleHosts.length) {
      const host = r.pick(eligibleHosts);
      const prophet = createPerson(s, host, r, 'Religious Figure');
      prophet.stars = r.chance(0.18) ? 5 : 4;
      foundReligion(s, host, prophet, r);
    }
  }
  for (const t of TECHNOLOGIES.filter(
    t =>
      t.id !== 'agriculture' &&
      s.year >= t.earliestYear + (['steam_power', 'flight'].includes(t.id) ? 120 : 320),
  )) {
    if (!livingRealms.some(c => has(c, t.id))) {
      const candidates = livingRealms.filter(
        c => c.cityIds.length && c.technology >= Math.max(20, TECHNOLOGIES.indexOf(t) * 70),
      );
      if (candidates.length) {
        const host = [...candidates].sort((a, b) => b.technology - a.technology)[0];
        let scholar = s.people
          .filter(
            p => p.active && p.realmId === host.id && ['Scientist', 'Engineer'].includes(p.role),
          )
          .sort((a, b) => b.stars - a.stars)[0];
        if (!scholar) {
          scholar = createPerson(s, host, r, 'Scientist');
          scholar.stars = 3;
        }
        discover(s, host, t.id, scholar);
      }
    }
  }
  if (
    s.year > -1200 &&
    s.wonders.length < 18 &&
    livingRealms.length &&
    ((s.year + 1200) % 450 === 0 || r.chance(0.00035))
  ) {
    const hosts = livingRealms.filter(c => c.technology >= 100);
    if (hosts.length) {
      const host = r.pick(hosts);
      let patron = s.people
        .filter(p => p.active && p.realmId === host.id && p.stars === 5)
        .sort((a, b) => b.impact - a.impact)[0];
      if (!patron) {
        patron = createPerson(
          s,
          host,
          r,
          r.pick<PersonRole>([
            'Scientist',
            'Engineer',
            'Merchant',
            'General',
            'Artist',
            'Religious Figure',
            'Politician',
          ]),
        );
        patron.stars = 5;
      }
      createWonder(s, host, patron, r);
    }
  }
  for (const w of s.wars.filter(x => x.active)) if (r.chance(0.35)) battle(s, w, r);
  for (const cul of s.cultures) {
    cul.population = s.provinces
      .filter(p => p.cultureId === cul.id)
      .reduce((n, p) => n + p.population, 0);
    cul.provinces = s.provinces.filter(p => p.cultureId === cul.id).length;
    const eventCulture = s.realmEvents
      .filter(e => e.active && s.civilizations.find(c => c.id === e.realmId)?.cultureId === cul.id)
      .reduce((n, e) => n + e.effects.cultureAnnual * 2, 0);
    const originCont = s.continents.find(
      ct =>
        ct.id ===
        s.provinces[s.civilizations.find(c => c.id === cul.originRealmId)?.provinces[0] ?? -1]
          ?.continentId,
    );
    cul.strength = Math.min(
      100,
      Math.round(
        20 +
          cul.heritage.length * 3 +
          eventCulture +
          (cul.population /
            Math.max(
              1,
              s.civilizations.reduce((n, c) => n + c.population, 0),
            )) *
            100 +
          (originCont?.cultureBonus ?? 0) * 30,
      ),
    );
  }
  for (const rel of s.religions) {
    rel.followers = provinceReligionFollowers(s, rel.id);
    rel.provinces = s.provinces.filter(p => p.religionId === rel.id).length;
  }
  ensureModernGlobalContact(s);
  if (s.year % 100 === 0) captureEvolutionSnapshot(s);
  for (const civ of s.civilizations.filter(c => c.provinces.length)) {
    const counts = new Map<number, number>();
    for (const id of civ.provinces) {
      const rid = s.provinces[id].religionId;
      if (rid) counts.set(rid, (counts.get(rid) ?? 0) + s.provinces[id].population);
    }
    const majority = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (majority && majority[1] >= civ.population * 0.3) civ.faithId = majority[0];
  }
}

export function advanceWorld(w: WorldState, years: number) {
  const s = structuredClone(w),
    r = new RNG((s.seed + s.year * 31 + years * 911) >>> 0);
  for (let i = 0; i < years; i++) {
    simulateYear(s, r);
    for (const c of s.civilizations) {
      if (
        !Number.isFinite(c.population) ||
        !Number.isFinite(c.gdp) ||
        !Number.isFinite(c.technology) ||
        !Number.isFinite(c.armySize) ||
        !Number.isFinite(c.armyCapacity)
      ) {
        c.population = Math.max(0, Number.isFinite(c.population) ? c.population : 0);
        c.gdp = Math.max(0.1, Number.isFinite(c.gdp) ? c.gdp : 0.1);
        c.technology = Math.max(
          0,
          Math.min(1000, Number.isFinite(c.technology) ? c.technology : 0),
        );
        c.armyCapacity = Math.max(0, Number.isFinite(c.armyCapacity) ? c.armyCapacity : 0);
        c.armySize = Math.max(
          0,
          Math.min(c.armyCapacity, Number.isFinite(c.armySize) ? c.armySize : 0),
        );
      }
    }
  }
  return s;
}

/** Headless reference run used by npm run sim. */
export function runBalanceTest(seed = 424242, years = 5000, mapSize: MapSize = 'medium') {
  let world = createWorld(
    { name: 'Balance Test', mapSize, mapVariant: 1, tribeCount: 36, nameMode: 'mixed' },
    seed,
  );
  world = advanceWorld(world, years);
  return { world, metrics: summarize(world) };
}
