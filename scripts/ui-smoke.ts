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
/** Where a hex sits on screen, on the map itself (not under a panel); null if not in view. */
const hexPoint = (hex: number) =>
  page.evaluate((hex: number) => {
    const w = globalThis as any;
    const m = w.__map,
      g = w.__hu.game,
      doc = w.document;
    const canvas = doc.querySelector('.map-canvas');
    const cv = canvas.getBoundingClientRect();
    let sx = 0,
      sy = 0,
      n = 0;
    for (let y = 0; y < cv.height; y += 6)
      for (let x = 0; x < cv.width; x += 6)
        if (
          Math.abs(x - cv.width / 2) < 420 &&
          Math.abs(y - cv.height / 2) < 320 &&
          m.hexAtScreen(g, x, y) === hex
        ) {
          sx += x;
          sy += y;
          n++;
        }
    if (!n) return null;
    const p = { x: cv.left + sx / n, y: cv.top + sy / n };
    return doc.elementFromPoint(p.x, p.y) === canvas ? p : null;
  }, hex);
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
// set a far goal from the tree, then open a culture Tome
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
// a Tome is due: the picker, then a confirm, then the Tome's missions
await page.screenshot({ path: `${out}/2d-culture-pick.png` });
await page.click('.tome-pick-card:has-text("Cosmology")');
await page.click('.tome-confirm button.primary');
await page.waitForSelector('.mission-card');
await page.click('.mission-card .buy:not([disabled]) >> nth=0');
await page.waitForSelector('.mission-card.active');
await page.screenshot({ path: `${out}/2e-culture-tome.png` });
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
const homeHex = await page.evaluate(() => {
  const h = (globalThis as any).__hu;
  const c = h.game.cities.find((x: any) => x.civId === 0)!;
  c.tier = 'town';
  h.deselect();
  h.focus(c.hex);
  h.bump();
  return c.hex as number;
});
await page.waitForTimeout(400);
// with nothing selected, clicking my settlement on the map opens its screen at once
const homeAt = await hexPoint(homeHex);
if (!homeAt) throw new Error('the home settlement is not on screen');
await page.mouse.click(homeAt.x, homeAt.y);
await page.waitForSelector('.modal.city-screen', { timeout: 3000 }).catch(() => {
  throw new Error('clicking my settlement did not open its screen');
});
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
// the roster of designs comes first; a new one opens the editor
await page.click('.design-row:has-text("New design")');
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
// the levy is selected: split its 5 cohorts of 100 between the designs, 2 + 3, and pay once
const levyName = ((await page.textContent('.panel.formation h2')) ?? '').trim();
const mixRow = (name: string) => page.locator('.assign.mix .mix-row', { hasText: name });
for (let i = 0; i < 2; i++) await mixRow('Foot Falcons').locator('button:has-text("+")').click();
for (let i = 0; i < 3; i++) await mixRow('Hornets').locator('button:has-text("+")').click();
const costLines: string[] = await page.$$eval('.assign.mix .mix-cost li', (lis: any[]) =>
  lis.map(l => l.textContent ?? ''),
);
if (
  !costLines.some(l => l.startsWith('2 × Foot Falcons')) ||
  !costLines.some(l => l.startsWith('3 × Hornets'))
)
  throw new Error('the cost is not shown per design: ' + costLines.join(' | '));
await page.screenshot({ path: `${out}/5a-mix.png` });
await page.click('.assign button.primary');
await page.waitForTimeout(150);
const mixed = await page.evaluate((name: string) => {
  const g = (globalThis as unknown as { __hu: { game: any } }).__hu.game;
  const f = g.formations.find((x: any) => x.civId === 0 && x.name === name);
  const names = f.cohorts.map(
    (c: any) => g.civs[0].designs.find((d: any) => d.id === c.designId)?.name ?? '-',
  );
  return names.sort().join(',');
}, levyName);
if (mixed !== 'Foot Falcons,Foot Falcons,Hornets,Hornets,Hornets')
  throw new Error('the levy was not split 2 + 3: ' + mixed);
await page.screenshot({ path: `${out}/5-two-designs.png` });
// the Military screen: Land, Sea and Designs tabs in its header; the levy's row reads its mix
await page.click('.rail-btn[aria-label="Military"]');
await page.waitForSelector('.modal.empire > header .hub-tabs button.on:has-text("Land")');
const levyRow = (await page.textContent(`.troop-table tr:has-text("${levyName}")`)) ?? '';
if (!levyRow.includes('2 Foot Falcons') || !levyRow.includes('3 Hornets'))
  throw new Error('the Military list misses the cohorts by design: ' + levyRow);
await page.click('.hub-tabs button:has-text("Sea")');
await page.waitForSelector('.modal.empire .hub-tabs button.on:has-text("Sea")');
await page.screenshot({ path: `${out}/5c-military-sea.png` });
await page.click('.modal.empire .x');
// the roster shows both designs and how many cohorts carry each
await page.click('.rail-btn[aria-label="Military"]');
await page.click('.hub-tabs button:has-text("Designs")');
await page.waitForSelector('.roster-table');
const rows: string[] = await page.$$eval(
  '.roster-table tbody tr',
  (trs: { textContent: string | null }[]) => trs.map(t => t.textContent ?? ''),
);
if (
  !rows.some((r: string) => r.includes('Foot Falcons')) ||
  !rows.some((r: string) => r.includes('Hornets'))
)
  throw new Error('the designs roster misses a design: ' + rows.join(' | '));
