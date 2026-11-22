import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../engine/types.ts';
import type { Map3D } from '../render/map3d.ts';

/**
 * A preview of the map in low-poly 3D around a hex: drag to pan, right-drag (or shift-drag) or
 * the arrows to turn, wheel to zoom. three.js loads only when it opens.
 */
export function Map3DView({
  game,
  civId,
  center,
  onClose,
}: {
  game: GameState;
  civId: number;
  center: number;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<Map3D | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    import('../render/map3d.ts')
      .then(m => {
        if (!live || !host.current) return;
        view.current = new m.Map3D(host.current);
        view.current.show(game, civId, center);
      })
      .catch(() => setFailed(true));
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', key);
    return () => {
      live = false;
      window.removeEventListener('keydown', key);
      view.current?.dispose();
      view.current = null;
    };
  }, [center]);
  return (
    <div className="map3d" role="dialog" aria-label="The map in 3D (preview)">
      <div className="map3d-scene" ref={host} />
      <div className="map3d-bar">
        <b>3D map (preview)</b>
        <span className="small muted">
          drag to pan · right-drag or arrows to turn · wheel to zoom
        </span>
        <button
          className="secondary"
          onClick={() => view.current?.turn(-Math.PI / 6)}
          aria-label="Turn left"
        >
          ⟲
        </button>
        <button
          className="secondary"
          onClick={() => view.current?.turn(Math.PI / 6)}
          aria-label="Turn right"
        >
          ⟳
        </button>
        <button className="primary" onClick={onClose}>
          Back to the map
        </button>
      </div>
      {failed && <p className="map3d-fail">This device cannot show 3D.</p>}
    </div>
  );
}
