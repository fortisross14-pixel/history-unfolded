/**
 * Procedural maps. Pipeline: elevation (noise + a shape mask per map type) → sea level by land
 * fraction → mountains and hills (ridged noise) → temperature and moisture → terrain and
 * vegetation → rivers running downhill (dead ends become lakes) → deposits → balanced starts.
 */
import { DEPOSITS } from '../data/goods.ts';
import {
  isWater,
  TERRAIN,
  VEGETATION,
  type ReliefId,
  type TerrainId,
  type VegetationId,
} from '../data/terrain.ts';
import {
  centerUnit,
  col,
  distance,
  neighbors,
  pixelSizeUnit,
  row,
  within,
  type Grid,
} from './hex.ts';
import { fbm, makeNoise, ridged } from './noise.ts';
import { hashSeed, mulberry32, pick, range, type Rng } from './rng.ts';
import type { Deposit, MapData, MapSettings, MapType } from './types.ts';

export const MAP_SIZES = {
  small: { w: 52, h: 32, civs: 5, independents: 4 },
  standard: { w: 70, h: 44, civs: 8, independents: 7 },
  large: { w: 88, h: 54, civs: 11, independents: 10 },
  huge: { w: 106, h: 66, civs: 14, independents: 13 },
} as const;

export const MAP_TYPES: { id: MapType; name: string; note: string }[] = [
  { id: 'continents', name: 'Continents', note: '2–4 large landmasses split by ocean.' },
  { id: 'pangaea', name: 'Pangaea', note: 'One great landmass. Land war.' },
  { id: 'archipelago', name: 'Archipelago', note: 'Many islands. A sea game.' },
  { id: 'inland-sea', name: 'Inland Sea', note: 'A ring of land around a central sea.' },
  { id: 'highlands', name: 'Highlands', note: 'Mountain chains, valleys and passes.' },
  { id: 'random', name: 'Random', note: 'Any of the above, any settings.' },
];

type Concrete = Exclude<MapType, 'random'>;
const CONCRETE: Concrete[] = ['continents', 'pangaea', 'archipelago', 'inland-sea', 'highlands'];

const LAND_FRACTION: Record<Concrete, number> = {
  continents: 0.36,
  pangaea: 0.4,
  archipelago: 0.24,
  'inland-sea': 0.42,
  highlands: 0.46,
};

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

interface Blob {
  x: number;
  y: number;
  rx: number;
  ry: number;
  a: number;
}

function blobValue(b: Blob, u: number, v: number): number {
  const dx = (u - b.x) / b.rx,
    dy = (v - b.y) / b.ry;
  return b.a * (1 - Math.sqrt(dx * dx + dy * dy));
}

function shapeMask(type: Concrete, rng: Rng): (u: number, v: number) => number {
  switch (type) {
    case 'pangaea': {
      const b: Blob = {
        x: range(rng, 0.45, 0.55),
        y: range(rng, 0.45, 0.55),
        rx: 0.44,
        ry: 0.42,
        a: 1,
      };
      return (u, v) => blobValue(b, u, v);
    }
    case 'highlands': {
      const b: Blob = { x: 0.5, y: 0.5, rx: 0.5, ry: 0.46, a: 1 };
      return (u, v) => blobValue(b, u, v);
    }
    case 'continents': {
      const k = 2 + Math.floor(rng() * 3);
      const blobs: Blob[] = [];
      for (let i = 0; i < k; i++) {
        const x = (i + 0.5) / k + range(rng, -0.06, 0.06);
        // two-continent maps get tall landmasses; more continents alternate up and down
        const y =
          k === 2
            ? range(rng, 0.42, 0.58)
            : i % 2
              ? range(rng, 0.32, 0.45)
              : range(rng, 0.55, 0.68);
        blobs.push({ x, y, rx: 0.5 / k - 0.03, ry: k === 2 ? 0.4 : 0.3, a: 1 });
        if (k > 2) blobs.push({ x, y: 1 - y, rx: 0.4 / k, ry: 0.18, a: 0.75 });
      }
      return (u, v) => Math.max(...blobs.map(b => blobValue(b, u, v)));
    }
    case 'archipelago': {
      const blobs: Blob[] = [];
      const n = 18 + Math.floor(rng() * 12);
      for (let i = 0; i < n; i++) {
        const r = range(rng, 0.04, 0.1);
        blobs.push({
          x: range(rng, 0.08, 0.92),
          y: range(rng, 0.1, 0.9),
          rx: r,
          ry: r * range(rng, 0.8, 1.5),
          a: range(rng, 0.8, 1.1),
        });
      }
      return (u, v) => Math.max(-0.3, ...blobs.map(b => blobValue(b, u, v)));
    }
    case 'inland-sea': {
      const cx = range(rng, 0.45, 0.55),
        cy = range(rng, 0.45, 0.55);
      return (u, v) => {
        const d = Math.sqrt(((u - cx) / 0.5) ** 2 + ((v - cy) / 0.48) ** 2);
        return 1 - Math.abs(d - 0.6) / 0.28;
      };
    }
  }
}

