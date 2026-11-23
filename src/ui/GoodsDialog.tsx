import { setSupply, SUPPLY } from '../engine/game.ts';
import { useState } from 'react';
import { COMFORT_PEOPLE, GOODS, SPECIAL_MIN, STORE_PER_CELL } from '../data/goods.ts';
import { bestPrice, DEAL_TURNS, evaluateOffer, ledgerOf } from '../engine/diplomacy.ts';
import { atWar } from '../engine/game.ts';
import type { GameState, Offer } from '../engine/types.ts';
import { Chip, Delta, GoodIcon, Ico, InfoButton } from './bits.tsx';
import './declutter-city.css';

interface Props {
  game: GameState;
  civId: number;
  onDeal: (to: number, o: Offer) => void;
  onClose: () => void;
}

/**
 * The people's goods by the turn: what its settlements make, what buildings, hearths and
 * comforts use, what trade deals bring or take, and the store. A surplus can be sold by the
 * turn to a people at peace.
 */
export function GoodsDialog({ game, civId, onDeal, onClose }: Props) {
  const ledger = ledgerOf(game, civId);
  const me = game.civs[civId];
  const partners = game.civs.filter(
    c => c.alive && c.id !== civId && me.met.includes(c.id) && !atWar(game, civId, c.id),
  );
  const [selling, setSelling] = useState<string | null>(null);
  const [, setV] = useState(0);
  const [to, setTo] = useState<number>(partners[0]?.id ?? -1);
  const [n, setN] = useState(1);
  const [price, setPrice] = useState(1);
  const rows = Object.entries(ledger)
    .filter(([, l]) => l.made || l.used || l.traded || l.stock)
    .sort(
      (a, b) =>
        (GOODS[a[0]]?.kind ?? '').localeCompare(GOODS[b[0]]?.kind ?? '') || b[1].stock - a[1].stock,
    );
  const offer: Offer = {
    give: { goodsPerTurn: selling ? { [selling]: n } : {} },
    get: { goldPerTurn: price },
    turns: DEAL_TURNS,
  };
  const ev = selling && to >= 0 ? evaluateOffer(game, civId, to, offer) : null;

  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal goods-ledger"
        role="dialog"
        aria-modal="true"
        aria-label="Goods"
        onClick={e => e.stopPropagation()}
      >
        <header>
          <h2>
            Goods <small>a turn</small>
          </h2>
          <InfoButton label="How goods work" align="right">
            <span>
              Special goods (minerals, crops, furs, whales, pearls): a town by the deposit and{' '}
              {SPECIAL_MIN}+ of the working building in one district, then 1 each.
            </span>
            <span>
              Comforts: 1 luxury a turn per {COMFORT_PEOPLE.toLocaleString()} people. Cities burn
              coal or wood. Workshops and smithies work goods up.
            </span>
            <span>A good that runs out lowers what depends on it.</span>
            <span>
              Store: {STORE_PER_CELL} per cell that makes it + {STORE_PER_CELL} per settlement; the
              rest is lost.
            </span>
          </InfoButton>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="setting supply-row">
          <span title="When goods run short, first to">
            <Ico name="warning" fallback="!" size={18} /> Shortage:
          </span>
          <div className="setting-opts">
            {(Object.keys(SUPPLY) as (keyof typeof SUPPLY)[]).map(k => (
              <button
                key={k}
                className={(me.supply ?? 'industry') === k ? 'on' : ''}
                title={SUPPLY[k].note}
                onClick={() => {
                  setSupply(game, civId, k);
                  setV(v => v + 1);
                }}
              >
                {SUPPLY[k].name}
              </button>
            ))}
          </div>
          <InfoButton label="Who gets scarce goods first" align="right">
            {(Object.keys(SUPPLY) as (keyof typeof SUPPLY)[]).map(k => (
              <span key={k}>
                <b>{SUPPLY[k].name}</b>: {SUPPLY[k].note}
              </span>
            ))}
          </InfoButton>
        </div>
        <table className="ledger">
          <thead>
            <tr>
              <th>Good</th>
              <th title="Made a turn" aria-label="Made a turn">
                <Ico name="production" fallback="+" size={18} />
              </th>
              <th title="Used a turn" aria-label="Used a turn">
                <Ico name="upkeep" fallback="−" size={18} />
              </th>
              <th title="Trade a turn" aria-label="Trade a turn">
                <Ico name="trade" fallback="⇄" size={18} />
              </th>
              <th title="Net a turn">Net</th>
              <th title="Store / limit" aria-label="Store / limit">
                <Ico name="goods" fallback="▣" size={18} />
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(([g, l]) => {
              const runsOut = l.net < 0 ? Math.floor(l.stock / -l.net) : null;
              return (
                <tr key={g} className={l.net < 0 ? 'short' : ''}>
                  <td>
                    <GoodIcon id={g} /> {GOODS[g]?.name ?? g}
                  </td>
                  <td>{l.made || ''}</td>
                  <td>{l.used ? `\u2212${l.used}` : ''}</td>
                  <td>{l.traded ? <Delta n={l.traded} /> : ''}</td>
                  <td>
                    <b>
                      <Delta n={l.net} />
                    </b>
                  </td>
                  <td>
                    {l.stock}
                    <small className={l.stock >= l.cap ? 'bad' : 'muted'}>/{l.cap}</small>
                    {runsOut !== null && (
                      <small
                        className={runsOut < 10 ? 'bad' : 'muted'}
                        title={runsOut ? `Runs out in ${runsOut} turns` : 'Out'}
                      >
                        {' '}
                        · {runsOut ? `${runsOut}t` : 'out'}
                      </small>
                    )}
                  </td>
                  <td>
                    {l.net >= 1 && l.stock >= 1 && partners.length > 0 && (
                      <button
                        className="small"
                        onClick={() => {
                          // no set prices: start from the best that anyone would pay
                          const k = Math.max(1, Math.floor(l.net));
                          const bids = partners
                            .map(p => ({ id: p.id, gold: bestPrice(game, civId, p.id, g, k) }))
                            .sort((a, b) => b.gold - a.gold);
                          setSelling(g);
                          setN(k);
                          if (bids[0]) {
                            setTo(bids[0].id);
                            setPrice(bids[0].gold);
                          }
                        }}
                      >
                        Sell…
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="muted">No goods yet.</p>}
        {selling && (
          <div className="sell-box">
            <h3 className="dc-h">
              Sell <GoodIcon id={selling} /> {GOODS[selling]?.name ?? selling}
              <InfoButton label="About selling">
                {DEAL_TURNS} turns, delivered from the capital's market. Failing to deliver is
                remembered.
              </InfoButton>
            </h3>
            <div className="row">
              <label>
                <select value={to} aria-label="Buyer" onChange={e => setTo(Number(e.target.value))}>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label title="Amount a turn">
                <GoodIcon id={selling} />{' '}
                <input
                  type="number"
                  min={1}
                  value={n}
                  aria-label="Amount a turn"
                  onChange={e => setN(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                />
              </label>
              <label title="Gold a turn">
                <Ico name="gold" fallback="¤" size={18} />{' '}
                <input
                  type="number"
                  min={0}
                  value={price}
                  aria-label="Gold a turn"
                  onChange={e => setPrice(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                />
              </label>
            </div>
            <p className="small dc-bids" title={`What they would pay for ${n} a turn`}>
              {partners
                .map(p => ({ p, gold: bestPrice(game, civId, p.id, selling, n) }))
                .sort((a, b) => b.gold - a.gold)
                .map(({ p, gold }) => (
                  <button
                    key={p.id}
                    className={`link ${to === p.id ? 'on' : ''}`}
                    onClick={() => {
                      setTo(p.id);
                      setPrice(gold);
                    }}
                  >
                    {p.name} {gold ? <Chip icon="gold" n={gold} title="Gold a turn" /> : '—'}
                  </button>
                ))}
            </p>
            <div className="chips small">
              <Chip icon="hourglass" n={DEAL_TURNS} title="Turns" />
              <span className="chip" title="Left for you a turn">
                <GoodIcon id={selling} />
                <Delta n={Math.round(((ledger[selling]?.net ?? 0) - n) * 10) / 10} />
              </span>
            </div>
            {ev && <p className={ev.accept ? 'good' : 'bad'}>{ev.reason}</p>}
            <div className="row">
              <button
                className="primary"
                disabled={!ev?.accept}
                onClick={() => {
                  onDeal(to, offer);
                  setSelling(null);
                }}
              >
                Offer
              </button>
              <button onClick={() => setSelling(null)}>Cancel</button>
            </div>
          </div>
        )}
        <p className="muted small">
          <Chip icon="gold" n={Math.floor(me.gold)} title="Your gold" />
        </p>
      </div>
    </div>
  );
}
