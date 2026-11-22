/** 2D gradient (Perlin-style) noise with fractal sums. Self-contained so the engine has no deps. */
import type { Rng } from './rng.ts';

export type Noise2 = (x: number, y: number) => number;

export function makeNoise(rng: Rng): Noise2 {
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(256),
    gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = rng() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const xi = Math.floor(x),
      yi = Math.floor(y);
    const xf = x - xi,
      yf = y - yi;
    const X = xi & 255,
      Y = yi & 255;
    const dot = (h: number, dx: number, dy: number) => gx[h] * dx + gy[h] * dy;
    const aa = perm[perm[X] + Y],
      ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y],
      bb = perm[perm[X + 1] + Y + 1];
    const u = fade(xf),
      v = fade(yf);
    const x1 = dot(aa, xf, yf) + u * (dot(ba, xf - 1, yf) - dot(aa, xf, yf));
    const x2 = dot(ab, xf, yf - 1) + u * (dot(bb, xf - 1, yf - 1) - dot(ab, xf, yf - 1));
    return (x1 + v * (x2 - x1)) * 1.41; // roughly -1..1
  };
}

/** Fractal Brownian motion: several octaves of noise, result roughly -1..1. */
export function fbm(
  n: Noise2,
  x: number,
  y: number,
  octaves = 5,
  lacunarity = 2,
  gain = 0.5,
): number {
  let amp = 1,
    freq = 1,
    sum = 0,
    norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += n(x * freq, y * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Ridged noise for mountain chains: 0..1, high along thin ridges. */
export function ridged(n: Noise2, x: number, y: number, octaves = 4): number {
  let amp = 1,
    freq = 1,
    sum = 0,
    norm = 0;
  for (let o = 0; o < octaves; o++) {
    const v = 1 - Math.abs(n(x * freq, y * freq));
    sum += v * v * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}
