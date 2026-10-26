import type { Civilization, WorldState } from '../types.ts';
import { idx } from './lookup.ts';
import { fullName } from './characters.ts';

/** Military record: wars won and lost (Great Wars count double) plus armed forces. */
export function militaryScore(s: WorldState, c: Civilization) {
  const wars = s.wars.filter(
    w => w.type !== 'Civil War' && w.participantIds.includes(c.id) && !w.active,
  );
  let score = 0;
  for (const w of wars) {
    const weight = w.great ? 90 : 45;
    if (w.winnerIds.includes(c.id)) score += weight;
    else if (w.loserIds.includes(c.id)) score -= weight;
  }
  return Math.round(score + Math.log10(Math.max(10, c.armySize + c.navy)) * 12);
}

export function addHallEntry(s: WorldState, entry: Omit<WorldState['hallOfFame'][number], 'id'>) {
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

/** Once a century: the dominant realm and city, the most famous people, the costliest wars. */
export function updateHallOfFame(s: WorldState) {
  const living = s.civilizations.filter(c => c.provinces.length).sort((a, b) => b.power - a.power);
  const eraKey = `${Math.floor(s.year / 250) * 250}`;
  const [top, second] = living;
  if (top && (!second || top.power >= second.power * 1.12))
    addHallEntry(s, {
      category: 'realm',
      entityId: top.id,
      name: top.name,
      year: s.year,
      score: top.power,
      subtitle: `Dominant power · ${(top.power / 10).toFixed(1)}% of the world · ${top.provinces.length} provinces`,
      periodKey: `realm-${top.id}-${eraKey}`,
    });
  const cities = [...s.cities].filter(c => c.wealth > 0).sort((a, b) => b.wealth - a.wealth);
  const [richest, runnerUp] = cities;
  if (richest && (!runnerUp || richest.wealth >= runnerUp.wealth * 1.12))
    addHallEntry(s, {
      category: 'city',
      entityId: richest.id,
      name: richest.name,
      year: s.year,
      score: Math.round(richest.wealth),
      subtitle: `The world's richest city · wealth ${Math.round(richest.wealth)}`,
      periodKey: `city-${richest.id}-${eraKey}`,
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
  for (const w of s.wars.filter(x => x.great && !x.active && (x.endYear ?? 0) > s.year - 100))
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

/** Century snapshot of every living realm, for the evolution charts and records. */
export function captureEvolutionSnapshot(s: WorldState) {
  const living = s.civilizations.filter(c => c.provinces.length);
  const realms = living.map(c => ({
    realmId: c.id,
    name: c.name,
    color: c.color,
    rank: c.rank,
    continentId: s.provinces[c.provinces[0]]?.continentId ?? 0,
    greatPower: c.power,
    development: c.development,
    wealth: Math.round(c.wealth),
    breakthroughs: c.breakthroughs.length,
    military: militaryScore(s, c),
  }));
  s.evolutionSnapshots.push({
    year: s.year,
    realms,
    worldDevelopment: living.reduce((n, c) => n + c.development, 0),
    worldWealth: Math.round(living.reduce((n, c) => n + c.wealth, 0)),
  });
  // Keep all fifty centuries of a full run.
  if (s.evolutionSnapshots.length > 60) s.evolutionSnapshots = s.evolutionSnapshots.slice(-60);
  updateHallOfFame(s);
}
