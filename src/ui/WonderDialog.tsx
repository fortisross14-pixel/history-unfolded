import { useState } from 'react';
import { ERAS, TECHS } from '../data/techs.ts';
import { WONDER_CULTURE, WONDER_LIST, WONDER_SCORE, WONDERS } from '../data/wonders.ts';
import { rankOf } from '../engine/economy.ts';
import type { Civ, GameState } from '../engine/types.ts';
import { Art, GoodIcon, Ico, InfoButton } from './bits.tsx';
import { EffChips, modEffs } from './NationDialog.tsx';
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
              {built.length}/{WONDER_LIST.length} built
            </small>{' '}
            <InfoButton label="About wonders">
              Each stands once in the world: the first to finish takes it; the others get{' '}
              {pctText(WONDER_REFUND)} of their work back as gold. While building,{' '}
              {pctText(WONDER_SHARE)} of the settlement's production goes to it (all of it when
              nothing else is queued). Each brings +{WONDER_CULTURE} culture a turn and{' '}
              {WONDER_SCORE} score, and goes with its city. Needs a town or bigger.
            </InfoButton>
          </h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
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
          <p className="small muted">Needs a town or bigger.</p>
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
                      <span className="wd-head" title={w.note}>
                        <Art
                          k={`wonder/${w.id}`}
                          size={32}
                          fallback={<Art k={`tech/${w.tech}`} size={32} />}
                        />
                        <b>{w.name}</b>
                      </span>
                      <span className="chips wd-cost" title="Cost">
                        <span className="chip" title={`${w.prod} production`}>
                          <Ico name="production" fallback="⚒" size={16} /> <b>{w.prod}</b>
                        </span>
                        {Object.entries(w.goods).map(([k, n]) => (
                          <span key={k} className="chip" title={`${n} ${k}`}>
                            <GoodIcon id={k} size={16} /> <b>{n}</b>
                          </span>
                        ))}
                        {w.coast && (
                          <span className="chip" title="Needs the coast">
                            <Ico name="drop" fallback="≈" size={16} />
                          </span>
                        )}
                        <span className="chip muted" title={`Opened by ${TECHS[w.tech]?.name}`}>
                          <Ico name="research" fallback="⚗" size={14} />
                          <small>{TECHS[w.tech]?.name}</small>
                        </span>
                      </span>
                      <EffChips effs={modEffs(w.mods)} />
                      {done ? (
                        <small>
                          <b>
                            <Ico name="check" fallback="✓" size={14} /> {cityName(done.cityId)},
                            turn {done.turn}
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
                              <Ico name="warning" fallback="!" size={14} />{' '}
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
                              title={
                                why ??
                                (here?.wonder
                                  ? `Switch ${here.name} to it: its ${WONDERS[here.wonder.id].name} work is lost`
                                  : `Build in ${here?.name}`)
                              }
                              onClick={() => report(startWonder(game, where!, w.id))}
                            >
                              {why ? why : here?.wonder ? 'Switch' : 'Build'}
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
