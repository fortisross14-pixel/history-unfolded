/** A* over the hex grid with a caller-supplied step cost. */
import { distance, neighbors, type Grid } from './hex.ts';

export function findPath(
  g: Grid,
  from: number,
  to: number,
  cost: (from: number, to: number) => number,
  maxNodes = 20000,
): number[] | null {
  if (from === to) return [];
  const N = g.w * g.h;
  const gScore = new Float64Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  // binary heap of [f, node]
  const heap: [number, number][] = [];
  const push = (f: number, n: number) => {
    heap.push([f, n]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1,
          r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  gScore[from] = 0;
  push(distance(g, from, to), from);
  let expanded = 0;
  while (heap.length) {
    const [, cur] = pop();
    if (closed[cur]) continue;
    if (cur === to) break;
    closed[cur] = 1;
    if (++expanded > maxNodes) return null;
    for (const n of neighbors(g, cur)) {
      if (closed[n]) continue;
      const c = cost(cur, n);
      if (!isFinite(c)) continue;
      const t = gScore[cur] + c;
      if (t < gScore[n]) {
        gScore[n] = t;
        came[n] = cur;
        push(t + distance(g, n, to), n);
      }
    }
  }
  if (came[to] < 0) return null;
  const path: number[] = [];
  for (let c = to; c !== from; c = came[c]) path.push(c);
  return path.reverse();
}
