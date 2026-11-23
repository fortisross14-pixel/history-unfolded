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
import { deleteDesign, saveDesign, type Result } from '../engine/game.ts';
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
          <h2>Unit designs</h2>
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
      </div>
    </div>
  );
}