const LEVEL = { low: 0, normal: 1, high: 2 } as const;

export function generateMap(s: MapSettings): MapData {
  const rng = mulberry32(hashSeed(s.seed, 1));
  const type: Concrete = s.type === 'random' ? pick(rng, CONCRETE) : s.type;
  const size = MAP_SIZES[s.size];
  const g: Grid = { w: size.w, h: size.h };
  const N = g.w * g.h;
  const [pxW, pxH] = pixelSizeUnit(g);

  const nElev = makeNoise(mulberry32(hashSeed(s.seed, 2)));
  const nRidge = makeNoise(mulberry32(hashSeed(s.seed, 3)));
  const nMoist = makeNoise(mulberry32(hashSeed(s.seed, 4)));
  const nTemp = makeNoise(mulberry32(hashSeed(s.seed, 5)));
  const nVeg = makeNoise(mulberry32(hashSeed(s.seed, 6)));
  const mask = shapeMask(type, mulberry32(hashSeed(s.seed, 7)));

  const U = new Float32Array(N),
    V = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const [x, y] = centerUnit(g, i);
    U[i] = x / pxW;
    V[i] = y / pxH;
  }
  // noise coordinates keep the map's aspect ratio so features are round, not stretched
  const aspect = pxW / pxH;
  const freq = type === 'archipelago' ? 5 : 3;

  // --- elevation and sea level ---
  const elev = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = U[i],
      v = V[i];
    const n = fbm(nElev, u * freq * aspect, v * freq, 5);
    const edge = Math.min(u, 1 - u, v, 1 - v);
    elev[i] = mask(u, v) * 0.9 + n * 0.55 - (1 - smooth(0, 0.07, edge)) * 1.2;
  }
  const landFrac = LAND_FRACTION[type] * [1.2, 1, 0.8][LEVEL[s.seaLevel]];
  const sorted = Array.from(elev).sort((a, b) => a - b);
  const seaThr = sorted[Math.floor((1 - landFrac) * N)];
  const land = new Uint8Array(N);
  for (let i = 0; i < N; i++) land[i] = elev[i] > seaThr ? 1 : 0;

  // --- relief ---
  const relief: ReliefId[] = new Array(N).fill('flat');
  const landIdx: number[] = [];
  for (let i = 0; i < N; i++) if (land[i]) landIdx.push(i);
  const ridgeScore = new Float32Array(N);
  for (const i of landIdx) {
    const r = ridged(nRidge, U[i] * 4 * aspect, V[i] * 4, 4);
    ridgeScore[i] = r * 0.75 + (elev[i] - seaThr) * 0.5;
  }
  const mtnMul = type === 'highlands' ? 1.8 : 1;
  const mtnFrac = [0.04, 0.07, 0.11][LEVEL[s.mountains]] * mtnMul;
  const hillFrac = [0.1, 0.15, 0.21][LEVEL[s.mountains]] * mtnMul;
  const byRidge = [...landIdx].sort((a, b) => ridgeScore[b] - ridgeScore[a]);
  const nM = Math.floor(byRidge.length * mtnFrac),
    nH = Math.floor(byRidge.length * (mtnFrac + hillFrac));
  for (let k = 0; k < byRidge.length; k++)
    relief[byRidge[k]] = k < nM ? 'mountains' : k < nH ? 'hills' : 'flat';

  // --- water bodies: ocean vs lakes ---
  const terrain: TerrainId[] = new Array(N).fill('ocean');
  const body = new Int32Array(N).fill(-1);
  const bodies: { size: number; edge: boolean }[] = [];
  for (let i = 0; i < N; i++) {
    if (land[i] || body[i] >= 0) continue;
    const id = bodies.length;
    const stack = [i];
    body[i] = id;
    let n = 0,
      edge = false;
    while (stack.length) {
      const j = stack.pop()!;
      n++;
      const c = col(g, j),
        r = row(g, j);
      if (c === 0 || r === 0 || c === g.w - 1 || r === g.h - 1) edge = true;
      for (const k of neighbors(g, j))
        if (!land[k] && body[k] < 0) {
          body[k] = id;
          stack.push(k);
        }
    }
    bodies.push({ size: n, edge });
  }

  // --- climate ---
  const climOff = [-0.12, 0, 0.12][LEVEL[s.climate]];
  const rainOff = [-0.14, 0, 0.14][LEVEL[s.rainfall]];
  const temp = new Float32Array(N),
    moist = new Float32Array(N);
  const nearWater = new Uint8Array(N);
  for (const i of landIdx) {
    for (const k of within(g, i, 2))
      if (!land[k]) {
        nearWater[i] = 1;
        break;
      }
  }
  for (const i of landIdx) {
    const lat = Math.abs(V[i] - 0.5) * 2;
    temp[i] =
      1 -
      lat * 1.1 +
      fbm(nTemp, U[i] * 3 * aspect, V[i] * 3, 3) * 0.12 +
      climOff -
      (relief[i] === 'mountains' ? 0.2 : relief[i] === 'hills' ? 0.08 : 0);
    const band = lat > 0.3 && lat < 0.55 ? -0.13 : lat < 0.18 ? 0.1 : 0;
    moist[i] =
      0.5 +
      fbm(nMoist, U[i] * 4 * aspect, V[i] * 4, 4) * 0.55 +
      rainOff +
      band +
      (nearWater[i] ? 0.1 : 0);
  }

  // --- rivers ---
  const riverTo = new Array<number>(N).fill(-1);
  const river = new Array<number>(N).fill(0);
  const lakeExtra = new Set<number>();
  const rRng = mulberry32(hashSeed(s.seed, 8));
  const sources = landIdx.filter(i => relief[i] !== 'flat' && moist[i] > 0.45 && temp[i] > 0.15);
  const nRivers = Math.round(landIdx.length / [90, 55, 38][LEVEL[s.rainfall]]);
  for (let k = 0; k < nRivers && sources.length; k++) {
    let cur = sources.splice(Math.floor(rRng() * sources.length), 1)[0];
    if (river[cur]) continue;
    const path: number[] = [cur];
    let ok = false;
    for (let step = 0; step < 80; step++) {
      let best = -1,
        be = elev[cur];
      for (const n of neighbors(g, cur)) {
        if (!land[n] || lakeExtra.has(n)) {
          best = n;
          be = -Infinity;
          break;
        }
        if (elev[n] < be) {
          be = elev[n];
          best = n;
        }
      }
      if (best < 0) {
        // a pit: it becomes a lake if the river is long enough to matter
        if (path.length >= 4) {
          lakeExtra.add(cur);
          path.pop();
          ok = true;
        }
        break;
      }
      if (!land[best] || lakeExtra.has(best)) {
        ok = true;
        riverTo[cur] = best;
        break;
      }
      riverTo[cur] = best;
      if (river[best]) {
        ok = true;
        path.push(best);
        break;
      } // joins an existing river
      cur = best;
      path.push(cur);
    }
    if (!ok || path.length < 3) {
      for (const p of path) if (!river[p]) riverTo[p] = -1;
      continue;
    }
    // add flow along the whole course down to the sea
    let p = path[0];
    for (let guard = 0; p >= 0 && land[p] && !lakeExtra.has(p) && guard < 200; guard++) {
      river[p] += 1;
      p = riverTo[p];
    }
  }
  for (const i of lakeExtra) {
    land[i] = 0;
    relief[i] = 'flat';
    river[i] = 0;
  }

  // --- terrain and vegetation ---
  // biomes by share of the land, so every map has its cold north, its deserts and its green
  // middle; the climate and rainfall settings move the bands
  const landCells: number[] = [];
  for (let i = 0; i < N; i++) if (land[i]) landCells.push(i);
  const quant = (arr: ArrayLike<number>, q: number) => {
    const v = landCells.map(i => arr[i]).sort((a, b) => a - b);
    return v.length ? v[Math.min(v.length - 1, Math.floor(q * v.length))] : 0;
  };
  const cl = LEVEL[s.climate],
    rf = LEVEL[s.rainfall];
  const tSnow = quant(temp, [0.08, 0.05, 0.02][cl]);
  const tTundra = quant(temp, [0.24, 0.15, 0.08][cl]);
  const tWarm = quant(temp, [0.45, 0.32, 0.22][cl]);
  const mDesert = quant(moist, [0.38, 0.27, 0.17][rf]);
  const mPlains = quant(moist, [0.55, 0.45, 0.35][rf]);
  const tJungle = quant(temp, 0.82);
  const vegetation: VegetationId[] = new Array(N).fill('none');
  for (let i = 0; i < N; i++) {
    if (!land[i]) {
      if (lakeExtra.has(i)) {
        terrain[i] = 'lake';
        continue;
      }
      const b = bodies[body[i]];
      if (b && !b.edge && b.size <= 14) {
        terrain[i] = 'lake';
        continue;
      }
      terrain[i] = neighbors(g, i).some(k => land[k]) ? 'coast' : 'ocean';
      continue;
    }
    const t = temp[i],
      m = moist[i];
    let ter: TerrainId;
    if (t < tSnow) ter = 'snow';
    else if (t < tTundra) ter = 'tundra';
    else if (m < mDesert && t > tWarm) ter = 'desert';
    else if (m < mPlains) ter = 'plains';
    else ter = 'grassland';
    if (river[i] && ter === 'desert' && m > 0.2) ter = 'plains';
    terrain[i] = ter;
    if (relief[i] === 'mountains' || ter === 'snow' || ter === 'desert') continue;
    const vn = fbm(nVeg, U[i] * 7 * aspect, V[i] * 7, 3);
    const score = m + vn * 0.35;
    const wetFlat = relief[i] === 'flat' && (river[i] > 0 || nearWater[i]);
    if (wetFlat && m > 0.68 && vn > 0.12) vegetation[i] = 'marsh';
    else if (t > tJungle && score > 0.62) vegetation[i] = 'jungle';
    else if (score > (ter === 'tundra' ? 0.52 : 0.6)) vegetation[i] = 'forest';
  }

  // --- deposits ---
  const dRng = mulberry32(hashSeed(s.seed, 9));
  const deposit: (Deposit | null)[] = new Array(N).fill(null);
  const pLand = [0.035, 0.055, 0.085][LEVEL[s.resources]];
  const pWater = [0.04, 0.06, 0.09][LEVEL[s.resources]];
  for (let i = 0; i < N; i++) {
    const t = terrain[i];
    if (t === 'ocean') continue;
    if (dRng() > (isWater(t) ? pWater : pLand)) continue;
    const kind = pickDeposit(dRng, t, relief[i], vegetation[i]);
    if (!kind) continue;
    const r = dRng();
    deposit[i] = { kind, richness: r < 0.6 ? 1 : r < 0.9 ? 2 : 3 };
  }

  const map: MapData = {
    w: g.w,
    h: g.h,
    type,
    terrain,
    relief,
    vegetation,
    elevation: Array.from(elev, e => Math.round((e - seaThr) * 1000) / 1000),
    riverTo,
    river,
    deposit,
    starts: [],
  };
  map.starts = placeStarts(map, MAP_SIZES[s.size].civs + MAP_SIZES[s.size].independents, mulberry32(hashSeed(s.seed, 10)));
  return map;
}

