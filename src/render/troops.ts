/**
 * Troops on the map: small low-poly figures put together from the formation's main design, so a
 * levy with a club, a bronze-shielded spearman, a knight on a barded horse and a musketeer each
 * look like themselves. Tunics (and a horse's barding) carry the people's colour; armour, helmet,
 * shield and weapon follow the design's gear. Built from the same few shapes as the rest of the
 * map and baked into one mesh per formation by the caller.
 *
 * A figure stands about 0.27 tall at the origin, facing +x (right on the map).
 */
import * as THREE from 'three';
import type { Loadout } from '../data/items.ts';
import { groupCohorts } from '../engine/units.ts';
import type { Formation } from '../engine/types.ts';
import { add, ball, box, C, cone, cyl } from './city3d.ts';

const SKIN = ['#e6c9a8', '#c99a72', '#a77650', '#e9cfb0'];
const ARMOUR: Record<string, string | null> = {
  'no-armour': null,
  padded: '#cdb98f',
  leather: '#8a6440',
  'bronze-scale': '#b08a3e',
  'ivory-lamellar': '#d8cdb0',
  'chain-mail': '#8f9296',
  'plate-armour': '#c5c9ce',
  cuirass: '#aeb3b8',
};
const BRONZE = '#b38a3a',
  IRON = '#8c9196',
  STEEL = '#c3c8cd',
  LEATHER = '#7a5233',
  WOOD = C.timber,
  DARK = '#3a3530';

/**
 * A shaft from its foot at (x, y, z), tilted `tilt` radians forward (toward +x), with a point at
 * its end: spears, pikes, javelins.
 */
function shaft(
  f: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  len: number,
  tilt: number,
  wood: string,
  point: string,
  r = 0.0045,
) {
  const dx = Math.sin(tilt),
    dy = Math.cos(tilt);
  const s = add(
    f,
    new THREE.CylinderGeometry(r, r, len, 4),
    wood,
    x + (dx * len) / 2,
    y + (dy * len) / 2,
    z,
  );
  s.rotation.z = -tilt;
  const t = add(
    f,
    new THREE.ConeGeometry(r * 2.2, 0.035, 4),
    point,
    x + dx * (len + 0.0175),
    y + dy * (len + 0.0175),
    z,
  );
  t.rotation.z = -tilt;
}

/** Lay a mesh along a direction from its middle: used for swords, axes, guns. */
function lean(m: THREE.Object3D, z: number, x = 0) {
  m.rotation.z = z;
  m.rotation.x = x;
  return m;
}

/** One soldier on foot. `tunic` is the people's colour. */
function soldier(g: THREE.Object3D, l: Loadout, tunic: string, x: number, z: number, skin: string) {
  const f = new THREE.Group();
  f.position.set(x, 0, z);
  g.add(f);
  const armour = ARMOUR[l.armour] ?? null;
  const heavy = l.armour === 'plate-armour' || l.armour === 'cuirass';
  // legs and boots
  const boot = l.boots === 'barefoot' ? skin : l.boots === 'sandals' ? '#9a7448' : DARK;
  for (const dz of [-0.018, 0.018]) {
    box(f, 0.022, 0.085, 0.022, heavy ? STEEL : '#6b5a44', 0, 0.018, dz);
    box(f, 0.03, 0.018, 0.024, boot, 0.004, 0, dz);
  }
  // body: the tunic, and armour over it
  cyl(f, 0.034, 0.042, 0.1, tunic, 0, 0.1, 0, 6);
  if (armour) cyl(f, 0.037, 0.04, 0.062, armour, 0, 0.135, 0, 6);
  if (heavy) box(f, 0.07, 0.016, 0.086, armour!, 0, 0.19, 0); // pauldrons
  // arms
  for (const dz of [-0.044, 0.044])
    cyl(f, 0.011, 0.011, 0.07, armour ?? tunic, 0.006, 0.125, dz, 5);
  // head
  ball(f, 0.028, skin, 0, 0.228, 0);
  helmet(f, l.helmet, l.weapon);
  shield(f, l.shield, tunic);
  weapon(f, l, skin);
  if (l.kit === 'war-banner') {
    cyl(f, 0.004, 0.004, 0.34, WOOD, -0.03, 0.05, -0.05, 4);
    box(f, 0.07, 0.05, 0.004, tunic, 0.005, 0.32, -0.05);
  }
}

