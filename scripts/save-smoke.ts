/**
 * Saves live in IndexedDB: a save lands there and not in localStorage, survives a reload, and
 * saves an earlier version left in localStorage move across on start and are removed from it.
 * Usage: npx vite preview --port 4173 &  node --no-warnings scripts/save-smoke.ts
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const URL = process.argv[2] ?? 'http://localhost:4173/';
let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};
type W = {
  localStorage: { clear(): void; setItem(k: string, v: string): void; [k: string]: unknown };
  indexedDB: any;
  document: any;
};
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errors: string[] = [];
page.on('pageerror', (e: Error) => errors.push(e.message));

/** every key and value in the saves store */
const idb = () =>
  page.evaluate(
    () =>
      new Promise<Record<string, string>>(resolve => {
        const w = globalThis as unknown as W;
        const req = w.indexedDB.open('history-unfolded', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('saves');
        req.onsuccess = () => {
          const tx = req.result.transaction('saves', 'readonly');
          const os = tx.objectStore('saves');
          const k = os.getAllKeys(),
            v = os.getAll();
          tx.oncomplete = () => {
            const out: Record<string, string> = {};
            k.result.forEach((key: string, i: number) => (out[key] = v.result[i]));
            req.result.close();
            resolve(out);
          };
        };
      }),
  );
const lsKeys = () =>
  page.evaluate(() =>
    Object.keys((globalThis as unknown as W).localStorage).filter(
      k => k.startsWith('hu-save') || k === 'hu-saves-index-v2',
    ),
  );
const clearAll = () =>
  page.evaluate(
    () =>
      new Promise<void>(resolve => {
        const w = globalThis as unknown as W;
        w.localStorage.clear();
        const r = w.indexedDB.deleteDatabase('history-unfolded');
        r.onsuccess = r.onerror = r.onblocked = () => resolve();
      }),
  );

await page.goto(URL);
await clearAll();
await page.reload();
await page.click('button:has-text("Begin")');
await page.waitForTimeout(500);
// end a turn: the autosave writes it
for (let i = 0; i < 3; i++) {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
}
await page.waitForTimeout(500);
const stored = await idb();
const keys = Object.keys(stored);
check(
  keys.some(k => k.startsWith('hu-save-')),
  `a save is in IndexedDB (${keys.length} keys)`,
);
check(keys.includes('hu-saves-index-v2'), 'the save index is in IndexedDB');
check((await lsKeys()).length === 0, 'nothing of the save is in localStorage');

// it survives a reload: the menu offers to continue
await page.reload();
await page.waitForTimeout(600);
const cont = await page.$('button:has-text("Continue")');
check(!!cont, 'after a reload the menu offers to continue');

// an old version's saves in localStorage move across and are removed from it
await clearAll();
await page.evaluate((data: Record<string, string>) => {
  const w = globalThis as unknown as W;
  for (const [k, v] of Object.entries(data)) w.localStorage.setItem(k, v);
}, stored);
await page.reload();
await page.waitForTimeout(600);
check((await lsKeys()).length === 0, 'old saves were removed from localStorage');
const moved = await idb();
check(
  Object.keys(stored).every(k => moved[k] === stored[k]),
  'old saves are in IndexedDB, unchanged',
);
check(!!(await page.$('button:has-text("Continue")')), 'and the moved game can be continued');
if (await page.$('button:has-text("Continue")')) {
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(600);
  check(!!(await page.$('.topbar')), 'the moved game loads');
}
check(!errors.length, `no page errors${errors.length ? ': ' + errors.join('; ') : ''}`);
await browser.close();
if (failures) {
  console.log(`${failures} save check(s) failed`);
  process.exit(1);
}
console.log('all save checks OK');