export function validDeposits(t: TerrainId, rel: ReliefId, veg: VegetationId): string[] {
  return Object.entries(DEPOSITS)
    .filter(
      ([, d]) =>
        d.terrain.includes(t) &&
        (!d.relief || d.relief.includes(rel)) &&
        (!d.vegetation || d.vegetation.includes(veg)),
    )
    .map(([k]) => k);
}

function pickDeposit(r: Rng, t: TerrainId, rel: ReliefId, veg: VegetationId): string | null {
  if (rel === 'mountains') return null;
  const ok = validDeposits(t, rel, veg);
  if (!ok.length) return null;
  let total = 0;
  for (const k of ok) total += DEPOSITS[k].weight;
  let x = r() * total;
  for (const k of ok) {
    x -= DEPOSITS[k].weight;
    if (x <= 0) return k;
  }
  return ok[ok.length - 1];
}

/** Food a hex gives a city that works it (placeholder until districts). */
export function hexFood(m: MapData, i: number): number {
  return TERRAIN[m.terrain[i]].food + VEGETATION[m.vegetation[i]].food + (m.river[i] ? 1 : 0);
}

export const isLand = (m: MapData, i: number) => !isWater(m.terrain[i]);
export const isPassableLand = (m: MapData, i: number) =>
  isLand(m, i) && m.relief[i] !== 'mountains';

