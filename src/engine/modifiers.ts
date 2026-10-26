import type { Character, Civilization, ModKey, WorldState } from '../types.ts';
import { courtOf, idx, isAlive } from './lookup.ts';
import { TRAITS, rarityDef } from './traits.ts';
import { fullName } from './characters.ts';
import { overlordOf, vassalsOf } from './diplomacy.ts';

export interface ModSource {
  key: ModKey;
  value: number;
  label: string;
}

export type ModTotals = Record<ModKey, number>;

export interface RealmMods {
  total: ModTotals;
  sources: ModSource[];
}

const zero = (): ModTotals => ({
  wealth: 0,
  growth: 0,
  research: 0,
  army: 0,
  stability: 0,
  influence: 0,
  warAppetite: 0,
  warPower: 0,
  faithSpread: 0,
  diplomacy: 0,
  exploration: 0,
  navy: 0,
  build: 0,
});

/** What each notable role adds to the realm per point of skill (0–100). */
const ROLE_EFFECT: Partial<Record<Character['role'], [ModKey, number]>> = {
  // Admirals build fleets as well as exploring; see navy below.
  Merchant: ['wealth', 0.12],
  Scholar: ['research', 0.25],
  General: ['army', 0.1],
  Admiral: ['navy', 0.4],
  Explorer: ['exploration', 0.6],
  Statesman: ['stability', 8],
  Prophet: ['faithSpread', 0.4],
};

const round = (n: number, key: ModKey) =>
  key === 'stability' ? Math.round(n * 10) / 10 : Math.round(n * 1000) / 1000;

/**
 * All realm modifiers with their sources: the ruler (skill and traits), a regent,
 * court notables and active legacies. Totals feed the simulation; sources feed
 * the UI breakdowns.
 */
export function realmModifiers(s: WorldState, c: Civilization): RealmMods {
  const sources: ModSource[] = [];
  const add = (key: ModKey, value: number, label: string) => {
    if (Math.abs(value) > 0.0005) sources.push({ key, value: round(value, key), label });
  };
  const ruler = idx(s).char.get(c.rulerId);
  const regent = c.regentId ? idx(s).char.get(c.regentId) : undefined;
  const governing = isAlive(regent) ? regent : ruler;
  if (isAlive(governing)) {
    // A regent governs, but the child ruler's traits still colour the court at half strength.
    const who =
      governing === regent ? `regent ${fullName(governing)}` : `ruler ${fullName(governing)}`;
    const skill = (governing.skill - 50) / 100;
    add('wealth', skill * 0.2, who);
    add('stability', skill * 10, who);
    add('army', skill * 0.1, who);
    add('research', skill * 0.08, who);
  }
  if (isAlive(ruler)) {
    const weight = rarityDef(ruler.rarity).weight * (governing === regent ? 0.5 : 1);
    for (const t of ruler.traits)
      for (const [k, v] of Object.entries(TRAITS[t].mods) as [ModKey, number][])
        add(k, v * weight, `${t} (${fullName(ruler)})`);
  }
  for (const ch of courtOf(s, c.id)) {
    const effect = ROLE_EFFECT[ch.role];
    if (!effect) continue;
    const weight = rarityDef(ch.rarity).weight;
    add(
      effect[0],
      (effect[1] * ch.skill * weight) / 100,
      `${ch.role.toLowerCase()} ${fullName(ch)}`,
    );
    // Court notables lend their traits at a quarter strength.
    for (const t of ch.traits)
      for (const [k, v] of Object.entries(TRAITS[t].mods) as [ModKey, number][])
        if (k !== 'warAppetite') add(k, v * weight * 0.25, `${t} (${fullName(ch)})`);
  }
  // National character: what kind of country this is.
  const a = c.axes;
  add(
    'warAppetite',
    (a.ambition - 50) / 50,
    a.ambition >= 50 ? 'Expansionist people' : 'Inward-looking people',
  );
  add(
    'exploration',
    (a.horizon - 50) / 100,
    a.horizon >= 50 ? 'Seafaring people' : 'Landlocked outlook',
  );
  add('navy', (a.horizon - 50) / 50, a.horizon >= 50 ? 'Seafaring people' : 'Landlocked outlook');
  add(
    'wealth',
    (a.economy - 50) / 250,
    a.economy >= 50 ? 'Mercantile economy' : 'Agrarian economy',
  );
  add(
    'growth',
    (50 - a.economy) / 500,
    a.economy >= 50 ? 'Mercantile economy' : 'Agrarian economy',
  );
  add('faithSpread', (50 - a.faith) / 100, a.faith >= 50 ? 'Tolerant faith' : 'Zealous faith');
  add('stability', (50 - a.order) * 0.3, a.order >= 50 ? 'Fractious nobles' : 'Centralised state');
  // Tribute flows from vassals to overlords.
  const lord = overlordOf(s, c);
  if (lord) add('wealth', -0.08, `Tribute to ${lord.name}`);
  for (const v of vassalsOf(s, c)) add('wealth', 0.03, `Tribute from ${v.name}`);
  for (const l of idx(s).legacies.get(c.id) ?? []) {
    if (l.end < s.year) continue;
    for (const [k, v] of Object.entries(l.mods) as [ModKey, number][]) add(k, v, l.name);
  }
  const total = zero();
  for (const src of sources) total[src.key] += src.value;
  return { total, sources };
}

/** "Wealth +18%: Market +4%, ruler Alaric +8%" style text for one modifier key. */
export function breakdown(mods: RealmMods, key: ModKey) {
  return mods.sources
    .filter(x => x.key === key)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}
