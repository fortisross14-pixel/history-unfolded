/**
 * The settlement in low-poly 3D: each district a 3×3 plinth of tiles, one low-poly model per
 * building, scaffolding where something is being built, staked plots where nothing is, and
 * bare plots where a district may still be laid out. Ported from docs/ui-proposals/city-lowpoly.
 *
 * Every building goes through BUILDERS (by building id, with ALIAS for buildings that share a
 * look). To replace a procedural model with a real one later, swap its builder: nothing else
 * changes. Rendering happens on demand (no animation loop), so an open city screen costs nothing
 * while idle.
 */
import * as THREE from 'three';

export type Rng = () => number;
export type Builder = (g: THREE.Group, r: Rng) => string;

/** One district as the scene shows it; slots null = a plot where a district may still go. */
export interface DistrictView {
  id: number | null;
  name: string;
  slots: { type: string | null; built: boolean; group?: string }[] | null;
  /** where it stands around the centre (its real hex direction), in scene units */
  pos?: [number, number];
}
export interface CityView {
  key: string;
  seed: number;
  districts: DistrictView[];
  /** index in districts, and slot (null: the whole district) */
  selected?: { district: number; slot: number | null };
}
export type Pick = { district: number; slot: number | null };

// ---------------------------------------------------------------- materials and a small kit

const mats = new Map<string, THREE.MeshStandardMaterial>();
export const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => {
  const k = c + JSON.stringify(o);
  let m = mats.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: c,
      flatShading: true,
      roughness: 0.92,
      metalness: 0,
      ...o,
    });
    mats.set(k, m);
  }
  return m;
};
export function add(
  g: THREE.Object3D,
  geo: THREE.BufferGeometry,
  c: string,
  x = 0,
  y = 0,
  z = 0,
  o?: THREE.MeshStandardMaterialParameters,
) {
  const m = new THREE.Mesh(geo, M(c, o));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
export const box = (
  g: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  c: string,
  x = 0,
  y = 0,
  z = 0,
) => add(g, new THREE.BoxGeometry(w, h, d), c, x, y + h / 2, z);
export const cyl = (
  g: THREE.Object3D,
  r1: number,
  r2: number,
  h: number,
  c: string,
  x = 0,
  y = 0,
  z = 0,
  seg = 7,
) => add(g, new THREE.CylinderGeometry(r1, r2, h, seg), c, x, y + h / 2, z);
export const cone = (
  g: THREE.Object3D,
  r: number,
  h: number,
  c: string,
  x = 0,
  y = 0,
  z = 0,
  seg = 6,
) => add(g, new THREE.ConeGeometry(r, h, seg), c, x, y + h / 2, z);
export const ball = (g: THREE.Object3D, r: number, c: string, x = 0, y = 0, z = 0) =>
  add(g, new THREE.IcosahedronGeometry(r, 0), c, x, y, z);
export function prism(w: number, h: number, d: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** the palette of the Ivory Codex city */
export const C = {
  grass: '#a7b86f',
  grass2: '#94a95e',
  meadow: '#b6c47c',
  earth: '#b79e70',
  dirt: '#a68a5c',
  paved: '#cfc3a8',
  stone: '#c9c0ad',
  stone2: '#aaa08c',
  dark: '#6f675a',
  wall: '#efe4cc',
  wall2: '#e2d2b0',
  timber: '#7d5a36',
  wood: '#946b40',
  roof: '#b5583b',
  roof2: '#9c4a33',
  teal: '#2f6a60',
  gold: '#c79a3e',
  water: '#6f9fb0',
  leaf: '#6f8f45',
  leaf2: '#5b7b3a',
  pine: '#4f6e3c',
  wheat: '#d8b75a',
  wheat2: '#c9a447',
  white: '#f4efe3',
  pink: '#e0a59a',
  brown: '#7a5233',
  black: '#3a3530',
  slab: '#8c7a58',
  slabTop: '#a89268',
};
/** roof colours by building group, for buildings without a model of their own */
const GROUP_ROOF: Record<string, string> = {
  farming: '#9bb54a',
  forestry: '#4f7a3a',
  extraction: '#8a6b4e',
  craft: '#b0663a',
  services: '#5a86a8',
  commerce: '#c9962b',
  residential: '#b5838d',
  civic: '#6b4a8a',
};

export function house(
  g: THREE.Object3D,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  o: { wall?: string; roof?: string; rot?: number; roofH?: number } = {},
) {
  const { wall = C.wall, roof = C.roof, rot = 0, roofH = 0.16 } = o;
  const p = new THREE.Group();
  p.position.set(x, 0, z);
  p.rotation.y = rot;
  g.add(p);
  box(p, w, h, d, wall);
  add(p, prism(w + 0.05, roofH, d + 0.05), roof, 0, h, 0);
  // a door and windows on the front, a window on each side: small, but they make it a house
  if (w >= 0.18 && h >= 0.1) {
    box(p, Math.min(0.07, w * 0.2), h * 0.55, 0.012, '#5a3f28', 0, 0, d / 2 + 0.004);
    if (w >= 0.3)
      for (const sx of [-1, 1])
        box(p, 0.05, 0.045, 0.012, '#3d4f5c', sx * w * 0.3, h * 0.5, d / 2 + 0.004);
    if (d >= 0.2)
      for (const sx of [-1, 1])
        box(p, 0.012, 0.045, 0.05, '#3d4f5c', sx * (w / 2 + 0.004), h * 0.5, 0);
  }
  return p;
}

/** Life on a built plot in the close view: townsfolk, a barrel or crates, a lamp post. */
export function props(g: THREE.Object3D, ground: string, r: Rng) {
  const paved = ground === C.paved || ground === C.dirt || ground === C.earth;
  const people = paved ? 1 + Math.floor(r() * 3) : r() < 0.5 ? 1 : 0;
  const tunic = ['#7a5a9a', '#2f6a60', '#b5583b', '#c79a3e', '#5a86a8', '#6f8f45'];
  for (let k = 0; k < people; k++) {
    const x = (r() - 0.5) * 0.8,
      z = 0.3 + r() * 0.15;
    cyl(g, 0.018, 0.022, 0.06, tunic[Math.floor(r() * tunic.length)], x, 0, z, 6);
    ball(g, 0.016, '#e6c9a8', x, 0.075, z);
  }
  if (paved && r() < 0.6)
    cyl(g, 0.03, 0.03, 0.06, C.wood, -0.38 + r() * 0.1, 0, -0.38 + r() * 0.1, 7);
  if (paved && r() < 0.4)
    for (let k = 0; k < 2; k++)
      box(g, 0.06, 0.06, 0.06, k ? C.wheat2 : C.wood, 0.36 - k * 0.07, 0, 0.38);
  if (paved && r() < 0.35) {
    cyl(g, 0.006, 0.006, 0.2, C.black, 0.42, 0, -0.42, 4);
    ball(g, 0.018, '#f3d28a', 0.42, 0.21, -0.42);
  }
}
export function tree(
  g: THREE.Object3D,
  x: number,
  z: number,
  s = 1,
  kind = 'leaf',
  r: Rng = Math.random,
) {
  cyl(g, 0.022 * s, 0.03 * s, 0.12 * s, C.timber, x, 0, z, 5);
  if (kind === 'pine') {
    cone(g, 0.11 * s, 0.22 * s, C.pine, x, 0.08 * s, z, 6);
    cone(g, 0.08 * s, 0.18 * s, C.pine, x, 0.2 * s, z, 6);
  } else ball(g, 0.12 * s, r() < 0.5 ? C.leaf : C.leaf2, x, 0.2 * s, z);
}
export function rock(g: THREE.Object3D, x: number, z: number, s: number, c = C.stone2) {
  const m = add(g, new THREE.DodecahedronGeometry(s, 0), c, x, s * 0.45, z);
  m.scale.y = 0.7;
  m.rotation.y = x * 7;
}
function fence(g: THREE.Object3D, pts: [number, number][], c = C.wood) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz);
    const n = Math.max(2, Math.round(L / 0.14));
    for (let k = 0; k <= n; k++)
      box(g, 0.022, 0.08, 0.022, c, a[0] + (dx * k) / n, 0, a[1] + (dz * k) / n);
    const rail = box(g, L, 0.014, 0.014, c, (a[0] + b[0]) / 2, 0.055, (a[1] + b[1]) / 2);
    rail.rotation.y = -Math.atan2(dz, dx);
  }
}
function animal(
  g: THREE.Object3D,
  x: number,
  z: number,
  c: string,
  s = 1,
  rot = 0,
  head = C.black,
) {
  const p = new THREE.Group();
  p.position.set(x, 0, z);
  p.rotation.y = rot;
  g.add(p);
  box(p, 0.12 * s, 0.06 * s, 0.06 * s, c, 0, 0.035 * s, 0);
  box(p, 0.045 * s, 0.045 * s, 0.045 * s, head, 0.07 * s, 0.06 * s, 0);
  for (const [a, b] of [
    [-0.04, -0.02],
    [-0.04, 0.02],
    [0.04, -0.02],
    [0.04, 0.02],
  ])
    box(p, 0.012 * s, 0.035 * s, 0.012 * s, head, a * s, 0, b * s);
}
function sheep(g: THREE.Object3D, x: number, z: number) {
  ball(g, 0.045, C.white, x, 0.05, z);
  box(g, 0.025, 0.03, 0.025, C.black, x + 0.045, 0.055, z);
}
const water = (g: THREE.Object3D, x: number, z: number, w: number, d: number) =>
  box(g, w, 0.02, d, C.water, x, -0.005, z);
