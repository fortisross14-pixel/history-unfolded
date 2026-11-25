/**
 * Deposits on a settlement's land: the icon, the badges a district shows for what it works
 * (worked, workable now, not yet), and the info card a deposit opens.
 */
import { useEffect, type ReactNode } from 'react';
import { DEPOSITS, GOODS } from '../data/goods.ts';
import { GROUPS, SLOT_TYPES } from '../data/slots.ts';
import { depositCard, type DepositState, type DepositStatus } from '../engine/economy.ts';
import type { City, District, GameState } from '../engine/types.ts';
import { artUrl } from '../render/art.ts';
import { Art, Chip, GoodIcon } from './bits.tsx';
import { Icon } from './icons.tsx';
import './r4-deposits.css';

const BASE = `${import.meta.env.BASE_URL}sprites/`;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** The deposit's picture for an SVG: an image URL, or a pictogram to draw as text. */
export function depositArt(kind: string): { url?: string; text: string; color: string } {
  const info = DEPOSITS[kind];
  const good = Object.keys(info.yields)[0];
  const g = GOODS[good];
  const url = artUrl(`good/${good}`) ?? (g?.icon ? `${BASE}goods/${g.icon}.png` : undefined);
  return {
    url: info.emoji ? undefined : url,
    text: info.emoji ?? g?.emoji ?? info.name.slice(0, 2),
    color: g?.color ?? '#888',
  };
}

/** The deposit as an icon: its pictogram, else its good's. */
export function DepositIcon({ kind, size = 18 }: { kind: string; size?: number }) {
  const info = DEPOSITS[kind];
  if (info.emoji)
    return (
      <span
        className="good-emoji"
        role="img"
        aria-label={info.name}
        style={{ fontSize: size * 0.85 }}
      >
        {info.emoji}
      </span>
    );
  return <GoodIcon id={Object.keys(info.yields)[0]} size={size} />;
}

export const STATE_NAME: Record<DepositState, string> = {
  worked: 'Worked',
  workable: 'Workable',
  'not-yet': 'Not yet',
};

/** What a deposit adds, as chips. */
function Gives({
  g,
  signed = true,
}: {
  g: { food: number; gold: number; goods: Record<string, number> };
  signed?: boolean;
}) {
  return (
    <>
      {g.food ? <Chip icon="food" n={signed ? `+${r1(g.food)}` : r1(g.food)} title="Food" /> : null}
      {g.gold ? <Chip icon="gold" n={signed ? `+${r1(g.gold)}` : r1(g.gold)} title="Gold" /> : null}
      {Object.entries(g.goods)
        .filter(([, n]) => n)
        .map(([k, n]) => (
          <Chip key={k} good={k} n={signed ? `+${r1(n)}` : r1(n)} title={GOODS[k]?.name ?? k} />
        ))}
    </>
  );
}

const BuildingPic = ({ id, size = 26 }: { id: string; size?: number }) => {
  const t = SLOT_TYPES[id];
  return (
    <Art
      k={`building/${id}`}
      size={size}
      fallback={
        <span className="cell-glyph" style={{ background: GROUPS[t.group].color }}>
          {t.glyph}
        </span>
      }
    />
  );
};

/**
 * A district's deposits as badges over its grid: each one's icon, name and state. Tapping one
 * opens its card; a workable one offers its building, one tap to pick it for a free plot.
 */