await page.screenshot({ path: `${out}/5b-roster.png` });
await page.click('.modal.designs .x');

// a rival's settlement: its people's card and actions sit in the side panel
await page.evaluate(() => {
  const hu = (globalThis as unknown as { __hu: { game: any; selectCity: (id: number) => void } })
    .__hu;
  const c = hu.game.cities.find((x: any) => x.civId !== 0);
  if (!hu.game.civs[0].met.includes(c.civId)) hu.game.civs[0].met.push(c.civId);
  hu.selectCity(c.id);
});
await page.waitForSelector('.side .panel.city-people button:has-text("Propose a deal")');
await page.screenshot({ path: `${out}/5d-rival-city.png` });

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
  return { name: city.name as string, hex: city.hex as number };
});
await page.waitForTimeout(300);
const foe = (await hexPoint(target.hex)) ?? { x: 720, y: 471 };
await page.mouse.move(foe.x, foe.y - 1);
await page.mouse.move(foe.x, foe.y);
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/6-attack-preview.png` });
if ((await page.$('.preview-box')) && !(await page.$('.preview-box .gm-strength')))
  throw new Error('the attack preview shows no strengths');
await page.mouse.click(foe.x, foe.y);
await page.waitForTimeout(200);
if (await page.$('.modal.confirm')) await page.click('.modal.confirm button.primary');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/7-battle-${target.name}.png` });
if (await page.$('.modal.battle')) await page.click('.modal.battle button.primary');

// a selected army clicked onto my own settlement marches into it (no city screen)
const march = await page.evaluate(() => {
  const hu = (globalThis as any).__hu;
  const g = hu.game;
  const c = g.cities.find((x: any) => x.civId === 0);
  const f = g.formations.find((x: any) => x.civId === 0 && x.kind === 'army' && x.hex !== c.hex);
  if (!f) return null;
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
  const spot = off
    .map(([dc, dr]) => (r + dr) * w + col + dc)
    .find(
      (h: number) =>
        ['grassland', 'plains', 'desert', 'tundra'].includes(g.map.terrain[h]) &&
        g.map.relief[h] !== 'mountains' &&
        !g.formations.some((x: any) => x.hex === h) &&
        !g.cities.some((x: any) => x.hex === h),
    );
  if (spot === undefined) return null;
  f.hex = spot;
  f.path = [];
  f.moves = 2;
  hu.select(f.id);
  hu.focus(c.hex);
  hu.bump();
  return { id: f.id, hex: c.hex };
});
if (!march) throw new Error('no army to march into the settlement');
await page.waitForTimeout(400);
const cityAt = await hexPoint(march.hex);
if (!cityAt) throw new Error('the settlement is not on screen for the march');
await page.mouse.click(cityAt.x, cityAt.y);
await page.waitForTimeout(250);
if (await page.$('.modal.city-screen'))
  throw new Error('clicking my settlement with an army selected opened the city screen');
const marched = await page.evaluate((m: { id: number; hex: number }) => {
  const g = (globalThis as any).__hu.game;
  const f = g.formations.find((x: any) => x.id === m.id);
  // it stands in the settlement, or merged with the garrison there
  return f ? f.hex === m.hex : g.formations.some((x: any) => x.civId === 0 && x.hex === m.hex);
}, march);
if (!marched) throw new Error('the selected army did not march into my settlement');
await page.screenshot({ path: `${out}/7b-marched-in.png` });

// a double click on End turn ends one turn only
for (let i = 0; i < 3 && (await page.$('.modal-back .modal .x')); i++) {
  await page.click('.modal-back .modal .x');
  await page.waitForTimeout(150);
}
const turnBefore = await page.evaluate(() => (globalThis as any).__hu.game.turn as number);
// a quick double click, then a slow one: the second press lands once the new turn is shown
const endBox = (await (await page.$('button.end-turn'))!.boundingBox())!;
const endX = endBox.x + endBox.width / 2,
  endY = endBox.y + endBox.height / 2;
await page.mouse.dblclick(endX, endY);
await page.waitForTimeout(300);
await page.mouse.click(endX, endY);
await page.waitForTimeout(100);
await page.screenshot({ path: `${out}/7c-end-turn-locked.png` });
await page.waitForTimeout(1500);
const turnAfter = await page.evaluate(() => (globalThis as any).__hu.game.turn as number);
if (turnAfter !== turnBefore + 1)
  throw new Error(`a double click on End turn went from turn ${turnBefore} to ${turnAfter}`);
for (let i = 0; i < 3 && (await page.$('.modal-back .modal .x')); i++) {
  await page.click('.modal-back .modal .x');
  await page.waitForTimeout(150);
}

// pick the next idle unit and send it east by clicking a hex on the map
await page.click('button.next');
await page.mouse.click(560 + 200, 470);
await page.waitForTimeout(150);
await page.screenshot({ path: `${out}/8-moved.png` });
// Enter asks once while units wait, then ends the turn; each new turn holds the lock briefly
for (let i = 0; i < 5; i++) {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(i % 2 ? 900 : 80);
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
// the first realm event can arrive this early: close it to decide later
for (let i = 0; i < 3 && (await page.$('.modal-back .modal .x')); i++) {
  await page.click('.modal-back .modal .x');
  await page.waitForTimeout(150);
}
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
  await page.click('.design-row:has-text("New design")');
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
