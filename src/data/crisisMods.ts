/** How each crisis changes play while it lasts (kept apart from crises.ts to avoid an import cycle). */
import type { Mods } from './mods.ts';

export const CRISIS_MODS: Record<string, Partial<Mods>> = {
  famine: { growthPct: 40 },
  debt: { goldPct: -15, morale: -1 },
  plague: { growthPct: 60, goldPct: -15 },
  schism: { culturePct: -25 },
  strikes: { prodPct: -30, goldPct: -10 },
};
