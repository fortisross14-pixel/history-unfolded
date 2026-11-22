import { useEffect, useRef } from 'react';
import type { GameState } from '../engine/types.ts';
import type { Assets } from '../render/assets.ts';
import { MapRenderer, type Insets, type Overlay } from '../render/mapRenderer.ts';

/** What MapView needs from a map renderer: the 2D one and the 3D one both provide it. */
interface Renderer {
  cam: { x: number; y: number; zoom: number };
  coarse: boolean;
  wantsFrame: boolean;
  wantsSettle: boolean;
  resize(w: number, h: number): void;
  clamp(s: GameState, ins?: Insets): void;
  centerOn(s: GameState, hex: number, ins?: Insets): void;
  hexAtScreen(s: GameState, x: number, y: number): number;
  zoomAt(x: number, y: number, f: number): void;
  draw(s: GameState, civId: number, ov: Overlay): void;
  dispose?(): void;
}

const MAP_MODE = 'hu-map-mode';
/** The player's choice of map: the 3D one unless they chose 2D (or the device cannot do 3D). */
export const mapMode = (): '2d' | '3d' => {
  try {
    return localStorage.getItem(MAP_MODE) === '2d' ? '2d' : '3d';
  } catch {
    return '3d';
  }
};
export const setMapMode = (m: '2d' | '3d') => {
  try {
    localStorage.setItem(MAP_MODE, m);
  } catch {
    /* private mode: the choice lasts this session only */
  }
};
import { fx } from '../render/fx.ts';

interface Props {
  game: GameState;
  civId: number;
  assets: Assets;
  version: number;
  overlay: Overlay;
  centerOn: { hex: number; n: number } | null;
  onClick: (hex: number, touch: boolean) => void;
  onMove: (hex: number) => void;
  onHover: (hex: number) => void;
  /** screen pixels covered by the interface (top bar, panels): centring and clamping avoid them */
  insets: Insets;
}

