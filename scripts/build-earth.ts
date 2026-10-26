// Builds src/data/earth.json, the "Earth" map, from Natural Earth data
// (public domain, naturalearthdata.com). Download these GeoJSON files from
// github.com/nvkelso/natural-earth-vector/tree/master/geojson into one folder:
//   ne_50m_land, ne_110m_lakes, ne_110m_admin_0_countries,
//   ne_50m_admin_1_states_provinces, ne_50m_geography_regions_polys,
//   ne_110m_rivers_lake_centerlines
// then run: node scripts/build-earth.ts <folder> [columns]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node scripts/build-earth.ts <natural-earth-folder> [columns]');
const W = Number(process.argv[3] ?? '76');
const LAT_TOP = 72;
const LAT_BOTTOM = -56;
const LON_STEP = 360 / W;
// Hex rows are taller than columns are wide (√3 : 1.5), so keep shapes true at the equator.
const LAT_STEP = LON_STEP * (Math.sqrt(3) / 1.5);
const H = Math.round((LAT_TOP - LAT_BOTTOM) / LAT_STEP);

type Ring = [number, number][];
type Poly = Ring[]; // outer ring, then holes
interface Shape {
  polys: Poly[];
  box: [number, number, number, number];
  props: Record<string, unknown>;
}

function load(name: string): Shape[] {
  const geo = JSON.parse(readFileSync(join(dir, `${name}.geojson`), 'utf8')) as {
    features: {
      geometry: { type: string; coordinates: unknown } | null;
      properties: Record<string, unknown>;
    }[];
  };
  const out: Shape[] = [];
  for (const f of geo.features) {
    if (!f.geometry) continue;
    const g = f.geometry;
    const polys: Poly[] =
      g.type === 'Polygon'
        ? [g.coordinates as Poly]
        : g.type === 'MultiPolygon'
          ? (g.coordinates as Poly[])
          : [];
    if (!polys.length) continue;
    let [x0, y0, x1, y1] = [180, 90, -180, -90];
    for (const p of polys)
      for (const [x, y] of p[0]) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    out.push({ polys, box: [x0, y0, x1, y1], props: f.properties });
  }
  return out;
}

function inRing(ring: Ring, x: number, y: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inShape(s: Shape, x: number, y: number) {
  if (x < s.box[0] || x > s.box[2] || y < s.box[1] || y > s.box[3]) return false;
  return s.polys.some(p => inRing(p[0], x, y) && !p.slice(1).some(h => inRing(h, x, y)));
}

const find = (shapes: Shape[], x: number, y: number) => shapes.find(s => inShape(s, x, y));

const land = load('ne_50m_land');
const lakes = load('ne_110m_lakes').filter(l => Number(l.props.scalerank ?? 9) <= 1);
const countries = load('ne_110m_admin_0_countries');
const states = load('ne_50m_admin_1_states_provinces');
const regions = load('ne_50m_geography_regions_polys');
const rivers = JSON.parse(
  readFileSync(join(dir, 'ne_110m_rivers_lake_centerlines.geojson'), 'utf8'),
) as {
  features: { geometry: { type: string; coordinates: unknown } | null }[];
};

const region = (cla: string[]) => regions.filter(r => cla.includes(String(r.props.FEATURECLA)));
const mountains = region(['Range/mtn']);
const deserts = region(['Desert']);
const tundras = region(['Tundra']);
const basins = region(['Basin', 'Wetlands', 'Foothills']);
const plateauHigh = regions.filter(r =>
  /TIBET|ALTIPLANO|PAMIR|ETHIOPIAN/i.test(String(r.props.NAME)),
);
// Small, memorable features name a region before states or countries do.
const namers = region([
  'Delta',
  'Valley',
  'Geoarea',
  'Pen/cape',
  'Isthmus',
  'Island',
  'Gorge',
  'Coast',
]).filter(
  r =>
    !/Antarctic|Land$|Coast$/.test(String(r.props.NAME)) ||
    /Dalmatia|Malabar|Coromandel/.test(String(r.props.NAME)),
);
const bigNamers = region([
  'Plain',
  'Basin',
  'Desert',
  'Range/mtn',
  'Plateau',
  'Lowland',
  'Tundra',
  'Island group',
]);

const center = (x: number, y: number): [number, number] => [
  -180 + (x + 0.5) * LON_STEP,
  LAT_TOP - (y + 0.5 + (x % 2 ? 0.5 : 0)) * LAT_STEP,
];

/** Seven sample points per hex: the centre and six around it. */
function samples(x: number, y: number): [number, number][] {
  const [lon, lat] = center(x, y);
  const out: [number, number][] = [[lon, lat]];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    out.push([lon + Math.cos(a) * LON_STEP * 0.42, lat + Math.sin(a) * LAT_STEP * 0.42]);
  }
  return out;
}

