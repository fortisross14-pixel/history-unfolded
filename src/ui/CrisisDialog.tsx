import { activeCrisis, crisisRisks, respondCrisis } from '../engine/crises.ts';
import type { Civ, GameState } from '../engine/types.ts';

/**
 * A crisis: why it struck, what it does while it lasts, and the ways out. With no crisis, the
 * pressures the realm is drifting toward, so a crisis never comes out of nowhere.
 */
export function CrisisDialog({
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
  const a = activeCrisis(game, civ);
  const risks = crisisRisks(game, civ);
  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal crisis"
        role="dialog"
        aria-modal="true"
        aria-label={a ? a.def.name : 'Crises'}
        onClick={e => e.stopPropagation()}
      >
        <header>
          <h2>
            {a ? `Crisis: ${a.def.name}` : 'Crises'}{' '}
            <small>{a ? `${a.left} turns left at most` : 'what could go wrong'}</small>
          </h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {a ? (
          <>
            <p className="crisis-why">
              <b>Why:</b> {a.why}
            </p>
            <p className="small">
              <b>While it lasts:</b> {a.def.effects}
              {a.state.eased ? ' Eased: half as hard.' : ''}
            </p>
            {a.state.response ? (
              <p className="small">
                You answered: <b>{a.state.response}</b>.
              </p>
            ) : (
              <p className="muted small">
                Choose one answer. Some crises also end on their own when their cause is fixed.
              </p>
            )}
            <div className="event-choices">
              {a.choices.map((ch, i) => (
                <button
                  key={i}
                  className="event-choice"
                  disabled={!!ch.blocked}
                  onClick={() => {
                    report(respondCrisis(game, civ.id, i));
                    onClose();
                  }}
                >
                  <b>{ch.label}</b>
                  <small>{ch.blocked ?? ch.effect}</small>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="muted small">
              Crises grow out of the realm&apos;s own state: crowding brings plague, hunger famine,
              overspending debt, religious tension schism, factories without comforts strikes. A
              crisis can only strike when its cause is real (100% below).
            </p>
            {risks.length ? (
              <ul className="crisis-risks">
                {risks.map(r => (
                  <li key={r.def.id}>
                    <b>{r.def.name}</b> {Math.round(r.value * 100)}% — {r.why}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small">No crisis is building in your realm.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
