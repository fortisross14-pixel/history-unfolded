import { GOODS } from '../data/goods.ts';

const BASE = `${import.meta.env.BASE_URL}sprites/`;

export function GoodIcon({ id, size = 18 }: { id: string; size?: number }) {
  const g = GOODS[id];
  if (!g) return <span>{id}</span>;
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
}: {
  sprite: string;
  color: string;
  small?: boolean;
}) {
  return (
    <span className={`portrait ${small ? 'small' : ''}`} style={{ borderColor: color }}>
      <img
        src={
          sprite.startsWith('ship:')
            ? `${BASE}ships/${sprite.slice(5)}.png`
            : `${BASE}units/${sprite}.png`
        }
        alt=""
      />
    </span>
  );
}
