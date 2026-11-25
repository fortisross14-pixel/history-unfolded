import { useState } from 'react';
import { codexEntry, searchCodex, type CodexEntry } from './codex.ts';
import { GoodIcon } from './bits.tsx';
import './r4-goods.css';

/** Searchable help: every term of the game, basics first. Entries link to each other. */
export function CodexDialog({
  q: initial,
  entry,
  onKeys,
  onClose,
}: {
  q?: string;
  /** open this entry (by id) first */
  entry?: string;
  onKeys?: () => void;
  onClose: () => void;
}) {
  const first = entry ? codexEntry(entry) : undefined;
  const [q, setQ] = useState(initial ?? first?.title ?? '');
  const results = searchCodex(q);
  const [open, setOpen] = useState<CodexEntry | null>(first ?? results[0] ?? null);
  // entries reached by a link, for the way back
  const [trail, setTrail] = useState<CodexEntry[]>([]);
  const shown =
    open && (results.includes(open) || trail.length > 0 || open === first)
      ? open
      : (results[0] ?? null);
  const go = (id: string) => {
    const e = codexEntry(id);
    if (!e) return;
    if (shown) setTrail(t => [...t, shown]);
    setOpen(e);
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal codex"
        role="dialog"
        aria-modal="true"
        aria-label="Codex"
        onClick={e => e.stopPropagation()}
      >
        <header>
          <h2>Codex</h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="codex-search">
          <input
            autoFocus
            placeholder="Search"
            value={q}
            onChange={e => {
              setQ(e.target.value);
              setTrail([]);
              setOpen(null);
            }}
            onKeyDown={e => e.stopPropagation()}
            aria-label="Search the Codex"
          />
          {onKeys && (
            <button className="secondary" onClick={onKeys} title="Keys and mouse">
              Keys
            </button>
          )}
        </div>
        <div className="codex-body">
          <ul className="codex-list">
            {results.map(e => (
              <li key={e.id}>
                <button
                  className={`link ${shown?.id === e.id ? 'on' : ''}`}
                  onClick={() => {
                    setTrail([]);
                    setOpen(e);
                  }}
                >
                  {e.title} <small className="muted">{e.group}</small>
                </button>
              </li>
            ))}
            {!results.length && <li className="muted">Nothing found.</li>}
          </ul>
          {shown && (
            <article className="codex-entry" data-entry={shown.id}>
              <h3>
                {trail.length > 0 && (
                  <button
                    className="link cx-back"
                    aria-label="Back"
                    title={`Back to ${trail[trail.length - 1].title}`}
                    onClick={() => {
                      setOpen(trail[trail.length - 1]);
                      setTrail(t => t.slice(0, -1));
                    }}
                  >
                    ←
                  </button>
                )}
                {shown.id.startsWith('good-') && <GoodIcon id={shown.id.slice(5)} size={22} />}{' '}
                {shown.title}
              </h3>
              <p className="muted small">{shown.group}</p>
              <p>{shown.text}</p>
              {shown.sections?.map(sc => (
                <section key={sc.title} className="cx-sec">
                  <h4>{sc.title}</h4>
                  <ul>
                    {sc.items.map((it, k) => (
                      <li key={k}>
                        {it.good && <GoodIcon id={it.good} size={16} />}{' '}
                        {it.entry && codexEntry(it.entry) ? (
                          <button className="link" onClick={() => go(it.entry!)}>
                            {it.text}
                          </button>
                        ) : (
                          it.text
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
