import type { Moment, War, WorldState } from '../types.ts';
import { displayYear } from '../engine/index.ts';
import { type Sel, fmt, Metrics, Section, List } from './shared.tsx';

const W = 640;
const H = 220;
const PAD = { l: 44, r: 14, t: 14, b: 26 };

const yearLabel = (t: number) => displayYear(Math.floor(t));

/**
 * Line chart of a moment's value over time. Wars show momentum from −100
 * (defender winning) to +100 (attacker winning), with key battles marked.
 */
export function MomentChart({ m, war, world }: { m: Moment; war?: War; world: WorldState }) {
  const pts = m.series;
  if (pts.length < 2) return <p className="empty">The story has only just begun.</p>;
  const t0 = pts[0][0];
  const t1 = Math.max(pts.at(-1)![0], t0 + 1);
  const isWar = m.kind === 'war';
  const max = isWar ? 100 : Math.max(...pts.map(p => p[1]), 1);
  const min = isWar ? -100 : 0;
  const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + ((max - v) / (max - min)) * (H - PAD.t - PAD.b);
  const line = pts.map(([t, v]) => `${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const attacker = war ? world.civilizations.find(c => c.id === war.attackerIds[0]) : undefined;
  const defender = war ? world.civilizations.find(c => c.id === war.defenderIds[0]) : undefined;
  const ticks = isWar ? [100, 70, 0, -70, -100] : [max, Math.round(max / 2), 0];
  return (
    <figure className="moment-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${m.title} over time`}>
        {ticks.map(v => (
          <g key={v}>
            <line
              className={v === 0 ? 'chart-zero' : 'chart-grid'}
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(v)}
              y2={y(v)}
            />
            <text className="chart-axis-label" x={PAD.l - 6} y={y(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {isWar && (
          <>
            <rect
              className="zone attacker"
              x={PAD.l}
              y={y(100)}
              width={W - PAD.l - PAD.r}
              height={y(70) - y(100)}
              style={{ fill: attacker?.color }}
            />
            <rect
              className="zone defender"
              x={PAD.l}
              y={y(-70)}
              width={W - PAD.l - PAD.r}
              height={y(-100) - y(-70)}
              style={{ fill: defender?.color }}
            />
          </>
        )}
        <polyline className="moment-line" points={line} />
        {war?.keyBattles.map(b => {
          const near = pts.reduce(
            (best, p) => (Math.abs(p[0] - b.t) < Math.abs(best[0] - b.t) ? p : best),
            pts[0],
          );
          return (
            <g key={`${b.name}-${b.t}`}>
              <circle className={`battle-dot ${b.winner}`} cx={x(b.t)} cy={y(near[1])} r={5}>
                <title>{b.text}</title>
              </circle>
            </g>
          );
        })}
        <text className="chart-axis-label" x={PAD.l} y={H - 6}>
          {yearLabel(t0)}
        </text>
        <text className="chart-axis-label" x={W - PAD.r} y={H - 6} textAnchor="end">
          {m.active ? 'now' : yearLabel(t1)}
        </text>
      </svg>
      {isWar && (
        <figcaption>
          <span style={{ color: attacker?.color }}>▲ {attacker?.name ?? 'Attacker'} winning</span>
          <span style={{ color: defender?.color }}>▼ {defender?.name ?? 'Defender'} winning</span>
        </figcaption>
      )}
    </figure>
  );
}

/** A momentum bar for headlines: where the war stands right now. */
export function MomentumBar({ m, world }: { m: Moment; world: WorldState }) {
  const war = world.wars.find(w => w.id === m.warId);
  const a = war ? world.civilizations.find(c => c.id === war.attackerIds[0]) : undefined;
  const d = war ? world.civilizations.find(c => c.id === war.defenderIds[0]) : undefined;
  const v = m.momentum ?? 0;
  return (
    <div className="momentum-bar" aria-label={`Momentum ${Math.round(v)}`}>
      <span style={{ color: a?.color }}>{a?.name}</span>
      <div className="momentum-track">
        <i style={{ left: `${50 + v / 2}%` }} />
      </div>
      <span style={{ color: d?.color }}>{d?.name}</span>
    </div>
  );
}

const names = (world: WorldState, ids: number[]) =>
  ids.map(id => world.civilizations.find(c => c.id === id)?.name ?? 'a lost realm').join(', ');

/** War page: momentum chart, box score and peace terms for Great Wars; a result card for quick wars. */
export function WarPage({
  war,
  world,
  open,
}: {
  war: War;
  world: WorldState;
  open: (s: Sel) => void;
}) {
  const m = war.momentId ? world.moments.find(x => x.id === war.momentId) : undefined;
  const result = war.active
    ? 'WAR IN PROGRESS'
    : war.winnerIds.length
      ? `${names(world, war.winnerIds.slice(0, 1))} WON`
      : 'STALEMATE';
  const best = (() => {
    const wins = new Map<number, number>();
    for (const b of war.keyBattles) {
      const id = b.characterIds[b.winner === 'attacker' ? 0 : 1];
      if (id) wins.set(id, (wins.get(id) ?? 0) + 1);
    }
    const top = [...wins.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? world.characters.find(c => c.id === top[0]) : undefined;
  })();
  return (
    <>
      <div className={`outcome-banner ${war.winnerIds.length ? 'decisive' : 'stalemate'}`}>
        <strong>{result}</strong>
        <span>
          {displayYear(war.startYear)}–
          {war.endYear !== undefined ? displayYear(war.endYear) : 'now'}
        </span>
      </div>
      {war.great && m && <MomentChart m={m} war={war} world={world} />}
      {war.great && m?.active && <MomentumBar m={m} world={world} />}
      <Section title="Box score">
        <table className="box-score">
          <thead>
            <tr>
              <th />
              <th>Attackers</th>
              <th>Defenders</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Sides</td>
              <td>{names(world, war.attackerIds)}</td>
              <td>{names(world, war.defenderIds)}</td>
            </tr>
            <tr>
              <td>Losses</td>
              <td>{fmt(war.attackerLosses)}</td>
              <td>{fmt(war.defenderLosses)}</td>
            </tr>
            <tr>
              <td>Key battles won</td>
              <td>{war.keyBattles.filter(b => b.winner === 'attacker').length}</td>
              <td>{war.keyBattles.filter(b => b.winner === 'defender').length}</td>
            </tr>
          </tbody>
        </table>
        <Metrics
          vals={[
            ['Kind', war.great ? 'Great War' : 'Quick war'],
            ['Type', war.type],
            ['Land changed', fmt(war.territoriesChanged)],
            ['Best general', best ? best.name : '—'],
          ]}
        />
      </Section>
      <Section title="Cause and goal">
        <p>{war.rationale}</p>
        <p>
          <b>Goal:</b> {war.goal}
        </p>
      </Section>
      {war.outcome && (
        <Section title={war.great ? 'Peace conference' : 'Result'}>
          <p>{war.outcome}</p>
          {war.terms.length > 0 && (
            <ul className="terms">
              {war.terms.map(t => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </Section>
      )}
      {war.keyBattles.length > 0 && (
        <Section title="Key battles">
          <List
            items={[...war.keyBattles].reverse().map(b => ({
              name: `${b.naval ? '⚓ ' : '⚔ '}${b.name}`,
              sub: `${yearLabel(b.t)} · ${b.text}`,
              onClick: b.characterIds.find(Boolean)
                ? () => open({ type: 'character', id: b.characterIds.find(Boolean)! })
                : undefined,
            }))}
          />
        </Section>
      )}
      {best && (
        <Section title="Hero of the war">
          <List
            items={[
              {
                name: best.name,
                sub: `${best.role} · ${best.rarity}`,
                onClick: () => open({ type: 'character', id: best.id }),
              },
            ]}
          />
        </Section>
      )}
    </>
  );
}

const KIND_LABEL = {
  war: 'Great War',
  discovery: 'Great Discovery',
  revolution: 'World Revolution',
} as const;

export function MomentPage({
  m,
  world,
  open,
}: {
  m: Moment;
  world: WorldState;
  open: (s: Sel) => void;
}) {
  const war = m.warId ? world.wars.find(w => w.id === m.warId) : undefined;
  if (war) return <WarPage war={war} world={world} open={open} />;
  const origin = world.civilizations.find(c => c.id === m.originRealmId);
  const founder = m.originCharacterId
    ? world.characters.find(c => c.id === m.originCharacterId)
    : undefined;
  const reached = m.series.at(-1)?.[1] ?? m.realmIds.length;
  return (
    <>
      <div className={`outcome-banner ${m.active ? 'stalemate' : 'decisive'}`}>
        <strong>{m.active ? `${KIND_LABEL[m.kind]} · unfolding` : KIND_LABEL[m.kind]}</strong>
        <span>
          {displayYear(m.startYear)}–{m.endYear !== undefined ? displayYear(m.endYear) : 'now'}
        </span>
      </div>
      <MomentChart m={m} world={world} />
      <Metrics
        vals={[
          ['Began in', origin?.name ?? '—'],
          ['Started by', founder?.name ?? '—'],
          ['Realms reached', fmt(reached)],
          ['Key events', fmt(m.events.length)],
        ]}
      />
      {m.summary && (
        <Section title="Outcome">
          <p>{m.summary}</p>
        </Section>
      )}
      <Section title="How it unfolded">
        <List
          items={[...m.events].reverse().map(e => ({
            name: e.title,
            sub: `${yearLabel(e.t)} · ${e.text}`,
            onClick: e.realmIds[0] ? () => open({ type: 'realm', id: e.realmIds[0] }) : undefined,
          }))}
        />
      </Section>
    </>
  );
}

/** Short headline cards for the moments running right now. */
export function MomentHeadlines({ world, open }: { world: WorldState; open: (s: Sel) => void }) {
  const active = world.moments.filter(m => m.active);
  if (!active.length) return null;
  return (
    <section className="moment-headlines">
      {active.map(m => (
        <button
          key={m.id}
          className={`moment-card ${m.kind}`}
          onClick={() => open({ type: 'moment', id: m.id })}
        >
          <small>
            {KIND_LABEL[m.kind]} · since {displayYear(m.startYear)}
          </small>
          <strong>{m.title}</strong>
          {m.kind === 'war' ? (
            <MomentumBar m={m} world={world} />
          ) : (
            <span>{m.realmIds.length} realms reached</span>
          )}
          {m.events.at(-1) && <em>{m.events.at(-1)!.text}</em>}
        </button>
      ))}
    </section>
  );
}
