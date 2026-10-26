import { Trophy } from 'lucide-react';
import { displayYear } from '../engine/index.ts';
import type { WorldState } from '../types.ts';
import { type Sel, fmt } from './shared.tsx';

export function HallOfFame({ world, open }: { world: WorldState; open: (s: Sel) => void }) {
  const cats: [WorldState['hallOfFame'][number]['category'], string, string][] = [
    ['realm', 'Realms', 'Periods of overwhelming world power'],
    ['city', 'Cities', 'Urban centers that towered over their age'],
    ['character', 'Characters', 'The most famous people who ever lived'],
    ['battle', 'Battles', 'The most consequential clashes in recorded history'],
  ];
  const click = (e: WorldState['hallOfFame'][number]) => {
    if (e.category === 'realm') open({ type: 'realm', id: e.entityId });
    else if (e.category === 'city') open({ type: 'city', id: e.entityId });
    else if (e.category === 'character') open({ type: 'character', id: e.entityId });
    else open({ type: 'battle', id: e.entityId });
  };
  return (
    <main className="page hall-page">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">The immortal record</span>
          <h1>Hall of Fame</h1>
          <p className="page-intro">
            One entry represents a distinct period of dominance—not every century won by the same
            power.
          </p>
        </div>
        <Trophy className="hall-trophy" />
      </div>
      <div className="hall-grid">
        {cats.map(([cat, title, description]) => {
          const entries = (world.hallOfFame ?? [])
            .filter(e => e.category === cat)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
          return (
            <section className="hall-category" key={cat}>
              <div>
                <span className="eyebrow">Top five</span>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
              {entries.length ? (
                entries.map((e, i) => (
                  <button className="hall-entry" onClick={() => click(e)} key={e.id}>
                    <b>{i + 1}</b>
                    <span>
                      <strong>{e.name}</strong>
                      <small>
                        {displayYear(e.year)} · {e.subtitle}
                      </small>
                    </span>
                    <em>{fmt(e.score, cat === 'battle' ? 1 : 0)}</em>
                  </button>
                ))
              ) : (
                <p className="empty">No one has yet met the Hall of Fame threshold.</p>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
