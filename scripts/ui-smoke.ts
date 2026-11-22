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
await page.screenshot({ path: `${out}/2b-research.png` });
await page.click('.tech-card.can:has-text("Archery")');
// set a far goal from the tree, then look at the culture web
await page.click('.research-btn:has-text("Archery")');
await page.click('.tech-card:has-text("Iron Working")');
await page.screenshot({ path: `${out}/2c-research-goal.png` });
await page.click('.modal.research .x');
await page.evaluate(() => {
  const hu = (
    globalThis as unknown as {
      __hu: { game: { civs: { culture: { points: number } }[] }; bump: () => void };
    }
  ).__hu;
  hu.game.civs[0].culture.points = 200;
  hu.bump();
});
await page.click('.research-btn:has-text("🎭")');
await page.waitForSelector('.modal.culture');
await page.click('.cnode.can:has-text("Star Lore")');
await page.click('.cnode.can:has-text("Solar Calendar")');
await page.click('.cnode.can:has-text("Chiefdom")');
await page.screenshot({ path: `${out}/2d-culture.png` });
await page.click('.domain-tabs button:has-text("Cosmology")');
await page.screenshot({ path: `${out}/2e-culture-cosmology.png` });
await page.click('.modal.culture .x');

// city screen: lay out a "Farm" district and fill a few slots
await page.click('button:has-text("City & districts")');
await page.waitForSelector('.modal.city-screen');
await page.screenshot({ path: `${out}/3a-city-screen.png` });
const hexes = page.locator('.hexmap .hx:not(.off)');
const nHex = await hexes.count();
for (let k = 1; k < nHex; k++) {
  await hexes.nth(k).click();
  if (await page.$('.new-district')) break;
}
await page.fill('.new-district .design-name', 'Farm');
await page.click('.new-district button.primary');
await page.waitForSelector('.grid3');
const pick = async (i: number, name: string) => {
  await page.locator('.grid3 .cell').nth(i).click();
  const b = page.locator('.pal:not(.locked)', { hasText: name }).first();
  if (await b.count()) await b.click();
};
await pick(4, 'Grain field');
await pick(1, 'Pig pen');
await pick(3, 'Pig pen');
await pick(5, 'Pig pen');
await pick(7, 'Woodlot');
await pick(0, 'Cattle pasture');
await page.fill('.bp-row input', 'Farm');
await page.click('.bp-row button:has-text("Save")');
await page.locator('.grid3 .cell').nth(1).click();
await page.screenshot({ path: `${out}/3b-district.png` });
await page.click('.modal.city-screen .x');
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
