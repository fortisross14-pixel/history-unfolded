import type {
  CharacterRole,
  ArtworkType,
  ArtworkRarity,
  WonderCategory,
  Artwork,
  Character,
  Wonder,
  Civilization,
  WorldState,
} from '../types.ts';
import { WONDER_POOL } from './data.ts';
import { RNG } from './rng.ts';
import { addEvent } from './events.ts';
import { addDeed, earnNickname, notifyAmbition } from './characters.ts';
import { rarityRank } from './traits.ts';

/** 1 (Common) to 5 (Generational): replaces the old star rating. */
export const level = (ch: Character) => rarityRank(ch.rarity) + 1;

export function createArtwork(s: WorldState, c: Civilization, p: Character, r: RNG) {
  const city = s.cities.find(x => x.id === r.pick(c.cityIds));
  if (!city) return;
  const culture = s.cultures.find(x => x.id === c.cultureId)!;
  const type = r.pick<ArtworkType>([
    'Oral Tradition',
    'Book / Writing',
    'Painting',
    'Building',
    'Sculpture',
    'Artifact',
    'Song',
  ]);
  const rating = Math.max(
    20,
    Math.min(
      100,
      Math.round(
        25 +
          level(p) * 11 +
          Math.max(0, culture.economicCreative) * 1.5 +
          r.int(-12, 14) +
          c.technology / 100,
      ),
    ),
  );
  const rarity: ArtworkRarity =
    rating >= 92
      ? 'Legendary'
      : rating >= 80
        ? 'Epic'
        : rating >= 65
          ? 'Rare'
          : rating >= 45
            ? 'Uncommon'
            : 'Common';
  const title = r.pick([
    'The Chronicle of',
    'The Dream of',
    'The Crown of',
    'The Song of',
    'The Garden of',
    'The Triumph of',
  ]);
  const art: Artwork = {
    id: s.nextIds.artwork++,
    name: `${title} ${city.name}`,
    year: s.year,
    rating,
    rarity,
    type,
    patronId: p.id,
    cultureId: c.cultureId,
    realmId: c.id,
    cityId: city.id,
  };
  s.artworks.push(art);
  city.artworkIds.push(art.id);
  culture.artworkIds.push(art.id);
  culture.heritage.push(art.name);
  if (rating >= 65) addDeed(s, p, `Commissioned ${art.name}`, Math.round(rating / 20));
  addEvent(
    s,
    'culture',
    `${art.name} is created`,
    `${p.name} commissioned a ${rarity.toLowerCase()} ${type.toLowerCase()} in ${city.name}, rated ${rating}/100.`,
    rarity === 'Legendary' ? 10 : 7,
    [c.id],
    {
      personIds: [p.id],
      cityIds: [city.id],
      cultureIds: [c.cultureId],
      tags: ['artwork', rarity],
      worldChronicle: rarity === 'Legendary',
    },
  );
}

export function createWonder(s: WorldState, c: Civilization, p: Character, r: RNG) {
  const available = WONDER_POOL.filter(
    w => c.technology >= w.minTech && !s.wonders.some(x => x.name === w.name),
  );
  if (!available.length) return;
  const roleMap: Partial<Record<CharacterRole, WonderCategory[]>> = {
    Scholar: ['Scientific', 'Engineering'],
    Merchant: ['Commercial'],
    General: ['Military'],
    Statesman: ['Engineering', 'Commercial'],
    Prophet: ['Religious'],
  };
  // Patrons and rulers can sponsor any kind of wonder.
  const any = p.role === 'Ruler' || p.traits.includes('Patron');
  const suited = available.filter(w => any || roleMap[p.role]?.includes(w.category));
  if (!suited.length) return;
  const def = r.pick(suited);
  const city = s.cities.find(x => x.id === r.pick(c.cityIds));
  if (!city) return;
  const b =
    def.category === 'Commercial'
      ? { g: 0.12, a: 0, s: 0.01, cu: 0.02, re: 0 }
      : def.category === 'Military'
        ? { g: 0, a: 0.14, s: 0.01, cu: 0.02, re: 0 }
        : def.category === 'Scientific'
          ? { g: 0.02, a: 0, s: 0.12, cu: 0.05, re: 0 }
          : def.category === 'Religious'
            ? { g: 0.02, a: 0, s: 0.01, cu: 0.06, re: 0.14 }
            : def.category === 'Cultural'
              ? { g: 0.01, a: 0, s: 0, cu: 0.15, re: 0 }
              : { g: 0.06, a: 0.03, s: 0.07, cu: 0.03, re: 0 };
  const w: Wonder = {
    id: s.nextIds.wonder++,
    name: def.name,
    category: def.category,
    cityId: city.id,
    provinceId: city.provinceId,
    realmId: c.id,
    builderId: p.id,
    startedYear: s.year - r.int(3, 18),
    completedYear: s.year,
    status: 'standing',
    effect: def.effect,
    gdpBonus: b.g,
    armyBonus: b.a,
    scienceBonus: b.s,
    cultureBonus: b.cu,
    religionBonus: b.re,
    historicalRelevance: 70 + level(p) * 6,
  };
  s.wonders.push(w);
  city.wonderIds.push(w.id);
  addDeed(s, p, `Completed ${w.name}`, 25);
  notifyAmbition(s, c.id, 'build-wonder', `completed ${w.name}`, undefined, p.id);
  earnNickname(s, p);
  const d = s.dynasties.find(x => x.id === c.dynastyId);
  if (d) d.wonderIds.push(w.id);
  addEvent(
    s,
    'wonder',
    `${w.name} is completed`,
    `${p.name} completed ${w.name} in ${city.name}. ${w.effect}.`,
    10,
    [c.id],
    {
      personIds: [p.id],
      cityIds: [city.id],
      wonderIds: [w.id],
      tags: ['wonder', w.category],
      worldChronicle: true,
    },
  );
}
