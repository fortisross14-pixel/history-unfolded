import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.tsx';
import './r8-touchnav.css';

/** One entry in a bubble's menu. */
export type NavItem = {
  key: string;
  label: string;
  icon: string;
  onClick: () => void;
  pill?: string;
  on?: boolean;
  disabled?: boolean;
};

/**
 * The phone and tablet navigation: two round bubbles instead of the left rail and the top bar's
 * buttons. Bottom left opens the realm (Military, Cities, Nation, Diplomacy); top right opens
 * the ledger (Victory, Goods, Chronicle, Codex, settings…). CSS shows them only on compact
 * screens, where it also hides the rail and the top bar's buttons.
 */
export function TouchNav({ realm, ledger }: { realm: NavItem[]; ledger: NavItem[] }) {
  const [open, setOpen] = useState<'realm' | 'ledger' | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(null);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const alerts = (items: NavItem[]) => items.filter(i => i.pill).length;
  const menu = (which: 'realm' | 'ledger', items: NavItem[]) =>
    open === which && (
      <div className={`tn-menu tn-${which}-menu`} role="menu">
        {items.map((it, i) => (
          <button
            key={it.key}
            role="menuitem"
            className={`tn-item ${it.on ? 'on' : ''}`}
            style={{ ['--i' as string]: i }}
            disabled={it.disabled}
            onClick={() => {
              setOpen(null);
              it.onClick();
            }}
          >
            <span className="tn-ico">
              <Icon name={it.icon} />
            </span>
            <span className="tn-label">{it.label}</span>
            {it.pill ? <b className="war-pill">{it.pill}</b> : null}
          </button>
        ))}
      </div>
    );
  const bubble = (which: 'realm' | 'ledger', icon: string, label: string, items: NavItem[]) => (
    <button
      className={`tn-bubble tn-${which} ${open === which ? 'open' : ''}`}
      aria-label={label}
      aria-expanded={open === which}
      aria-haspopup="menu"
      onClick={() => setOpen(o => (o === which ? null : which))}
    >
      <Icon name={open === which ? 'x' : icon} />
      {open !== which && alerts(items) ? <b className="tn-dot">{alerts(items)}</b> : null}
    </button>
  );
  return (
    <div className="touch-nav" ref={root}>
      {open && <div className="tn-scrim" aria-hidden />}
      {bubble('realm', 'crown', 'Realm', realm)}
      {menu('realm', realm)}
      {bubble('ledger', 'scroll', 'Ledger', ledger)}
      {menu('ledger', ledger)}
    </div>
  );
}
