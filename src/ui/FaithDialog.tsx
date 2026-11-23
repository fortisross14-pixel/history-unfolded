import { useState } from 'react';
import { TECHS } from '../data/techs.ts';
import { TENETS, TENET_SLOTS, tenetsFor, type Tenet, type TenetSlot } from '../data/faiths.ts';
import {
  chooseTenet,
  faithById,
  faithIncome,
  followers,
  foundedBy,
  foundFaith,
  foundProblem,
  maxFaiths,
  realmFaiths,
  suggestName,
  tenetDue,
} from '../engine/faith.ts';
import type { Civ, GameState } from '../engine/types.ts';
import { Ico, InfoButton } from './bits.tsx';
import { ChoiceDetail, EffChips, EffList, modEffs, type Eff } from './NationDialog.tsx';

/** What a tenet does, as effect chips. */
const tenetEffs = (t: Tenet): Eff[] => [
  ...(t.tithe ? [{ icon: 'gold', n: t.tithe, title: 'gold a turn per follower settlement' }] : []),
  ...(t.pilgrims
    ? [{ icon: 'culture', n: t.pilgrims, title: 'culture a turn per foreign follower settlement' }]
    : []),
  ...(t.spread
    ? [{ icon: 'road', n: (t.spread - 1) * 100, pct: true, title: 'faster spread' }]
    : []),
  ...modEffs(t.mods),
];

/**
 * Faith, kept light: found one (a race: the world has room for only a few), choose its three
 * tenets as the ages open them, and see how the faiths of the world spread. Faith spreads by
 * itself: shrines, temples, a cathedral and the holy city push it, roads and trade carry it.
 */
