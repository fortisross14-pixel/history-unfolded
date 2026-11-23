import { useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_SHIP,
  ITEM_LIST,
  ITEMS,
  NAVAL_SLOT_NAMES,
  NAVAL_SLOTS,
  SLOT_NAMES,
  SLOTS,
  type Loadout,
  type Slot,
} from '../data/items.ts';
import { TECHS } from '../data/techs.ts';
import { DEFAULT_LOADOUT } from '../data/items.ts';
import { deleteDesign, refit, saveDesign, type Result } from '../engine/game.ts';
import type { GameState } from '../engine/types.ts';
import {
  cohortStats,
  loadoutCost,
  loadoutProblem,
  ROLE_NAMES,
  spriteForLoadout,
  artKeyForLoadout,
} from '../engine/units.ts';
import { Art, Goods, Ico, InfoButton, UnitPortrait } from './bits.tsx';
import './declutter-world.css';

/** A small stat: icon and value, the stat's name on hover. */
function S({
  icon,
  fb,
  t,
  children,
}: {
  icon: string;
  fb: string;
  t: string;
  children: ReactNode;
}) {
  return (
    <span className="chip w-s" title={t} aria-label={t}>
      <Ico name={icon} fallback={fb} size={14} />
      <b>{children}</b>
    </span>
  );
}

interface Props {
  game: GameState;
  civId: number;
  /** design to open first; 'new' starts a blank one */
  open?: number | 'new';
  onClose: (savedId?: number) => void;
  report: (r: Result) => void;
}

