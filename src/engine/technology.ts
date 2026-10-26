import type { TechnologyId, Character, Civilization, WorldState } from '../types.ts';
import { TECHNOLOGIES } from './data.ts';
import { has } from './util.ts';
import { addEvent } from './events.ts';
import { addDeed, earnNickname, notifyAmbition } from './characters.ts';

export function discover(s: WorldState, c: Civilization, id: TechnologyId, ch?: Character) {
  if (has(c, id)) return;
  const t = TECHNOLOGIES.find(x => x.id === id)!;
  c.knownTechnologies.push({
    technologyId: id,
    discoveredYear: s.year,
    source: ch ? 'scholar' : 'founding',
    sourceCharacterId: ch?.id,
  });
  c.technology = Math.min(1000, c.technology + (ch ? 32 : 18));
  if (ch) {
    addDeed(s, ch, `Revealed ${t.name}`, 15);
    notifyAmbition(s, c.id, 'great-discovery', `revealed ${t.name}`, undefined, ch.id);
    earnNickname(s, ch);
  }
  addEvent(
    s,
    'technology',
    `${t.name} discovered`,
    `${c.name}${ch ? ` under ${ch.name}` : ''} discovered ${t.name}: ${t.effect}.`,
    10,
    [c.id],
    {
      personIds: ch ? [ch.id] : [],
      technologyIds: [id],
      tags: ['critical technology', t.name],
      worldChronicle: true,
    },
  );
}
