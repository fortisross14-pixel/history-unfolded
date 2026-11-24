/**
 * The playing map in low-poly 3D. It keeps the 2D renderer's contract (camera in screen units,
 * zoomAt, clamp, centerOn, hexAtScreen, draw with overlays), so MapView drives either one.
 *
 * Built for size: the land is cut into chunks of 10×10 hexes, each baked into one mesh with
 * vertex colours and rebuilt only when what it shows changes (exploration, roads, deposits).
 * Settlements are baked per settlement (each district on its own hex, with its real buildings
 * in miniature), troops per formation. Fog of war is one instanced veil. Names, unit counts and
 * battle effects are drawn on a 2D canvas laid over the scene.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DEPOSITS, GOODS } from '../data/goods.ts';
import { SLOT_TYPES } from '../data/slots.ts';
import { isWater } from '../data/terrain.ts';
import { cityDistricts } from '../engine/economy.ts';
import { depositVisible, formationStrength, territory, visibleHexes } from '../engine/game.ts';
import { lairsSeenBy, packOf } from '../engine/wildlife.ts';
import { people } from '../engine/units.ts';
import { centerUnit, distance, hexAtUnit, neighbors, SQRT3, type Grid } from '../engine/hex.ts';
import type { City, Civ, Formation, GameState } from '../engine/types.ts';
import { emblemOf } from '../data/rulers.ts';
import { artUrl } from './art.ts';
import { SHIELD_PATH } from '../ui/shield.ts';
import type { Assets } from './assets.ts';
import {
  add,
  ball,
  boat,
  box,
  builderFor,
  C,
  cone,
  cyl,
  flag,
  generic,
  house,
  rng,
  rock,
  scaffold,
  tree,
  type Builder,
  WONDER_BUILDERS,
} from './city3d.ts';
import { wondersIn } from '../engine/wonders.ts';
import { industryStatus } from '../engine/economy.ts';
import { fx, Motion, reducedMotion } from './fx.ts';
import { buildBeasts, buildTroops, troopLook } from './troops.ts';
import type { Insets, Overlay } from './mapRenderer.ts';

const ELEV = (55 * Math.PI) / 180;
const SIN = Math.sin(ELEV),
  COS = Math.cos(ELEV);
const CHUNK = 10;
const TOP: Record<string, string> = {
  ocean: '#4f7f9a',
  coast: '#6f9fb0',
  lake: '#6f9fb0',
  grassland: '#a7b86f',
  plains: '#c4b676',
  desert: '#dcc58a',
  tundra: '#a9a58a',
  snow: '#eef0ee',
};

const baked = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.92,
  metalness: 0,
  side: THREE.DoubleSide,
});

/** Merge every mesh under `root` into one geometry, its material colour kept per vertex. */
function bake(root: THREE.Object3D): THREE.BufferGeometry | null {
  root.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', src.getAttribute('position'));
    g.setAttribute('normal', src.getAttribute('normal'));
    g.applyMatrix4(m.matrixWorld);
    const col = (m.material as THREE.MeshStandardMaterial).color;
    const n = g.getAttribute('position').count;
    const arr = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      arr[k * 3] = col.r;
      arr[k * 3 + 1] = col.g;
      arr[k * 3 + 2] = col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    parts.push(g);
    m.geometry.dispose();
  });
  if (!parts.length) return null;
  const out = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  out?.computeBoundingSphere();
  return out;
}

const bakedMesh = (root: THREE.Object3D, shadow = true) => {
  const g = bake(root);
  if (!g) return null;
  const m = new THREE.Mesh(g, baked);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
};

/**
 * A formation's base: a dark outline, a ring in the people's colour and a paler middle, so a
 * formation's owner shows at any zoom and on any ground.
 */
function nationBase(g: THREE.Object3D, colour: string, r: number) {
  const pale = new THREE.Color(colour).lerp(new THREE.Color('#fff8ea'), 0.55).getStyle();
  cyl(g, r + 0.012, r + 0.016, 0.01, '#2a2620', 0, -0.006, 0, 20);
  cyl(g, r, r, 0.014, colour, 0, -0.004, 0, 20);
  cyl(g, r * 0.72, r * 0.72, 0.016, pale, 0, -0.004, 0, 20);
}

/**
 * A deposit on the map: a clear low-poly sign of what it is, on a pale pad in its good's colour,
 * set to one side of the hex so troops and buildings leave it in view. Ore is rocks shot with
 * the metal, beasts stand as beasts, crops grow in a patch, the sea's goods break the water.
 */
