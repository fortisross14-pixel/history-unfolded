/**
 * Player settings, kept per browser: interface and text size, animation speed, reduced motion,
 * effects volume and how often the game saves itself. Applied at once and on every start.
 */
import { setMotion } from '../render/fx.ts';
import { setVolume } from './sound.ts';

export interface Settings {
  /** size of panels, bars and dialogs: 0.9 to 1.5 */
  uiScale: number;
  /** text-heavy panels and dialogs again on top: 1, 1.1 or 1.2 */
  textScale: number;
  /** movement and effects speed: 0.5 slow, 1 normal, 2 fast */
  animSpeed: number;
  /** no tweens, shakes or floating numbers, whatever the system says */
  reducedMotion: boolean;
  /** effects volume 0..1 (0 is silent) */
  effects: number;
  /** autosave every N turns; 0 never */
  autosave: number;
}

export const DEFAULT_SETTINGS: Settings = {
  uiScale: 1,
  textScale: 1,
  animSpeed: 1,
  reducedMotion: false,
  effects: 1,
  autosave: 1,
};

const KEY = 'hu-settings';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode: settings last for this visit */
  }
  applySettings(s);
}

let current = DEFAULT_SETTINGS;
export const settings = () => current;

/** Put settings into effect: CSS sizes, motion, sound. */
export function applySettings(s: Settings = loadSettings()) {
  current = s;
  if (typeof document !== 'undefined') {
    const root = document.documentElement.style;
    root.setProperty('--ui-scale', String(s.uiScale));
    root.setProperty('--text-scale', String(s.textScale));
  }
  setMotion({ speed: s.animSpeed, reduced: s.reducedMotion });
  setVolume(s.effects);
}
