import { useState } from 'react';
import { searchCodex, type CodexEntry } from './codex.ts';

/** Searchable help: every term of the game, basics first. */
export function CodexDialog({
  q: initial,
  onKeys,
  onClose,
}: {
  q?: string;
  onKeys: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState(initial ?? '');
  const results = searchCodex(q);
  const [open, setOpen] = useState<CodexEntry | null>(results[0] ?? null);
  const shown = open && results.includes(open) ? open : (results[0] ?? null);
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
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            aria-label="Search the Codex"
          />
          <button className="secondary" onClick={onKeys} title="Keys and mouse">
            Keys
          </button>
        </div>
        <div className="codex-body">
          <ul className="codex-list">
            {results.map(e => (
              <li key={e.id}>
                <button
                  className={`link ${shown?.id === e.id ? 'on' : ''}`}
                  onClick={() => setOpen(e)}
                >
                  {e.title} <small className="muted">{e.group}</small>
                </button>
              </li>
            ))}
            {!results.length && <li className="muted">Nothing found.</li>}
          </ul>
          {shown && (
            <article className="codex-entry">
              <h3>{shown.title}</h3>
              <p className="muted small">{shown.group}</p>
              <p>{shown.text}</p>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
