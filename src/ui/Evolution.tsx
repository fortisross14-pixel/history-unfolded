import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { displayYear } from '../engine/index.ts';
import type { WorldState } from '../types.ts';
import { type Sel, fmt } from './shared.tsx';

export function Evolution({ world, open }: { world: WorldState; open: (s: Sel) => void }) {
  const [metric, setMetric] = useState<
    'greatPower' | 'development' | 'wealth' | 'breakthroughs' | 'military'
  >('greatPower');
  const [scaleMode, setScaleMode] = useState<'balanced' | 'linear'>('balanced');
  const [custom, setCustom] = useState<(number | null)[]>([null, null, null, null]);
  const [hovered, setHovered] = useState<number | null>(null);
  const snapshots = (world.evolutionSnapshots ?? []).filter(s => s.realms.length),
    latest = snapshots.at(-1);
  const powerLeaders = [...(latest?.realms ?? [])]
    .sort((a, b) => b.greatPower - a.greatPower)
    .slice(0, 4);
  const defaults = [...(latest?.realms ?? [])]
    .sort((a, b) => a.greatPower - b.greatPower)
    .slice(0, 4)
    .map(r => r.realmId);
  const customIds = custom
    .map((id, i) => id ?? defaults[i])
    .filter((id): id is number => !!id && !powerLeaders.some(r => r.realmId === id));
  const ids = [...new Set([...powerLeaders.map(r => r.realmId), ...customIds])].slice(0, 8);
  const selected = ids
    .map(
      id =>
        latest?.realms.find(r => r.realmId === id) ??
        snapshots.flatMap(s => s.realms).find(r => r.realmId === id),
    )
    .filter((r): r is NonNullable<typeof r> => !!r);
  const values = snapshots
    .flatMap(s => s.realms.filter(r => ids.includes(r.realmId)).map(r => r[metric]))
    .filter(v => Number.isFinite(v));
  const minYear = snapshots[0]?.year ?? world.year,
    maxYear = snapshots.at(-1)?.year ?? world.year,
    width = 1080,
    height = 460,
    pad = { l: 86, r: 120, t: 38, b: 58 };
  const minValue = values.length ? Math.min(...values) : 0,
    maxValue = values.length ? Math.max(...values) : 1;
  const transform = (v: number) =>
    scaleMode === 'linear' || ['breakthroughs', 'military'].includes(metric)
      ? v
      : metric === 'greatPower'
        ? Math.sign(v) * Math.abs(v) ** 0.72
        : Math.sign(v) * Math.abs(v) ** 0.55;
  const lo = transform(minValue),
    hi = transform(maxValue),
    scaleX = (year: number) =>
      pad.l + ((year - minYear) / Math.max(1, maxYear - minYear)) * (width - pad.l - pad.r),
    scaleY = (v: number) =>
      height - pad.b - ((transform(v) - lo) / Math.max(0.0001, hi - lo)) * (height - pad.t - pad.b);
  const metricName = {
      greatPower: 'Power (share of world)',
      development: 'Development',
      wealth: 'Wealth',
      breakthroughs: 'Breakthroughs',
      military: 'Military power',
    }[metric],
    formatValue = (v: number) => (metric === 'wealth' ? fmt(v, 1) : fmt(v));
  const ticks = Array.from({ length: 6 }, (_, i) => {
    const ratio = i / 5,
      transformed = hi - (hi - lo) * ratio;
    let raw = transformed;
    if (scaleMode === 'balanced' && !['breakthroughs', 'military'].includes(metric)) {
      const power = metric === 'greatPower' ? 1 / 0.72 : 1 / 0.55;
      raw = Math.sign(transformed) * Math.abs(transformed) ** power;
    }
    return { y: pad.t + (height - pad.t - pad.b) * ratio, value: raw };
  });
  const pathFor = (id: number) =>
    snapshots
      .map(s => {
        const r = s.realms.find(x => x.realmId === id);
        return r && Number.isFinite(r[metric]) ? { year: s.year, value: r[metric] } : null;
      })
      .filter((x): x is { year: number; value: number } => !!x);
  return (
    <section className="evolution-page">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">Century snapshots</span>
          <h1>Evolution</h1>
          <p className="page-intro">
            The four strongest realms are always shown. Use the four comparison slots to follow
            rivals, fallen powers or small states.
          </p>
        </div>
        <div className="evolution-controls">
          <label>
            Measure
            <select value={metric} onChange={e => setMetric(e.target.value as typeof metric)}>
              <option value="greatPower">Power (share of world)</option>
              <option value="development">Development</option>
              <option value="wealth">Wealth</option>
              <option value="breakthroughs">Breakthroughs</option>
              <option value="military">Military power</option>
            </select>
          </label>
          <label>
            Scale
            <select
              value={scaleMode}
              onChange={e => setScaleMode(e.target.value as typeof scaleMode)}
            >
              <option value="balanced">Balanced</option>
              <option value="linear">Linear</option>
            </select>
          </label>
        </div>
      </div>
      <section className="comparison-slots">
        <div>
          <span className="slot-label fixed">Automatic</span>
          {powerLeaders.map((r, i) => (
            <span className="realm-slot" key={r.realmId}>
              <i style={{ background: r.color }} />
              {i + 1}. {r.name}
            </span>
          ))}
        </div>
        <div>
          <span className="slot-label">Your comparisons</span>
          {custom.map((value, i) => (
            <select
              key={i}
              value={value ?? defaults[i] ?? ''}
              onChange={e =>
                setCustom(v =>
                  v.map((x, j) => (j === i ? (e.target.value ? +e.target.value : null) : x)),
                )
              }
            >
              <option value="">Choose realm</option>
              {world.civilizations.map(c => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ))}
        </div>
      </section>
      {snapshots.length < 2 ? (
        <section className="evolution-empty">
          <TrendingUp />
          <h2>History needs another century</h2>
          <p>Advance until at least two century snapshots exist.</p>
        </section>
      ) : (
        <>
          <section className="evolution-chart-panel">
            <div className="chart-heading">
              <div>
                <span className="eyebrow">Comparative trend</span>
                <h2>{metricName}</h2>
              </div>
              <span className="scale-badge">
                {scaleMode === 'balanced' ? 'Balanced power scale' : 'Linear scale'}
              </span>
            </div>
            <div className="chart-scroll">
              <svg
                className="evolution-chart"
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label={`${metricName} evolution`}
              >
                {ticks.map((t, i) => (
                  <g key={i}>
                    <line x1={pad.l} x2={width - pad.r} y1={t.y} y2={t.y} className="chart-grid" />
                    <text x={pad.l - 12} y={t.y + 4} textAnchor="end" className="chart-axis-label">
                      {formatValue(t.value)}
                    </text>
                  </g>
                ))}
                {snapshots
                  .filter(
                    (_, i) =>
                      i % Math.max(1, Math.floor(snapshots.length / 8)) === 0 ||
                      i === snapshots.length - 1,
                  )
                  .map(s => (
                    <g key={s.year}>
                      <line
                        x1={scaleX(s.year)}
                        x2={scaleX(s.year)}
                        y1={pad.t}
                        y2={height - pad.b}
                        className="chart-grid vertical"
                      />
                      <text
                        x={scaleX(s.year)}
                        y={height - 22}
                        textAnchor="middle"
                        className="chart-axis-label"
                      >
                        {displayYear(s.year)}
                      </text>
                    </g>
                  ))}
                {selected.map(realm => {
                  const points = pathFor(realm.realmId),
                    last = points.at(-1);
                  return (
                    <g
                      key={realm.realmId}
                      className={
                        hovered && hovered !== realm.realmId ? 'chart-series muted' : 'chart-series'
                      }
                      onMouseEnter={() => setHovered(realm.realmId)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => open({ type: 'realm', id: realm.realmId })}
                    >
                      <polyline
                        points={points
                          .map(pt => `${scaleX(pt.year)},${scaleY(pt.value)}`)
                          .join(' ')}
                        fill="none"
                        stroke={realm.color}
                        strokeWidth={hovered === realm.realmId ? '6' : '4'}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      >
                        <title>{`${realm.name}: ${formatValue(last?.value ?? 0)}`}</title>
                      </polyline>
                      {last && (
                        <>
                          <circle
                            cx={scaleX(last.year)}
                            cy={scaleY(last.value)}
                            r={hovered === realm.realmId ? 7 : 4}
                            fill={realm.color}
                          />
                          <text
                            x={scaleX(last.year) + 10}
                            y={scaleY(last.value) + 4}
                            fill={realm.color}
                            className="chart-end-label"
                          >
                            {realm.name}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="evolution-legend">
              {selected.map((r, i) => (
                <button
                  className={hovered === r.realmId ? 'highlighted' : ''}
                  key={r.realmId}
                  onMouseEnter={() => setHovered(r.realmId)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => open({ type: 'realm', id: r.realmId })}
                >
                  <i style={{ background: r.color }} />
                  <b>{i + 1}</b>
                  <span>{r.name}</span>
                  <strong>{formatValue(r[metric])}</strong>
                </button>
              ))}
            </div>
          </section>
          <section className="century-rankings">
            <div className="chart-heading">
              <div>
                <span className="eyebrow">Changing order</span>
                <h2>Century leaders</h2>
              </div>
            </div>
            <div className="century-grid">
              {snapshots
                .slice(-12)
                .reverse()
                .map(snap => {
                  const top = [...snap.realms].sort((a, b) => b[metric] - a[metric]).slice(0, 3);
                  return (
                    <article key={snap.year}>
                      <time>{displayYear(snap.year)}</time>
                      {top.map((r, i) => (
                        <button
                          key={r.realmId}
                          onClick={() => open({ type: 'realm', id: r.realmId })}
                        >
                          <b>{i + 1}</b>
                          <i style={{ background: r.color }} />
                          <span>{r.name}</span>
                          <strong>{formatValue(r[metric])}</strong>
                        </button>
                      ))}
                    </article>
                  );
                })}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