function helmet(f: THREE.Object3D, h: string, weapon: string) {
  if (h === 'leather-cap')
    add(
      f,
      new THREE.SphereGeometry(0.03, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2),
      LEATHER,
      0,
      0.232,
      0,
    );
  else if (h === 'bronze-helmet') {
    add(
      f,
      new THREE.SphereGeometry(0.032, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2),
      BRONZE,
      0,
      0.232,
      0,
    );
    box(f, 0.05, 0.03, 0.008, '#a3322a', -0.004, 0.255, 0); // crest
  } else if (h === 'iron-helmet') {
    cone(f, 0.034, 0.04, IRON, 0, 0.234, 0, 6);
    box(f, 0.006, 0.026, 0.006, IRON, 0.03, 0.212, 0); // nasal
  } else if (h === 'great-helm') cyl(f, 0.032, 0.032, 0.05, STEEL, 0, 0.205, 0, 6);
  else if (weapon === 'musket' || weapon === 'arquebus' || weapon === 'rifle') {
    // a brimmed hat for the gun ages
    cyl(f, 0.05, 0.05, 0.006, DARK, 0, 0.244, 0, 8);
    cyl(f, 0.026, 0.03, 0.03, DARK, 0, 0.248, 0, 6);
  }
}

/** The shield on the arm toward the camera (+z), its face turned to the viewer, in the people's colour. */
function shield(f: THREE.Object3D, s: string, face: string) {
  if (s === 'no-shield') return;
  if (s === 'kite-shield') {
    box(f, 0.064, 0.13, 0.004, STEEL, 0.012, 0.065, 0.05);
    box(f, 0.056, 0.12, 0.006, face, 0.012, 0.07, 0.054);
    return;
  }
  if (s === 'pavise') {
    box(f, 0.1, 0.17, 0.01, STEEL, 0.02, 0, 0.07);
    box(f, 0.09, 0.16, 0.006, face, 0.02, 0.005, 0.076);
    return;
  }
  const r = s === 'bronze-shield' ? 0.05 : 0.042;
  const rim = s === 'bronze-shield' ? BRONZE : s === 'wicker-shield' ? '#b89a5c' : LEATHER;
  const disc = add(f, new THREE.CylinderGeometry(r, r, 0.006, 10), rim, 0.012, 0.13, 0.05);
  disc.rotation.x = Math.PI / 2;
  const inner = add(
    f,
    new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.004, 10),
    face,
    0.012,
    0.13,
    0.054,
  );
  inner.rotation.x = Math.PI / 2;
  ball(f, 0.01, rim, 0.012, 0.13, 0.057); // boss
}

function weapon(f: THREE.Object3D, l: Loadout, skin: string) {
  const w = l.weapon;
  const hx = 0.03,
    hz = -0.05; // the weapon hand, away from the camera; the shield faces it
  switch (w) {
    case 'spear':
    case 'lance':
      shaft(f, hx, 0.02, hz, 0.36, 0.05, WOOD, IRON);
      break;
    case 'pike':
      shaft(f, hx, 0.03, hz, 0.46, 0.3, WOOD, STEEL, 0.004);
      break;
    case 'axe':
      lean(cyl(f, 0.004, 0.004, 0.14, WOOD, hx + 0.01, 0.12, hz, 4), -0.3);
      box(f, 0.03, 0.035, 0.006, BRONZE, hx + 0.035, 0.235, hz);
      break;
    case 'bronze-sword':
    case 'iron-sword':
      lean(
        box(f, 0.008, 0.11, 0.004, w === 'bronze-sword' ? BRONZE : STEEL, hx + 0.02, 0.12, hz),
        -0.4,
      );
      box(f, 0.006, 0.006, 0.03, DARK, hx + 0.005, 0.12, hz);
      break;
    case 'improvised':
      lean(cyl(f, 0.006, 0.01, 0.1, WOOD, hx + 0.015, 0.12, hz, 5), -0.5);
      break;
    case 'sling':
      box(f, 0.004, 0.06, 0.004, LEATHER, hx, 0.23, hz);
      ball(f, 0.008, C.stone, hx, 0.29, hz);
      break;
    case 'javelins':
      for (const d of [0, 0.012, -0.012])
        shaft(f, hx + d, 0.06, hz + d, 0.22, 0.15, WOOD, IRON, 0.003);
      break;
    case 'bow':
    case 'composite-bow':
    case 'longbow': {
      const r = w === 'longbow' ? 0.11 : 0.08;
      const bow = add(
        f,
        new THREE.TorusGeometry(r, 0.005, 3, 10, Math.PI * 0.8),
        w === 'composite-bow' ? '#5a3a22' : WOOD,
        hx + 0.03,
        0.15,
        0,
      );
      bow.rotation.z = -Math.PI * 0.4;
      box(f, 0.003, r * 1.8, 0.003, '#e6dcc6', hx + 0.045 - r * 0.25, 0.15 - r * 0.9, 0); // string
      cyl(f, 0.012, 0.012, 0.07, LEATHER, -0.04, 0.12, 0.02, 5); // quiver
      break;
    }
    case 'crossbow':
      box(f, 0.09, 0.012, 0.012, WOOD, hx + 0.03, 0.15, hz * 0.4);
      box(f, 0.008, 0.008, 0.08, IRON, hx + 0.07, 0.155, hz * 0.4);
      break;
    case 'arquebus':
    case 'musket':
    case 'rifle': {
      lean(box(f, 0.12, 0.011, 0.011, WOOD, hx + 0.03, 0.17, hz * 0.5), 0.25);
      lean(box(f, 0.07, 0.007, 0.007, IRON, hx + 0.1, 0.19, hz * 0.5), 0.25);
      if (l.kit === 'bayonet')
        lean(cone(f, 0.004, 0.04, STEEL, hx + 0.155, 0.2, hz * 0.5, 3), -1.3);
      break;
    }
    case 'unarmed':
      ball(f, 0.012, skin, hx, 0.1, hz);
      break;
    default:
      cyl(f, 0.0045, 0.0045, 0.3, WOOD, hx, 0.02, hz, 4);
  }
}