export function FaithDialog({
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
  const own = foundedBy(game, civ.id);
  const kept = faithById(game, civ.faith);
  const why = foundProblem(game, civ.id);
  const due = tenetDue(game, civ.id);
  const [name, setName] = useState(() => suggestName(game, civ.id));
  const [pick, setPick] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const faiths = game.faiths ?? [];
  const room = maxFaiths(game);
  const { by, all } = realmFaiths(game, civ.id);
  const inc = faithIncome(game, civ.id);
  const known = (id: number) => id === civ.id || civ.met.includes(id);
  const holyName = (id: number) => game.cities.find(c => c.id === id)?.name ?? 'lost';

  const tenetCards = (slot: TenetSlot, onPick: (id: string) => void, chosen?: string | null) => (
    <div className="tenet-grid">
      {tenetsFor(slot).map(t => (
        <button
          key={t.id}
          className={`tenet ${chosen === t.id ? 'on' : ''}`}
          onClick={() => onPick(t.id)}
          aria-pressed={chosen === t.id}
        >
          <b title={t.note}>{t.name}</b>
          <EffChips effs={tenetEffs(t)} />
        </button>
      ))}
    </div>
  );

  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal faith"
        role="dialog"
        aria-modal="true"
        aria-label="Faith"
        onClick={e => e.stopPropagation()}
      >
        <header>
          <h2>
            Faith{' '}
            <small>
              {faiths.length} of {room} faiths founded
            </small>
          </h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {own ? (
          <section className="faith-own">
            <h3>{own.name}</h3>
            <span className="chips">
              <span className="chip" title={`Holy city, founded turn ${own.founded}`}>
                <Ico name="sun" fallback="☀" size={18} /> <b>{holyName(own.holy)}</b>
              </span>
              <span className="chip" title="Settlements keeping it">
                <Ico name="city" fallback="⌂" size={18} /> <b>{followers(game, own).all}</b>
              </span>
              <span className="chip" title="Of them abroad">
                <Ico name="peoples" fallback="☺" size={18} /> <b>{followers(game, own).foreign}</b>
              </span>
              {inc.gold ? (
                <span className="chip" title="Gold a turn from the faith">
                  <Ico name="gold" fallback="¤" size={18} />{' '}
                  <span className="delta good">+{Math.round(inc.gold * 10) / 10}</span>
                </span>
              ) : null}
              {inc.culture ? (
                <span className="chip" title="Culture a turn from the faith">
                  <Ico name="culture" fallback="♪" size={18} />{' '}
                  <span className="delta good">+{inc.culture}</span>
                </span>
              ) : null}
            </span>
            <ul className="tenet-list">
              {TENET_SLOTS.map(sl => {
                const t = own.tenets.map(id => TENETS[id]).find(x => x?.slot === sl.slot);
                return (
                  <li key={sl.slot}>
                    <span className="muted" title={sl.who}>
                      {sl.name}:
                    </span>{' '}
                    {t ? (
                      <>
                        <b title={t.note}>{t.name}</b> <EffChips effs={tenetEffs(t)} />
                      </>
                    ) : (
                      <small className="muted">
                        {due === sl.slot ? (
                          'choose below'
                        ) : (
                          <>
                            <Ico name="lock" fallback="🔒" size={14} />{' '}
                            {TECHS[sl.tech!]?.name ?? sl.tech}
                          </>
                        )}
                      </small>
                    )}
                  </li>
                );
              })}
            </ul>
            {due && (
              <>
                <h3 title={`Helps ${TENET_SLOTS.find(x => x.slot === due)!.who}, for good`}>
                  Choose the {TENET_SLOTS.find(x => x.slot === due)!.name.toLowerCase()}
                </h3>
                {tenetCards(due, setDetail)}
              </>
            )}
          </section>
        ) : why ? (
          <p className="small">
            <b>Found a faith:</b> {why}{' '}
            {faiths.length < room && (
              <span className="muted">({room - faiths.length} places left)</span>
            )}
          </p>
        ) : (
          <section className="faith-found">
            <h3>
              Found a faith{' '}
              <small className="muted">
                {room - faiths.length}/{room} places left
              </small>{' '}
              <InfoButton label="About founding">
                Your holy city and nearby settlements take it up at once; then it spreads by itself.
                The founding belief rewards you as it spreads.
              </InfoButton>
            </h3>
            <label className="faith-name">
              Name{' '}
              <input
                value={name}
                maxLength={40}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
              />
            </label>
            <p className="small muted">Founding belief</p>
            {tenetCards('founding', setPick, pick)}
            <button
              className="primary"
              disabled={!pick}
              onClick={() => report(foundFaith(game, civ.id, pick!, name))}
            >
              Found {name || 'the faith'}
            </button>
          </section>
        )}

        <h3>
          Your people{' '}
          <InfoButton label="About faith and peoples">
            Your people's faith's teachings help you. A shared faith warms other peoples to you, a
            different one cools them. Over a third of your people outside your own faith builds
            religious tension, which can end in a schism.
          </InfoButton>
        </h3>
        <p className="small">
          {kept ? (
            <>
              <Ico name="sun" fallback="☀" size={16} /> <b>{kept.name}</b>
              {kept.founder !== civ.id && known(kept.founder)
                ? ` (${game.civs[kept.founder].name})`
                : ''}
            </>
          ) : (
            <span className="muted">No faith yet</span>
          )}
        </p>
        {all > 0 && (
          <div className="faith-bar" aria-label="Your people by faith">
            {[...by.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([f, n]) => (
                <span
                  key={String(f)}
                  style={{
                    width: `${(n / all) * 100}%`,
                    background:
                      f === undefined ? '#d8cdb4' : game.civs[faithById(game, f)!.founder].color,
                  }}
                  title={`${f === undefined ? 'No faith' : faithById(game, f)!.name}: ${Math.round((n / all) * 100)}%`}
                />
              ))}
          </div>
        )}

        <h3>Faiths of the world</h3>
        {faiths.length ? (
          <table className="stats-table">
            <thead>
              <tr>
                <th>Faith</th>
                <th>Founder</th>
                <th>Settlements</th>
                <th>Peoples</th>
                <th>Tenets</th>
              </tr>
            </thead>
            <tbody>
              {faiths.map(f => (
                <tr key={f.id} className={f.id === civ.faith ? 'me' : ''}>
                  <td>
                    <span className="swatch" style={{ background: game.civs[f.founder].color }} />{' '}
                    {f.name}
                  </td>
                  <td>{known(f.founder) ? game.civs[f.founder].name : 'unknown'}</td>
                  <td>{followers(game, f).all}</td>
                  <td>
                    {game.civs.filter(c => c.alive && !c.independent && c.faith === f.id).length}
                  </td>
                  <td>
                    <small>{f.tenets.map(t => TENETS[t]?.name).join(', ')}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted small">None yet.</p>
        )}
      </div>
      {detail && TENETS[detail] && (
        <ChoiceDetail
          title={TENETS[detail].name}
          sub={TENET_SLOTS.find(x => x.slot === TENETS[detail].slot)?.who}
          confirm="Choose"
          onBack={() => setDetail(null)}
          onConfirm={() => {
            report(chooseTenet(game, civ.id, detail));
            setDetail(null);
          }}
        >
          <EffList effs={tenetEffs(TENETS[detail])} />
          {!tenetEffs(TENETS[detail]).length && <p className="small">{TENETS[detail].note}</p>}
        </ChoiceDetail>
      )}
    </div>
  );
}
