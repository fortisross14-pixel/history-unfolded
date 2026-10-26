import type {
  EventCategory,
  RealmEventType,
  EventSeverity,
  City,
  Culture,
  RealmEvent,
  Civilization,
  WorldState,
} from '../types.ts';
import { RNG } from './rng.ts';
import { EVENT_SEVERITY_MULTIPLIER, EVENT_DEFINITIONS } from './data.ts';
import { signedPct } from './util.ts';

export function addEvent(
  s: WorldState,
  category: EventCategory,
  title: string,
  description: string,
  importance: number,
  civIds: number[] = [],
  extra: Partial<WorldState['events'][number]> = {},
) {
  const e = {
    id: s.nextIds.event++,
    year: s.year,
    category,
    title,
    description,
    importance,
    civIds,
    personIds: [],
    cityIds: [],
    continentIds: [],
    technologyIds: [],
    warIds: [],
    battleIds: [],
    religionIds: [],
    cultureIds: [],
    wonderIds: [],
    dynastyIds: [],
    tags: [category],
    worldChronicle: false,
    ...extra,
  };
  s.events.unshift(e);
  for (const id of civIds) {
    const c = s.civilizations.find(x => x.id === id);
    if (c) c.historyEventIds.push(e.id);
  }
  s.events = s.events.slice(0, 1800);
}

export function realmEventEffectText(e: RealmEvent) {
  const a: string[] = [];
  if (e.effects.populationAnnualPct)
    a.push(`Population ${signedPct(e.effects.populationAnnualPct)} per year`);
  if (e.effects.gdpAnnualPct) a.push(`GDP ${signedPct(e.effects.gdpAnnualPct)} per year`);
  if (e.effects.technologyAnnual)
    a.push(`Technology +${e.effects.technologyAnnual.toFixed(1)} per year`);
  if (e.effects.armyAnnualPct)
    a.push(`Army ${signedPct(e.effects.armyAnnualPct)} of capacity per year`);
  if (e.effects.stabilityAnnual)
    a.push(
      `Stability ${e.effects.stabilityAnnual >= 0 ? '+' : ''}${e.effects.stabilityAnnual.toFixed(1)} per year`,
    );
  if (e.effects.cultureAnnual)
    a.push(`Culture strength +${e.effects.cultureAnnual.toFixed(1)} per year`);
  return a.join(' · ');
}

export function eventSeverity(r: RNG): EventSeverity {
  const q = r.next();
  return q < 0.13 ? 'Historical' : q < 0.39 ? 'Large' : 'Mild';
}

export function startRealmEvent(
  s: WorldState,
  c: Civilization,
  culture: WorldState['cultures'][number],
  r: RNG,
) {
  if (s.realmEvents.some(e => e.realmId === c.id && e.active)) return;
  const roll = r.next();
  const severity: EventSeverity =
    roll < 1 / 600
      ? 'Historical'
      : roll < 1 / 600 + 1 / 300
        ? 'Large'
        : roll < 1 / 600 + 1 / 300 + 1 / 120
          ? 'Mild'
          : (null as never);
  if (!severity) return;
  const negative: RealmEventType[] = ['Famine', 'Flooding', 'Pandemic'];
  if (c.provinces.some(id => s.provinces[id].terrain === 'mountain'))
    negative.push('Volcanic Eruption');
  const positive: RealmEventType[] = [
    'Baby Boom',
    'National Sentiment',
    'Cultural Golden Age',
    'Commercial Renaissance',
    'Scientific Awakening',
  ];
  let pool = r.chance(0.52) ? negative : positive;
  if (c.cityIds.length === 0)
    pool = pool.filter(
      x => !['Cultural Golden Age', 'Commercial Renaissance', 'Scientific Awakening'].includes(x),
    );
  if (!pool.length) return;
  const type = r.pick(pool),
    def = EVENT_DEFINITIONS[type],
    mult = EVENT_SEVERITY_MULTIPLIER[severity];
  const duration = Math.max(
    1,
    Math.round(
      r.int(def.duration[0], def.duration[1]) *
        (severity === 'Historical' ? 1.25 : severity === 'Large' ? 1.1 : 1),
    ),
  );
  const effects = {
    populationAnnualPct: def.effects.populationAnnualPct * mult,
    gdpAnnualPct: def.effects.gdpAnnualPct * mult,
    technologyAnnual: def.effects.technologyAnnual * mult,
    armyAnnualPct: def.effects.armyAnnualPct * mult,
    stabilityAnnual: def.effects.stabilityAnnual * mult,
    cultureAnnual: def.effects.cultureAnnual * mult,
  };
  const destroyedBuildings: string[] = [];
  if (['Volcanic Eruption', 'Flooding'].includes(type) && severity !== 'Mild') {
    const cities = c.cityIds
      .map(id => s.cities.find(x => x.id === id))
      .filter((x): x is City => !!x && x.buildings.length > 0);
    const count =
      severity === 'Historical'
        ? Math.min(
            3,
            cities.reduce((n, x) => n + x.buildings.length, 0),
          )
        : 1;
    for (let i = 0; i < count && cities.length; i++) {
      const city = r.pick(cities.filter(x => x.buildings.length));
      if (!city) break;
      const b = r.pick(city.buildings);
      destroyedBuildings.push(`${b.name} (${b.rarity})`);
      city.buildings = city.buildings.filter(x => x.id !== b.id);
    }
  }
  if (type === 'Cultural Golden Age')
    culture.heritage.push(`${severity} Golden Age of ${c.name} (${s.year})`);
  const event: RealmEvent = {
    id: s.nextIds.realmEvent++,
    realmId: c.id,
    type,
    severity,
    startYear: s.year,
    endYear: s.year + duration - 1,
    duration,
    title: `${severity} ${type}`,
    description: def.description,
    effects,
    destroyedBuildings,
    active: true,
  };
  s.realmEvents.push(event);
  const destruction = destroyedBuildings.length
    ? ` Buildings lost: ${destroyedBuildings.join(', ')}.`
    : '';
  addEvent(
    s,
    type === 'Cultural Golden Age'
      ? 'culture'
      : type === 'Commercial Renaissance'
        ? 'economy'
        : type === 'Scientific Awakening'
          ? 'technology'
          : type === 'National Sentiment'
            ? 'military'
            : 'society',
    event.title,
    `${def.description} Effect: ${realmEventEffectText(event)} for ${duration} years.${destruction}`,
    severity === 'Historical' ? 10 : severity === 'Large' ? 7 : 5,
    [c.id],
    { tags: ['realm event', type, severity], worldChronicle: severity === 'Historical' },
  );
}

