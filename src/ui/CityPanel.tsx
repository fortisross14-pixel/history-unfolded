import { marketCities, marketStock } from '../engine/economy.ts';
import {
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
}: {
  game: GameState;
  c: City;
  mine: boolean;
  onLevy: () => void;
  onSettlers: () => void;
  onOpen: () => void;
}) {
  const y = cityYield(game, c);
  const civ = game.civs[c.civId];
  const canLevy = c.pop - LEVY_PEOPLE >= MIN_CITY_POP;
  return (
    <div className="panel city">
      <div className="panel-head">
        <span className="swatch" style={{ background: civ.color }} />
        <div>
          <h2>{c.name}</h2>
          <div className="muted">
            {civ.name} · founded turn {c.founded}
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
                <td>Food</td>
                <td>
                  {y.food} grown, {y.eat} eaten →{' '}
                  <b className={y.surplus < 0 ? 'bad' : ''}>
                    {y.surplus >= 0 ? '+' : ''}
                    {y.surplus}
                  </b>{' '}
                  ({c.food}/10 to grow by 250)
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
                  {cityGuard(c).length} cohorts of townsfolk, {Math.round(c.guard * 100)}% ready
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
              : 'Not linked to other cities: build roads to share goods.'}
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
