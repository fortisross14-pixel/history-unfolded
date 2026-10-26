import { useState } from 'react';
import { Globe2, Trash2, X } from 'lucide-react';
import { displayYear } from '../engine/index.ts';
import type { MapKind, MapSize, NameMode, WorldConfig, SaveSlot } from '../types.ts';
import { SCENARIOS } from '../engine/scenarios.ts';

export function Title({
  slots,
  start,
  load,
  del,
  setup,
  cancel,
  create,
}: {
  slots: SaveSlot[];
  start: (n: number) => void;
  load: (n: number) => void;
  del: (n: number) => void;
  setup: number | null;
  cancel: () => void;
  create: (n: number, c: WorldConfig) => void;
}) {
  return (
    <div className="title-screen">
      <div className="brand">
        <Globe2 />
        <span>HISTORY UNFOLDED</span>
        <small>A living history documentary generator</small>
      </div>
      <div className="slots">
        {slots.map(s => (
          <article className="slot" key={s.slot}>
            <span className="eyebrow">Chronicle {s.slot}</span>
            {s.world ? (
              <>
                <h2>{s.world.config.name}</h2>
                <p>
                  {displayYear(s.world.year)} ·{' '}
                  {s.world.config.map === 'earth'
                    ? 'Earth'
                    : `${s.world.config.mapSize} fantasy world`}{' '}
                  · {s.world.civilizations.filter(c => c.provinces.length).length} living realms
                </p>
                <div>
                  <button className="primary" onClick={() => load(s.slot)}>
                    Continue
                  </button>
                  <button onClick={() => del(s.slot)}>
                    <Trash2 /> Delete
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>Empty chronicle</h2>
                <p>Create a world and watch five thousand years of history unfold.</p>
                <button className="primary" onClick={() => start(s.slot)}>
                  Start new
                </button>
              </>
            )}
          </article>
        ))}
      </div>
      {setup && <Setup slot={setup} cancel={cancel} create={create} />}
    </div>
  );
}

export function Setup({
  slot,
  cancel,
  create,
}: {
  slot: number;
  cancel: () => void;
  create: (n: number, c: WorldConfig) => void;
}) {
  const [name, setName] = useState('The Known World'),
    [map, setMap] = useState<MapKind>('earth'),
    [startYear, setStartYear] = useState(-3000),
    [mapSize, setSize] = useState<MapSize>('medium'),
    [tribes, setTribes] = useState(36),
    [variant, setVariant] = useState(0),
    [nameMode, setNameMode] = useState<NameMode>('mixed');
  const limits = { small: 28, medium: 70, large: 120, huge: 220 };
  const earth = map === 'earth';
  return (
    <div className="modal">
      <div>
        <button className="close" onClick={cancel} aria-label="Close">
          <X />
        </button>
        <span className="eyebrow">New Chronicle · Slot {slot}</span>
        <h1>Create a world</h1>
        <label>
          World name
          <input value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label>
          Map
          <select value={map} onChange={e => setMap(e.target.value as MapKind)}>
            <option value="earth">Earth: real geography</option>
            <option value="fantasy">Fantasy world: new continents every time</option>
          </select>
        </label>
        {earth ? (
          <label>
            Start date
            <select value={startYear} onChange={e => setStartYear(+e.target.value)}>
              {SCENARIOS.map(x => (
                <option value={x.year} key={x.year}>
                  {x.label}
                </option>
              ))}
            </select>
            <small className="field-help">
              Starting realms, cultures and faiths are real. Rulers are invented, and everything
              after the start is simulated.
            </small>
          </label>
        ) : (
          <>
            <label>
              Naming style
              <select value={nameMode} onChange={e => setNameMode(e.target.value as NameMode)}>
                <option value="real">Real names</option>
                <option value="fictional">Fictional names</option>
                <option value="mixed">Mixed names</option>
              </select>
            </label>
            <label>
              Map size
              <select
                value={mapSize}
                onChange={e => {
                  const v = e.target.value as MapSize;
                  setSize(v);
                  setTribes(Math.min(tribes, limits[v]));
                }}
              >
                {['small', 'medium', 'large', 'huge'].map(x => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Continental layout
              <select value={variant} onChange={e => setVariant(+e.target.value)}>
                <option value="0">Twin worlds</option>
                <option value="1">Four continents</option>
                <option value="2">Old and new worlds</option>
              </select>
            </label>
            <label>
              Starting tribes: {tribes}
              <input
                type="range"
                min="8"
                max={limits[mapSize]}
                value={tribes}
                onChange={e => setTribes(+e.target.value)}
              />
            </label>
          </>
        )}
        <button
          className="primary wide"
          onClick={() =>
            create(slot, {
              name,
              map,
              start: earth ? startYear : -3000,
              mapSize,
              mapVariant: variant,
              tribeCount: tribes,
              nameMode,
            })
          }
        >
          Begin in {displayYear(earth ? startYear : -3000)}
        </button>
      </div>
    </div>
  );
}