function depositMark(
  deck: THREE.Object3D,
  kind: string,
  water: boolean,
  built: boolean,
  r: () => number,
) {
  const good = Object.keys(DEPOSITS[kind]?.yields ?? {})[0];
  const col = GOODS[good]?.color ?? '#b0905a';
  const g = new THREE.Group();
  // on a built hex the buildings take the middle: the sign sits at the rim
  g.position.set(built ? 0.58 : 0.32, 0, built ? -0.4 : -0.24);
  g.scale.setScalar(built ? 1.05 : 1.75);
  deck.add(g);
  const pad = new THREE.Color(col).lerp(new THREE.Color('#fff6e0'), 0.3).getStyle();
  if (!water) {
    cyl(g, 0.21, 0.22, 0.012, '#4a3f30', 0, 0, 0, 12);
    cyl(g, 0.195, 0.195, 0.02, pad, 0, 0, 0, 12);
  }
  const quad = (x: number, z: number, coat: string, len = 0.13, ht = 0.06, a = 0) => {
    const q = new THREE.Group();
    q.position.set(x, 0, z);
    q.rotation.y = a;
    g.add(q);
    for (const [lx, lz] of [
      [len * 0.35, -ht * 0.4],
      [len * 0.35, ht * 0.4],
      [-len * 0.35, -ht * 0.4],
      [-len * 0.35, ht * 0.4],
    ])
      cyl(q, 0.01, 0.01, 0.05, '#3a3530', lx, 0, lz, 4);
    box(q, len, ht, ht, coat, 0, 0.045, 0);
    box(q, ht * 0.8, ht * 0.8, ht * 0.7, coat, len * 0.55, 0.06, 0);
    return q;
  };
  const ore = (vein: string, base = '#8f877a') => {
    rock(g, -0.06, 0.02, 0.13, base);
    rock(g, 0.1, -0.06, 0.09, base);
    for (let k = 0; k < 4; k++)
      ball(g, 0.035, vein, -0.08 + r() * 0.18, 0.08 + r() * 0.06, -0.07 + r() * 0.14);
  };
  switch (kind) {
    case 'wheat':
    case 'rice':
      for (let a = -1; a <= 1; a++)
        for (let b = -1; b <= 1; b++)
          cone(g, 0.035, 0.2, kind === 'rice' ? '#b7c46a' : '#e0bd52', a * 0.1, 0, b * 0.1, 4);
      break;
    case 'cattle':
      quad(-0.05, 0.05, '#6e4a30', 0.15, 0.07, 0.3);
      quad(0.08, -0.08, '#efe6d6', 0.15, 0.07, -0.4);
      break;
    case 'pigs':
      quad(-0.04, 0.05, '#e3a39a', 0.12, 0.06, 0.5);
      quad(0.08, -0.07, '#d6928a', 0.12, 0.06, -0.3);
      break;
    case 'sheep':
      for (const [x, z] of [
        [-0.07, 0.05],
        [0.07, -0.06],
        [0.08, 0.09],
      ]) {
        ball(g, 0.065, '#f3eee2', x, 0.09, z);
        box(g, 0.04, 0.04, 0.04, '#3a3530', x + 0.07, 0.08, z);
        cyl(g, 0.008, 0.008, 0.05, '#3a3530', x, 0, z, 4);
      }
      break;
    case 'game': {
      const d = quad(0, 0, '#9a6a40', 0.14, 0.06, 0.2);
      for (const s of [-1, 1]) {
        const a = cyl(d, 0.006, 0.004, 0.08, '#e8dcc0', 0.08, 0.09, s * 0.02, 3);
        a.rotation.x = s * 0.4;
      }
      break;
    }
    case 'horses': {
      for (const [x, z, a] of [
        [-0.05, 0.05, 0.3],
        [0.08, -0.07, -0.5],
      ]) {
        const h = quad(x, z, '#7b4b2a', 0.16, 0.06, a);
        const neck = box(h, 0.04, 0.08, 0.035, '#7b4b2a', 0.08, 0.07, 0);
        neck.rotation.z = -0.5;
        box(h, 0.06, 0.03, 0.03, '#7b4b2a', 0.12, 0.13, 0);
        box(h, 0.012, 0.05, 0.01, '#2a2420', -0.09, 0.06, 0);
      }
      break;
    }
    case 'ivory': {
      const e = quad(0, 0, '#9a958e', 0.2, 0.11, 0.2);
      for (const s of [-1, 1]) {
        const t = cone(e, 0.012, 0.09, '#f6f0e0', 0.16, 0.03, s * 0.03, 4);
        t.rotation.z = -1.1;
      }
      break;
    }
    case 'furs':
      quad(0, 0, '#c8682e', 0.13, 0.05, 0.4);
      box(g, 0.16, 0.02, 0.12, '#6d4a2e', -0.04, 0, 0.1);
      break;
    case 'stone':
      box(g, 0.16, 0.1, 0.12, '#c9c0ad', -0.04, 0, 0.02);
      box(g, 0.12, 0.08, 0.1, '#b3a994', 0.1, 0, -0.06);
      box(g, 0.1, 0.07, 0.09, '#d8d0bc', 0.02, 0.1, 0);
      break;
    case 'copper':
      ore('#d07a3e');
      break;
    case 'tin':
      ore('#c6d0d4');
      break;
    case 'iron':
      ore('#4a4646', '#9b8d7c');
      break;
    case 'coal':
      ore('#1f1c1a', '#6b645a');
      break;
    case 'gold':
      ore('#f0c43a');
      break;
    case 'silver':
      ore('#e8ecf0');
      break;
    case 'saltpeter':
    case 'salt':
      for (let k = 0; k < 5; k++)
        cone(g, 0.04, 0.1 + r() * 0.08, '#f2efe8', -0.1 + r() * 0.2, 0, -0.1 + r() * 0.2, 4);
      break;
    case 'wine':
      for (let k = -1; k <= 1; k++) {
        cyl(g, 0.008, 0.008, 0.16, C.timber, k * 0.1, 0, 0, 4);
        ball(g, 0.045, '#6b2a4a', k * 0.1, 0.12, 0.02);
        ball(g, 0.04, '#5f8a3a', k * 0.1, 0.16, -0.03);
      }
      break;
    case 'spices':
    case 'dyes':
    case 'silk':
    case 'sugar':
      for (let k = 0; k < 4; k++) {
        const x = -0.1 + (k % 2) * 0.18,
          z = -0.08 + Math.floor(k / 2) * 0.16;
        if (kind === 'sugar') cyl(g, 0.012, 0.012, 0.24, '#8fbf5a', x, 0, z, 4);
        else {
          cyl(g, 0.01, 0.01, 0.08, C.timber, x, 0, z, 4);
          ball(g, 0.06, kind === 'silk' ? '#5f8a3a' : '#4f7a34', x, 0.11, z);
          ball(g, 0.028, kind === 'silk' ? '#f4efe3' : col, x + 0.03, 0.15, z);
        }
      }
      break;
    case 'fish':
      for (const [x, z, a] of [
        [-0.05, 0.04, 0.4],
        [0.09, -0.06, -0.6],
      ]) {
        const f = new THREE.Group();
        f.position.set(x, 0.12, z);
        f.rotation.set(0, a, 0.5);
        g.add(f);
        const body = ball(f, 0.05, '#c7d4d8', 0, 0, 0);
        body.scale.set(1.6, 0.8, 0.5);
        const tail = cone(f, 0.035, 0.05, '#9fb4ba', -0.09, -0.025, 0, 3);
        tail.rotation.z = Math.PI / 2;
      }
      cyl(g, 0.14, 0.14, 0.008, '#e8f1f2', 0, 0.06, 0, 12);
      break;
    case 'whales': {
      const back = ball(g, 0.12, '#4a5a66', 0, 0.06, 0);
      back.scale.set(1.8, 0.6, 0.8);
      const tail = box(g, 0.05, 0.02, 0.14, '#4a5a66', -0.22, 0.12, 0);
      tail.rotation.z = 0.4;
      break;
    }
    case 'pearls': {
      const shell = cyl(g, 0.1, 0.12, 0.03, '#d9cbb8', 0, 0.06, 0, 8);
      shell.rotation.z = 0.15;
      ball(g, 0.04, '#f6f2fa', 0.02, 0.1, 0);
      break;
    }
    case 'oil':
      cyl(g, 0.14, 0.15, 0.015, '#1e1c1a', 0, 0.01, 0, 10);
      for (const s of [-1, 1]) {
        const leg = cyl(g, 0.008, 0.008, 0.3, '#5a4f45', s * 0.05, 0, 0, 4);
        leg.rotation.z = s * -0.18;
      }
      break;
    default:
      ore(col);
  }
}

/** a hex's main formation: base radius before scaling (× UNIT_SCALE on the map) */
const BIG_BASE = 0.262;

/** how much larger than the land troops and ships are drawn */
const UNIT_SCALE = 3;

/**
 * Spots for buildings on a district's hex, in the order they fill: the middle, a ring around it,
 * then an outer ring. Seeded per district, so a place keeps its look as it grows.
 * Each: x, z, turn, scale.
 */
function spotsFor(seed: number): [number, number, number, number][] {
  const r = rng(seed);
  const out: [number, number, number, number][] = [[0, 0, r() * 6.28, 0.36]];
  const ring = (n: number, rad: number, scale: number) => {
    const start = r() * Math.PI * 2;
    const ks = Array.from({ length: n }, (_, k) => k).sort(() => r() - 0.5);
    for (const k of ks) {
      const a = start + (k / n) * Math.PI * 2 + (r() - 0.5) * 0.4;
      const d = rad * (0.88 + r() * 0.2);
      out.push([
        Math.cos(a) * d,
        Math.sin(a) * d,
        a + Math.PI / 2 + (r() - 0.5) * 0.6,
        scale * (0.9 + r() * 0.2),
      ]);
    }
  };
  ring(6, 0.42, 0.3);
  ring(10, 0.74, 0.24);
  return out;
}

