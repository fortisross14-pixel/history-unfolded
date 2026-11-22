/**
 * Save slots in the browser. Each game (identified by its seed and start) keeps a ring of three
 * autosaves and one manual save; an index lists the games. Writes go to a new key first and
 * the index is updated last, so a failed write never destroys the previous save. Loading tries
 * the newest save of a game and falls back to older ones if it is damaged.
 */
import { deserialize, serialize, SaveError } from '../engine/game.ts';
import type { GameState } from '../engine/types.ts';

const INDEX = 'hu-saves-index-v2';
const LEGACY = 'history-unfolded-forge-save-v1';
const RING = 3;
const MAX_GAMES = 4;

export interface SaveEntry {
  key: string;
  turn: number;
  savedAt: number;
  manual: boolean;
}
export interface GameEntry {
  id: string;
  civ: string;
  mapType: string;
  turn: number;
  savedAt: number;
  saves: SaveEntry[];
}

const gameId = (s: GameState) =>
  `${s.settings.map.seed}-${s.settings.map.type}-${s.settings.map.size}`;

function readIndex(): GameEntry[] {
  try {
    const raw = localStorage.getItem(INDEX);
    return raw ? (JSON.parse(raw) as GameEntry[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(games: GameEntry[]) {
  localStorage.setItem(INDEX, JSON.stringify(games));
}

export type SaveResult = { ok: true } | { ok: false; reason: string };

export function saveGame(s: GameState, manual = false): SaveResult {
  try {
    const id = gameId(s);
    const games = readIndex();
    let g = games.find(x => x.id === id);
    if (!g) {
      g = {
        id,
        civ: s.civs.find(c => c.isPlayer)!.name,
        mapType: s.map.type,
        turn: s.turn,
        savedAt: 0,
        saves: [],
      };
      games.push(g);
    }
    const key = manual ? `hu-save-${id}-manual` : `hu-save-${id}-auto-${s.turn % RING}`;
    localStorage.setItem(key, serialize(s));
    g.saves = [
      ...g.saves.filter(x => x.key !== key),
      { key, turn: s.turn, savedAt: Date.now(), manual },
    ];
    g.turn = s.turn;
    g.savedAt = Date.now();
    g.civ = s.civs.find(c => c.isPlayer)!.name;
    // keep a few games; the oldest one goes
    games.sort((a, b) => b.savedAt - a.savedAt);
    for (const old of games.splice(MAX_GAMES))
      for (const e of old.saves) localStorage.removeItem(e.key);
    writeIndex(games);
    return { ok: true };
  } catch (e) {
    const full = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
    return { ok: false, reason: full ? 'browser storage is full' : 'browser storage is blocked' };
  }
}

export interface LoadResult {
  state: GameState | null;
  warning?: string;
}

/** Load a game's newest save, falling back to older ones if it is damaged. */
export function loadGame(id?: string): LoadResult {
  migrateLegacy();
  const games = readIndex().sort((a, b) => b.savedAt - a.savedAt);
  const g = id ? games.find(x => x.id === id) : games[0];
  if (!g) return { state: null };
  let warning: string | undefined;
  for (const e of [...g.saves].sort((a, b) => b.savedAt - a.savedAt)) {
    try {
      const raw = localStorage.getItem(e.key);
      if (!raw) continue;
      const state = deserialize(raw);
      return { state, warning };
    } catch (err) {
      warning = `The save from turn ${e.turn} could not be loaded (${err instanceof SaveError ? err.message : 'damaged'}); using an older one.`;
    }
  }
  return { state: null, warning: warning ?? 'No loadable save was found.' };
}

export function listGames(): GameEntry[] {
  migrateLegacy();
  return readIndex().sort((a, b) => b.savedAt - a.savedAt);
}

export function hasSave(): boolean {
  return listGames().length > 0;
}

export function deleteGame(id: string) {
  const games = readIndex();
  const g = games.find(x => x.id === id);
  if (!g) return;
  for (const e of g.saves) localStorage.removeItem(e.key);
  writeIndex(games.filter(x => x !== g));
}

/** One-time move of the single save slot used before slots existed. */
function migrateLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY);
    if (!raw) return;
    localStorage.removeItem(LEGACY);
    const s = deserialize(raw);
    saveGame(s);
  } catch {
    /* an old save from an earlier build: nothing to keep */
  }
}