export function DistrictDeposits({
  list,
  onOpen,
  onPick,
}: {
  list: DepositStatus[];
  onOpen: (kind: string) => void;
  /** pick the building that works it for a free plot */
  onPick?: (typeId: string) => void;
}) {
  if (!list.length) return null;
  return (
    <div className="r4d-strip" aria-label="Deposits this district reaches">
      {list.map(st => {
        const info = DEPOSITS[st.kind];
        const bt = SLOT_TYPES[st.by];
        return (
          <span key={st.kind} className={`r4d-badge-wrap ${st.state}`}>
            <button
              className={`r4d-badge ${st.state}`}
              onClick={() => onOpen(st.kind)}
              title={`${info.name} (${st.onHex ? 'on this hex' : 'next door'}): ${STATE_NAME[st.state].toLowerCase()}, ${st.why}`}
            >
              <DepositIcon kind={st.kind} size={20} />
              <b>{info.name}</b>
              <small className="r4d-state">
                {st.state === 'worked' ? (
                  <>
                    <Icon name="check" size={13} /> {st.why}
                  </>
                ) : st.state === 'not-yet' ? (
                  <>
                    <Icon name="lock" size={13} /> {st.why}
                  </>
                ) : (
                  st.why
                )}
              </small>
              {st.state === 'worked' && <Gives g={st.out} />}
            </button>
            {st.state === 'workable' && onPick && st.count + st.planned < st.need && (
              <button
                className="r4d-pick"
                onClick={() => onPick(st.by)}
                title={`Put a ${bt.name.toLowerCase()} on a free plot`}
              >
                <BuildingPic id={st.by} size={20} />+ {bt.name}
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

/**
 * The info card of a deposit: the good, what each building working it gains, the building, the
 * techs it takes (known or not), whether it is worked now and where, and its Codex entry.
 */
export function DepositCardView({
  game,
  c,
  kind,
  where,
  onClose,
  onCodex,
  onPick,
  note,
  extra,
}: {
  game: GameState;
  c: City;
  kind: string;
  /** the districts reaching it and its state in each (null: a district not laid out yet) */
  where: { d: District | null; st: DepositStatus }[];
  onClose: () => void;
  onCodex: (entry: string) => void;
  onPick?: (d: District, typeId: string) => void;
  /** a line about the hex (e.g. why no district can stand on it) */
  note?: string;
  /** an action under the list (e.g. lay out a district on the hex) */
  extra?: ReactNode;
}) {
  const card = depositCard(game, c.civId, kind);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', esc, true);
    return () => document.removeEventListener('keydown', esc, true);
  }, [onClose]);
  return (
    <div className="r4d-back" onClick={onClose}>
      <div
        className="r4d-card"
        role="dialog"
        aria-label={`${card.name} deposit`}
        onClick={e => e.stopPropagation()}
      >
        <header>
          <DepositIcon kind={kind} size={30} />
          <b>{card.name}</b>
          {card.special && (
            <small className="r4d-tag" title={`Takes ${card.need} of its building in one district`}>
              Special
            </small>
          )}
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="r4d-row" title="What each building working it gains a turn">
          <span className="r4d-k">Gives</span>
          <span className="chips">
            <Gives g={card.gives} />
          </span>
          <small className="muted">each</small>
        </div>
        <div className="r4d-row">
          <span className="r4d-k">By</span>
          <BuildingPic id={card.by} />
          <b>{card.byName}</b>
          {card.need > 1 && <small className="muted">×{card.need} in the district</small>}
        </div>
        {card.techs.length > 0 && (
          <div className="r4d-row">
            <span className="r4d-k">Tech</span>
            <span className="r4d-techs">
              {card.techs.map(t => (
                <span
                  key={t.id}
                  className={`chip ${t.known ? 'r4d-known' : 'r4d-missing'}`}
                  title={`${t.name}: ${t.for === 'see' ? 'shows it' : t.for === 'build' ? `opens the ${card.byName.toLowerCase()}` : 'to work it'} (${t.known ? 'known' : 'not known yet'})`}
                >
                  <Icon name={t.known ? 'check' : 'lock'} size={14} />
                  {t.name}
                </span>
              ))}
            </span>
          </div>
        )}
        <ul className="r4d-where">
          {where.map(({ d, st }, i) => (
            <li key={d?.id ?? `n${i}`} className={st.state}>
              <span className={`r4d-dot ${st.state}`} aria-hidden="true" />
              <b>{d ? d.name : 'This hex'}</b>
              <span className="r4d-why">
                {STATE_NAME[st.state]}
                {st.state === 'worked' ? `: ${st.why}` : st.why ? ` · ${st.why}` : ''}
              </span>
              {st.state === 'worked' && (
                <span className="chips">
                  <Gives g={st.out} />
                </span>
              )}
              {d && onPick && st.state === 'workable' && st.count + st.planned < st.need && (
                <button className="r4d-pick" onClick={() => onPick(d, st.by)}>
                  <BuildingPic id={st.by} size={20} />+ {card.byName}
                </button>
              )}
            </li>
          ))}
          {!where.length && note && <li className="muted">{note}</li>}
        </ul>
        {where.length > 0 && note && <p className="muted small">{note}</p>}
        {extra}
        <button className="link small r4d-codex" onClick={() => onCodex(card.codex)}>
          <Icon name="book" size={14} /> {GOODS[card.good]?.name ?? card.good} in the Codex
        </button>
      </div>
    </div>
  );
}
