import type { WorldState } from '../types.ts';
import { displayYear } from './util.ts';

/** Collects numbers that are only visible while the run is in progress. */
export class RunTracker {
  generationalPeak = 0;
  generationalYears = 0;
  generationalSum = 0;
  years = 0;
  observe(s: WorldState) {
    let alive = 0;
    for (const ch of s.characters)
      if (ch.died === undefined && ch.rarity === 'Generational') alive++;
    this.generationalPeak = Math.max(this.generationalPeak, alive);
    this.generationalSum += alive;
    if (alive > 0) this.generationalYears++;
    this.years++;
  }
}

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
  generationalAverage: number;
  /** Share of years with at least one Generational character alive. */
  generationalShare: number;
  legacies: number;
  nicknames: number;
  reigns: number;
  religions: number;
  cities: number;
  relations: Record<string, number>;
  unions: number;
  /** Average of each national axis over living realms. */
  axes: Record<string, number>;
  /** Realms that sit far from the middle on at least one axis. */
  distinctRealms: number;
  centuries: CenturyLeaders[];
  longestLead: { name: string; years: number; from: number };
}

/** Key balance numbers for a finished (or in-progress) world. */
export function summarize(world: WorldState, tracker?: RunTracker): WorldMetrics {
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
    people: world.characters.length,
    livingPeople: world.characters.filter(p => p.died === undefined).length,
    generationalAlivePeak: tracker?.generationalPeak ?? 0,
    generationalAverage: tracker ? tracker.generationalSum / Math.max(1, tracker.years) : 0,
    generationalShare: tracker ? tracker.generationalYears / Math.max(1, tracker.years) : 0,
    legacies: world.legacies.length,
    nicknames: world.characters.filter(ch => ch.nickname).length,
    reigns: world.reigns.length,
    religions: world.religions.length,
    cities: world.cities.length,
    relations: world.relations.reduce<Record<string, number>>(
      (n, r) => ({ ...n, [r.type]: (n[r.type] ?? 0) + 1 }),
      {},
    ),
    unions: world.relations.filter(r => r.union).length,
    axes: Object.fromEntries(
      (['ambition', 'horizon', 'economy', 'faith', 'order'] as const).map(k => [
        k,
        Math.round(alive.reduce((n, c) => n + c.axes[k], 0) / Math.max(1, alive.length)),
      ]),
    ),
    distinctRealms: alive.filter(c => Object.values(c.axes).some(v => v < 30 || v > 70)).length,
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
    `Generational alive ....... peak ${m.generationalAlivePeak}, average ${m.generationalAverage.toFixed(1)}, present ${(m.generationalShare * 100).toFixed(0)}% of years`,
    `Reigns / legacies ........ ${m.reigns} / ${m.legacies}`,
    `Characters with nicknames  ${m.nicknames}`,
    `Religions / cities ....... ${m.religions} / ${m.cities}`,
    `Relations now ............ ${Object.entries(m.relations)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')} (personal unions ${m.unions})`,
    `Average axes ............. ${Object.entries(m.axes)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}`,
    `Realms with a strong trait ${m.distinctRealms}`,
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
