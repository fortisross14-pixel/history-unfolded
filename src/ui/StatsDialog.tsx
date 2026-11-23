import { useState } from 'react';
import { ERAS, ageOf } from '../data/techs.ts';
import type { GameState } from '../engine/types.ts';
import {
  currentStats,
  METRICS,
  metricOf,
  type ChronicleEntry,
  type MetricId,
} from '../engine/stats.ts';

type Tab = 'rank' | 'chart' | 'chronicle';

const KIND_MARK: Record<ChronicleEntry['kind'], string> = {
  age: '✦',
  war: '⚔',
  peace: '☮',
  capture: '⚑',
  found: '⌂',
  grow: '▲',
  crisis: '☠',
  direction: '➶',
  dynasty: '♛',
  victory: '★',
  faith: '☀',
  wonder: '♜',
  other: '•',
};

const fmt = (m: MetricId, v: number | null) =>
  v === null ? '—' : m === 'pop' ? `${(v / 1000).toFixed(1)}k` : Math.round(v).toLocaleString();

/** Who the player may see in the statistics: themselves and the great peoples they have met. */
export const knownPeoples = (s: GameState, civId: number) =>
  s.civs.filter(c => !c.independent && (c.id === civId || s.civs[civId].met.includes(c.id)));

/**
 * Compare peoples by population, settlements, techs, culture, wealth, military power and score,
 * now (rankings) and over the game (charts), and read the chronicle of what happened.
 */
