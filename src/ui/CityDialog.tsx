import { useMemo, useState } from 'react';
import { DEPOSITS, GOODS } from '../data/goods.ts';
import { GROUPS, SLOT_LIST, SLOT_TYPES, type SlotGroup, type Yield } from '../data/slots.ts';
import { RELIEF, TERRAIN, VEGETATION } from '../data/terrain.ts';
import {
  cityDistricts,
  cityEconomy,
  constructionQueue,
  districtAt,
  districtSites,
  DISTRICT_RADIUS,
  marketCities,
  marketStock,
  slotProblem,
  type Totals,
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
  territory,
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

/** The city screen: hexes around the city, the 3×3 district designer, construction and market. */
export function CityDialog({ game, c, startHex, report, onClose }: Props) {
  const [, setV] = useState(0);
  const bump = () => setV(v => v + 1);
  const act = (r: Result) => {
    report(r);
    bump();
  };
  const [hex, setHex] = useState<number>(startHex ?? c.hex);
  const [cell, setCell] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [bpName, setBpName] = useState('');
  const [bpPick, setBpPick] = useState<number | ''>('');
  const civ = game.civs[c.civId];
  const g = { w: game.map.w, h: game.map.h };
  const owner = useMemo(() => territory(game), [game.turn, game.cities.length]);
  const sites = new Set(districtSites(game, c, owner));
  const e = cityEconomy(game, c);
  const d = districtAt(game, hex);
  const mineD = d && d.cityId === c.id ? d : undefined;
  const centre = hex === c.hex;
  const queue = constructionQueue(game, c);
  const market = marketCities(game, c);
  const stock = marketStock(game, c);
  const m = game.map;

  // ---- mini map of the city's hexes
  const ring = within(g, c.hex, DISTRICT_RADIUS);
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
            {c.name}{' '}
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
            <h3>Land around {c.name}</h3>
            <svg viewBox={`${-S * 4.6} ${-S * 3.8} ${S * 9.2} ${S * 7.6}`} className="hexmap">
              {ring.map(h => {
                const [x, y] = centerUnit(g, h);
                const px = (x - ox) * S,
                  py = (y - oy) * S;
                const dist = districtAt(game, h);
                const ok = sites.has(h) || h === c.hex;
                const known = civ.explored[h];
                const dep = known && depositVisible(game, c.civId, h) ? m.deposit[h] : null;
                return (
                  <g
                    key={h}
                    className={`hx ${ok ? '' : 'off'} ${h === hex ? 'on' : ''}`}
                    onClick={() => {
                      setHex(h);
                      setCell(null);
                    }}
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
                    {dist &&
                      dist.slots.map((st, i) => (
                        <rect
                          key={i}
                          x={px - 13 + (i % 3) * 9}
                          y={py - 9 + Math.floor(i / 3) * 9}
                          width={8}
                          height={8}
                          rx={1.5}
                          fill={
                            st.type
                              ? GROUPS[SLOT_TYPES[st.type].group].color
                              : 'rgba(255,255,255,0.4)'
                          }
                          opacity={st.built ? 1 : 0.4}
                        />
                      ))}
                    {h === c.hex && (
                      <text x={px} y={py + S * 0.75} className="hx-name">
                        centre
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <p className="muted small">{hexLabel(hex)}</p>
            <h3>Market</h3>
            <p className="small">
              {market.length > 1
                ? `${market.map(x => x.name).join(', ')} share one store.`
                : 'Not linked to other cities. Roads and rivers join cities into one market.'}
            </p>
            <p className="small">
              <Goods goods={stock} empty="empty" />
            </p>
            <h3>Being built</h3>
            {queue.length === 0 && (
              <p className="muted small">Nothing planned. Pick a hex and lay out a district.</p>
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
            {mineD ? (
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
            ) : d ? (
              <p className="muted">This hex belongs to another city.</p>
            ) : sites.has(hex) ? (
              <div className="new-district">
                <h3>Lay out a district on this hex</h3>
                <p className="muted small">
                  {hexLabel(hex)}. Buildings here can use anything on this hex and the six around
                  it.
                </p>
                <input
                  className="design-name"
                  placeholder="Name it: Farm, Northern Mine, Financial District…"
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
                      act(
                        placeDistrict(
                          game,
                          c.id,
                          hex,
                          newName || b?.name || 'District',
                          b?.slots ?? [],
                        ),
                      );
                      setNewName('');
                    }}
                  >
                    Lay out district
                  </button>
                </div>
              </div>
            ) : (
              <p className="muted">
                {game.map.terrain[hex] === 'coast' ||
                game.map.terrain[hex] === 'ocean' ||
                game.map.terrain[hex] === 'lake'
                  ? 'Water: no district here (a fishing dock next to it can use it).'
                  : `Not ${c.name}'s land. Districts go on the city's own hexes within ${DISTRICT_RADIUS}.`}
              </p>
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
                {sel.t?.fixed ? (
                  <p className="muted small">The town hall stays.</p>
                ) : (
                  groups.map(gr => (
                    <div key={gr}>
                      <h3 className="pal-group" style={{ color: GROUPS[gr].color }}>
                        {GROUPS[gr].name}
                      </h3>
                      <div className="pal-items">
                        {SLOT_LIST.filter(t => t.group === gr).map(t => {
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
                  ))
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
                    Buildings use what is on the district's hex and the six around it: forest for
                    woodlots, deposits for mines, flat land for fields.
                  </li>
                  <li>
                    Mines run at full rate for richness × 2 slots; past that, half rate. A deposit
                    feeds one district only.
                  </li>
                  <li>
                    Neighbours matter: an infirmary in the middle boosts four mines; banks next to
                    banks earn more; pigs next to grain grow fatter.
                  </li>
                  <li>Houses make room for people. Without room the city stops growing.</li>
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
