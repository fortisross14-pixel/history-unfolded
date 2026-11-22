import { pendingEvent, resolveEvent } from '../engine/events.ts';
import type { Civ, GameState } from '../engine/types.ts';

const KIND_ICON: Record<string, string> = {
  land: '🌾',
  people: '🏘',
  court: '👑',
  trade: '⚖',
  war: '⚔',
  faith: '✨',
  knowledge: '📜',
};

/** A story that asks for a choice. Each choice says what it costs and gives before it is made. */
export function EventDialog({
  game,
  civ,
  report,
  onClose,
}: {
  game: GameState;
  civ: Civ;
  report: (r: { ok: boolean; msg?: string }) => void;
  onClose: () => void;
}) {
  const ev = pendingEvent(game, civ);
  if (!ev) return null;
  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal event"
        role="dialog"
        aria-modal="true"
        aria-label={ev.title}
        onClick={e => e.stopPropagation()}
      >
        <header>
          <h2>
            <span className="event-icon">{KIND_ICON[ev.kind] ?? '❖'}</span> {ev.title}
          </h2>
          <button className="x" onClick={onClose} aria-label="Later">
            ×
          </button>
        </header>
        <p className="event-text">{ev.text}</p>
        <div className="event-choices">
          {ev.choices.map((ch, i) => (
            <button
              key={i}
              className="event-choice"
              disabled={!!ch.blocked}
              onClick={() => {
                report(resolveEvent(game, civ, i));
                onClose();
              }}
            >
              <b>{ch.label}</b>
              <small>{ch.blocked ?? ch.effect}</small>
            </button>
          ))}
        </div>
        <p className="muted small">
          Close to decide later this turn; left open, the first choice is taken when the turn ends.
        </p>
      </div>
    </div>
  );
}
