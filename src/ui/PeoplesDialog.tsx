import { personalityOf } from '../data/leaders.ts';
import { intentToward } from '../engine/ai.ts';
import { rulerOf } from '../engine/dynasty.ts';
import { useState } from 'react';
import { OPPOSED, TAGS } from '../data/culture.ts';
import { GOODS } from '../data/goods.ts';
import type { GoodLine } from '../engine/economy.ts';
import {
  attitude,
  capitalOf,
  DEAL_TURNS,
  describeBundle,
  evaluateOffer,
  hasPact,
  ledgerOf,
  opinion,
  opinionParts,
  PACT_TURNS,
  treatiesOf,
} from '../engine/diplomacy.ts';
import { marketStock } from '../engine/economy.ts';
import { atWar, militaryPower, score } from '../engine/game.ts';
import {
  absorbCost,
  absorbProblem,
  describeTribute,
  standing,
  tributeTo,
} from '../engine/independents.ts';
import { identity, tagCounts } from '../engine/mods.ts';
import type { Bundle, GameState, Offer } from '../engine/types.ts';
import { TagChip } from './CultureDialog.tsx';
import { GoodIcon } from './bits.tsx';
import { PeaceTerms } from './PeaceTerms.tsx';

interface Props {
  game: GameState;
  civId: number;
  onWar: (other: number) => void;
  /** kept for callers; peace now goes through onDeal with its terms */
  onPeace?: (other: number) => void;
  onDeal: (other: number, o: Offer) => void;
  onGift: (other: number, gold: number) => void;
  onAbsorb: (other: number) => void;
  onClose: () => void;
}