/** The army designs screen: create named unit types from equipment, edit or retire them. */
export function DesignsDialog({ game, civId, open, onClose, report }: Props) {
  const civ = game.civs[civId];
  const [editing, setEditing] = useState<number | 'new'>(open ?? 'new');
  // the roster of designs first; the editor when one is picked (or asked for)
  const [view, setView] = useState<'roster' | 'edit'>(open === undefined ? 'roster' : 'edit');
  const [, bump] = useState(0);
  const current = editing === 'new' ? undefined : civ.designs.find(d => d.id === editing);
  const [name, setName] = useState(current?.name ?? '');
  const [l, setL] = useState<Loadout>({ ...(current?.loadout ?? DEFAULT_LOADOUT) });
  const [sea, setSea] = useState<boolean>(!!current?.naval);
  // only gear this people can make: research brings the rest
  const usable = (slot: Slot) =>
    ITEM_LIST.filter(
      i =>
        i.slot === slot &&
        !!i.naval === sea &&
        (!i.tech || civ.techs.includes(i.tech) || l[slot] === i.id),
    );
  const slotList = (sea ? NAVAL_SLOTS : SLOTS).filter(sl => usable(sl).length > 1);
  const hiddenSlots = (sea ? NAVAL_SLOTS : SLOTS).filter(sl => usable(sl).length <= 1);
  const lockedCount = ITEM_LIST.filter(
    i => !!i.naval === sea && i.tech && !civ.techs.includes(i.tech),
  ).length;
  const slotName = (k: Slot) => (sea ? NAVAL_SLOT_NAMES[k]! : SLOT_NAMES[k]);
  const switchSea = (v: boolean) => {
    setSea(v);
    setEditing('new');
    setName('');
    setL({ ...(v ? DEFAULT_SHIP : DEFAULT_LOADOUT) });
  };
  const [lastSaved, setLastSaved] = useState<number | undefined>();

  const sameGear = (a: Loadout, b: Loadout) => (Object.keys(a) as Slot[]).every(k => a[k] === b[k]);
  /** every cohort of this people under a design, and those still on older gear */
  const usage = (id: number) => {
    let cohorts = 0,
      old = 0;
    const formations = new Set<number>();
    const d = civ.designs.find(x => x.id === id);
    for (const f of game.formations) {
      if (f.civId !== civId) continue;
      for (const c of f.cohorts)
        if (c.designId === id) {
          cohorts++;
          formations.add(f.id);
          if (d && !sameGear(c.loadout, d.loadout)) old++;
        }
    }
    return { cohorts, formations: formations.size, old };
  };
  const levyCohorts = game.formations
    .filter(f => f.civId === civId && f.kind === 'army')
    .reduce((n, f) => n + f.cohorts.filter(c => c.designId == null).length, 0);
  /** re-equip every cohort still on an older version of the design, formation by formation */
  const upgradeAll = (id: number) => {
    const d = civ.designs.find(x => x.id === id);
    if (!d) return;
    let done = 0;
    const failed: string[] = [];
    for (const f of game.formations) {
      if (f.civId !== civId) continue;
      const ids = f.cohorts
        .filter(c => c.designId === id && !sameGear(c.loadout, d.loadout))
        .map(c => c.id);
      if (!ids.length) continue;
      const res = refit(game, f.id, ids, d.loadout);
      if (res.ok) done += ids.length;
      else failed.push(`${f.name}: ${res.msg}`);
    }
    report({
      ok: done > 0,
      msg:
        (done
          ? `${done} cohort${done === 1 ? '' : 's'} re-equipped as ${d.name}.`
          : 'Nothing re-equipped.') + (failed.length ? ` Not yet: ${failed.join(' ')}` : ''),
    });
    bump(v => v + 1);
  };
  const retire = (id: number) => {
    const d = civ.designs.find(x => x.id === id);
    if (!d || !window.confirm(`Retire ${d.name}? Its troops keep their gear.`)) return;
    report(deleteDesign(game, civId, id));
    bump(v => v + 1);
  };

  const pick = (id: number | 'new') => {
    setView('edit');
    const d = id === 'new' ? undefined : civ.designs.find(x => x.id === id);
    setEditing(id);
    setName(d?.name ?? '');
    setL({ ...(d?.loadout ?? (sea ? DEFAULT_SHIP : DEFAULT_LOADOUT)) });
  };
  const problem = loadoutProblem(l, civ.techs);
  const st = cohortStats(l);
  const cost = useMemo(() => loadoutCost(l), [l]);
  const inUse = (id: number) =>
    game.formations
      .filter(f => f.civId === civId)
      .reduce((n, f) => n + f.cohorts.filter(c => c.designId === id).length, 0);

  const save = (asNew: boolean) => {
    const r = saveDesign(game, civId, name, l, asNew ? undefined : current?.id);
    report(r);
    if (r.ok && r.id) {
      setLastSaved(r.id);
      setEditing(r.id);
    }
  };

  return (
    <div className="modal-back" onClick={() => onClose(lastSaved)}>
      <div className="modal designs" onClick={e => e.stopPropagation()}>
        <header>
          <h2>Unit designs</h2>
          <button className="x" onClick={() => onClose(lastSaved)}>
            ×
          </button>
        </header>
        {view === 'roster' ? (
          <div className="design-roster">
            <div className="roster-bar">
              <div className="land-sea">
                <button className={!sea ? 'on' : ''} onClick={() => switchSea(false)}>
                  Troops
                </button>
                <button className={sea ? 'on' : ''} onClick={() => switchSea(true)}>
                  Ships
                </button>
              </div>
              <button className="design-row new-design primary" onClick={() => pick('new')}>
                <b>+ New design</b>
              </button>
            </div>
            <table className="roster-table">
              <thead>
                <tr>
                  <th>Design</th>
                  <th title="Melee · ranged · moves">Strength</th>
                  <th title="Cohorts with this design">
                    <Ico name="army" fallback="⚔" size={16} />
                  </th>
                  <th title="Formations with them">
                    <Ico name="cities" fallback="⛺" size={16} />
                  </th>
                  <th title="Cohorts still on older gear">Old gear</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {civ.designs
                  .filter(d => !!d.naval === sea)
                  .map(d => {
                    const u = usage(d.id);
                    const st2 = cohortStats(d.loadout);
                    return (
                      <tr key={d.id}>
                        <td>
                          <button className="roster-name" onClick={() => pick(d.id)}>
                            <UnitPortrait
                              sprite={spriteForLoadout(d.loadout)}
                              art={artKeyForLoadout(d.loadout)}
                              color={civ.color}
                              small
                            />
                            <span>
                              <b>{d.name}</b>
                              <small>{ROLE_NAMES[st2.role]}</small>
                            </span>
                          </button>
                        </td>
                        <td className="roster-stats">
                          <span className="chip" title="Melee">
                            <Ico name="melee" fallback="⚔" size={16} /> {st2.melee}
                          </span>
                          {st2.ranged > 0 && (
                            <span className="chip" title="Ranged">
                              <Ico name="ranged" fallback="➶" size={16} /> {st2.ranged}
                            </span>
                          )}
                          <span className="chip" title="Moves">
                            <Ico name="moves" fallback="»" size={16} /> {st2.moves}
                          </span>
                        </td>
                        <td>{u.cohorts}</td>
                        <td>{u.formations}</td>
                        <td>
                          {u.old ? (
                            <button
                              className="small"
                              title="Re-equip them near your cities, paying only for the new gear"
                              onClick={() => upgradeAll(d.id)}
                            >
                              Upgrade {u.old}
                            </button>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td className="roster-actions">
                          <button className="small" onClick={() => pick(d.id)}>
                            Edit
                          </button>
                          <button className="link small" onClick={() => retire(d.id)}>
                            Retire
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                {!sea && levyCohorts > 0 && (
                  <tr className="muted">
                    <td>
                      <span className="roster-name">
                        <span>
                          <b>Levy</b>
                          <small>No design yet</small>
                        </span>
                      </span>
                    </td>
                    <td />
                    <td>{levyCohorts}</td>
                    <td />
                    <td />
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
            {!civ.designs.some(d => !!d.naval === sea) && (
              <p className="muted">No {sea ? 'ship' : 'troop'} designs yet.</p>
            )}
          </div>
        ) : (
          <div className="designs-body">
            <nav className="design-list">
              <button className="link small roster-back" onClick={() => setView('roster')}>
                ← All designs
              </button>
              <div className="land-sea">
                <button className={!sea ? 'on' : ''} onClick={() => switchSea(false)}>
                  Troops
                </button>
                <button className={sea ? 'on' : ''} onClick={() => switchSea(true)}>
                  Ships
                </button>
              </div>
              <button
                className={`design-row ${editing === 'new' ? 'on' : ''}`}
                onClick={() => pick('new')}
              >
                <b>+ New design</b>
              </button>
              {civ.designs
                .filter(d => !!d.naval === sea)
                .map(d => (
                  <button
                    key={d.id}
                    className={`design-row ${editing === d.id ? 'on' : ''}`}
                    onClick={() => pick(d.id)}
                  >
                    <UnitPortrait
                      sprite={spriteForLoadout(d.loadout)}
                      art={artKeyForLoadout(d.loadout)}
                      color={civ.color}
                      small
                    />
                    <span>
                      <b>{d.name}</b>
                      <small>
                        {ROLE_NAMES[cohortStats(d.loadout).role]} · {inUse(d.id)} cohort
                        {inUse(d.id) === 1 ? '' : 's'}
                      </small>
                    </span>
                  </button>
                ))}
            </nav>

            <div className="design-editor">
              <div className="row name-row">
                <UnitPortrait
                  sprite={spriteForLoadout(l)}
                  art={artKeyForLoadout(l)}
                  color={civ.color}
                />
                <input
                  className="design-name"
                  placeholder="Name"
                  value={name}
                  maxLength={28}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              {slotList.map((slot: Slot) => (
                <div key={slot} className="slot">
                  <h3>{slotName(slot)}</h3>
                  <div className="items">
                    {usable(slot).map(it => {
                      const locked = !!it.tech && !civ.techs.includes(it.tech);
                      const on = l[slot] === it.id;
                      const clash =
                        slot === 'shield' &&
                        !it.empty &&
                        (ITEM_LIST.find(x => x.id === l.weapon)?.twoHanded ?? false);
                      return (
                        <button
                          key={it.id}
                          className={`item ${on ? 'on' : ''} ${locked ? 'locked' : ''}`}
                          disabled={locked}
                          title={locked ? `Needs ${TECHS[it.tech!].name}` : it.note}
                          onClick={() => {
                            const next = { ...l, [slot]: it.id };
                            // picking a two-handed weapon drops the shield
                            if (slot === 'weapon' && it.twoHanded) next.shield = 'no-shield';
                            setL(next);
                          }}
                        >
                          <Art k={`item/${it.id}`} size={44} className="item-art" />
                          <b>{it.name}</b>
                          {locked ? (
                            <small>
                              <Ico name="lock" fallback="🔒" size={12} /> {TECHS[it.tech!].name}
                            </small>
                          ) : (
                            <span className="w-stats-sm">
                              {it.attack ? (
                                <S
                                  icon={it.ranged ? 'bow' : 'sword'}
                                  fb={it.ranged ? '➶' : '⚔'}
                                  t={`${it.ranged ? 'Ranged' : 'Melee'} attack, ${it.damage}`}
                                >
                                  {it.attack} <small>{it.damage}</small>
                                </S>
                              ) : null}
                              {Object.entries(it.protection ?? {}).map(([k, v]) => (
                                <S key={k} icon="shield" fb="⛨" t={`Protection against ${k}`}>
                                  {v} <small>{k}</small>
                                </S>
                              ))}
                              {it.move ? (
                                <S icon="boot" fb="👣" t="Moves">
                                  {slot === 'mount' ? it.move : '+' + it.move}
                                </S>
                              ) : null}
                              {it.morale ? (
                                <S icon="flag" fb="⚑" t="Morale">
                                  +{it.morale}
                                </S>
                              ) : null}
                              {it.charge ? (
                                <S icon="charge" fb="»" t="Charge">
                                  {it.charge}
                                </S>
                              ) : null}
                              {it.antiCharge ? (
                                <S icon="target" fb="⊥" t="Anti-charge">
                                  {it.antiCharge}
                                </S>
                              ) : null}
                              {it.weight ? (
                                <S icon="anvil" fb="⚖" t="Weight">
                                  {it.weight}
                                </S>
                              ) : null}
                              {clash && (
                                <small className="bad" title="Not with a two-handed weapon">
                                  ✕ 2-handed
                                </small>
                              )}
                            </span>
                          )}
                          <span className="cost">
                            <Goods goods={it.cost} empty="free" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {lockedCount > 0 && (
                <p
                  className="muted small more-gear"
                  title={
                    hiddenSlots.length
                      ? `Among them the first ${hiddenSlots.map(sl => slotName(sl).toLowerCase() + 's').join(' and ')}`
                      : undefined
                  }
                >
                  <Ico name="lock" fallback="🔒" size={12} /> +{lockedCount} from research
                </p>
              )}
            </div>

            <aside className="loadout-side">
              <h3 title={sea ? 'Each ship: 50 crew' : 'Each cohort: 100 people'}>
                {sea ? 'Ship · 50 crew' : 'Cohort · 100'}
              </h3>
              <div className="w-stats">
                <span className="w-tag">{ROLE_NAMES[st.role]}</span>
                {sea && (
                  <>
                    <S icon="crate" fb="▣" t="Cohorts it carries">
                      {(ITEMS[l.armour].capacity ?? 0) + (ITEMS[l.kit].capacity ?? 0)}
                    </S>
                    <span
                      className="w-tag"
                      title={ITEMS[l.armour].ocean ? 'Crosses open ocean' : 'Coast only'}
                    >
                      {ITEMS[l.armour].ocean ? 'Ocean' : 'Coast'}
                    </span>
                  </>
                )}
                <S icon="sword" fb="⚔" t={`Melee, ${st.damage}`}>
                  {st.melee} <small>{st.damage}</small>
                </S>
                {st.ranged ? (
                  <S icon="bow" fb="➶" t={`Ranged, ${st.rangedDamage}`}>
                    {st.ranged} <small>{st.rangedDamage}</small>
                  </S>
                ) : null}
                {st.charge ? (
                  <S icon="charge" fb="»" t="Charge">
                    {st.charge}
                  </S>
                ) : null}
                {st.antiCharge ? (
                  <S icon="target" fb="⊥" t="Anti-charge">
                    {st.antiCharge}
                  </S>
                ) : null}
                {st.morale ? (
                  <S icon="flag" fb="⚑" t="Morale">
                    +{st.morale}
                  </S>
                ) : null}
                <S icon="boot" fb="👣" t={`Moves (weight ${st.weight})`}>
                  {st.moves}
                </S>
                <S icon="coin" fb="🪙" t="Upkeep, gold a turn">
                  {st.upkeep}/t
                </S>
              </div>
              <div className="w-stats" title="Protection">
                {(['cut', 'pierce', 'crush', 'missile'] as const).map(k => (
                  <S key={k} icon="shield" fb="⛨" t={`Protection against ${k}`}>
                    {st.protection[k]} <small>{k}</small>
                  </S>
                ))}
              </div>
              <div className="w-stats" title="Gear per cohort">
                <Goods goods={cost} empty="free" />
              </div>
              {problem && <p className="bad">{problem}</p>}
              <button
                className="primary wide"
                disabled={!!problem || !name.trim()}
                onClick={() => save(false)}
              >
                {current ? `Save ${name.trim() || 'design'}` : 'Create design'}
              </button>
              {current && (
                <div className="row" style={{ marginTop: 6 }}>
                  <button
                    disabled={!!problem || !name.trim() || name.trim() === current.name}
                    onClick={() => save(true)}
                  >
                    Save as new
                  </button>
                  <button
                    onClick={() => {
                      report(deleteDesign(game, civId, current.id));
                      pick(civ.designs[0]?.id ?? 'new');
                    }}
                  >
                    Retire
                  </button>
                </div>
              )}
              <p className="w-foot">
                <InfoButton label="About designs">
                  <span>A change does not re-arm troops in the field: they show as outdated.</span>
                  <span>
                    Mixed formations win: front line screens archers, cavalry flanks, spears stop
                    charges.
                  </span>
                </InfoButton>
              </p>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
