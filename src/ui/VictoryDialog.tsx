import { DEFAULT_TURN_LIMIT, score } from '../engine/game.ts';
import type { GameState } from '../engine/types.ts';
import { Ico, InfoButton } from './bits.tsx';
import { holdLeft, isOpen, opensText, progress, VICTORIES, victoryOn } from '../engine/victory.ts';

const V_ICON: Record<string, string> = {
  conquest: 'war',
  cultural: 'culture',
  economic: 'gold',
  diplomatic: 'peace',
  scientific: 'science',
};

/** The engine's progress line, cut to its numbers: "12% / 40%", "3 rivals left". */
const short = (t: string) =>
  t
    .replace(/^(\d+)% of .*\(goal (\d+)%\)/, '$1% / $2%')
    .replace(/^(\d+) rival peoples? remains?/, '$1 rivals left')
    .replace(/^League of (\d+) holds (\d+)% of the world's people/, 'League $1 · $2%')
    .replace(', but you are not its largest member', ' · not largest')
    .replace(/ Industrial techs, /, ' techs · ')
    .replace(/ national projects/, ' projects');

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
            Victory{' '}
            <InfoButton label="About victories">
              Conquest: open from the start. Cultural and Economic: from the Renaissance. Diplomatic
              and Scientific: from the Industrial age. A dominance goal must be held for some turns;
              everyone is warned when someone holds one.
            </InfoButton>
          </h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {game.coalition && (
          <p className={`small ${game.coalition.against === me.id ? 'warn' : ''}`}>
            <Ico name="warning" fallback="!" /> <b>Coalition</b>{' '}
            {game.coalition.members.map(id => game.civs[id].name).join(', ')} vs{' '}
            {game.coalition.against === me.id ? 'you' : game.civs[game.coalition.against].name}{' '}
            <InfoButton label="Why the coalition">
              {game.coalition.against === me.id ? 'You' : 'They'} {game.coalition.reason}.
            </InfoButton>
          </p>
        )}
        <div className="victory-list">
          {VICTORIES.map(v => {
            const mine = progress(game, me, v.id);
            const open = isOpen(me, v);
            if (!victoryOn(game, v.id))
              return (
                <section key={v.id} className="victory-row locked">
                  <h3>
                    <Ico name={V_ICON[v.id] ?? 'laurel'} fallback="★" size={20} /> {v.name}{' '}
                    <small>off</small>
                  </h3>
                </section>
              );
            const lead = rivals
              .map(c => ({ c, p: progress(game, c, v.id) }))
              .sort((a, b) => b.p.value - a.p.value)[0];
            const hold = holdLeft(game, v.id);
            return (
              <section key={v.id} className={`victory-row ${open ? '' : 'locked'}`}>
                <h3>
                  <Ico name={V_ICON[v.id] ?? 'laurel'} fallback="★" size={20} /> {v.name}{' '}
                  {!open && (
                    <small>
                      <Ico name="lock" fallback="🔒" size={12} /> {opensText(v)}
                    </small>
                  )}{' '}
                  <InfoButton label={`${v.name}: the goal`}>{v.goal}</InfoButton>
                </h3>
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
                    <Ico name="end-turn" fallback="⌛" size={14} />{' '}
                    {hold.civId === me.id
                      ? `You win in ${hold.left} turns`
                      : `${game.civs[hold.civId].name} win in ${hold.left} turns`}
                  </p>
                )}
              </section>
            );
          })}
          <section className="victory-row">
            <h3>
              <Ico name="laurel" fallback="★" size={20} /> Score <small>turn {limit}</small>{' '}
              <InfoButton label="About score">
                If nobody wins first, the best score at turn {limit} wins (people, settlements,
                techs, culture).
              </InfoButton>
            </h3>
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
      <span className="vbar-text small" title={text}>
        {short(text)}
      </span>
    </div>
  );
}
