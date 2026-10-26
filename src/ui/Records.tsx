import { useState } from 'react';
import type { WorldState } from '../types.ts';
import type { Sel } from './shared.tsx';
import { HallOfFame } from './HallOfFame.tsx';
import { Evolution } from './Evolution.tsx';
import { Almanac } from './Almanac.tsx';

type Tab = 'hall' | 'evolution' | 'almanac';

/** Records: the Hall of Fame, how powers rose and fell, and the full almanac. */
export function Records({ world, open }: { world: WorldState; open: (s: Sel) => void }) {
  const [tab, setTab] = useState<Tab>('hall');
  const tabs: [Tab, string][] = [
    ['hall', 'Hall of Fame'],
    ['evolution', 'Rise and fall'],
    ['almanac', 'Almanac'],
  ];
  return (
    <main className="page records-page">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">The record of the world</span>
          <h1>Records</h1>
        </div>
      </div>
      <div className="subtabs">
        {tabs.map(([t, label]) => (
          <button className={tab === t ? 'active' : ''} onClick={() => setTab(t)} key={t}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'hall' && <HallOfFame world={world} open={open} />}
      {tab === 'evolution' && <Evolution world={world} open={open} />}
      {tab === 'almanac' && <Almanac world={world} open={open} />}
    </main>
  );
}
