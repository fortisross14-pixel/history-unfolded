import type { GameState } from '../engine/types.ts';
import { GROUP_NAME, groupNews, locate, type NewsGroup, type NewsTarget } from './news.ts';

/** A turn's news in three groups; a line that is about something takes you there. */
export function NewsList({
  game,
  civId,
  lines,
  onGo,
  limit,
}: {
  game: GameState;
  civId: number;
  lines: string[];
  onGo: (t: NewsTarget) => void;
  /** show at most this many lines per group (the rest are counted) */
  limit?: number;
}) {
  const groups = groupNews(lines);
  return (
    <div className="news">
      {(['urgent', 'act', 'info'] as NewsGroup[]).map(g =>
        groups[g].length ? (
          <section key={g} className={`news-group news-${g}`}>
            <h4>
              {GROUP_NAME[g]} <small>{groups[g].length}</small>
            </h4>
            <ul>
              {groups[g].slice(0, limit ?? Infinity).map((l, i) => {
                const t = locate(game, civId, l);
                return (
                  <li key={i}>
                    {t ? (
                      <button className="link news-line" onClick={() => onGo(t)} title="Go there">
                        {l} <span aria-hidden>›</span>
                      </button>
                    ) : (
                      <span>{l}</span>
                    )}
                  </li>
                );
              })}
              {limit && groups[g].length > limit && (
                <li className="muted small">+{groups[g].length - limit}</li>
              )}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}
