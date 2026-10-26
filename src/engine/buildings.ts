import type {
  BreakthroughId,
  Building,
  BuildingQuality,
  BuildingType,
  Character,
  City,
  Civilization,
  WorldState,
} from '../types.ts';
import { addEvent } from './events.ts';
import { addDeed, level } from './characters.ts';
import { knows } from './eras.ts';

/** City output bonuses as fractions; research is flat points per year. */
export interface BuildingEffect {
  wealth?: number;
  manpower?: number;
  influence?: number;
  research?: number;
  /** Extra development the city's province can reach. */
  devCap?: number;
  /** Realm-wide: defence in war, navy capacity, faith spread. */
  defense?: number;
  navy?: number;
  faith?: number;
}

export interface BuildingDef {
  type: BuildingType;
  requires?: BreakthroughId;
  coastal?: boolean;
  effect: BuildingEffect;
  text: string;
}

/** Ten buildings. Effects are for a Rare building; quality scales them. */
export const BUILDINGS: BuildingDef[] = [
  { type: 'Granary', effect: { devCap: 3 }, text: 'Province can grow 3 development higher' },
  { type: 'Market', effect: { wealth: 0.3 }, text: 'City wealth +30%' },
  { type: 'Barracks', effect: { manpower: 0.4 }, text: 'City manpower +40%' },
  {
    type: 'Temple',
    effect: { influence: 0.4, faith: 0.05 },
    text: 'City influence +40%, faith spreads 5% faster',
  },
  {
    type: 'Harbor',
    coastal: true,
    requires: 'writing',
    effect: { wealth: 0.2, navy: 0.15 },
    text: 'City wealth +20%, navy +15%',
  },
  {
    type: 'Fortress',
    requires: 'bronze',
    effect: { defense: 0.08, manpower: 0.1 },
    text: 'Defence +8% in war, manpower +10%',
  },
  {
    type: 'Library',
    requires: 'writing',
    effect: { research: 2, influence: 0.1 },
    text: '+2 research a year, influence +10%',
  },
  { type: 'Guild Hall', requires: 'money', effect: { wealth: 0.25 }, text: 'City wealth +25%' },
  {
    type: 'University',
    requires: 'printing',
    effect: { research: 5, influence: 0.15 },
    text: '+5 research a year, influence +15%',
  },
  {
    type: 'Factory',
    requires: 'steam_power',
    effect: { wealth: 0.5, manpower: 0.2 },
    text: 'City wealth +50%, manpower +20%',
  },
];

export const buildingDef = (type: BuildingType) => BUILDINGS.find(b => b.type === type)!;

const QUALITY: BuildingQuality[] = ['Common', 'Rare', 'Epic', 'Legend', 'Generational'];
export const qualityOf = (b: Building) => QUALITY[b.level - 1];

/** Effect multiplier by quality: Common 0.8, Rare 1, Epic 1.2, Legend 1.4, Generational 1.6. */
export const qualityScale = (b: Building) => 0.6 + 0.2 * b.level;

/** Sum of one effect over a list of buildings, with quality applied. */
export function buildingTotal(buildings: Building[], key: keyof BuildingEffect) {
  return buildings.reduce(
    (n, b) => n + (buildingDef(b.type).effect[key] ?? 0) * qualityScale(b),
    0,
  );
}

/** Buildings this realm could build in this city right now. */
export function buildable(c: Civilization, city: City, coastal: boolean) {
  return BUILDINGS.filter(
    d =>
      (!d.requires || knows(c, d.requires)) &&
      (!d.coastal || coastal) &&
      !city.buildings.some(b => b.type === d.type && b.level >= 5),
  );
}

/**
 * Builds a building, or raises an existing one's quality. The builder's
 * rarity sets the quality; Patrons build one tier finer.
 */
export function build(
  s: WorldState,
  c: Civilization,
  city: City,
  def: BuildingDef,
  by?: Character,
) {
  const quality = (
    by ? Math.min(5, level(by) + (by.traits.includes('Patron') ? 1 : 0)) : 1
  ) as Building['level'];
  const existing = city.buildings.find(b => b.type === def.type);
  if (existing) {
    if (quality <= existing.level) return;
    existing.level = quality;
    existing.builderId = by?.id;
  } else {
    city.buildings.push({
      id: s.nextIds.building++,
      type: def.type,
      builtYear: s.year,
      builderId: by?.id,
      level: quality,
    });
  }
  const label = `${QUALITY[quality - 1]} ${def.type}`;
  if (by && quality >= 3)
    addDeed(s, by, `Built the ${label.toLowerCase()} of ${city.name}`, quality);
  if (quality >= 3 || !existing)
    addEvent(
      s,
      'city',
      `${city.name} gains a ${label.toLowerCase()}`,
      `${by?.name ?? c.name} ${existing ? 'rebuilt' : 'built'} a ${label.toLowerCase()} in ${city.name}: ${def.text}.`,
      3 + quality,
      [c.id],
      {
        personIds: by ? [by.id] : [],
        cityIds: [city.id],
        tags: ['building', def.type],
      },
    );
}
