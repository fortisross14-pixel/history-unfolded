import type { WorldState, SaveSlot } from '../types.ts';
import { migrateWorld } from '../engine/save.ts';

// One stable key from now on. Schema changes are handled by migrateWorld().
export const STORAGE = 'history-unfolded-saves';

// Keys used by versions before save migration existed. They are removed once.
const LEGACY_KEY = /^history-unfolded-saves-v\d+$/;

const emptySlots = (): SaveSlot[] => [1, 2, 3].map(slot => ({ slot, updatedAt: 0, world: null }));

function dropLegacySaves() {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && LEGACY_KEY.test(key)) localStorage.removeItem(key);
  }
}

export function loadSlots(): SaveSlot[] {
  try {
    dropLegacySaves();
    const stored = JSON.parse(localStorage.getItem(STORAGE) || '[]') as SaveSlot[];
    return emptySlots().map(empty => {
      const found = stored.find(s => s.slot === empty.slot);
      if (!found?.world) return empty;
      const world = migrateWorld(found.world);
      return world ? { ...found, world } : empty;
    });
  } catch {
    return emptySlots();
  }
}

export function compactWorldForStorage(world: WorldState): WorldState {
  const copy = structuredClone(world);
  const retained = [
    ...copy.events.slice(0, 700),
    ...copy.events.filter(e => e.worldChronicle).slice(0, 300),
  ]
    .filter((e, i, a) => a.findIndex(x => x.id === e.id) === i)
    .sort((a, b) => b.year - a.year)
    .slice(0, 1000);
  const ids = new Set(retained.map(e => e.id));
  copy.events = retained;
  copy.civilizations.forEach(
    c => (c.historyEventIds = c.historyEventIds.filter(id => ids.has(id)).slice(-500)),
  );
  return copy;
}

export function persist(slots: SaveSlot[]) {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(slots));
  } catch (error) {
    try {
      const compact = slots.map(s =>
        s.world ? { ...s, world: compactWorldForStorage(s.world) } : s,
      );
      localStorage.setItem(STORAGE, JSON.stringify(compact));
    } catch (second) {
      console.error(
        'History Unfolded could not save this turn because browser storage is full.',
        second,
        error,
      );
    }
  }
}
