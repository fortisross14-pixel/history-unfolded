/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Plays the start of a game on an emulated phone with touch: menu, map, bottom sheet, the
 * tap-twice rule for moves, a dialog, and the compact top bar; then a tablet's top bar and its
 * More menu. Saves screenshots.
 * Usage: npx vite preview --port 4173 &  node --no-warnings scripts/mobile-smoke.ts <outDir> [url]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const out = process.argv[2] ?? '.';
const url = process.argv[3] ?? 'http://localhost:4173/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errors: string[] = [];
page.on('pageerror', (e: Error) => errors.push(e.message));
page.on(
  'console',
  (m: { type: () => string; text: () => string }) => m.type() === 'error' && errors.push(m.text()),
);
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.screenshot({ path: `${out}/m1-menu.png` });
await page.tap('button:has-text("Begin")');
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/m2-start.png` });
const vp = page.viewportSize();
// tap a hex a little right of the middle of the free map area: first tap previews, second moves
const box = await page.evaluate(() => {
  const doc = (
    globalThis as unknown as {
      document: {
        querySelector: (q: string) => {
          getBoundingClientRect: () => { top: number; bottom: number };
        };
      };
    }
  ).document;
  const side = doc.querySelector('.side').getBoundingClientRect();
  const top = doc.querySelector('.topbar').getBoundingClientRect();
  return { y: (top.bottom + side.top) / 2 };
});
await page.touchscreen.tap(vp.width / 2 - 60, box.y + 120);
await page.waitForTimeout(250);
await page.screenshot({ path: `${out}/m3-armed.png` });
const armed = await page.$('.armed-bar');
await page.touchscreen.tap(vp.width / 2 - 60, box.y + 120);
await page.waitForTimeout(250);
await page.screenshot({ path: `${out}/m4-moved.png` });
// shrink the sheet, open the menu, open research
await page.tap('.sheet-handle');
await page.waitForTimeout(150);
await page.tap('.more-btn');
await page.waitForTimeout(150);
await page.screenshot({ path: `${out}/m5-menu-open.png` });
await page.tap('[data-k="research"]');
await page.waitForSelector('.modal.research');
await page.screenshot({ path: `${out}/m6-research.png` });
console.log(armed ? 'first tap armed the move' : 'NO ARMED BAR after first tap');
// the Military screen: its Land / Sea / Designs tabs sit in the dialog's header
await page.tap('.modal.research .x');
await page.tap('.rail-btn[aria-label="Military"]');
await page.waitForSelector('.modal.empire > header .hub-tabs button.on:has-text("Land")');
await page.tap('.modal.empire > header .hub-tabs button:has-text("Sea")');
await page.waitForSelector('.modal.empire > header .hub-tabs button.on:has-text("Sea")');
await page.screenshot({ path: `${out}/m7-military.png` });
await page.tap('.modal.empire .x');
// a double tap on End turn ends one turn only
const turn0 = await page.evaluate(() => (globalThis as any).__hu.game.turn as number);
const end = (await (await page.$('button.end-turn'))!.boundingBox())!;
await page.touchscreen.tap(end.x + end.width / 2, end.y + end.height / 2);
await page.waitForTimeout(350);
await page.touchscreen.tap(end.x + end.width / 2, end.y + end.height / 2);
await page.waitForTimeout(1500);
const turn1 = await page.evaluate(() => (globalThis as any).__hu.game.turn as number);
const once = turn1 === turn0 + 1;
console.log(
  once ? 'a double tap on End turn ends one turn' : `DOUBLE TAP WENT ${turn0} -> ${turn1}`,
);
await page.screenshot({ path: `${out}/m8-next-turn.png` });
// a tablet in portrait: one row of numbers, the rest behind More, which folds away for a screen
const tab = await browser.newContext({ ...devices['iPad (gen 7)'] });
const tp = await tab.newPage();
tp.on('pageerror', (e: Error) => errors.push(e.message));
await tp.goto(url);
await tp.evaluate(() => localStorage.clear());
await tp.reload();
await tp.tap('button:has-text("Begin")');
await tp.waitForTimeout(600);
const oneRow = await tp.evaluate(() => {
  const doc = (globalThis as unknown as { document: any }).document;
  return doc.querySelector('.topbar').getBoundingClientRect().height < 90;
});
await tp.tap('.more-btn');
await tp.waitForTimeout(150);
await tp.screenshot({ path: `${out}/t1-tablet-menu.png` });
await tp.tap('.topbar .secondary:has-text("Goods")');
await tp.waitForSelector('.modal.goods-ledger');
const folded = !(await tp.$('.topbar.menu-open'));
// the minimap sits at the bottom left, clear of the turn box
await tp.tap('.modal.goods-ledger .x');
await tp.waitForTimeout(150);
const miniOk = await tp.evaluate(() => {
  const doc = (globalThis as unknown as { document: any; innerHeight: number }).document;
  const vh = (globalThis as unknown as { innerHeight: number }).innerHeight;
  const m = doc.querySelector('.minimap-dock')?.getBoundingClientRect();
  const t = doc.querySelector('.turn-box')?.getBoundingClientRect();
  if (!m || !t) return false;
  return m.left < 40 && vh - m.bottom < 40 && m.right < t.left;
});
await tp.screenshot({ path: `${out}/t2-tablet-minimap.png` });
console.log(miniOk ? 'tablet minimap at the bottom left' : 'TABLET MINIMAP NOT AT THE BOTTOM LEFT');
console.log(oneRow ? 'tablet top bar is one row' : 'TABLET TOP BAR WRAPS');
console.log(folded ? 'tablet menu folds away for a screen' : 'TABLET MENU STAYS OPEN');
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
process.exit(errors.length || !once || !armed || !oneRow || !folded || !miniOk ? 1 : 0);
