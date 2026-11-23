/**
 * Draws the map on a 2D canvas each time something changes: parchment, watercolour terrain
 * washes, ink coastlines and rivers, terrain symbols, deposits, borders, fog, cities, formations.
 */
import { GOODS, DEPOSITS } from '../data/goods.ts';
import { fx, Motion, reducedMotion } from './fx.ts';
import { TERRAIN, isWater } from '../data/terrain.ts';
import { depositVisible, pathTurns, territory, visibleHexes } from '../engine/game.ts';
import {
  centerUnit,
  distance,
  hexAtUnit,
  neighbors,
  pixelSizeUnit,
  row as rowOf,
  type Grid,
} from '../engine/hex.ts';
import type { GameState } from '../engine/types.ts';
import { formationArtKey, formationSprite } from '../engine/units.ts';
import type { Assets } from './assets.ts';

export const R = 36; // hex radius in world pixels at zoom 1

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface Overlay {
  selectedFormation?: number;
  selectedHex?: number;
  hoverHex?: number;
  reach?: Set<number>;
  path?: number[];
  /** adjacent enemy the selected formation would attack */
  target?: number;
}

const INK = '#4a321e';
const CORNERS = Array.from({ length: 6 }, (_, i) => {
  const a = ((60 * i - 30) * Math.PI) / 180;
  return [Math.cos(a), Math.sin(a)] as const;
});
// neighbour order from hex.ts is E, NE, NW, W, SW, SE; the shared edge for each runs between these corners
const EDGE_CORNERS: [number, number][] = [
  [0, 1],
  [5, 0],
  [4, 5],
  [3, 4],
  [2, 3],
  [1, 2],
];

