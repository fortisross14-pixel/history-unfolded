import { wondersOf } from '../engine/wonders.ts';
import { faithById, foundProblem, tenetDue } from '../engine/faith.ts';
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
import { VICTORIES, victoryOn } from '../engine/victory.ts';
import { activeCrisis, crisisRisks } from '../engine/crises.ts';
import { POLICY_COOLDOWN, POLICY_LIST, sideOf } from '../data/policies.ts';
import { openPolicies, policyProblem, positionOf, setPolicy } from '../engine/policies.ts';

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
  onCrisis,
  onFaith,
  onWonders,
}: {
  game: GameState;
  civ: Civ;
  /** set when shown as the card for a newly entered age */
  age?: number;
  onCrisis: () => void;
  onFaith: () => void;
  onWonders: () => void;
  report: (r: { ok: boolean; msg?: string }) => void;
  onClose: () => void;
}) {
  const options = pathOptions(game, civ);
  const locked = lockedOptions(game, civ);
  const taken = (civ.paths ?? []).map(id => PATHS[id]).filter(Boolean);
  const sys = age ? AGE_SYSTEMS[age] : undefined;
  const opened = age ? VICTORIES.filter(v => v.opensAt === age && victoryOn(game, v.id)) : [];
  const crisis = activeCrisis(game, civ);
  const risks = crisisRisks(game, civ);
  // on an age card only the policy that age opens; otherwise every open lever
  const levers = age ? POLICY_LIST.filter(p => p.age === age) : openPolicies(civ);
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
            <small>{age ? sys?.system : 'policies, directions and edicts'}</small>
          </h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {sys && <p className="age-text">{sys.text}</p>}
        {!age && (
          <p className="small crisis-line">
            {crisis ? (
              <>
                <b>Crisis: {crisis.def.name}</b>, {crisis.left} turns left at most
                {crisis.state.response ? ` (answered: ${crisis.state.response})` : ''}.{' '}
              </>
            ) : risks.length ? (
              <>
                Building up: <b>{risks[0].def.name}</b> at {Math.round(risks[0].value * 100)}%.{' '}
              </>
            ) : (
              <>No crisis is building. </>
            )}
            <button className="link" onClick={onCrisis}>
              {crisis && !crisis.state.response ? 'Answer it' : 'See crises'}
            </button>
          </p>
        )}
        {!age && (
          <p className="small crisis-line">
            {faithById(game, civ.faith) ? (
              <>
                Faith: <b>{faithById(game, civ.faith)!.name}</b>.{' '}
              </>
            ) : (
              <>Your people keep no one faith yet. </>
            )}
            <button className="link" onClick={onFaith}>
              {!foundProblem(game, civ.id)
                ? 'Found a faith'
                : tenetDue(game, civ.id)
                  ? 'Choose a tenet'
                  : 'See faiths (I)'}
            </button>{' '}
            · {wondersOf(game, civ.id).length} world wonders held.{' '}
            <button className="link" onClick={onWonders}>
              Wonders (W)
            </button>
          </p>
        )}
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

        {levers.length > 0 && (
          <>
            <h3>{age ? 'A new policy' : 'Policies'}</h3>
            <p className="muted small">
              {age
                ? 'Every age brings one question your realm keeps answering. Earlier policies stay in force.'
                : `One lever per age. The middle is balanced; each side gives and costs. A lever can be moved again ${POLICY_COOLDOWN} turns after it was last moved.`}
            </p>
            <div className="policies">
              {levers.map(p => {
                const pos = positionOf(civ, p.id);
                const why = policyProblem(game, civ, p.id);
                const side = sideOf(p, pos);
                return (
                  <section key={p.id} className="policy">
                    <div className="policy-head">
                      <b>{p.name}</b> <small className="muted">{p.question}</small>
                    </div>
                    <div className="policy-lever" role="radiogroup" aria-label={p.name}>
                      {([-1, 0, 1] as const).map(v => (
                        <button
                          key={v}
                          role="radio"
                          aria-checked={pos === v}
                          className={pos === v ? 'on' : ''}
                          disabled={pos !== v && !!why}
                          title={
                            why ??
                            (v === -1 ? p.left.effects : v === 1 ? p.right.effects : 'No effect')
                          }
                          onClick={() => pos !== v && report(setPolicy(game, civ.id, p.id, v))}
                        >
                          {v === -1 ? p.left.name : v === 1 ? p.right.name : 'Balanced'}
                        </button>
                      ))}
                    </div>
                    <small>
                      {side ? side.effects : 'Balanced: no effect.'}
                      {why && pos !== 0 ? ` ${why}` : ''}
                    </small>
                    {!side && (
                      <small className="muted">
                        {p.left.name}: {p.left.effects}. {p.right.name}: {p.right.effects}.
                      </small>
                    )}
                  </section>
                );
              })}
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
