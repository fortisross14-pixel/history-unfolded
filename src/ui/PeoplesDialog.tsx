import { atWar, militaryPower, type Result } from '../engine/game.ts';
import type { GameState } from '../engine/types.ts';
import { identity, tagCounts } from '../engine/mods.ts';
import { OPPOSED, TAGS } from '../data/culture.ts';
import { TagChip } from './CultureDialog.tsx';

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
  const mineTags = tagCounts(me);
  /** kindred or clashing ideas colour how peoples see each other */
  const relation = (other: number) => {
    const theirs = tagCounts(game.civs[other]);
    const strong = (t: Record<string, number>, k: string) => (t[k] ?? 0) >= 2;
    const clash = OPPOSED.filter(
      ([a, b]) =>
        (strong(mineTags, a) && strong(theirs, b)) || (strong(mineTags, b) && strong(theirs, a)),
    );
    const shared = Object.keys(mineTags).filter(t => strong(mineTags, t) && strong(theirs, t));
    if (clash.length)
      return `Clashing ideas (${clash.map(([a, b]) => `${TAGS[a].name}/${TAGS[b].name}`).join(', ')}): quicker to war`;
    if (shared.length >= 2)
      return `Kindred (${shared.map(t => TAGS[t].name).join(', ')}): slow to war`;
    return '';
  };
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
              <td>Identity</td>
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
                  <td>
                    {identity(c)
                      .slice(0, 3)
                      .map(i => (
                        <TagChip key={i.tag} tag={i.tag} />
                      ))}
                    <div className="muted small">{relation(c.id)}</div>
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
