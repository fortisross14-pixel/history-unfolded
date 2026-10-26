import type { TechnologyId, GreatPerson, Civilization, WorldState } from '../types.ts';
import { TECHNOLOGIES } from './data.ts';
import { has } from './util.ts';
import { addEvent } from './events.ts';

export function discover(s: WorldState, c: Civilization, id: TechnologyId, p?: GreatPerson) {
  if (has(c, id)) return;
  const t = TECHNOLOGIES.find(x => x.id === id)!;
  c.knownTechnologies.push({
    technologyId: id,
    discoveredYear: s.year,
    source: p ? 'scientist' : 'founding',
    sourcePersonId: p?.id,
  });
  c.technology = Math.min(1000, c.technology + (p ? 32 : 18));
  if (p) {
    p.technologiesRevealed.push(id);
    p.technologyPoints += 35;
    p.achievement = `Revealed ${t.name}`;
  }
  addEvent(
    s,
    'technology',
    `${t.name} discovered`,
    `${c.name}${p ? ` under ${p.name}` : ''} discovered ${t.name}: ${t.effect}.`,
    10,
    [c.id],
    {
      personIds: p ? [p.id] : [],
      technologyIds: [id],
      tags: ['critical technology', t.name],
      worldChronicle: true,
    },
  );
}
