import type { WorldState } from '../types.ts';
import { rebuildIndex } from './lookup.ts';
import { rarityRank } from './traits.ts';

/** Dead characters forgotten after this many years unless history remembers them. */
const MEMORY_YEARS = 200;

/**
 * Keeps saves small: minor characters who died long ago are removed. Anyone
 * famous, rare, or referenced by a record (a religion, wonder, legacy, city,
 * continent, dynasty or the Hall of Fame) is kept. Reigns keep a copy of the
 * ruler's name, so reign history survives.
 */
export function pruneCharacters(s: WorldState) {
  const keep = new Set<number>();
  for (const c of s.civilizations) [c.rulerId, c.heirId, c.regentId].forEach(id => keep.add(id));
  for (const r of s.religions) if (r.founderId) keep.add(r.founderId);
  for (const w of s.wonders) keep.add(w.builderId);
  for (const l of s.legacies) keep.add(l.characterId);
  for (const c of s.cities) if (c.namedAfterId) keep.add(c.namedAfterId);
  for (const c of s.continents) if (c.discoveredByCharacterId) keep.add(c.discoveredByCharacterId);
  for (const d of s.dynasties) if (d.founderId) keep.add(d.founderId);
  for (const h of s.hallOfFame) if (h.category === 'character') keep.add(h.entityId);
  for (const id of Object.keys(s.overrides.character)) keep.add(Number(id));
  const before = s.characters.length;
  s.characters = s.characters.filter(
    ch =>
      ch.died === undefined ||
      s.year - ch.died < MEMORY_YEARS ||
      keep.has(ch.id) ||
      ch.fame >= 30 ||
      rarityRank(ch.rarity) >= 3,
  );
  if (s.characters.length !== before) rebuildIndex(s);
}
