import { useEffect, useRef } from 'react';
import type { GameState } from '../engine/types.ts';
import type { Assets } from '../render/assets.ts';
import { MapRenderer, type Insets, type Overlay } from '../render/mapRenderer.ts';

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
  const rr = useRef<MapRenderer | null>(null);
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
      if (r.wantsSettle) setTimeout(redraw, 200);
    });
  };

  useEffect(() => {
    const canvas = ref.current!;
    const r = new MapRenderer(canvas, assets);
    rr.current = r;
    const parent = canvas.parentElement!;
    const ro = new ResizeObserver(() => {
      r.resize(parent.clientWidth, parent.clientHeight);
      r.clamp(props.current.game, props.current.insets);
      redraw();
    });
    ro.observe(parent);
    r.resize(parent.clientWidth, parent.clientHeight);

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
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onPtrMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', noMenu);
    };
  }, [assets]);

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