export function boat(g: THREE.Object3D, x: number, z: number, rot = 0, s = 1) {
  const p = new THREE.Group();
  p.position.set(x, 0.015, z);
  p.rotation.y = rot;
  g.add(p);
  const h = add(p, prism(0.08 * s, 0.05 * s, 0.26 * s), C.wood);
  h.rotation.z = Math.PI;
  h.position.y = 0.05 * s;
  box(p, 0.012, 0.2 * s, 0.012, C.timber, 0, 0.05 * s, 0);
  add(p, new THREE.PlaneGeometry(0.1 * s, 0.12 * s), C.white, 0, 0.17 * s, 0, {
    side: THREE.DoubleSide,
  });
}
function columns(
  g: THREE.Object3D,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  n: number,
) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    cyl(g, 0.022, 0.022, h, C.white, x - w / 2 + t * w, 0, z + d / 2, 7);
  }
}
function chimney(g: THREE.Object3D, x: number, y: number, z: number, h = 0.14, c = C.stone2) {
  box(g, 0.05, h, 0.05, c, x, y, z);
  ball(g, 0.04, '#d9d2c4', x, y + h + 0.05, z).scale.set(1, 0.7, 1);
  ball(g, 0.03, '#e6e0d4', x + 0.03, y + h + 0.11, z - 0.02);
}
export function flag(g: THREE.Object3D, x: number, y: number, z: number, c = C.teal, h = 0.26) {
  cyl(g, 0.007, 0.007, h, C.timber, x, y, z, 4);
  add(g, new THREE.PlaneGeometry(0.1, 0.06), c, x + 0.05, y + h - 0.04, z, {
    side: THREE.DoubleSide,
  });
}
function pile(g: THREE.Object3D, x: number, z: number, c: string, n = 5, r: Rng = Math.random) {
  for (let i = 0; i < n; i++)
    rock(g, x + (r() - 0.5) * 0.12, z + (r() - 0.5) * 0.12, 0.03 + r() * 0.02, c);
}
function mineMound(g: THREE.Object3D, ore: string, r: Rng) {
  const m = add(g, new THREE.DodecahedronGeometry(0.36, 0), C.stone2, -0.08, 0.02, -0.12);
  m.scale.set(1.1, 0.62, 0.9);
  rock(g, 0.2, -0.25, 0.1, C.dark);
  box(g, 0.14, 0.13, 0.06, C.black, -0.02, 0, 0.16);
  box(g, 0.18, 0.03, 0.08, C.timber, -0.02, 0.13, 0.17);
  box(g, 0.025, 0.13, 0.025, C.timber, -0.09, 0, 0.18);
  box(g, 0.025, 0.13, 0.025, C.timber, 0.05, 0, 0.18);
  for (let i = 0; i < 4; i++) box(g, 0.03, 0.01, 0.12, C.timber, -0.02, 0, 0.26 + i * 0.06);
  pile(g, 0.2, 0.36, ore, 4, r);
  pile(g, -0.3, 0.3, ore, 6, r);
}
function factory(g: THREE.Object3D, roof = C.dark) {
  box(g, 0.7, 0.22, 0.5, '#b9876a', 0, 0, -0.05);
  for (let i = 0; i < 3; i++) add(g, prism(0.24, 0.1, 0.5), roof, -0.23 + i * 0.23, 0.22, -0.05);
  for (const x of [0.22, 0.32]) {
    cyl(g, 0.035, 0.045, 0.5, '#8a5a45', x, 0, -0.28, 6);
    ball(g, 0.05, '#bdb5a6', x, 0.56, -0.28);
  }
  box(g, 0.3, 0.05, 0.12, C.timber, -0.2, 0, 0.34);
}

// ---------------------------------------------------------------- one builder per building

