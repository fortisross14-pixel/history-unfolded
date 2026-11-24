import { useMemo, useRef, useState } from 'react';
import { CityScene } from './CityScene.tsx';
import { Icon } from './icons.tsx';
import { DEPOSITS, GOODS, SPECIAL_MIN } from '../data/goods.ts';
import { CENTRE_LIST, GROUPS, MIN_HOUSING, SLOT_LIST, SLOT_TYPES } from '../data/slots.ts';
import { RELIEF, TERRAIN, VEGETATION } from '../data/terrain.ts';
import {
  builderPlan,
  buildPreview,
  centreProblem,
  centreRow,
  cityDistricts,
  cityEconomy,
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
  planCentre,
  queueMove,
  queuePause,
  queueRemove,
  slotProblem,
  turnsToBuild,
  type Totals,
} from '../engine/economy.ts';
import { WONDER_SHARE } from '../engine/wonders.ts';
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
import { Art, Chip, Delta, GoodIcon, Goods, Ico, InfoButton } from './bits.tsx';
import './declutter-city.css';
import './r4-city.css';

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

/** Each good as its icon and a number, the name on hover. */
function GoodChips({
  goods,
  unit = '',
  signed,
}: {
  goods: Record<string, number>;
  unit?: string;
  signed?: boolean;
}) {
  const list = Object.entries(goods).filter(([, n]) => n);
  if (!list.length) return <span className="muted">—</span>;
  return (
    <>
      {list.map(([k, n]) => (
        <Chip
          key={k}
          good={k}
          n={signed ? n : r1(n)}
          signed={signed}
          title={`${GOODS[k]?.name ?? k}${unit}`}
        />
      ))}
    </>
  );
}

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
  const touchTap = useRef(false);
  const [tab, setTab] = useState<'overview' | 'districts'>(startTab ?? 'overview');
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
  // what the builders get: the production, less a wonder's share
  const prod = e.total.prod * (c.wonder ? 1 - WONDER_SHARE : 1);
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
  const freeHex = hex !== c.hex && !districtHexProblem(game, c, hex);

  const landMap = (
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
                  <title>{DEPOSITS[dep.kind].name}</title>
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
          ? ' · outside'
          : hex === c.hex
            ? ' · centre'
            : districts.find(d => d.hex === hex)
              ? ` · ${districts.find(d => d.hex === hex)!.name}`
              : districtHexProblem(game, c, hex)
                ? ` · ${districtHexProblem(game, c, hex)}`
                : ' · free'}
      </p>
    </section>
  );

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal city-screen" onClick={ev => ev.stopPropagation()}>
        <header>
          <h2>
            {c.name}{' '}
            <small>
              {c.colony ? `Colony (${TIER_NAME[c.tier].toLowerCase()})` : TIER_NAME[c.tier]}
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
          <InfoButton label="How settlements and districts work" align="right">
            <b>Districts</b>
            <ul className="small dc-list">
              <li>Land: the centre + 6 hexes, one district each. By water: docks, yards.</li>
              <li>Workers: half the people.</li>
              <li>
                Farms, pastures, woodcutters, mines: ½ anywhere, more from what the land holds.
              </li>
              <li>
                Special goods (coal, iron, gold, spices…): {SPECIAL_MIN}+ of the building in one
                district, then 1 each.
              </li>
              <li>
                Boosters: +½ (library, granary) or ×2 (research lab) to their kind, same district.
              </li>
              <li>
                {MIN_HOUSING} housing cells before a district works; more housing, faster growth.
              </li>
              <li>City: 6 housing cells + City Charter.</li>
            </ul>
          </InfoButton>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {tab === 'overview' ? (
          <div className="city-body overview">
            <section className="city-main">
              <div className="chips dc-yields">
                <Chip icon="people" n={c.pop.toLocaleString()} title="People" />
                <span
                  className="chip"
                  title={`Food a turn: ${r1(e.total.food)} grown, ${e.eat} eaten; ${r1(c.food)}/${growthCost(game, c)} stored to grow by 250`}
                  aria-label="Food a turn"
                >
                  <Icon name="food" size={22} />
                  <Delta n={e.surplus} />
                  <small className="muted">
                    {r1(c.food)}/{growthCost(game, c)}
                  </small>
                </span>
                <Chip icon="production" n={r1(e.total.prod)} title="Production a turn" />
                <Chip icon="science" n={r1(e.total.science)} title="Science a turn" />
                <Chip icon="gold" n={r1(e.total.gold)} title="Gold a turn" />
                <Chip icon="culture" n={r1(e.total.culture)} title="Culture a turn" />
                <Chip icon="housing" n={e.total.housing.toLocaleString()} title="Room for people" />
              </div>
              <div className="chips dc-row">
                <GoodChips goods={e.total.goods} unit=" a turn" />
              </div>
              <div className="chips dc-row muted">
                <Chip
                  icon="workers"
                  n={`${e.workersUsed.toLocaleString()}/${e.workers.toLocaleString()}`}
                  title="Workers busy"
                />
                <Chip icon="district" n={`${districts.length}/${cap}`} title="Districts" />
                {bonus.all ? (
                  <Chip
                    icon="production"
                    n={`+${bonus.all}%`}
                    title={`${TIER_NAME[c.tier]}: +${bonus.all}% every building, +${bonus.focus}% research and industry`}
                  />
                ) : null}
              </div>
              {up.to && (
                <div className="upgrade dc-upgrade">
                  <div className="dc-up-head">
                    <b>→ {TIER_NAME[up.to]}</b>
                    <InfoButton label={`About becoming a ${TIER_NAME[up.to].toLowerCase()}`}>
                      <span>
                        {DISTRICT_CAP[up.to]} districts
                        {TIER_BONUS[up.to].all
                          ? `, +${TIER_BONUS[up.to].all}% every building, +${TIER_BONUS[up.to].focus}% research and industry`
                          : ''}
                        .
                      </span>
                      {up.to === 'metropolis' && <span>One per people.</span>}
                      {up.lost > 0 && (
                        <span className="bad">
                          The centre's {up.lost} farms, woodlots and mines go: a city builds over
                          its centre.
                        </span>
                      )}
                    </InfoButton>
                  </div>
                  <div className="chips">
                    <Chip icon="people" n={up.pop.toLocaleString()} title="People needed" />
                    <Chip icon="gold" n={up.gold} title="Gold" />
                    <GoodChips goods={up.goods} />
                    <Chip
                      icon="district"
                      n={`+${DISTRICT_CAP[up.to] - cap}`}
                      title="More districts"
                    />
                    {up.lost > 0 && (
                      <span className="chip bad" title="Centre fields pulled down">
                        <Icon name="warning" size={18} />
                        <Delta n={-up.lost} />
                      </span>
                    )}
                  </div>
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
                <div className="chips dc-row">
                  {e.fuel.need > 0 && (
                    <span
                      className={`chip ${e.fuel.good ? '' : 'bad'}`}
                      title={`Fuel a turn: ${e.fuel.need}. Coal +5% production; nothing to burn −15% everything`}
                      aria-label="Fuel"
                    >
                      {e.fuel.good ? (
                        <>
                          <GoodIcon id={e.fuel.good} />
                          <Delta n={-e.fuel.need} />
                        </>
                      ) : (
                        <>
                          <Icon name="warning" size={18} /> <Delta n={-15} unit="%" />
                        </>
                      )}
                      {e.fuel.good === 'coal' && <Delta n={5} unit="%" />}
                    </span>
                  )}
                  {e.comfort.want > 0 && (
                    <span
                      className="chip"
                      title={`Comforts: ${e.comfort.want} luxuries wanted a turn; gold and culture ${e.comfort.pct >= 0 ? '+' : ''}${e.comfort.pct}%`}
                      aria-label="Comforts"
                    >
                      <Icon name="gift" size={18} />
                      {Object.keys(e.comfort.got).length ? (
                        <Goods goods={e.comfort.got} />
                      ) : (
                        <b>0</b>
                      )}
                      <b>/{e.comfort.want}</b>
                      <Delta n={e.comfort.pct} unit="%" />
                    </span>
                  )}
                </div>
              )}
              <h3 className="dc-h">
                Store
                <InfoButton label="About the market">
                  {market.length > 1
                    ? `${market.map(x => x.name).join(', ')} share one store.`
                    : 'Unlinked. Roads and rivers join settlements into one market; towns feed its cities.'}
                </InfoButton>
              </h3>
              <div className="chips dc-row">
                {market.length > 1 && (
                  <Chip icon="road" n={market.length} title="Settlements in this market" />
                )}
                <GoodChips goods={stock} unit=" in store" />
              </div>
              <QueuePanel game={game} c={c} prod={prod} act={act} />
              <CentrePanel game={game} c={c} prod={prod} act={act} />
            </section>
            {landMap}
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
                    title="New district"
                    onClick={() => {
                      setDSel('new');
                      setCell(null);
                    }}
                  >
                    <b>+ New</b>
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
                          {mineD.name} · {cell + 1}
                        </b>
                        <span className="muted small">
                          {sel.t
                            ? `${sel.t.name}${sel.st.built ? '' : ` · ${Math.round(Math.min(1, sel.st.progress / Math.max(1, sel.t.build.prod)) * 100)}%`}`
                            : 'Empty'}
                        </span>
                        <button className="x" onClick={() => setCell(null)} aria-label="Close">
                          ×
                        </button>
                      </div>
                      {sel.t?.fixed ? null : (
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
                                aria-pressed={tipT === t.id}
                                onPointerDown={e => (touchTap.current = e.pointerType !== 'mouse')}
                                onMouseEnter={() => !touchTap.current && setTipT(t.id)}
                                onFocus={() => !touchTap.current && setTipT(t.id)}
                                onMouseLeave={() =>
                                  !touchTap.current && setTipT(x => (x === t.id ? null : x))
                                }
                                onClick={() => {
                                  // by touch the first tap shows what it would make; the second builds
                                  if (touchTap.current && tipT !== t.id) return setTipT(t.id);
                                  act(setSlot(game, mineD.id, cell, t.id));
                                }}
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
                              <BuildTip
                                game={game}
                                c={c}
                                at={{ d: mineD, i: cell }}
                                typeId={tipT}
                                prod={prod}
                              />
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CityScene>
              )}
              {dSel === 'locked' ? (
                <div className="chips dc-row muted">
                  {TIERS.map(t => (
                    <span
                      key={t}
                      className={`chip ${t === c.tier ? 'dc-on' : ''}`}
                      title={`${TIER_NAME[t]}: ${DISTRICT_CAP[t]} districts`}
                    >
                      {TIER_NAME[t]} <Icon name="district" size={16} />
                      <b>{DISTRICT_CAP[t]}</b>
                    </span>
                  ))}
                </div>
              ) : mineD ? (
                <>
                  <QueuePanel game={game} c={c} prod={prod} act={act} compact />
                  {centre && <CentrePanel game={game} c={c} prod={prod} act={act} />}
                  <div className="row">
                    <input
                      className="design-name"
                      value={mineD.name}
                      maxLength={28}
                      aria-label="District name"
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
                      aria-label="Blueprint"
                      onChange={ev => setBpPick(ev.target.value ? Number(ev.target.value) : '')}
                    >
                      <option value="">Blueprint…</option>
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
                      placeholder="Blueprint name"
                      aria-label="Save layout as blueprint"
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
                      <Icon name="blueprint" size={16} />{' '}
                      {civ.blueprints.map(b => (
                        <span key={b.id} className="template">
                          {b.name}
                          <button
                            className="x small"
                            title="Delete blueprint"
                            aria-label={`Delete blueprint ${b.name}`}
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
                  <h3 className="dc-h">
                    New district
                    <InfoButton label="About districts">
                      <span>
                        3×3 buildings. {MIN_HOUSING} housing cells before the rest works. Boosters
                        raise every producer of their kind in the district.
                      </span>
                      {isUrban(c) && <span>A city farms and mines in outer districts only.</span>}
                    </InfoButton>
                  </h3>
                  <p className="muted small">
                    <Icon name="district" size={16} /> {freeHex ? hexLabel(hex) : 'Best free hex'}
                  </p>
                  <input
                    className="design-name"
                    placeholder="Name"
                    aria-label="District name"
                    value={newName}
                    maxLength={28}
                    onChange={ev => setNewName(ev.target.value)}
                  />
                  <div className="row">
                    <select
                      value={bpPick}
                      aria-label="Blueprint"
                      onChange={ev => setBpPick(ev.target.value ? Number(ev.target.value) : '')}
                    >
                      <option value="">Empty</option>
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
                          freeHex ? hex : undefined,
                        );
                        act(res);
                        if (res.ok && res.id) setDSel(res.id);
                        setNewName('');
                      }}
                    >
                      Lay out
                    </button>
                  </div>
                </div>
              )}
            </section>
            {(dSel === 'new' || dSel === 'locked') && landMap}
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

const YIELD_KEYS = ['food', 'prod', 'gold', 'science', 'culture', 'housing'] as const;

/** The settlement's yields before → after: each line an icon, the two numbers and the change. */
function YieldDiff({ before, after }: { before: Totals; after: Totals }) {
  const goods = [...new Set([...Object.keys(before.goods), ...Object.keys(after.goods)])].filter(
    k => r1(after.goods[k] ?? 0) !== r1(before.goods[k] ?? 0),
  );
  return (
    <span className="r4-diff">
      {YIELD_KEYS.map(k => {
        const b = before[k],
          a = after[k];
        const same = r1(a) === r1(b);
        if (k === 'housing' && same) return null;
        return (
          <span
            key={k}
            className={`chip ${same ? 'muted' : ''}`}
            title={`${YIELD_ICON[k][1]}${k === 'housing' ? '' : ' a turn'}: before → after`}
          >
            <Ico name={YIELD_ICON[k][0]} fallback="•" size={18} />
            <span className="r4-ba">
              {k === 'housing' ? b.toLocaleString() : r1(b)}
              {!same && (
                <>
                  {' → '}
                  <b>{k === 'housing' ? a.toLocaleString() : r1(a)}</b>
                </>
              )}
            </span>
            {!same && <Delta n={a - b} />}
          </span>
        );
      })}
      {goods.map(k => {
        const b = before.goods[k] ?? 0,
          a = after.goods[k] ?? 0;
        return (
          <span key={k} className="chip" title={`${GOODS[k]?.name ?? k} a turn: before → after`}>
            <GoodIcon id={k} />
            <span className="r4-ba">
              {r1(b)} → <b>{r1(a)}</b>
            </span>
            <Delta n={a - b} />
          </span>
        );
      })}
    </span>
  );
}

/**
 * A building being chosen: its picture and name, the settlement's yields before → after it
 * stands, the turns it takes with the builders free now, and its cost.
 */
function BuildTip({
  game,
  c,
  at,
  typeId,
  prod,
}: {
  game: GameState;
  c: City;
  /** the plot; none for the centre row */
  at?: { d: District; i: number };
  typeId: string;
  prod: number;
}) {
  const t = SLOT_TYPES[typeId];
  const p = buildPreview(game, c, typeId, at);
  const turns = turnsToBuild(game, c, typeId, prod);
  return (
    <div className="build-tip r4-tip" role="tooltip">
      <Art
        k={`building/${t.id}`}
        size={34}
        fallback={<span className="cell-glyph">{t.glyph}</span>}
      />
      <div>
        <b>{t.name}</b>
        <YieldDiff before={p.before} after={p.after} />
        {t.labour > 0 && p.why && <small className="muted">{p.why}</small>}
        <span className="chips muted dc-cost">
          <Chip icon="end-turn" n={turns ?? '—'} title="Turns to build with the builders now" />
          <Chip icon="production" n={t.build.prod} title="Cost: production" />
          {Object.entries(t.build.goods ?? {}).map(([g, n]) => (
            <Chip key={g} good={g} n={n} title={`Cost: ${GOODS[g]?.name ?? g}`} />
          ))}
          {t.labour ? <Chip icon="workers" n={t.labour} title="Workers to staff it" /> : null}
        </span>
      </div>
    </div>
  );
}

const STATE_LABEL: Record<string, string> = {
  paused: 'Paused',
  waiting: 'Waiting',
  goods: 'Needs goods',
  blocked: 'Blocked',
};

/**
 * The build queue: builders busy of the crew, what 100 builders add a turn, and each order with
 * its builders, turns left and progress; move it up or down, pause it, or take it off.
 */
function QueuePanel({
  game,
  c,
  prod,
  act,
  compact,
}: {
  game: GameState;
  c: City;
  prod: number;
  act: (r: Result) => void;
  compact?: boolean;
}) {
  const p = builderPlan(game, c, prod);
  const n = p.lines.length;
  return (
    <section className={`r4-queue ${compact ? 'compact' : ''}`}>
      <h3 className="dc-h">
        Queue
        <Chip icon="production" n={`${p.busy}/${p.builders}`} title="Builders busy" />
        <Chip
          icon="production"
          n={`${r1(p.perCrew)}/100`}
          title="Production a turn for every 100 builders"
        />
        <InfoButton label="About builders">
          <span>
            {p.crews} crew{p.crews > 1 ? 's' : ''} of 100: one more each time the settlement grows.
          </span>
          <span>Orders going share the builders evenly. Pause one to speed the rest.</span>
          <span>Builders × production per 100 = progress a turn.</span>
        </InfoButton>
      </h3>
      {!n && <p className="muted small">—</p>}
      <ol className="r4-q">
        {p.lines.map(l => {
          const pct = Math.min(100, (l.progress / Math.max(1, l.cost)) * 100);
          const where = l.order.slot >= 9 ? 'Centre' : l.d.name;
          return (
            <li key={`${l.d.id}:${l.order.slot}`} className={`r4-qi ${l.state}`}>
              <Art
                k={`building/${l.t.id}`}
                size={28}
                fallback={
                  <span className="cell-glyph" style={{ background: GROUPS[l.t.group].color }}>
                    {l.t.glyph}
                  </span>
                }
              />
              <span className="r4-qn" title={l.why ?? where}>
                <b>{l.t.name}</b>
                <small className="muted">{where}</small>
              </span>
              <span className="r4-qs">
                {l.state === 'building' ? (
                  <>
                    <Chip
                      icon="production"
                      n={Math.round(l.builders)}
                      title={`Builders on it: +${r1(l.perTurn)} a turn`}
                    />
                    <Chip icon="end-turn" n={l.turns ?? '—'} title="Turns left" />
                  </>
                ) : (
                  <small className="muted" title={l.why}>
                    {STATE_LABEL[l.state]}
                  </small>
                )}
              </span>
              <div className="bar" title={`${r1(l.progress)}/${l.cost}`}>
                <span className="good" style={{ width: `${pct}%` }} />
              </div>
              <span className="r4-qa">
                <button
                  className="icon-btn"
                  aria-label="Move up"
                  title="Move up"
                  disabled={l.at === 0}
                  onClick={() => act(queueMove(game, c, l.at, -1))}
                >
                  ↑
                </button>
                <button
                  className="icon-btn"
                  aria-label="Move down"
                  title="Move down"
                  disabled={l.at === n - 1}
                  onClick={() => act(queueMove(game, c, l.at, 1))}
                >
                  ↓
                </button>
                <button
                  className={`icon-btn r4-pause ${l.order.paused ? 'on' : ''}`}
                  aria-label={l.order.paused ? 'Resume' : 'Pause'}
                  title={l.order.paused ? 'Resume' : 'Pause'}
                  onClick={() => act(queuePause(game, c, l.at))}
                >
                  {l.order.paused ? '▶' : '❚❚'}
                </button>
                <button
                  className="icon-btn"
                  aria-label="Remove"
                  title="Take off the queue"
                  onClick={() => act(queueRemove(game, c, l.at))}
                >
                  ✕
                </button>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * The centre row: buildings that stand in the centre and need no plot (market, railway station,
 * defences…). What stands, what is queued, and what can be added, with its yields before → after.
 */
function CentrePanel({
  game,
  c,
  prod,
  act,
}: {
  game: GameState;
  c: City;
  prod: number;
  act: (r: Result) => void;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const row = centreRow(game, c);
  const options = CENTRE_LIST.filter(t => !centreProblem(game, c, t.id));
  if (!row.length && !options.length) return null;
  return (
    <section className="r4-centre">
      <h3 className="dc-h">
        Centre
        <InfoButton label="About the centre row">
          Built in the town centre: no plot needed. One of each; stone walls replace a palisade, a
          castle the walls.
        </InfoButton>
      </h3>
      <div className="r4-crow">
        {row.map(e => {
          const t = SLOT_TYPES[e.st.type!];
          return (
            <span
              key={e.i}
              className={`r4-cell ${e.st.built ? 'built' : 'planned'}`}
              title={`${t.name}${e.st.built ? '' : ' (queued)'}: ${t.note}`}
            >
              <Art
                k={`building/${t.id}`}
                size={30}
                fallback={
                  <span className="cell-glyph" style={{ background: GROUPS[t.group].color }}>
                    {t.glyph}
                  </span>
                }
              />
              <small>{t.name}</small>
            </span>
          );
        })}
        {options.map(t => (
          <button
            key={t.id}
            className={`r4-copt ${pick === t.id ? 'on' : ''}`}
            aria-pressed={pick === t.id}
            title={t.name}
            onClick={() => setPick(x => (x === t.id ? null : t.id))}
          >
            <Art
              k={`building/${t.id}`}
              size={30}
              fallback={
                <span className="cell-glyph" style={{ background: GROUPS[t.group].color }}>
                  {t.glyph}
                </span>
              }
            />
            <small>+ {t.name}</small>
          </button>
        ))}
      </div>
      {pick && options.some(t => t.id === pick) && (
        <div className="r4-cpick">
          <BuildTip game={game} c={c} typeId={pick} prod={prod} />
          <button
            className="primary"
            onClick={() => {
              act(planCentre(game, c, pick));
              setPick(null);
            }}
          >
            Build
          </button>
        </div>
      )}
    </section>
  );
}
