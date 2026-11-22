import { DEFAULT_TURN_LIMIT, score } from '../engine/game.ts';
import type { GameState } from '../engine/types.ts';
import { holdLeft, isOpen, opensText, progress, VICTORIES } from '../engine/victory.ts';

/** Every way to win: what it asks, when it opens, how close you and the leading rival are. */
export function VictoryDialog({ game, onClose }: { game: GameState; onClose: () => void }) {
  const me = game.civs.find(c => c.isPlayer)!;
  const rivals = game.civs.filter(c => c.alive && !c.independent && !c.isPlayer);
  const limit = game.settings.turnLimit ?? DEFAULT_TURN_LIMIT;
  const best = rivals.slice().sort((a, b) => score(game, b.id) - score(game, a.id))[0];
  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal victory"
        role="dialog"
        aria-modal="true"
        aria-label="Victory"
        onClick={e => e.stopPropagation()}
      >
        <header>
          <h2>
            Victory <small>the ways to win</small>
          </h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p className="muted small">
          Conquest is open from the start. Cultural domination and Economic dominance open for a
          people when it enters the Renaissance; the Diplomatic federation and Scientific victory in
          the Industrial age. A dominance goal must be held for a number of turns, and everyone is
          warned when someone holds one.
        </p>
        {game.coalition && (
          <p className={`small ${game.coalition.against === me.id ? 'warn' : ''}`}>
            <b>Coalition:</b>{' '}
            {game.coalition.members
              .map(id => game.civs[id].name)
              .map(n => `the ${n}`)
              .join(', ')}{' '}
            stand against{' '}
            {game.coalition.against === me.id
              ? `you, because you ${game.coalition.reason}`
              : `the ${game.civs[game.coalition.against].name}, because they ${game.coalition.reason}`}
            .
          </p>
        )}
        <div className="victory-list">
          {VICTORIES.map(v => {
            const mine = progress(game, me, v.id);
            const open = isOpen(me, v);
            const lead = rivals
              .map(c => ({ c, p: progress(game, c, v.id) }))
              .sort((a, b) => b.p.value - a.p.value)[0];
            const hold = holdLeft(game, v.id);
            return (
              <section key={v.id} className={`victory-row ${open ? '' : 'locked'}`}>
                <h3>
                  {v.name} <small>{open ? 'open' : opensText(v)}</small>
                </h3>
                <p className="small">{v.goal}</p>
                <Bar label="You" value={mine.value} text={mine.text} />
                {lead && (
                  <Bar
                    label={lead.c.name}
                    value={lead.p.value}
                    text={
                      lead.p.text + (isOpen(lead.c, v) ? '' : ` (${opensText(v).toLowerCase()})`)
                    }
                    rival
                  />
                )}
                {hold && hold.left > 0 && (
                  <p className={`small ${hold.civId === me.id ? '' : 'warn'}`}>
                    {hold.civId === me.id
                      ? `You hold this goal: ${hold.left} more turns to win.`
                      : `The ${game.civs[hold.civId].name} hold this goal: they win in ${hold.left} turns.`}
                  </p>
                )}
              </section>
            );
          })}
          <section className="victory-row">
            <h3>
              Score <small>at turn {limit}</small>
            </h3>
            <p className="small">
              If nobody wins before, the best score at turn {limit} wins (people, settlements,
              techs, culture).
            </p>
            <Bar label="You" value={1} text={`${score(game, me.id)} points`} plain />
            {best && (
              <Bar
                label={best.name}
                value={1}
                text={`${score(game, best.id)} points`}
                plain
                rival
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Bar({
  label,
  value,
  text,
  rival,
  plain,
}: {
  label: string;
  value: number;
  text: string;
  rival?: boolean;
  plain?: boolean;
}) {
  return (
    <div className={`vbar ${rival ? 'rival' : ''}`}>
      <span className="vbar-who">{label}</span>
      {!plain && (
        <span
          className="vbar-track"
          role="progressbar"
          aria-valuenow={Math.round(value * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="vbar-fill" style={{ width: `${Math.round(value * 100)}%` }} />
        </span>
      )}
      <span className="vbar-text small">{text}</span>
    </div>
  );
}