export const BUILDERS: Record<string, Builder> = {
  'town-hall': g => {
    box(g, 0.62, 0.05, 0.62, C.stone);
    box(g, 0.42, 0.24, 0.36, C.wall);
    add(g, new THREE.ConeGeometry(0.33, 0.2, 4), C.teal, 0, 0.34, 0).rotation.y = Math.PI / 4;
    box(g, 0.12, 0.16, 0.12, C.wall2, 0, 0.24, 0);
    add(g, new THREE.ConeGeometry(0.1, 0.14, 4), C.teal, 0, 0.47, 0).rotation.y = Math.PI / 4;
    flag(g, 0, 0.54, 0, C.roof);
    columns(g, 0, 0, 0.3, 0.36, 0.18, 4);
    return C.paved;
  },
  farm: (g, r) => {
    for (let i = 0; i < 6; i++)
      box(g, 0.9, 0.05 + r() * 0.02, 0.1, i % 2 ? C.wheat : C.wheat2, 0, 0, -0.38 + i * 0.15);
    cyl(g, 0.008, 0.008, 0.2, C.timber, 0.3, 0, 0, 4);
    box(g, 0.12, 0.012, 0.012, C.timber, 0.3, 0.15, 0);
    ball(g, 0.025, C.wheat2, 0.3, 0.2, 0);
    return C.earth;
  },
  pasture: (g, r) => {
    fence(g, [
      [-0.42, -0.42],
      [0.42, -0.42],
      [0.42, 0.42],
      [-0.42, 0.42],
      [-0.42, -0.42],
    ]);
    for (let i = 0; i < 4; i++)
      animal(
        g,
        -0.25 + r() * 0.5,
        -0.25 + r() * 0.5,
        r() < 0.5 ? C.brown : C.white,
        1.2,
        r() * 6,
        C.black,
      );
    for (let i = 0; i < 3; i++) sheep(g, -0.3 + r() * 0.6, -0.3 + r() * 0.6);
    tree(g, 0.3, -0.28, 0.9, 'leaf', r);
    return C.meadow;
  },
  'fishing-dock': g => {
    water(g, 0, 0.18, 1, 0.64);
    box(g, 0.1, 0.04, 0.6, C.wood, 0.05, 0, 0.12);
    for (let i = 0; i < 5; i++)
      box(g, 0.02, 0.08, 0.02, C.timber, (i % 2) * 0.1, -0.04, -0.14 + i * 0.13);
    boat(g, -0.22, 0.2, 0.3);
    boat(g, 0.3, 0.28, -0.4, 0.8);
    house(g, -0.2, -0.34, 0.24, 0.16, 0.12, { roof: C.wood });
    return C.earth;
  },
  granary: (g, r) => {
    for (const [x, z] of [
      [-0.16, -0.06],
      [0.18, 0.06],
    ]) {
      cyl(g, 0.15, 0.15, 0.26, C.wall2, x, 0, z, 9);
      cone(g, 0.19, 0.14, C.roof, x, 0.26, z, 9);
    }
    box(g, 0.2, 0.12, 0.16, C.wall, 0, 0, 0.3);
    pile(g, -0.3, 0.3, C.wheat, 4, r);
    return C.dirt;
  },
  windmill: g => {
    cyl(g, 0.11, 0.17, 0.42, C.wall, 0, 0, 0, 8);
    cone(g, 0.15, 0.16, C.roof, 0, 0.42, 0, 8);
    const hub = new THREE.Group();
    hub.position.set(0, 0.4, 0.17);
    g.add(hub);
    for (let i = 0; i < 4; i++) {
      const s = box(hub, 0.05, 0.32, 0.008, C.white, 0, 0, 0);
      s.position.y = 0;
      s.geometry.translate(0, 0.16, 0);
      s.rotation.z = (i * Math.PI) / 2 + 0.3;
    }
    for (let i = 0; i < 3; i++)
      box(g, 0.9, 0.04, 0.1, C.wheat, 0, 0, -0.4 + i * 0.1 + (i > 1 ? 0.6 : 0));
    return C.earth;
  },
  woodlot: (g, r) => {
    for (let i = 0; i < 9; i++) {
      const x = -0.36 + (i % 3) * 0.33 + (r() - 0.5) * 0.1,
        z = -0.36 + Math.floor(i / 3) * 0.33 + (r() - 0.5) * 0.1;
      if (r() < 0.2) cyl(g, 0.04, 0.045, 0.04, C.wood, x, 0, z, 6);
      else tree(g, x, z, 1.1 + r() * 0.4, r() < 0.5 ? 'pine' : 'leaf', r);
    }
    return C.grass2;
  },
  'lumber-mill': g => {
    water(g, 0.36, 0, 0.28, 1);
    house(g, -0.05, -0.05, 0.42, 0.3, 0.2, { wall: C.wood, roof: C.roof2 });
    const w = cyl(g, 0.15, 0.15, 0.05, C.timber, 0.21, 0.02, -0.05, 10);
    w.rotation.z = Math.PI / 2;
    for (let k = 0; k < 4; k++)
      cyl(g, 0.03, 0.03, 0.3, C.wood, -0.2, 0, 0.3 - k * 0.06, 6).rotation.z = Math.PI / 2;
    return C.dirt;
  },
  mine: (g, r) => {
    mineMound(g, '#5d5a5a', r);
    return C.dirt;
  },
  'kings-mine': (g, r) => {
    mineMound(g, '#d1a72f', r);
    flag(g, 0.3, 0, -0.32, C.gold);
    return C.dirt;
  },
  'hunting-lodge': (g, r) => {
    for (let i = 0; i < 5; i++) tree(g, -0.35 + r() * 0.7, -0.4 + r() * 0.25, 1.1, 'pine', r);
    house(g, 0, 0.12, 0.34, 0.24, 0.14, { wall: C.timber, roof: C.wood });
    return C.grass2;
  },
  plantation: g => {
    for (let i = 0; i < 4; i++)
      for (let k = 0; k < 5; k++)
        ball(g, 0.06, i % 2 ? '#4f7a3a' : '#5f8a44', -0.36 + k * 0.18, 0.05, -0.33 + i * 0.22);
    house(g, 0.33, 0.36, 0.18, 0.14, 0.1);
    return C.earth;
  },
  workshop: g => {
    house(g, -0.04, 0, 0.44, 0.32, 0.18, { wall: C.wall2 });
    chimney(g, 0.12, 0.2, -0.06);
    box(g, 0.14, 0.1, 0.12, C.wood, -0.3, 0, 0.3);
    box(g, 0.2, 0.06, 0.1, C.timber, 0.2, 0, 0.32);
    return C.paved;
  },
  armoury: g => {
    box(g, 0.5, 0.24, 0.34, C.stone);
    add(g, prism(0.55, 0.12, 0.39), C.roof2, 0, 0.24, 0);
    for (let i = 0; i < 3; i++)
      cyl(
        g,
        0.045,
        0.045,
        0.01,
        i % 2 ? C.teal : C.roof,
        -0.16 + i * 0.16,
        0.1,
        0.175,
        10,
      ).rotation.x = Math.PI / 2;
    chimney(g, 0.18, 0.24, -0.08, 0.1);
    return C.paved;
  },
  barracks: g => {
    house(g, 0, -0.22, 0.8, 0.24, 0.16, { roof: C.roof2 });
    box(g, 0.8, 0.01, 0.5, C.dirt, 0, 0, 0.18);
    for (let i = 0; i < 3; i++)
      for (let k = 0; k < 4; k++)
        box(g, 0.025, 0.06, 0.025, C.roof, -0.2 + k * 0.12, 0, 0.08 + i * 0.1);
    flag(g, 0.36, 0, 0.36, C.teal, 0.3);
    return C.earth;
  },
  shipyard: g => {
    water(g, 0, 0.25, 1, 0.5);
    box(g, 0.24, 0.03, 0.75, C.wood, -0.15, 0, -0.05);
    const hull = add(g, prism(0.2, 0.14, 0.5), C.timber, -0.15, 0.17, 0.05);
    hull.rotation.z = Math.PI;
    box(g, 0.03, 0.4, 0.03, C.timber, 0.25, 0, -0.3);
    box(g, 0.03, 0.03, 0.3, C.timber, 0.25, 0.4, -0.18);
    house(g, 0.3, -0.32, 0.22, 0.16, 0.12, { roof: C.roof2 });
    return C.dirt;
  },
  foundry: g => {
    box(g, 0.5, 0.22, 0.36, C.stone2, -0.05, 0, 0);
    add(g, prism(0.55, 0.1, 0.4), C.dark, -0.05, 0.22, 0);
    for (const x of [-0.22, 0.12]) {
      cyl(g, 0.04, 0.05, 0.4, C.dark, x, 0.1, -0.12, 6);
      ball(g, 0.05, '#bdb5a6', x, 0.58, -0.12);
    }
    box(g, 0.12, 0.08, 0.02, '#e0782f', -0.05, 0.02, 0.185);
    return C.dirt;
  },
  factory: g => {
    factory(g);
    return C.paved;
  },
  'railway-station': g => {
    box(g, 1, 0.02, 0.18, C.dark, 0, 0, 0.3);
    for (let i = 0; i < 8; i++) box(g, 0.04, 0.025, 0.22, C.timber, -0.45 + i * 0.13, 0, 0.3);
    for (const z of [0.25, 0.35]) box(g, 1, 0.02, 0.015, '#4a4540', 0, 0.025, z);
    box(g, 0.8, 0.06, 0.16, C.stone, 0, 0, 0.08);
    house(g, 0, -0.22, 0.62, 0.26, 0.2, { wall: '#b9876a', roof: C.dark });
    box(g, 0.08, 0.3, 0.08, '#b9876a', 0.26, 0, -0.22);
    return C.paved;
  },
  infirmary: (g, r) => {
    house(g, 0, 0, 0.5, 0.32, 0.18, { wall: C.white, roof: C.teal });
    tree(g, 0.33, 0.33, 0.8, 'leaf', r);
    return C.grass;
  },
  school: g => {
    house(g, 0, 0.05, 0.5, 0.3, 0.16, { roof: C.roof });
    box(g, 0.1, 0.16, 0.1, C.wall2, 0.18, 0.16, 0.05);
    add(g, new THREE.ConeGeometry(0.09, 0.12, 4), C.teal, 0.18, 0.38, 0.05).rotation.y =
      Math.PI / 4;
    return C.grass;
  },
  library: g => {
    box(g, 0.56, 0.2, 0.36, C.wall);
    box(g, 0.6, 0.03, 0.4, C.white, 0, 0.2, 0);
    add(
      g,
      new THREE.SphereGeometry(0.13, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
      C.teal,
      0,
      0.23,
      0,
    );
    columns(g, 0, 0, 0.46, 0.36, 0.2, 5);
    return C.paved;
  },
  university: (g, r) => {
    for (const [x, z, w, d] of [
      [0, -0.33, 0.86, 0.18],
      [-0.34, 0.05, 0.18, 0.6],
      [0.34, 0.05, 0.18, 0.6],
    ])
      house(g, x, z, w, d, 0.18, { wall: C.wall2, roof: C.roof2 });
    box(g, 0.12, 0.3, 0.12, C.wall2, 0, 0, -0.33);
    add(g, new THREE.ConeGeometry(0.1, 0.16, 4), C.teal, 0, 0.38, -0.33).rotation.y = Math.PI / 4;
    tree(g, 0, 0.12, 0.9, 'leaf', r);
    return C.grass;
  },
  'printing-house': g => {
    house(g, 0, 0, 0.32, 0.4, 0.26, { wall: C.wall, roof: C.roof2, roofH: 0.14 });
    chimney(g, 0.08, 0.28, 0.1, 0.08);
    return C.paved;
  },
  observatory: g => {
    cyl(g, 0.16, 0.2, 0.34, C.stone, 0, 0, 0, 8);
    add(
      g,
      new THREE.SphereGeometry(0.17, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      C.white,
      0,
      0.34,
      0,
    );
    cyl(g, 0.03, 0.03, 0.22, C.dark, 0.06, 0.4, 0, 6).rotation.z = -0.7;
    return C.grass;
  },
  market: g => {
    const cols = [C.roof, C.teal, C.gold, '#7a5a9a', C.roof2, '#5a86a8'];
    for (let i = 0; i < 6; i++) {
      const x = -0.28 + (i % 3) * 0.28,
        z = -0.18 + Math.floor(i / 3) * 0.36;
      box(g, 0.18, 0.06, 0.12, C.wood, x, 0, z);
      for (const [a, b] of [
        [-0.08, -0.05],
        [0.08, -0.05],
        [-0.08, 0.05],
        [0.08, 0.05],
      ])
        box(g, 0.012, 0.16, 0.012, C.timber, x + a, 0, z + b);
      add(g, prism(0.22, 0.06, 0.16), cols[i], x, 0.16, z).rotation.y = Math.PI / 2;
    }
    return C.paved;
  },
  bank: g => {
    box(g, 0.6, 0.04, 0.44, C.white);
    box(g, 0.5, 0.24, 0.32, C.wall, 0, 0.04, -0.02);
    add(g, prism(0.56, 0.1, 0.4), C.white, 0, 0.28, 0);
    columns(g, 0, 0.04, 0.44, 0.36, 0.24, 5);
    return C.paved;
  },
  'stock-exchange': g => {
    box(g, 0.74, 0.05, 0.6, C.white);
    box(g, 0.62, 0.3, 0.44, C.wall, 0, 0.05, -0.04);
    add(
      g,
      new THREE.SphereGeometry(0.18, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      C.teal,
      0,
      0.35,
      -0.04,
    );
    columns(g, 0, 0.05, 0.56, 0.46, 0.3, 6);
    flag(g, 0, 0.5, -0.04, C.gold);
    return C.paved;
  },
  harbour: g => {
    water(g, 0, 0.25, 1, 0.5);
    box(g, 1, 0.06, 0.12, C.stone, 0, -0.02, -0.02);
    boat(g, -0.15, 0.3, 1.5, 1.3);
    boat(g, 0.12, 0.36, 1.4, 1);
    for (let i = 0; i < 4; i++)
      box(g, 0.08, 0.08, 0.08, i % 2 ? C.wood : C.wheat2, -0.1 + i * 0.1, 0.04, -0.15);
    house(g, 0.28, -0.33, 0.3, 0.16, 0.13, { roof: C.roof2 });
    return C.paved;
  },
  'guild-hall': g => {
    house(g, 0, -0.02, 0.56, 0.36, 0.22, { wall: C.timber, roof: C.roof2, roofH: 0.2 });
    flag(g, 0, 0.42, -0.02, C.gold, 0.18);
    return C.paved;
  },
  houses: (g, r) => {
    const spots: [number, number][] = [
      [-0.22, -0.22],
      [0.2, -0.24],
      [-0.24, 0.2],
      [0.22, 0.2],
    ];
    spots.forEach(([x, z], i) =>
      house(g, x + (r() - 0.5) * 0.04, z, 0.26 + r() * 0.06, 0.2, 0.13 + r() * 0.06, {
        roof: r() < 0.6 ? C.roof : C.roof2,
        rot: (i % 2) * (Math.PI / 2),
        wall: r() < 0.5 ? C.wall : C.wall2,
      }),
    );
    tree(g, 0, 0, 0.7, 'leaf', r);
    return C.grass;
  },
  aqueduct: g => {
    for (let i = 0; i < 4; i++) box(g, 0.06, 0.34, 0.08, C.stone, -0.36 + i * 0.24, 0, 0);
    box(g, 0.9, 0.08, 0.1, C.stone, 0, 0.34, 0);
    box(g, 0.9, 0.02, 0.06, C.water, 0, 0.42, 0);
    return C.grass;
  },
  tenements: (g, r) => {
    for (const [x, z, h] of [
      [-0.2, -0.18, 0.42],
      [0.2, -0.18, 0.36],
      [-0.2, 0.2, 0.34],
      [0.2, 0.2, 0.46],
    ]) {
      box(g, 0.3, h, 0.28, r() < 0.5 ? C.wall2 : C.wall, x, 0, z);
      add(g, prism(0.34, 0.1, 0.32), C.roof2, x, h, z);
    }
    return C.paved;
  },
  shrine: (g, r) => {
    box(g, 0.36, 0.04, 0.36, C.stone);
    for (const [x, z] of [
      [-0.12, -0.12],
      [0.12, -0.12],
      [-0.12, 0.12],
      [0.12, 0.12],
    ])
      cyl(g, 0.02, 0.02, 0.18, C.white, x, 0.04, z, 6);
    add(g, new THREE.ConeGeometry(0.22, 0.1, 4), C.roof, 0, 0.22, 0).rotation.y = Math.PI / 4;
    for (let i = 0; i < 4; i++)
      tree(g, (i < 2 ? -1 : 1) * 0.36, (i % 2 ? -1 : 1) * 0.36, 0.8, 'leaf', r);
    return C.grass;
  },
  monument: g => {
    box(g, 0.36, 0.05, 0.36, C.stone);
    box(g, 0.22, 0.04, 0.22, C.white, 0, 0.05, 0);
    cyl(g, 0.04, 0.07, 0.5, C.white, 0, 0.09, 0, 4).rotation.y = Math.PI / 4;
    add(g, new THREE.ConeGeometry(0.05, 0.08, 4), C.gold, 0, 0.63, 0).rotation.y = Math.PI / 4;
    return C.grass;
  },
  walls: g => {
    box(g, 0.9, 0.2, 0.1, C.stone, 0, 0, 0.1);
    for (let i = 0; i < 5; i++) box(g, 0.07, 0.05, 0.11, C.stone, -0.4 + i * 0.2, 0.2, 0.1);
    cyl(g, 0.13, 0.14, 0.34, C.stone2, -0.3, 0, 0.1, 8);
    cone(g, 0.16, 0.14, C.roof2, -0.3, 0.34, 0.1, 8);
    return C.earth;
  },
  temple: g => {
    box(g, 0.66, 0.04, 0.5, C.stone);
    box(g, 0.44, 0.22, 0.32, C.wall, 0, 0.04, 0);
    add(g, prism(0.56, 0.12, 0.46), C.roof, 0, 0.26, 0).rotation.y = Math.PI / 2;
    columns(g, 0, 0.04, 0.5, 0.38, 0.22, 5);
    columns(g, 0, 0.04, 0.5, -0.42, 0.22, 5);
    return C.paved;
  },
  amphitheatre: g => {
    for (let i = 0; i < 4; i++)
      add(
        g,
        new THREE.CylinderGeometry(
          0.42 - i * 0.07,
          0.42 - i * 0.07,
          0.06,
          12,
          1,
          false,
          0,
          Math.PI,
        ),
        i % 2 ? C.stone : C.stone2,
        0,
        0.18 - i * 0.05,
        0.08,
      );
    return C.grass;
  },
  cathedral: g => {
    box(g, 0.24, 0.28, 0.66, C.stone, 0, 0, 0.05);
    add(g, prism(0.28, 0.16, 0.66), C.dark, 0, 0.28, 0.05);
    box(g, 0.5, 0.2, 0.18, C.stone, 0, 0, 0.08);
    box(g, 0.16, 0.5, 0.16, C.stone, 0, 0, -0.33);
    cone(g, 0.12, 0.3, C.dark, 0, 0.5, -0.33, 4).rotation.y = Math.PI / 4;
    return C.paved;
  },
  castle: g => {
    box(g, 0.7, 0.16, 0.7, C.stone2);
    box(g, 0.3, 0.34, 0.3, C.stone);
    for (const [x, z] of [
      [-0.32, -0.32],
      [0.32, -0.32],
      [-0.32, 0.32],
      [0.32, 0.32],
    ]) {
      cyl(g, 0.09, 0.1, 0.32, C.stone, x, 0, z, 8);
      cone(g, 0.12, 0.14, C.roof2, x, 0.32, z, 8);
    }
    flag(g, 0, 0.34, 0, C.roof, 0.22);
    return C.earth;
  },
  /** a plot with stakes and string: nothing planned here yet */
  empty: g => {
    for (const [x, z] of [
      [-0.3, -0.3],
      [0.3, -0.3],
      [-0.3, 0.3],
      [0.3, 0.3],
    ])
      box(g, 0.02, 0.08, 0.02, C.timber, x, 0, z);
    box(g, 0.6, 0.006, 0.006, C.white, 0, 0.06, -0.3);
    box(g, 0.6, 0.006, 0.006, C.white, 0, 0.06, 0.3);
    box(g, 0.006, 0.006, 0.6, C.white, -0.3, 0.06, 0);
    box(g, 0.006, 0.006, 0.6, C.white, 0.3, 0.06, 0);
    rock(g, 0.1, 0.05, 0.04);
    return C.dirt;
  },
};

/** Buildings that share a look with another (until they get their own model). */
const ALIAS: Record<string, string> = {
  cannery: 'workshop',
  sawmill: 'lumber-mill',
  'pumping-station': 'foundry',
  laboratory: 'observatory',
  mint: 'bank',
  smithy: 'workshop',
  tannery: 'workshop',
  weaver: 'workshop',
  engineers: 'workshop',
  'counting-house': 'guild-hall',
  'royal-granaries': 'granary',
  'royal-forest': 'woodlot',
  academy: 'university',
  'war-college': 'barracks',
  ironworks: 'factory',
  'paper-mill': 'factory',
  'power-plant': 'factory',
};
export const builderFor = (type: string) => BUILDERS[type] ?? BUILDERS[ALIAS[type] ?? ''];

/**
 * World wonders: landmarks bigger than any building, one shape per kind (see data/wonders.ts).
 * Drawn on a unit plot like other builders; the map draws them larger.
 */
export const WONDER_BUILDERS: Record<string, Builder> = {
  pyramid: g => {
    for (let i = 0; i < 5; i++)
      box(g, 0.8 - i * 0.16, 0.1, 0.8 - i * 0.16, i % 2 ? C.wheat2 : C.wheat, 0, i * 0.1, 0);
    box(g, 0.08, 0.06, 0.08, C.gold, 0, 0.5, 0);
    return C.earth;
  },
  garden: g => {
    for (let i = 0; i < 3; i++) {
      const w = 0.74 - i * 0.2;
      box(g, w, 0.12, w, C.stone, 0, i * 0.12, 0);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + i;
        ball(
          g,
          0.07,
          k % 2 ? C.leaf : C.leaf2,
          Math.cos(a) * w * 0.45,
          i * 0.12 + 0.15,
          Math.sin(a) * w * 0.45,
        );
      }
    }
    ball(g, 0.1, C.leaf, 0, 0.45, 0);
    return C.grass;
  },
  statue: g => {
    box(g, 0.34, 0.12, 0.34, C.stone, 0, 0, 0);
    cyl(g, 0.05, 0.06, 0.34, C.gold, -0.05, 0.12, 0, 6);
    cyl(g, 0.05, 0.06, 0.34, C.gold, 0.05, 0.12, 0, 6);
    cyl(g, 0.09, 0.07, 0.3, C.gold, 0, 0.46, 0, 7);
    ball(g, 0.07, C.gold, 0, 0.84, 0);
    const arm = cyl(g, 0.025, 0.025, 0.3, C.gold, 0.12, 0.7, 0, 5);
    arm.rotation.z = -0.4;
    cone(g, 0.05, 0.1, '#f2b84b', 0.2, 0.98, 0, 5);
    return C.paved;
  },
  tower: g => {
    cyl(g, 0.24, 0.3, 0.16, C.stone2, 0, 0, 0, 8);
    cyl(g, 0.16, 0.22, 0.5, C.stone, 0, 0.16, 0, 8);
    cyl(g, 0.11, 0.14, 0.28, C.wall, 0, 0.66, 0, 8);
    ball(g, 0.08, '#f6d36b', 0, 1.0, 0);
    cone(g, 0.12, 0.12, C.roof, 0, 1.06, 0, 8);
    return C.paved;
  },
  wall: g => {
    for (let i = -2; i <= 2; i++) {
      box(g, 0.2, 0.22, 0.12, C.stone, i * 0.18, 0, Math.sin(i) * 0.08);
      for (let k = 0; k < 2; k++)
        box(g, 0.05, 0.05, 0.12, C.stone2, i * 0.18 - 0.05 + k * 0.1, 0.22, Math.sin(i) * 0.08);
    }
    box(g, 0.2, 0.42, 0.2, C.stone2, -0.4, 0, -0.06);
    box(g, 0.2, 0.42, 0.2, C.stone2, 0.4, 0, 0.06);
    cone(g, 0.15, 0.16, C.roof2, -0.4, 0.42, -0.06, 4);
    cone(g, 0.15, 0.16, C.roof2, 0.4, 0.42, 0.06, 4);
    return C.grass2;
  },
  hall: g => {
    box(g, 0.86, 0.06, 0.6, C.stone, 0, 0, 0);
    box(g, 0.7, 0.3, 0.44, C.wall, 0, 0.06, 0);
    columns(g, 0, 0.06, 0.74, 0.46, 0.3, 8);
    add(g, prism(0.8, 0.14, 0.56), C.roof, 0, 0.36, 0).rotation.y = Math.PI / 2;
    box(g, 0.2, 0.18, 0.2, C.wall, 0, 0.44, 0);
    cone(g, 0.15, 0.14, C.gold, 0, 0.62, 0, 4);
    return C.paved;
  },
  dome: g => {
    box(g, 0.8, 0.06, 0.8, C.stone, 0, 0, 0);
    cyl(g, 0.3, 0.3, 0.3, C.wall, 0, 0.06, 0, 12);
    const d = add(
      g,
      new THREE.SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      C.gold,
      0,
      0.36,
      0,
    );
    d.scale.y = 0.9;
    cone(g, 0.03, 0.14, C.gold, 0, 0.62, 0, 5);
    for (const [x, z] of [
      [-0.34, -0.34],
      [0.34, -0.34],
      [-0.34, 0.34],
      [0.34, 0.34],
    ]) {
      cyl(g, 0.045, 0.05, 0.5, C.wall, x, 0.06, z, 6);
      cone(g, 0.05, 0.12, C.gold, x, 0.56, z, 6);
    }
    return C.paved;
  },
  spire: g => {
    box(g, 0.84, 0.06, 0.56, C.stone, 0, 0, 0);
    add(
      g,
      new THREE.CylinderGeometry(0.3, 0.3, 0.7, 10, 1, false, 0, Math.PI),
      '#bfd6dc',
      0,
      0.3,
      0,
      {
        transparent: true,
        opacity: 0.85,
      },
    ).rotation.z = Math.PI / 2;
    box(g, 0.72, 0.04, 0.5, C.dark, 0, 0.04, 0);
    cyl(g, 0.04, 0.05, 0.7, C.dark, 0.3, 0.06, -0.2, 6);
    cone(g, 0.05, 0.12, C.dark, 0.3, 0.76, -0.2, 6);
    return C.paved;
  },
};

/** a building of no model of its own: a hall with its group's roof */
export const generic =
  (group?: string): Builder =>
  g => {
    house(g, 0, 0, 0.5, 0.36, 0.2, { roof: GROUP_ROOF[group ?? ''] ?? C.roof });
    return C.paved;
  };

/** scaffolding over a plot: being built */
export const scaffold: Builder = g => {
  BUILDERS.empty(g, () => 0.5);
  for (const [x, z] of [
    [-0.2, -0.16],
    [0.2, -0.16],
    [-0.2, 0.16],
    [0.2, 0.16],
  ])
    box(g, 0.02, 0.3, 0.02, C.timber, x, 0, z);
  for (const y of [0.14, 0.28]) {
    box(g, 0.42, 0.015, 0.015, C.wood, 0, y, -0.16);
    box(g, 0.42, 0.015, 0.015, C.wood, 0, y, 0.16);
  }
  box(g, 0.36, 0.12, 0.28, C.wall2, 0, 0, 0);
  box(g, 0.03, 0.5, 0.03, C.timber, 0.36, 0, -0.34);
  box(g, 0.3, 0.02, 0.02, C.timber, 0.24, 0.5, -0.34);
  pile(g, -0.32, 0.32, C.stone, 3, () => 0.5);
  return C.dirt;
};

// ---------------------------------------------------------------- the centre row

/** Defences drawn as a ring round the centre's plinth, weakest first. */
const WALL_RING = ['palisade', 'walls', 'castle'];

/** A ring round the centre plinth: timber stakes, stone walls, or high walls with towers. */
function wallRing(g: THREE.Object3D, kind: string, built: boolean) {
  const R = (3 * PITCH + 0.2) / 2 + 0.35;
  const y = -0.16;
  const tall = kind === 'castle' ? 0.5 : kind === 'walls' ? 0.32 : 0.28;
  const col = kind === 'palisade' ? C.wood : kind === 'castle' ? C.stone2 : C.stone;
  const sides: [number, number, number][] = [
    [0, -R, 0],
    [R, 0, Math.PI / 2],
    [0, R, 0],
    [-R, 0, Math.PI / 2],
  ];
  sides.forEach(([x, z, rot], k) => {
    // a gate on the front side
    const parts = k === 2 ? [-1, 1] : [0];
    for (const p of parts) {
      const len = k === 2 ? R - 0.35 : 2 * R;
      const seg = new THREE.Group();
      seg.position.set(x + (k === 2 ? p * (R / 2 + 0.17) : 0), y, z);
      seg.rotation.y = rot;
      g.add(seg);
      if (kind === 'palisade') {
        const n = Math.round(len / 0.11);
        for (let s = 0; s < n; s++) {
          const px = -len / 2 + (s + 0.5) * (len / n);
          cyl(seg, 0.045, 0.05, tall * (0.9 + (s % 3) * 0.06), col, px, 0, 0, 5);
          cone(seg, 0.05, 0.06, C.timber, px, tall, 0, 5);
        }
      } else {
        box(seg, len, built ? tall : tall * 0.4, 0.14, col);
        if (built)
          for (let s = 0; s < Math.floor(len / 0.22); s++)
            box(seg, 0.08, 0.06, 0.15, col, -len / 2 + 0.11 + s * 0.22, tall, 0);
      }
    }
  });
  if (kind === 'palisade') return;
  for (const [x, z] of [
    [-R, -R],
    [R, -R],
    [R, R],
    [-R, R],
  ]) {
    const h = kind === 'castle' ? 0.8 : 0.48;
    cyl(g, 0.16, 0.18, built ? h : h * 0.4, col, x, y, z, 8);
    if (built) cone(g, 0.2, 0.22, C.roof2, x, y + h, z, 8);
  }
  // the gate towers
  for (const p of [-1, 1]) {
    cyl(g, 0.12, 0.13, built ? tall + 0.16 : tall * 0.4, col, p * 0.36, y, R, 8);
  }
}

/** The centre's improvements: a wall ring, and the rest on small yards round the plinth. */
function centreRow(
  g: THREE.Object3D,
  slots: { type: string | null; built: boolean; group?: string }[],
  seed: number,
) {
  const walls = slots
    .filter(x => x.type && WALL_RING.includes(x.type))
    .sort((a, b) => WALL_RING.indexOf(b.type!) - WALL_RING.indexOf(a.type!));
  const best = walls.find(x => x.built) ?? walls[0];
  if (best) wallRing(g, best.type!, best.built);
  const rest = slots.filter(x => x.type && !WALL_RING.includes(x.type));
  const R = (3 * PITCH + 0.2) / 2 + (best ? 1.0 : 0.65);
  // yards along the back and the sides, clear of the gate
  const spots: [number, number][] = [
    [-1.1, -R],
    [0, -R],
    [1.1, -R],
    [R, -0.9],
    [-R, -0.9],
    [R, 0.4],
    [-R, 0.4],
  ];
  rest.forEach((x, k) => {
    const at = spots[k];
    if (!at) return;
    const t = new THREE.Group();
    t.position.set(at[0], -0.1, at[1]);
    t.scale.setScalar(0.78);
    const rr = rng(seed * 17 + k * 5 + 3);
    const make: Builder = !x.built ? scaffold : (builderFor(x.type!) ?? generic(x.group));
    const ground = make(t, rr) || C.paved;
    const top = add(t, new THREE.BoxGeometry(TILE, 0.06, TILE), ground, 0, -0.03, 0);
    top.castShadow = false;
    add(t, new THREE.BoxGeometry(TILE, 0.1, TILE), C.slab, 0, -0.11, 0).castShadow = false;
    g.add(t);
  });
}

// ---------------------------------------------------------------- the scene

const TILE = 1,
  GAP = 0.06,
  PITCH = TILE + GAP;
/** the centre, then five around it, as on a hex */
const RING: [number, number][] = [
  [0, 0],
  [4.3, -1.2],
  [2.2, 3.9],
  [-2.6, 3.7],
  [-4.4, -0.9],
  [-0.6, -4.4],
];
const TURN = [0, 0.18, -0.12, 0.1, -0.2, 0.15];

/** One WebGL renderer for every city screen, made on first use and kept. */
let shared: THREE.WebGLRenderer | null = null;
function sharedRenderer(): THREE.WebGLRenderer {
  if (shared && !shared.getContext().isContextLost()) return shared;
  shared = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  shared.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  shared.shadowMap.enabled = true;
  shared.shadowMap.type = THREE.PCFSoftShadowMap;
  shared.outputColorSpace = THREE.SRGBColorSpace;
  return shared;
}

export class CityScene3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
  private world = new THREE.Group();
  private tops: THREE.Object3D[] = [];
  private frame = new THREE.Group();
  private hover = new THREE.Group();
  private hoverKey = '';
  private ang = 0.7;
  private zoom = 8;
  /** where the camera looks: a district, or the whole settlement */
  private target = new THREE.Vector3();
  private focused: number | null = null;
  private view?: CityView;
  private pending = 0;
  private ro: ResizeObserver;

  private host: HTMLElement;
  private onPick: (p: Pick) => void;

  constructor(host: HTMLElement, onPick: (p: Pick) => void) {
    this.host = host;
    this.onPick = onPick;
    this.renderer = sharedRenderer();
    host.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xfff6e2, 0x8a7a5a, 1.15));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
    sun.position.set(-9, 16, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -16,
      right: 16,
      top: 16,
      bottom: -16,
      near: 1,
      far: 60,
    });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun, this.world);
    for (const [w, d, x, z] of [
      [1.08, 0.05, 0, 0.515],
      [1.08, 0.05, 0, -0.515],
      [0.05, 1.08, 0.515, 0],
      [0.05, 1.08, -0.515, 0],
    ])
      add(this.frame, new THREE.BoxGeometry(w, 0.03, d), '#c79a3e', x, 0.02, z, {
        emissive: '#6a4e18',
      });
    this.scene.add(this.frame);
    this.frame.visible = false;
    // the plot under the pointer: a pale frame
    for (const [w, d, x, z] of [
      [1.06, 0.03, 0, 0.51],
      [1.06, 0.03, 0, -0.51],
      [0.03, 1.06, 0.51, 0],
      [0.03, 1.06, -0.51, 0],
    ])
      add(this.hover, new THREE.BoxGeometry(w, 0.02, d), '#fbf7ee', x, 0.015, z, {
        emissive: '#777766',
      });
    this.scene.add(this.hover);
    this.hover.visible = false;
    this.bindInput();
    this.ro = new ResizeObserver(() => this.render());
    this.ro.observe(host);
  }

  /** Where district `i` stands: its real direction from the centre, or the default ring. */
  private posOf(i: number): [number, number] {
    return this.view?.districts[i]?.pos ?? RING[i] ?? [0, 0];
  }

  /** Show a settlement; rebuilds only when its layout changed. */
  set(view: CityView) {
    const rebuild = !this.view || this.view.key !== view.key;
    this.view = view;
    if (rebuild) this.build(view);
    this.select(view.selected);
    // a newly chosen district comes into view; the whole settlement on request
    const d = view.selected?.district ?? null;
    if (d !== this.focused) this.focus(d);
    this.render();
  }

  /** Frame one district (with a little of its surroundings), or the whole settlement (null). */
  focus(district: number | null) {
    this.focused = district;
    const n = this.view?.districts.length ?? 1;
    if (district === null) {
      this.target.set(0, 0, 0);
      this.zoom = n <= 2 ? 8 : n <= 4 ? 11 : 13.5;
    } else {
      const [x, z] = this.posOf(district);
      this.target.set(x, 0, z);
      // the district fills the stage: its 3×3 plots up close
      this.zoom = 4.4;
    }
    this.render();
  }

  dispose() {
    this.ro.disconnect();
    cancelAnimationFrame(this.pending);
    this.world.traverse(o => (o as THREE.Mesh).geometry?.dispose());
    // the renderer (and its GPU context) is shared by every city screen: keep it for the next.
    // A new context each visit would pile up until the browser kills the oldest one, the map's.
    this.renderer.renderLists.dispose();
    this.renderer.domElement.remove();
  }

  private build(view: CityView) {
    this.world.clear();
    this.tops = [];
    // the land: a disc of earth and meadow, trees between the districts
    const n = view.districts.length;
    const span = n <= 2 ? 6.5 : n <= 4 ? 8.5 : 10.5;
    add(
      this.world,
      new THREE.CylinderGeometry(span, span + 0.5, 0.3, 24),
      '#b9a97c',
      0,
      -0.48,
      0,
    ).castShadow = false;
    add(
      this.world,
      new THREE.CylinderGeometry(span - 0.9, span - 0.2, 0.12, 24),
      '#a9b878',
      0,
      -0.22,
      0,
    ).castShadow = false;
    const r = rng(view.seed);
    const used = view.districts.map((_, k) => this.posOf(k));
    for (let i = 0; i < 60 + n * 10; i++) {
      const a = r() * Math.PI * 2,
        d = 2.4 + r() * (span - 3.4);
      const x = Math.cos(a) * d,
        z = Math.sin(a) * d;
      if (used.some(([px, pz]) => Math.hypot(px - x, pz - z) < 2.5)) continue;
      const t = new THREE.Group();
      t.position.set(x, -0.16, z);
      this.world.add(t);
      if (r() < 0.8) tree(t, 0, 0, 1.3 + r(), r() < 0.5 ? 'pine' : 'leaf', r);
      else rock(t, 0, 0, 0.08 + r() * 0.1);
    }
    // roads from the centre to each district
    used.slice(1).forEach(([x, z]) => {
      const L = Math.hypot(x, z) - 2.1;
      const road = add(
        this.world,
        new THREE.BoxGeometry(L, 0.03, 0.28),
        '#cdbb92',
        x / 2,
        -0.15,
        z / 2,
      );
      road.rotation.y = -Math.atan2(z, x);
      road.castShadow = false;
    });
    view.districts.forEach((d, i) => this.district(d, i, view.seed));
  }

  private district(d: DistrictView, i: number, seed: number) {
    const g = new THREE.Group();
    const [x, z] = this.posOf(i);
    g.position.set(x, 0, z);
    g.rotation.y = TURN[i];
    add(
      g,
      new THREE.BoxGeometry(3 * PITCH + 0.2, 0.14, 3 * PITCH + 0.2),
      d.slots ? C.slabTop : C.meadow,
      0,
      -0.23,
      0,
    ).castShadow = false;
    for (let k = 0; k < 9; k++) {
      const s = d.slots?.[k];
      const t = new THREE.Group();
      const rr = rng(seed * 31 + i * 100 + k * 7 + 1);
      const make: Builder = !d.slots
        ? gg => {
            // a district not laid out yet: meadow with a marker in the middle
            if (k === 4) {
              cyl(gg, 0.02, 0.02, 0.4, C.timber, 0, 0, 0, 4);
              add(gg, new THREE.PlaneGeometry(0.22, 0.14), C.white, 0.11, 0.33, 0, {
                side: THREE.DoubleSide,
              });
            } else if (rr() < 0.3)
              tree(gg, (rr() - 0.5) * 0.5, (rr() - 0.5) * 0.5, 0.9, 'leaf', rr);
            return C.meadow;
          }
        : !s?.type
          ? BUILDERS.empty
          : !s.built
            ? scaffold
            : (builderFor(s.type) ?? generic(s.group));
      const ground = make(t, rr) || C.grass;
      if (s?.type && s.built) props(t, ground, rr);
      const top = add(t, new THREE.BoxGeometry(TILE, 0.06, TILE), ground, 0, -0.03, 0);
      top.castShadow = false;
      add(t, new THREE.BoxGeometry(TILE, 0.1, TILE), C.slab, 0, -0.11, 0).castShadow = false;
      t.position.set(((k % 3) - 1) * PITCH, 0, (Math.floor(k / 3) - 1) * PITCH);
      t.traverse(o => (o.userData.pick = { district: i, slot: d.slots ? k : null }));
      g.add(t);
      this.tops.push(t);
    }
    if (d.slots && d.slots.length > 9) centreRow(g, d.slots.slice(9), seed);
    g.userData.index = i;
    this.world.add(g);
  }

  private select(sel?: { district: number; slot: number | null }) {
    this.place(this.frame, sel);
  }

  /** Put a frame round one plot (or hide it). */
  private place(frame: THREE.Group, sel?: { district: number; slot: number | null } | null) {
    if (
      !sel ||
      sel.slot === null ||
      !this.world.children.some(o => o.userData.index === sel.district)
    ) {
      frame.visible = false;
      return;
    }
    const [x, z] = this.posOf(sel.district);
    const k = sel.slot;
    const local = new THREE.Vector3(((k % 3) - 1) * PITCH, 0.01, (Math.floor(k / 3) - 1) * PITCH);
    local.applyAxisAngle(new THREE.Vector3(0, 1, 0), TURN[sel.district]);
    frame.position.set(x + local.x, 0.01, z + local.z);
    frame.rotation.y = TURN[sel.district];
    frame.visible = true;
  }

  /** draw once, on the next frame */
  render() {
    cancelAnimationFrame(this.pending);
    this.pending = requestAnimationFrame(() => {
      const w = this.host.clientWidth,
        h = this.host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      const R = 40;
      const t = this.target;
      this.cam.position.set(t.x + Math.cos(this.ang) * R, R * 0.82, t.z + Math.sin(this.ang) * R);
      this.cam.lookAt(t);
      const a = w / h,
        half = this.zoom / 2;
      this.cam.left = -half * a;
      this.cam.right = half * a;
      this.cam.top = half;
      this.cam.bottom = -half;
      this.cam.updateProjectionMatrix();
      this.renderer.render(this.scene, this.cam);
    });
  }

  private bindInput() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    let down: { x: number; y: number; ang: number } | null = null;
    let moved = false;
    el.addEventListener('pointerdown', e => {
      down = { x: e.clientX, y: e.clientY, ang: this.ang };
      moved = false;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!down) {
        // highlight the plot under the pointer (mouse only: a finger has no hover)
        if (e.pointerType !== 'mouse') return;
        const pk = this.hit(e);
        const key = pk && pk.slot !== null ? `${pk.district}:${pk.slot}` : '';
        if (key !== this.hoverKey) {
          this.hoverKey = key;
          this.place(this.hover, key ? pk : null);
          el.style.cursor = key ? 'pointer' : 'grab';
          this.render();
        }
        return;
      }
      const dx = e.clientX - down.x;
      if (Math.abs(dx) > 4) moved = true;
      if (moved) {
        this.ang = down.ang + dx * 0.008;
        this.render();
      }
    });
    el.addEventListener('pointerup', e => {
      if (down && !moved) this.pick(e);
      down = null;
    });
    el.addEventListener(
      'wheel',
      e => {
        e.preventDefault();
        this.zoom = Math.min(24, Math.max(4, this.zoom * (e.deltaY > 0 ? 1.1 : 0.9)));
        this.render();
      },
      { passive: false },
    );
  }

  private pick(e: PointerEvent) {
    const pk = this.hit(e);
    if (pk) this.onPick(pk);
  }

  private hit(e: PointerEvent): Pick | undefined {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(p, this.cam);
    const hit = ray.intersectObjects(this.tops, true)[0];
    return hit?.object.userData.pick as Pick | undefined;
  }
}
