import type { AmbitionType, Character, Legacy, ModKey, WorldState } from '../types.ts';
import { addEvent } from './events.ts';
import { idx, registerLegacy } from './lookup.ts';
import { rarityDef, rarityRank } from './traits.ts';

interface LegacyTemplate {
  title: string;
  mods: Partial<Record<ModKey, number>>;
  years: number;
}

/** What a fulfilled ambition leaves behind. Values are for an Epic character. */
const TEMPLATES: Record<AmbitionType, LegacyTemplate> = {
  conquer: { title: 'Conquests', mods: { army: 0.08, warPower: 0.05 }, years: 50 },
  expand: { title: 'Frontier', mods: { growth: 0.05, army: 0.05 }, years: 50 },
  'found-religion': { title: 'Teachings', mods: { faithSpread: 0.25, influence: 0.1 }, years: 150 },
  'reach-continent': { title: 'Charts', mods: { exploration: 0.3, wealth: 0.05 }, years: 80 },
  'build-wonder': { title: 'Splendor', mods: { influence: 0.15, stability: 4 }, years: 100 },
  'grow-wealth': { title: 'Fortune', mods: { wealth: 0.1 }, years: 60 },
  'great-discovery': { title: 'Academy', mods: { research: 0.12 }, years: 80 },
  'win-battles': { title: 'Doctrine', mods: { warPower: 0.1 }, years: 50 },
  reform: { title: 'Reforms', mods: { stability: 6, wealth: 0.05 }, years: 60 },
};

const shortName = (ch: Character) => ch.name.split(' ')[0];

/**
 * Turns a character's achievement into a named realm bonus such as
 * "Reforms of Alaric: +10% wealth for 60 years". Common and Rare characters
 * are remembered with a deed only.
 */
export function grantAmbitionLegacy(s: WorldState, ch: Character, type: AmbitionType) {
  if (rarityRank(ch.rarity) < 2) return;
  const realm = idx(s).civ.get(ch.realmId);
  if (!realm) return;
  const t = TEMPLATES[type];
  const weight = rarityDef(ch.rarity).weight;
  const mods: Legacy['mods'] = {};
  for (const [k, v] of Object.entries(t.mods) as [ModKey, number][])
    mods[k] = Math.round(v * weight * 100) / 100;
  const years = Math.round(t.years * (ch.rarity === 'Generational' ? 1.5 : 1));
  const legacy: Legacy = {
    id: s.nextIds.legacy++,
    name: `${t.title} of ${shortName(ch)}`,
    characterId: ch.id,
    realmId: realm.id,
    start: s.year,
    end: s.year + years,
    mods,
    reason: ch.ambition?.label ?? `${ch.role} of ${realm.name}`,
  };
  s.legacies.push(legacy);
  registerLegacy(s, legacy);
  ch.legacyIds.push(legacy.id);
  addEvent(
    s,
    'great-person',
    `${legacy.name} shapes ${realm.name}`,
    `${ch.name} leaves a lasting mark on ${realm.name}: ${describeMods(mods)} for ${years} years.`,
    ch.rarity === 'Generational' ? 9 : 7,
    [realm.id],
    { personIds: [ch.id], tags: ['legacy'], worldChronicle: ch.rarity === 'Generational' },
  );
}

const MOD_LABEL: Record<ModKey, string> = {
  wealth: 'wealth',
  growth: 'growth',
  research: 'research',
  army: 'army',
  stability: 'stability',
  influence: 'influence',
  warAppetite: 'war appetite',
  warPower: 'war power',
  faithSpread: 'faith spread',
  diplomacy: 'diplomacy',
  exploration: 'exploration',
  build: 'building',
};

/** Stability is in points; everything else is a percentage. */
export function formatMod(key: ModKey, value: number) {
  const sign = value >= 0 ? '+' : '−';
  const n = Math.abs(value);
  return key === 'stability' ? `${sign}${Math.round(n)}` : `${sign}${Math.round(n * 100)}%`;
}

export function describeMods(mods: Legacy['mods']) {
  return (Object.entries(mods) as [ModKey, number][])
    .map(([k, v]) => `${MOD_LABEL[k]} ${formatMod(k, v)}`)
    .join(', ');
}

export const modLabel = (k: ModKey) => MOD_LABEL[k];
