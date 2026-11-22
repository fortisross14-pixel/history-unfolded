import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SLOT_TYPES } from '../data/slots.ts';
import { cityDistricts, DISTRICT_CAP, isCentre } from '../engine/economy.ts';
import { freeDistrictHexes } from '../engine/game.ts';
import { centerUnit } from '../engine/hex.ts';
import type { City, District, GameState } from '../engine/types.ts';
import type { CityScene3D, CityView } from '../render/city3d.ts';

/**
 * The settlement in low-poly 3D, above the district editor: the centre with its town hall,
 * the other districts around it, and bare plots where districts may still be laid out. Click a
 * tile to pick that district and slot; drag to turn the view; scroll to zoom. three.js loads
 * only when a city screen opens.
 */
export function CityScene({
  game,
  c,
  selected,
  cell,
  onPick,
  children,
}: {
  game: GameState;
  c: City;
  /** the district shown in the editor */
  selected?: number;
  cell: number | null;
  onPick: (district: number | 'new', cell: number | null) => void;
  /** shown over the scene: the picker for the chosen plot */
  children?: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<CityScene3D | null>(null);
  const [failed, setFailed] = useState(false);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  // the districts in scene order: the centre first, then the rest, then empty sites
  const ds = cityDistricts(game, c);
  const ordered: District[] = [...ds.filter(isCentre), ...ds.filter(d => !isCentre(d))];
  // districts stand where their hexes are around the centre; free plots on hexes still open
  const g = { w: game.map.w, h: game.map.h };
  const [ox, oz] = centerUnit(g, c.hex);
  const at = (hex: number): [number, number] => {
    const [x, z] = centerUnit(g, hex);
    return [(x - ox) * 2.55, (z - oz) * 2.55];
  };
  const open = freeDistrictHexes(game, c).slice(
    0,
    Math.max(0, DISTRICT_CAP[c.tier] - ordered.length),
  );
  const view: CityView = {
    key: `${c.id}|${c.tier}|${open.join(',')}|${ordered.map(d => d.id + ':' + d.slots.map(x => (x.type ?? '-') + (x.built ? '+' : '')).join(',')).join(';')}`,
    seed: c.id * 7919 + 13,
    districts: [
      ...ordered.map(d => ({
        id: d.id,
        name: d.name,
        pos: at(d.hex),
        slots: d.slots.map(x => ({
          type: x.type,
          built: x.built,
          group: x.type ? SLOT_TYPES[x.type]?.group : undefined,
        })),
      })),
      ...open.map(h => ({ id: null, name: 'Free site', slots: null, pos: at(h) })),
    ].slice(0, 7),
    selected:
      selected !== undefined && ordered.findIndex(d => d.id === selected) >= 0
        ? { district: ordered.findIndex(d => d.id === selected), slot: cell }
        : undefined,
  };
  const ids = view.districts.map(d => d.id);

  useEffect(() => {
    let live = true;
    import('../render/city3d.ts')
      .then(m => {
        if (!live || !host.current) return;
        scene.current = new m.CityScene3D(host.current, p => {
          const id = idsRef.current[p.district];
          pickRef.current(id === null || id === undefined ? 'new' : id, p.slot);
        });
        scene.current.set(viewRef.current);
      })
      .catch(() => setFailed(true));
    return () => {
      live = false;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [c.id]);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    scene.current?.set(view);
  });

  if (failed) return null;
  return (
    <div className="city-scene" ref={host} aria-label={`${c.name} in 3D: click a plot to pick it`}>
      <button
        className="secondary city-scene-whole"
        onClick={() => scene.current?.focus(null)}
        title="See every district of the settlement"
      >
        Whole settlement
      </button>
      {children && <div className="city-scene-over">{children}</div>}
      <span className="city-scene-hint small">
        {ordered.length} of {DISTRICT_CAP[c.tier]} districts · click a plot · drag to turn
      </span>
    </div>
  );
}