function landmassSizes(m: MapData): Int32Array {
  const g = { w: m.w, h: m.h };
  const N = m.w * m.h;
  const id = new Int32Array(N).fill(-1);
  const sizes: number[] = [];
  for (let i = 0; i < N; i++) {
    if (!isPassableLand(m, i) || id[i] >= 0) continue;
    const k = sizes.length;
    const st = [i];
    id[i] = k;
    let n = 0;
    while (st.length) {
      const j = st.pop()!;
      n++;
      for (const q of neighbors(g, j))
        if (isPassableLand(m, q) && id[q] < 0) {
          id[q] = k;
          st.push(q);
        }
    }
    sizes.push(n);
  }
  const out = new Int32Array(N);
  for (let i = 0; i < N; i++) out[i] = id[i] >= 0 ? sizes[id[i]] : 0;
  return out;
}

/** Farthest-point sampling over good start hexes, then top up each start so all are comparable. */
function placeStarts(m: MapData, count: number, r: Rng): number[] {
  const g = { w: m.w, h: m.h };
  const N = m.w * m.h;
  const mass = landmassSizes(m);
  const score = new Float32Array(N);
  const cands: number[] = [];
  for (
    let minMass = 40;
    minMass >= 8 && cands.length < count * 4;
    minMass = Math.floor(minMass / 2)
  ) {
    cands.length = 0;
    for (let i = 0; i < N; i++) {
      if (!isPassableLand(m, i) || mass[i] < minMass) continue;
      const t = m.terrain[i];
      if (t === 'snow' || t === 'desert' || t === 'tundra' || m.vegetation[i] === 'marsh') continue;
      const c = col(g, i),
        rr = row(g, i);
      if (c < 3 || rr < 3 || c > g.w - 4 || rr > g.h - 4) continue;
      let s = 0,
        landN = 0;
      for (const k of within(g, i, 2)) {
        s += hexFood(m, k) + (m.deposit[k] ? 1 : 0);
        if (isLand(m, k)) landN++;
      }
      if (landN < 10) continue;
      score[i] =
        s +
        (neighbors(g, i).some(k => m.terrain[k] === 'coast') ? 1.5 : 0) +
        (m.river[i] ? 1.5 : 0) +
        r() * 0.5;
      cands.push(i);
    }
  }
  if (!cands.length) return [];
  let maxS = 0;
  for (const i of cands) maxS = Math.max(maxS, score[i]);
  const chosen: number[] = [];
  const spread = Math.sqrt((g.w * g.h) / count);
  let first = cands[0];
  for (const i of cands) if (score[i] > score[first]) first = i;
  chosen.push(first);
  // keep neighbours apart; if the land cannot hold everyone that far apart, close ranks
  let minGap = Math.max(4, Math.floor(spread * 0.6));
  while (chosen.length < count) {
    let best = -1,
      bv = -Infinity;
    for (const i of cands) {
      let dmin = Infinity;
      for (const c of chosen) dmin = Math.min(dmin, distance(g, i, c));
      if (dmin < minGap) continue;
      const v = Math.min(dmin, spread * 1.2) / spread + (score[i] / maxS) * 0.5;
      if (v > bv) {
        bv = v;
        best = i;
      }
    }
    if (best < 0) {
      if (minGap <= 4) break;
      minGap--;
      continue;
    }
    chosen.push(best);
  }
  for (const s of chosen) balanceStart(m, s, r);
  evenStarts(m, chosen, r);
  return chosen;
}

