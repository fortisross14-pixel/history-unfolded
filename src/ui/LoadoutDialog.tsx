import { useMemo, useState } from 'react';
import { ITEM_LIST, ITEMS, SLOT_NAMES, SLOTS, type Loadout, type Slot } from '../data/items.ts';
import { TECHS } from '../data/techs.ts';
import { deleteTemplate, refitPreview, saveTemplate } from '../engine/game.ts';
import type { GameState } from '../engine/types.ts';
import { cohortStats, loadoutProblem } from '../engine/units.ts';
import { Goods } from './bits.tsx';

interface Props {
  game: GameState;
  fid: number;
  cohortIds: number[];
  start: Loadout;
  onApply: (l: Loadout) => void;
  onClose: () => void;
  bump: () => void;
}

/** Pick one item per slot for the selected cohorts, see the cost, save as a template. */
export function LoadoutDialog({ game, fid, cohortIds, start, onApply, onClose, bump }: Props) {
  const [l, setL] = useState<Loadout>({ ...start });
  const [tname, setTname] = useState('');
  const f = game.formations.find(x => x.id === fid)!;
  const civ = game.civs[f.civId];
  const problem = loadoutProblem(l, civ.techs);
  const preview = useMemo(() => refitPreview(game, fid, cohortIds, l), [game, fid, cohortIds, l]);
  const st = cohortStats(l);
  const missing = new Set(preview.problem === null ? preview.missing.map(m => m.good) : []);
  const n = cohortIds.length;

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal loadout" onClick={e => e.stopPropagation()}>
        <header>
          <h2>
            Equip {n} cohort{n === 1 ? '' : 's'}{' '}
            <small>
              ({n * 100} people) · {f.name}
            </small>
          </h2>
          <button className="x" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="loadout-body">
          <div className="slots">
            {SLOTS.map((slot: Slot) => (
              <div key={slot} className="slot">
                <h3>{SLOT_NAMES[slot]}</h3>
                <div className="items">
                  {ITEM_LIST.filter(i => i.slot === slot).map(it => {
                    const locked = !!it.tech && !civ.techs.includes(it.tech);
                    const on = l[slot] === it.id;
                    return (
                      <button
                        key={it.id}
                        className={`item ${on ? 'on' : ''} ${locked ? 'locked' : ''}`}
                        disabled={locked}
                        title={locked ? `Needs ${TECHS[it.tech!].name}` : it.note}
                        onClick={() => setL({ ...l, [slot]: it.id })}
                      >
                        <b>{it.name}</b>
                        <small>
                          {locked ? (
                            `🔒 ${TECHS[it.tech!].name}`
                          ) : (
                            <>
                              {it.attack
                                ? `${it.ranged ? 'Ranged' : 'Melee'} ${it.attack} ${it.damage}`
                                : ''}
                              {it.protection && Object.keys(it.protection).length
                                ? `Prot ${Object.entries(it.protection)
                                    .map(([k, v]) => `${k[0].toUpperCase()}${v}`)
                                    .join(' ')}`
                                : ''}
                              {it.move ? ` Move ${slot === 'mount' ? it.move : '+' + it.move}` : ''}
                              {it.weight ? ` · wt ${it.weight}` : ''}
                            </>
                          )}
                        </small>
                        <span className="cost">
                          <Goods goods={it.cost} empty="free" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <aside className="loadout-side">
            <h3>Each cohort</h3>
            <table className="stats">
              <tbody>
                <tr>
                  <td>Melee</td>
                  <td>
                    {st.melee} <small>{st.ranged ? '' : st.damage}</small>
                  </td>
                </tr>
                <tr>
                  <td>Ranged</td>
                  <td>{st.ranged || '—'}</td>
                </tr>
                <tr>
                  <td>Charge</td>
                  <td>{st.charge || '—'}</td>
                </tr>
                <tr>
                  <td>Anti-charge</td>
                  <td>{st.antiCharge || '—'}</td>
                </tr>
                <tr>
                  <td>Protection</td>
                  <td>
                    cut {st.protection.cut} · pierce {st.protection.pierce} · crush{' '}
                    {st.protection.crush} · missile {st.protection.missile}
                  </td>
                </tr>
                <tr>
                  <td>Moves</td>
                  <td>
                    {st.moves} <small>weight {st.weight}</small>
                  </td>
                </tr>
                <tr>
                  <td>Upkeep</td>
                  <td>{st.upkeep} gold/turn</td>
                </tr>
              </tbody>
            </table>
            <h3>Cost for {n}</h3>
            {preview.problem !== null ? (
              <p className="bad">{preview.problem}</p>
            ) : (
              <>
                <p>
                  From <b>{preview.city.name}</b>
                  {preview.far ? ' (+50%, away from the city)' : ''}
                </p>
                <p>
                  Pay: <Goods goods={preview.cost} empty="nothing" missing={missing} />
                </p>
                <p>
                  Returned: <Goods goods={preview.refund} empty="nothing" />
                </p>
                <p>
                  In store: <Goods goods={preview.city.stockpile} empty="empty" />
                </p>
                {preview.missing.length > 0 && (
                  <p className="bad">
                    Short of {preview.missing.map(m => `${m.need - m.have} ${m.good}`).join(', ')}
                  </p>
                )}
              </>
            )}
            <button
              className="primary wide"
              disabled={!!problem || preview.problem !== null || preview.missing.length > 0}
              onClick={() => onApply(l)}
            >
              Equip {n * 100} people
            </button>
            <p className="muted small">Re-equipping uses the formation's moves for this turn.</p>

            <h3>Templates</h3>
            {civ.templates.length === 0 && <p className="muted small">None yet.</p>}
            <div className="templates">
              {civ.templates.map(t => (
                <span key={t.name} className="template">
                  <button
                    onClick={() => setL({ ...t.loadout })}
                    title={SLOTS.map(s => ITEMS[t.loadout[s]].name).join(', ')}
                  >
                    {t.name}
                  </button>
                  <button
                    className="x small"
                    onClick={() => {
                      deleteTemplate(game, civ.id, t.name);
                      bump();
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="row">
              <input
                placeholder="Template name"
                value={tname}
                maxLength={24}
                onChange={e => setTname(e.target.value)}
              />
              <button
                disabled={!tname.trim()}
                onClick={() => {
                  saveTemplate(game, civ.id, tname, l);
                  setTname('');
                  bump();
                }}
              >
                Save
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