/** Deterministic noise in 0..1 for a cell. */
const hash = (x: number, y: number) => {
  let h = Math.imul(x + 1, 0x9e3779b1) ^ Math.imul(y + 7, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

const terrain: string[] = [];
const isLand: boolean[] = [];
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const pts = samples(x, y);
    const onLand = pts.filter(([a, b]) => find(land, a, b) && !find(lakes, a, b)).length;
    isLand[y * W + x] = onLand >= 3;
  }

for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!isLand[i]) {
      terrain[i] = 'o';
      continue;
    }
    const [lon, lat] = center(x, y);
    const pts = samples(x, y);
    const share = (shapes: Shape[]) => pts.filter(([a, b]) => find(shapes, a, b)).length;
    const abs = Math.abs(lat);
    if (share(mountains) >= 3 || share(plateauHigh) >= 3) terrain[i] = 'm';
    else if (share(deserts) >= 3) terrain[i] = 'd';
    else if (abs > 62 || share(tundras) >= 3) terrain[i] = 't';
    else if (share(basins) >= 3 || abs < 10) terrain[i] = 'f';
    else if (abs > 50) terrain[i] = hash(x, y) < 0.7 ? 'f' : 'p';
    else if (abs > 33 && abs <= 50) terrain[i] = hash(x, y) < 0.3 ? 'f' : 'p';
    else terrain[i] = 'p';
    void lon;
  }

// Rivers: any cell a major river line passes through.
const river: boolean[] = new Array(W * H).fill(false);
const cellOf = (lon: number, lat: number) => {
  const x = Math.floor((lon + 180) / LON_STEP);
  if (x < 0 || x >= W) return -1;
  const y = Math.floor((LAT_TOP - lat) / LAT_STEP - (x % 2 ? 0.5 : 0));
  if (y < 0 || y >= H) return -1;
  return y * W + x;
};
for (const f of rivers.features) {
  if (!f.geometry) continue;
  const lines = (
    f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates
  ) as [number, number][][];
  for (const line of lines)
    for (let k = 1; k < line.length; k++) {
      const [x0, y0] = line[k - 1];
      const [x1, y1] = line[k];
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (LON_STEP / 3)) + 1;
      for (let t = 0; t <= steps; t++) {
        const c = cellOf(x0 + ((x1 - x0) * t) / steps, y0 + ((y1 - y0) * t) / steps);
        if (c >= 0 && isLand[c]) river[c] = true;
      }
    }
}

// Continents, from the country each cell lies in (or the nearest one).
const CONTINENTS = ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania'];
const countryCentroid = countries.map(c => [(c.box[0] + c.box[2]) / 2, (c.box[1] + c.box[3]) / 2]);
function countryAt(x: number, y: number) {
  for (const [a, b] of samples(x, y)) {
    const c = find(countries, a, b);
    if (c) return c;
  }
  const [lon, lat] = center(x, y);
  let best = 0;
  let bestD = Infinity;
  countries.forEach((c, k) => {
    const d = Math.hypot(countryCentroid[k][0] - lon, countryCentroid[k][1] - lat);
    if (d < bestD && String(c.props.CONTINENT) !== 'Antarctica') {
      bestD = d;
      best = k;
    }
  });
  return countries[best];
}

const title = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())
    .replace(/\bPen\.$/, 'Peninsula')
    .replace(/\bMts\.$/, 'Mountains')
    .replace(/\bRa\.$/, 'Range')
    .replace(/\bPlat\.$/, 'Plateau')
    .replace(/ Of /g, ' of ')
    .replace(/ De /g, ' de ')
    .replace(/ Do /g, ' do ');

const continent: number[] = [];
const names: (string | null)[] = [];
/** Name candidates per land cell, most specific first. */
const candidates: string[][] = [];
const HAS_STATES = [
  'Russia',
  'United States of America',
  'China',
  'India',
  'Brazil',
  'Canada',
  'Australia',
  'Indonesia',
];
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!isLand[i]) {
      continent[i] = -1;
      candidates[i] = [];
      continue;
    }
    const country = countryAt(x, y);
    const [lon, lat] = center(x, y);
    const countryName = String(country.props.NAME);
    const displayName =
      countryName === 'United States of America'
        ? 'United States'
        : String(country.props.NAME_LONG ?? countryName);
    let cont = String(country.props.CONTINENT);
    // Natural Earth files all of Russia under Europe; east of the Urals is Asia.
    if (countryName === 'Russia' && lon > 60) cont = 'Asia';
    if (cont === 'Seven seas (open ocean)') cont = 'Africa';
    continent[i] = Math.max(0, CONTINENTS.indexOf(cont));
    const small = find(namers, lon, lat);
    const label = (r: Shape) => title(String(r.props.NAME_EN ?? r.props.NAME));
    const smallName = small ? label(small) : null;
    // Huge geo-areas like Siberia name a region only when nothing better exists.
    const hugeArea = small && /SIBERIA|ALASKA|PATAGONIA/i.test(String(small.props.NAME));
    const state = HAS_STATES.includes(countryName) ? find(states, lon, lat) : undefined;
    const big = find(bigNamers, lon, lat);
    candidates[i] = [
      hugeArea ? null : smallName,
      state ? String(state.props.name) : null,
      big ? label(big) : null,
      displayName,
      hugeArea ? smallName : null,
    ].filter((n): n is string => !!n);
    if (!candidates[i].length) candidates[i] = ['Wilderness'];
  }

