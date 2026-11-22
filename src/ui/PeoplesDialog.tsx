import { atWar, militaryPower, type Result } from '../engine/game.ts';
import type { GameState } from '../engine/types.ts';

interface Props {
  game: GameState;
  civId: number;
  onWar: (other: number) => void;
  onPeace: (other: number) => void;
  onClose: () => void;
}

export function PeoplesDialog({ game, civId, onWar, onPeace, onClose }: Props) {
  const me = game.civs[civId];
  const mine = militaryPower(game, civId);
  const known = game.civs.filter(c => c.id !== civId && me.met.includes(c.id));
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal peoples" onClick={e => e.stopPropagation()}>
        <header>
          <h2>Peoples</h2>
          <button className="x" onClick={onClose}>
            ×
          </button>
        </header>
        {!known.length && <p className="muted">You have met no one yet. Send scouts out.</p>}
        <table className="stats peoples-table">
          <tbody>
            <tr className="muted small">
              <td>People</td>
              <td>Cities</td>
              <td>Army strength</td>
              <td>Status</td>
              <td />
            </tr>
            {known.map(c => {
              const war = atWar(game, civId, c.id);
              const p = militaryPower(game, c.id);
              const w = game.wars.find(
                x => (x.a === civId && x.b === c.id) || (x.b === civId && x.a === c.id),
              );
              return (
                <tr key={c.id}>
                  <td>
                    <span className="swatch" style={{ background: c.color }} /> {c.name}
                  </td>
                  <td>{c.alive ? game.cities.filter(x => x.civId === c.id).length : '—'}</td>
                  <td>
                    {c.alive
                      ? `${p} (${mine ? Math.round((p / Math.max(1, mine)) * 100) : '∞'}% of yours)`
                      : '—'}
                  </td>
                  <td>
                    {!c.alive ? (
                      'Gone'
                    ) : war ? (
                      <b className="bad">War since turn {w?.since}</b>
                    ) : (
                      'Peace'
                    )}
                  </td>
                  <td>
                    {c.alive &&
                      (war ? (
                        <button onClick={() => onPeace(c.id)}>Offer peace</button>
                      ) : (
                        <button onClick={() => onWar(c.id)}>Declare war</button>
                      ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted small">Your army strength: {mine}.</p>
      </div>
    </div>
  );
}
export type { Result };
