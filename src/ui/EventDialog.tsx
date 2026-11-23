import { EVENTS, eventCtx } from '../engine/events.ts';
import type { GameState, PendingEvent } from '../engine/types.ts';
import { InfoButton } from './bits.tsx';
import { TextChips } from './NationDialog.tsx';

/** A history event waiting for the player's choice. */
export function EventDialog({
  game,
  p,
  onChoose,
}: {
  game: GameState;
  p: PendingEvent;
  onChoose: (choice: number) => void;
}) {
  const e = EVENTS[p.eventId];
  const civ = game.civs[p.civId];
  const ctx = eventCtx(game, p);
  return (
    <div className="modal-back">
      <div className="modal confirm event">
        <p className="muted small">
          Turn {p.turn}
          {ctx.city ? ` · ${ctx.city.name}` : ''}
          {ctx.other ? ` · the ${ctx.other.name}` : ''}
        </p>
        <h2>
          {e.title}{' '}
          <InfoButton label="What happened" align="right">
            {e.text(game, civ, ctx)}
          </InfoButton>
        </h2>
        <div className="col" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {e.choices.map((c, i) => {
            const why = c.blocked?.(game, civ, ctx);
            return (
              <button
                key={i}
                className={i === 0 ? 'primary' : ''}
                disabled={!!why}
                title={why ?? ''}
                onClick={() => onChoose(i)}
                style={{ textAlign: 'left' }}
              >
                <b>{c.label}</b>
                <br />
                {why ? (
                  <span className="small">{why}</span>
                ) : (
                  <TextChips text={c.effect(game, civ, ctx)} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