// Balance: a name shared by too many cells hands some of them to their next candidate.
const choice: number[] = candidates.map(() => 0);
const MAX_SHARE = 6;
for (let round = 0; round < 4; round++) {
  const count = new Map<string, number>();
  candidates.forEach(
    (c, i) => c.length && count.set(c[choice[i]], (count.get(c[choice[i]]) ?? 0) + 1),
  );
  candidates.forEach((c, i) => {
    if (!c.length) return;
    const now = c[choice[i]];
    if ((count.get(now) ?? 0) <= MAX_SHARE) return;
    for (let k = choice[i] + 1; k < c.length; k++) {
      if ((count.get(c[k]) ?? 0) < MAX_SHARE) {
        count.set(now, count.get(now)! - 1);
        count.set(c[k], (count.get(c[k]) ?? 0) + 1);
        choice[i] = k;
        return;
      }
    }
  });
}

// Shared names get a direction from the group's centre: up to nine distinct ones.
const QUALIFIERS = [
  'Northern',
  'Northeastern',
  'Eastern',
  'Southeastern',
  'Southern',
  'Southwestern',
  'Western',
  'Northwestern',
];
const PLAIN_QUALIFIERS = ['Upper', 'Far', 'Outer', 'Lower', 'Coastal', 'Old', 'New', 'Greater'];
const groups = new Map<string, number[]>();
candidates.forEach(
  (c, i) => c.length && groups.set(c[choice[i]], [...(groups.get(c[choice[i]]) ?? []), i]),
);
for (const [n, cells] of groups) {
  if (cells.length === 1) {
    names[cells[0]] = n;
    continue;
  }
  const pos = (i: number) => [(i % W) * 1.5, Math.floor(i / W) + ((i % W) % 2 ? 0.5 : 0)];
  const cx = cells.reduce((a, i) => a + pos(i)[0], 0) / cells.length;
  const cy = cells.reduce((a, i) => a + pos(i)[1], 0) / cells.length;
  const used = new Set<string>();
  const ordered = cells
    .map(i => {
      const [px, py] = pos(i);
      return { i, d: Math.hypot(px - cx, py - cy), a: Math.atan2(py - cy, px - cx) };
    })
    .sort((p, q) => q.d - p.d);
  // The cell nearest the middle is "Central" when the group has three or more cells.
  const middle = cells.length >= 3 ? ordered.at(-1)!.i : -1;
  // Avoid "Western Western Australia": a name that already starts with a direction gets plainer words.
  const leading = n.split(' ')[0];
  const plain =
    /^(Northern|Southern|Eastern|Western|Central|North|South|East|West|Upper|Lower)$/.test(leading);
  for (const { i, a } of ordered) {
    if (i === middle) {
      names[i] = plain ? `Inner ${n}` : `Central ${n}`;
      continue;
    }
    // Screen y grows downward: angle 0 is east, π/2 is south.
    const octant =
      Math.round(((a + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 4)) % 8;
    let label = '';
    for (let step = 0; step < 8 && !label; step++)
      for (const k of [octant + step, octant - step]) {
        const q = plain ? PLAIN_QUALIFIERS[(k + 8) % 8] : QUALIFIERS[(k + 8) % 8];
        if (!used.has(q)) {
          label = q;
          break;
        }
      }
    if (label) {
      used.add(label);
      names[i] = `${label} ${n}`;
    } else {
      let k = 2;
      while (used.has(`Outer ${n} ${k}`)) k++;
      used.add(`Outer ${n} ${k}`);
      names[i] = `Outer ${n} ${k}`;
    }
  }
}

const landCount = isLand.filter(Boolean).length;
const out = {
  source: 'Natural Earth (public domain), built by scripts/build-earth.ts',
  width: W,
  height: H,
  lonStep: LON_STEP,
  latStep: LAT_STEP,
  latTop: LAT_TOP,
  continents: CONTINENTS,
  terrain: terrain.join(''),
  rivers: river.map(b => (b ? '1' : '0')).join(''),
  continent,
  names,
};
writeFileSync(process.argv[4] ?? 'src/data/earth.json', JSON.stringify(out));
console.log(
  `Earth map ${W}×${H}: ${landCount} land regions, ${river.filter(Boolean).length} on rivers.`,
);
