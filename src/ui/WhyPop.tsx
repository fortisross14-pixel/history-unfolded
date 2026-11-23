import { useState, type ReactNode } from 'react';
import type { Why } from '../engine/breakdown.ts';

/**
 * A number that answers "why?": hover, focus or tap shows where it comes from, line by line,
 * with a way into the Codex.
 */
export function WhyPop({
  why,
  title,
  unit,
  children,
  onCodex,
  className,
}: {
  why: () => Why;
  title: string;
  unit: string;
  children: ReactNode;
  onCodex?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const w = open ? why() : null;
  const sign = (n: number) => `${n > 0 ? '+' : ''}${n}`;
  return (
    <span
      className={`whypop ${className ?? ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {w && (
        <span className="why-pop" role="tooltip">
          <b>
            {title}: {sign(w.total)} {unit}
          </b>
          {w.lines.length ? (
            <span className="why-lines">
              {w.lines.map((l, i) => (
                <span key={i} className={l.value < 0 ? 'bad' : ''}>
                  <span>{l.label}</span>
                  <span>{sign(l.value)}</span>
                </span>
              ))}
            </span>
          ) : (
            <span className="muted">Nothing yet.</span>
          )}
          {w.note && <small className="muted">{w.note}</small>}
          {onCodex && (
            <button className="link small" onMouseDown={e => e.preventDefault()} onClick={onCodex}>
              More in the Codex
            </button>
          )}
        </span>
      )}
    </span>
  );
}
