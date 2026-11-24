import { colonyLimits, promoteInfo } from '../engine/colonies.ts';
import { WONDERS } from '../data/wonders.ts';
import { wondersIn } from '../engine/wonders.ts';
import { CONVERT_TURNS, faithById } from '../engine/faith.ts';
import { governorOf } from '../engine/dynasty.ts';
import { Icon } from './icons.tsx';
import {
  builderPlan,
  DISTRICT_CAP,
  marketCities,
  marketStock,
  rankOf,
  TIER_NAME,
} from '../engine/economy.ts';
import { WONDER_SHARE } from '../engine/wonders.ts';
import { useState } from 'react';
import { ageOf } from '../data/techs.ts';
import {
  CREW,
  growthCost,
  upgradeInfo,
  hasSlot,
  SHIP_CREW,
  cityGuard,
  siegeBreached,
  SIEGE_BREACH,
  SIEGE_COHORTS,
  cityYield,
  LEVY_PEOPLE,
  MIN_CITY_POP,
  SETTLERS_PEOPLE,
  territoryRadius,
} from '../engine/game.ts';
import type { City, GameState } from '../engine/types.ts';
import { Chip, Delta, Ico, InfoButton } from './bits.tsx';
import { GOODS } from '../data/goods.ts';
import './declutter-city.css';
import { CivBadge } from './Badge.tsx';

