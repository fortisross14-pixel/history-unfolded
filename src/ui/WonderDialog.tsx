import { useState } from 'react';
import { ERAS, TECHS } from '../data/techs.ts';
import { WONDER_CULTURE, WONDER_LIST, WONDER_SCORE, WONDERS } from '../data/wonders.ts';
import { rankOf } from '../engine/economy.ts';
import type { Civ, GameState } from '../engine/types.ts';
import {
  builders,
  startWonder,
  stopWonder,
  WONDER_REFUND,
  WONDER_SHARE,
  wonderDone,
  wonderProblem,
} from '../engine/wonders.ts';

const pctText = (x: number) => `${Math.floor(x * 100)}%`;
const raceWord = (x: number) =>
  x >= 0.75 ? 'nearly done' : x >= 0.5 ? 'past half' : x >= 0.25 ? 'well begun' : 'just begun';

/**
 * World wonders, a race: each is built once in the world. Start one in a town or bigger (it pays
 * its goods), then half that settlement's production goes to it until it is done.
 */
export function WonderDialog({
  game,
  civ,
  cityId,
  report,
  onClose,
}: {
  game: GameState;
  civ: Civ;
  /** the settlement to build in, when opened from one */
  cityId?: number;
  report: (r: { ok: boolean; msg?: string }) => void;
  onClose: () => void;
}) {
  const mine = game.cities.filter(c => c.civId === civ.id && rankOf(c.tier) >= rankOf('town'));
  const [where, setWhere] = useState<number | undefined>(
    cityId ?? mine.slice().sort((a, b) => b.pop - a.pop)[0]?.id,
  );
  const here = game.cities.find(c => c.id === where);
  const built = game.wonders ?? [];
  const ages = [1, 2, 3, 4, 5];
  const cityName = (id: number) => game.cities.find(c => c.id === id)?.name ?? 'a lost city';
  const known = (id: number) => id === civ.id || civ.met.includes(id);

  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal wonders"
        role="dialog"
        aria-modal="true"
        aria-label="World wonders"
        onClick={e => e.stopPropagation()}
      >
        <header>
          <h2>
            World wonders{' '}
            <small>
              {built.length} of {WONDER_LIST.length} built
            </small>
          </h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p className="muted small">
          Each wonder stands once in the world: the first to finish takes it, the others get{' '}
          {pctText(WONDER_REFUND)} of their work back as gold. While one is built,{' '}
          {pctText(WONDER_SHARE)} of that settlement's production goes to it (all of it when nothing
          else is queued). Each brings +{WONDER_CULTURE} culture a turn and {WONDER_SCORE} score,
          and goes with its city if it changes hands.
        </p>
        {mine.length > 0 ? (
          <label className="wonder-where">
            Build in{' '}
            <select value={where} onChange={e => setWhere(Number(e.target.value))}>
              {mine.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.wonder ? ` (building the ${WONDERS[c.wonder.id].name})` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="small">Wonders are built in a town or bigger: grow a settlement first.</p>
        )}

        {ages.map(age => {
          const list = WONDER_LIST.filter(w => TECHS[w.tech]?.era === age);
          if (!list.length) return null;
          return (
            <section key={age}>
              <h3>{ERAS[age]}</h3>
              <div className="wonder-grid">
                {list.map(w => {
                  const done = wonderDone(game, w.id);
                  const race = builders(game, w.id);
                  const ours = race.find(b => b.city.civId === civ.id);
                  const rivals = race.filter(b => b.city.civId !== civ.id);
                  const why = here ? wonderProblem(game, here.id, w.id) : 'Choose a settlement.';
                  const holder = done && game.cities.find(c => c.id === done.cityId);
                  return (
                    <div
                      key={w.id}
                      className={`wonder ${done ? 'done' : ''} ${ours ? 'ours' : ''} ${holder && holder.civId === civ.id ? 'held' : ''}`}
                    >
                      <b>{w.name}</b>
                      <small>{w.note}</small>
                      <small className="muted">
                        {TECHS[w.tech]?.name} · {w.prod} production ·{' '}
                        {Object.entries(w.goods)
                          .map(([k, n]) => `${n} ${k}`)
                          .join(', ')}
                        {w.coast ? ' · by the sea' : ''}
                      </small>
                      {done ? (
                        <small>
                          <b>
                            Built turn {done.turn} in {cityName(done.cityId)}
                          </b>
                          {holder && holder.civId !== civ.id
                            ? ` · ${known(holder.civId) ? `the ${game.civs[holder.civId].name}` : 'a distant people'}`
                            : holder
                              ? ' · yours'
                              : ''}
                        </small>
                      ) : (
                        <>
                          {ours && (
                            <>
                              <span className="trk-bar">
                                <i style={{ width: pctText(ours.share) }} />
                              </span>
                              <small>
                                {ours.city.name}: {pctText(ours.share)}{' '}
                                <button
                                  className="link"
                                  onClick={() => report(stopWonder(game, ours.city.id))}
                                >
                                  stop
                                </button>
                              </small>
                            </>
                          )}
                          {rivals.length > 0 && (
                            <small className="bad">
                              Racing:{' '}
                              {rivals
                                .map(
                                  b =>
                                    `${known(b.city.civId) ? `the ${game.civs[b.city.civId].name}` : 'someone'} (${raceWord(b.share)})`,
                                )
                                .join(', ')}
                            </small>
                          )}
                          {!ours && (
                            <button
                              className="small"
                              disabled={!!why}
                              title={why ?? undefined}
                              onClick={() => report(startWonder(game, where!, w.id))}
                            >
                              {why
                                ? why
                                : here?.wonder
                                  ? `Switch ${here.name} to it (its ${WONDERS[here.wonder.id].name} work is lost)`
                                  : `Build in ${here?.name}`}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
