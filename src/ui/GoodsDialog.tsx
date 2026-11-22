import { useState } from 'react';
import { COMFORT_PEOPLE, GOODS, STORE_PER_CELL } from '../data/goods.ts';
import { bestPrice, DEAL_TURNS, evaluateOffer, ledgerOf } from '../engine/diplomacy.ts';
import { atWar } from '../engine/game.ts';
import type { GameState, Offer } from '../engine/types.ts';
import { GoodIcon } from './bits.tsx';

interface Props {
  game: GameState;
  civId: number;
  onDeal: (to: number, o: Offer) => void;
  onClose: () => void;
}

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

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
            Goods <small>per turn, all your settlements</small>
          </h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p className="muted small">
          Special goods (minerals, plantation crops, furs, whales, pearls) need a town next to the
          deposit and at least 3 of the working building in one district; then every one of them
          brings a unit. Settlements use luxuries as comforts (one a turn per{' '}
          {COMFORT_PEOPLE.toLocaleString()} people), cities burn coal or wood, workshops and
          smithies work goods up. A good that runs out lowers what depends on it. Stores hold{' '}
          {STORE_PER_CELL} of a good for every cell that makes it, and {STORE_PER_CELL} of anything
          per settlement: the rest is lost, so sell it.
        </p>
        <table className="ledger">
          <thead>
            <tr>
              <th>Good</th>
              <th>Made</th>
              <th>Used</th>
              <th>Trade</th>
              <th>Net</th>
              <th>Store / limit</th>
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
                  <td>{l.used || ''}</td>
                  <td>{l.traded ? fmt(l.traded) : ''}</td>
                  <td className={l.net < 0 ? 'bad' : l.net > 0 ? 'good' : ''}>
                    <b>{fmt(l.net)}</b>
                  </td>
                  <td>
                    {l.stock}
                    <small className={l.stock >= l.cap ? 'bad' : 'muted'}>/{l.cap}</small>
                    {runsOut !== null && (
                      <small className={runsOut < 10 ? 'bad' : 'muted'}>
                        {' '}
                        · {runsOut ? `${runsOut} turns left` : 'out'}
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
        {rows.length === 0 && (
          <p className="muted">
            No goods yet. Woodcutters, mines, pastures and farms bring them in.
          </p>
        )}
        {selling && (
          <div className="sell-box">
            <h3>Sell {GOODS[selling]?.name ?? selling} by the turn</h3>
            <div className="row">
              <label>
                To{' '}
                <select value={to} onChange={e => setTo(Number(e.target.value))}>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>
                      the {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  type="number"
                  min={1}
                  value={n}
                  onChange={e => setN(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                />{' '}
                a turn
              </label>
              <label>
                for{' '}
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={e => setPrice(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                />{' '}
                gold a turn
              </label>
            </div>
            <p className="small">
              What they would pay for {n} a turn:{' '}
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
                    the {p.name}: {gold ? `${gold} gold` : 'not interested'}
                  </button>
                ))}
            </p>
            <p className="small muted">
              Runs for {DEAL_TURNS} turns, delivered from your capital's market. If you cannot
              deliver, they will remember. You keep{' '}
              <b>{fmt(Math.round(((ledger[selling]?.net ?? 0) - n) * 10) / 10)}</b>{' '}
              {GOODS[selling]?.name.toLowerCase()} a turn for yourself.
            </p>
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
        <p className="muted small">Your gold: {Math.floor(me.gold)}</p>
      </div>
    </div>
  );
}