/** A horse, facing +x; barding in the people's colour when the design has it. */
function horse(g: THREE.Object3D, mount: string, cloth: string, x: number, z: number) {
  const h = new THREE.Group();
  h.position.set(x, 0, z);
  g.add(h);
  const coat =
    mount === 'heavy-horse' ? '#5a3f2a' : mount === 'barded-horse' ? '#6b5240' : '#8a5c35';
  const big = mount === 'foot' ? 1 : mount === 'horse' ? 1 : 1.12;
  for (const [lx, lz] of [
    [0.07, -0.03],
    [0.07, 0.03],
    [-0.07, -0.03],
    [-0.07, 0.03],
  ])
    cyl(h, 0.011 * big, 0.009 * big, 0.11 * big, coat, lx * big, 0, lz * big, 5);
  box(h, 0.2 * big, 0.075 * big, 0.075 * big, coat, 0, 0.1 * big, 0);
  const neck = box(h, 0.05 * big, 0.09 * big, 0.04 * big, coat, 0.1 * big, 0.14 * big, 0);
  neck.rotation.z = -0.55;
  box(h, 0.075 * big, 0.035 * big, 0.035 * big, coat, 0.15 * big, 0.21 * big, 0); // head
  box(h, 0.015, 0.06 * big, 0.01, DARK, -0.105 * big, 0.12 * big, 0); // tail
  if (mount === 'barded-horse')
    box(h, 0.21 * big, 0.06 * big, 0.085 * big, cloth, 0, 0.11 * big, 0);
  else box(h, 0.06, 0.012, 0.08, cloth, -0.01, 0.175 * big, 0); // saddle cloth
  return big;
}

/** A rider on a horse: the soldier lifted onto its back. */
function rider(g: THREE.Object3D, l: Loadout, tunic: string, x: number, z: number, skin: string) {
  const big = horse(g, l.mount, tunic, x, z);
  const r = new THREE.Group();
  r.position.set(x - 0.01, 0.12 * big, z);
  r.scale.setScalar(0.9);
  g.add(r);
  soldier(r, { ...l, shield: l.shield === 'pavise' ? 'no-shield' : l.shield }, tunic, 0, 0, skin);
}

/** A small field gun with its gunner. */
function fieldGun(g: THREE.Object3D, tunic: string, x: number, z: number, skin: string) {
  for (const dz of [-0.05, 0.05]) {
    const wh = add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.012, 10), WOOD, x, 0.045, z + dz);
    wh.rotation.x = Math.PI / 2;
  }
  lean(cyl(g, 0.018, 0.024, 0.16, BRONZE, x + 0.05, 0.05, z, 8), -1.35);
  box(g, 0.12, 0.02, 0.04, WOOD, x - 0.05, 0.02, z);
  soldier(
    g,
    {
      weapon: 'unarmed',
      shield: 'no-shield',
      helmet: 'no-helmet',
      armour: 'no-armour',
      boots: 'marching-boots',
      mount: 'foot',
      kit: 'no-kit',
    },
    tunic,
    x - 0.12,
    z - 0.05,
    skin,
  );
}

