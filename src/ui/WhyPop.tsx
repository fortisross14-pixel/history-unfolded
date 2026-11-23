import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Why } from '../engine/breakdown.ts';

/**
 * A number that answers "why?": hover, focus or a long press (by touch) shows where it comes
 * from, line by line, with a way into the Codex. After a long press the tap itself does nothing.
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
  const touch = useRef(false);
  const held = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const box = useRef<HTMLSpanElement>(null);
  // a breakdown opened by touch closes when the finger goes anywhere else
  useEffect(() => {
    if (!open || !touch.current) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  const w = open ? why() : null;
  const sign = (n: number) => `${n > 0 ? '+' : ''}${n}`;
  return (
    <span
      ref={box}
      className={`whypop ${className ?? ''}`}
      onMouseEnter={() => !touch.current && setOpen(true)}
      onMouseLeave={() => !touch.current && setOpen(false)}
      onFocus={() => !touch.current && setOpen(true)}
      onBlur={() => setOpen(false)}
      onPointerDown={e => {
        touch.current = e.pointerType !== 'mouse';
        if (!touch.current) return;
        if (open) return setOpen(false);
        held.current = false;
        clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          held.current = true;
          setOpen(true);
        }, 450);
      }}
      onPointerUp={() => clearTimeout(timer.current)}
      onPointerCancel={() => clearTimeout(timer.current)}
      onContextMenu={e => touch.current && e.preventDefault()}
      onClickCapture={e => {
        // the long press showed the breakdown: the tap that ends it does not also open the screen
        if (held.current) {
          held.current = false;
          e.stopPropagation();
          e.preventDefault();
        }
      }}
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
