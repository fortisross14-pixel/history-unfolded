import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { displayYear } from '../engine/index.ts';
import type { WorldState } from '../types.ts';
import { type Sel } from './shared.tsx';
import { World } from './WorldView.tsx';

export function Chronicle({ world, open }: { world: WorldState; open: (s: Sel) => void }) {
  const [sub, setSub] = useState<'events' | 'world'>('events'),
    [cat, setCat] = useState('all'),
    [realm, setRealm] = useState('all');
  const data = world.events.filter(
    e =>
      (sub === 'events' || e.worldChronicle) &&
      (cat === 'all' || e.category === cat) &&
      (realm === 'all' || e.civIds.includes(+realm)),
  );
  return (
    <main className="page">
      <h1>Chronicle</h1>
      <div className="subtabs">
        <button className={sub === 'events' ? 'active' : ''} onClick={() => setSub('events')}>
          Events
        </button>
        <button className={sub === 'world' ? 'active' : ''} onClick={() => setSub('world')}>
          World Chronicles
        </button>
      </div>
      <div className="filters">
        <select value={cat} onChange={e => setCat(e.target.value)}>
          <option value="all">All types</option>
          {[...new Set(world.events.map(e => e.category))].map(x => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select value={realm} onChange={e => setRealm(e.target.value)}>
          <option value="all">All realms</option>
          {world.civilizations.map(c => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <p className="chron-count">
        Showing {Math.min(data.length, 500).toLocaleString()} of {data.length.toLocaleString()}{' '}
        matching events.
      </p>
      <div className="chron">
        {data.slice(0, 500).map(e => (
          <article className={e.worldChronicle ? 'event major' : 'event'} key={e.id}>
            <small>
              {displayYear(e.year)} · {e.category}
            </small>
            <h3>{e.title}</h3>
            <p>{e.description}</p>
            <div className="chips">
              {e.tags.map(t => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <div>
              {e.civIds.slice(0, 3).map(id => (
                <button onClick={() => open({ type: 'realm', id })} key={id}>
                  {world.civilizations.find(c => c.id === id)?.name}
                  <ChevronRight />
                </button>
              ))}
              {e.personIds.slice(0, 2).map(id => (
                <button onClick={() => open({ type: 'person', id })} key={id}>
                  {world.people.find(p => p.id === id)?.name}
                  <ChevronRight />
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
