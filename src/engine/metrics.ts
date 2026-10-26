import type { WorldState } from '../types.ts';
import { displayYear } from './util.ts';

export interface CenturyLeaders {
  year: number;
  leaders: { name: string; score: number }[];
}

export interface WorldMetrics {
  year: number;
  livingRealms: number;
  population: number;
  wars: number;
  greatWars: number;
  battles: number;
  people: number;
  livingPeople: number;
  generationalAlivePeak: number;
  religions: number;
  cities: number;
  centuries: CenturyLeaders[];
  longestLead: { name: string; years: number; from: number };
}

/** Key balance numbers for a finished (or in-progress) world. */
export function summarize(world: WorldState): WorldMetrics {
  const alive = world.civilizations.filter(c => c.provinces.length);
  const snapshots = world.evolutionSnapshots ?? [];
  const centuries = snapshots.map(s => ({
    year: s.year,
    leaders: [...s.realms]
      .sort((a, b) => b.greatPower - a.greatPower)
      .slice(0, 3)
      .map(r => ({ name: r.name, score: Math.round(r.greatPower) })),
  }));

  // Longest unbroken run as the number-one power, by century snapshot.
  let longestLead = { name: '—', years: 0, from: world.year };
  let runId = -1;
  let runStart = 0;
  for (let i = 0; i < snapshots.length; i++) {
    const top = [...snapshots[i].realms].sort((a, b) => b.greatPower - a.greatPower)[0];
    if (!top) continue;
    if (top.realmId !== runId) {
      runId = top.realmId;
      runStart = snapshots[i].year;
    }
    const years = snapshots[i].year - runStart + 100;
    if (years > longestLead.years) longestLead = { name: top.name, years, from: runStart };
  }

  return {
    year: world.year,
    livingRealms: alive.length,
    population: alive.reduce((n, c) => n + c.population, 0),
    wars: world.wars.length,
    greatWars: 0,
    battles: world.battles.length,
    people: world.people.length,
    livingPeople: world.people.filter(p => p.active).length,
    generationalAlivePeak: 0,
    religions: world.religions.length,
    cities: world.cities.length,
    centuries,
    longestLead,
  };
}

export function formatMetrics(m: WorldMetrics, everyNthCentury = 5): string {
  const lines = [
    `Year ${displayYear(m.year)}`,
    `Living realms ............ ${m.livingRealms}`,
    `World population ......... ${m.population.toLocaleString('en-US')}`,
    `Wars / great wars ........ ${m.wars} / ${m.greatWars}`,
    `Stored battles ........... ${m.battles}`,
    `Characters (alive) ....... ${m.people} (${m.livingPeople})`,
    `Generational alive (peak)  ${m.generationalAlivePeak}`,
    `Religions / cities ....... ${m.religions} / ${m.cities}`,
    `Longest time on top ...... ${m.longestLead.name}: ${m.longestLead.years} years from ${displayYear(m.longestLead.from)}`,
    '',
    'Top powers by century:',
  ];
  m.centuries.forEach((c, i) => {
    if (i % everyNthCentury !== 0 && i !== m.centuries.length - 1) return;
    const names = c.leaders.map(l => `${l.name} (${l.score})`).join(', ');
    lines.push(`  ${displayYear(c.year).padEnd(9)} ${names}`);
  });
  return lines.join('\n');
}