export function StatsDialog({
  game,
  civId,
  onClose,
}: {
  game: GameState;
  civId: number;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('rank');
  const [metric, setMetric] = useState<MetricId>('score');
  const [sortBy, setSortBy] = useState<MetricId>('score');
  const [mineOnly, setMineOnly] = useState(false);
  const known = knownPeoples(game, civId);
  const alive = known.filter(c => c.alive);
  const unmet = game.civs.filter(c => !c.independent && c.alive && !known.includes(c)).length;
  const rows = alive
    .map(c => ({ c, v: currentStats(game, c.id) }))
    .sort((a, b) => metricOf(b.v, sortBy)! - metricOf(a.v, sortBy)!);
  const rankOf = (m: MetricId, id: number) =>
    alive
      .map(c => ({ id: c.id, v: metricOf(currentStats(game, c.id), m)! }))
      .sort((a, b) => b.v - a.v)
      .findIndex(x => x.id === id) + 1;
  const entries = (game.chronicle ?? [])
    .filter(e => (mineOnly ? e.civId === civId : known.some(c => c.id === e.civId)))
    .slice()
    .reverse();

  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal stats"
        role="dialog"
        aria-modal="true"
        aria-label="Chronicle and statistics"
        onClick={e => e.stopPropagation()}
      >
        <header>
          <h2>
            Chronicle &amp; statistics <small>turn {game.turn}</small>
          </h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="stats-tabs" role="tablist">
          {(
            [
              ['rank', 'Rankings'],
              ['chart', 'Over time'],
              ['chronicle', 'Chronicle'],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              className={tab === k ? 'on' : ''}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'rank' && (
          <>
            <div className="stats-table-wrap">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>People</th>
                    <th>Age</th>
                    {METRICS.map(m => (
                      <th key={m.id}>
                        <button
                          className={`link ${sortBy === m.id ? 'on' : ''}`}
                          onClick={() => setSortBy(m.id)}
                          title={`Sort by ${m.name.toLowerCase()}`}
                        >
                          {m.name}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ c, v }) => (
                    <tr key={c.id} className={c.id === civId ? 'me' : ''}>
                      <td>
                        <span className="swatch" style={{ background: c.color }} /> {c.name}
                      </td>
                      <td>{ERAS[ageOf(c.techs)]}</td>
                      {METRICS.map(m => (
                        <td key={m.id}>
                          {fmt(m.id, metricOf(v, m.id))}
                          <small className="muted"> #{rankOf(m.id, c.id)}</small>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">
              Among the {alive.length} great peoples you know
              {unmet ? `; ${unmet} more you have not met yet are not shown` : ''}. Click a column to
              sort.
            </p>
          </>
        )}

        {tab === 'chart' && (
          <>
            <div className="stats-metrics">
              {METRICS.map(m => (
                <button
                  key={m.id}
                  className={metric === m.id ? 'on' : ''}
                  onClick={() => setMetric(m.id)}
                >
                  {m.name}
                </button>
              ))}
            </div>
            <StatsChart game={game} civId={civId} metric={metric} />
          </>
        )}

        {tab === 'chronicle' && (
          <>
            <div className="stats-metrics">
              <button className={!mineOnly ? 'on' : ''} onClick={() => setMineOnly(false)}>
                All peoples you know
              </button>
              <button className={mineOnly ? 'on' : ''} onClick={() => setMineOnly(true)}>
                Your people
              </button>
            </div>
            <ol className="chronicle">
              {entries.length ? (
                entries.map((e, i) => (
                  <li key={i} className={e.civId === civId ? 'me' : ''}>
                    <span className="chron-turn">Turn {e.turn}</span>
                    <span className="chron-mark" style={{ color: game.civs[e.civId]?.color }}>
                      {KIND_MARK[e.kind]}
                    </span>
                    <span>{e.text}</span>
                  </li>
                ))
              ) : (
                <li className="muted">Nothing yet: history is still to be written.</li>
              )}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

/** One metric over the turns, a line per known people (yours thicker). */
export function StatsChart({
  game,
  civId,
  metric,
  height = 260,
}: {
  game: GameState;
  civId: number;
  metric: MetricId;
  height?: number;
}) {
  const rows = game.statsHistory ?? [];
  const known = knownPeoples(game, civId);
  const W = 640,
    H = height,
    L = 52,
    R = 12,
    T = 12,
    B = 28;
  if (rows.length < 2) return <p className="muted small">The charts fill in as the turns go by.</p>;
  const t0 = rows[0].t,
    t1 = rows[rows.length - 1].t;
  let max = 1;
  for (const r of rows)
    for (const c of known) {
      const v = metricOf(r.v[c.id], metric);
      if (v !== null && v > max) max = v;
    }
  const X = (t: number) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const Y = (v: number) => T + (1 - v / max) * (H - T - B);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(k => max * k);
  const tTicks = [0, 0.25, 0.5, 0.75, 1].map(k => Math.round(t0 + (t1 - t0) * k));
  return (
    <div className="stats-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${METRICS.find(m => m.id === metric)?.name} over time`}
      >
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="grid" />
            <text x={L - 6} y={Y(v) + 4} textAnchor="end" className="tick">
              {fmt(metric, v)}
            </text>
          </g>
        ))}
        {tTicks.map((t, i) => (
          <text key={i} x={X(t)} y={H - 8} textAnchor="middle" className="tick">
            {t}
          </text>
        ))}
        {known.map(c => {
          let d = '';
          for (const r of rows) {
            const v = metricOf(r.v[c.id], metric);
            if (v === null) continue;
            d += `${d ? 'L' : 'M'}${X(r.t).toFixed(1)} ${Y(v).toFixed(1)}`;
          }
          return d ? (
            <path
              key={c.id}
              d={d}
              fill="none"
              stroke={c.color}
              strokeWidth={c.id === civId ? 3 : 1.6}
              strokeLinejoin="round"
              opacity={c.id === civId ? 1 : 0.85}
            />
          ) : null;
        })}
      </svg>
      <div className="stats-legend">
        {known.map(c => (
          <span key={c.id} className={c.id === civId ? 'me' : ''}>
            <span className="swatch" style={{ background: c.color }} /> {c.name}
            {c.alive ? '' : ' (gone)'}
          </span>
        ))}
      </div>
    </div>
  );
}
