import { describeOffer } from '../engine/diplomacy.ts';
import type { GameState, Proposal } from '../engine/types.ts';

/** An AI people's offer or demand, waiting for the player's answer. */
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
  return (
    <div className="modal-back">
      <div className="modal confirm proposal">
        <h2>
          <span className="swatch" style={{ background: them.color }} />{' '}
          {p.kind === 'demand' ? 'A demand' : 'An offer'} from the {them.name}
        </h2>
        <p>{p.text}</p>
        <p className="muted small">In full: {describeOffer(game, p.offer)}.</p>
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
