import type { War, Civilization, WorldState } from '../types.ts';
import { idx } from './lookup.ts';
import { fullName } from './characters.ts';

export function historicalScore(s: WorldState, c: Civilization) {
  const arts = s.artworks.filter(a => a.realmId === c.id).reduce((n, a) => n + a.rating / 10, 0);
  const tech = c.knownTechnologies.length * 18;
  const wonders = s.wonders.filter(w => w.realmId === c.id).length * 30;
  const wars = s.wars.filter(w => w.winnerIds.includes(c.id)).length * 12;
  const legacy =
    s.cities.filter(x => x.founderRealmId === c.id).length * 5 +
    s.religions.filter(x => x.founderId && idx(s).char.get(x.founderId)?.realmId === c.id).length *
      35;
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
  const battles = s.battles.filter(b => {
    const w = s.wars.find(x => x.id === b.warId);
    return (
      w?.type !== 'Civil War' &&
      (b.attacker.realmIds.includes(c.id) || b.defender.realmIds.includes(c.id))
    );
  });
  let battleWins = 0,
    battleLosses = 0,
    caused = 0,
    received = 0;
  for (const b of battles) {
    const atk = b.attacker.realmIds.includes(c.id),
      won = (atk && b.winner === 'attacker') || (!atk && b.winner === 'defender');
    if (won) battleWins++;
    else battleLosses++;
    caused += atk ? b.defender.casualties : b.attacker.casualties;
    received += atk ? b.attacker.casualties : b.defender.casualties;
  }
  const casualtyEdge = ((caused - received) / Math.max(100, caused + received)) * 35;
  return Math.round(
    (wins - losses) * 45 +
      (battleWins - battleLosses) * 8 +
      casualtyEdge +
      Math.log10(Math.max(10, c.armySize)) * 12,
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
  const battles = [...s.battles].sort(
    (a, b) =>
      b.significance +
      b.attacker.casualties +
      b.defender.casualties -
      (a.significance + a.attacker.casualties + a.defender.casualties),
  );
  if (battles[0])
    addHallEntry(s, {
      category: 'battle',
      entityId: battles[0].id,
      name: battles[0].name,
      year: battles[0].year,
      score:
        battles[0].significance +
        (battles[0].attacker.casualties + battles[0].defender.casualties) / 1000,
      subtitle: `${(battles[0].attacker.casualties + battles[0].defender.casualties).toLocaleString()} casualties · significance ${battles[0].significance}`,
      periodKey: `battle-${battles[0].id}`,
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
    greatPower: c.historicalScore,
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
