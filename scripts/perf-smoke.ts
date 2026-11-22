/**
 * Measures map drawing in a real browser: a large map, zoomed out, panned 60 times.
 * Prints average and p95 draw() time. Usage: npx vite preview --port 4173 &  node --no-warnings scripts/perf-smoke.ts [cpuSlowdown]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const slow = Number(process.argv[2] ?? 1);
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
});
const cdp = await page.context().newCDPSession(page);
if (slow > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: slow });
await page.goto('http://localhost:4173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.selectOption('.field:has-text("Map size") select', 'huge');
await page.click('button:has-text("Begin")');
await page.waitForTimeout(800);
// reveal the whole map so there is a lot to draw
await page.evaluate(() => {
  const hu = (
    globalThis as unknown as {
      __hu: { game: { civs: { explored: number[] }[] }; bump: () => void };
    }
  ).__hu;
  hu.game.civs[0].explored.fill(1);
  hu.bump();
});
await page.mouse.move(640, 400);
for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 400);
await page.waitForTimeout(300);
await page.evaluate(() => ((globalThis as unknown as { __drawMs: number[] }).__drawMs = []));
for (let i = 0; i < 60; i++) {
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(640 + (i % 2 ? -40 : 40), 400 + (i % 3 ? 20 : -20), { steps: 2 });
  await page.mouse.up();
}
await page.waitForTimeout(300);
const ms: number[] = await page.evaluate(
  () => (globalThis as unknown as { __drawMs: number[] }).__drawMs,
);
ms.sort((a, b) => a - b);
const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
console.log(
  `draws ${ms.length}, avg ${avg.toFixed(1)} ms, p95 ${ms[Math.floor(ms.length * 0.95)].toFixed(1)} ms, max ${ms[ms.length - 1].toFixed(1)} ms (CPU x${slow})`,
);
await browser.close();
