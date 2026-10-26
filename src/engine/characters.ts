import type {
  PersonRole,
  GreatPerson,
  Dynasty,
  RulerRecord,
  Civilization,
  WorldState,
} from '../types.ts';
import { REAL_DYNASTIES, DYNASTY_NAMES, RULER_FIRST_NAMES } from './data.ts';
import { chooseDatabase, dynastySurname, uniqueName, numberedRulerName } from './naming.ts';
import { RNG } from './rng.ts';
import { has } from './util.ts';
import { addEvent } from './events.ts';

export const techCareerShare = (stars: number) => [0, 0.5, 0.8, 1.0, 1.2, 1.5][stars] ?? 0.5;

export function stars(r: RNG): 1 | 2 | 3 | 4 | 5 {
  const q = r.next();
  return q < 0.32 ? 1 : q < 0.63 ? 2 : q < 0.87 ? 3 : q < 0.98 ? 4 : 5;
}

export function createDynasty(s: WorldState, c: Civilization, r: RNG) {
  const used = new Set(s.dynasties.map(d => dynastySurname(d)));
  const pool = chooseDatabase(s.config.nameMode, r) ? REAL_DYNASTIES : DYNASTY_NAMES;
  const available = pool.filter(n => !used.has(n));
  const surname = available.length
    ? r.pick(available)
    : `${c.originTribe}${r.pick(['id', 'ian', 'ar', 'os'])}`;
  const d: Dynasty = {
    id: s.nextIds.dynasty++,
    name: `${surname} Dynasty`,
    founderPersonId: null,
    foundedYear: s.year,
    originCultureId: c.cultureId,
    originRealmId: c.id,
    rulerIds: [],
    realmIds: [c.id],
    totalYearsInPower: 0,
    peakTerritory: c.provinces.length,
    peakGDP: c.gdp,
    peakPopulation: c.population,
    warsWon: 0,
    wonderIds: [],
    status: 'ruling',
    historicalRelevance: 1,
  };
  s.dynasties.push(d);
  c.dynastyId = d.id;
  return d;
}

export function createRuler(s: WorldState, c: Civilization, r: RNG, reason = 'succession') {
  const previous = s.rulers.find(x => x.id === c.rulerId);
  if (previous && !previous.reignEnd) {
    previous.reignEnd = s.year;
    previous.endProvinces = c.provinces.length;
    previous.endTechnology = c.technology;
    previous.endGDP = c.gdp;
    previous.endPopulation = c.population;
    previous.historicalRelevance = Math.min(
      100,
      Math.round(
        20 +
          Math.max(0, c.provinces.length - previous.startProvinces) * 3 +
          Math.max(0, c.technology - previous.startTechnology) / 5 +
          Math.max(0, (c.gdp / Math.max(0.1, previous.startGDP) - 1) * 30),
      ),
    );
  }
  let d = s.dynasties.find(x => x.id === c.dynastyId);
  if (!d || !['ruling', 'restored'].includes(d.status)) d = createDynasty(s, c, r);
  const first = r.pick(RULER_FIRST_NAMES);
  const ruler: RulerRecord = {
    id: s.nextIds.ruler++,
    name: numberedRulerName(s, first, d.id, dynastySurname(d)),
    realmId: c.id,
    dynastyId: d.id,
    born: s.year - r.int(20, 44),
    reignStart: s.year,
    plannedReignEnd: s.year + Math.max(2, Math.round(22 + r.int(-22, 34) + r.next() * 16)),
    government: c.government,
    administration: r.int(20, 95),
    military: r.int(20, 95),
    diplomacy: r.int(20, 95),
    trait: r.pick(['Builder', 'Conqueror', 'Reformer', 'Diplomat', 'Traditionalist', 'Visionary']),
    startProvinces: c.provinces.length,
    startTechnology: c.technology,
    startGDP: c.gdp,
    startPopulation: c.population,
    historicalRelevance: 1,
  };
  s.rulers.push(ruler);
  c.rulerId = ruler.id;
  d.rulerIds.push(ruler.id);
  addEvent(
    s,
    'politics',
    `${ruler.name} takes power`,
    `${ruler.name} of the ${d.name} begins ruling ${c.name} after ${reason}. Administration ${ruler.administration}, military ${ruler.military}, diplomacy ${ruler.diplomacy}.`,
    6,
    [c.id],
    { dynastyIds: [d.id], tags: ['ruler', 'succession'] },
  );
}

export function createPerson(s: WorldState, c: Civilization, r: RNG, forced?: PersonRole) {
  const role =
    forced ??
    r.pick<PersonRole>([
      'Scientist',
      'Engineer',
      'Merchant',
      'Religious Figure',
      'General',
      'Artist',
      'Politician',
    ]);
  const p: GreatPerson = {
    id: s.nextIds.person++,
    name: uniqueName(s, role, r),
    role,
    born: s.year - r.int(18, 35),
    realmId: c.id,
    cultureId: c.cultureId,
    religionId: c.faithId,
    stars: stars(r),
    active: true,
    impact: 0,
    historicalRelevance: 1,
    trait: r.pick([
      'Genius',
      'Ambitious',
      'Charismatic',
      'Disciplined',
      'Radical',
      'Patient',
      'Visionary',
    ]),
    achievement: 'Career beginning',
    technologyPoints: 0,
    technologiesRevealed: [],
    battlesWon: 0,
    battlesLost: 0,
    wealthCreated: 0,
    followersGained: 0,
    artworkIds: [],
    citiesImproved: [],
    buildingsCreated: [],
    tradeRoutesCreated: [],
    wonderIds: [],
    revolutionsLed: 0,
    armyAdded: 0,
    stabilityAdded: 0,
    careerMilestones: [],
    technologyContributionApplied: 0,
  };
  s.people.push(p);
  addEvent(
    s,
    'great-person',
    `${p.name} emerges`,
    `${c.name} has produced a ${'★'.repeat(p.stars)} ${p.role.toLowerCase()}.`,
    p.stars >= 4 ? 8 : 5,
    [c.id],
    { personIds: [p.id], cultureIds: [c.cultureId], tags: ['great person', p.role] },
  );
  return p;
}

export function generalFor(s: WorldState, c: Civilization) {
  return (
    s.people
      .filter(p => p.active && p.realmId === c.id && p.role === 'General')
      .sort((a, b) => b.stars - a.stars)[0] ?? null
  );
}
