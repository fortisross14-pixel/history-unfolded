/** Dev only: every troop look in a row, to judge the figures. Open /tools/preview/troops.html. */
import * as THREE from 'three';
import { buildTroops } from '../../src/render/troops.ts';
import type { Formation } from '../../src/engine/types.ts';

const L = (o: Record<string, string>) => ({
  weapon: 'improvised',
  shield: 'no-shield',
  helmet: 'no-helmet',
  armour: 'no-armour',
  boots: 'barefoot',
  mount: 'foot',
  kit: 'no-kit',
  ...o,
});
const looks: [string, Record<string, string>][] = [
  ['army', L({})],
  [
    'army',
    L({
      weapon: 'spear',
      shield: 'bronze-shield',
      helmet: 'bronze-helmet',
      armour: 'bronze-scale',
      boots: 'sandals',
    }),
  ],
  ['army', L({ weapon: 'pike', helmet: 'iron-helmet', armour: 'padded', boots: 'marching-boots' })],
  [
    'army',
    L({
      weapon: 'iron-sword',
      shield: 'kite-shield',
      helmet: 'iron-helmet',
      armour: 'chain-mail',
      boots: 'marching-boots',
    }),
  ],
  [
    'army',
    L({
      weapon: 'axe',
      helmet: 'leather-cap',
      armour: 'leather',
      boots: 'sandals',
      kit: 'war-banner',
    }),
  ],
  [
    'army',
    L({ weapon: 'longbow', helmet: 'leather-cap', armour: 'leather', boots: 'marching-boots' }),
  ],
  [
    'army',
    L({
      weapon: 'crossbow',
      shield: 'pavise',
      helmet: 'iron-helmet',
      armour: 'padded',
      boots: 'marching-boots',
    }),
  ],
  ['army', L({ weapon: 'musket', boots: 'hobnailed-boots', kit: 'bayonet' })],
  [
    'army',
    L({
      weapon: 'lance',
      shield: 'kite-shield',
      helmet: 'great-helm',
      armour: 'plate-armour',
      mount: 'barded-horse',
      boots: 'marching-boots',
    }),
  ],
  [
    'army',
    L({ weapon: 'composite-bow', armour: 'leather', mount: 'horse', helmet: 'leather-cap' }),
  ],
  ['army', L({ weapon: 'field-gun', boots: 'marching-boots' })],
  ['settlers', L({})],
  ['workers', L({})],
];
const params = new URLSearchParams(location.search);
const n = Number(params.get('n') ?? 12);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#efe6cf');
const cols = 5;
looks.forEach(([kind, lo], i) => {
  const g = new THREE.Group();
  const f = {
    id: i,
    kind,
    cohorts: Array.from({ length: n }, () => ({ loadout: lo, people: 100 })),
  } as unknown as Formation;
  buildTroops(g, f, '#2a5fb0');
  g.position.set((i % cols) * 0.7, 0, Math.floor(i / cols) * 0.7);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.02, 6),
    new THREE.MeshStandardMaterial({ color: '#a7b86f', flatShading: true }),
  );
  base.position.set(g.position.x, -0.01, g.position.z);
  scene.add(base, g);
});
scene.add(new THREE.HemisphereLight('#fff8ea', '#8a7a5a', 1.2));
const sun = new THREE.DirectionalLight('#fff3dc', 1.6);
sun.position.set(-3, 6, 4);
scene.add(sun);
const w = innerWidth,
  h = innerHeight;
const cam = new THREE.OrthographicCamera(
  -w / 2 / 260,
  w / 2 / 260,
  h / 2 / 260,
  -h / 2 / 260,
  -50,
  50,
);
// as the map camera: from the south and above
cam.position.set(1.4, 5, 0.7 + 4);
cam.lookAt(1.4, 0.1, 0.7);
const r = new THREE.WebGLRenderer({ antialias: true });
r.setPixelRatio(2);
r.setSize(w, h);
document.body.appendChild(r.domElement);
r.render(scene, cam);
(window as unknown as { done: boolean }).done = true;
