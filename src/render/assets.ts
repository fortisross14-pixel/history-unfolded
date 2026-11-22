/** Sprite registry. Art is looked up by key, so a new art pack only has to provide the same keys. */
const BASE = `${import.meta.env.BASE_URL}sprites/`;

const VARIANTS: Record<string, number> = {
  tree: 8,
  conifer: 8,
  palm: 8,
  hill: 6,
  mountain: 6,
  marsh: 4,
  rocks: 3,
};
const UNITS = ['pikeman', 'musketeer', 'cavalry', 'scout', 'colonist', 'conquistador'];
const GOODS = ['timber', 'furs', 'gold', 'silver', 'spices', 'silk', 'dyes', 'wine', 'corn', 'cod'];
const SHIPS = ['caravel', 'carrack', 'fluyt', 'frigate', 'galleon'];
const CITIES = ['city-outpost', 'city-town', 'city-city', 'port-outpost', 'port-town', 'port-city'];

export interface Assets {
  img: Record<string, HTMLImageElement>;
  variants: typeof VARIANTS;
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(im); // missing art falls back to drawn shapes
    im.src = src;
  });
}

export async function loadAssets(): Promise<Assets> {
  const jobs: [string, string][] = [];
  for (const [k, n] of Object.entries(VARIANTS))
    for (let i = 0; i < n; i++) jobs.push([`${k}-${i}`, `terrain/${k}-${i}.png`]);
  for (const u of UNITS) jobs.push([`unit:${u}`, `units/${u}.png`]);
  for (const g of GOODS) jobs.push([`good:${g}`, `goods/${g}.png`]);
  for (const c of CITIES) jobs.push([`city:${c}`, `cities/${c}.png`]);
  for (const sh of SHIPS) jobs.push([`ship:${sh}`, `ships/${sh}.png`]);
  jobs.push(['parchment', 'parchment.jpg']);
  const imgs = await Promise.all(jobs.map(([, p]) => load(BASE + p)));
  const img: Record<string, HTMLImageElement> = {};
  jobs.forEach(([k], i) => {
    if (imgs[i].naturalWidth) img[k] = imgs[i];
  });
  return { img, variants: VARIANTS };
}
