import { useMemo, useState } from 'react';
import { Icon } from './icons.tsx';
import { DEPOSITS, GOODS, SPECIAL_MIN } from '../data/goods.ts';
import {
  GROUPS,
  MIN_HOUSING,
  SLOT_LIST,
  SLOT_TYPES,
  type SlotGroup,
  type Yield,
} from '../data/slots.ts';
import { RELIEF, TERRAIN, VEGETATION } from '../data/terrain.ts';
import {
  cityDistricts,
  cityEconomy,
  constructionQueue,
  DISTRICT_CAP,
  districtKind,
  isCentre,
  landOf,
  marketCities,
  TIER_BONUS,
  TIER_NAME,
  marketStock,
  slotProblem,
  type Totals,
  workable,
} from '../engine/economy.ts';
import {
  applyBlueprint,
  deleteBlueprint,
  depositVisible,
  growthCost,
  placeDistrict,
  removeDistrict,
  renameDistrict,
  saveBlueprint,
  setSlot,
  upgradeInfo,
  upgradeSettlement,
  type Result,
} from '../engine/game.ts';
import { centerUnit, within } from '../engine/hex.ts';
import type { City, GameState } from '../engine/types.ts';
import { Art, Goods } from './bits.tsx';

interface Props {
  game: GameState;
  c: City;
  startHex?: number;
  report: (r: Result) => void;
  onClose: () => void;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function YieldLine({ y }: { y: Partial<Totals> | Yield }) {
  const parts: string[] = [];
  if (y.food) parts.push(`${r1(y.food)} food`);
  if (y.prod) parts.push(`${r1(y.prod)} prod`);
  if (y.science) parts.push(`${r1(y.science)} science`);
  if (y.gold) parts.push(`${r1(y.gold)} gold`);
  if (y.housing) parts.push(`room for ${y.housing.toLocaleString()}`);
  const goods = Object.fromEntries(Object.entries(y.goods ?? {}).filter(([, n]) => n > 0));
  return (
    <span className="yield">
      {parts.join(' · ')}
      {parts.length && Object.keys(goods).length ? ' · ' : ''}
      {Object.keys(goods).length > 0 && <Goods goods={goods} />}
      {!parts.length && !Object.keys(goods).length && <span className="muted">—</span>}
    </span>
  );
}

/**
 * The settlement screen: its land, its districts as tabs (2 for a town, 4 for a city, 6 for the
 * metropolis), the 3×3 designer, construction, market and the step up to the next rank.
 */
export function CityDialog({ game, c, startHex, report, onClose }: Props) {
  void startHex;
  const [, setV] = useState(0);
  const bump = () => setV(v => v + 1);
  const act = (r: Result) => {
    report(r);
    bump();
  };
  const [hex, setHex] = useState<number>(c.hex);
  const [dSel, setDSel] = useState<number | 'new' | 'locked'>(-1);
  const [cell, setCell] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [newName, setNewName] = useState('');
  const [bpName, setBpName] = useState('');
  const [bpPick, setBpPick] = useState<number | ''>('');
  const civ = game.civs[c.civId];
  const g = { w: game.map.w, h: game.map.h };
  const land = useMemo(() => new Set(landOf(game, c)), [game.cities.length, c.id]);
  const e = cityEconomy(game, c);
  const districts = cityDistricts(game, c);
  const cap = DISTRICT_CAP[c.tier];
  const mineD =
    typeof dSel === 'number' ? (districts.find(x => x.id === dSel) ?? districts[0]) : undefined;
  const centre = mineD ? isCentre(mineD) : false;
  const up = upgradeInfo(game, c);
  const bonus = TIER_BONUS[c.tier];
  const queue = constructionQueue(game, c);
  const market = marketCities(game, c);
  const stock = marketStock(game, c);
  const m = game.map;

  // ---- mini map of the settlement's land (and the ring beyond, for context)
  const ring = within(g, c.hex, 2);
  const [ox, oy] = centerUnit(g, c.hex);
  const S = 34;
  const hexPts = (x: number, y: number, r: number) =>
    Array.from({ length: 6 }, (_, k) => {
      const a = ((60 * k - 30) * Math.PI) / 180;
      return `${x + Math.cos(a) * r},${y + Math.sin(a) * r}`;
    }).join(' ');

  const hexLabel = (h: number) =>
    [
      TERRAIN[m.terrain[h]].name,
      m.relief[h] !== 'flat' ? RELIEF[m.relief[h]].name : '',
      VEGETATION[m.vegetation[h]].name,
      m.river[h] ? 'river' : '',
    ]
      .filter(Boolean)
      .join(', ');

  const cellState = (i: number) => {
    if (!mineD) return null;
    const st = mineD.slots[i];
    const rep = e.slots.get(mineD.id)?.[i];
    return { st, rep, t: st.type ? SLOT_TYPES[st.type] : undefined };
  };
  const sel = cell !== null ? cellState(cell) : null;
  const groups = Object.keys(GROUPS).filter(k => k !== 'civic') as SlotGroup[];

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal city-screen" onClick={ev => ev.stopPropagation()}>
        <header>
          <h2>
            {c.name} <span className="tier-pill">{TIER_NAME[c.tier]}</span>{' '}
            <small>
              {c.pop.toLocaleString()} people (room for {e.total.housing.toLocaleString()}) ·
              workers {e.workersUsed.toLocaleString()}/{e.workers.toLocaleString()} · food{' '}
              {r1(e.total.food)} − {e.eat} eaten = {e.surplus >= 0 ? '+' : ''}
              {r1(e.surplus)} ({r1(c.food)}/{growthCost(game, c)} to grow) · prod {r1(e.total.prod)}{' '}
              · science {e.total.science} · gold {e.total.gold}
            </small>
          </h2>
          <button className="x" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="city-body">
          {/* ---------------- hexes */}
          <section className="city-hexes">
            <h3>{c.name}'s land</h3>
            <svg viewBox={`${-S * 4.6} ${-S * 3.8} ${S * 9.2} ${S * 7.6}`} className="hexmap">
              {ring.map(h => {
                const [x, y] = centerUnit(g, h);
                const px = (x - ox) * S,
                  py = (y - oy) * S;
                const ok = land.has(h);
                const known = civ.explored[h];
                const dep = known && depositVisible(game, c.civId, h) ? m.deposit[h] : null;
                return (
                  <g
                    key={h}
                    className={`hx ${ok ? '' : 'off'} ${h === hex ? 'on' : ''}`}
                    onClick={() => setHex(h)}
                  >
                    <polygon
                      points={hexPts(px, py, S * 0.97)}
                      fill={known ? TERRAIN[m.terrain[h]].wash : '#e8dcc0'}
                    />
                    {m.relief[h] === 'mountains' && (
                      <text x={px} y={py + 4} className="hx-glyph">
                        ▲
                      </text>
                    )}
                    {m.relief[h] === 'hills' && (
                      <text x={px - 10} y={py + 12} className="hx-glyph small">
                        ⌒
                      </text>
                    )}
                    {(m.vegetation[h] === 'forest' || m.vegetation[h] === 'jungle') && (
                      <text x={px + 10} y={py + 12} className="hx-glyph small">
                        ♣
                      </text>
                    )}
                    {dep && (
                      <g>
                        <circle
                          cx={px + S * 0.42}
                          cy={py - S * 0.4}
                          r={S * 0.24}
                          fill={GOODS[Object.keys(DEPOSITS[dep.kind].yields)[0]]?.color ?? '#888'}
                        />
                        <text x={px + S * 0.42} y={py - S * 0.4 + 4} className="hx-dep">
                          {DEPOSITS[dep.kind].name.slice(0, 2)}
                        </text>
                      </g>
                    )}
                    {h === c.hex && (
                      <text x={px} y={py + 5} className="hx-name">
                        {c.tier === 'town' ? '⌂' : c.tier === 'city' ? '♜' : '♛'}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <p className="muted small">
              {hexLabel(hex)}
              {land.has(hex) ? '' : " · not this settlement's land"}
            </p>
            <p className="muted small">
              Buildings use what lies on the bright hexes. A hex next to two settlements belongs to
              the older one.
            </p>
            <h3>Rank</h3>
            <p className="small">
              <b>{TIER_NAME[c.tier]}</b> · {districts.length}/{cap} districts
              {bonus.all
                ? ` · +${bonus.all}% to every building, +${bonus.focus}% research and industry`
                : ' · farms, woodlots and mines allowed'}
            </p>
            {up.to && (
              <div className="upgrade">
                <p className="small">
                  <b>Become a {TIER_NAME[up.to].toLowerCase()}</b>:{' '}
                  {up.to === 'city'
                    ? `${DISTRICT_CAP.city} districts, +${TIER_BONUS.city.all}% to every building and +${TIER_BONUS.city.focus}% to research and industry.`
                    : `${DISTRICT_CAP.metropolis} districts, +${TIER_BONUS.metropolis.all}% / +${TIER_BONUS.metropolis.focus}%. Only one per people.`}{' '}
                  Needs {up.pop.toLocaleString()} people, {up.gold} gold and{' '}
                  <Goods goods={up.goods} />.
                </p>
                {up.lost > 0 && (
                  <p className="small bad">
                    Its {up.lost} farm, woodlot and mine buildings will be pulled down: a city lives
                    on what the towns in its market send it.
                  </p>
                )}
                <button
                  className="primary"
                  disabled={!!up.problem}
                  onClick={() => act(upgradeSettlement(game, c.id))}
                >
                  Become a {TIER_NAME[up.to].toLowerCase()}
                </button>
                {up.problem && <p className="muted small why">{up.problem}</p>}
              </div>
            )}
            {(e.fuel.need > 0 || e.comfort.want > 0) && (
              <>
                <h3>Needs</h3>
                {e.fuel.need > 0 && (
                  <p className="small">
                    Hearths burn {e.fuel.need} fuel a turn:{' '}
                    {e.fuel.good === 'coal' ? (
                      'coal (+5% production)'
                    ) : e.fuel.good === 'wood' ? (
                      'wood (coal would add 5% production)'
                    ) : (
                      <b className="bad">none to burn: everything −15%</b>
                    )}
                  </p>
                )}
                {e.comfort.want > 0 && (
                  <p className="small">
                    Comforts: {e.comfort.want} luxur{e.comfort.want > 1 ? 'ies' : 'y'} a turn,{' '}
                    {Object.keys(e.comfort.got).length ? (
                      <>
                        gets <Goods goods={e.comfort.got} />
                      </>
                    ) : (
                      'gets none'
                    )}{' '}
                    ·{' '}
                    <b className={e.comfort.pct < 0 ? 'bad' : 'good'}>
                      {e.comfort.pct >= 0 ? '+' : ''}
                      {e.comfort.pct}% gold and culture
                    </b>
                  </p>
                )}
              </>
            )}
            <h3>Market</h3>
            <p className="small">
              {market.length > 1
                ? `${market.map(x => x.name).join(', ')} share one store.`
                : 'Not linked to other settlements. Roads and rivers join them into one market, and towns in a market feed its cities.'}
            </p>
            <p className="small">
              <Goods goods={stock} empty="empty" />
            </p>
            <h3>Being built</h3>
            {queue.length === 0 && (
              <p className="muted small">Nothing planned. Fill a district's slots.</p>
            )}
            <ol className="queue">
              {queue.slice(0, 8).map(({ d: qd, i }, k) => {
                const t = SLOT_TYPES[qd.slots[i].type!];
                return (
                  <li key={`${qd.id}-${i}`}>
                    {t.name} <span className="muted small">({qd.name})</span>
                    <div className="bar">
                      <span
                        className="good"
                        style={{ width: `${(qd.slots[i].progress / t.build.prod) * 100}%` }}
                      />
                    </div>
                    {k === 0 && (
                      <span className="muted small">
                        {r1(qd.slots[i].progress)}/{t.build.prod} · {r1(e.total.prod)} per turn
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          {/* ---------------- district */}
          <section className="district">
            <div className="district-tabs" role="tablist">
              {districts.map(x => (
                <button
                  key={x.id}
                  role="tab"
                  aria-selected={mineD?.id === x.id}
                  className={mineD?.id === x.id ? 'on' : ''}
                  onClick={() => {
                    setDSel(x.id);
                    setCell(null);
                  }}
                >
                  <b>{x.name}</b>
                  <small>{isCentre(x) ? 'Centre' : districtKind(x)}</small>
                </button>
              ))}
              {districts.length < cap && (
                <button
                  className={`add ${dSel === 'new' ? 'on' : ''}`}
                  onClick={() => {
                    setDSel('new');
                    setCell(null);
                  }}
                >
                  <b>+ New district</b>
                  <small>{cap - districts.length} free</small>
                </button>
              )}
              {Array.from({ length: 6 - cap }, (_, k) => (
                <button
                  key={`l${k}`}
                  className={`locked ${dSel === 'locked' ? 'on' : ''}`}
                  onClick={() => setDSel('locked')}
                >
                  <b>
                    <Icon name="lock" />
                  </b>
                  <small>{cap + k < DISTRICT_CAP.city ? 'City' : 'Metropolis'}</small>
                </button>
              ))}
            </div>
            {dSel === 'locked' ? (
              <p className="muted">
                {c.tier === 'town'
                  ? `A town holds ${DISTRICT_CAP.town} districts. As a city ${c.name} would hold ${DISTRICT_CAP.city}, and the people's one metropolis holds ${DISTRICT_CAP.metropolis}. See Rank on the left.`
                  : `The metropolis holds ${DISTRICT_CAP.metropolis} districts; a people can have only one.`}
              </p>
            ) : mineD ? (
              <>
                <div className="row">
                  <input
                    className="design-name"
                    value={mineD.name}
                    maxLength={28}
                    onChange={ev => {
                      renameDistrict(game, mineD.id, ev.target.value || ' ');
                      bump();
                    }}
                    disabled={centre}
                  />
                  {!centre && (
                    <button
                      onClick={() => {
                        act(removeDistrict(game, mineD.id));
                        setCell(null);
                      }}
                    >
                      Clear district
                    </button>
                  )}
                </div>
                <div className="grid3">
                  {mineD.slots.map((st, i) => {
                    const x = cellState(i)!;
                    const status = !st.type
                      ? 'Empty'
                      : x.rep?.problem
                        ? x.rep.problem
                        : !st.built
                          ? `Planned${st.progress ? ` · ${Math.round((st.progress / x.t!.build.prod) * 100)}%` : ''}`
                          : x.rep?.staffed
                            ? x.rep.rate < 1
                              ? 'Running at half rate'
                              : 'Running'
                            : (x.rep?.idle ?? 'Idle');
                    return (
                      <button
                        key={i}
                        className={`cell ${cell === i ? 'on' : ''} ${st.built ? 'built' : ''} ${x.rep?.problem ? 'bad' : ''}`}
                        style={{ borderColor: x.t ? GROUPS[x.t.group].color : undefined }}
                        onClick={() => setCell(i)}
                      >
                        {x.t ? (
                          <>
                            <Art
                              k={`building/${x.t.id}`}
                              size={56}
                              className="cell-art"
                              fallback={
                                <span
                                  className="cell-glyph"
                                  style={{ background: GROUPS[x.t.group].color }}
                                >
                                  {x.t.glyph}
                                </span>
                              }
                            />
                            <b>{x.t.name}</b>
                            <small>{status}</small>
                            {x.rep?.staffed && (
                              <small className="cell-out">
                                <YieldLine y={x.rep.out} />
                              </small>
                            )}
                            {x.rep?.note && <small className="cell-note">{x.rep.note}</small>}
                          </>
                        ) : (
                          <small className="muted">+ empty</small>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="row bp-row">
                  <select
                    value={bpPick}
                    onChange={ev => setBpPick(ev.target.value ? Number(ev.target.value) : '')}
                  >
                    <option value="">Apply a blueprint…</option>
                    {civ.blueprints.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={bpPick === ''}
                    onClick={() => {
                      const b = civ.blueprints.find(x => x.id === bpPick);
                      if (b) act(applyBlueprint(game, mineD.id, b));
                    }}
                  >
                    Apply
                  </button>
                  <input
                    placeholder="Save layout as…"
                    value={bpName}
                    maxLength={28}
                    onChange={ev => setBpName(ev.target.value)}
                  />
                  <button
                    disabled={!bpName.trim()}
                    onClick={() => {
                      act(
                        saveBlueprint(
                          game,
                          civ.id,
                          bpName,
                          mineD.slots.map(x => x.type),
                        ),
                      );
                      setBpName('');
                    }}
                  >
                    Save
                  </button>
                </div>
                {civ.blueprints.length > 0 && (
                  <p className="muted small">
                    Blueprints:{' '}
                    {civ.blueprints.map(b => (
                      <span key={b.id} className="template">
                        {b.name}
                        <button
                          className="x small"
                          title="Delete blueprint"
                          onClick={() => {
                            deleteBlueprint(game, civ.id, b.id);
                            bump();
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </p>
                )}
              </>
            ) : (
              <div className="new-district">
                <h3>Lay out a district</h3>
                <p className="muted small">
                  A district is a 3×3 grid of buildings you choose. It needs {MIN_HOUSING} housing
                  cells before anything else in it works. Producers make things; boosters raise
                  every producer of their kind in the same district: a library adds ½ to each
                  university, a research lab doubles them.
                  {c.tier === 'town'
                    ? ' Towns can also farm, cut wood and mine their land.'
                    : ' Cities leave farming and mining to their towns.'}
                </p>
                <input
                  className="design-name"
                  placeholder="Name it: Farm, Northern Mine, Scholars' Quarter…"
                  value={newName}
                  maxLength={28}
                  onChange={ev => setNewName(ev.target.value)}
                />
                <div className="row">
                  <select
                    value={bpPick}
                    onChange={ev => setBpPick(ev.target.value ? Number(ev.target.value) : '')}
                  >
                    <option value="">Empty layout</option>
                    {civ.blueprints.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="primary"
                    onClick={() => {
                      const b = civ.blueprints.find(x => x.id === bpPick);
                      const res = placeDistrict(
                        game,
                        c.id,
                        newName || b?.name || 'District',
                        b?.slots ?? [],
                      );
                      act(res);
                      if (res.ok && res.id) setDSel(res.id);
                      setNewName('');
                    }}
                  >
                    Lay out district
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ---------------- palette */}
          <section className="palette">
            {mineD && cell !== null && sel ? (
              <>
                <h3>
                  Slot {cell + 1}: {sel.t ? sel.t.name : 'empty'}
                </h3>
                {sel.t && <p className="muted small">{sel.t.note}</p>}
                {sel.t && !sel.t.fixed && (
                  <button onClick={() => act(setSlot(game, mineD.id, cell, null))}>
                    {sel.st.built ? 'Demolish (¼ of the goods back)' : 'Clear slot'}
                  </button>
                )}
                {!sel.t?.fixed && (
                  <div className="row filter-row">
                    <button className={showAll ? 'on' : ''} onClick={() => setShowAll(v => !v)}>
                      {showAll ? 'Only what I can build here' : 'Show all buildings'}
                    </button>
                  </div>
                )}
                {sel.t?.fixed ? (
                  <p className="muted small">The town hall stays.</p>
                ) : (
                  groups.map(gr => {
                    // only what can go in this cell now; the rest, with reasons, on request
                    const known = SLOT_LIST.filter(
                      t =>
                        t.group === gr &&
                        (showAll ||
                          sel.st.type === t.id ||
                          !slotProblem(game, c.civId, c.hex, centre, t.id, mineD.id)),
                    );
                    if (!known.length) return null;
                    return (
                      <div key={gr}>
                        <h3 className="pal-group" style={{ color: GROUPS[gr].color }}>
                          {GROUPS[gr].name}
                        </h3>
                        <div className="pal-items">
                          {known.map(t => {
                            const why = slotProblem(game, c.civId, hex, centre, t.id, mineD.id);
                            return (
                              <button
                                key={t.id}
                                className={`pal ${sel.st.type === t.id ? 'on' : ''} ${why ? 'locked' : ''}`}
                                title={why ?? t.note}
                                onClick={() => act(setSlot(game, mineD.id, cell, t.id))}
                              >
                                <Art
                                  k={`building/${t.id}`}
                                  size={36}
                                  fallback={
                                    <span
                                      className="cell-glyph"
                                      style={{ background: GROUPS[t.group].color }}
                                    >
                                      {t.glyph}
                                    </span>
                                  }
                                />
                                <span>
                                  <b>{t.name}</b>
                                  <small>
                                    <YieldLine y={t.out} />
                                  </small>
                                  {(() => {
                                    // what this land would add to it
                                    const w = workable(game, c.civId, c.hex, t.id, 9);
                                    if (!w.open.length) return null;
                                    const sp = w.open.filter(k => DEPOSITS[k].special);
                                    return (
                                      <small className="good">
                                        Here: {w.open.map(k => DEPOSITS[k].name).join(', ')}
                                        {sp.length
                                          ? ` (${sp.map(k => DEPOSITS[k].name).join(', ')} with ${SPECIAL_MIN}+ in one district)`
                                          : ''}
                                      </small>
                                    );
                                  })()}
                                  <small className="muted">
                                    {t.labour ? `${t.labour} workers · ` : ''}
                                    {t.build.prod} prod{t.build.goods ? ' + ' : ''}
                                    {t.build.goods && <Goods goods={t.build.goods} />}
                                    {t.inputs ? ' · uses ' : ''}
                                    {t.inputs && <Goods goods={t.inputs} />}
                                  </small>
                                  {why && <small className="bad">{why}</small>}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            ) : (
              <>
                <h3>How districts work</h3>
                <p className="small">
                  Pick a hex, lay out a district and click a slot to choose what goes there. The
                  city builds the slots one by one with its production.
                </p>
                <ul className="small">
                  <li>Each building needs workers: half of the city's people can work.</li>
                  <li>
                    Farms, pastures, woodcutters and mines give a little anywhere (½ a unit). What
                    lies on the settlement's land adds more: pigs, wheat and fish more food, cattle
                    leather, sheep wool, a forest more wood.
                  </li>
                  <li>
                    Special goods (coal, iron, gold, sugar, spices, furs, whales…) need{' '}
                    {SPECIAL_MIN} or more of the working building in one district; then each brings
                    a unit, so eight mines by coal dig eight coal.
                  </li>
                  <li>
                    Boosters raise the producers of their kind in the same district: an adder puts ½
                    on each (library on universities, infirmary on mines, granary on farms), a late
                    multiplier doubles them (research lab, pumping station, food packaging).
                  </li>
                  <li>
                    Every district needs {MIN_HOUSING} housing cells before anything else in it
                    works; housing beyond that makes the settlement grow faster.
                  </li>
                  <li>
                    Houses make room for people. Without room the settlement stops growing. A city
                    needs 6 housing cells and the City Charter.
                  </li>
                </ul>
                <h3>This city now</h3>
                <p className="small">
                  <YieldLine y={e.total} />
                </p>
                {e.subsistence.food > 0 && (
                  <p className="muted small">
                    Includes {r1(e.subsistence.food)} food from unbuilt land next to the city.
                  </p>
                )}
                <p className="muted small">Districts: {cityDistricts(game, c).length}</p>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
