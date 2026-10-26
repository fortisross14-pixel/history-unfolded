import { useState } from 'react';
import type { WorldState } from '../types.ts';
import { worldRecords } from '../engine/recordbook.ts';
import type { Sel } from './shared.tsx';
import { HallOfFame } from './HallOfFame.tsx';
import { Evolution } from './Evolution.tsx';
import { Almanac } from './Almanac.tsx';
import { SeasonList } from './SeasonRecap.tsx';

type Tab = 'book' | 'seasons' | 'hall' | 'evolution' | 'almanac';

/** The all-time records, like a sports record book. */
function RecordBook({ world, open }: { world: WorldState; open: (s: Sel) => void }) {
  const records = worldRecords(world);
  return (
    <div className="record-grid">
      {records.map(r => (
        <button
          key={r.title}
          className="record-card"
          disabled={!r.link}
          onClick={() => r.link && open({ type: r.link.type, id: r.link.id })}
        >
          <small>{r.title}</small>
          <strong>{r.holder}</strong>
          <b>{r.value}</b>
          <span>{r.detail}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Records: the record book, every century's season, the Hall of Fame, how
 * powers rose and fell, and the full almanac.
 */
export function Records({
  world,
  open,
  showSeason,
}: {
  world: WorldState;
  open: (s: Sel) => void;
  showSeason?: (year: number) => void;
}) {
  const [tab, setTab] = useState<Tab>('book');
  const tabs: [Tab, string][] = [
    ['book', 'Record book'],
    ['seasons', 'Centuries'],
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
      {tab === 'book' && <RecordBook world={world} open={open} />}
      {tab === 'seasons' && <SeasonList world={world} show={year => showSeason?.(year)} />}
      {tab === 'hall' && <HallOfFame world={world} open={open} />}
      {tab === 'evolution' && <Evolution world={world} open={open} />}
      {tab === 'almanac' && <Almanac world={world} open={open} />}
    </main>
  );
}
