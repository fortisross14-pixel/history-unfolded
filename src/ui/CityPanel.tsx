import { governorOf } from '../engine/dynasty.ts';
import { DISTRICT_CAP, marketCities, marketStock, TIER_NAME } from '../engine/economy.ts';
import { useState } from 'react';
import {
  growthCost,
  upgradeInfo,
  hasSlot,
  SHIP_CREW,
  cityGuard,
  cityYield,
  LEVY_PEOPLE,
  MIN_CITY_POP,
  SETTLERS_PEOPLE,
} from '../engine/game.ts';
import type { City, GameState } from '../engine/types.ts';
import { Goods } from './bits.tsx';

export function CityPanel({
  game,
  c,
  mine,
  onLevy,
  onSettlers,
  onOpen,
  onShip,
  onGovernor,
}: {
  game: GameState;
  c: City;
  mine: boolean;
  onLevy: () => void;
  onSettlers: () => void;
  onOpen: () => void;
  onShip: (designId: number) => void;
  onGovernor?: (dynastyId: number) => void;
}) {
  const y = cityYield(game, c);
  const civ = game.civs[c.civId];
  const canLevy = c.pop - LEVY_PEOPLE >= MIN_CITY_POP;
  const [ship, setShip] = useState(0);
  return (
    <div className="panel city">
      <div className="panel-head">
        <span className="swatch" style={{ background: civ.color }} />
        <div>
          <h2>{c.name}</h2>
          <div className="muted">
            {TIER_NAME[c.tier]} · {civ.name} · founded turn {c.founded}
          </div>
        </div>
      </div>
      {mine ? (
        <>
          <table className="stats">
            <tbody>
              <tr>
                <td>Population</td>
                <td>{c.pop.toLocaleString()} people</td>
              </tr>
              <tr>
                <td>Governor</td>
                <td>
                  {(() => {
                    const civ2 = game.civs[c.civId];
                    const gov = governorOf(game, c);
                    if (!gov) return '—';
                    return civ2.dynasties.length > 1 ? (
                      <select value={gov.id} onChange={e => onGovernor?.(Number(e.target.value))}>
                        {civ2.dynasties.map(d => (
                          <option key={d.id} value={d.id}>
                            House {d.name}
                            {d.id === civ2.ruling ? ' (throne)' : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      `House ${gov.name} (throne)`
                    );
                  })()}
                </td>
              </tr>
              <tr>
                <td>Districts</td>
                <td>
                  {game.districts.filter(d => d.cityId === c.id).length}/{DISTRICT_CAP[c.tier]}
                  {(() => {
                    const u = upgradeInfo(game, c);
                    if (!u.to) return null;
                    return (
                      <span className="muted">
                        {' '}
                        ·{' '}
                        {u.problem
                          ? `a ${u.to} at ${u.pop.toLocaleString()} people`
                          : `ready to become a ${u.to}`}
                      </span>
                    );
                  })()}
                </td>
              </tr>
              <tr>
                <td>Food</td>
                <td>
                  {y.food} grown, {y.eat} eaten →{' '}
                  <b className={y.surplus < 0 ? 'bad' : ''}>
                    {y.surplus >= 0 ? '+' : ''}
                    {Math.round(y.surplus * 10) / 10}
                  </b>{' '}
                  ({Math.floor(c.food)}/{growthCost(game, c)} to grow by 250)
                  {y.surplus < 0 && marketCities(game, c).length > 1 && (
                    <span className="muted"> · towns in its market send food</span>
                  )}
                </td>
              </tr>
              <tr>
                <td>Science</td>
                <td>+{y.science}/turn</td>
              </tr>
              <tr>
                <td>Gold</td>
                <td>+{y.gold}/turn</td>
              </tr>
              <tr>
                <td>Guard</td>
                <td>
                  {cityGuard(game, c).length} cohorts of townsfolk, {Math.round(c.guard * 100)}%
                  ready
                </td>
              </tr>
              <tr>
                <td>Goods</td>
                <td>
                  <Goods goods={y.goods} empty="none" /> per turn
                </td>
              </tr>
            </tbody>
          </table>
          <h3>Store</h3>
          <p>
            <Goods goods={marketStock(game, c)} empty="empty" />
          </p>
          <p className="muted small">
            {marketCities(game, c).length > 1
              ? `Shared with ${marketCities(game, c)
                  .slice(1)
                  .map(x => x.name)
                  .join(', ')} by road or river.`
              : 'Not linked to other settlements: build roads to share goods and food.'}
          </p>
          <div className="actions">
            <button className="primary" onClick={onOpen}>
              City &amp; districts…
            </button>
            <button
              disabled={!canLevy}
              onClick={onLevy}
              title={canLevy ? '' : `Needs ${MIN_CITY_POP + LEVY_PEOPLE} people`}
            >
              Raise levy (5 cohorts, 500 people)
            </button>
            <button
              disabled={c.pop - SETTLERS_PEOPLE < MIN_CITY_POP}
              onClick={onSettlers}
              title={`Settlers take ${SETTLERS_PEOPLE} people (with families) to found a new city`}
            >
              Send settlers ({SETTLERS_PEOPLE.toLocaleString()} people)
            </button>
          </div>
          {(!canLevy || c.pop - SETTLERS_PEOPLE < MIN_CITY_POP) && (
            <p className="muted small why">
              {!canLevy && `A levy needs ${(MIN_CITY_POP + LEVY_PEOPLE).toLocaleString()} people. `}
              {c.pop - SETTLERS_PEOPLE < MIN_CITY_POP &&
                `Settlers need ${(MIN_CITY_POP + SETTLERS_PEOPLE).toLocaleString()} people.`}
            </p>
          )}
          {hasSlot(game, c, 'shipyard') ? (
            <div className="row ship-row">
              <select value={ship} onChange={e => setShip(Number(e.target.value))}>
                <option value={0}>Build a ship…</option>
                {civ.designs
                  .filter(d => d.naval)
                  .map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
              <button disabled={!ship} onClick={() => onShip(ship)}>
                Launch ({SHIP_CREW} crew)
              </button>
            </div>
          ) : (
            <p className="muted small">
              A shipyard (after Sailing, in a district by the water) lets the city build ships.
            </p>
          )}
          {hasSlot(game, c, 'shipyard') && !civ.designs.some(d => d.naval) && (
            <p className="muted small">Design a ship first (Unit designs → Ships).</p>
          )}
          <p className="muted small">
            {y.workersUsed.toLocaleString()} of {y.workers.toLocaleString()} workers busy · room for{' '}
            {y.housing.toLocaleString()} people.
          </p>
        </>
      ) : (
        <p className="muted">
          Guard {Math.round(c.guard * 100)}% ready. A foreign city of about{' '}
          {(Math.round(c.pop / 500) * 500).toLocaleString()} people.
        </p>
      )}
    </div>
  );
}
