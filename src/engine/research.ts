import type { BreakthroughId, Character, Civilization, WorldState } from '../types.ts';
import { RNG } from './rng.ts';
import { addEvent } from './events.ts';
import { addDeed, createCharacter, earnNickname, notifyAmbition } from './characters.ts';
import { courtOf, idx } from './lookup.ts';
import { BREAKTHROUGHS, breakthroughDef, eraOf, knows, researchCost } from './eras.ts';
import { beginDiscovery } from './discovery.ts';

/** Gives a realm a breakthrough and updates its era. */
export function learn(
  s: WorldState,
  c: Civilization,
  id: BreakthroughId,
  source: 'invented' | 'spread' | 'founding',
  ch?: Character,
) {
  if (knows(c, id)) return;
  c.breakthroughs.push({ id, year: s.year, source, characterId: ch?.id });
  c.era = eraOf(c);
  worldKnown(s).add(id);
}

/** Every breakthrough some realm has made. */
export function worldKnown(s: WorldState) {
  const index = idx(s);
  index.worldKnown ??= new Set(
    s.civilizations.filter(x => x.provinces.length).flatMap(x => x.breakthroughs.map(b => b.id)),
  );
  return index.worldKnown;
}

/** Breakthroughs nobody in the world has yet, whose time has come, and that this realm is ready for. */
export function frontier(s: WorldState, c: Civilization) {
  const anyone = worldKnown(s);
  return BREAKTHROUGHS.filter(b => !anyone.has(b.id) && s.year >= b.earliest && b.era <= c.era + 1);
}

/**
 * Being first in the world. A realm's research builds up toward the next
 * breakthrough nobody has made; the first realm to finish makes it, its best
 * scholar takes the credit, and a Great Discovery begins.
 */
export function researchYear(s: WorldState, c: Civilization, rate: number, r: RNG) {
  const open = frontier(s, c);
  const next = open[0];
  if (!next) {
    // Nothing new to discover yet; research waits, up to one breakthrough's worth.
    c.research = Math.min(researchCost(c.era + 1), c.research + rate);
    return;
  }
  c.research += rate;
  if (c.research < researchCost(next.era)) return;
  c.research = 0;
  invent(s, c, r.pick(open).id, r);
}

/** A realm makes a breakthrough first. */
export function invent(s: WorldState, c: Civilization, id: BreakthroughId, r: RNG, by?: Character) {
  const def = breakthroughDef(id);
  const scholar =
    by ??
    courtOf(s, c.id)
      .filter(x => x.role === 'Scholar')
      .sort((a, b) => b.skill - a.skill)[0] ??
    createCharacter(s, r, { role: 'Scholar', realm: c, minRarity: 'Rare' });
  learn(s, c, id, 'invented', scholar);
  addDeed(s, scholar, `Revealed ${def.name}`, 15);
  notifyAmbition(s, c.id, 'great-discovery', `revealed ${def.name}`, undefined, scholar.id);
  earnNickname(s, scholar);
  addEvent(
    s,
    'technology',
    `${def.name} is discovered`,
    `${scholar.name} of ${c.name} achieved ${def.name}: ${def.effect}.`,
    10,
    [c.id],
    {
      personIds: [scholar.id],
      breakthroughIds: [id],
      tags: ['breakthrough', def.name],
      worldChronicle: true,
    },
  );
  beginDiscovery(s, c, id, scholar);
}

/**
 * History must move on: if a breakthrough is still undiscovered long after its
 * time, the realm with the most research makes it.
 */
export function overdueBreakthroughs(s: WorldState, r: RNG) {
  const living = s.civilizations.filter(c => c.provinces.length);
  if (!living.length) return;
  const anyone = worldKnown(s);
  for (const b of BREAKTHROUGHS) {
    if (anyone.has(b.id) || s.year < b.earliest + 300) continue;
    const ready = living
      .filter(c => c.era >= b.era - 1)
      .sort((x, y) => y.research + y.development - (x.research + x.development));
    if (ready[0]) invent(s, ready[0], b.id, r);
    return;
  }
}
