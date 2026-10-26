import type { WorldState } from '../types.ts';

/**
 * Save schema version. Bump it whenever WorldState changes shape and add a
 * migration below that upgrades a world from the previous version.
 */
export const SAVE_VERSION = 1;

type Migration = (world: any) => any;

/** migrations[n] upgrades a world from version n to version n + 1. */
const migrations: Record<number, Migration> = {};

/**
 * Brings a stored world up to SAVE_VERSION. Returns null when the save is
 * older than the first versioned format (those cannot be upgraded).
 */
export function migrateWorld(raw: any): WorldState | null {
  if (!raw || typeof raw !== 'object') return null;
  let world = raw;
  let version: number = typeof world.version === 'number' ? world.version : 0;
  if (version < 1) return null;
  while (version < SAVE_VERSION) {
    const step = migrations[version];
    if (!step) return null;
    world = step(world);
    version++;
    world.version = version;
  }
  return world as WorldState;
}
