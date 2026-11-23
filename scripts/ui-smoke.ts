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
// a new settlement is named first: keep the suggested name
await page.waitForSelector('.modal.name-city');
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
if (!(await page.$('.modal.research'))) await page.click('[data-k="research"]');
await page.screenshot({ path: `${out}/2b-research.png` });
await page.click('.tech-card.can:has-text("Archery")');
// set a far goal from the tree, then look at the culture web
await page.click('[data-k="research"]:has-text("Archery")');
await page.click('.age-gate button');
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
await page.click('[data-k="culture"]');
await page.waitForSelector('.modal.culture');
await page.click('.cnode.can:has-text("Star Lore")');
await page.click('.cnode.can:has-text("Solar Calendar")');
await page.click('.cnode.can:has-text("Chiefdom")');
await page.screenshot({ path: `${out}/2d-culture.png` });
await page.click('.domain-tabs button:has-text("Cosmology")');
await page.screenshot({ path: `${out}/2e-culture-cosmology.png` });
await page.click('.modal.culture .x');

// founding opened nothing: the new city waits in the to-do list ("Plan Corin")
if (await page.$('.modal.city-screen')) throw new Error('founding a city opened the city screen');
for (let i = 0; i < 6 && !(await page.$('.modal.city-screen')); i++) {
  const label = (await page.textContent('button.next')) ?? '';
  await page.click('button.next');
  await page.waitForTimeout(120);
  if (!label.startsWith('Plan') && (await page.$('.modal'))) await page.keyboard.press('Escape');
}
if (!(await page.$('.modal.city-screen'))) throw new Error('the to-do list never offered the city');
await page.screenshot({ path: `${out}/3-todo-city.png` });
await page.waitForSelector('.modal.city-screen');
await page.screenshot({ path: `${out}/3a-city-screen.png` });
// a new settlement holds only its centre: no free district yet, the rest locked until it grows
if (await page.$('.district-tabs button.add'))
  throw new Error('a new settlement offered a second district');