/** What a start is worth: food in reach, open land around it, deposits. */
export function startValue(m: MapData, s: number): number {
  const g = { w: m.w, h: m.h };
  let v = 0;
  for (const k of within(g, s, 3)) {
    const d = distance(g, s, k);
    if (d <= 2) v += hexFood(m, k) + (m.deposit[k] ? 1 : 0);
    if (isPassableLand(m, k)) v += 0.3;
  }
  return v;
}

/** Lift any start well below the median: soften the poorest land near it, then add food. */
function evenStarts(m: MapData, starts: number[], r: Rng) {
  if (starts.length < 2) return;
  const g = { w: m.w, h: m.h };
  const vals = starts.map(s => startValue(m, s)).sort((a, b) => a - b);
  const median = vals[Math.floor(vals.length / 2)];
  const better: Partial<Record<TerrainId, TerrainId>> = {
    desert: 'plains',
    tundra: 'plains',
    snow: 'tundra',
  };
  for (const s of starts) {
    for (let tries = 0; tries < 30 && startValue(m, s) < median * 0.85; tries++) {
      const ring = within(g, s, 2).filter(k => k !== s && isPassableLand(m, k));
      const poor = ring
        .filter(k => better[m.terrain[k]] || m.vegetation[k] === 'marsh')
        .sort((a, b) => hexFood(m, a) - hexFood(m, b))[0];
      if (poor !== undefined) {
        if (m.vegetation[poor] === 'marsh') m.vegetation[poor] = 'none';
        else m.terrain[poor] = better[m.terrain[poor]]!;
        continue;
      }
      const plain = ring.find(k => m.terrain[k] === 'plains' && !m.deposit[k]);
      if (plain !== undefined) {
        m.terrain[plain] = 'grassland';
        continue;
      }
      const bare = shuffleCopy(
        r,
        ring.filter(k => !m.deposit[k] && m.relief[k] !== 'mountains'),
      );
      const k = bare.find(k =>
        validDeposits(m.terrain[k], m.relief[k], m.vegetation[k]).some(d =>
          ['wheat', 'cattle', 'pigs', 'rice', 'sheep', 'game', 'fish'].includes(d),
        ),
      );
      if (k === undefined) break;
      const kinds = validDeposits(m.terrain[k], m.relief[k], m.vegetation[k]).filter(d =>
        ['wheat', 'cattle', 'pigs', 'rice', 'sheep', 'game', 'fish'].includes(d),
      );
      m.deposit[k] = { kind: pick(r, kinds), richness: 1 };
    }
  }
}

