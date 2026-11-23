import { useState } from 'react';
import { TECHS } from '../data/techs.ts';
import { TENETS, TENET_SLOTS, tenetsFor, type TenetSlot } from '../data/faiths.ts';
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
          <b>{t.name}</b>
          <small>{t.note}</small>
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
            <p className="small">
              Founded turn {own.founded} in <b>{holyName(own.holy)}</b>, the holy city.{' '}
              {(n => (n === 1 ? '1 settlement keeps it' : `${n} settlements keep it`))(
                followers(game, own).all,
              )}
              , {followers(game, own).foreign} of them abroad.
              {inc.gold || inc.culture ? (
                <>
                  {' '}
                  It brings you{' '}
                  {[
                    inc.gold ? `+${Math.round(inc.gold * 10) / 10} gold` : '',
                    inc.culture ? `+${inc.culture} culture` : '',
                  ]
                    .filter(Boolean)
                    .join(' and ')}{' '}
                  a turn.
                </>
              ) : null}
            </p>
            <ul className="tenet-list">
              {TENET_SLOTS.map(sl => {
                const t = own.tenets.map(id => TENETS[id]).find(x => x?.slot === sl.slot);
                return (
                  <li key={sl.slot}>
                    <span className="muted">{sl.name}:</span>{' '}
                    {t ? (
                      <>
                        <b>{t.name}</b> <small className="muted">{t.note}</small>
                      </>
                    ) : (
                      <small className="muted">
                        {due === sl.slot
                          ? 'choose below'
                          : `opens with ${TECHS[sl.tech!]?.name ?? sl.tech}`}{' '}
                        ({sl.who})
                      </small>
                    )}
                  </li>
                );
              })}
            </ul>
            {due && (
              <>
                <h3>Choose the {TENET_SLOTS.find(x => x.slot === due)!.name.toLowerCase()}</h3>
                <p className="muted small">
                  It helps {TENET_SLOTS.find(x => x.slot === due)!.who}, for good.
                </p>
                {tenetCards(due, id => report(chooseTenet(game, civ.id, id)))}
              </>
            )}
          </section>
        ) : why ? (
          <p className="small">
            <b>Founding a faith:</b> {why}{' '}
            {faiths.length < room && (
              <span className="muted">
                The world has room for {room - faiths.length} more; the first to found one take the
                places.
              </span>
            )}
          </p>
        ) : (
          <section className="faith-found">
            <h3>Found a faith</h3>
            <p className="muted small">
              {room - faiths.length} of {room} places left. Your holy city and nearby settlements
              take it up at once; then it spreads by itself.
            </p>
            <label className="faith-name">
              Name{' '}
              <input
                value={name}
                maxLength={40}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
              />
            </label>
            <p className="small">Its founding belief (rewards you as it spreads):</p>
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

        <h3>Your people</h3>
        <p className="small">
          {kept ? (
            <>
              Keep <b>{kept.name}</b>
              {kept.founder !== civ.id && known(kept.founder)
                ? `, the faith of the ${game.civs[kept.founder].name}`
                : ''}
              : its teachings help you.{' '}
            </>
          ) : (
            <>Keep no one faith yet. </>
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
        <p className="muted small">
          A shared faith warms other peoples to you, a different one cools them. A realm split
          between faiths (over a third of its people outside its own) builds religious tension,
          which can end in a schism.
        </p>

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
          <p className="muted small">No faith has been founded yet.</p>
        )}
      </div>
    </div>
  );
}
