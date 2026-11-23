import { activeCrisis, crisisRisks, respondCrisis } from '../engine/crises.ts';
import type { Civ, GameState } from '../engine/types.ts';
import { Chip, InfoButton } from './bits.tsx';
import { EffectChips } from './RealmEventDialog.tsx';

/**
 * A crisis: what it does while it lasts and the ways out, its cause behind (i). With no crisis,
 * the pressures building toward one.
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
            {a ? a.def.name : 'Crises'}{' '}
            {a && (
              <small className="chips w-inline">
                <Chip icon="hourglass" n={a.left} title="Turns left at most" />
              </small>
            )}
          </h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {a ? (
          <>
            <p className="crisis-why">
              {a.def.effects}
              {a.state.eased ? ' Eased: half as hard.' : ''}{' '}
              <InfoButton label="Why it struck">
                <span>
                  <b>Why:</b> {a.why}
                </span>
                <span>Some crises also end once their cause is fixed.</span>
              </InfoButton>
            </p>
            {a.state.response && (
              <p className="small good">
                ✓ <b>{a.state.response}</b>
              </p>
            )}
            <div className="event-choices">
              {a.choices.map((ch, i) => (
                <button
                  key={i}
                  className="event-choice"
                  disabled={!!ch.blocked}
                  title={ch.blocked ?? ch.effect}
                  onClick={() => {
                    report(respondCrisis(game, civ.id, i));
                    onClose();
                  }}
                >
                  <b>{ch.label}</b>
                  {ch.blocked ? <small>{ch.blocked}</small> : <EffectChips text={ch.effect} />}
                </button>
              ))}
            </div>
          </>
        ) : risks.length ? (
          <ul className="crisis-risks">
            {risks.map(r => (
              <li key={r.def.id} className="w-risk">
                <b>{r.def.name}</b>
                <span className="w-meter" aria-hidden>
                  <span style={{ width: `${Math.min(100, Math.round(r.value * 100))}%` }} />
                </span>
                <span className={r.value >= 1 ? 'bad' : ''}>{Math.round(r.value * 100)}%</span>
                <InfoButton label={`Why ${r.def.name.toLowerCase()} builds`} align="right">
                  <span>{r.why}</span>
                  <span className="muted">Strikes only at 100%.</span>
                </InfoButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small">No crisis building.</p>
        )}
      </div>
    </div>
  );
}
