import { useMemo, useState } from 'react';
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
import { deleteDesign, saveDesign, type Result } from '../engine/game.ts';
import type { GameState } from '../engine/types.ts';
import {
  cohortStats,
  loadoutCost,
  loadoutProblem,
  ROLE_NAMES,
  spriteForLoadout,
} from '../engine/units.ts';
import { Goods, UnitPortrait } from './bits.tsx';

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
  const current = editing === 'new' ? undefined : civ.designs.find(d => d.id === editing);
  const [name, setName] = useState(current?.name ?? '');
  const [l, setL] = useState<Loadout>({ ...(current?.loadout ?? DEFAULT_LOADOUT) });
  const [sea, setSea] = useState<boolean>(!!current?.naval);
  const slotList = sea ? NAVAL_SLOTS : SLOTS;
  const slotName = (k: Slot) => (sea ? NAVAL_SLOT_NAMES[k]! : SLOT_NAMES[k]);
  const switchSea = (v: boolean) => {
    setSea(v);
    setEditing('new');
    setName('');
    setL({ ...(v ? DEFAULT_SHIP : DEFAULT_LOADOUT) });
  };
  const [lastSaved, setLastSaved] = useState<number | undefined>();

  const pick = (id: number | 'new') => {
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
          <h2>
            Unit designs{' '}
            <small>Name a unit type, give it its gear, then assign cohorts to it.</small>
          </h2>
          <button className="x" onClick={() => onClose(lastSaved)}>
            ×
          </button>
        </header>
        <div className="designs-body">
          <nav className="design-list">
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
                  <UnitPortrait sprite={spriteForLoadout(d.loadout)} color={civ.color} small />
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
              <UnitPortrait sprite={spriteForLoadout(l)} color={civ.color} />
              <input
                className="design-name"
                placeholder="Name it: Hoplites, Foot Falcons, Iron Wall…"
                value={name}
                maxLength={28}
                onChange={e => setName(e.target.value)}
              />
            </div>
            {slotList.map((slot: Slot) => (
              <div key={slot} className="slot">
                <h3>{slotName(slot)}</h3>
                <div className="items">
                  {ITEM_LIST.filter(i => i.slot === slot && !!i.naval === sea).map(it => {
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
                                ? ` Prot ${Object.entries(it.protection)
                                    .map(([k, v]) => `${k} ${v}`)
                                    .join(', ')}`
                                : ''}
                              {it.move ? ` Move ${slot === 'mount' ? it.move : '+' + it.move}` : ''}
                              {it.morale ? ` Morale +${it.morale}` : ''}
                              {it.charge ? ` Charge ${it.charge}` : ''}
                              {it.antiCharge ? ` Anti-charge ${it.antiCharge}` : ''}
                              {it.weight ? ` · wt ${it.weight}` : ''}
                              {clash ? ' · not with a two-handed weapon' : ''}
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
            <h3>{sea ? 'Each ship (50 crew)' : 'Each cohort (100 people)'}</h3>
            {sea && (
              <p className="small">
                Carries {(ITEMS[l.armour].capacity ?? 0) + (ITEMS[l.kit].capacity ?? 0)} cohorts ·{' '}
                {ITEMS[l.armour].ocean ? 'crosses open ocean' : 'coast only'}
              </p>
            )}
            <table className="stats">
              <tbody>
                <tr>
                  <td>Role</td>
                  <td>{ROLE_NAMES[st.role]}</td>
                </tr>
                <tr>
                  <td>Melee</td>
                  <td>
                    {st.melee} {st.damage}
                  </td>
                </tr>
                <tr>
                  <td>Ranged</td>
                  <td>{st.ranged ? `${st.ranged} ${st.rangedDamage}` : '—'}</td>
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
                  <td>Morale</td>
                  <td>{st.morale ? `+${st.morale}` : '—'}</td>
                </tr>
                <tr>
                  <td>Moves</td>
                  <td>
                    {st.moves} <small>(weight {st.weight})</small>
                  </td>
                </tr>
                <tr>
                  <td>Upkeep</td>
                  <td>{st.upkeep} gold/turn</td>
                </tr>
                <tr>
                  <td>Gear</td>
                  <td>
                    <Goods goods={cost} empty="free" />
                  </td>
                </tr>
              </tbody>
            </table>
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
            <p className="muted small">
              Changing a design does not re-arm troops already in the field: their cohorts show as
              outdated until you re-equip them. Mixing designs in one formation is what wins
              battles: a front line screens archers, cavalry flanks, spears stop charges.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
