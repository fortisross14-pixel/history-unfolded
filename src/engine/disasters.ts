import type { Civilization, WorldState } from '../types.ts';
import { RNG } from './rng.ts';
import { addEvent } from './events.ts';
import { idx } from './lookup.ts';
import { damageProvince } from './economy.ts';
import { addDeed, fullName } from './characters.ts';

/**
 * Disasters strike development and stability directly, once. They replace
 * the old long-running realm events.
 */
export function disasters(s: WorldState, c: Civilization, r: RNG) {
  if (!c.provinces.length || !r.chance(0.004)) return;
  const provinces = c.provinces.map(id => s.provinces[id]);
  const roll = r.next();
  // Agrarian realms suffer famines; crowded city realms suffer plagues.
  const famine = 0.35 + (50 - c.axes.economy) / 250;
  const plague = 0.35 + Math.min(0.2, c.cityIds.length * 0.03);
  if (roll < famine) {
    const hit = provinces.filter(() => r.chance(0.3));
    hit.forEach(p => damageProvince(p, 0.08));
    c.stability = Math.max(5, c.stability - 8);
    addEvent(
      s,
      'society',
      `Famine in ${c.name}`,
      `Harvests failed across ${hit.length} provinces of ${c.name}: development −8% there, stability −8.`,
      6,
      [c.id],
      { tags: ['disaster', 'famine'] },
    );
  } else if (roll < famine + plague) {
    const hit = provinces.filter(p => p.cityId || r.chance(0.4));
    hit.forEach(p => damageProvince(p, 0.15));
    c.stability = Math.max(5, c.stability - 10);
    addEvent(
      s,
      'society',
      `Plague strikes ${c.name}`,
      `Disease swept through ${hit.length} provinces of ${c.name}: development −15% there, stability −10.`,
      7,
      [c.id],
      {
        tags: ['disaster', 'plague'],
        worldChronicle: hit.length >= 20,
      },
    );
  } else {
    const cityProvinces = provinces.filter(p => p.cityId);
    const p = cityProvinces.length ? r.pick(cityProvinces) : r.pick(provinces);
    damageProvince(p, 0.25);
    const city = p.cityId ? idx(s).city.get(p.cityId) : undefined;
    const ruined = city?.buildings.filter(b => b.level > 1 && r.chance(0.4)) ?? [];
    ruined.forEach(b => (b.level = (b.level - 1) as typeof b.level));
    const kind = p.terrain === 'mountain' ? 'Earthquake' : 'Great flood';
    addEvent(
      s,
      'society',
      `${kind} at ${city?.name ?? p.name}`,
      `${city?.name ?? p.name} lost a quarter of its development${ruined.length ? `; ${ruined.length} buildings were damaged` : ''}.`,
      5,
      [c.id],
      {
        cityIds: city ? [city.id] : [],
        tags: ['disaster'],
      },
    );
  }
}

/** Court events that come from the ruler's own character. */
export function courtEvents(s: WorldState, c: Civilization, r: RNG) {
  const ruler = idx(s).char.get(c.rulerId);
  if (!ruler || ruler.died !== undefined || !r.chance(0.01)) return;
  const has = (t: string) => ruler.traits.includes(t as never);
  if ((has('Greedy') || has('Cruel') || has('Mad')) && r.chance(0.6)) {
    c.stability = Math.max(5, c.stability - 6);
    addDeed(s, ruler, 'Disgraced by a scandal at court', 0);
    addEvent(
      s,
      'politics',
      `Scandal at the court of ${c.name}`,
      `The conduct of ${fullName(ruler)} outraged the nobles of ${c.name}: stability −6.`,
      4,
      [c.id],
      {
        personIds: [ruler.id],
        tags: ['court', 'scandal'],
      },
    );
  } else if (has('Paranoid') || has('Just')) {
    c.stability = Math.min(100, c.stability + 4);
    addDeed(s, ruler, 'Uncovered a conspiracy against the throne', 3);
    addEvent(
      s,
      'politics',
      `Conspiracy uncovered in ${c.name}`,
      `${fullName(ruler)} exposed a plot against the throne: stability +4.`,
      4,
      [c.id],
      {
        personIds: [ruler.id],
        tags: ['court', 'conspiracy'],
      },
    );
  }
}
