import type { RenameKind, WorldState } from '../types.ts';

/**
 * Renames a realm, city, character, dynasty, continent or war by hand. The
 * name is stored as a player override, so later engine renames (a kingdom
 * becoming an empire, an explorer naming a continent) do not replace it.
 * Returns a new world; the original is not changed.
 */
export function renameEntity(world: WorldState, kind: RenameKind, id: number, name: string) {
  const clean = name.trim().slice(0, 60);
  if (!clean) return world;
  const s = structuredClone(world);
  const lists = {
    realm: s.civilizations,
    city: s.cities,
    character: s.characters,
    dynasty: s.dynasties,
    continent: s.continents,
    war: s.wars,
  } as const;
  const target = (lists[kind] as { id: number; name: string }[]).find(x => x.id === id);
  if (!target) return world;
  target.name = clean;
  s.overrides[kind][id] = clean;
  if (kind === 'realm') {
    const realm = s.civilizations.find(x => x.id === id)!;
    realm.successorIdentity = clean;
    realm.nameHistory.push({
      name: clean,
      rank: realm.rank,
      from: s.year,
      reason: 'Renamed by hand',
    });
  }
  if (kind === 'character') {
    // Keep reign records in step with the ruler's new name.
    for (const reign of s.reigns) if (reign.characterId === id) reign.name = clean;
  }
  return s;
}
