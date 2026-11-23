/**
 * Short-lived map effects (battle flashes, floating numbers, shake) and unit movement tweens.
 * The game pushes effects here; the renderer reads them each frame and keeps asking for frames
 * while anything is still playing.
 */

export interface FloatFx {
  hex: number;
  text: string;
  color: string;
  /** seconds since the page loaded, from performance.now() / 1000 */
  t0: number;
  /** offset in hex radii, so two numbers on one hex do not overlap */
  dx: number;
}

export interface FlashFx {
  hex: number;
  t0: number;
  color: string;
}

const FLOAT_LIFE = 1.4;
const FLASH_LIFE = 0.45;
const SHAKE_DECAY = 1.6; // trauma lost per second

/** set by the player's settings: animation speed and reduced motion */
let motion = { speed: 1, reduced: false };
export const setMotion = (m: { speed: number; reduced: boolean }) => (motion = m);
export const reducedMotion = () =>
  motion.reduced ||
  (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);

const now = () => performance.now() / 1000;

class Fx {
  floats: FloatFx[] = [];
  flashes: FlashFx[] = [];
  /** 0..1; shake offset grows with its square, so small hits barely move the view */
  trauma = 0;
  private traumaAt = 0;
  private listeners = new Set<() => void>();

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private poke() {
    for (const fn of this.listeners) fn();
  }

  float(hex: number, text: string, color: string, dx = 0) {
    this.floats.push({ hex, text, color, t0: now(), dx });
    this.poke();
  }
  flash(hex: number, color = '#fff3c4') {
    this.flashes.push({ hex, t0: now(), color });
    this.poke();
  }
  shake(amount: number) {
    if (reducedMotion()) return;
    this.trauma = Math.min(1, this.currentTrauma() + amount);
    this.traumaAt = now();
    this.poke();
  }
  currentTrauma() {
    return Math.max(0, this.trauma - (now() - this.traumaAt) * SHAKE_DECAY);
  }

  /** Drop finished effects; true while something still plays. */
  tick(): boolean {
    const t = now();
    this.floats = this.floats.filter(f => t - f.t0 < FLOAT_LIFE);
    this.flashes = this.flashes.filter(f => t - f.t0 < FLASH_LIFE);
    return this.floats.length > 0 || this.flashes.length > 0 || this.currentTrauma() > 0;
  }

  /** 0..1 progress of a float, and of a flash. */
  floatAge = (f: FloatFx) => (now() - f.t0) / FLOAT_LIFE;
  flashAge = (f: FlashFx) => (now() - f.t0) / FLASH_LIFE;
}

export const fx = new Fx();

// ---------------------------------------------------------------- movement tweens

interface Tween {
  fromX: number;
  fromY: number;
  t0: number;
  dur: number;
}

/** Remembers where each formation was drawn so a change of hex slides instead of jumping. */
export class Motion {
  private last = new Map<number, { hex: number; x: number; y: number }>();
  private tweens = new Map<number, Tween>();

  /**
   * Where to draw formation `id` that now stands at (x, y) on `hex`. Starts a tween when the hex
   * changed since the last frame; long jumps (a loaded game, a far teleport) just snap.
   */
  place(id: number, hex: number, x: number, y: number, hexDist: number): [number, number] {
    const t = now();
    const prev = this.last.get(id);
    if (prev && prev.hex !== hex && hexDist <= 8 && !reducedMotion()) {
      const cur = this.at(id, prev.x, prev.y, t);
      this.tweens.set(id, {
        fromX: cur[0],
        fromY: cur[1],
        t0: t,
        dur: Math.min(0.75, 0.16 + 0.12 * hexDist) / Math.max(0.25, motion.speed),
      });
    }
    this.last.set(id, { hex, x, y });
    return this.at(id, x, y, t);
  }

  private at(id: number, x: number, y: number, t: number): [number, number] {
    const tw = this.tweens.get(id);
    if (!tw) return [x, y];
    const k = (t - tw.t0) / tw.dur;
    if (k >= 1) {
      this.tweens.delete(id);
      return [x, y];
    }
    // ease out: quick start, gentle arrival
    const e = 1 - (1 - k) ** 3;
    return [tw.fromX + (x - tw.fromX) * e, tw.fromY + (y - tw.fromY) * e];
  }

  lastHex(id: number): number | undefined {
    return this.last.get(id)?.hex;
  }

  get active() {
    return this.tweens.size > 0;
  }

  /** Forget formations that are gone, so their ids do not tween if reused. */
  prune(alive: Set<number>) {
    for (const id of this.last.keys()) if (!alive.has(id)) this.last.delete(id);
  }

  reset() {
    this.last.clear();
    this.tweens.clear();
  }
}
