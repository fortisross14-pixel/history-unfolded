import { useMemo, useState } from 'react';
import { displayYear } from '../engine/index.ts';
import type { HistoryEvent, WorldState } from '../types.ts';

/** The five top-level sections. */
export type View = 'map' | 'realm' | 'characters' | 'chronicle' | 'records';

export type MapMode = 'political' | 'development' | 'culture' | 'religion' | 'geography';

export type Sel = {
  type:
    | 'realm'
    | 'city'
    | 'continent'
    | 'character'
    | 'religion'
    | 'culture'
    | 'dynasty'
    | 'war'
    | 'moment'
    | 'wonder';
  id: number;
} | null;

export const fmt = (n: number, d = 0) =>
  Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })
    : '—';

export const pct = (start: number, end?: number) =>
  end === undefined
    ? '—'
    : `${Math.max(-99.9, Math.min(999.9, (end / Math.max(0.01, start) - 1) * 100)).toFixed(1)}%`;

export function MiniEvent({
  e,
  world,
  open,
}: {
  e: HistoryEvent;
  world: WorldState;
  open: (s: Sel) => void;
}) {
  return (
    <button
      className="mini-event"
      onClick={() => e.civIds[0] && open({ type: 'realm', id: e.civIds[0] })}
    >
      <small>
        {displayYear(e.year)} · {e.category}
      </small>
      <strong>{e.title}</strong>
      <span>{e.description}</span>
    </button>
  );
}

export function link(text: string, onClick: () => void) {
  return (
    <button className="link" onClick={onClick}>
      {text}
    </button>
  );
}

export function Table({ heads, rows }: { heads: string[]; rows: any[][] }) {
  const [sort, setSort] = useState(0),
    [asc, setAsc] = useState(true);
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const raw = (x: any) => (typeof x === 'number' ? x : String(x?.props?.children ?? x ?? ''));
        const av = raw(a[sort]),
          bv = raw(b[sort]);
        return (av > bv ? 1 : av < bv ? -1 : 0) * (asc ? 1 : -1);
      }),
    [rows, sort, asc],
  );
  return (
    <div className="table">
      <table>
        <thead>
          <tr>
            {heads.map((h, i) => (
              <th
                onClick={() => {
                  if (sort === i) setAsc(!asc);
                  else {
                    setSort(i);
                    setAsc(true);
                  }
                }}
                key={h}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={i}>
              {r.map((x, j) => (
                <td key={j}>{typeof x === 'number' ? fmt(x, Number.isInteger(x) ? 0 : 1) : x}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Metrics({ vals }: { vals: [string, string][] }) {
  return (
    <div className="metrics">
      {vals.map(([k, v]) => (
        <div key={k}>
          <small>{k}</small>
          <strong>{v}</strong>
        </div>
      ))}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: any }) {
  return (
    <section className="section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function List({ items }: { items: { name: string; sub: string; onClick?: () => void }[] }) {
  return (
    <div className="list">
      {items.length ? (
        items.map((x, i) => (
          <button disabled={!x.onClick} onClick={x.onClick} key={`${x.name}-${i}`}>
            {x.name}
            <small>{x.sub}</small>
          </button>
        ))
      ) : (
        <p className="empty">Nothing recorded yet.</p>
      )}
    </div>
  );
}
