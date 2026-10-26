import { useState } from 'react';
import { Globe2, Trash2, X } from 'lucide-react';
import { displayYear } from '../engine/index.ts';
import type { MapSize, NameMode, WorldConfig, SaveSlot } from '../types.ts';

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
                  {displayYear(s.world.year)} · {s.world.config.mapSize} world ·{' '}
                  {s.world.civilizations.filter(c => c.provinces.length).length} living realms
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
    [mapSize, setSize] = useState<MapSize>('medium'),
    [tribes, setTribes] = useState(36),
    [variant, setVariant] = useState(0),
    [nameMode, setNameMode] = useState<NameMode>('mixed');
  const limits = { small: 28, medium: 70, large: 120, huge: 220 };
  return (
    <div className="modal">
      <div>
        <button className="close" onClick={cancel}>
          <X />
        </button>
        <span className="eyebrow">New Chronicle · Slot {slot}</span>
        <h1>Create a world</h1>
        <label>
          World name
          <input value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label>
          Naming style
          <select value={nameMode} onChange={e => setNameMode(e.target.value as NameMode)}>
            <option value="real">Real names</option>
            <option value="fictional">Fictional names</option>
            <option value="mixed">Mixed names</option>
          </select>
          <small className="field-help">Great people always use the historical name pool.</small>
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
        <button
          className="primary wide"
          onClick={() =>
            create(slot, { name, mapSize, mapVariant: variant, tribeCount: tribes, nameMode })
          }
        >
          Begin in 3000 BCE
        </button>
      </div>
    </div>
  );
}