/** a cottage or two on a yard: the homes of a place's people */
const home: Builder = (g, r) => {
  house(g, (r() - 0.5) * 0.2, (r() - 0.5) * 0.2, 0.42, 0.34, 0.26 + r() * 0.1, {
    roof: r() < 0.6 ? C.roof : C.roof2,
    wall: r() < 0.5 ? C.wall : C.wall2,
  });
  if (r() < 0.6) house(g, 0.3, 0.25, 0.26, 0.22, 0.2, { roof: C.roof2, rot: Math.PI / 2 });
  if (r() < 0.5) tree(g, -0.32, 0.3, 0.9, 'leaf', r);
  return C.grass;
};

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export class World3DRenderer {
  /** the top-left of the view in screen units (ground x, ground z × sin of the tilt), and px per unit */
  cam: Camera = { x: 0, y: 0, zoom: 46 };
  coarse = false;
  wantsFrame = false;
  wantsSettle = false;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
  private sun: THREE.DirectionalLight;
  private labels: HTMLCanvasElement;
  private lctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private dpr = 1;

  private game: GameState | null = null;
  private chunks = new Map<string, { key: string; mesh: THREE.Mesh | null }>();
  private cities = new Map<number, { key: string; mesh: THREE.Object3D | null }>();
  /** raider camps on the map, by hex */
  private camps = new Map<number, THREE.Object3D>();
  /** the rail and power lens, worked out once a turn per settlement */
  private industry = new Map<number, { key: string } & ReturnType<typeof industryStatus>>();
  /** ruins not yet searched, by hex */
  private ruinMeshes = new Map<number, THREE.Object3D>();
  /** lairs of wild beasts, by hex */
  private lairMeshes = new Map<number, THREE.Object3D>();
  /** strength numbers of formations, kept until what they depend on changes */
  private strengths = new Map<number, { key: string; n: number }>();
  private units = new Map<number, { key: string; mesh: THREE.Object3D }>();
  private border: { key: string; mesh: THREE.Mesh | null } = { key: '', mesh: null };
  private overlay: { key: string; group: THREE.Group } = { key: '', group: new THREE.Group() };
  private fog: THREE.InstancedMesh | null = null;
  private fogKey = '';
  private motion = new Motion();
  private landGroup = new THREE.Group();
  private cityGroup = new THREE.Group();
  private unitGroup = new THREE.Group();

  constructor(canvas: HTMLCanvasElement, _assets?: Assets) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setClearColor('#e8dcc0');
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(new THREE.HemisphereLight(0xfff6e2, 0x7a6e58, 1.2));
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(this.landGroup, this.cityGroup, this.unitGroup, this.overlay.group);
    // names, counts and battle numbers: a 2D canvas over the scene
    this.labels = document.createElement('canvas');
    Object.assign(this.labels.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    });
    canvas.parentElement?.appendChild(this.labels);
    this.lctx = this.labels.getContext('2d')!;
  }

  dispose() {
    this.renderer.dispose();
    this.labels.remove();
  }

  // ---------------------------------------------------------------- camera (2D contract)

  resize(w: number, h: number) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.w, this.h, false);
    this.labels.width = this.w * this.dpr;
    this.labels.height = this.h * this.dpr;
  }

  private worldSize(s: GameState): [number, number] {
    return [SQRT3 * (s.map.w + 0.5), (1.5 * (s.map.h - 1) + 2) * SIN];
  }

  centerOn(s: GameState, hex: number, ins: Insets = { top: 0, right: 0, bottom: 0, left: 0 }) {
    const [x, z] = centerUnit({ w: s.map.w, h: s.map.h }, hex);
    const sx = ins.left + (this.w - ins.left - ins.right) / 2,
      sy = ins.top + (this.h - ins.top - ins.bottom) / 2;
    this.cam.x = x - sx / this.cam.zoom;
    this.cam.y = z * SIN - sy / this.cam.zoom;
  }

  /** The part of the world on screen, in hex-radius units (the ground): x0, z0, x1, z1. */
  viewRect(): [number, number, number, number] {
    const z = this.cam.zoom;
    return [this.cam.x, this.cam.y / SIN, this.cam.x + this.w / z, (this.cam.y + this.h / z) / SIN];
  }

  hexAtScreen(s: GameState, sx: number, sy: number): number {
    // follow the view ray down from above the highest ground: the first hex whose top it
    // meets is the one under the pointer (hills and mountains stand in front of what is behind)
    const g = { w: s.map.w, h: s.map.h };
    const wx = this.cam.x + sx / this.cam.zoom;
    const at = (h: number) => (this.cam.y + sy / this.cam.zoom + h * COS) / SIN;
    for (let h = 0.45; h >= 0; h -= 0.03) {
      const hex = hexAtUnit(g, wx, at(h));
      if (hex >= 0 && Math.max(0, this.top(s, hex)) >= h - 0.015) return hex;
    }
    return hexAtUnit(g, wx, at(0));
  }

  zoomAt(sx: number, sy: number, factor: number) {
    const wx = this.cam.x + sx / this.cam.zoom,
      wy = this.cam.y + sy / this.cam.zoom;
    this.cam.zoom = Math.min(170, Math.max(9, this.cam.zoom * factor));
    this.cam.x = wx - sx / this.cam.zoom;
    this.cam.y = wy - sy / this.cam.zoom;
  }

  clamp(s: GameState, ins: Insets = { top: 0, right: 0, bottom: 0, left: 0 }) {
    const [W, H] = this.worldSize(s);
    const cx = this.cam.x + (ins.left + (this.w - ins.left - ins.right) / 2) / this.cam.zoom;
    const cy = this.cam.y + (ins.top + (this.h - ins.top - ins.bottom) / 2) / this.cam.zoom;
    const nx = Math.max(0, Math.min(W, cx)),
      ny = Math.max(0, Math.min(H, cy));
    this.cam.x += nx - cx;
    this.cam.y += ny - cy;
  }

  /** Screen position of a hex's centre (on its top), for tests and tooltips. */
  screenOf(s: GameState, hex: number): [number, number] {
    const [x, z] = centerUnit({ w: s.map.w, h: s.map.h }, hex);
    return this.project(x, Math.max(this.top(s, hex), 0), z);
  }

  /** screen position of a point on the map (x, height, z) */
  /** emblem pictures, loaded once; a redraw follows when one arrives */
  private emblemImgs = new Map<string, HTMLImageElement>();
  private emblemImg(key: string | undefined): HTMLImageElement | null {
    if (!key) return null;
    let im = this.emblemImgs.get(key);
    if (!im) {
      const url = artUrl(key);
      if (!url) return null;
      im = new Image();
      im.onload = () => (this.wantsFrame = true);
      im.src = url;
      this.emblemImgs.set(key, im);
    }
    return im.complete && im.naturalWidth ? im : null;
  }

  /** A people's badge on the label layer: the shield in its colour, its emblem or initial. */
  private badge(ctx: CanvasRenderingContext2D, civ: Civ, x: number, y: number, size: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 100, size / 100);
    const p = new Path2D(SHIELD_PATH);
    ctx.fillStyle = civ.color;
    ctx.fill(p);
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#2a2016';
    ctx.stroke(p);
    const im = this.emblemImg(emblemOf(civ.ruler));
    if (im) {
      const k = 62 / Math.max(im.naturalWidth, im.naturalHeight);
      const iw = im.naturalWidth * k,
        ih = im.naturalHeight * k;
      ctx.drawImage(im, 50 - iw / 2, 46 - ih / 2, iw, ih);
    } else {
      ctx.fillStyle = '#f7efd8';
      ctx.font = '700 46px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(civ.name.slice(0, 1).toUpperCase(), 50, 50);
    }
    ctx.restore();
  }

  private project(x: number, y: number, z: number): [number, number] {
    return [(x - this.cam.x) * this.cam.zoom, (z * SIN - y * COS - this.cam.y) * this.cam.zoom];
  }

  // ---------------------------------------------------------------- the land

  private top(s: GameState, i: number) {
    const m = s.map;
    return m.terrain[i] === 'ocean'
      ? -0.18
      : isWater(m.terrain[i])
        ? -0.1
        : m.relief[i] === 'hills'
          ? 0.28
          : m.relief[i] === 'mountains'
            ? 0.4
            : 0.12;
  }

  private buildChunk(s: GameState, civId: number, cx: number, cy: number): THREE.Mesh | null {
    const g: Grid = { w: s.map.w, h: s.map.h };
    const m = s.map;
    const known = s.civs[civId].explored;
    const root = new THREE.Group();
    const top = (i: number) => this.top(s, i);
    const ruinHexes = new Set((s.ruins ?? []).map(x => x.hex));
    for (let row = cy * CHUNK; row < Math.min(g.h, (cy + 1) * CHUNK); row++)
      for (let col = cx * CHUNK; col < Math.min(g.w, (cx + 1) * CHUNK); col++) {
        const i = row * g.w + col;
        if (!known[i]) continue;
        const [x, z] = centerUnit(g, i);
        const t = m.terrain[i];
        const y = top(i);
        const r = rng(i * 2654435761);
        const tile = new THREE.Group();
        tile.position.set(x, 0, z);
        root.add(tile);
        const hgt = y + 0.5;
        add(
          tile,
          new THREE.CylinderGeometry(0.985, 0.985, hgt, 6),
          TOP[t] ?? C.grass,
          0,
          y - hgt / 2,
          0,
        );
        add(
          tile,
          new THREE.CylinderGeometry(0.99, 0.99, 0.4, 6),
          isWater(t) ? '#3f6a80' : '#8c7a58',
          0,
          -0.7,
          0,
        );
        const deck = new THREE.Group();
        deck.position.y = y;
        tile.add(deck);
        if (m.relief[i] === 'hills')
          for (let k = 0; k < 2; k++) {
            const b = add(
              deck,
              new THREE.DodecahedronGeometry(0.28 + r() * 0.1, 0),
              t === 'snow' ? '#e8ece8' : '#9fae68',
              (r() - 0.5) * 0.7,
              0,
              (r() - 0.5) * 0.7,
            );
            b.scale.y = 0.45;
          }
        if (m.relief[i] === 'mountains')
          for (let k = 0; k < 3; k++) {
            const px = (r() - 0.5) * 0.8,
              pz = (r() - 0.5) * 0.8,
              ph = 0.7 + r() * 0.5;
            cone(deck, 0.38, ph, '#8f877a', px, 0, pz, 5);
            cone(deck, 0.14, ph * 0.32, '#f3f2ee', px, ph * 0.68, pz, 5);
          }
        const veg = m.vegetation[i];
        // a deposit's sign keeps its corner of the hex (+x, -z) clear of trees
        const mark = depositVisible(s, civId, i);
        // ruins stand in a clearing, so the treasure shows
        const ruin = ruinHexes.has(i);
        const clearOf = (px: number, pz: number) => !ruin && (!mark || px < 0.05 || pz > -0.05);
        // settlements and districts clear their own hex of trees
        const built = s.cities.some(c => c.hex === i) || s.districts.some(d => d.hex === i);
        if (!built) {
          if (veg === 'forest') {
            const n = 4 + Math.floor(r() * 3);
            for (let k = 0; k < n; k++) {
              const px = (r() - 0.5) * 1.1,
                pz = (r() - 0.5) * 1.1;
              const kind = t === 'tundra' || t === 'snow' || r() < 0.4 ? 'pine' : 'leaf';
              if (clearOf(px, pz)) tree(deck, px, pz, 1.6 + r() * 0.6, kind, r);
            }
          } else if (veg === 'jungle') {
            for (let k = 0; k < 5; k++) {
              const px = (r() - 0.5) * 1.1,
                pz = (r() - 0.5) * 1.1;
              if (!clearOf(px, pz)) continue;
              cyl(deck, 0.03, 0.04, 0.28, C.timber, px, 0, pz, 5);
              ball(deck, 0.2 + r() * 0.06, r() < 0.5 ? '#3f6e34' : '#4f7f3a', px, 0.36, pz);
            }
          } else if (veg === 'marsh') {
            for (let k = 0; k < 3; k++)
              box(deck, 0.36, 0.02, 0.22, C.water, (r() - 0.5) * 0.8, 0, (r() - 0.5) * 0.8);
            for (let k = 0; k < 10; k++)
              cyl(
                deck,
                0.008,
                0.008,
                0.14 + r() * 0.08,
                '#7c8a4a',
                (r() - 0.5) * 1.1,
                0,
                (r() - 0.5) * 1.1,
                3,
              );
          } else if (!isWater(t) && m.relief[i] === 'flat' && r() < 0.25)
            rock(deck, (r() - 0.5) * 0.9, (r() - 0.5) * 0.9, 0.05);
        }
        if (mark) depositMark(deck, m.deposit[i]!.kind, isWater(t), built, r);
        if (t === 'ocean' && r() < 0.15)
          box(deck, 0.3, 0.01, 0.04, '#9fc3d0', (r() - 0.5) * 0.8, 0.005, (r() - 0.5) * 0.8);
        // a river leaves through the edge it shares with the hex downstream
        const to = m.riverTo[i];
        if (m.river[i] && to >= 0 && known[to] && !built) {
          const [x2, z2] = centerUnit(g, to);
          const sway = (rng(i * 31 + to)() - 0.5) * 0.35;
          const mx = (x2 - x) / 2 + (z2 - z) * sway * 0.5,
            mz = (z2 - z) / 2 - (x2 - x) * sway * 0.5;
          const w = 0.08 + Math.min(0.16, m.river[i] * 0.015);
          const yy = Math.max(y, top(to)) + 0.015 - y;
          const seg = (ax: number, az: number, bx: number, bz: number) => {
            const L = Math.hypot(bx - ax, bz - az);
            const b = add(
              deck,
              new THREE.BoxGeometry(L + w * 0.6, 0.03, w),
              '#6f9fb0',
              (ax + bx) / 2,
              yy,
              (az + bz) / 2,
            );
            b.rotation.y = -Math.atan2(bz - az, bx - ax);
          };
          seg(0, 0, mx, mz);
          seg(mx, mz, x2 - x, z2 - z);
        }
        // roads and railways to the neighbours that have them
        if (s.roads[i] && !built)
          for (const n of neighbors(g, i)) {
            if (!s.roads[n] || !known[n]) continue;
            const [nx, nz] = centerUnit(g, n);
            const rail = s.roads[i] === 2 && s.roads[n] === 2;
            const L = Math.hypot(nx - x, nz - z) / 2;
            const yy = Math.max(y, top(n)) + 0.03 - y;
            const b = add(
              deck,
              new THREE.BoxGeometry(L, 0.03, rail ? 0.14 : 0.12),
              rail ? '#4a4540' : '#d9c79d',
              (nx - x) / 4,
              yy,
              (nz - z) / 4,
            );
            b.rotation.y = -Math.atan2(nz - z, nx - x);
          }
      }
    return bakedMesh(root);
  }

  private chunkKey(s: GameState, civId: number, cx: number, cy: number) {
    const g = { w: s.map.w, h: s.map.h };
    const known = s.civs[civId].explored;
    let k = 0,
      r = 0,
      b = 0;
    for (let row = cy * CHUNK; row < Math.min(g.h, (cy + 1) * CHUNK); row++)
      for (let col = cx * CHUNK; col < Math.min(g.w, (cx + 1) * CHUNK); col++) {
        const i = row * g.w + col;
        if (known[i]) k++;
        if (s.roads[i]) r += s.roads[i] * (i % 97);
      }
    // settlements and districts clear their hexes: count those inside this chunk
    const inside = (h: number) =>
      Math.floor((h % g.w) / CHUNK) === cx && Math.floor(Math.floor(h / g.w) / CHUNK) === cy;
    for (const c of s.cities) if (inside(c.hex)) b += c.hex;
    for (const d of s.districts) if (inside(d.hex)) b += d.hex;
    return `${k}|${r}|${s.civs[civId].techs.length}|${b}`;
  }

  // ---------------------------------------------------------------- settlements

  private cityKey(s: GameState, c: City, known: number[]) {
    const ds = cityDistricts(s, c);
    return [
      c.tier,
      c.civId,
      c.siege ? 1 : 0,
      Math.round(c.pop / 1000),
      known[c.hex],
      wondersIn(s, c.id)
        .map(w => w.id)
        .join(','),
      c.wonder?.id ?? '',
      ...ds.map(
        d =>
          `${d.hex}:${known[d.hex]}:${d.slots.map(x => (x.type ?? '') + (x.built ? '+' : '')).join(',')}`,
      ),
    ].join('|');
  }

  private buildCity(s: GameState, c: City, known: number[]): THREE.Object3D | null {
    const g = { w: s.map.w, h: s.map.h };
    const root = new THREE.Group();
    const ds = cityDistricts(s, c);
    const civ = s.civs[c.civId];
    const r = rng(c.id * 97 + 5);
    const hexes = ds;
    // each district grows on its hex like a real place: buildings take spots that look scattered
    // but never move (seeded by the district), filling from the middle outwards as they are built
    for (const d of hexes) {
      if (!known[d.hex]) continue;
      const [x, z] = centerUnit(g, d.hex);
      const grp = new THREE.Group();
      grp.position.set(x, this.top(s, d.hex), z);
      root.add(grp);
      const centre = d.slots.some(st => st.type === 'town-hall');
      const spots = spotsFor(d.id * 7919 + c.id);
      // what stands here: the built buildings, then those being built, then (in the centre)
      // homes for its people
      const things: Builder[] = [];
      if (centre) things.push(builderFor('town-hall')!);
      // world wonders stand by the centre, larger than any building
      const landmarks = new Set<Builder>();
      if (centre) {
        for (const w of wondersIn(s, c.id)) {
          const b = WONDER_BUILDERS[w.shape];
          landmarks.add(b);
          things.push(b);
        }
        if (c.wonder) {
          const site: Builder = (g, rr) => scaffold(g, rr);
          landmarks.add(site);
          things.push(site);
        }
      }
      for (const st of d.slots) {
        if (!st.type || st.type === 'town-hall') continue;
        if (st.built) things.push(builderFor(st.type) ?? generic(SLOT_TYPES[st.type]?.group));
      }
      for (const st of d.slots) if (st.type && !st.built) things.push(scaffold);
      if (centre) {
        const homes = Math.min(10, Math.max(1, Math.round(c.pop / 600)));
        for (let k = 0; k < homes; k++) things.push(home);
      }
      const used = things.slice(0, spots.length);
      used.forEach((make, k) => {
        const [px, pz, rot, scale] = spots[k];
        const sub = new THREE.Group();
        sub.position.set(px, 0.01, pz);
        sub.rotation.y = rot;
        sub.scale.setScalar(landmarks.has(make) && k > 0 ? scale * 1.7 : scale);
        const rr = rng(d.id * 131 + k * 17);
        const ground = make(sub, rr) || C.grass;
        // its own patch of ground: paving, a field, a yard
        const patch = add(
          sub,
          new THREE.CylinderGeometry(0.62, 0.66, 0.04, 7),
          ground,
          0,
          -0.01,
          0,
        );
        patch.castShadow = false;
        grp.add(sub);
        // a path to the middle of the place
        // the inner ring only: lanes, not spokes
        if (k > 0 && k <= 6 && Math.hypot(px, pz) > 0.2) {
          const L = Math.hypot(px, pz);
          const path = add(
            grp,
            new THREE.BoxGeometry(L * 0.7, 0.01, 0.035),
            '#c9b892',
            px / 2,
            0.012,
            pz / 2,
          );
          path.rotation.y = -Math.atan2(pz, px);
          path.castShadow = false;
        }
      });
      if (centre) {
        flag(grp, 0.08, 0.2, -0.12, civ.color, 0.6);
        if (c.siege) {
          const ring = add(grp, new THREE.TorusGeometry(0.98, 0.035, 4, 32), '#a02a1e', 0, 0.08, 0);
          ring.rotation.x = Math.PI / 2;
        }
      }
    }
    // a settlement whose districts are unknown or missing still shows its centre
    if (!hexes.some(d => d.hex === c.hex) && known[c.hex]) {
      const [x, z] = centerUnit(g, c.hex);
      const grp = new THREE.Group();
      grp.position.set(x, this.top(s, c.hex), z);
      root.add(grp);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + r() * 0.4;
        house(grp, Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0.2, 0.15, 0.13, { rot: a });
      }
      flag(grp, 0, 0, 0, civ.color, 0.55);
    }
    return bakedMesh(root);
  }

  // ---------------------------------------------------------------- troops

  private unitKey(s: GameState, f: Formation, big: boolean) {
    const pack = packOf(s, f)?.kind ?? '';
    return `${f.kind}|${Math.min(4, Math.ceil(f.cohorts.length / 3))}|${s.civs[f.civId].color}|${troopLook(f)}|${big}|${pack}`;
  }

  private buildUnit(s: GameState, f: Formation, big: boolean): THREE.Object3D {
    const grp = new THREE.Group();
    const col = s.civs[f.civId].color;
    if (f.kind === 'fleet') {
      boat(grp, 0, 0, 0.6, 2.6);
      flag(grp, 0, 0.32, 0, col, 0.18);
    } else {
      const pack = packOf(s, f)?.kind;
      // wild beasts stand as beasts; everyone else in the formation's own gear, one to four
      if (pack && pack !== 'guardians') buildBeasts(grp, pack, f.cohorts.length);
      else {
        buildTroops(grp, f, col);
        flag(grp, -0.16, 0, -0.12, col, 0.4);
      }
    }
    // a round base in the people's colour: whose troops these are, at a glance
    // the hex's main formation stands on a base filling almost the whole hex (inner radius
    // 0.87 on the map, about 0.84 with its outline); others on the hex get a smaller one
    nationBase(grp, col, big ? BIG_BASE : 0.12);
    // troops stand much larger than life, as in most strategy maps, so they read at a glance
    const unit = bakedMesh(grp) ?? grp;
    unit.scale.setScalar(UNIT_SCALE);
    return unit;
  }

  // ---------------------------------------------------------------- drawing

  draw(s: GameState, civId: number, ov: Overlay) {
    const g: Grid = { w: s.map.w, h: s.map.h };
    const known = s.civs[civId].explored;
    const vis = visibleHexes(s, civId);
    if (this.game !== s) {
      // a new or loaded game: start over
      this.game = s;
      for (const c of this.chunks.values()) c.mesh?.geometry.dispose();
      this.chunks.clear();
      this.landGroup.clear();
      this.cities.clear();
      this.camps.clear();
      this.ruinMeshes.clear();
      this.lairMeshes.clear();
      this.strengths.clear();
      this.cityGroup.clear();
      this.units.clear();
      this.unitGroup.clear();
      this.motion.reset();
      this.border.key = '';
      this.fogKey = '';
    }
    const zoom = this.cam.zoom;
    // ---- camera
    const tx = this.cam.x + this.w / 2 / zoom;
    const tz = (this.cam.y + this.h / 2 / zoom) / SIN;
    const tr = fx.currentTrauma();
    const t = performance.now() / 1000;
    const shX = tr > 0 ? (tr * tr * 9 * Math.sin(t * 47)) / zoom : 0,
      shZ = tr > 0 ? (tr * tr * 7 * Math.cos(t * 39)) / zoom : 0;
    const D = 60;
    this.camera.position.set(tx + shX, D * SIN, tz + shZ + D * COS);
    this.camera.lookAt(tx + shX, 0, tz + shZ);
    this.camera.left = -this.w / 2 / zoom;
    this.camera.right = this.w / 2 / zoom;
    this.camera.top = this.h / 2 / zoom;
    this.camera.bottom = -this.h / 2 / zoom;
    this.camera.near = -200;
    this.camera.far = 400;
    this.camera.updateProjectionMatrix();
    // the sun's shadows cover what is on screen
    const span = Math.max(this.w, this.h) / zoom;
    Object.assign(this.sun.shadow.camera, {
      left: -span,
      right: span,
      top: span,
      bottom: -span,
      near: 1,
      far: 120,
    });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.position.set(tx - 14, 30, tz + 12);
    this.sun.target.position.set(tx, 0, tz);
    this.sun.castShadow = zoom >= 14;

    // ---- land chunks in view (and a margin), built a few per frame
    const wx0 = this.cam.x - 2,
      wx1 = this.cam.x + this.w / zoom + 2;
    const wz0 = this.cam.y / SIN - 3,
      wz1 = (this.cam.y + this.h / zoom) / SIN + 3;
    const c0 = Math.max(0, Math.floor(wx0 / SQRT3 / CHUNK)),
      c1 = Math.min(Math.ceil(g.w / CHUNK) - 1, Math.floor(wx1 / SQRT3 / CHUNK));
    const r0 = Math.max(0, Math.floor(wz0 / 1.5 / CHUNK)),
      r1 = Math.min(Math.ceil(g.h / CHUNK) - 1, Math.floor(wz1 / 1.5 / CHUNK));
    let budget = 3;
    let more = false;
    for (let cy = r0; cy <= r1; cy++)
      for (let cx = c0; cx <= c1; cx++) {
        const id = `${cx},${cy}`;
        const key = this.chunkKey(s, civId, cx, cy);
        const have = this.chunks.get(id);
        if (have && have.key === key) continue;
        if (budget-- <= 0) {
          more = true;
          continue;
        }
        if (have?.mesh) {
          this.landGroup.remove(have.mesh);
          have.mesh.geometry.dispose();
        }
        const mesh = this.buildChunk(s, civId, cx, cy);
        if (mesh) this.landGroup.add(mesh);
        this.chunks.set(id, { key, mesh });
      }

    // ---- borders
    const bkey = `${s.turn}|${s.cities.map(c => c.civId + ':' + c.hex).join(',')}|${known.reduce((a, v) => a + v, 0)}`;
    if (bkey !== this.border.key) {
      if (this.border.mesh) {
        this.landGroup.remove(this.border.mesh);
        this.border.mesh.geometry.dispose();
      }
      const own = territory(s);
      const root = new THREE.Group();
      for (let i = 0; i < g.w * g.h; i++) {
        const o = own[i];
        if (o < 0 || !known[i]) continue;
        const [x, z] = centerUnit(g, i);
        const y = Math.max(this.top(s, i), 0) + 0.04;
        for (const n of neighbors(g, i)) {
          if (own[n] === o) continue;
          const [nx, nz] = centerUnit(g, n);
          const dx = (nx - x) / 2,
            dz = (nz - z) / 2;
          const b = add(
            root,
            new THREE.BoxGeometry(0.09, 0.05, 0.98),
            s.civs[o].color,
            x + dx * 0.9,
            y,
            z + dz * 0.9,
          );
          b.rotation.y = -Math.atan2(dz, dx);
        }
      }
      this.border = { key: bkey, mesh: bakedMesh(root, false) };
      if (this.border.mesh) this.landGroup.add(this.border.mesh);
    }

    // ---- fog: land known but not seen lies under a light mist
    let fk = 0;
    for (let i = 0; i < vis.length; i++) if (known[i] && !vis[i]) fk = (fk * 31 + i) | 0;
    if (`${fk}` !== this.fogKey) {
      this.fogKey = `${fk}`;
      if (this.fog) {
        this.scene.remove(this.fog);
        this.fog.dispose();
      }
      const list: number[] = [];
      for (let i = 0; i < vis.length; i++) if (known[i] && !vis[i]) list.push(i);
      const mist = new THREE.MeshBasicMaterial({
        color: '#efe7d6',
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      });
      this.fog = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(1.0, 1.0, 0.02, 6),
        mist,
        Math.max(1, list.length),
      );
      this.fog.count = list.length;
      const mtx = new THREE.Matrix4();
      list.forEach((i, k) => {
        const [x, z] = centerUnit(g, i);
        mtx.makeTranslation(x, this.top(s, i) + 0.95, z);
        this.fog!.setMatrixAt(k, mtx);
      });
      this.fog.renderOrder = 2;
      this.scene.add(this.fog);
    }

    // ---- settlements
    // built on demand: those in view first, nearest the centre, a few per frame
    const seen = new Set<number>();
    const inView = (hex: number) => {
      const [x, z] = centerUnit(g, hex);
      return x > wx0 - 2 && x < wx1 + 2 && z > wz0 - 2 && z < wz1 + 2;
    };
    const todo: { c: City; key: string; d: number }[] = [];
    for (const c of s.cities) {
      seen.add(c.id);
      if (!known[c.hex] && !cityDistricts(s, c).some(d => known[d.hex])) continue;
      const have = this.cities.get(c.id);
      if (have && !inView(c.hex)) continue;
      const key = this.cityKey(s, c, known);
      if (have && have.key === key) continue;
      if (!inView(c.hex)) continue;
      const [x, z] = centerUnit(g, c.hex);
      todo.push({ c, key, d: Math.hypot(x - tx, z - tz) });
    }
    todo.sort((a, b) => a.d - b.d);
    for (const [k, { c, key }] of todo.entries()) {
      if (k >= 6) {
        more = true;
        break;
      }
      const have = this.cities.get(c.id);
      if (have?.mesh) this.cityGroup.remove(have.mesh);
      const mesh = this.buildCity(s, c, known);
      if (mesh) this.cityGroup.add(mesh);
      this.cities.set(c.id, { key, mesh });
    }
    for (const [id, v] of this.cities)
      if (!seen.has(id)) {
        if (v.mesh) this.cityGroup.remove(v.mesh);
        this.cities.delete(id);
      }

    // ---- raider camps: tents and a fire, where the player has looked
    const campHexes = new Set((s.raiders?.camps ?? []).filter(c => known[c.hex]).map(c => c.hex));
    for (const [h, m] of this.camps)
      if (!campHexes.has(h)) {
        this.cityGroup.remove(m);
        this.camps.delete(h);
      }
    for (const h of campHexes) {
      if (this.camps.has(h)) continue;
      const grp = new THREE.Group();
      const [x, z] = centerUnit(g, h);
      grp.position.set(x, this.top(s, h), z);
      grp.scale.setScalar(1.6);
      const r = rng(h * 31 + 7);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + r() * 0.6;
        cone(
          grp,
          0.12,
          0.2,
          k % 2 ? '#7a5a3a' : '#5d4630',
          Math.cos(a) * 0.3,
          0,
          Math.sin(a) * 0.3,
          4,
        );
      }
      cyl(grp, 0.08, 0.1, 0.03, C.dark, 0, 0, 0, 6);
      cone(grp, 0.05, 0.12, '#e8892f', 0, 0.03, 0, 5);
      add(grp, new THREE.BoxGeometry(0.02, 0.4, 0.02), C.timber, 0.16, 0.2, -0.05);
      add(grp, new THREE.PlaneGeometry(0.16, 0.1), '#3b3430', 0.24, 0.35, -0.05, {
        side: THREE.DoubleSide,
      });
      const mesh = bakedMesh(grp) ?? grp;
      this.cityGroup.add(mesh);
      this.camps.set(h, mesh);
    }

    // ---- ruins: broken columns where the player has looked, until searched
    const ruinHexes = new Set((s.ruins ?? []).filter(r => known[r.hex]).map(r => r.hex));
    for (const [h, m] of this.ruinMeshes)
      if (!ruinHexes.has(h)) {
        this.cityGroup.remove(m);
        this.ruinMeshes.delete(h);
      }
    for (const h of ruinHexes) {
      if (this.ruinMeshes.has(h)) continue;
      const grp = new THREE.Group();
      const [x, z] = centerUnit(g, h);
      grp.position.set(x, this.top(s, h), z);
      grp.scale.setScalar(1.8);
      const r = rng(h * 53 + 11);
      box(grp, 0.5, 0.04, 0.36, C.stone2, 0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const ht = 0.12 + r() * 0.22;
        cyl(grp, 0.035, 0.04, ht, C.stone, -0.18 + k * 0.12, 0.04, -0.1, 6);
      }
      const fallen = cyl(grp, 0.035, 0.035, 0.26, C.stone, 0.05, 0.08, 0.12, 6);
      fallen.rotation.z = Math.PI / 2;
      ball(grp, 0.05, C.stone2, -0.22, 0.06, 0.12);
      // a treasure chest at the foot of the columns, its lid ajar and gold showing
      box(grp, 0.16, 0.08, 0.1, '#7a4a26', 0.17, 0.04, 0.1);
      box(grp, 0.17, 0.012, 0.11, '#c79a3e', 0.17, 0.1, 0.1);
      const lid = box(grp, 0.16, 0.04, 0.1, '#8a5630', 0.17, 0.12, 0.05);
      lid.rotation.x = -0.6;
      for (let k = 0; k < 3; k++) ball(grp, 0.022, '#f0c43a', 0.12 + k * 0.05, 0.12, 0.12);
      const mesh = bakedMesh(grp) ?? grp;
      this.cityGroup.add(mesh);
      this.ruinMeshes.set(h, mesh);
    }

    // ---- lairs of wild beasts: a den of rocks with a dark mouth and old bones
    const lairHexes = new Set(
      lairsSeenBy(s, civId)
        .filter(l => l.kind !== 'guardians')
        .map(l => l.hex),
    );
    for (const [h, m] of this.lairMeshes)
      if (!lairHexes.has(h)) {
        this.cityGroup.remove(m);
        this.lairMeshes.delete(h);
      }
    for (const h of lairHexes) {
      if (this.lairMeshes.has(h)) continue;
      const grp = new THREE.Group();
      const [x, z] = centerUnit(g, h);
      grp.position.set(x - 0.45, this.top(s, h), z - 0.4);
      grp.scale.setScalar(1.5);
      const r = rng(h * 71 + 3);
      for (let k = 0; k < 4; k++) {
        const a = Math.PI * (0.2 + k * 0.35);
        rock(grp, Math.cos(a) * 0.12, -Math.sin(a) * 0.1, 0.07 + r() * 0.04, '#857b6c');
      }
      const mouth = add(grp, new THREE.CircleGeometry(0.06, 6), '#1e1a16', 0, 0.06, 0.02, {
        side: THREE.DoubleSide,
      });
      mouth.rotation.y = 0;
      for (let k = 0; k < 3; k++) {
        const b = cyl(grp, 0.008, 0.008, 0.08, '#efe8d8', 0.05 + k * 0.04, 0, 0.12, 4);
        b.rotation.z = Math.PI / 2 + (r() - 0.5);
      }
      const mesh = bakedMesh(grp) ?? grp;
      this.cityGroup.add(mesh);
      this.lairMeshes.set(h, mesh);
    }

    // ---- troops: the player's own everywhere, others where the player sees them
    const shown = new Set<number>();
    const stack = new Map<number, number>();
    const SPOTS = [
      [0.3, 0.32],
      [-0.36, 0.26],
      [0.02, -0.42],
    ];
    const cityHex = new Set(s.cities.map(c => c.hex));
    for (const f of s.formations) {
      if (f.aboard !== undefined || !known[f.hex]) continue;
      if (f.civId !== civId && !vis[f.hex]) continue;
      const k = stack.get(f.hex) ?? 0;
      stack.set(f.hex, k + 1);
      if (k >= SPOTS.length) continue;
      shown.add(f.id);
      // the first formation on an open hex stands in its middle on the big base; a second or
      // third, or any in a settlement (whose buildings fill the middle), stand to the side
      const city = cityHex.has(f.hex);
      const big = k === 0 && !city;
      const key = this.unitKey(s, f, big);
      let u = this.units.get(f.id);
      if (!u || u.key !== key) {
        if (u) this.unitGroup.remove(u.mesh);
        u = { key, mesh: this.buildUnit(s, f, big) };
        this.units.set(f.id, u);
        this.unitGroup.add(u.mesh);
      }
      const [hx, hz] = centerUnit(g, f.hex);
      const off = city
        ? [SPOTS[k][0] * 1.1, SPOTS[k][1] + 0.5]
        : big
          ? [0, 0]
          : [SPOTS[k - 1][0] * 1.25, SPOTS[k - 1][1] * 1.25];
      const last = this.motion.lastHex(f.id);
      const dist = last === undefined ? 0 : distance(g, last, f.hex);
      const [x, z] = this.motion.place(f.id, f.hex, hx + off[0], hz + off[1], dist);
      const y =
        Math.max(this.top(s, f.hex), isWater(s.map.terrain[f.hex]) ? -0.1 : 0) +
        (big ? 0.05 : 0.11);
      u.mesh.position.set(x, y, z);
      u.mesh.visible = true;
    }
    for (const [id, u] of this.units)
      if (!shown.has(id)) {
        this.unitGroup.remove(u.mesh);
        this.units.delete(id);
      }

    // ---- overlays: selection, hover, reach, path, target
    const okey = JSON.stringify([
      ov.selectedFormation,
      ov.selectedHex,
      ov.hoverHex,
      ov.target,
      ov.path,
      [...(ov.reach ?? [])].length,
      s.formations.find(f => f.id === ov.selectedFormation)?.hex,
    ]);
    if (okey !== this.overlay.key) {
      this.overlay.key = okey;
      const grp = this.overlay.group;
      grp.traverse(o => (o as THREE.Mesh).geometry?.dispose());
      grp.clear();
      const ring = (hex: number, colour: string, r = 0.62, w = 0.035) => {
        const [x, z] = centerUnit(g, hex);
        const m = add(
          grp,
          new THREE.TorusGeometry(r, w, 4, 32),
          colour,
          x,
          Math.max(this.top(s, hex), 0) + 0.07,
          z,
          { emissive: colour, emissiveIntensity: 0.35 },
        );
        m.rotation.x = Math.PI / 2;
        m.castShadow = false;
      };
      const outline = (hex: number, colour: string, opacity = 1) => {
        const [x, z] = centerUnit(g, hex);
        const y = Math.max(this.top(s, hex), 0) + 0.06;
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k <= 6; k++) {
          const a = ((60 * k - 30) * Math.PI) / 180;
          pts.push(new THREE.Vector3(x + Math.cos(a) * 0.96, y, z + Math.sin(a) * 0.96));
        }
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: colour, transparent: opacity < 1, opacity }),
        );
        grp.add(line);
      };
      const cap = (hex: number, colour: string, opacity: number) => {
        const [x, z] = centerUnit(g, hex);
        const m = new THREE.Mesh(
          new THREE.CylinderGeometry(0.95, 0.95, 0.02, 6),
          new THREE.MeshBasicMaterial({
            color: colour,
            transparent: true,
            opacity,
            depthWrite: false,
          }),
        );
        m.position.set(x, Math.max(this.top(s, hex), 0) + 0.04, z);
        m.renderOrder = 3;
        grp.add(m);
      };
      for (const h of ov.reach ?? []) cap(h, '#fbf3d2', 0.28);
      if (ov.hoverHex !== undefined && ov.hoverHex >= 0) outline(ov.hoverHex, '#fffaf0', 0.9);
      const sel =
        ov.selectedFormation !== undefined
          ? s.formations.find(f => f.id === ov.selectedFormation)
          : undefined;
      if (sel) ring(sel.hex, '#c79a3e');
      else if (ov.selectedHex !== undefined && ov.selectedHex >= 0)
        outline(ov.selectedHex, '#c79a3e');
      if (ov.target !== undefined && ov.target >= 0) ring(ov.target, '#b23a2a', 0.7, 0.045);
      const path = ov.path ?? sel?.path ?? [];
      let prev = sel?.hex ?? -1;
      path.forEach((h, k) => {
        if (prev >= 0) {
          const [ax, az] = centerUnit(g, prev),
            [bx, bz] = centerUnit(g, h);
          const y = Math.max(this.top(s, prev), this.top(s, h), 0) + 0.07;
          for (let q = 0.2; q < 1; q += 0.2) {
            const dot = add(
              grp,
              new THREE.CylinderGeometry(0.05, 0.05, 0.02, 8),
              '#c79a3e',
              ax + (bx - ax) * q,
              y,
              az + (bz - az) * q,
              { emissive: '#c79a3e', emissiveIntensity: 0.35 },
            );
            dot.castShadow = false;
          }
        }
        if (k === path.length - 1) ring(h, '#c79a3e', 0.4, 0.03);
        prev = h;
      });
    }

    this.renderer.render(this.scene, this.camera);
    const playing = fx.tick();
    this.drawLabels(s, civId, vis, known, ov);
    this.wantsFrame = more || playing || this.motion.active;
    this.wantsSettle = false;
  }

  /** Names over settlements, cohort counts by troops, and battle effects. */
  private drawLabels(s: GameState, civId: number, vis: Uint8Array, known: number[], ov?: Overlay) {
    const ctx = this.lctx;
    const g = { w: s.map.w, h: s.map.h };
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const zoom = this.cam.zoom;
    // settlement banners
    if (zoom >= 14) {
      const fs = Math.max(10, Math.min(15, zoom * 0.26));
      ctx.font = `600 ${fs}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const c of s.cities) {
        if (!known[c.hex]) continue;
        const [x, z] = centerUnit(g, c.hex);
        const [sx, sy] = this.project(x, this.top(s, c.hex), z + 0.95);
        if (sx < -100 || sy < -40 || sx > this.w + 100 || sy > this.h + 40) continue;
        const text = `${c.name}${c.colony ? ' (colony)' : ''}  ${(c.pop / 1000).toFixed(1)}k${c.siege ? ' ⚔' : ''}`;
        const bs = fs * 1.5; // the badge at the front of the tag
        const w = ctx.measureText(text).width + 16 + bs * 0.7;
        ctx.fillStyle = 'rgba(247,241,227,0.94)';
        ctx.strokeStyle = s.civs[c.civId].color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(sx - w / 2, sy - fs * 0.8, w, fs * 1.6, 5);
        ctx.fill();
        ctx.stroke();
        this.badge(ctx, s.civs[c.civId], sx - w / 2 - bs * 0.25, sy - bs * 0.55, bs);
        ctx.fillStyle = '#2a2419';
        ctx.font = `600 ${fs}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillText(text, sx + bs * 0.35 + 2, sy);
      }
    } else {
      // strategic view: small names, the bigger settlements first, none drawn over another
      ctx.font = `600 11px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      const taken: [number, number, number, number][] = [];
      const order = s.cities.filter(c => known[c.hex]).sort((a, b) => b.pop - a.pop);
      for (const c of order) {
        const [x, z] = centerUnit(g, c.hex);
        const [sx, sy] = this.project(x, this.top(s, c.hex), z + 0.7);
        if (sx < -60 || sy < -20 || sx > this.w + 60 || sy > this.h + 20) continue;
        const w = ctx.measureText(c.name).width + 4;
        const box: [number, number, number, number] = [sx - w / 2, sy - 7, sx + w / 2, sy + 7];
        if (taken.some(t => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1]))
          continue;
        taken.push(box);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(250,245,232,0.9)';
        ctx.strokeText(c.name, sx, sy);
        ctx.fillStyle = s.civs[c.civId].color;
        ctx.fillText(c.name, sx, sy);
      }
    }
    // the rail and power lens: each of the player's settlements says what its industry lacks
    if (ov?.lens === 'industry') {
      ctx.font = `600 12px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const c of s.cities) {
        if (c.civId !== civId) continue;
        const [x, z] = centerUnit(g, c.hex);
        const [sx, sy] = this.project(x, this.top(s, c.hex), z + 0.95);
        if (sx < -100 || sy < -40 || sx > this.w + 100 || sy > this.h + 60) continue;
        const key = `${s.turn}|${s.cities.length}|${c.id}`;
        let st = this.industry.get(c.id);
        if (!st || st.key !== key) {
          st = { key, ...industryStatus(s, c) };
          this.industry.set(c.id, st);
        }
        const parts = [
          st.rail ? 'rail ✓' : 'no rail',
          st.makesPower ? `power +${st.makesPower}` : st.power ? `power −${st.power}` : '',
          st.fuel === null ? 'no fuel' : '',
          st.short.length ? `short: ${st.short.join(', ')}` : '',
        ].filter(Boolean);
        const bad = !st.rail || st.fuel === null || st.short.length > 0;
        const text = parts.join(' · ');
        const w = ctx.measureText(text).width + 14;
        ctx.fillStyle = bad ? 'rgba(160,42,30,0.92)' : 'rgba(43,106,95,0.92)';
        ctx.beginPath();
        ctx.roundRect(sx - w / 2, sy + 14, w, 20, 6);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(text, sx, sy + 24);
      }
    }
    // strength numbers by troops, in their people's colour (hidden at the strategic zoom):
    // a 250 most likely beats a 137, beasts and raiders included
    if (zoom >= 20) {
      const fs = Math.max(11, Math.min(15, zoom * 0.24));
      ctx.font = `bold ${fs}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const byId = new Map(s.formations.map(f => [f.id, f]));
      for (const [id, u] of this.units) {
        const f = byId.get(id);
        if (!f || f.kind !== 'army') continue;
        const key = `${s.turn}|${f.cohorts.length}|${people(f)}|${troopLook(f)}|${f.cohorts.reduce((a, c) => a + c.xp, 0)}`;
        let st = this.strengths.get(id);
        if (!st || st.key !== key) {
          st = { key, n: formationStrength(s, f) };
          this.strengths.set(id, st);
        }
        if (!st.n) continue;
        const p = u.mesh.position;
        const [sx, sy] = this.project(p.x + 0.2 * UNIT_SCALE, p.y + 0.46 * UNIT_SCALE, p.z);
        if (sx < -40 || sy < -20 || sx > this.w + 40 || sy > this.h + 20) continue;
        const text = `${st.n}`;
        const w = Math.max(fs * 1.7, ctx.measureText(text).width + fs * 0.8);
        const h = fs * 1.35;
        const wild = s.civs[f.civId].raiders;
        ctx.fillStyle = wild ? '#5a2a1e' : s.civs[f.civId].color;
        ctx.beginPath();
        ctx.roundRect(sx - w / 2, sy - h / 2, w, h, h / 2);
        ctx.fill();
        ctx.strokeStyle = wild ? '#e0a040' : 'rgba(250,245,232,0.95)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'rgba(20,14,8,0.55)';
        ctx.strokeText(text, sx, sy + 0.5);
        ctx.fillStyle = '#fff';
        ctx.fillText(text, sx, sy + 0.5);
      }
    }
    // battle flashes and floating numbers
    for (const f of fx.flashes) {
      if (!vis[f.hex]) continue;
      const [x, z] = centerUnit(g, f.hex);
      const [sx, sy] = this.project(x, this.top(s, f.hex), z);
      const k = fx.flashAge(f);
      ctx.globalAlpha = (1 - k) * 0.7;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.ellipse(sx, sy, zoom * (0.9 + k * 0.3), zoom * (0.9 + k * 0.3) * SIN, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const f of fx.floats) {
      if (!vis[f.hex]) continue;
      const [x, z] = centerUnit(g, f.hex);
      const [sx, sy] = this.project(x + f.dx, this.top(s, f.hex) + 0.6, z);
      const k = fx.floatAge(f);
      const rise = reducedMotion() ? 0 : (1 - (1 - k) ** 2) * 36;
      const scale =
        k < 0.12 ? 0.6 + (k / 0.12) * 0.5 : k < 0.25 ? 1.1 - ((k - 0.12) / 0.13) * 0.1 : 1;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = `bold ${18 * scale}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(30,18,8,0.85)';
      ctx.strokeText(f.text, sx, sy - rise);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, sx, sy - rise);
      ctx.globalAlpha = 1;
    }
    void civId;
  }
}

/** Can this device draw the 3D map? */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
