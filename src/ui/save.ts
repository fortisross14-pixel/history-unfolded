import { deserialize, serialize } from '../engine/game.ts';
import type { GameState } from '../engine/types.ts';

const KEY = 'history-unfolded-forge-save-v1';

export function saveGame(s: GameState) {
  try {
    localStorage.setItem(KEY, serialize(s));
  } catch {
    /* storage full or blocked: play on */
  }
}

export function loadGame(): GameState | null {
  try {
    const j = localStorage.getItem(KEY);
    return j ? deserialize(j) : null;
  } catch {
    return null;
  }
}

/** True only for a save this version can load (older saves are ignored). */
export function hasSave(): boolean {
  return loadGame() !== null;
}
