import { personalityOf } from '../data/leaders.ts';
import { intentToward } from '../engine/ai.ts';
import { rulerOf } from '../engine/dynasty.ts';
import { useState, type ReactNode } from 'react';
import { OPPOSED, TAGS } from '../data/culture.ts';
import { GOODS } from '../data/goods.ts';
import type { GoodLine } from '../engine/economy.ts';
import {
  attitude,
  capitalOf,
  DEAL_TURNS,
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
import { absorbCost, absorbProblem, standing, tributeTo } from '../engine/independents.ts';
import { identity, tagCounts } from '../engine/mods.ts';
import type { Bundle, GameState, Offer } from '../engine/types.ts';
import { TagChip } from './CultureDialog.tsx';
import { Art, Chip, Delta, GoodIcon, Ico, InfoButton } from './bits.tsx';
import { leaderArt } from './leaderArt.ts';
import './declutter-world.css';
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
            <small className="chips w-inline">
              <Chip icon="sword" n={mine} title="Your army strength" />
              <Chip icon="laurel" n={score(game, civId)} title="Your score" />
            </small>
          </h2>
          <button className="x" onClick={onClose}>
            ×
          </button>
        </header>
        {!known.length && <p className="muted">No one met yet.</p>}
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
            const rel = relation(c.id);
            const pct = mine ? Math.round((p / Math.max(1, mine)) * 100) : null;
            const absorbWhy = c.independent ? absorbProblem(game, civId, c.id) : null;
            const tribute = c.independent ? tributeTo(game, c.id, civId) : null;
            const pact = hasPact(game, civId, c.id);
            return (
              <div key={c.id} className={`people ${c.alive ? '' : 'gone'}`}>
                <div className="people-head">
                  {!c.independent && (
                    <Art k={leaderArt(game, c)} size={44} className="leader-art" />
                  )}
                  <span className="swatch" style={{ background: c.color }} />
                  <b>{c.name}</b>
                  {c.independent && (
                    <span className="w-tag" title="A free people">
                      Free · {standing(game, c.id, civId)}
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
                    <>
                      <span
                        className="opinion"
                        title={`${attitude(op)}\n${parts
                          .map(x => `${x.value > 0 ? '+' : ''}${x.value} ${x.label}`)
                          .join('\n')}`}
                      >
                        <Ico name="eye" fallback="👁" size={16} /> <Delta n={op} />
                      </span>
                      <InfoButton label={`Opinion of the ${c.name}`} align="right">
                        <b>
                          {attitude(op)} <Delta n={op} />
                        </b>
                        {parts.map((x, i) => (
                          <span key={i}>
                            <Delta n={x.value} /> {x.label}
                          </span>
                        ))}
                        {rel && <span className="muted">{rel}</span>}
                      </InfoButton>
                    </>
                  ) : (
                    <span className="muted">Gone</span>
                  )}
                </div>
                {c.alive && (
                  <div className="people-body chips">
                    {!c.independent && <LeaderTags game={game} civId={civId} them={c.id} />}
                    <Chip
                      icon="house"
                      n={game.cities.filter(x => x.civId === c.id).length}
                      title="Cities"
                    />
                    <Chip
                      icon="sword"
                      n={p}
                      title={`Army strength${pct !== null ? `: ${pct}% of yours` : ''}`}
                    />
                    <Chip icon="laurel" n={score(game, c.id)} title="Score" />
                    {war && (
                      <b className="bad" title={`At war since turn ${w?.since}`}>
                        War · t{w?.since}
                      </b>
                    )}
                    {treaties.map((t, i) => (
                      <span
                        key={i}
                        className="treaty"
                        title={
                          t.kind === 'pact'
                            ? `Non-aggression pact until turn ${t.until}`
                            : t.kind === 'alliance'
                              ? 'Alliance'
                              : `Trade deal until turn ${t.until}`
                        }
                      >
                        {t.kind === 'pact'
                          ? `Pact → t${t.until}`
                          : t.kind === 'alliance'
                            ? 'Allies'
                            : `Trade → t${t.until}`}
                      </span>
                    ))}
                    {rel && (
                      <span
                        className={`w-tag ${rel.startsWith('Kindred') ? 'good' : 'bad'}`}
                        title={rel}
                      >
                        {rel.startsWith('Kindred') ? 'Kindred' : 'Clash'}
                      </span>
                    )}
                    {tribute && (tribute.gold > 0 || Object.keys(tribute.goods).length > 0) && (
                      <span className="chips" title="Tribute to you a turn">
                        <small className="muted">Tribute</small>
                        {tribute.gold > 0 && (
                          <Chip icon="coin" n={`${tribute.gold}/t`} title="Gold a turn" />
                        )}
                        {Object.entries(tribute.goods).map(([g, n]) => (
                          <Chip
                            key={g}
                            good={g}
                            n={`${n}/t`}
                            title={`${GOODS[g]?.name ?? g} a turn`}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                )}
                {c.alive && (
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
                            <button onClick={() => onGift(c.id, 25)} title="Gift 25 gold">
                              Gift <Chip icon="coin" n={25} title="25 gold" />
                            </button>
                            <button onClick={() => onGift(c.id, 100)} title="Gift 100 gold">
                              Gift <Chip icon="coin" n={100} title="100 gold" />
                            </button>
                            <button
                              disabled={absorbWhy !== null}
                              title={absorbWhy ?? 'Absorb them into your realm'}
                              onClick={() => onAbsorb(c.id)}
                            >
                              Absorb <Chip icon="coin" n={absorbCost(game, c.id)} title="Gold" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => onWar(c.id)}
                          title={pact ? 'Breaks your pact: everyone thinks less of you' : ''}
                        >
                          Declare war{pact ? ' ⚠' : ''}
                        </button>
                      </>
                    )}
                  </div>
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
          <span className="chips">
            Gold now <Chip icon="coin" n={Math.floor(gold)} title="Gold in the treasury" />
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
              <td />
              <td title="In store">Store</td>
              <td title="Net a turn">Net</td>
              <td title="Hand over now">Now</td>
              <td title={`A turn, for ${DEAL_TURNS} turns`}>/turn</td>
            </tr>
            {goods
              .filter(g => (stock[g] ?? 0) >= 1 || (ledger[g]?.net ?? 0) !== 0)
              .map(g => (
                <tr key={g}>
                  <td title={GOODS[g].name}>
                    <GoodIcon id={g} /> <span className="w-hide-phone">{GOODS[g].name}</span>
                  </td>
                  <td>{Math.floor(stock[g] ?? 0)}</td>
                  <td>
                    <Delta n={ledger[g]?.net ?? 0} />
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
            <input type="checkbox" checked={pact} onChange={e => setPact(e.target.checked)} /> Pact
            ({PACT_TURNS} turns)
          </label>
          <label>
            <input
              type="checkbox"
              checked={alliance}
              onChange={e => setAlliance(e.target.checked)}
            />{' '}
            Alliance
          </label>
          <InfoButton label="About deals">
            <span>Non-aggression pact: no war for {PACT_TURNS} turns.</span>
            <span>
              Per-turn items run {DEAL_TURNS} turns, paid from each capital&apos;s market.
            </span>
            <span>Goods they lack are worth more to them.</span>
          </InfoButton>
        </div>
        <p className={ev.accept ? 'good' : 'bad'}>{ev.reason}</p>
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

/** Who leads them (house, kind of leader) and what they intend toward you: short tags, reasons on hover. */
function LeaderTags({ game, civId, them }: { game: GameState; civId: number; them: number }) {
  const c = game.civs[them];
  const pers = personalityOf(game.settings.map.seed, c);
  const house = rulerOf(c);
  const intent = intentToward(game, them, civId);
  return (
    <>
      {house && (
        <span className="chip" title={`House ${house.name} rules`}>
          <Ico name="crown" fallback="👑" size={16} /> {house.name}
        </span>
      )}
      {pers && (
        <span className="w-tag" title={pers.note}>
          {pers.name}
        </span>
      )}
      {intent.level !== 'war' && (
        <span className={`w-tag intent intent-${intent.level}`} title={intent.reasons.join('\n')}>
          {intent.label}
        </span>
      )}
    </>
  );
}

/** What an offer moves, as icon chips: gold, goods, per-turn amounts, settlements. */
export function BundleChips({ game, b }: { game: GameState; b: Bundle }) {
  const out: ReactNode[] = [];
  if (b.gold) out.push(<Chip key="g" icon="coin" n={b.gold} title="Gold" />);
  if (b.goldPerTurn)
    out.push(<Chip key="gt" icon="coin" n={`${b.goldPerTurn}/t`} title="Gold a turn" />);
  for (const [g, n] of Object.entries(b.goods ?? {}))
    if (n) out.push(<Chip key={`o${g}`} good={g} n={n} title={GOODS[g]?.name ?? g} />);
  for (const [g, n] of Object.entries(b.goodsPerTurn ?? {}))
    if (n)
      out.push(
        <Chip key={`t${g}`} good={g} n={`${n}/t`} title={`${GOODS[g]?.name ?? g} a turn`} />,
      );
  for (const id of b.cities ?? [])
    out.push(
      <Chip
        key={`c${id}`}
        icon="house"
        n={game.cities.find(c => c.id === id)?.name ?? 'a settlement'}
        title="Settlement"
      />,
    );
  return out.length ? <span className="chips">{out}</span> : <span className="muted">—</span>;
}
