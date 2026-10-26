import { X } from 'lucide-react';
import type { Season, WorldState } from '../types.ts';
import { decodeOwners, seasonSpan, seasonTitle } from '../engine/seasons.ts';
import { displayYear } from '../engine/index.ts';
import type { Sel } from './shared.tsx';

const SIZE = 18;
const DX = 27;
const DY = 31.2;
const hex = (cx: number, cy: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * i * 60;
    return `${(cx + SIZE * Math.cos(a)).toFixed(1)},${(cy + SIZE * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

/** A small, static political map drawn from a stored owner list. */
export function MiniMap({
  world,
  owners,
  palette,
}: {
  world: WorldState;
  owners: (number | null)[];
  palette: Season['palette'];
}) {
  const colors = new Map(palette.map(p => [p.id, p.color]));
  return (
    <svg
      className="mini-map"
      viewBox={`0 0 ${world.width * DX + 60} ${world.height * DY + 60}`}
      role="img"
    >
      {world.provinces.map((p, i) => {
        const cx = 30 + p.x * DX;
        const cy = 30 + p.y * DY + (p.x % 2 ? DY / 2 : 0);
        const owner = owners[i];
        const fill =
          p.terrain === 'ocean'
            ? '#0b2532'
            : owner !== null && owner !== undefined
              ? (colors.get(owner) ?? '#555')
              : '#3c4447';
        return <polygon key={p.id} points={hex(cx, cy)} fill={fill} />;
      })}
    </svg>
  );
}

/** The end-of-century screen: map before and after, awards and headlines. */
export function SeasonRecap({
  world,
  season,
  open,
  close,
}: {
  world: WorldState;
  season: Season;
  open: (s: Sel) => void;
  close: () => void;
}) {
  const before = decodeOwners(season.mapBefore);
  const after = decodeOwners(season.mapAfter);
  const index = world.seasons.findIndex(x => x.year === season.year);
  const largest = (owners: (number | null)[]) => {
    const counts = new Map<number, number>();
    for (const o of owners) if (o !== null) counts.set(o, (counts.get(o) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? season.palette.find(p => p.id === top[0])?.name : undefined;
  };
  return (
    <div className="recap-overlay" role="dialog" aria-label={`${seasonTitle(season.year)} recap`}>
      <div className="recap">
        <button className="close" onClick={close} aria-label="Close">
          <X />
        </button>
        <span className="eyebrow">
          Season {index + 1} · {seasonSpan(season.year)}
        </span>
        <h1>The {seasonTitle(season.year)}</h1>
        <div className="recap-maps">
          <figure>
            <MiniMap world={world} owners={before} palette={season.palette} />
            <figcaption>
              Before · {season.realmsBefore} realms · largest: {largest(before) ?? '—'}
            </figcaption>
          </figure>
          <figure>
            <MiniMap world={world} owners={after} palette={season.palette} />
            <figcaption>
              After · {season.realmsAfter} realms · largest: {largest(after) ?? '—'}
            </figcaption>
          </figure>
        </div>
        <section className="awards">
          {season.awards.map(a => (
            <button
              key={a.title}
              className="award"
              onClick={() => {
                close();
                open({
                  type: a.kind === 'realm' ? 'realm' : a.kind === 'war' ? 'war' : 'character',
                  id: a.id,
                });
              }}
            >
              <small>{a.title}</small>
              <strong>{a.name}</strong>
              <span>{a.reason}</span>
            </button>
          ))}
          {!season.awards.length && <p className="empty">A quiet century.</p>}
        </section>
        <section className="recap-headlines">
          <h3>Headlines</h3>
          {season.headlines.map((h, i) => (
            <article key={i}>
              <time>{displayYear(h.year)}</time>
              <strong>{h.title}</strong>
              <p>{h.text}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

/** List of every finished century, newest first. */
export function SeasonList({ world, show }: { world: WorldState; show: (year: number) => void }) {
  const seasons = [...world.seasons].reverse();
  if (!seasons.length) return <p className="empty">The first century has not ended yet.</p>;
  return (
    <div className="season-list">
      {seasons.map(x => (
        <button key={x.year} className="season-card" onClick={() => show(x.year)}>
          <small>{seasonSpan(x.year)}</small>
          <strong>The {seasonTitle(x.year)}</strong>
          <span>
            {x.awards.find(a => a.title === 'Ruler of the Century')?.name ??
              x.headlines[0]?.title ??
              'A quiet century'}
          </span>
        </button>
      ))}
    </div>
  );
}