function hash(i: number, k: number): number {
  let h = Math.imul(i ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul(k + 1, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

export class MapRenderer {
  private ctx: CanvasRenderingContext2D;
  private pattern: CanvasPattern | null = null;
  private canvas: HTMLCanvasElement;
  private assets: Assets;
  cam: Camera = { x: 0, y: 0, zoom: 1 };
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement, assets: Assets) {
    this.canvas = canvas;
    this.assets = assets;
    this.ctx = canvas.getContext('2d')!;
    const p = assets.img['parchment'];
    if (p) this.pattern = this.ctx.createPattern(p, 'repeat');
  }

  resize(w: number, h: number) {
    // keep the same world point in the middle of the screen
    if (this.canvas.width > 0) {
      this.cam.x += (this.viewW - w) / 2 / this.cam.zoom;
      this.cam.y += (this.viewH - h) / 2 / this.cam.zoom;
    }
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  get viewW() {
    return this.canvas.width / this.dpr;
  }
  get viewH() {
    return this.canvas.height / this.dpr;
  }

  worldSize(s: GameState): [number, number] {
    const [w, h] = pixelSizeUnit({ w: s.map.w, h: s.map.h });
    return [w * R, h * R];
  }

  /** Put `hex` in the middle of the part of the screen the interface does not cover. */
  centerOn(s: GameState, hex: number, ins: Insets = NO_INSETS) {
    const [x, y] = centerUnit({ w: s.map.w, h: s.map.h }, hex);
    const cxs = ins.left + (this.viewW - ins.left - ins.right) / 2;
    const cys = ins.top + (this.viewH - ins.top - ins.bottom) / 2;
    this.cam.x = x * R - cxs / this.cam.zoom;
    this.cam.y = y * R - cys / this.cam.zoom;
  }

  /** The part of the world on screen, in hex-radius units: x0, y0, x1, y1. */
  viewRect(): [number, number, number, number] {
    const z = this.cam.zoom;
    return [
      this.cam.x / R,
      this.cam.y / R,
      (this.cam.x + this.viewW / z) / R,
      (this.cam.y + this.viewH / z) / R,
    ];
  }

  hexAtScreen(s: GameState, sx: number, sy: number): number {
    const wx = this.cam.x + sx / this.cam.zoom,
      wy = this.cam.y + sy / this.cam.zoom;
    return hexAtUnit({ w: s.map.w, h: s.map.h }, wx / R, wy / R);
  }

  /** true once a finger has touched the map: zoom stops before hexes get too small to tap */
  coarse = false;

  zoomAt(sx: number, sy: number, factor: number) {
    const z0 = this.cam.zoom;
    const minZ = this.coarse ? 0.55 : 0.3;
    const z1 = Math.min(2.4, Math.max(minZ, z0 * factor));
    const wx = this.cam.x + sx / z0,
      wy = this.cam.y + sy / z0;
    this.cam.zoom = z1;
    this.cam.x = wx - sx / z1;
    this.cam.y = wy - sy / z1;
  }

  /** Keep the map on screen; a map smaller than the view is centred; covered edges can scroll clear. */
  clamp(s: GameState, ins: Insets = NO_INSETS) {
    const [W, H] = this.worldSize(s);
    const z = this.cam.zoom;
    const fit = (pos: number, world: number, view: number, lo: number, hi: number) => {
      const visible = (view - lo - hi) / z;
      if (world <= visible) return (world - visible) / 2 - lo / z;
      const m = 80 / z;
      return Math.min(Math.max(pos, -m - lo / z), world - view / z + m + hi / z);
    };
    this.cam.x = fit(this.cam.x, W, this.viewW, ins.left, ins.right);
    this.cam.y = fit(this.cam.y, H, this.viewH, ins.top, ins.bottom);
  }

  // static layers are painted once into tiles and reused while nothing on them changes
  private chunks = new Map<string, HTMLCanvasElement>();
  private chunkKey = '';
  private lastZoom = 0;
  private zoomedAt = 0;
  private lastRes = 0;
  private motion = new Motion();
  private motionGame: GameState | null = null;
  private selId: number | undefined;
  private selAt = 0;
  /** true while a tween or an effect is playing: the view wants another frame */
  wantsFrame = false;
  /** the caller should redraw shortly: tiles will be rebuilt sharp after a zoom */
  wantsSettle = false;
  static CHUNK = 640;

  /** Changes whenever something drawn in the static layers changes. */
  private staticKey(s: GameState, civId: number, vis: Uint8Array): string {
    const civ = s.civs[civId];
    let v = 0,
      e = 0,
      r = 0;
    for (let i = 0; i < vis.length; i++) {
      if (vis[i]) v = (v * 31 + i) | 0;
      if (civ.explored[i]) e++;
      if (s.roads[i]) r = (r * 17 + i) | 0;
    }
    const c = s.cities.map(x => `${x.hex}:${x.civId}`).join(',');
    return `${civId}|${v}|${e}|${r}|${c}|${civ.techs.length}|${s.map.vegetation.length}`;
  }

  draw(s: GameState, civId: number, ov: Overlay) {
    const ctx = this.ctx;
    const g: Grid = { w: s.map.w, h: s.map.h };
    const { zoom } = this.cam;
    const vis = visibleHexes(s, civId);
    let own: Int16Array | null = null;
    const ownership = () => (own ??= territory(s));

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    // screen shake: offset grows with trauma squared, a smooth wobble rather than noise
    const tr = fx.currentTrauma();
    const t = performance.now() / 1000;
    const shX = tr > 0 ? tr * tr * 9 * Math.sin(t * 47) : 0,
      shY = tr > 0 ? tr * tr * 7 * Math.cos(t * 39) : 0;
    ctx.setTransform(
      this.dpr * zoom,
      0,
      0,
      this.dpr * zoom,
      (-this.cam.x * zoom + shX) * this.dpr,
      (-this.cam.y * zoom + shY) * this.dpr,
    );
    if (this.motionGame !== s) {
      this.motion.reset();
      this.motionGame = s;
    }
    if (ov.selectedFormation !== this.selId) {
      this.selId = ov.selectedFormation;
      this.selAt = performance.now();
    }

    const key = this.staticKey(s, civId, vis);
    if (key !== this.chunkKey) {
      this.chunks.clear();
      this.chunkKey = key;
    }
    // tiles are drawn at the screen's own pixel scale so copying them needs no scaling; while
    // the zoom is changing the last tiles are stretched, and sharpened once it settles
    const exact = Math.min(3, Math.max(0.25, Math.round(zoom * this.dpr * 8) / 8));
    const now = performance.now();
    if (zoom !== this.lastZoom) {
      this.lastZoom = zoom;
      this.zoomedAt = now;
    }
    const settling = now - this.zoomedAt < 180 && this.lastRes > 0;
    const res = settling ? this.lastRes : exact;
    this.lastRes = res;
    this.wantsSettle = settling;
    const C = MapRenderer.CHUNK;
    const vx1 = this.cam.x + this.viewW / zoom,
      vy1 = this.cam.y + this.viewH / zoom;
    for (let ty = Math.floor(this.cam.y / C); ty <= Math.floor(vy1 / C); ty++)
      for (let tx = Math.floor(this.cam.x / C); tx <= Math.floor(vx1 / C); tx++) {
        const k = `${tx},${ty},${res}`;
        let tile = this.chunks.get(k);
        if (!tile) {
          tile = this.renderChunk(s, civId, ov, vis, ownership(), tx, ty, res);
          this.chunks.set(k, tile);
          // keep memory in check: drop the oldest tiles
          if (this.chunks.size > 60) this.chunks.delete(this.chunks.keys().next().value!);
        }
        ctx.drawImage(tile, tx * C, ty * C, C, C);
      }

    const pad = R * 2;
    const onScreen = hexesIn(g, this.cam.x - pad, this.cam.y - pad, vx1 + pad, vy1 + pad);
    this.paint(s, civId, ov, onScreen, vis, ownership(), false, zoom);
    const playing = fx.tick();
    this.drawFx(s, vis);
    const popping = performance.now() - this.selAt < 220;
    this.wantsFrame = playing || this.motion.active || popping;
  }

  /** Battle flashes and floating numbers above the map. */
  private drawFx(s: GameState, vis: Uint8Array) {
    const ctx = this.ctx;
    const g: Grid = { w: s.map.w, h: s.map.h };
    for (const f of fx.flashes) {
      if (!vis[f.hex]) continue;
      const x = centerUnit(g, f.hex)[0] * R,
        y = centerUnit(g, f.hex)[1] * R;
      const k = fx.flashAge(f);
      ctx.globalAlpha = (1 - k) * 0.75;
      ctx.fillStyle = f.color;
      this.hexPath(x, y, R * (0.9 + k * 0.25));
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const f of fx.floats) {
      if (!vis[f.hex]) continue;
      const x = centerUnit(g, f.hex)[0] * R,
        y = centerUnit(g, f.hex)[1] * R;
      const k = fx.floatAge(f);
      const rise = reducedMotion() ? 0 : (1 - (1 - k) ** 2) * R * 0.9;
      // pop in, hold, fade out
      const scale =
        k < 0.12 ? 0.6 + (k / 0.12) * 0.5 : k < 0.25 ? 1.1 - ((k - 0.12) / 0.13) * 0.1 : 1;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = `bold ${R * 0.42 * scale}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(30,18,8,0.85)';
      ctx.strokeText(f.text, x + f.dx * R, y - R * 0.7 - rise);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x + f.dx * R, y - R * 0.7 - rise);
      ctx.globalAlpha = 1;
    }
  }

  private renderChunk(
    s: GameState,
    civId: number,
    ov: Overlay,
    vis: Uint8Array,
    own: Int16Array,
    tx: number,
    ty: number,
    res: number,
  ) {
    const C = MapRenderer.CHUNK;
    const cv = document.createElement('canvas');
    cv.width = cv.height = Math.ceil(C * res);
    const cctx = cv.getContext('2d')!;
    cctx.setTransform(res, 0, 0, res, -tx * C * res, -ty * C * res);
    if (this.pattern) {
      cctx.fillStyle = this.pattern;
      cctx.fillRect(tx * C, ty * C, C, C);
    }
    // hexes whose drawings can reach into this tile (sprites stick out of their hex)
    const pad = R * 2.2;
    const list = hexesIn(
      { w: s.map.w, h: s.map.h },
      tx * C - pad,
      ty * C - pad,
      (tx + 1) * C + pad,
      (ty + 1) * C + pad,
    );
    const saved = this.ctx;
    this.ctx = cctx;
    try {
      this.paint(s, civId, ov, list, vis, own, true, res / this.dpr);
    } finally {
      this.ctx = saved;
    }
    return cv;
  }

  /** Paint either the static layers (into a tile) or the moving ones (on screen) for the given hexes. */
  private paint(
    s: GameState,
    civId: number,
    ov: Overlay,
    onScreen: number[],
    vis: Uint8Array,
    own: Int16Array,
    STATIC: boolean,
    zoom: number,
  ) {
    const ctx = this.ctx;
    const g: Grid = { w: s.map.w, h: s.map.h };
    const m = s.map;
    const civ = s.civs[civId];
    const known = (i: number) => civ.explored[i] === 1;
    const cx = (i: number) => centerUnit(g, i)[0] * R;
    const cy = (i: number) => centerUnit(g, i)[1] * R;
    const img = this.assets.img;
    // generated miniatures first, built-in art otherwise
    const unitKey = (f: (typeof s.formations)[number]) => {
      const k = `art:${formationArtKey(f)}`;
      return img[k] ? k : spriteKey(formationSprite(f));
    };
    const sprite = (key: string, x: number, y: number, w: number) => {
      const im = img[key];
      if (!im) return;
      // generated miniatures are sized by height (their widths vary), built-in art by width
      if (
        key.startsWith('art:unit/') ||
        key.startsWith('art:ship/') ||
        key.startsWith('art:city/')
      ) {
        const hh = w * (key.startsWith('art:city/') ? 0.9 : 1.05);
        const ww = (im.naturalWidth / im.naturalHeight) * hh;
        ctx.drawImage(im, x - ww / 2, y - hh, ww, hh);
        return;
      }
      const h = (im.naturalHeight / im.naturalWidth) * w;
      ctx.drawImage(im, x - w / 2, y - h, w, h);
    };

    if (STATIC) {
      // 1. watercolour washes: the terrain, then what covers it (rock, forest, jungle, marsh)
      for (const i of onScreen) {
        if (!known(i)) continue;
        const mountain = m.relief[i] === 'mountains';
        ctx.fillStyle = mountain
          ? m.terrain[i] === 'snow'
            ? '#c9c7c2'
            : '#a7a29a'
          : TERRAIN[m.terrain[i]].wash;
        ctx.globalAlpha = isWater(m.terrain[i]) ? 0.85 : mountain ? 0.95 : 0.82;
        this.hexPath(cx(i), cy(i), R * 1.02);
        ctx.fill();
        const tint = mountain
          ? null
          : m.vegetation[i] === 'jungle'
            ? 'rgba(40,92,44,0.34)'
            : m.vegetation[i] === 'forest'
              ? 'rgba(62,98,50,0.22)'
              : m.vegetation[i] === 'marsh'
                ? 'rgba(70,112,110,0.26)'
                : m.relief[i] === 'hills'
                  ? 'rgba(120,92,52,0.16)'
                  : null;
        if (tint) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = tint;
          this.hexPath(cx(i), cy(i), R * 1.02);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // 2. faint hex grid on land
      if (zoom > 0.55) {
        ctx.strokeStyle = 'rgba(74,50,30,0.13)';
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();
        for (const i of onScreen)
          if (known(i) && !isWater(m.terrain[i])) this.hexSubPath(cx(i), cy(i), R);
        ctx.stroke();
      }

      // 3. coastlines with water-lining
      for (const pass of [0, 1]) {
        ctx.beginPath();
        for (const i of onScreen) {
          if (!known(i) || isWater(m.terrain[i])) continue;
          const ns = neighborsByDir(g, i);
          for (let d = 0; d < 6; d++) {
            const n = ns[d];
            if (n < 0 || !isWater(m.terrain[n])) continue;
            const [a, b] = EDGE_CORNERS[d];
            const off = pass === 0 ? 1 : 1.13;
            ctx.moveTo(cx(i) + CORNERS[a][0] * R * off, cy(i) + CORNERS[a][1] * R * off);
            ctx.lineTo(cx(i) + CORNERS[b][0] * R * off, cy(i) + CORNERS[b][1] * R * off);
          }
        }
        ctx.strokeStyle = pass === 0 ? INK : 'rgba(60,90,110,0.35)';
        ctx.lineWidth = pass === 0 ? 1.8 : 1.2;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // 4. rivers
      ctx.strokeStyle = '#4b7a97';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const i of onScreen) {
        if (!known(i) || !m.river[i]) continue;
        const to = m.riverTo[i];
        if (to < 0) continue;
        const ax = cx(i),
          ay = cy(i);
        let bx = cx(to),
          by = cy(to);
        if (isWater(m.terrain[to])) {
          bx = (ax + bx) / 2;
          by = (ay + by) / 2;
        }
        const bend = (hash(i, 9) - 0.5) * R * 0.35;
        const mx = (ax + bx) / 2 + ((by - ay) / R) * bend * 0.6,
          my = (ay + by) / 2 - ((bx - ax) / R) * bend * 0.6;
        ctx.lineWidth = Math.min(5, 1.4 + m.river[i] * 0.45);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(mx, my, bx, by);
        ctx.stroke();
      }

      // 5. terrain symbols, drawn top to bottom so lower ones overlap
      for (const i of onScreen) {
        if (!known(i)) continue;
        const x = cx(i),
          y = cy(i);
        const rel = m.relief[i],
          veg = m.vegetation[i],
          ter = m.terrain[i];
        // generated terrain symbols, if the art set has them (see art/PROMPTS.md)
        const extra = (prefix: string, n: number, salt: number) => {
          const k = `art:terrain/${prefix}-${Math.floor(hash(i, salt) * n)}`;
          return img[k] ? k : null;
        };
        if (isWater(ter)) {
          const w =
            hash(i, 40) > 0.82
              ? Math.abs(rowOf(g, i) / g.h - 0.5) > 0.42
                ? extra('ice', 3, 41)
                : extra('waves', 4, 41)
              : null;
          if (w) sprite(w, x, y + R * 0.2, R * 0.7);
          continue;
        }
        if (rel === 'mountains') {
          // impassable: a tall peak that reads at any zoom
          const snowy = (ter === 'snow' || ter === 'tundra') && extra('snowpeak', 4, 1);
          if (snowy) sprite(snowy, x - R * 0.12, y + R * 0.15, R * 1.45);
          else {
            this.peak(
              x - R * 0.12,
              y + R * 0.55,
              R * (0.95 + hash(i, 1) * 0.15),
              R * (1.15 + hash(i, 2) * 0.2),
            );
            if (hash(i, 3) > 0.35) this.peak(x + R * 0.38, y + R * 0.62, R * 0.6, R * 0.7);
          }
          continue;
        }
        if (rel === 'hills') {
          sprite(`hill-${Math.floor(hash(i, 1) * 6)}`, x - R * 0.2, y + R * 0.05, R * 1.05);
          if (veg === 'none')
            sprite(`hill-${Math.floor(hash(i, 4) * 6)}`, x + R * 0.3, y + R * 0.45, R * 0.8);
        }
        const jungle = veg === 'jungle' && extra('jungle', 4, 12);
        if (jungle) {
          sprite(jungle, x - R * 0.2, y + R * 0.2, R * 0.85);
          sprite(extra('jungle', 4, 13) ?? jungle, x + R * 0.3, y + R * 0.5, R * 0.75);
        } else if (veg === 'forest' || veg === 'jungle') {
          const kind =
            veg === 'jungle'
              ? 'palm'
              : ter === 'tundra' || ter === 'snow'
                ? 'conifer'
                : hash(i, 5) > 0.7
                  ? 'conifer'
                  : 'tree';
          const n = rel === 'hills' ? 2 : 4;
          const spots = [
            [-0.35, -0.05],
            [0.25, -0.15],
            [-0.05, 0.4],
            [0.42, 0.35],
          ];
          for (let k = 0; k < n; k++) {
            const [ox, oy] = spots[k];
            sprite(
              `${kind}-${Math.floor(hash(i, 10 + k) * 8)}`,
              x + ox * R + (hash(i, 20 + k) - 0.5) * R * 0.15,
              y + oy * R + R * 0.25,
              R * (0.5 + hash(i, 30 + k) * 0.12),
            );
          }
        } else if (veg === 'marsh') {
          sprite(`marsh-${Math.floor(hash(i, 6) * 4)}`, x, y + R * 0.4, R * 0.9);
        } else if (ter === 'desert' && rel === 'flat') {
          const dune = hash(i, 7) > 0.6 && extra('dune', 4, 8);
          if (dune) sprite(dune, x, y + R * 0.3, R * 0.75);
          else this.dunes(x, y, hash(i, 8));
        } else if (ter === 'snow' && rel === 'flat') {
          this.drifts(x, y, hash(i, 8));
        } else if (ter === 'tundra' && rel === 'flat' && veg === 'none') {
          const sh = hash(i, 7) > 0.5 && extra('tundra', 4, 8);
          if (sh) sprite(sh, x, y + R * 0.35, R * 0.6);
          else this.tufts(x, y, hash(i, 8));
        } else if (m.river[i] && rel === 'flat' && veg === 'none' && hash(i, 7) > 0.6) {
          const reed = extra('reeds', 3, 8);
          if (reed) sprite(reed, x + R * 0.3, y + R * 0.45, R * 0.45);
        }
      }

      // 5b. roads
      ctx.lineCap = 'round';
      for (const pass of [0, 1]) {
        ctx.strokeStyle = pass === 0 ? 'rgba(74,50,30,0.75)' : 'rgba(214,186,140,0.95)';
        ctx.lineWidth = pass === 0 ? 4.5 : 2;
        ctx.beginPath();
        for (const i of onScreen) {
          if (!known(i) || !s.roads[i]) continue;
          let linked = false;
          for (const n of neighbors(g, i)) {
            if (!s.roads[n] || !known(n)) continue;
            linked = true;
            if (n < i) continue;
            ctx.moveTo(cx(i), cy(i));
            ctx.lineTo(cx(n), cy(n));
          }
          if (!linked) {
            ctx.moveTo(cx(i) - R * 0.2, cy(i));
            ctx.lineTo(cx(i) + R * 0.2, cy(i));
          }
        }
        ctx.stroke();
      }

      // 5c. railways: a dark iron line with light sleepers over the road
      for (const pass of [0, 1]) {
        ctx.strokeStyle = pass === 0 ? 'rgba(38,34,32,0.95)' : 'rgba(236,226,204,0.95)';
        ctx.lineWidth = pass === 0 ? 3.2 : 1.4;
        ctx.setLineDash(pass === 0 ? [] : [1.5, 3.5]);
        ctx.beginPath();
        for (const i of onScreen) {
          if (!known(i) || s.roads[i] !== 2) continue;
          for (const n of neighbors(g, i)) {
            if (s.roads[n] !== 2 || !known(n) || n < i) continue;
            ctx.moveTo(cx(i), cy(i));
            ctx.lineTo(cx(n), cy(n));
          }
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // 6. deposits
      for (const i of onScreen) {
        if (!known(i) || !depositVisible(s, civId, i)) continue;
        const d = m.deposit[i]!;
        const info = DEPOSITS[d.kind];
        const good = GOODS[Object.keys(info.yields)[0]];
        const x = cx(i) + R * 0.42,
          y = cy(i) - R * 0.38;
        ctx.fillStyle = 'rgba(250,243,225,0.92)';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, R * 0.27, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        const goodId = Object.keys(info.yields)[0];
        const icon = img[`art:good/${goodId}`] ?? (good.icon && img[`good:${good.icon}`]);
        if (icon) {
          const w = R * 0.42,
            h = (icon.naturalHeight / icon.naturalWidth) * w;
          ctx.drawImage(icon, x - w / 2, y - h / 2, w, h);
        } else {
          // a pictogram on the good's colour
          ctx.fillStyle = good.color;
          ctx.globalAlpha = 0.35;
          ctx.beginPath();
          ctx.arc(x, y, R * 0.24, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          const pic = info.emoji ?? good.emoji;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (pic) {
            ctx.font = `${R * 0.3}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
            ctx.fillText(pic, x, y + 1);
          } else {
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${R * 0.2}px Georgia, serif`;
            ctx.fillText(good.glyph, x, y + 1);
          }
        }
      }

      // 7. borders
      for (const i of onScreen) {
        const o = own[i];
        if (o < 0 || !known(i)) continue;
        const ns = neighborsByDir(g, i);
        ctx.beginPath();
        for (let d = 0; d < 6; d++) {
          const n = ns[d];
          if (n >= 0 && own[n] === o) continue;
          const [a, b] = EDGE_CORNERS[d];
          ctx.moveTo(cx(i) + CORNERS[a][0] * R * 0.9, cy(i) + CORNERS[a][1] * R * 0.9);
          ctx.lineTo(cx(i) + CORNERS[b][0] * R * 0.9, cy(i) + CORNERS[b][1] * R * 0.9);
        }
        ctx.strokeStyle = s.civs[o].color;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    if (!STATIC) {
      // 8. reach and path
      if (ov.reach) {
        ctx.fillStyle = 'rgba(255,250,220,0.32)';
        for (const i of ov.reach) {
          this.hexPath(cx(i), cy(i), R * 0.94);
          ctx.fill();
        }
      }
    }
    if (STATIC) {
      // 9. fog: unknown hexes stay bare parchment; remembered hexes are veiled
      for (const i of onScreen) {
        if (!known(i)) continue;
        if (!vis[i]) {
          ctx.fillStyle = 'rgba(232,218,188,0.55)';
          this.hexPath(cx(i), cy(i), R * 1.03);
          ctx.fill();
        }
      }
      // soft edge between known and unknown
      ctx.strokeStyle = 'rgba(120,95,60,0.35)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      for (const i of onScreen) {
        if (!known(i)) continue;
        const ns = neighborsByDir(g, i);
        for (let d = 0; d < 6; d++) {
          if (ns[d] < 0 || known(ns[d])) continue;
          const [a, b] = EDGE_CORNERS[d];
          ctx.moveTo(cx(i) + CORNERS[a][0] * R, cy(i) + CORNERS[a][1] * R);
          ctx.lineTo(cx(i) + CORNERS[b][0] * R, cy(i) + CORNERS[b][1] * R);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (!STATIC) {
      // 10. selection and hover
      if (ov.hoverHex !== undefined && ov.hoverHex >= 0) {
        ctx.strokeStyle = 'rgba(74,50,30,0.6)';
        ctx.lineWidth = 2;
        this.hexPath(cx(ov.hoverHex), cy(ov.hoverHex), R * 0.92);
        ctx.stroke();
      }
      if (ov.selectedHex !== undefined && ov.selectedHex >= 0) {
        ctx.strokeStyle = '#f3d36b';
        ctx.lineWidth = 3;
        this.hexPath(cx(ov.selectedHex), cy(ov.selectedHex), R * 0.9);
        ctx.stroke();
      }

      if (ov.target !== undefined) {
        ctx.strokeStyle = '#b3261e';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 5]);
        this.hexPath(cx(ov.target), cy(ov.target), R * 0.9);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(179,38,30,0.12)';
        ctx.fill();
      }

      // ruins: broken columns where the player has looked
      for (const ru of s.ruins ?? []) {
        if (!known(ru.hex)) continue;
        const x = cx(ru.hex),
          y = cy(ru.hex);
        ctx.fillStyle = '#b9ad94';
        for (let k = 0; k < 3; k++)
          ctx.fillRect(
            x - R * 0.3 + k * R * 0.22,
            y - R * (0.15 + (k % 2) * 0.12),
            R * 0.1,
            R * 0.4,
          );
        ctx.fillStyle = '#e6c35a';
        ctx.beginPath();
        ctx.arc(x + R * 0.28, y + R * 0.22, R * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      // raider camps: a tent glyph where the player has looked
      for (const camp of s.raiders?.camps ?? []) {
        if (!known(camp.hex)) continue;
        const x = cx(camp.hex),
          y = cy(camp.hex);
        ctx.fillStyle = '#5d4630';
        ctx.beginPath();
        ctx.moveTo(x - R * 0.4, y + R * 0.3);
        ctx.lineTo(x, y - R * 0.35);
        ctx.lineTo(x + R * 0.4, y + R * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e8892f';
        ctx.beginPath();
        ctx.arc(x, y + R * 0.18, R * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }

      // 11. cities (their name banners wait until the troops are drawn, so they stay readable)
      const cityBanners: (() => void)[] = [];
      for (const c of s.cities) {
        if (!known(c.hex)) continue;
        const x = cx(c.hex),
          y = cy(c.hex);
        const coastal = neighbors(g, c.hex).some(n => m.terrain[n] === 'coast');
        // the picture follows the settlement's rank; a small town is still a village
        const tier = c.tier ?? 'town';
        const sizeKey = tier === 'town' ? (c.pop >= 3000 ? 'town' : 'outpost') : 'city';
        const big =
          tier === 'metropolis'
            ? 'metropolis'
            : tier === 'city'
              ? 'city'
              : c.pop >= 3000
                ? 'town'
                : 'village';
        const artCity = `art:city/${coastal ? 'port-' : ''}${big}`;
        sprite(
          img[artCity] ? artCity : `city:${coastal ? 'port' : 'city'}-${sizeKey}`,
          x,
          y + R * 0.45,
          tier === 'town' ? R * 1.35 : tier === 'city' ? R * 1.6 : R * 1.8,
        );
        // a besieged settlement: a dashed red ring, solid once its walls are breached
        if (c.siege) {
          ctx.save();
          ctx.strokeStyle = 'rgba(160,40,30,0.9)';
          ctx.lineWidth = 2.5;
          ctx.setLineDash(s.turn - c.siege.since >= 5 ? [] : [6, 4]);
          ctx.beginPath();
          ctx.arc(x, y, R * 0.92, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        cityBanners.push(() =>
          this.banner(
            x,
            y + R * 0.62,
            `${c.name}  ${(c.pop / 1000).toFixed(1)}k${c.siege ? '  (besieged)' : ''}`,
            s.civs[c.civId].color,
            zoom,
          ),
        );
      }

      // 12. path preview
      const sel =
        ov.selectedFormation !== undefined
          ? s.formations.find(f => f.id === ov.selectedFormation)
          : undefined;
      if (sel && ov.path && ov.path.length) {
        const turns = pathTurns(s, sel, ov.path);
        ctx.strokeStyle = 'rgba(40,25,10,0.8)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(cx(sel.hex), cy(sel.hex));
        for (const h of ov.path) ctx.lineTo(cx(h), cy(h));
        ctx.stroke();
        ctx.setLineDash([]);
        ov.path.forEach((h, k) => {
          const endOfTurn = k === ov.path!.length - 1 || turns[k + 1] !== turns[k];
          if (!endOfTurn) return;
          ctx.fillStyle = turns[k] === 0 ? '#f3d36b' : '#fff6dc';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx(h), cy(h), R * 0.22, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = INK;
          ctx.font = `bold ${R * 0.26}px Georgia, serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(turns[k] + 1), cx(h), cy(h) + 1);
        });
      }

      // 13. formations (only where this civ can see)
      const byHex = new Map<number, typeof s.formations>();
      for (const f of s.formations) {
        if (!vis[f.hex] || f.aboard !== undefined) continue;
        if (!byHex.has(f.hex)) byHex.set(f.hex, []);
        byHex.get(f.hex)!.push(f);
      }
      const drawn = new Set<number>();
      for (const [hex, fs] of byHex) {
        // armies in front, settlers behind
        fs.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'settlers' ? -1 : 1));
        const top = fs.find(f => f.id === ov.selectedFormation) ?? fs[fs.length - 1];
        for (const f of fs) drawn.add(f.id);
        const prevHex = this.motion.lastHex(top.id);
        const [x, y] = this.motion.place(
          top.id,
          hex,
          cx(hex),
          cy(hex),
          prevHex === undefined ? 0 : distance(g, prevHex, hex),
        );
        const hasCity = s.cities.some(c => c.hex === hex);
        const ox = hasCity ? -R * 0.45 : 0,
          oy = hasCity ? -R * 0.1 : R * 0.42;
        if (fs.length > 1) {
          const other = fs.find(f => f !== top)!;
          sprite(unitKey(other), x + ox + R * 0.28, y + oy - R * 0.05, R * 0.85);
        }
        const color = s.civs[top.civId].color;
        // base disc
        ctx.fillStyle = 'rgba(40,25,10,0.25)';
        ctx.beginPath();
        ctx.ellipse(x + ox, y + oy, R * 0.42, R * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
        if (top.id === ov.selectedFormation) {
          // a quick pop when picked
          const k = Math.min(1, (performance.now() - this.selAt) / 220);
          const pop = reducedMotion() ? 1 : 1 + 0.45 * (1 - k) ** 2;
          ctx.strokeStyle = '#f3d36b';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(x + ox, y + oy, R * 0.5 * pop, R * 0.17 * pop, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        sprite(
          unitKey(top),
          x + ox,
          y + oy + (top.kind === 'fleet' ? R * 0.1 : 0),
          top.kind === 'fleet' ? R * 1.35 : R * 1.15,
        );
        // troops aboard a fleet: a small badge
        const aboard =
          top.kind === 'fleet'
            ? s.formations
                .filter(o => o.aboard === top.id)
                .reduce((a, o) => a + o.cohorts.length, 0)
            : 0;
        if (aboard) {
          ctx.fillStyle = '#fff6dc';
          ctx.strokeStyle = '#2b1a0c';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(x + ox + R * 0.5, y + oy - R * 0.55, R * 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#2b1a0c';
          ctx.font = `bold ${R * 0.2}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`⚔${aboard}`, x + ox + R * 0.5, y + oy - R * 0.54);
        }
        // banner: civ colour with cohort count
        const label =
          top.kind === 'settlers'
            ? '⌂'
            : top.kind === 'workers'
              ? '⚒'
              : top.kind === 'engineers'
                ? '⚙'
                : top.kind === 'fleet'
                  ? `⛵${top.cohorts.length}`
                  : String(top.cohorts.length);
        const bx = x + ox - R * 0.62,
          by = y + oy - R * 1.3;
        ctx.fillStyle = color;
        ctx.strokeStyle = '#2b1a0c';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(bx, by, R * 0.42, R * 0.34, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${R * 0.25}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, bx + R * 0.21, by + R * 0.18);
        if (top.civId === civId && top.moves > 0 && !top.fortified && !top.path.length) {
          ctx.fillStyle = '#7ee07e';
          ctx.beginPath();
          ctx.arc(bx + R * 0.42, by, R * 0.08, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        if (top.kind === 'army') {
          const full = top.cohorts.length * 100;
          const have = top.cohorts.reduce((a, c) => a + c.strength, 0);
          const bw = R * 0.42,
            bh = R * 0.07;
          ctx.fillStyle = 'rgba(43,26,12,0.7)';
          ctx.fillRect(bx, by + R * 0.37, bw, bh);
          const k = have / Math.max(1, full);
          ctx.fillStyle = k > 0.66 ? '#5fae4f' : k > 0.33 ? '#d9a531' : '#c0392b';
          ctx.fillRect(bx, by + R * 0.37, bw * k, bh);
        }
        if (fs.length > 1) {
          ctx.fillStyle = '#2b1a0c';
          ctx.font = `bold ${R * 0.2}px system-ui, sans-serif`;
          ctx.fillText(`×${fs.length}`, bx + R * 0.21, by + R * 0.5);
        }
      }
      this.motion.prune(drawn);
      for (const b of cityBanners) b();
    }
  }

  private banner(x: number, y: number, text: string, color: string, zoom: number) {
    const ctx = this.ctx;
    const fs = Math.max(11, R * 0.3) / Math.max(0.8, zoom * 0.9);
    ctx.font = `600 ${fs}px Georgia, serif`;
    const w = ctx.measureText(text).width + fs;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#2b1a0c';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y, w, fs * 1.45, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + fs * 0.75);
  }

  /** A tall, shaded, snow-capped peak with its foot at (x, y). */
  private peak(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    const top = y - h;
    ctx.lineJoin = 'round';
    // shadow side, lit side, then snow
    ctx.fillStyle = '#6e6962';
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x, top);
    ctx.lineTo(x + w / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#948e85';
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x, top);
    ctx.lineTo(x - w * 0.05, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f6f3ec';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.17, top + h * 0.34);
    ctx.lineTo(x, top);
    ctx.lineTo(x + w * 0.17, top + h * 0.34);
    ctx.lineTo(x + w * 0.06, top + h * 0.28);
    ctx.lineTo(x - w * 0.04, top + h * 0.37);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x, top);
    ctx.lineTo(x + w / 2, y);
    ctx.stroke();
  }

  /** Wind-drawn dunes on sand. */
  private dunes(x: number, y: number, h: number) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(150,110,55,0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const ox = x + (k - 1) * R * 0.38 + (h - 0.5) * R * 0.2;
      const oy = y + (k % 2 ? 0.05 : 0.35) * R + (h - 0.5) * R * 0.1;
      ctx.moveTo(ox - R * 0.28, oy);
      ctx.quadraticCurveTo(ox, oy - R * 0.2, ox + R * 0.28, oy);
    }
    ctx.stroke();
  }

  /** Blue-grey drifts on snowfields. */
  private drifts(x: number, y: number, h: number) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(120,140,160,0.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let k = 0; k < 2; k++) {
      const oy = y + (k ? 0.35 : -0.05) * R;
      const ox = x + (h - 0.5) * R * 0.3 + (k ? 0.15 : -0.2) * R;
      ctx.moveTo(ox - R * 0.32, oy);
      ctx.bezierCurveTo(
        ox - R * 0.1,
        oy - R * 0.12,
        ox + R * 0.1,
        oy + R * 0.08,
        ox + R * 0.32,
        oy - R * 0.02,
      );
    }
    ctx.stroke();
  }

  /** Little tufts of grass on the tundra. */
  private tufts(x: number, y: number, h: number) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(90,96,70,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const ox = x + (((k * 0.37 + h) % 1) - 0.5) * R * 1.0;
      const oy = y + (((k * 0.61 + h * 0.7) % 1) - 0.3) * R * 0.8;
      ctx.moveTo(ox - R * 0.06, oy);
      ctx.lineTo(ox - R * 0.03, oy - R * 0.1);
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox, oy - R * 0.13);
      ctx.moveTo(ox + R * 0.06, oy);
      ctx.lineTo(ox + R * 0.03, oy - R * 0.1);
    }
    ctx.stroke();
  }

  private hexPath(x: number, y: number, r: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    this.hexSubPath(x, y, r);
  }

  private hexSubPath(x: number, y: number, r: number) {
    const ctx = this.ctx;
    ctx.moveTo(x + CORNERS[0][0] * r, y + CORNERS[0][1] * r);
    for (let k = 1; k < 6; k++) ctx.lineTo(x + CORNERS[k][0] * r, y + CORNERS[k][1] * r);
    ctx.closePath();
  }
}

const spriteKey = (sp: string) => (sp.startsWith('ship:') ? sp : `unit:${sp}`);

/** Hexes whose centres fall inside a world-pixel rectangle (plus a row/column of slack). */
function hexesIn(g: Grid, x0: number, y0: number, x1: number, y1: number): number[] {
  const out: number[] = [];
  const rMin = Math.max(0, Math.floor(y0 / (1.5 * R)) - 1),
    rMax = Math.min(g.h - 1, Math.ceil(y1 / (1.5 * R)) + 1);
  const cMin = Math.max(0, Math.floor(x0 / (Math.sqrt(3) * R)) - 1),
    cMax = Math.min(g.w - 1, Math.ceil(x1 / (Math.sqrt(3) * R)) + 1);
  for (let r = rMin; r <= rMax; r++) for (let c = cMin; c <= cMax; c++) out.push(r * g.w + c);
  return out;
}

/** Neighbours in fixed direction order (E, NE, NW, W, SW, SE), -1 off the map. */
function neighborsByDir(g: Grid, i: number): number[] {
  const c = i % g.w,
    r = Math.floor(i / g.w);
  const odd = r & 1;
  const off = odd
    ? [
        [1, 0],
        [1, -1],
        [0, -1],
        [-1, 0],
        [0, 1],
        [1, 1],
      ]
    : [
        [1, 0],
        [0, -1],
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, 1],
      ];
  return off.map(([dc, dr]) => {
    const nc = c + dc,
      nr = r + dr;
    return nc >= 0 && nr >= 0 && nc < g.w && nr < g.h ? nr * g.w + nc : -1;
  });
}
