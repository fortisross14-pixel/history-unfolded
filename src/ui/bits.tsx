import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GOODS } from '../data/goods.ts';
import { artUrl } from '../render/art.ts';
import { hasIcon, Icon } from './icons.tsx';

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
      fallback={
        hasIcon(name) ? (
          <Icon name={name} size={size} className="ico" />
        ) : (
          <span className="ico-glyph">{fallback}</span>
        )
      }
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

/** A signed number, green when it helps and red when it hurts: +3, −7. `good` flips which way helps. */
export function Delta({
  n,
  good = 'up',
  unit,
}: {
  n: number;
  good?: 'up' | 'down';
  unit?: ReactNode;
}) {
  const v = Math.round(n * 10) / 10;
  const helps = good === 'up' ? v > 0 : v < 0;
  return (
    <span className={`delta ${v === 0 ? '' : helps ? 'good' : 'bad'}`}>
      {v > 0 ? '+' : v < 0 ? '\u2212' : ''}
      {Math.abs(v)}
      {unit ? <> {unit}</> : null}
    </span>
  );
}

/** An icon and a number, with the name on hover: the compact way to show a yield or a stock. */
export function Chip({
  icon,
  good,
  n,
  title,
  signed,
}: {
  /** an interface icon name, or use `good` for a good's own icon */
  icon?: string;
  good?: string;
  n: ReactNode;
  title: string;
  /** show the number as +n / −n, coloured */
  signed?: boolean;
}) {
  return (
    <span className="chip" title={title} aria-label={title}>
      {good ? (
        <GoodIcon id={good} size={18} />
      ) : icon ? (
        <Ico name={icon} fallback="•" size={18} />
      ) : null}
      {signed && typeof n === 'number' ? <Delta n={n} /> : <b>{n}</b>}
    </span>
  );
}

/**
 * A round (i) button: the details that matter but are not needed to play stay behind it. Click
 * or tap opens a small card; a click anywhere else, or Esc, closes it.
 */
export function InfoButton({
  children,
  label = 'More about this',
  align = 'left',
}: {
  children: ReactNode;
  label?: string;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc, true);
    };
  }, [open]);
  return (
    <span className="info-wrap" ref={box}>
      <button
        type="button"
        className={`info-i ${open ? 'on' : ''}`}
        aria-label={label}
        aria-expanded={open}
        title={label}
        onClick={e => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
      >
        i
      </button>
      {open && (
        <span className={`info-card ${align}`} role="note">
          {children}
        </span>
      )}
    </span>
  );
}
