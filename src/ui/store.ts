/// <reference lib="dom" />
/**
 * Where saves live: IndexedDB, which holds far more than localStorage (whose few megabytes a
 * handful of saves used up, for every game on the same site). The rest of the game reads and
 * writes through a copy in memory, loaded once at start, so the save code stays synchronous;
 * each write is sent on to IndexedDB in order. Saves left in localStorage by earlier versions
 * move across on the first start and are then removed from it, freeing that space.
 * Without IndexedDB (a locked-down browser) it falls back to localStorage.
 */
const DB = 'history-unfolded';
const STORE = 'saves';
/** keys of the save data that used to sit in localStorage */
const OURS = (k: string) =>
  k.startsWith('hu-save-') || k === 'hu-saves-index-v2' || k === 'history-unfolded-forge-save-v1';

const mem = new Map<string, string>();
let db: IDBDatabase | null = null;
let ready = false;
/** the last write IndexedDB refused, reported by the next save */
let failed: string | null = null;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
}

function readAll(d: IDBDatabase): Promise<[string, string][]> {
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readonly');
    const os = tx.objectStore(STORE);
    const keys = os.getAllKeys();
    const vals = os.getAll();
    tx.oncomplete = () =>
      resolve((keys.result as IDBValidKey[]).map((k, i) => [String(k), vals.result[i] as string]));
    tx.onerror = () => reject(tx.error);
  });
}

function send(fn: (os: IDBObjectStore) => void) {
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    fn(tx.objectStore(STORE));
    const fail = () => {
      const e = tx.error;
      failed =
        e?.name === 'QuotaExceededError' ? 'browser storage is full' : 'the save was not written';
    };
    tx.onerror = fail;
    tx.onabort = fail;
  } catch {
    failed = 'the save was not written';
  }
}

/** Open the store and load it into memory; call (and wait for) once before the game starts. */
export async function initStore(): Promise<void> {
  if (ready) return;
  try {
    if (typeof indexedDB === 'undefined') throw new Error('no IndexedDB');
    db = await open();
    for (const [k, v] of await readAll(db)) mem.set(k, v);
    // move what earlier versions left in localStorage, then free it
    const old = Object.keys(localStorage).filter(OURS);
    if (old.length) {
      const moved: [string, string][] = [];
      for (const k of old) {
        const v = localStorage.getItem(k);
        if (v !== null && !mem.has(k)) moved.push([k, v]);
      }
      await new Promise<void>((resolve, reject) => {
        const tx = db!.transaction(STORE, 'readwrite');
        const os = tx.objectStore(STORE);
        for (const [k, v] of moved) os.put(v, k);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      for (const [k, v] of moved) mem.set(k, v);
      for (const k of old) localStorage.removeItem(k);
    }
  } catch {
    db = null;
  }
  ready = true;
}

/** Ask the browser not to clear the saves under storage pressure (granted silently or not). */
export function persistStore() {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* not offered here */
  }
}

/** The save storage, synchronous: IndexedDB through the copy in memory, else localStorage. */
export const store = {
  get(k: string): string | null {
    if (!db) return localStorage.getItem(k);
    return mem.get(k) ?? null;
  },
  set(k: string, v: string) {
    if (!db) return localStorage.setItem(k, v);
    mem.set(k, v);
    send(os => os.put(v, k));
  },
  remove(k: string) {
    if (!db) return localStorage.removeItem(k);
    mem.delete(k);
    send(os => os.delete(k));
  },
  keys(): string[] {
    return db ? [...mem.keys()] : Object.keys(localStorage);
  },
  /** a refused write since the last call, if any */
  takeFailure(): string | null {
    const f = failed;
    failed = null;
    return f;
  },
};