export function processRealmEvents(
  s: WorldState,
  c: Civilization,
  culture: WorldState['cultures'][number],
  r: RNG,
) {
  for (const e of s.realmEvents.filter(x => x.realmId === c.id && x.active)) {
    if (s.year > e.endYear) {
      e.active = false;
      addEvent(
        s,
        'society',
        `${e.title} ends`,
        `${e.type} ended in ${c.name} after ${e.duration} years.`,
        4,
        [c.id],
        { tags: ['realm event ended', e.type, e.severity] },
      );
      continue;
    }
    c.population = Math.max(20, Math.round(c.population * (1 + e.effects.populationAnnualPct)));
    c.gdp = Math.max(0.1, c.gdp * (1 + e.effects.gdpAnnualPct));
    c.technology = Math.max(0, Math.min(1000, c.technology + e.effects.technologyAnnual));
    if (e.effects.armyAnnualPct > 0)
      c.armySize = Math.min(
        c.armyCapacity,
        Math.round(c.armySize + c.armyCapacity * e.effects.armyAnnualPct),
      );
    else if (e.effects.armyAnnualPct < 0)
      c.armySize = Math.max(0, Math.round(c.armySize * (1 + e.effects.armyAnnualPct)));
    c.stability = Math.max(5, Math.min(100, c.stability + e.effects.stabilityAnnual));
    culture.strength = Math.max(1, Math.min(100, culture.strength + e.effects.cultureAnnual));
  }
  startRealmEvent(s, c, culture, r);
  const justStarted = s.realmEvents.find(
    x => x.realmId === c.id && x.active && x.startYear === s.year,
  );
  if (justStarted) {
    c.population = Math.max(
      20,
      Math.round(c.population * (1 + justStarted.effects.populationAnnualPct)),
    );
    c.gdp = Math.max(0.1, c.gdp * (1 + justStarted.effects.gdpAnnualPct));
    c.technology = Math.max(0, Math.min(1000, c.technology + justStarted.effects.technologyAnnual));
    if (justStarted.effects.armyAnnualPct > 0)
      c.armySize = Math.min(
        c.armyCapacity,
        Math.round(c.armySize + c.armyCapacity * justStarted.effects.armyAnnualPct),
      );
    else if (justStarted.effects.armyAnnualPct < 0)
      c.armySize = Math.max(0, Math.round(c.armySize * (1 + justStarted.effects.armyAnnualPct)));
    c.stability = Math.max(5, Math.min(100, c.stability + justStarted.effects.stabilityAnnual));
    culture.strength = Math.max(
      1,
      Math.min(100, culture.strength + justStarted.effects.cultureAnnual),
    );
  }
}
