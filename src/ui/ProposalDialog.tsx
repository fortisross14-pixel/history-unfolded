import { describeOffer, PACT_TURNS } from '../engine/diplomacy.ts';
import type { GameState, Proposal } from '../engine/types.ts';
import { Chip, InfoButton } from './bits.tsx';
import { BundleChips } from './PeoplesDialog.tsx';
import { CivBadge } from './Badge.tsx';

/** An AI people's offer or demand: what you get and give as chips, the wording behind (i). */
export function ProposalDialog({
  game,
  p,
  onAnswer,
}: {
  game: GameState;
  p: Proposal;
  onAnswer: (yes: boolean) => void;
}) {
  const them = game.civs[p.from];
  const o = p.offer;
  const perTurn = !!(
    o.give.goldPerTurn ||
    o.get.goldPerTurn ||
    Object.keys(o.give.goodsPerTurn ?? {}).length ||
    Object.keys(o.get.goodsPerTurn ?? {}).length
  );
  const hasGive = Object.values(o.give).some(v =>
    typeof v === 'number' ? v : v && Object.keys(v).length,
  );
  const hasGet = Object.values(o.get).some(v =>
    typeof v === 'number' ? v : v && Object.keys(v).length,
  );
  return (
    <div className="modal-back">
      <div className="modal confirm proposal">
        <h2>
          <CivBadge civ={them} size={26} /> {p.kind === 'demand' ? 'Demand' : 'Offer'}: {them.name}{' '}
          <InfoButton label="In full" align="right">
            <span>{p.text}</span>
            <span className="muted">{describeOffer(game, o)}.</span>
          </InfoButton>
        </h2>
        <div className="w-offer">
          {(o.peace || o.pact || o.alliance || p.kind === 'demand') && (
            <div className="chips">
              {p.kind === 'demand' && (
                <span className="w-tag bad" title="Refuse, and they may come for it">
                  Refuse: war risk
                </span>
              )}
              {o.peace && <span className="w-tag good">Peace</span>}
              {o.pact && (
                <span className="w-tag" title="Non-aggression pact">
                  Pact · {PACT_TURNS}t
                </span>
              )}
              {o.alliance && <span className="w-tag good">Alliance</span>}
            </div>
          )}
          {hasGive && (
            <div className="w-offer-row">
              <small>You get</small>
              <BundleChips game={game} b={o.give} />
            </div>
          )}
          {hasGet && (
            <div className="w-offer-row">
              <small>You give</small>
              <BundleChips game={game} b={o.get} />
            </div>
          )}
          {perTurn && o.turns ? (
            <div className="chips">
              <Chip icon="hourglass" n={o.turns} title="Per-turn items run this many turns" />
            </div>
          ) : null}
        </div>
        <div className="row">
          <button className="primary" onClick={() => onAnswer(true)}>
            {p.kind === 'demand' ? 'Pay' : 'Accept'}
          </button>
          <button onClick={() => onAnswer(false)}>
            {p.kind === 'demand' ? 'Refuse' : 'Decline'}
          </button>
        </div>
      </div>
    </div>
  );
}
