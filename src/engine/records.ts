import type { War, Civilization, WorldState } from '../types.ts';
import { idx } from './lookup.ts';
import { fullName } from './characters.ts';

/** Legacy score: everything a realm has achieved so far. It only grows. */
export function historicalScore(s: WorldState, c: Civilization) {
  const x = idx(s).legacy.get(c.id) ?? { arts: 0, wonders: 0, wins: 0, cities: 0, faiths: 0 };
  const tech = c.knownTechnologies.length * 18;
  const wonders = x.wonders * 30;
  const wars = x.wins * 12;
  const arts = x.arts;
  const legacy = x.cities * 5 + x.faiths * 35;
  return Math.round(
    c.prestige +
      c.provinces.length * 2 +
      Math.log10(Math.max(10, c.population)) * 10 +
      tech +
      wonders +
      wars +
      arts +
      legacy,
  );
}

export function militaryEvolutionScore(s: WorldState, c: Civilization) {
  const wars = s.wars.filter(
    w => w.type !== 'Civil War' && w.participantIds.includes(c.id) && !w.active,
  );
  const wins = wars.filter(w => w.winnerIds.includes(c.id)).length,
    losses = wars.filter(w => w.loserIds.includes(c.id)).length;
  // Great Wars count double: they are the wars history remembers.
  const greatWins = wars.filter(w => w.great && w.winnerIds.includes(c.id)).length;
  const greatLosses = wars.filter(w => w.great && w.loserIds.includes(c.id)).length;
  return Math.round(
    (wins - losses) * 45 +
      (greatWins - greatLosses) * 45 +
      Math.log10(Math.max(10, c.armySize + c.navy)) * 12,
  );
}

export function addHallEntry(s: WorldState, entry: Omit<WorldState['hallOfFame'][number], 'id'>) {
  s.hallOfFame ??= [];
  const same = s.hallOfFame.find(
    e =>
      e.category === entry.category &&
      e.entityId === entry.entityId &&
      e.periodKey === entry.periodKey,
  );
  if (same) {
    if (entry.score > same.score) Object.assign(same, entry);
    return;
  }
  s.hallOfFame.push({ id: s.nextIds.hallOfFame++, ...entry });
  s.hallOfFame = s.hallOfFame.sort((a, b) => b.score - a.score).slice(0, 100);
}

export function updateHallOfFame(s: WorldState) {
  const living = s.civilizations
      .filter(c => c.provinces.length)
      .sort((a, b) => b.historicalScore - a.historicalScore),
    eraKey = `${Math.floor(s.year / 250) * 250}`;
  if (living[0] && (!living[1] || living[0].historicalScore >= living[1].historicalScore * 1.12))
    addHallEntry(s, {
      category: 'realm',
      entityId: living[0].id,
      name: living[0].name,
      year: s.year,
      score: living[0].historicalScore,
      subtitle: `Dominant realm · ${living[0].rank} · ${living[0].provinces.length} provinces`,
      periodKey: `realm-${living[0].id}-${eraKey}`,
    });
  const cities = [...s.cities].sort((a, b) => b.population - a.population);
  if (cities[0] && (!cities[1] || cities[0].population >= cities[1].population * 1.12))
    addHallEntry(s, {
      category: 'city',
      entityId: cities[0].id,
      name: cities[0].name,
      year: s.year,
      score: cities[0].population,
      subtitle: `World's leading city · ${cities[0].population.toLocaleString()} people`,
      periodKey: `city-${cities[0].id}-${eraKey}`,
    });
  const famous = s.characters
    .filter(ch => ch.fame >= 30)
    .sort((a, b) => b.fame - a.fame)
    .slice(0, 5);
  for (const ch of famous)
    addHallEntry(s, {
      category: 'character',
      entityId: ch.id,
      name: fullName(ch),
      year: s.year,
      score: ch.fame,
      subtitle: `${ch.rarity} ${ch.role.toLowerCase()} of ${idx(s).civ.get(ch.realmId)?.name ?? 'a lost realm'}`,
      periodKey: `character-${ch.id}`,
    });
  // The costliest Great Wars.
  for (const w of s.wars.filter(x => x.great && !x.active && x.endYear === s.year))
    addHallEntry(s, {
      category: 'war',
      entityId: w.id,
      name: w.name,
      year: w.startYear,
      score: Math.round(
        (w.attackerLosses + w.defenderLosses) / 1000 +
          w.keyBattles.length * 5 +
          w.territoriesChanged * 3,
      ),
      subtitle: `${(w.attackerLosses + w.defenderLosses).toLocaleString()} fallen · ${w.keyBattles.length} key battles · ${w.territoriesChanged} provinces changed hands`,
      periodKey: `war-${w.id}`,
    });
}

export function captureEvolutionSnapshot(s: WorldState) {
  const living = s.civilizations.filter(c => c.provinces.length);
  const realms = living.map(c => ({
    realmId: c.id,
    name: c.name,
    color: c.color,
    rank: c.rank,
    continentId: s.provinces[c.provinces[0]]?.continentId ?? 0,
    greatPower: c.power,
    population: c.population,
    gdp: c.gdp,
    technology: c.technology,
    military: militaryEvolutionScore(s, c),
  }));
  s.evolutionSnapshots ??= [];
  s.evolutionSnapshots.push({
    year: s.year,
    realms,
    worldPopulation: living.reduce((n, c) => n + c.population, 0),
    worldGDP: living.reduce((n, c) => n + c.gdp, 0),
    averageTechnology: living.length
      ? living.reduce((n, c) => n + c.technology, 0) / living.length
      : 0,
  });
  if (s.evolutionSnapshots.length > 80) s.evolutionSnapshots = s.evolutionSnapshots.slice(-80);
  updateHallOfFame(s);
}