export function CityPanel({
  game,
  c,
  mine,
  onLevy,
  onSettlers,
  onOpen,
  onShip,
  onGovernor,
  onRename,
  onCrew,
  onAuto,
  onWonder,
  onPromote,
}: {
  game: GameState;
  c: City;
  mine: boolean;
  onLevy: () => void;
  onSettlers: () => void;
  onOpen: () => void;
  onShip: (designId: number) => void;
  onGovernor?: (dynastyId: number) => void;
  onRename?: (name: string) => void;
  onCrew?: (kind: 'workers' | 'engineers') => void;
  onAuto?: (on: boolean) => void;
  onWonder?: () => void;
  onPromote?: () => void;
}) {
  const y = cityYield(game, c);
  const civ = game.civs[c.civId];
  const canLevy = c.pop - LEVY_PEOPLE >= MIN_CITY_POP;
  const [ship, setShip] = useState(0);
  const [renaming, setRenaming] = useState(false);
  return (
    <div className="panel city">
      <div className="panel-head">
        <CivBadge civ={civ} size={26} />
        <div>
          {renaming ? (
            <input
              className="rename"
              autoFocus
              defaultValue={c.name}
              maxLength={24}
              onBlur={e => {
                onRename?.(e.target.value);
                setRenaming(false);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setRenaming(false);
              }}
            />
          ) : (
            <h2>
              {c.name}{' '}
              {mine && onRename && (
                <button className="link small" onClick={() => setRenaming(true)} title="Rename">
                  ✎
                </button>
              )}
            </h2>
          )}
          <div className="muted" title={`Founded turn ${c.founded}`}>
            {c.colony ? 'Colony' : TIER_NAME[c.tier]} · {civ.name}
          </div>
        </div>
      </div>
      {mine ? (
        <>
          <div className="chips dc-stats">
            <Chip icon="people" n={c.pop.toLocaleString()} title="People" />
            <span
              className="chip"
              title={`Food a turn: ${y.food} grown, ${y.eat} eaten; ${Math.floor(c.food)}/${growthCost(game, c)} stored to grow by 250${y.surplus < 0 && marketCities(game, c).length > 1 ? '; towns in its market send food' : ''}`}
              aria-label="Food a turn"
            >
              <Ico name="food" fallback="•" size={18} />
              <Delta n={y.surplus} />
              <small className="muted">
                {Math.floor(c.food)}/{growthCost(game, c)}
              </small>
            </span>
            <Chip icon="science" n={y.science} title="Science a turn" />
            <Chip icon="gold" n={y.gold} title="Gold a turn" />
            <Chip
              icon="protection"
              n={`${cityGuard(game, c).length} · ${Math.round(c.guard * 100)}%`}
              title="Guard: cohorts of townsfolk, readiness"
            />
            {(() => {
              const u = upgradeInfo(game, c);
              return (
                <span
                  className="chip"
                  title={
                    u.to ? `Districts · ${TIER_NAME[u.to]}: ${u.problem ?? 'ready'}` : 'Districts'
                  }
                >
                  <Ico name="district" fallback="▦" size={18} />
                  <b>
                    {game.districts.filter(d => d.cityId === c.id).length}/{DISTRICT_CAP[c.tier]}
                  </b>
                  {u.to && !u.problem && <span className="good">↑</span>}
                </span>
              );
            })()}
            <Chip
              icon="workers"
              n={`${y.workersUsed.toLocaleString()}/${y.workers.toLocaleString()}`}
              title="Workers busy"
            />
          </div>
          <div className="dc-line">
            <GoodsChips goods={y.goods} unit=" a turn" />
          </div>
          <BuildersRow game={game} c={c} prod={y.prod} />
          {(() => {
            const civ2 = game.civs[c.civId];
            const gov = governorOf(game, c);
            if (!gov) return null;
            return (
              <div className="dc-line" title="Governor">
                <Ico name="crown" fallback="♔" size={18} />
                {civ2.dynasties.length > 1 ? (
                  <select
                    value={gov.id}
                    aria-label="Governor"
                    onChange={e => onGovernor?.(Number(e.target.value))}
                  >
                    {civ2.dynasties.map(d => (
                      <option key={d.id} value={d.id}>
                        House {d.name}
                        {d.id === civ2.ruling ? ' (throne)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  `House ${gov.name} (throne)`
                )}
              </div>
            );
          })()}
          <FaithRow game={game} c={c} />
          <WonderRow game={game} c={c} />
          {c.siege && (
            <div className="dc-line bad">
              <Ico name="war" fallback="⚔" size={18} /> Besieged by the {game.civs[c.siege.by].name}{' '}
              · {game.turn - c.siege.since} turns ·{' '}
              {siegeBreached(game, c)
                ? 'walls breached'
                : `walls fall in ${SIEGE_BREACH - (game.turn - c.siege.since)}`}
              <InfoButton label="About the siege">
                No growth; the guard starves. Drive off the troops around it to lift it.
              </InfoButton>
            </div>
          )}
          <h3 className="dc-h">
            Store
            <InfoButton label="About the store">
              {marketCities(game, c).length > 1
                ? `Shared with ${marketCities(game, c)
                    .slice(1)
                    .map(x => x.name)
                    .join(', ')} by road or river.`
                : 'Unlinked: roads share goods and food.'}
            </InfoButton>
          </h3>
          <div className="dc-line">
            {marketCities(game, c).length > 1 && (
              <Chip
                icon="road"
                n={marketCities(game, c).length}
                title="Settlements in this market"
              />
            )}
            <GoodsChips goods={marketStock(game, c)} unit=" in store" />
          </div>
          <div className="actions">
            <button className="primary" onClick={onOpen}>
              <Icon name="city" /> City &amp; districts…
            </button>
            <button
              disabled={!canLevy}
              onClick={onLevy}
              title={
                canLevy
                  ? `5 cohorts, ${LEVY_PEOPLE} people`
                  : `Needs ${(MIN_CITY_POP + LEVY_PEOPLE).toLocaleString()} people`
              }
            >
              <Icon name="flag" /> Raise levy
              <Chip icon="people" n={`−${LEVY_PEOPLE}`} title="People" />
            </button>
            <button
              disabled={c.pop - SETTLERS_PEOPLE < MIN_CITY_POP}
              onClick={onSettlers}
              title={
                c.pop - SETTLERS_PEOPLE < MIN_CITY_POP
                  ? `Needs ${(MIN_CITY_POP + SETTLERS_PEOPLE).toLocaleString()} people`
                  : 'Settlers found a new settlement'
              }
            >
              <Icon name="people" /> Settlers
              <Chip icon="people" n={`−${SETTLERS_PEOPLE.toLocaleString()}`} title="People" />
            </button>
            {c.colony && onPromote && <ColonyRow game={game} c={c} onPromote={onPromote} />}
            {onWonder && rankOf(c.tier) >= rankOf('town') && (
              <button onClick={onWonder} title="World wonders: one of each in the world">
                {c.wonder ? WONDERS[c.wonder.id].name : 'Wonder…'}
              </button>
            )}
            <button
              disabled={c.pop - CREW.workers.people < MIN_CITY_POP || civ.gold < CREW.workers.gold}
              onClick={() => onCrew?.('workers')}
              title="Workers build roads"
            >
              <Ico name="workers" fallback="⚒" size={16} /> Workers
              <Chip icon="people" n={`−${CREW.workers.people}`} title="People" />
              <Chip icon="gold" n={`−${CREW.workers.gold}`} title="Gold" />
            </button>
            {ageOf(civ.techs) >= 5 && (
              <button
                disabled={
                  c.pop - CREW.engineers.people < MIN_CITY_POP || civ.gold < CREW.engineers.gold
                }
                onClick={() => onCrew?.('engineers')}
                title="Engineers build roads and railways"
              >
                <Ico name="equip" fallback="⚙" size={16} /> Engineers
                <Chip icon="people" n={`−${CREW.engineers.people}`} title="People" />
                <Chip icon="gold" n={`−${CREW.engineers.gold}`} title="Gold" />
              </button>
            )}
            {onAuto && (
              <label
                className="auto-toggle"
                title="The governor lays out districts and chooses buildings each turn"
              >
                <input
                  type="checkbox"
                  checked={!!c.auto}
                  onChange={e => onAuto(e.target.checked)}
                />{' '}
                Governor plans
              </label>
            )}
          </div>
          {(!canLevy || c.pop - SETTLERS_PEOPLE < MIN_CITY_POP) && (
            <p className="muted small why">
              {!canLevy && `Levy: ${(MIN_CITY_POP + LEVY_PEOPLE).toLocaleString()} people. `}
              {c.pop - SETTLERS_PEOPLE < MIN_CITY_POP &&
                `Settlers: ${(MIN_CITY_POP + SETTLERS_PEOPLE).toLocaleString()} people.`}
            </p>
          )}
          {hasSlot(game, c, 'shipyard') && (
            <div className="row ship-row">
              <select
                value={ship}
                aria-label="Ship"
                onChange={e => setShip(Number(e.target.value))}
              >
                <option value={0}>Ship…</option>
                {civ.designs
                  .filter(d => d.naval)
                  .map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
              <button disabled={!ship} onClick={() => onShip(ship)} title={`${SHIP_CREW} crew`}>
                Launch <Chip icon="people" n={`−${SHIP_CREW}`} title="Crew" />
              </button>
            </div>
          )}
          {hasSlot(game, c, 'shipyard') && !civ.designs.some(d => d.naval) && (
            <p className="muted small">No ship designs.</p>
          )}
        </>
      ) : (
        <div className="chips dc-stats">
          <Chip
            icon="people"
            n={`~${(Math.round(c.pop / 500) * 500).toLocaleString()}`}
            title="People, about"
          />
          <Chip icon="protection" n={`${Math.round(c.guard * 100)}%`} title="Guard ready" />
          {c.siege ? (
            <span className="chip bad" title="Besieged">
              <Ico name="war" fallback="⚔" size={18} />
              <b>
                {game.turn - c.siege.since}
                {siegeBreached(game, c)
                  ? ' · breached'
                  : ` · falls in ${SIEGE_BREACH - (game.turn - c.siege.since)}`}
              </b>
            </span>
          ) : (
            <InfoButton label="About sieges">Siege: {SIEGE_COHORTS}+ cohorts around it.</InfoButton>
          )}
        </div>
      )}
    </div>
  );
}

/** Each good as its icon and a number. */
function GoodsChips({ goods, unit }: { goods: Record<string, number>; unit: string }) {
  const list = Object.entries(goods).filter(([, n]) => n > 0);
  if (!list.length) return <span className="muted">—</span>;
  return (
    <>
      {list.map(([k, n]) => (
        <Chip
          key={k}
          good={k}
          n={Math.round(n * 10) / 10}
          title={`${GOODS[k]?.name ?? k}${unit}`}
        />
      ))}
    </>
  );
}

/** The faith a settlement keeps, and any other gaining ground. */
function FaithRow({ game, c }: { game: GameState; c: City }) {
  const f = faithById(game, c.faith);
  const g = c.conv ? faithById(game, c.conv.f) : undefined;
  if (!f && !g) return null;
  return (
    <div className="dc-line" title="Faith">
      <Ico name="sun" fallback="☼" size={18} />
      {f ? (
        <>
          {f.name}
          {f.holy === c.id ? <b> · holy city</b> : null}
        </>
      ) : (
        <span className="muted">—</span>
      )}
      {g && (
        <small className="muted" title={`${g.name} gaining ground`}>
          {' '}
          · {g.name} ↑ {c.conv!.n}/{CONVERT_TURNS}
        </small>
      )}
    </div>
  );
}

/** The wonders a settlement holds, and the one being built. */
function WonderRow({ game, c }: { game: GameState; c: City }) {
  const held = wondersIn(game, c.id);
  if (!held.length && !c.wonder) return null;
  const w = c.wonder && WONDERS[c.wonder.id];
  return (
    <div className="dc-line" title="Wonders">
      <Ico name="laurel" fallback="✦" size={18} />
      {held.map(x => x.name).join(', ')}
      {held.length && w ? ' · ' : ''}
      {w && (
        <span title={`Building the ${w.name}`}>
          {w.name} {Math.floor((c.wonder!.progress / w.prod) * 100)}%
        </span>
      )}
    </div>
  );
}

/** A colony: what it may do, and making it a town once the realm reaches it. */
function ColonyRow({ game, c, onPromote }: { game: GameState; c: City; onPromote: () => void }) {
  const info = promoteInfo(game, c, territoryRadius(game, c.civId));
  const lim = colonyLimits(game, c);
  return (
    <div className="colony-row small dc-line">
      <span className="muted">
        Colony:{' '}
        {lim?.gatherOnly ? '1 district, gathering' : lim ? 'up to 4 districts' : 'no limits'}
      </span>
      <InfoButton label="About colonies">
        Its goods reach the realm by road, or by sea with a harbour.
      </InfoButton>
      {info && (
        <button disabled={!!info.problem} title={info.problem ?? undefined} onClick={onPromote}>
          Make town <Chip icon="gold" n={`−${info.gold}`} title="Gold" />
        </button>
      )}
      {info?.problem && <small className="muted">{info.problem}</small>}
    </div>
  );
}

/** The builders: how many are busy, and what the queue is putting up first. */
function BuildersRow({ game, c, prod }: { game: GameState; c: City; prod: number }) {
  const p = builderPlan(game, c, prod * (c.wonder ? 1 - WONDER_SHARE : 1));
  const going = p.lines.filter(l => l.state === 'building');
  return (
    <div className="dc-line r4-builders" title="Builders and the queue">
      <Chip icon="production" n={`${p.busy}/${p.builders}`} title="Builders busy" />
      {going.slice(0, 2).map(l => (
        <span key={`${l.d.id}:${l.order.slot}`} className="chip" title={`${l.t.name}: turns left`}>
          {l.t.name}
          <b>{l.turns ?? '—'}</b>
          <Ico name="end-turn" fallback="⧗" size={14} />
        </span>
      ))}
      {p.lines.length > Math.min(2, going.length) && (
        <span className="muted small">+{p.lines.length - Math.min(2, going.length)}</span>
      )}
    </div>
  );
}
