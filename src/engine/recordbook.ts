import type { WorldState } from '../types.ts';
import { displayYear } from './util.ts';
import { fullName } from './characters.ts';

export interface WorldRecord {
  title: string;
  holder: string;
  value: string;
  detail: string;
  link?: { type: 'realm' | 'character' | 'war' | 'dynasty' | 'city'; id: number };
}

const best = <T>(list: T[], score: (x: T) => number) =>
  list.reduce<T | undefined>(
    (top, x) => (top === undefined || score(x) > score(top) ? x : top),
    undefined,
  );

/** The all-time records of a world, recomputed from its history. */
export function worldRecords(s: WorldState): WorldRecord[] {
  const out: WorldRecord[] = [];
  const name = (id: number) => s.civilizations.find(c => c.id === id)?.name ?? 'a lost realm';

  const reign = best(s.reigns, r => (r.end ?? s.year) - r.start);
  if (reign)
    out.push({
      title: 'Longest reign',
      holder: reign.name,
      value: `${(reign.end ?? s.year) - reign.start} years`,
      detail: `${name(reign.realmId)}, ${displayYear(reign.start)}–${reign.end !== undefined ? displayYear(reign.end) : 'today'}`,
      link: { type: 'character', id: reign.characterId },
    });

  const empire = best(s.civilizations, c => c.peakProvinces);
  if (empire)
    out.push({
      title: 'Largest empire',
      holder: empire.name,
      value: `${empire.peakProvinces} provinces`,
      detail: `at its height in ${displayYear(empire.peakYear)}`,
      link: { type: 'realm', id: empire.id },
    });

  const dynasty = best(s.dynasties, d => d.totalYearsInPower);
  if (dynasty)
    out.push({
      title: 'Oldest dynasty',
      holder: dynasty.name,
      value: `${dynasty.totalYearsInPower} years in power`,
      detail: `founded ${displayYear(dynasty.foundedYear)} · ${dynasty.status}`,
      link: { type: 'dynasty', id: dynasty.id },
    });

  const ended = s.wars.filter(w => !w.active && w.winnerIds.length);
  const decisive = best(
    ended,
    w => w.territoriesChanged * 2 + (w.decisiveVictory ? 10 : 0) + (w.great ? 10 : 0),
  );
  if (decisive)
    out.push({
      title: 'Most decisive war',
      holder: decisive.name,
      value: `${decisive.territoriesChanged} provinces changed hands`,
      detail: `${name(decisive.winnerIds[0])} won, ${displayYear(decisive.startYear)}`,
      link: { type: 'war', id: decisive.id },
    });

  const costly = best(s.wars, w => w.attackerLosses + w.defenderLosses);
  if (costly && costly !== decisive)
    out.push({
      title: 'Bloodiest war',
      holder: costly.name,
      value: `${(costly.attackerLosses + costly.defenderLosses).toLocaleString('en-US')} fallen`,
      detail: displayYear(costly.startYear),
      link: { type: 'war', id: costly.id },
    });

  const famous = best(s.characters, c => c.fame);
  if (famous)
    out.push({
      title: 'Most influential character',
      holder: fullName(famous),
      value: `${famous.fame} fame`,
      detail: `${famous.rarity} ${famous.role.toLowerCase()} of ${name(famous.realmId)}`,
      link: { type: 'character', id: famous.id },
    });

  const general = best(s.characters, c => c.battlesWon);
  if (general && general.battlesWon > 0)
    out.push({
      title: 'Most battles won',
      holder: fullName(general),
      value: `${general.battlesWon} victories`,
      detail: `${general.role} of ${name(general.realmId)}`,
      link: { type: 'character', id: general.id },
    });

  const elder = best(s.characters, c => (c.died ?? s.year) - c.born);
  if (elder)
    out.push({
      title: 'Longest life',
      holder: fullName(elder),
      value: `${(elder.died ?? s.year) - elder.born} years`,
      detail: `${displayYear(elder.born)}–${elder.died !== undefined ? displayYear(elder.died) : 'still alive'}`,
      link: { type: 'character', id: elder.id },
    });

  const founder = best(s.characters, c => c.legacyIds.length);
  if (founder && founder.legacyIds.length)
    out.push({
      title: 'Greatest legacy',
      holder: fullName(founder),
      value: `${founder.legacyIds.length} named ${founder.legacyIds.length === 1 ? 'legacy' : 'legacies'}`,
      detail: s.legacies
        .filter(l => founder.legacyIds.includes(l.id))
        .map(l => l.name)
        .join(', '),
      link: { type: 'character', id: founder.id },
    });

  const city = best(s.cities, c => c.wealth);
  if (city && city.wealth > 0)
    out.push({
      title: 'Richest city today',
      holder: city.name,
      value: `wealth ${Math.round(city.wealth)}`,
      detail: name(city.currentRealmId),
      link: { type: 'city', id: city.id },
    });

  const leader = best(
    s.evolutionSnapshots.flatMap(x => x.realms.map(r => ({ r, year: x.year }))),
    x => x.r.greatPower,
  );
  if (leader)
    out.push({
      title: 'Strongest power ever',
      holder: leader.r.name,
      value: `${(leader.r.greatPower / 10).toFixed(1)}% of world power`,
      detail: `in ${displayYear(leader.year)}`,
      link: { type: 'realm', id: leader.r.realmId },
    });
  return out;
}