// grow it to a town (by hand: the upgrade itself is covered by rulescheck), then add a district
await page.keyboard.press('Escape');
await page.evaluate(() => {
  const h = (
    globalThis as unknown as {
      __hu: {
        game: { cities: { id: number; civId: number; tier: string }[] };
        bump: () => void;
        selectCity: (id: number) => void;
      };
    }
  ).__hu;
  const c = h.game.cities.find(x => x.civId === 0)!;
  c.tier = 'town';
  h.selectCity(c.id);
  h.bump();
});
await page.waitForTimeout(300);
await page.click('button:has-text("City & districts")');
await page.waitForSelector('.modal.city-screen');
// the overview first; districts and the 3D scene on their own tab
await page.screenshot({ path: `${out}/3a-city-overview.png` });
await page.click('.city-tabs button:has-text("Districts")');
await page.click('.district-tabs button.add');
await page.fill('.new-district .design-name', 'Farm');
await page.click('.new-district button.primary');
await page.waitForSelector('.city-scene');
await page.waitForTimeout(1500);
// pick plots in the scene and choose what to build there
const stage = (await (await page.$('.city-scene'))!.boundingBox())!;
let picked = 0;
for (const [fx, fy] of [
  [0.5, 0.5],
  [0.42, 0.45],
  [0.58, 0.45],
  [0.42, 0.58],
  [0.58, 0.58],
  [0.5, 0.38],
  [0.5, 0.66],
]) {
  await page.mouse.click(stage.x + stage.width * fx, stage.y + stage.height * fy);
  await page.waitForTimeout(250);
  const opt = page.locator('.plot-opt:not(.clear)').first();
  if (await opt.count()) {
    await opt.hover();
    await page.waitForTimeout(150);
    if (!(await page.$('.build-tip'))) throw new Error('pointing at a building shows no tip');
    await opt.click();
    picked++;
    await page.waitForTimeout(200);
  }
}
if (!picked) throw new Error('no plot could be filled from the scene');
await page.fill('.bp-row input', 'Farm');
await page.click('.bp-row button:has-text("Save")');
await page.screenshot({ path: `${out}/3b-district.png` });
if (await page.$('.district-tabs button.add')) throw new Error('a town offered a third district');
await page.click('.modal.city-screen .x');
// the goods ledger
await page.click('.topbar button:has-text("Goods")');
await page.waitForSelector('.modal.goods-ledger');
await page.screenshot({ path: `${out}/3c-goods.png` });
await page.click('.modal.goods-ledger .x');
await page.click('button:has-text("Raise levy")');
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/3-city-levy.png` });
// design two unit types and split the new levy between them: 200 + 300
await page.click('.rail-btn[aria-label="Military"]');
await page.click('.hub-tabs button:has-text("Designs")');
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
// ships: design a transport, launch it, board the troops by clicking the ship
const coastal = await page.evaluate(() => {
  type Hu = {
    game: any;
    focus: (h: number) => void;
    bump: () => void;
    select: (id: number) => void;
  };
  const hu = (globalThis as unknown as { __hu: Hu }).__hu;
  const g = hu.game;
  const c = g.cities.find((x: any) => x.civId === 0);
  const w = g.map.w;
  const r = Math.floor(c.hex / w),
    col = c.hex % w;
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
  const around = off.map(([dc, dr]) => (r + dr) * w + col + dc);
  let water = around.find((h: number) => ['coast', 'lake'].includes(g.map.terrain[h]));
  if (water === undefined) {
    // test only: turn a free neighbouring hex into a little bay
    water = around.find(
      (h: number) =>
        !g.formations.some((f: any) => f.hex === h) && !g.districts.some((d: any) => d.hex === h),
    );
    if (water === undefined) return false;
    g.map.terrain[water] = 'lake';
    g.map.vegetation[water] = 'none';
    g.map.relief[water] = 'flat';
  }
  g.civs[0].techs.push('sailing', 'navigation');
  const centre = g.districts.find((d: any) => d.hex === c.hex);
  centre.slots[0] = { type: 'shipyard', built: true, progress: 0, paid: true };
  c.stockpile.wood = (c.stockpile.wood ?? 0) + 50;
  c.stockpile.hides = (c.stockpile.hides ?? 0) + 10;
  c.pop += 2000;
  hu.focus(c.hex);
  hu.bump();
  return true;
});
if (coastal) {
  await page.click('.rail-btn[aria-label="Military"]');
  await page.click('.hub-tabs button:has-text("Designs")');
  await page.click('.land-sea button:has-text("Ships")');
  await page.fill('.design-name', 'Ferry');
  await page.click('.slot:has(h3:text("Hull")) .item:has-text("Galley")');
  await page.click('.slot:has(h3:text("Rig")) .item:has-text("Square sail")');
  await page.click('.slot:has(h3:text("Fit-out")) .item:has-text("Troop deck")');
  await page.screenshot({ path: `${out}/9b-ship-designer.png` });
  await page.click('.loadout-side button.primary');
  await page.click('.modal.designs .x');
  await page.evaluate(() => {
    const hu = (globalThis as unknown as { __hu: { game: any; selectCity: (id: number) => void } })
      .__hu;
    hu.selectCity(hu.game.cities.find((x: any) => x.civId === 0).id);
  });
  await page.waitForTimeout(100);
  if (await page.$('.ship-row')) {
    await page.selectOption('.ship-row select', { label: 'Ferry' });
    await page.click('.ship-row button');
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${out}/9c-ship-launched.png` });
    await page.mouse.move(720, 471);
    for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -400);
    // select the levy in the city and click the ship to board it
    const boarded = await page.evaluate(() => {
      const hu = (
        globalThis as unknown as {
          __hu: { game: any; select: (id: number) => void; focus: (h: number) => void };
        }
      ).__hu;
      const g = hu.game;
      const fleet = g.formations.find((f: any) => f.civId === 0 && f.kind === 'fleet');
      const c = g.cities.find((x: any) => x.civId === 0);
      const army = g.formations.find(
        (f: any) =>
          f.civId === 0 && f.kind === 'army' && f.cohorts.length <= 5 && f.name !== 'Scouts',
      );
      army.hex = c.hex;
      army.moves = 2;
      hu.select(army.id);
      hu.focus(fleet.hex);
      return true;
    });
    if (boarded) {
      await page.waitForTimeout(250);
      await page.mouse.click(720, 471);
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${out}/9d-boarded.png` });
    }
  }
}

// diplomacy: the peoples screen and a deal
if (await page.$('.modal-back')) await page.keyboard.press('Escape');
const proposalBtn = await page.$('.modal.proposal button:not(.primary)');
if (proposalBtn) await proposalBtn.click();
await page.click('.rail-btn[aria-label="Diplomacy"]');
await page.waitForSelector('.modal.peoples');
await page.screenshot({ path: `${out}/10b-peoples.png` });
const dealBtn = await page.$('button:has-text("Propose a deal")');
if (dealBtn) {
  await dealBtn.click();
  await page.waitForSelector('.modal.deal');
  await page.click('.deal-side >> nth=0 >> input >> nth=0');
  await page.keyboard.type('5');
  await page.screenshot({ path: `${out}/10c-deal.png` });
  await page.click('.modal.deal .x');
} else await page.click('.modal.peoples .x');
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/11-phone.png` });
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
