import { useEffect, useRef } from 'react';
import { isWater } from '../data/terrain.ts';
import { territory } from '../engine/game.ts';
import { centerUnit, hexAtUnit, pixelSizeUnit } from '../engine/hex.ts';
import type { GameState } from '../engine/types.ts';

const LAND: Record<string, string> = {
  grassland: '#a7b86f',
  plains: '#c4b676',
  desert: '#dcc58a',
  tundra: '#a9a58a',
  snow: '#eef0ee',
};

/**
 * The whole known world, small: land and sea, each people's land in its colour, settlements as
 * dots, and the part on screen framed. Click or drag on it to look there.
 */
export function Minimap({
  game,
  civId,
  version,
  view,
  onJump,
}: {
  game: GameState;
  civId: number;
  version: number;
  /** the part of the world on screen, in hex-radius units */
  view: [number, number, number, number] | null;
  onJump: (hex: number) => void;
}) {
  const base = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLCanvasElement>(null);
  const g = { w: game.map.w, h: game.map.h };
  // the explored part of the world, with a margin, so a small known world still fills the box
  const known = game.civs[civId].explored;
  const [W0, H0] = pixelSizeUnit(g);
  let x0 = W0,
    y0 = H0,
    x1 = 0,
    y1 = 0;
  for (let i = 0; i < g.w * g.h; i++) {
    if (!known[i]) continue;
    const [x, y] = centerUnit(g, i);
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  const pad = 3;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(W0, x1 + pad);
  y1 = Math.min(H0, y1 + pad);
  if (x1 <= x0) [x0, y0, x1, y1] = [0, 0, W0, H0];
  const width = 250;
  const k = Math.min(width / (x1 - x0), 180 / (y1 - y0));
  const height = Math.max(90, Math.round((y1 - y0) * k));
  const ox = (width - (x1 - x0) * k) / 2 - x0 * k;
  const oy = (height - (y1 - y0) * k) / 2 - y0 * k;

  // the map itself: redrawn when the game changes
  useEffect(() => {
    const c = base.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = width * dpr;
    c.height = height * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    const own = territory(game);
    const r = Math.max(1.2, k * 1.05);
    for (let i = 0; i < g.w * g.h; i++) {
      if (!known[i]) continue;
      const [x, y] = centerUnit(g, i);
      const t = game.map.terrain[i];
      ctx.fillStyle = isWater(t)
        ? t === 'ocean'
          ? '#5b8aa3'
          : '#7eaabb'
        : game.map.relief[i] === 'mountains'
          ? '#958d80'
          : (LAND[t] ?? '#a7b86f');
      ctx.fillRect(ox + x * k - r, oy + y * k - r, r * 2, r * 2);
      const o = own[i];
      if (o >= 0) {
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = game.civs[o].color;
        ctx.fillRect(ox + x * k - r, oy + y * k - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
    }
    for (const city of game.cities) {
      if (!known[city.hex]) continue;
      const [x, y] = centerUnit(g, city.hex);
      ctx.fillStyle = game.civs[city.civId].color;
      ctx.strokeStyle = '#fbf7ee';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ox + x * k, oy + y * k, city.civId === civId ? 3 : 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }, [game, civId, version, ox, oy, k]);

  // the frame of what is on screen
  useEffect(() => {
    const c = frame.current;
    if (!c || !view) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = width * dpr;
    c.height = height * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const [vx0, vy0, vx1, vy1] = view;
    ctx.strokeStyle = '#2a2419';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ox + vx0 * k, oy + vy0 * k, (vx1 - vx0) * k, (vy1 - vy0) * k);
  }, [view?.join(','), ox, oy, k]);

  const jump = (e: React.PointerEvent) => {
    const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const hex = hexAtUnit(g, (e.clientX - b.left - ox) / k, (e.clientY - b.top - oy) / k);
    if (hex >= 0) onJump(hex);
  };
  return (
    <div
      className="minimap"
      style={{ width, height }}
      onPointerDown={e => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        jump(e);
      }}
      onPointerMove={e => {
        if (e.buttons) jump(e);
      }}
      role="img"
      aria-label="Minimap: click to look there"
      title="Minimap: click or drag to look there (M hides it)"
    >
      <canvas ref={base} style={{ width, height }} />
      <canvas ref={frame} style={{ width, height }} />
    </div>
  );
}
