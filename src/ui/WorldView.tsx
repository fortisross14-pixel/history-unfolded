import { useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { WorldState } from '../types.ts';
import { eraName, populationOf } from '../engine/index.ts';
import { type MapMode, type Sel, fmt, MiniEvent } from './shared.tsx';
import { MomentHeadlines } from './MomentPage.tsx';

export function World({
  world,
  mode,
  setMode,
  open,
}: {
  world: WorldState;
  mode: MapMode;
  setMode: (m: MapMode) => void;
  open: (s: Sel) => void;
}) {
  const living = world.civilizations
    .filter(c => c.provinces.length)
    .sort((a, b) => b.power - a.power);
  return (
    <main className="dashboard">
      <MomentHeadlines world={world} open={open} />
      <section className="map-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">World map</span>
            <h1>{world.config.name}</h1>
          </div>
          <div className="segmented">
            {(['political', 'development', 'culture', 'religion', 'geography'] as MapMode[]).map(
              m => (
                <button className={mode === m ? 'active' : ''} onClick={() => setMode(m)} key={m}>
                  {m}
                </button>
              ),
            )}
          </div>
        </div>
        <HexMap world={world} mode={mode} open={open} />
      </section>
      <aside className="side">
        <section>
          <span className="eyebrow">World leaders</span>
          <h2>Power</h2>
          {living.slice(0, 8).map((c, i) => (
            <button className="rank" onClick={() => open({ type: 'realm', id: c.id })} key={c.id}>
              <b>{i + 1}</b>
              <span>
                <strong>{c.name}</strong>
                <small>
                  {c.rank} · {eraName(c.era)} · {fmt(populationOf(c.development, c.era))} people
                </small>
              </span>
              <em title="Share of the world's land, wealth and armed forces">
                {(c.power / 10).toFixed(1)}%
              </em>
            </button>
          ))}
        </section>
        <section>
          <span className="eyebrow">Latest history</span>
          {world.events.slice(0, 5).map(e => (
            <MiniEvent e={e} world={world} open={open} key={e.id} />
          ))}
        </section>
      </aside>
    </main>
  );
}

export function HexMap({
  world,
  mode,
  open,
}: {
  world: WorldState;
  mode: MapMode;
  open: (s: Sel) => void;
}) {
  const [zoom, setZoom] = useState(0.75);
  const box = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; y: number; l: number; t: number } | null>(null);
  const terrain: Record<string, string> = {
    ocean: '#092838',
    plains: '#94a06c',
    forest: '#486b52',
    desert: '#bd9c5d',
    mountain: '#747779',
    tundra: '#b9c4c5',
  };
  const maxDev = Math.max(1, ...world.provinces.map(p => p.development));
  const fill = (p: WorldState['provinces'][0]) => {
    if (mode === 'geography') return terrain[p.terrain];
    if (p.terrain === 'ocean') return '#092838';
    if (mode === 'political')
      return world.civilizations.find(c => c.id === p.ownerId)?.color ?? '#535b5f';
    if (mode === 'culture')
      return world.cultures.find(c => c.id === p.cultureId)?.color ?? '#535b5f';
    if (mode === 'development') {
      // Darker to brighter gold as development rises.
      const t = Math.min(1, p.development / maxDev);
      return `hsl(40 ${Math.round(25 + t * 55)}% ${Math.round(16 + t * 50)}%)`;
    }
    return world.religions.find(r => r.id === p.religionId)?.color ?? '#535b5f';
  };
  const size = 18,
    dx = 27,
    dy = 31.2,
    pts = (cx: number, cy: number) =>
      Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 180) * i * 60;
        return `${cx + size * Math.cos(a)},${cy + size * Math.sin(a)}`;
      }).join(' ');
  return (
    <div className="maptools">
      <button onClick={() => setZoom(z => Math.min(2.2, z + 0.15))}>
        <Plus />
      </button>
      <button onClick={() => setZoom(z => Math.max(0.25, z - 0.15))}>
        <Minus />
      </button>
      <span>{Math.round(zoom * 100)}%</span>
      <div
        className="mapbox"
        ref={box}
        onWheel={e => {
          if (e.ctrlKey) {
            e.preventDefault();
            setZoom(z => Math.max(0.25, Math.min(2.2, z - e.deltaY * 0.001)));
          }
        }}
        onMouseDown={e => {
          if (box.current)
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              l: box.current.scrollLeft,
              t: box.current.scrollTop,
            };
        }}
        onMouseMove={e => {
          if (drag.current && box.current) {
            box.current.scrollLeft = drag.current.l - (e.clientX - drag.current.x);
            box.current.scrollTop = drag.current.t - (e.clientY - drag.current.y);
          }
        }}
        onMouseUp={() => (drag.current = null)}
        onMouseLeave={() => (drag.current = null)}
      >
        <svg
          style={{ width: (world.width * dx + 60) * zoom, height: (world.height * dy + 60) * zoom }}
          viewBox={`0 0 ${world.width * dx + 60} ${world.height * dy + 60}`}
        >
          {world.provinces.map(p => {
            const cx = 30 + p.x * dx,
              cy = 30 + p.y * dy + (p.x % 2 ? dy / 2 : 0);
            const city = p.cityId ? world.cities.find(c => c.id === p.cityId) : null;
            return (
              <g key={p.id}>
                <polygon
                  points={pts(cx, cy)}
                  fill={fill(p)}
                  onClick={() =>
                    mode === 'geography' && p.continentId !== null
                      ? open({ type: 'continent', id: p.continentId })
                      : p.ownerId
                        ? open({ type: 'realm', id: p.ownerId })
                        : undefined
                  }
                />
                {city && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={city.isCapital ? 4 : 2.5}
                    className="citydot"
                    onClick={() => open({ type: 'city', id: city.id })}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
