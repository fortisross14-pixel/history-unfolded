/**
 * Drives the built game in a headless browser: start a game, found a city, raise and merge
 * levies, open the equipment designer, end turns. Saves screenshots to the given folder.
 * Usage: npx vite build && npx vite preview --port 4173 & node scripts/ui-smoke.ts <outDir>
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
/* eslint-disable @typescript-eslint/no-explicit-any */

const out = process.argv[2] ?? '.';
const url = process.argv[3] ?? 'http://localhost:4173/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors: string[] = [];
page.on('pageerror', (e: Error) => errors.push(e.message));
page.on('console', (m: { type: () => string; text: () => string }) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('.menu-card');
await page.screenshot({ path: `${out}/1-menu.png` });
await page.click('text=Pangaea');
await page.fill('input[type=number]', '7');
await page.click('button:has-text("Begin")');
await page.waitForSelector('.map-canvas');
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/2-start.png` });
await page.click('button:has-text("Found city")');
await page.waitForTimeout(200);
if (!(await page.$('.modal.research'))) await page.click('.research-btn');
await page.click('.tech:has-text("Archery")');
await page.click('button:has-text("Raise levy")');
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/3-city-levy.png` });
// design two unit types and split the new levy between them: 200 + 300
await page.click('button:has-text("Unit designs")');
await page.waitForSelector('.modal.designs');
await page.fill('.design-name', 'Foot Falcons');
await page.click('.slot:has(h3:text("Weapon")) .item:has-text("Spear")');
await page.click('.slot:has(h3:text("Shield")) .item:has-text("Wicker shield")');
await page.screenshot({ path: `${out}/4-designer.png` });
await page.click('.loadout-side button.primary');
await page.click('.design-row:has-text("New design")');
await page.fill('.design-name', 'Hornets');
await page.click('.slot:has(h3:text("Weapon")) .item:has-text("Javelins")');
await page.click('.loadout-side button.primary');
await page.click('.modal.designs .x');
// the levy is selected: pick 2 cohorts and make them Foot Falcons
await page.click('button.link:has-text("none")');
await page.click('.group .stepper button:has-text("+")');
await page.click('.group .stepper button:has-text("+")');
await page.selectOption('.assign select', { label: 'Foot Falcons' });
await page.click('.assign button.primary');
await page.waitForTimeout(150);
// then the remaining 3 as Hornets
await page.click('button.link:has-text("none")');
const levyGroup = page.locator('.group', { hasText: 'Levy' });
for (let i = 0; i < 3; i++) await levyGroup.locator('.stepper button:has-text("+")').click();
await page.selectOption('.assign select', { label: 'Hornets' });
await page.click('.assign button.primary');
await page.waitForTimeout(150);
await page.screenshot({ path: `${out}/5-two-designs.png` });

// battle: put the formation next to a rival city, declare war, attack by clicking it
const target = await page.evaluate(() => {
  type Hu = {
    game: any;
    focus: (h: number) => void;
    bump: () => void;
    select: (id: number) => void;
  };
  const hu = (globalThis as unknown as { __hu: Hu }).__hu;
  const g = hu.game;
  const me = g.civs[0];
  const f = g.formations.find(
    (x: any) =>
      x.civId === 0 &&
      x.kind === 'army' &&
      x.cohorts.some((c: any) => c.designId !== null) &&
      x.name !== 'Scouts',
  );
  const city = g.cities.find((c: any) => c.civId !== 0);
  g.formations = g.formations.filter((x: any) => !(x.hex === city.hex && x.civId === city.civId));
  const w = g.map.w;
  const r = Math.floor(city.hex / w),
    c = city.hex % w;
  const off =
    r & 1
      ? [
          [1, 0],
          [-1, 0],
          [0, 1],
          [1, 1],
          [0, -1],
          [1, -1],
        ]
      : [
          [1, 0],
          [-1, 0],
          [-1, 1],
          [0, 1],
          [-1, -1],
          [0, -1],
        ];
  for (const [dc, dr] of off) {
    const h = (r + dr) * w + c + dc;
    if (
      ['grassland', 'plains', 'desert', 'tundra'].includes(g.map.terrain[h]) &&
      g.map.relief[h] !== 'mountains' &&
      !g.formations.some((x: any) => x.hex === h)
    ) {
      f.hex = h;
      f.moves = 2;
      break;
    }
  }
  for (let i = 0; i < g.map.w * g.map.h; i++) me.explored[i] = 1;
  hu.select(f.id);
  hu.focus(city.hex);
  hu.bump();
  return city.name;
});
await page.waitForTimeout(300);
await page.mouse.move(720, 470);
await page.mouse.move(720, 471);
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/6-attack-preview.png` });
await page.mouse.click(720, 471);
await page.waitForTimeout(200);
if (await page.$('.modal.confirm')) await page.click('.modal.confirm button.primary');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/7-battle-${target}.png` });
if (await page.$('.modal.battle')) await page.click('.modal.battle button.primary');

// pick the next idle unit and send it east by clicking a hex on the map
await page.click('button.next');
await page.mouse.click(560 + 200, 470);
await page.waitForTimeout(150);
await page.screenshot({ path: `${out}/8-moved.png` });
for (let i = 0; i < 5; i++) {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
}
await page.screenshot({ path: `${out}/9-turns.png` });
// zoom out
await page.mouse.move(700, 450);
for (let i = 0; i < 6; i++) {
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(30);
}
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/10-zoomed-out.png` });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/11-phone.png` });
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