/** Make sure every start has wood, a food deposit and a metal or horses nearby. */
function balanceStart(m: MapData, s: number, r: Rng) {
  const g = { w: m.w, h: m.h };
  const ring2 = within(g, s, 2).filter(k => k !== s);
  const ring4 = within(g, s, 4).filter(k => distance(g, s, k) >= 2);
  const has = (hexes: number[], kinds: string[]) =>
    hexes.some(k => m.deposit[k] && kinds.includes(m.deposit[k]!.kind));
  // the start hex itself stays clear for a city
  m.deposit[s] = null;
  if (m.vegetation[s] !== 'none') m.vegetation[s] = 'none';

  if (!ring2.some(k => m.vegetation[k] === 'forest' || m.vegetation[k] === 'jungle')) {
    const k = ring2.find(
      k =>
        isPassableLand(m, k) &&
        m.vegetation[k] === 'none' &&
        !m.deposit[k] &&
        m.terrain[k] !== 'desert' &&
        m.terrain[k] !== 'snow',
    );
    if (k !== undefined) m.vegetation[k] = 'forest';
  }
  const plant = (hexes: number[], kinds: string[]) => {
    const opts = hexes.filter(k => !m.deposit[k] && m.relief[k] !== 'mountains');
    for (const k of shuffleCopy(r, opts)) {
      const ok = validDeposits(m.terrain[k], m.relief[k], m.vegetation[k]).filter(d =>
        kinds.includes(d),
      );
      if (ok.length) {
        m.deposit[k] = { kind: pick(r, ok), richness: 1 };
        return true;
      }
    }
    return false;
  };
  if (!has(ring2, ['wheat', 'rice', 'cattle', 'pigs', 'fish', 'sheep', 'game']))
    plant(ring2, ['wheat', 'cattle', 'pigs', 'fish', 'rice']);
  if (!has(ring4, ['copper', 'tin', 'stone'])) {
    // make a hill to hold a metal if there is none
    if (!plant(ring4, ['copper', 'stone'])) {
      const k = ring4.find(
        k =>
          isPassableLand(m, k) &&
          m.relief[k] === 'flat' &&
          !m.deposit[k] &&
          m.terrain[k] !== 'snow',
      );
      if (k !== undefined) {
        m.relief[k] = 'hills';
        m.vegetation[k] = 'none';
        m.deposit[k] = { kind: 'copper', richness: 1 };
      }
    }
  }
  if (!has(ring4, ['horses'])) plant(ring4, ['horses']);
}

function shuffleCopy<T>(r: Rng, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
