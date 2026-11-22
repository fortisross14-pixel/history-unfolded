import { AGE_SYSTEMS, PATHS, type NationalPath } from '../data/paths.ts';
import { TAGS } from '../data/culture.ts';
import { ERAS } from '../data/techs.ts';
import {
  choosePath,
  edictProblem,
  lockedOptions,
  pathOptions,
  pathStrength,
  useEdict,
} from '../engine/paths.ts';
import type { Civ, GameState } from '../engine/types.ts';
import { VICTORIES } from '../engine/victory.ts';

/**
 * The nation: the directions taken, their edicts, and a direction still to choose. Opened as the
 * "Entering the age" card when the player reaches a new age.
 */
export function NationDialog({
  game,
  civ,
  age,
  report,
  onClose,
}: {
  game: GameState;
  civ: Civ;
  /** set when shown as the card for a newly entered age */
  age?: number;
  report: (r: { ok: boolean; msg?: string }) => void;
  onClose: () => void;
}) {
  const options = pathOptions(game, civ);
  const locked = lockedOptions(game, civ);
  const taken = (civ.paths ?? []).map(id => PATHS[id]).filter(Boolean);
  const sys = age ? AGE_SYSTEMS[age] : undefined;
  const opened = age ? VICTORIES.filter(v => v.opensAt === age) : [];
  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal nation"
        role="dialog"
        aria-modal="true"
        aria-label={age ? `Entering the ${ERAS[age]} age` : 'Nation'}
        onClick={e => e.stopPropagation()}
      >
        <header>
          <h2>
            {age ? `Entering the ${ERAS[age]} Age` : 'Nation'}{' '}
            <small>{age ? sys?.system : 'directions, legacies and edicts'}</small>
          </h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {sys && <p className="age-text">{sys.text}</p>}
        {opened.length > 0 && (
          <p className="small">
            Victories now open: <b>{opened.map(v => v.name).join(' and ')}</b>. See Victory (V).
          </p>
        )}

        {options.length > 0 && (
          <>
            <h3>Choose a national direction</h3>
            <p className="muted small">
              A lasting choice: its effects stay for the rest of the game, and it brings an edict. A
              direction is half again as strong when your culture already leans its way.
            </p>
            <div className="path-choices">
              {options.map(p => (
                <PathCard
                  key={p.id}
                  p={p}
                  civ={civ}
                  onChoose={() => {
                    report(choosePath(game, civ.id, p.id));
                    onClose();
                  }}
                />
              ))}
              {locked.map(p => (
                <PathCard key={p.id} p={p} civ={civ} locked />
              ))}
            </div>
          </>
        )}

        {taken.length > 0 && (
          <>
            <h3>Your directions</h3>
            <div className="path-taken">
              {taken.map(p => {
                const why = edictProblem(game, civ, p.id);
                return (
                  <section key={p.id} className="path-card taken">
                    <b>{p.name}</b>
                    <small className="muted">
                      {p.effects.join(' · ')}
                      {pathStrength(civ, p) > 1
                        ? ` (×1.5 with ${TAGS[p.synergy]?.name ?? p.synergy})`
                        : ''}
                    </small>
                    <button
                      className="secondary"
                      disabled={!!why}
                      title={why ?? p.edict.text}
                      onClick={() => report(useEdict(game, civ.id, p.id))}
                    >
                      {p.edict.name}
                      {p.edict.gold ? ` (${p.edict.gold} gold)` : ''}
                    </button>
                    <small>{why ?? p.edict.text}</small>
                  </section>
                );
              })}
            </div>
          </>
        )}
        {!options.length && !taken.length && (
          <p className="muted small">
            Your people choose a national direction on entering the Classical age, and again in the
            Renaissance.
          </p>
        )}
        {age && !options.length && (
          <button className="primary" onClick={onClose}>
            Onward
          </button>
        )}
      </div>
    </div>
  );
}

function PathCard({
  p,
  civ,
  locked,
  onChoose,
}: {
  p: NationalPath;
  civ: Civ;
  locked?: boolean;
  onChoose?: () => void;
}) {
  const strong = pathStrength(civ, p) > 1;
  return (
    <button className={`path-card ${locked ? 'locked' : ''}`} disabled={locked} onClick={onChoose}>
      <b>
        {p.name}
        {p.needs ? <span className="path-alt"> alternate development</span> : null}
      </b>
      <small>{p.pitch}</small>
      <small className="path-effects">{p.effects.join(' · ')}</small>
      <small>
        Edict: <b>{p.edict.name}</b> — {p.edict.text} Every {p.edict.cooldown} turns
        {p.edict.gold ? `, ${p.edict.gold} gold` : ''}.
      </small>
      <small className="muted">
        {locked
          ? `Offered only ${p.needsText}.`
          : strong
            ? `Your ${TAGS[p.synergy]?.name ?? p.synergy} culture makes it half again as strong.`
            : `Stronger with ${TAGS[p.synergy]?.name ?? p.synergy} culture.`}
      </small>
    </button>
  );
}
