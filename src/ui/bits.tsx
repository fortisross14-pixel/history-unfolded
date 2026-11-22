import type { ReactNode } from 'react';
import { GOODS } from '../data/goods.ts';
import { artUrl } from '../render/art.ts';

const BASE = `${import.meta.env.BASE_URL}sprites/`;

/** A generated picture by key (e.g. 'tech/archery'), or the fallback when it has not been made yet. */
export function Art({
  k,
  size,
  fallback = null,
  className = '',
}: {
  k: string;
  size?: number;
  fallback?: ReactNode;
  className?: string;
}) {
  const url = artUrl(k);
  if (!url) return <>{fallback}</>;
  return (
    <img
      className={`art ${className}`}
      src={url}
      alt=""
      style={size ? { height: size } : undefined}
    />
  );
}

/** Interface icon: generated if available, else the given emoji/glyph. */
export function Ico({
  name,
  fallback,
  size = 16,
}: {
  name: string;
  fallback: string;
  size?: number;
}) {
  return (
    <Art
      k={`icon/${name}`}
      size={size}
      className="ico"
      fallback={<span className="ico-glyph">{fallback}</span>}
    />
  );
}

export function GoodIcon({ id, size = 18 }: { id: string; size?: number }) {
  const g = GOODS[id];
  if (!g) return <span>{id}</span>;
  const art = artUrl(`good/${id}`);
  if (art)
    return (
      <img className="good-icon" src={art} alt={g.name} title={g.name} style={{ height: size }} />
    );
  if (g.icon)
    return (
      <img
        className="good-icon"
        src={`${BASE}goods/${g.icon}.png`}
        alt={g.name}
        title={g.name}
        style={{ height: size }}
      />
    );
  if (g.emoji)
    return (
      <span
        className="good-emoji"
        title={g.name}
        role="img"
        aria-label={g.name}
        style={{ fontSize: size * 0.85 }}
      >
        {g.emoji}
      </span>
    );
  return (
    <span
      className="good-glyph"
      title={g.name}
      style={{ background: g.color, height: size, minWidth: size, fontSize: size * 0.5 }}
    >
      {g.glyph}
    </span>
  );
}

export function Goods({
  goods,
  empty = '—',
  missing,
}: {
  goods: Record<string, number>;
  empty?: string;
  missing?: Set<string>;
}) {
  const entries = Object.entries(goods).filter(([, n]) => n > 0);
  if (!entries.length) return <span className="muted">{empty}</span>;
  return (
    <span className="goods">
      {entries.map(([k, n]) => (
        <span
          key={k}
          className={`good ${missing?.has(k) ? 'bad' : ''}`}
          title={GOODS[k]?.name ?? k}
        >
          <GoodIcon id={k} /> {Math.round(n * 10) / 10}
        </span>
      ))}
    </span>
  );
}

export function UnitPortrait({
  sprite,
  color,
  small,
  art,
}: {
  sprite: string;
  color: string;
  small?: boolean;
  /** generated miniature key, e.g. 'unit/hoplite' */
  art?: string;
}) {
  const url = art ? artUrl(art) : undefined;
  return (
    <span className={`portrait ${small ? 'small' : ''}`} style={{ borderColor: color }}>
      <img
        src={
          url ??
          (sprite.startsWith('ship:')
            ? `${BASE}ships/${sprite.slice(5)}.png`
            : `${BASE}units/${sprite}.png`)
        }
        alt=""
      />
    </span>
  );
}
