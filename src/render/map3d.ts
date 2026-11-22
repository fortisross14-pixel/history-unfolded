/**
 * A preview of the world map in low-poly 3D, built from the real game state: hexes as prisms
 * raised by relief, peaks on mountains, trees in forests and jungle, reeds in marsh, water sunk
 * below the land, rivers, roads and railways, settlements as small towns in their people's
 * colour, troops as figures and fleets as boats. Only what the player has explored is drawn, and
 * foreign troops only where the player can see them. The region around a hex is drawn (not the
 * whole world), and it renders on demand. Shares its low-poly kit with the city view.
 */
import * as THREE from 'three';
import { isWater } from '../data/terrain.ts';
import { territory, visibleHexes } from '../engine/game.ts';
import { centerUnit, distance, neighbors, type Grid } from '../engine/hex.ts';
import type { GameState } from '../engine/types.ts';
import { add, ball, boat, box, C, cone, cyl, flag, house, M, rng, rock, tree } from './city3d.ts';

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
const RADIUS = 13;
/** a colour faded toward grey parchment, for land under the fog of war */
const fade = (hex: string) =>
  '#' + new THREE.Color(hex).lerp(new THREE.Color('#b9b09a'), 0.55).getHexString();

export class Map3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
  private world = new THREE.Group();
  private target = new THREE.Vector3();
  private ang = -Math.PI / 2 + 0.35;
  private dist = 22;
  private pending = 0;
  private ro: ResizeObserver;
  private host: HTMLElement;
  private sun: THREE.DirectionalLight;

  constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xfff6e2, 0x7a6e58, 1.2));
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -26,
      right: 26,
      top: 26,
      bottom: -26,
      near: 1,
      far: 90,
    });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target, this.world);
    this.bindInput();
    this.ro = new ResizeObserver(() => this.render());
    this.ro.observe(host);
  }

  dispose() {
    this.ro.disconnect();
    cancelAnimationFrame(this.pending);
    this.world.traverse(o => (o as THREE.Mesh).geometry?.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /** Draw the region around `center` as `civId` knows it. */
  show(s: GameState, civId: number, center: number, selected?: number) {
    this.world.clear();
    const g: Grid = { w: s.map.w, h: s.map.h };
    const m = s.map;
    const known = s.civs[civId].explored;
    const vis = visibleHexes(s, civId);
    const [cx, cy] = centerUnit(g, center);
    const P = (i: number) => {
      const [x, y] = centerUnit(g, i);
      return [x - cx, y - cy] as [number, number];
    };
    const region: number[] = [];
    for (let i = 0; i < m.w * m.h; i++)
      if (known[i] && distance(g, center, i) <= RADIUS) region.push(i);
    const top = (i: number) =>
      m.terrain[i] === 'ocean'
        ? -0.18
        : isWater(m.terrain[i])
          ? -0.1
          : m.relief[i] === 'hills'
            ? 0.28
            : m.relief[i] === 'mountains'
              ? 0.4
              : 0.12;

    for (const i of region) {
      const [x, z] = P(i);
      const t = m.terrain[i];
      const y = top(i);
      const r = rng(i * 2654435761);
      const tile = new THREE.Group();
      tile.position.set(x, 0, z);
      this.world.add(tile);
      // the hex: a low prism, its top coloured by terrain, a darker skirt below
      const h = y + 0.5;
      // land known but not seen is faded toward grey parchment
      const prismMesh = add(
        tile,
        new THREE.CylinderGeometry(0.985, 0.985, h, 6),
        vis[i] ? (TOP[t] ?? C.grass) : fade(TOP[t] ?? C.grass),
        0,
        y - h / 2,
        0,
      );
      prismMesh.castShadow = false;
      add(
        tile,
        new THREE.CylinderGeometry(0.99, 0.99, 0.5, 6),
        isWater(t) ? '#3f6a80' : '#8c7a58',
        0,
        -0.75,
        0,
      ).castShadow = false;
      // everything standing on the hex sits on its top
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
      if (veg === 'forest') {
        const n = 4 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++)
          tree(
            deck,
            (r() - 0.5) * 1.1,
            (r() - 0.5) * 1.1,
            1.6 + r() * 0.6,
            t === 'tundra' || t === 'snow' || r() < 0.4 ? 'pine' : 'leaf',
            r,
          );
      } else if (veg === 'jungle') {
        for (let k = 0; k < 5; k++) {
          const px = (r() - 0.5) * 1.1,
            pz = (r() - 0.5) * 1.1;
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
      }
      // a deposit: a small heap of ore; scattered stones on open land; swell on the sea
      if (m.deposit[i] && !isWater(t)) rock(deck, 0.45, -0.3, 0.09, '#b0905a');
      if (!isWater(t) && veg === 'none' && m.relief[i] === 'flat' && r() < 0.25)
        rock(deck, (r() - 0.5) * 0.9, (r() - 0.5) * 0.9, 0.05);
      if (t === 'ocean' && r() < 0.15)
        box(deck, 0.3, 0.01, 0.04, '#9fc3d0', (r() - 0.5) * 0.8, 0.005, (r() - 0.5) * 0.8);
    }

    // rivers: from a hex to the one downstream through their shared edge, swaying a little
    const seg = (
      x1: number,
      z1: number,
      x2: number,
      z2: number,
      y: number,
      w: number,
      c: string,
      h = 0.03,
    ) => {
      const L = Math.hypot(x2 - x1, z2 - z1);
      const b = add(
        this.world,
        new THREE.BoxGeometry(L + w * 0.6, h, w),
        c,
        (x1 + x2) / 2,
        y,
        (z1 + z2) / 2,
      );
      b.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      b.castShadow = false;
      return b;
    };
    for (const i of region) {
      const to = m.riverTo[i];
      if (!m.river[i] || to < 0 || !known[to]) continue;
      const [x1, z1] = P(i),
        [x2, z2] = P(to);
      const sway = (rng(i * 31 + to)() - 0.5) * 0.35;
      const mx = (x1 + x2) / 2 + (z2 - z1) * sway * 0.5,
        mz = (z1 + z2) / 2 - (x2 - x1) * sway * 0.5;
      const w = 0.08 + Math.min(0.16, m.river[i] * 0.015);
      const y = Math.max(top(i), top(to)) + 0.015;
      seg(x1, z1, mx, mz, y, w, '#6f9fb0');
      seg(mx, mz, x2, z2, y, w, '#6f9fb0');
    }
    // roads and railways
    for (const i of region) {
      if (!s.roads[i]) continue;
      for (const n of neighbors(g, i)) {
        if (n < i || !s.roads[n] || !known[n]) continue;
        const [x1, z1] = P(i),
          [x2, z2] = P(n);
        const rail = s.roads[i] === 2 && s.roads[n] === 2;
        const L = Math.hypot(x2 - x1, z2 - z1);
        const seg = add(
          this.world,
          new THREE.BoxGeometry(L, 0.03, rail ? 0.14 : 0.12),
          rail ? '#4a4540' : '#d9c79d',
          (x1 + x2) / 2,
          Math.max(top(i), top(n)) + 0.03,
          (z1 + z2) / 2,
        );
        seg.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
        seg.castShadow = false;
      }
    }
    // settlements: a cluster of houses round a hall, by rank, with the people's flag
    for (const c of s.cities) {
      if (!known[c.hex] || distance(g, center, c.hex) > RADIUS) continue;
      const [x, z] = P(c.hex);
      const y = top(c.hex);
      const grp = new THREE.Group();
      grp.position.set(x, y, z);
      grp.scale.setScalar(c.tier === 'metropolis' ? 1.45 : c.tier === 'city' ? 1.3 : 1.15);
      this.world.add(grp);
      const r = rng(c.id * 97 + 5);
      const n = c.tier === 'metropolis' ? 11 : c.tier === 'city' ? 8 : 5;
      box(grp, 1.2, 0.04, 1.2, C.paved, 0, 0, 0);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + r() * 0.4,
          d = 0.32 + r() * 0.22;
        house(grp, Math.cos(a) * d, Math.sin(a) * d, 0.16 + r() * 0.06, 0.13, 0.1 + r() * 0.06, {
          roof: r() < 0.6 ? C.roof : C.roof2,
          rot: a,
          wall: r() < 0.5 ? C.wall : C.wall2,
        });
      }
      box(grp, 0.22, 0.2, 0.2, C.wall, 0, 0.04, 0);
      add(grp, new THREE.ConeGeometry(0.18, 0.16, 4), C.teal, 0, 0.32, 0).rotation.y = Math.PI / 4;
      if (c.tier !== 'town') {
        box(grp, 0.1, 0.34, 0.1, C.wall2, 0.12, 0.04, -0.1);
        add(grp, new THREE.ConeGeometry(0.09, 0.14, 4), C.teal, 0.12, 0.45, -0.1).rotation.y =
          Math.PI / 4;
      }
      flag(grp, -0.08, 0.24, 0.05, s.civs[c.civId].color, 0.3);
      if (c.siege) {
        const ring = add(grp, new THREE.TorusGeometry(0.75, 0.025, 4, 24), '#a02a1e', 0, 0.06, 0);
        ring.rotation.x = Math.PI / 2;
      }
    }
    // troops and fleets: the player's everywhere, others only where the player sees them
    const here = new Map<number, number>();
    for (const f of s.formations) {
      if (!known[f.hex] || distance(g, center, f.hex) > RADIUS) continue;
      if (f.civId !== civId && !vis[f.hex]) continue;
      if (f.aboard !== undefined) continue;
      const k = here.get(f.hex) ?? 0;
      here.set(f.hex, k + 1);
      const [x, z] = P(f.hex);
      const y = Math.max(top(f.hex), isWater(m.terrain[f.hex]) ? -0.1 : 0);
      // up to three bands on a hex, in a little triangle; more stand behind unseen
      const SPOTS = [
        [0.3, 0.32],
        [-0.36, 0.26],
        [0.02, -0.42],
      ];
      if (k >= SPOTS.length) continue;
      const grp = new THREE.Group();
      grp.position.set(x + SPOTS[k][0], y, z + SPOTS[k][1]);
      this.world.add(grp);
      const col = s.civs[f.civId].color;
      if (f.kind === 'fleet') {
        boat(grp, 0, 0, 0.6, 2.4);
        flag(grp, 0, 0.3, 0, col, 0.15);
        continue;
      }
      // a little squad: one figure per few cohorts, the people's colour on their tunics
      const n = Math.min(4, Math.max(1, Math.ceil(f.cohorts.length / 3)));
      for (let q = 0; q < n; q++) {
        const qx = (q % 2) * 0.13 - 0.06,
          qz = Math.floor(q / 2) * 0.13 - 0.06;
        cyl(grp, 0.045, 0.055, 0.16, f.kind === 'army' ? col : '#c9b48a', qx, 0, qz, 6);
        ball(grp, 0.04, '#e6c9a8', qx, 0.2, qz);
        if (f.kind === 'army') cyl(grp, 0.006, 0.006, 0.26, C.timber, qx + 0.05, 0, qz, 3);
      }
      if (f.kind === 'army') flag(grp, -0.12, 0, -0.08, col, 0.36);
    }
    // borders: a band in the owner's colour along every edge where the owner changes
    const own = territory(s);
    for (const i of region) {
      const o = own[i];
      if (o < 0) continue;
      const [x, z] = P(i);
      const y = top(i) + 0.03;
      for (const n of neighbors(g, i)) {
        if (own[n] === o) continue;
        const [nx, nz] = P(n);
        const dx = (nx - x) / 2,
          dz = (nz - z) / 2;
        const b = add(
          this.world,
          new THREE.BoxGeometry(0.08, 0.05, 0.98),
          s.civs[o].color,
          x + dx * 0.9,
          Math.max(y, 0.02),
          z + dz * 0.9,
          { transparent: true, opacity: 0.85 },
        );
        b.rotation.y = -Math.atan2(dz, dx);
        b.castShadow = false;
      }
    }
    // fog of war: land known but not seen lies under a low mist
    const mist = M('#efe7d6', { transparent: true, opacity: 0.4, depthWrite: false });
    for (const i of region) {
      if (vis[i]) continue;
      const [x, z] = P(i);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.02, 6), mist);
      cap.position.set(x, top(i) + 0.95, z);
      this.world.add(cap);
    }
    // the selected troops: a gold ring, and the way they will march
    const sel = selected !== undefined ? s.formations.find(f => f.id === selected) : undefined;
    if (sel && known[sel.hex]) {
      const [x, z] = P(sel.hex);
      const ring = add(
        this.world,
        new THREE.TorusGeometry(0.62, 0.035, 4, 32),
        '#c79a3e',
        x,
        top(sel.hex) + 0.05,
        z,
        { emissive: '#6a4e18' },
      );
      ring.rotation.x = Math.PI / 2;
      let prev = sel.hex;
      sel.path.forEach((h, k) => {
        const [ax, az] = P(prev),
          [bx, bz] = P(h);
        const y = Math.max(top(prev), top(h), 0) + 0.06;
        for (let t = 0.2; t < 1; t += 0.2) {
          const dot = add(
            this.world,
            new THREE.CylinderGeometry(0.05, 0.05, 0.02, 8),
            '#c79a3e',
            ax + (bx - ax) * t,
            y,
            az + (bz - az) * t,
            { emissive: '#6a4e18' },
          );
          dot.castShadow = false;
        }
        if (k === sel.path.length - 1) {
          flag(this.world, bx, top(h), bz, '#c79a3e', 0.5);
          const end = add(
            this.world,
            new THREE.TorusGeometry(0.4, 0.03, 4, 24),
            '#c79a3e',
            bx,
            top(h) + 0.05,
            bz,
            { emissive: '#6a4e18' },
          );
          end.rotation.x = Math.PI / 2;
        }
        prev = h;
      });
    }
    // the sun follows the region
    this.sun.position.set(-14, 26, 10);
    this.sun.target.position.set(0, 0, 0);
    this.target.set(0, 0, 0);
    this.render();
  }

  render() {
    cancelAnimationFrame(this.pending);
    this.pending = requestAnimationFrame(() => {
      const w = this.host.clientWidth,
        h = this.host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      this.cam.aspect = w / h;
      const t = this.target;
      const tilt = 0.95;
      this.cam.position.set(
        t.x + Math.cos(this.ang) * this.dist * Math.cos(tilt),
        this.dist * Math.sin(tilt),
        t.z - Math.sin(this.ang) * this.dist * Math.cos(tilt),
      );
      this.cam.lookAt(t);
      this.cam.updateProjectionMatrix();
      this.renderer.render(this.scene, this.cam);
    });
  }

  /** turn the view by a step (buttons) */
  turn(by: number) {
    this.ang += by;
    this.render();
  }

  private bindInput() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    let down: { x: number; y: number; tx: number; tz: number; ang: number; rot: boolean } | null =
      null;
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      down = {
        x: e.clientX,
        y: e.clientY,
        tx: this.target.x,
        tz: this.target.z,
        ang: this.ang,
        rot: e.button === 2 || e.shiftKey,
      };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - down.x,
        dy = e.clientY - down.y;
      if (down.rot) this.ang = down.ang + dx * 0.008;
      else {
        // pan on the ground, in the camera's frame
        const k = this.dist / 600;
        const fx = -Math.cos(this.ang),
          fz = Math.sin(this.ang);
        const rx = Math.sin(this.ang),
          rz = Math.cos(this.ang);
        this.target.set(
          down.tx + dx * k * rx + dy * k * fx,
          0,
          down.tz + dx * k * rz + dy * k * fz,
        );
        this.target.x = Math.max(-RADIUS * 1.8, Math.min(RADIUS * 1.8, this.target.x));
        this.target.z = Math.max(-RADIUS * 1.6, Math.min(RADIUS * 1.6, this.target.z));
      }
      this.render();
    });
    el.addEventListener('pointerup', () => (down = null));
    el.addEventListener(
      'wheel',
      e => {
        e.preventDefault();
        this.dist = Math.min(48, Math.max(6, this.dist * (e.deltaY > 0 ? 1.1 : 0.9)));
        this.render();
      },
      { passive: false },
    );
  }
}