/** Settlers: an ox cart and a family walking beside it. */
function settlers(g: THREE.Object3D, cloth: string) {
  box(g, 0.16, 0.05, 0.1, C.wood, 0, 0.05, 0);
  box(g, 0.14, 0.04, 0.08, C.wheat, 0, 0.1, 0); // load
  add(
    g,
    new THREE.CylinderGeometry(0.05, 0.05, 0.1, 6, 1, false, 0, Math.PI),
    cloth,
    0,
    0.14,
    0,
  ).rotation.x = Math.PI / 2;
  for (const dx of [-0.05, 0.05]) {
    const wh = add(g, new THREE.CylinderGeometry(0.04, 0.04, 0.012, 8), WOOD, dx, 0.04, 0.058);
    wh.rotation.x = Math.PI / 2;
  }
  // the ox
  box(g, 0.12, 0.06, 0.06, '#8a6a48', 0.17, 0.06, 0);
  box(g, 0.045, 0.04, 0.04, '#8a6a48', 0.245, 0.09, 0);
  for (const [lx, lz] of [
    [0.13, -0.02],
    [0.13, 0.02],
    [0.21, -0.02],
    [0.21, 0.02],
  ])
    cyl(g, 0.009, 0.009, 0.06, '#6f5236', lx, 0, lz, 4);
  const plain = {
    weapon: 'unarmed',
    shield: 'no-shield',
    helmet: 'no-helmet',
    armour: 'no-armour',
    boots: 'sandals',
    mount: 'foot',
    kit: 'no-kit',
  };
  soldier(g, plain, cloth, -0.08, 0.1, SKIN[0]);
  soldier(g, plain, '#c9b48a', 0.05, 0.12, SKIN[1]);
}

/** Workers and engineers: two figures with tools. */
function labourers(g: THREE.Object3D, cloth: string, engineers: boolean) {
  const plain = {
    weapon: 'unarmed',
    shield: 'no-shield',
    helmet: engineers ? 'leather-cap' : 'no-helmet',
    armour: 'no-armour',
    boots: 'marching-boots',
    mount: 'foot',
    kit: 'no-kit',
  };
  for (const [i, [x, z]] of (
    [
      [-0.06, -0.05],
      [0.06, 0.05],
    ] as const
  ).entries()) {
    soldier(g, plain, i ? '#c9b48a' : cloth, x, z, SKIN[i + 1]);
    lean(cyl(g, 0.004, 0.004, 0.16, WOOD, x + 0.04, 0.05, z + 0.05, 4), -0.4);
    box(g, 0.05, 0.012, 0.012, IRON, x + 0.085, 0.17, z + 0.05); // pick head
  }
}

/** Where up to four figures stand in a formation (x, z). */
const RANKS: [number, number][][] = [
  [[0, 0]],
  [
    [0.05, -0.06],
    [-0.05, 0.06],
  ],
  [
    [0.08, 0],
    [-0.06, -0.09],
    [-0.06, 0.09],
  ],
  [
    [0.07, -0.07],
    [0.07, 0.07],
    [-0.07, -0.07],
    [-0.07, 0.07],
  ],
];

/**
 * Figures for a land formation: one to four, by its size, all in its main design's gear.
 * Returns a key for what was drawn, so the caller rebuilds only when the look changes.
 */
export function buildTroops(g: THREE.Object3D, f: Formation, colour: string): void {
  if (f.kind === 'settlers') return settlers(g, colour);
  if (f.kind === 'workers' || f.kind === 'engineers')
    return labourers(g, colour, f.kind === 'engineers');
  const l = groupCohorts(f)[0]?.loadout;
  if (!l) return;
  const mounted = l.mount === 'horse' || l.mount === 'heavy-horse' || l.mount === 'barded-horse';
  const gun = l.weapon === 'field-gun';
  const n = Math.min(gun ? 2 : mounted ? 3 : 4, Math.max(1, Math.ceil(f.cohorts.length / 3)));
  const spread = mounted ? 1.5 : gun ? 1.2 : 1;
  for (const [i, [x, z]] of RANKS[n - 1].entries()) {
    const skin = SKIN[(f.id + i) % SKIN.length];
    if (l.weapon === 'field-gun') fieldGun(g, colour, x * spread, z * spread, skin);
    else if (mounted) rider(g, l, colour, x * spread, z * spread, skin);
    else soldier(g, l, colour, x * spread, z * spread, skin);
  }
}

/** What a formation looks like, for knowing when to rebuild its figures. */
export function troopLook(f: Formation): string {
  const l = groupCohorts(f)[0]?.loadout;
  return l ? `${l.weapon}|${l.shield}|${l.helmet}|${l.armour}|${l.mount}|${l.boots}|${l.kit}` : '';
}
