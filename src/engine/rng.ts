/** Small seeded linear congruential generator. Same seed, same history. */
export class RNG {
  s: number;
  constructor(seed: number) {
    this.s = seed;
  }
  next() {
    this.s = (this.s * 1664525 + 1013904223) >>> 0;
    return this.s / 4294967296;
  }
  int(a: number, b: number) {
    return Math.floor(this.next() * (b - a + 1)) + a;
  }
  chance(p: number) {
    return this.next() < p;
  }
  pick<T>(a: T[]) {
    return a[Math.floor(this.next() * a.length)];
  }
}
