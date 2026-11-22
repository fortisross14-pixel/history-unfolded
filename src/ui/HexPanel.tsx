import { districtAt } from '../engine/economy.ts';
import { within } from '../engine/hex.ts';
import { DEPOSITS } from '../data/goods.ts';
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
  const dist = districtAt(game, hex);
  const home = !dist
    ? game.cities.find(c => c.civId === civId && within({ w: m.w, h: m.h }, c.hex, 2).includes(hex))
    : undefined;
  const openFor = dist ? game.cities.find(c => c.id === dist.cityId && c.civId === civId) : home;
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
                {DEPOSITS[d.kind].name} {'★'.repeat(d.richness)}{' '}
                <Goods
                  goods={Object.fromEntries(
                    Object.entries(DEPOSITS[d.kind].yields).map(([k, n]) => [k, n * d.richness]),
                  )}
                />
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
          {dist && (
            <tr>
              <td>District</td>
              <td>
                {dist.name} ({dist.slots.filter(x => x.built).length}/
                {dist.slots.filter(x => x.type).length} built)
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {onOpenDistrict && openFor && (
        <button className="primary" onClick={() => onOpenDistrict(openFor.id)}>
          {dist ? 'Open district' : `Lay out a district (${openFor.name})`}
        </button>
      )}
    </div>
  );
}
