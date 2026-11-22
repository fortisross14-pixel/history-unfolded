import { useEffect, useRef } from 'react';
import type { GameState } from '../engine/types.ts';
import type { Assets } from '../render/assets.ts';
import { MapRenderer, type Overlay } from '../render/mapRenderer.ts';

interface Props {
  game: GameState;
  civId: number;
  assets: Assets;
  version: number;
  overlay: Overlay;
  centerOn: { hex: number; n: number } | null;
  onClick: (hex: number) => void;
  onMove: (hex: number) => void;
  onHover: (hex: number) => void;
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
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rr = useRef<MapRenderer | null>(null);
  const frame = useRef(0);
  const props = useRef({ game, civId, overlay, onClick, onMove, onHover });
  props.current = { game, civId, overlay, onClick, onMove, onHover };

  const redraw = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const r = rr.current;
      if (r) r.draw(props.current.game, props.current.civId, props.current.overlay);
    });
  };

  useEffect(() => {
    const canvas = ref.current!;
    const r = new MapRenderer(canvas, assets);
    rr.current = r;
    const parent = canvas.parentElement!;
    const ro = new ResizeObserver(() => {
      r.resize(parent.clientWidth, parent.clientHeight);
      r.clamp(props.current.game);
      redraw();
    });
    ro.observe(parent);
    r.resize(parent.clientWidth, parent.clientHeight);

    // pointer handling: one pointer pans (or clicks if it barely moved), two pointers pinch-zoom
    const pts = new Map<number, { x: number; y: number }>();
    let down: { x: number; y: number; moved: boolean; button: number } | null = null;
    let pinch = 0;
    const local = (e: PointerEvent | WheelEvent | MouseEvent) => {
      const b = canvas.getBoundingClientRect();
      return { x: e.clientX - b.left, y: e.clientY - b.top };
    };
    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const p = local(e);
      pts.set(e.pointerId, p);
      if (pts.size === 1) down = { ...p, moved: false, button: e.button };
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
        if (down) down.moved = true;
      }
    };
    const onPtrMove = (e: PointerEvent) => {
      const p = local(e);
      const prev = pts.get(e.pointerId);
      if (!prev) {
        const h = r.hexAtScreen(props.current.game, p.x, p.y);
        props.current.onHover(h);
        return;
      }
      pts.set(e.pointerId, p);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) r.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch);
        pinch = d;
      } else if (down && down.button === 0) {
        if (Math.hypot(p.x - down.x, p.y - down.y) > 5) down.moved = true;
        if (down.moved) {
          r.cam.x -= (p.x - prev.x) / r.cam.zoom;
          r.cam.y -= (p.y - prev.y) / r.cam.zoom;
        }
      }
      r.clamp(props.current.game);
      redraw();
    };
    const onUp = (e: PointerEvent) => {
      const p = local(e);
      pts.delete(e.pointerId);
      if (pts.size === 0 && down && !down.moved) {
        const h = r.hexAtScreen(props.current.game, p.x, p.y);
        if (h >= 0) {
          if (down.button === 2) props.current.onMove(h);
          else if (down.button === 0) props.current.onClick(h);
        }
      }
      if (pts.size === 0) down = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      r.zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
      r.clamp(props.current.game);
      redraw();
    };
    const noMenu = (e: MouseEvent) => e.preventDefault();
    const onLeave = () => props.current.onHover(-1);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onPtrMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', noMenu);
    return () => {
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onPtrMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', noMenu);
    };
  }, [assets]);

  useEffect(() => {
    if (centerOn && rr.current) {
      rr.current.centerOn(game, centerOn.hex);
      rr.current.clamp(game);
    }
    redraw();
  }, [centerOn]);

  useEffect(redraw, [version, overlay]);

  return <canvas ref={ref} className="map-canvas" />;
}
