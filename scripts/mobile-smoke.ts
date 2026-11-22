/**
 * Plays the start of a game on an emulated phone with touch: menu, map, bottom sheet, the
 * tap-twice rule for moves, a dialog, and the compact top bar. Saves screenshots.
 * Usage: npx vite preview --port 4173 &  node --no-warnings scripts/mobile-smoke.ts <outDir>
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const out = process.argv[2] ?? '.';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errors: string[] = [];
page.on('pageerror', (e: Error) => errors.push(e.message));
page.on(
  'console',
  (m: { type: () => string; text: () => string }) => m.type() === 'error' && errors.push(m.text()),
);
await page.goto('http://localhost:4173/');
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
await page.tap('.research-btn >> nth=0');
await page.waitForSelector('.modal.research');
await page.screenshot({ path: `${out}/m6-research.png` });
console.log(armed ? 'first tap armed the move' : 'NO ARMED BAR after first tap');
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
process.exit(errors.length || !armed ? 1 : 0);
