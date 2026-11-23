import { useState } from 'react';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './settings.ts';

/** Interface and text size, motion, sound and autosave, applied as they change. */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<Settings>(loadSettings);
  const set = (p: Partial<Settings>) => {
    const next = { ...s, ...p };
    setS(next);
    saveSettings(next);
  };
  const choice = <T extends number | boolean>(
    label: string,
    value: T,
    opts: [T, string][],
    on: (v: T) => void,
  ) => (
    <div className="setting">
      <span>{label}</span>
      <div className="setting-opts" role="radiogroup" aria-label={label}>
        {opts.map(([v, name]) => (
          <button
            key={String(v)}
            role="radio"
            aria-checked={value === v}
            className={value === v ? 'on' : ''}
            onClick={() => on(v)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal settings"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={e => e.stopPropagation()}
      >
        <header>
          <h2>Settings</h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {choice(
          'Interface size',
          s.uiScale,
          [
            [0.9, '90%'],
            [1, '100%'],
            [1.15, '115%'],
            [1.3, '130%'],
            [1.5, '150%'],
          ],
          v => set({ uiScale: v }),
        )}
        {choice(
          'Text in panels and dialogs',
          s.textScale,
          [
            [1, 'Normal'],
            [1.1, 'Large'],
            [1.2, 'Larger'],
          ],
          v => set({ textScale: v }),
        )}
        {choice(
          'Animation speed',
          s.animSpeed,
          [
            [0.5, 'Slow'],
            [1, 'Normal'],
            [2, 'Fast'],
          ],
          v => set({ animSpeed: v }),
        )}
        {choice(
          'Reduced motion',
          s.reducedMotion,
          [
            [false, 'Off'],
            [true, 'On'],
          ],
          v => set({ reducedMotion: v }),
        )}
        <div className="setting">
          <span>Effects volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={s.effects}
            onChange={e => set({ effects: Number(e.target.value) })}
            aria-label="Effects volume"
          />
          <span className="muted small">{Math.round(s.effects * 100)}%</span>
        </div>
        {choice(
          'Autosave',
          s.autosave,
          [
            [1, 'Every turn'],
            [2, 'Every 2'],
            [5, 'Every 5'],
            [0, 'Never'],
          ],
          v => set({ autosave: v }),
        )}
        <p className="muted small">
          Music is not in the game yet. Settings are kept in this browser.{' '}
          <button className="link" onClick={() => set(DEFAULT_SETTINGS)}>
            Reset to defaults
          </button>
        </p>
      </div>
    </div>
  );
}
