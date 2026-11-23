import { ruinAt } from '../engine/ruins.ts';
import { campAt } from '../engine/raiders.ts';
import { SLOT_TYPES } from '../data/slots.ts';
import { landOf } from '../engine/economy.ts';
import { within } from '../engine/hex.ts';
import { SPECIAL_MIN, DEPOSITS } from '../data/goods.ts';
import { RELIEF, TERRAIN, VEGETATION } from '../data/terrain.ts';
import { depositVisible, territory } from '../engine/game.ts';
import { hexFood } from '../engine/mapgen.ts';
import type { GameState } from '../engine/types.ts';
import { Chip, Goods, InfoButton } from './bits.tsx';
import './declutter-map.css';

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
      ? '✕'
      : TERRAIN[m.terrain[hex]].water
        ? '—'
        : String(1 + RELIEF[m.relief[hex]].moveCost + VEGETATION[m.vegetation[hex]].moveCost);
  const dep = d ? DEPOSITS[d.kind] : null;
  const depTech =
    dep?.tech && !game.civs[civId].techs.includes(dep.tech) ? dep.tech.replace('-', ' ') : null;
  return (
    <div className="panel hex-panel">
      <h2>{parts.join(' · ')}</h2>
      <span className="chips hp-chips">
        <Chip
          icon="moves"
          n={moveCost}
          title={
            moveCost === '✕' ? 'Impassable' : moveCost === '—' ? 'Water' : `Move cost ${moveCost}`
          }
        />
        <Chip icon="food" n={hexFood(m, hex)} title="Food" />
        {game.roads[hex] === 1 && (
          <span className="fp-tag" title="Half a move along roads">
            Road
          </span>
        )}
        {ruinAt(game, hex) && (
          <span className="fp-tag good" title="First unit here takes the find">
            Ruins
          </span>
        )}
        {campAt(game, hex) && (
          <span className="fp-tag bad" title="Raids weakly held settlements; an army burns it">
            Raider camp
          </span>
        )}
      </span>
      {dep && (
        <div className="hp-deposit">
          <b>{dep.name}</b> <Goods goods={dep.yields} />
          {depTech && <span className="fp-tag bad">Needs {depTech}</span>}
          <InfoButton label={`About ${dep.name}`}>
            {(() => {
              const by = SLOT_TYPES[dep.by]?.name.toLowerCase() ?? dep.by;
              return dep.special
                ? `Town beside it, ${SPECIAL_MIN}+ ${by}s in one district: +1 unit each.`
                : `Better for a ${by} of a town beside it.`;
            })()}
          </InfoButton>
        </div>
      )}
      {(owner >= 0 || worker) && (
        <div className="muted small hp-owner">
          <span title="Owner">{owner >= 0 ? game.civs[owner].name : ''}</span>
          {worker && (
            <span title="Worked by">
              {owner >= 0 ? ' · ' : ''}
              {worker.name}
            </span>
          )}
        </div>
      )}
      {onOpenDistrict && openFor && (
        <button className="primary" onClick={() => onOpenDistrict(openFor.id)}>
          Open {openFor.name}
        </button>
      )}
    </div>
  );
}
