import { campAt } from '../engine/raiders.ts';
import { SLOT_TYPES } from '../data/slots.ts';
import { landOf } from '../engine/economy.ts';
import { within } from '../engine/hex.ts';
import { SPECIAL_MIN, DEPOSITS } from '../data/goods.ts';
import { RELIEF, TERRAIN, VEGETATION } from '../data/terrain.ts';
import { depositVisible, territory } from '../engine/game.ts';
import { hexFood } from '../engine/mapgen.ts';
import type { GameState } from '../engine/types.ts';
import { Goods } from './bits.tsx';

export function HexPanel({
  game,
  hex,
  civId,
  onOpenDistrict,
}: {
  game: GameState;
  hex: number;
  civId: number;
  onOpenDistrict?: (cityId: number) => void;
}) {
  const m = game.map;
  if (!game.civs[civId].explored[hex]) {
    return (
      <div className="panel">
        <h2>Unexplored</h2>
        <p className="muted">Send scouts to see what lies here.</p>
      </div>
    );
  }
  const d = depositVisible(game, civId, hex) ? m.deposit[hex] : null;
  // the settlement whose land this is (its hex or one next to it)
  const worker = game.cities.find(c => landOf(game, c).includes(hex));
  const openFor = worker && worker.civId === civId ? worker : undefined;
  void within;
  const owner = territory(game)[hex];
  const parts = [
    TERRAIN[m.terrain[hex]].name,
    m.relief[hex] !== 'flat' ? RELIEF[m.relief[hex]].name : '',
    VEGETATION[m.vegetation[hex]].name,
    m.river[hex] ? 'River' : '',
  ].filter(Boolean);
  const moveCost =
    m.relief[hex] === 'mountains'
      ? 'impassable'
      : TERRAIN[m.terrain[hex]].water
        ? 'water'
        : String(1 + RELIEF[m.relief[hex]].moveCost + VEGETATION[m.vegetation[hex]].moveCost);
  return (
    <div className="panel">
      <h2>{parts.join(' · ')}</h2>
      {campAt(game, hex) && (
        <p className="bad small">
          <b>Raider camp.</b> Its bands pillage nearby settlements that are weakly held. March an
          army into it to burn it and take its hoard.
        </p>
      )}
      <table className="stats">
        <tbody>
          <tr>
            <td>Move cost</td>
            <td>{moveCost}</td>
          </tr>
          <tr>
            <td>Food</td>
            <td>{hexFood(m, hex)}</td>
          </tr>
          {d && (
            <tr>
              <td>Deposit</td>
              <td>
                {DEPOSITS[d.kind].name} <Goods goods={DEPOSITS[d.kind].yields} />
                <div className="muted small">
                  {(() => {
                    const info = DEPOSITS[d.kind];
                    const by = SLOT_TYPES[info.by]?.name.toLowerCase() ?? info.by;
                    return info.special
                      ? `A town beside it with ${SPECIAL_MIN}+ ${by}s in one district: each brings a unit.`
                      : `Any ${by} of a town beside it does better.`;
                  })()}
                  {DEPOSITS[d.kind].tech && !game.civs[civId].techs.includes(DEPOSITS[d.kind].tech!)
                    ? ` Needs ${DEPOSITS[d.kind].tech!.replace('-', ' ')}.`
                    : ''}
                </div>
              </td>
            </tr>
          )}
          <tr>
            <td>Owner</td>
            <td>{owner >= 0 ? game.civs[owner].name : 'Nobody'}</td>
          </tr>
          {game.roads[hex] === 1 && (
            <tr>
              <td>Road</td>
              <td>Half a move along roads</td>
            </tr>
          )}
          {worker && (
            <tr>
              <td>Worked by</td>
              <td>
                {worker.name}
                {worker.civId !== civId ? ` (${game.civs[worker.civId].name})` : ''}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {onOpenDistrict && openFor && (
        <button className="primary" onClick={() => onOpenDistrict(openFor.id)}>
          Open {openFor.name}
        </button>
      )}
    </div>
  );
}