export function PeoplesDialog({ game, civId, onWar, onDeal, onGift, onAbsorb, onClose }: Props) {
  const me = game.civs[civId];
  const mine = militaryPower(game, civId);
  // great peoples first, then the free peoples
  const known = game.civs
    .filter(c => c.id !== civId && me.met.includes(c.id))
    .sort((a, b) => Number(!!a.independent) - Number(!!b.independent));
  const [dealWith, setDealWith] = useState<number | null>(null);
  const mineTags = tagCounts(me);
  const relation = (other: number) => {
    const theirs = tagCounts(game.civs[other]);
    const strong = (t: Record<string, number>, k: string) => (t[k] ?? 0) >= 2;
    const clash = OPPOSED.filter(
      ([a, b]) =>
        (strong(mineTags, a) && strong(theirs, b)) || (strong(mineTags, b) && strong(theirs, a)),
    );
    const shared = Object.keys(mineTags).filter(t => strong(mineTags, t) && strong(theirs, t));
    if (clash.length)
      return `Clashing ideas (${clash.map(([a, b]) => `${TAGS[a].name}/${TAGS[b].name}`).join(', ')})`;
    if (shared.length) return `Kindred (${shared.map(t => TAGS[t].name).join(', ')})`;
    return '';
  };
  if (dealWith !== null)
    return (
      <DealDialog
        game={game}
        from={civId}
        to={dealWith}
        onBack={() => setDealWith(null)}
        onSend={o => {
          onDeal(dealWith, o);
          setDealWith(null);
        }}
      />
    );

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal peoples" onClick={e => e.stopPropagation()}>
        <header>
          <h2>
            Peoples{' '}
            <small>
              Your army strength {mine} · score {score(game, civId)}
            </small>
          </h2>
          <button className="x" onClick={onClose}>
            ×
          </button>
        </header>
        {!known.length && <p className="muted">You have met no one yet. Send scouts out.</p>}
        <div className="peoples-list">
          {known.map(c => {
            const war = atWar(game, civId, c.id);
            const p = militaryPower(game, c.id);
            const op = opinion(game, c.id, civId);
            const parts = opinionParts(game, c.id, civId);
            const treaties = treatiesOf(game, civId, c.id);
            const w = game.wars.find(
              x => (x.a === civId && x.b === c.id) || (x.b === civId && x.a === c.id),
            );
            return (
              <div key={c.id} className={`people ${c.alive ? '' : 'gone'}`}>
                <div className="people-head">
                  <span className="swatch" style={{ background: c.color }} />
                  <b>{c.name}</b>
                  {c.independent && (
                    <span className="muted small">
                      {' '}
                      free people · {standing(game, c.id, civId)}
                    </span>
                  )}
                  <span className="ident-bar">
                    {identity(c)
                      .slice(0, 3)
                      .map(i => (
                        <TagChip key={i.tag} tag={i.tag} />
                      ))}
                  </span>
                  <span className="spacer" />
                  {c.alive ? (
                    <span
                      className={`opinion ${op >= 15 ? 'good' : op <= -15 ? 'bad' : ''}`}
                      title={parts
                        .map(x => `${x.value > 0 ? '+' : ''}${x.value} ${x.label}`)
                        .join('\n')}
                    >
                      {attitude(op)} ({op > 0 ? '+' : ''}
                      {op})
                    </span>
                  ) : (
                    <span className="muted">Gone</span>
                  )}
                </div>
                {c.alive && !c.independent && <LeaderLine game={game} civId={civId} them={c.id} />}
                {c.alive && (
                  <>
                    <div className="people-body small">
                      <span>{game.cities.filter(x => x.civId === c.id).length} cities</span>
                      <span>
                        army {p} ({mine ? Math.round((p / Math.max(1, mine)) * 100) : '∞'}% of
                        yours)
                      </span>
                      <span>score {score(game, c.id)}</span>
                      {war ? <b className="bad">War since turn {w?.since}</b> : <span>Peace</span>}
                      {treaties.map((t, i) => (
                        <span key={i} className="treaty">
                          {t.kind === 'pact'
                            ? `Pact until turn ${t.until}`
                            : t.kind === 'alliance'
                              ? 'Allies'
                              : `Trade until turn ${t.until}`}
                        </span>
                      ))}
                      <span className="muted">{relation(c.id)}</span>
                    </div>
                    <div className="opinion-parts small">
                      {parts.map((x, i) => (
                        <span key={i} className={x.value >= 0 ? 'good' : 'bad'}>
                          {x.value > 0 ? '+' : ''}
                          {x.value} {x.label}
                        </span>
                      ))}
                    </div>
                    <div className="row">
                      {war ? (
                        <PeaceTerms
                          game={game}
                          me={civId}
                          them={c.id}
                          onOffer={o => onDeal(c.id, o)}
                        />
                      ) : (
                        <>
                          <button onClick={() => setDealWith(c.id)}>Propose a deal…</button>
                          {c.independent && (
                            <>
                              <button onClick={() => onGift(c.id, 25)}>Gift 25 gold</button>
                              <button onClick={() => onGift(c.id, 100)}>Gift 100 gold</button>
                              <button
                                disabled={absorbProblem(game, civId, c.id) !== null}
                                title={absorbProblem(game, civId, c.id) ?? ''}
                                onClick={() => onAbsorb(c.id)}
                              >
                                Absorb ({absorbCost(game, c.id)} gold)
                              </button>
                              <span className="muted small">
                                They send you {describeTribute(tributeTo(game, c.id, civId))}.
                                {absorbProblem(game, civId, c.id)
                                  ? ` Absorb: ${absorbProblem(game, civId, c.id)}`
                                  : ''}
                              </span>
                            </>
                          )}
                          <button
                            onClick={() => onWar(c.id)}
                            title={
                              hasPact(game, civId, c.id) ? 'Breaking a pact angers everyone' : ''
                            }
                          >
                            Declare war{hasPact(game, civId, c.id) ? ' (breaks pact)' : ''}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Build a deal: what you give, what you ask, and treaties. Their answer updates as you edit. */
function DealDialog({
  game,
  from,
  to,
  onBack,
  onSend,
}: {
  game: GameState;
  from: number;
  to: number;
  onBack: () => void;
  onSend: (o: Offer) => void;
}) {
  const [give, setGive] = useState<Bundle>({});
  const [get, setGet] = useState<Bundle>({});
  const [pact, setPact] = useState(false);
  const [alliance, setAlliance] = useState(false);
  const them = game.civs[to];
  const offer: Offer = { give, get, pact, alliance, turns: DEAL_TURNS };
  const ev = evaluateOffer(game, from, to, offer);
  const capA = capitalOf(game, from),
    capB = capitalOf(game, to);
  const stockA = capA ? marketStock(game, capA) : {},
    stockB = capB ? marketStock(game, capB) : {};
  const goods = Object.keys(GOODS);

  const side = (
    label: string,
    b: Bundle,
    set: (b: Bundle) => void,
    stock: Record<string, number>,
    gold: number,
    ledger: Record<string, GoodLine>,
  ) => {
    const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
    const setGood = (key: 'goods' | 'goodsPerTurn', g: string, n: number) => {
      const m = { ...(b[key] ?? {}) };
      if (n) m[g] = n;
      else delete m[g];
      set({ ...b, [key]: m });
    };
    return (
      <div className="deal-side">
        <h3>{label}</h3>
        <label className="deal-row">
          <span>
            Gold now <small className="muted">(has {Math.floor(gold)})</small>
          </span>
          <input
            type="number"
            min={0}
            value={b.gold ?? 0}
            onChange={e => set({ ...b, gold: num(e.target.value) })}
          />
        </label>
        <label className="deal-row">
          <span>Gold a turn</span>
          <input
            type="number"
            min={0}
            value={b.goldPerTurn ?? 0}
            onChange={e => set({ ...b, goldPerTurn: num(e.target.value) })}
          />
        </label>
        <table className="deal-goods">
          <tbody>
            <tr className="muted small">
              <td>Good</td>
              <td>In store</td>
              <td>Net a turn</td>
              <td>Now</td>
              <td>A turn</td>
            </tr>
            {goods
              .filter(g => (stock[g] ?? 0) >= 1 || (ledger[g]?.net ?? 0) !== 0)
              .map(g => (
                <tr key={g}>
                  <td>
                    <GoodIcon id={g} /> {GOODS[g].name}
                  </td>
                  <td>{Math.floor(stock[g] ?? 0)}</td>
                  <td className={(ledger[g]?.net ?? 0) < 0 ? 'bad' : ''}>
                    {(ledger[g]?.net ?? 0) > 0 ? '+' : ''}
                    {ledger[g]?.net ?? 0}
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={b.goods?.[g] ?? 0}
                      onChange={e => setGood('goods', g, num(e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={b.goodsPerTurn?.[g] ?? 0}
                      onChange={e => setGood('goodsPerTurn', g, num(e.target.value))}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="modal-back" onClick={onBack}>
      <div className="modal deal" onClick={e => e.stopPropagation()}>
        <header>
          <h2>Deal with the {them.name}</h2>
          <button className="x" onClick={onBack}>
            ×
          </button>
        </header>
        <div className="deal-body">
          {side('You give', give, setGive, stockA, game.civs[from].gold, ledgerOf(game, from))}
          {side('You ask for', get, setGet, stockB, them.gold, ledgerOf(game, to))}
        </div>
        <div className="row">
          <label>
            <input type="checkbox" checked={pact} onChange={e => setPact(e.target.checked)} />{' '}
            Non-aggression pact ({PACT_TURNS} turns)
          </label>
          <label>
            <input
              type="checkbox"
              checked={alliance}
              onChange={e => setAlliance(e.target.checked)}
            />{' '}
            Alliance
          </label>
        </div>
        <p className="small muted">
          Per-turn items run for {DEAL_TURNS} turns, paid from each capital's market. Goods they
          lack are worth more to them.
        </p>
        <p className={ev.accept ? 'good' : 'bad'}>
          {ev.reason} {describeBundle(give) && `You give ${describeBundle(give)}.`}{' '}
          {describeBundle(get) && `You get ${describeBundle(get)}.`}
        </p>
        <div className="row">
          <button className="primary" disabled={!ev.accept} onClick={() => onSend(offer)}>
            Propose
          </button>
          <button onClick={onBack}>Back</button>
        </div>
      </div>
    </div>
  );
}

/** Who leads them, what kind of leader, and what they intend toward you, with the reasons. */
function LeaderLine({ game, civId, them }: { game: GameState; civId: number; them: number }) {
  const c = game.civs[them];
  const pers = personalityOf(game.settings.map.seed, c);
  const house = rulerOf(c);
  const intent = intentToward(game, them, civId);
  return (
    <div className="leader-line small">
      <span>
        {house ? `House ${house.name} rules` : 'Ruled'}
        {pers ? (
          <>
            {' · '}
            <b title={pers.note}>{pers.name}</b>: <span className="muted">{pers.note}</span>
          </>
        ) : null}
      </span>
      {intent.level !== 'war' && (
        <span className={`intent intent-${intent.level}`} title={intent.reasons.join('\n')}>
          <b>{intent.label}</b>
          {intent.reasons.length > 0 && (
            <span className="muted"> · {intent.reasons.slice(0, 4).join(' · ')}</span>
          )}
        </span>
      )}
    </div>
  );
}