/** The map canvas: drag to pan, wheel or pinch to zoom, click to select, right-click to move. */
export function MapView({
  game,
  civId,
  assets,
  version,
  overlay,
  centerOn,
  onClick,
  onMove,
  onHover,
  insets,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rr = useRef<Renderer | null>(null);
  const frame = useRef(0);
  const props = useRef({ game, civId, overlay, onClick, onMove, onHover, insets });
  props.current = { game, civId, overlay, onClick, onMove, onHover, insets };

  const redraw = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const r = rr.current;
      if (!r) return;
      const t0 = performance.now();
      r.draw(props.current.game, props.current.civId, props.current.overlay);
      // frame timings for the perf check (scripts/perf-smoke.ts)
      const w = window as unknown as { __drawMs?: number[] };
      (w.__drawMs ??= []).push(performance.now() - t0);
      if (w.__drawMs.length > 300) w.__drawMs.shift();
      if (r.wantsFrame) redraw();
      else if (r.wantsSettle) setTimeout(redraw, 200);
    });
  };

  useEffect(() => {
    const canvas = ref.current!;
    const parent = canvas.parentElement!;
    let alive = true;
    // a stand-in until the chosen renderer is ready: every handler waits for it
    const r = new Proxy({} as Renderer, {
      get: (_t, k) => {
        const real = rr.current as unknown as Record<string | symbol, unknown> | null;
        if (!real) return k === 'cam' ? { x: 0, y: 0, zoom: 1 } : () => -1;
        const v = real[k];
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(real) : v;
      },
      set: (_t, k, v) => {
        if (rr.current) (rr.current as unknown as Record<string | symbol, unknown>)[k] = v;
        return true;
      },
    });
    const ready = (real: Renderer) => {
      if (!alive) return real.dispose?.();
      rr.current = real;
      // a handle for the browser checks (scripts/*-smoke.ts)
      (window as unknown as { __map?: Renderer }).__map = real;
      real.resize(parent.clientWidth, parent.clientHeight);
      const c = centerRef.current;
      if (c) real.centerOn(props.current.game, c.hex, props.current.insets);
      real.clamp(props.current.game, props.current.insets);
      redraw();
    };
    (async () => {
      if (mapMode() === '3d')
        try {
          const m = await import('../render/world3d.ts');
          if (m.webglAvailable()) return ready(new m.World3DRenderer(canvas, assets));
        } catch {
          /* no 3D here: the 2D map */
        }
      ready(new MapRenderer(canvas, assets));
    })();
    const ro = new ResizeObserver(() => {
      if (!rr.current) return;
      r.resize(parent.clientWidth, parent.clientHeight);
      r.clamp(props.current.game, props.current.insets);
      redraw();
    });
    ro.observe(parent);
    const offFx = fx.onChange(redraw);
    // keyboard panning: W A S D or the arrows, held, glide the map (not while typing or in a window)
    const held = new Set<string>();
    const PAN = {
      w: [0, -1],
      a: [-1, 0],
      s: [0, 1],
      d: [1, 0],
      arrowup: [0, -1],
      arrowleft: [-1, 0],
      arrowdown: [0, 1],
      arrowright: [1, 0],
    } as Record<string, [number, number]>;
    let panFrame = 0,
      last = 0;
    const blocked = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      return (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) ||
        t.isContentEditable ||
        !!document.querySelector('.modal-back')
      );
    };
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      let dx = 0,
        dy = 0;
      for (const k of held) {
        dx += PAN[k][0];
        dy += PAN[k][1];
      }
      if (dx || dy) {
        // about 900 screen pixels a second, whatever the zoom
        r.cam.x += (dx * 900 * dt) / r.cam.zoom;
        r.cam.y += (dy * 900 * dt) / r.cam.zoom;
        clamp();
        redraw();
      }
      panFrame = held.size ? requestAnimationFrame(step) : 0;
      if (!held.size) last = 0;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!PAN[k] || blocked(e)) return;
      e.preventDefault();
      held.add(k);
      if (!panFrame) panFrame = requestAnimationFrame(step);
    };
    const onKeyUp = (e: KeyboardEvent) => held.delete(e.key.toLowerCase());
    const onBlur = () => held.clear();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    // pointer handling: one pointer pans (or taps if it barely moved), two pointers pinch-zoom and pan
    const pts = new Map<number, { x: number; y: number }>();
    let down: { x: number; y: number; moved: boolean; button: number; touch: boolean } | null =
      null;
    let pinch = 0;
    let mid: { x: number; y: number } | null = null;
    const local = (e: PointerEvent | WheelEvent | MouseEvent) => {
      const b = canvas.getBoundingClientRect();
      return { x: e.clientX - b.left, y: e.clientY - b.top };
    };
    const clamp = () => r.clamp(props.current.game, props.current.insets);
    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const p = local(e);
      pts.set(e.pointerId, p);
      if (e.pointerType !== 'mouse') r.coarse = true;
      if (pts.size === 1)
        down = { ...p, moved: false, button: e.button, touch: e.pointerType !== 'mouse' };
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
        mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (down) down.moved = true;
      }
    };
    const onPtrMove = (e: PointerEvent) => {
      const p = local(e);
      const prev = pts.get(e.pointerId);
      if (!prev) {
        if (e.pointerType === 'mouse')
          props.current.onHover(r.hexAtScreen(props.current.game, p.x, p.y));
        return;
      }
      pts.set(e.pointerId, p);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        // the map follows the fingers: pan by the midpoint's travel, then zoom around it
        if (mid) {
          r.cam.x -= (m.x - mid.x) / r.cam.zoom;
          r.cam.y -= (m.y - mid.y) / r.cam.zoom;
        }
        if (pinch > 0) r.zoomAt(m.x, m.y, d / pinch);
        pinch = d;
        mid = m;
      } else if (down && down.button === 0) {
        // fingers wobble: a touch needs more travel before it counts as a drag
        if (Math.hypot(p.x - down.x, p.y - down.y) > (down.touch ? 12 : 5)) down.moved = true;
        if (down.moved) {
          r.cam.x -= (p.x - prev.x) / r.cam.zoom;
          r.cam.y -= (p.y - prev.y) / r.cam.zoom;
        }
      }
      clamp();
      redraw();
    };
    const onUp = (e: PointerEvent) => {
      const p = local(e);
      pts.delete(e.pointerId);
      if (pts.size < 2) mid = null;
      if (pts.size === 0 && down && !down.moved) {
        const h = r.hexAtScreen(props.current.game, p.x, p.y);
        if (h >= 0) {
          if (down.button === 2) props.current.onMove(h);
          else if (down.button === 0) props.current.onClick(h, down.touch);
        }
      }
      if (pts.size === 0) down = null;
    };
    // a gesture the browser took over (scroll, system swipe) never counts as a tap
    const onCancel = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size === 0) down = null;
      mid = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      r.zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
      clamp();
      redraw();
    };
    const noMenu = (e: MouseEvent) => e.preventDefault();
    const onLeave = () => props.current.onHover(-1);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onPtrMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', noMenu);
    return () => {
      alive = false;
      rr.current?.dispose?.();
      rr.current = null;
      ro.disconnect();
      offFx();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      cancelAnimationFrame(panFrame);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onPtrMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', noMenu);
    };
  }, [assets]);

  const centerRef = useRef(centerOn);
  centerRef.current = centerOn;
  useEffect(() => {
    if (centerOn && rr.current) {
      rr.current.centerOn(game, centerOn.hex, insets);
      rr.current.clamp(game, insets);
    }
    redraw();
  }, [centerOn]);

  useEffect(redraw, [version, overlay]);

  return <canvas ref={ref} className="map-canvas" />;
}
