import { useMemo, useState } from 'react';
import { CityScene } from './CityScene.tsx';
import { Icon } from './icons.tsx';
import { DEPOSITS, GOODS, SPECIAL_MIN } from '../data/goods.ts';
import { GROUPS, MIN_HOUSING, SLOT_LIST, SLOT_TYPES } from '../data/slots.ts';
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
  TIERS,
  rankOf,
  isUrban,
  marketStock,
  slotPreview,
  slotProblem,
} from '../engine/economy.ts';
import {
  applyBlueprint,
  deleteBlueprint,
  depositVisible,
  districtHexProblem,
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
import type { City, District, GameState } from '../engine/types.ts';
import { Art, GoodIcon, Goods } from './bits.tsx';

interface Props {
  game: GameState;
  c: City;
  startHex?: number;
  /** the tab to open on: the overview, or the districts */
  startTab?: 'overview' | 'districts';
  report: (r: Result) => void;
  onClose: () => void;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The settlement screen: its land, its districts as tabs (2 for a town, 4 for a city, 6 for the
 * metropolis), the 3×3 designer, construction, market and the step up to the next rank.
 */
export function CityDialog({ game, c, startHex, startTab, report, onClose }: Props) {
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
  const [tipT, setTipT] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'districts'>(startTab ?? 'overview');
  const [info, setInfo] = useState(false);
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

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal city-screen" onClick={ev => ev.stopPropagation()}>
        <header>
          <h2>
            {c.name}{' '}
            <small>
              {TIER_NAME[c.tier]} · {c.pop.toLocaleString()} people
            </small>
          </h2>
          <div className="city-tabs" role="tablist">
            {(
              [
                ['overview', 'Overview'],
                ['districts', 'Districts'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                className={tab === k ? 'on' : ''}
                onClick={() => setTab(k)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className={`round info-btn ${info ? 'on' : ''}`}
            onClick={() => setInfo(v => !v)}
            aria-label="How settlements and districts work"
            title="How settlements and districts work"
          >
            i
          </button>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {info && (
          <div className="city-info small" role="note">
            <b>How districts work</b>
            <p className="small">
              Pick a hex, lay out a district and click a slot to choose what goes there. The city
              builds the slots one by one with its production.
            </p>
            <ul className="small">
              <li>Each building needs workers: half of the city's people can work.</li>
              <li>
                Farms, pastures, woodcutters and mines give a little anywhere (½ a unit). What lies
                on the settlement's land adds more: pigs, wheat and fish more food, cattle leather,
                sheep wool, a forest more wood.
              </li>
              <li>
                Special goods (coal, iron, gold, sugar, spices, furs, whales…) need {SPECIAL_MIN} or
                more of the working building in one district; then each brings a unit, so eight
                mines by coal dig eight coal.
              </li>
              <li>
                Boosters raise the producers of their kind in the same district: an adder puts ½ on
                each (library on universities, infirmary on mines, granary on farms), a late
                multiplier doubles them (research lab, pumping station, food packaging).
              </li>
              <li>
                Every district needs {MIN_HOUSING} housing cells before anything else in it works;
                housing beyond that makes the settlement grow faster.
              </li>
              <li>
                Houses make room for people. Without room the settlement stops growing. A city needs
                6 housing cells and the City Charter.
              </li>
            </ul>
            <p className="muted">
              The centre and the six hexes around it are the settlement's land; every district
              stands on one of them. A district gathers the special resource on its own hex (ores,
              crops, furs, whales…) and the plain ones next to it; one by the water can build docks
              and yards.
            </p>
          </div>
        )}

        {tab === 'overview' ? (
          <div className="city-body overview">
            <section className="city-main">
              <div className="city-yields">
                {(
                  [
                    ['food', 'Food', e.surplus, `${r1(e.total.food)} grown, ${e.eat} eaten`],
                    ['production', 'Production', e.total.prod, 'builds the queue'],
                    ['science', 'Science', e.total.science, 'to research'],
                    ['gold', 'Gold', e.total.gold, 'to the treasury'],
                    ['culture', 'Culture', e.total.culture, 'to the culture web'],
                    ['housing', 'Room', e.total.housing, `${c.pop.toLocaleString()} live here`],
                  ] as [string, string, number, string][]
                ).map(([icon, name, v, sub]) => (
                  <div key={name} className="yield-card">
                    <Icon name={icon} />
                    <b>
                      {icon === 'housing' ? v.toLocaleString() : `${v >= 0 ? '+' : ''}${r1(v)}`}
                    </b>
                    <span>{name}</span>
                    <small className="muted">{sub}</small>
                  </div>
                ))}
              </div>
              <p className="small">
                <b>Goods made here a turn:</b> <Goods goods={e.total.goods} empty="none" />
              </p>
              <p className="small muted">
                Growth: {r1(c.food)}/{growthCost(game, c)} food stored to grow by 250 · workers{' '}
                {e.workersUsed.toLocaleString()}/{e.workers.toLocaleString()} busy
              </p>
              <h3>Rank</h3>
              <p className="small">
                <b>
                  {c.colony ? `Colony (${TIER_NAME[c.tier].toLowerCase()})` : TIER_NAME[c.tier]}
                </b>{' '}
                · {districts.length}/{cap} districts
                {bonus.all
                  ? ` · +${bonus.all}% to every building, +${bonus.focus}% research and industry`
                  : ' · farms, woodlots and mines allowed'}
              </p>
              {up.to && (
                <div className="upgrade">
                  <p className="small">
                    <b>Become a {TIER_NAME[up.to].toLowerCase()}</b>: {DISTRICT_CAP[up.to]}{' '}
                    districts
                    {TIER_BONUS[up.to].all
                      ? `, +${TIER_BONUS[up.to].all}% to every building and +${TIER_BONUS[up.to].focus}% to research and industry`
                      : ''}
                    {up.to === 'metropolis' ? '. Only one per people.' : '.'} Needs{' '}
                    {up.pop.toLocaleString()} people, {up.gold} gold and <Goods goods={up.goods} />.
                  </p>
                  {up.lost > 0 && (
                    <p className="small bad">
                      The {up.lost} farm, woodlot and mine buildings of its centre will be pulled
                      down: a city builds over its centre (its outer districts keep their fields).
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
            <section className="city-land">
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
                          {['⌂', '⌂', '⌂', '♜', '♜', '♛'][rankOf(c.tier)]}
                        </text>
                      )}
                      {h !== c.hex && districts.some(d => d.hex === h) && (
                        <text x={px} y={py + 5} className="hx-name">
                          ▦
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
              <p className="muted small">
                {hexLabel(hex)}
                {!land.has(hex)
                  ? " · not this settlement's land"
                  : hex === c.hex
                    ? ' · the centre'
                    : districts.find(d => d.hex === hex)
                      ? ` · ${districts.find(d => d.hex === hex)!.name}`
                      : districtHexProblem(game, c, hex)
                        ? ` · ${districtHexProblem(game, c, hex)}`
                        : ' · free: a district can stand here'}
              </p>
            </section>
          </div>
        ) : (
          <div className="city-body districts">
            <section className="district wide">
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
                {Array.from({ length: Math.max(0, 7 - cap) }, (_, k) => (
                  <button
                    key={`l${k}`}
                    className={`locked ${dSel === 'locked' ? 'on' : ''}`}
                    onClick={() => setDSel('locked')}
                  >
                    <b>
                      <Icon name="lock" />
                    </b>
                    <small>
                      {TIER_NAME[TIERS.find(t => DISTRICT_CAP[t] > cap + k) ?? 'metropolis']}
                    </small>
                  </button>
                ))}
              </div>
              {mineD && (
                <CityScene
                  game={game}
                  c={c}
                  selected={mineD?.id}
                  cell={cell}
                  onPick={(d, k) => {
                    setDSel(d);
                    setCell(k);
                  }}
                >
                  {mineD && cell !== null && sel && (
                    <div className="plot-picker" onClick={ev => ev.stopPropagation()}>
                      <div className="plot-head">
                        <b>
                          {mineD.name} · plot {cell + 1}
                        </b>
                        <span className="muted small">
                          {sel.t
                            ? `${sel.t.name}${sel.st.built ? '' : ` · being built (${Math.round(Math.min(1, sel.st.progress / Math.max(1, sel.t.build.prod)) * 100)}%)`}`
                            : 'Empty: choose what to build'}
                        </span>
                        <button className="x" onClick={() => setCell(null)} aria-label="Close">
                          ×
                        </button>
                      </div>
                      {sel.t?.fixed ? (
                        <p className="muted small">The town hall stays.</p>
                      ) : (
                        <>
                          <div className="plot-options">
                            {sel.t && (
                              <button
                                className="plot-opt clear"
                                onClick={() => act(setSlot(game, mineD.id, cell, null))}
                              >
                                <span className="cell-glyph">✕</span>
                                <span>{sel.st.built ? 'Demolish' : 'Clear'}</span>
                              </button>
                            )}
                            {SLOT_LIST.filter(
                              t =>
                                t.id !== sel.st.type &&
                                !slotProblem(game, c.civId, mineD.hex, centre, t.id, mineD.id),
                            ).map(t => (
                              <button
                                key={t.id}
                                className="plot-opt"
                                onMouseEnter={() => setTipT(t.id)}
                                onFocus={() => setTipT(t.id)}
                                onMouseLeave={() => setTipT(x => (x === t.id ? null : x))}
                                onClick={() => act(setSlot(game, mineD.id, cell, t.id))}
                              >
                                <Art
                                  k={`building/${t.id}`}
                                  size={30}
                                  fallback={
                                    <span
                                      className="cell-glyph"
                                      style={{ background: GROUPS[t.group].color }}
                                    >
                                      {t.glyph}
                                    </span>
                                  }
                                />
                                <span>{t.name}</span>
                              </button>
                            ))}
                          </div>
                          <div className="build-tip-slot">
                            {tipT && SLOT_TYPES[tipT] ? (
                              <BuildTip game={game} c={c} d={mineD} cell={cell} typeId={tipT} />
                            ) : (
                              <small className="muted">
                                Point at a building to see what it would add here each turn.
                              </small>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CityScene>
              )}
              {dSel === 'locked' ? (
                <p className="muted">
                  {`A ${TIER_NAME[c.tier].toLowerCase()} holds ${cap} district${cap > 1 ? 's' : ''}. Each size up opens one more: settlement 1, town 2, large town 3, city 4, large city 5, and the people's one metropolis all 7 (the centre and its six neighbours). See Rank on the left.`}
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
                    university, a research lab doubles them. It stands on the hex picked on the land
                    map
                    {hex !== c.hex && !districtHexProblem(game, c, hex)
                      ? ` (${hexLabel(hex)})`
                      : ': pick a free hex there first, or it goes on the best free one'}
                    .{isUrban(c) ? ' A city farms and mines in its outer districts only.' : ''}
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
                          hex !== c.hex && !districtHexProblem(game, c, hex) ? hex : undefined,
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
            {(dSel === 'new' || dSel === 'locked') && (
              <section className="city-land">
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
                              fill={
                                GOODS[Object.keys(DEPOSITS[dep.kind].yields)[0]]?.color ?? '#888'
                              }
                            />
                            <text x={px + S * 0.42} y={py - S * 0.4 + 4} className="hx-dep">
                              {DEPOSITS[dep.kind].name.slice(0, 2)}
                            </text>
                          </g>
                        )}
                        {h === c.hex && (
                          <text x={px} y={py + 5} className="hx-name">
                            {['⌂', '⌂', '⌂', '♜', '♜', '♛'][rankOf(c.tier)]}
                          </text>
                        )}
                        {h !== c.hex && districts.some(d => d.hex === h) && (
                          <text x={px} y={py + 5} className="hx-name">
                            ▦
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
                <p className="muted small">
                  {hexLabel(hex)}
                  {!land.has(hex)
                    ? " · not this settlement's land"
                    : hex === c.hex
                      ? ' · the centre'
                      : districts.find(d => d.hex === hex)
                        ? ` · ${districts.find(d => d.hex === hex)!.name}`
                        : districtHexProblem(game, c, hex)
                          ? ` · ${districtHexProblem(game, c, hex)}`
                          : ' · free: a district can stand here'}
                </p>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const YIELD_ICON: Record<string, [string, string]> = {
  food: ['food', 'Food'],
  prod: ['production', 'Production'],
  science: ['science', 'Science'],
  gold: ['gold', 'Gold'],
  culture: ['culture', 'Culture'],
  housing: ['housing', 'Room for people'],
};

/** A building on this plot: its picture, name and what it would add here each turn. */
function BuildTip({
  game,
  c,
  d,
  cell,
  typeId,
}: {
  game: GameState;
  c: City;
  d: District;
  cell: number;
  typeId: string;
}) {
  const t = SLOT_TYPES[typeId];
  const p = slotPreview(game, c, d, cell, typeId);
  const rows = [
    ...Object.entries(p.yields).map(([k, v]) => ({
      key: k,
      icon: <Icon name={YIELD_ICON[k][0]} />,
      name: YIELD_ICON[k][1],
      v,
      unit: k === 'housing' ? 'people' : '/turn',
    })),
    ...Object.entries(p.goods).map(([k, v]) => ({
      key: k,
      icon: <GoodIcon id={k} />,
      name: GOODS[k]?.name ?? k,
      v,
      unit: '/turn',
    })),
  ];
  return (
    <div className="build-tip" role="tooltip">
      <Art
        k={`building/${t.id}`}
        size={34}
        fallback={<span className="cell-glyph">{t.glyph}</span>}
      />
      <div>
        <b>{t.name}</b>
        {rows.length ? (
          <ul>
            {rows.map(r => (
              <li key={r.key} className={r.v < 0 ? 'bad' : ''}>
                <span className="tip-ico">{r.icon}</span> {r.name}{' '}
                <b>
                  {r.v > 0 ? '+' : ''}
                  {r.v}
                  {r.unit === '/turn' ? '/turn' : ` ${r.unit}`}
                </b>
              </li>
            ))}
          </ul>
        ) : (
          <small className="muted">
            {t.labour ? `${p.why ?? 'Nothing here yet.'}` : 'Nothing here yet.'}
          </small>
        )}
        <small className="muted">
          Build: {t.build.prod} production
          {Object.entries(t.build.goods ?? {}).map(
            ([g, n]) => `, ${n} ${GOODS[g]?.name.toLowerCase() ?? g}`,
          )}
          {t.labour ? ` · ${t.labour} workers` : ''}
        </small>
      </div>
    </div>
  );
}
