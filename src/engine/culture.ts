import type {
  PersonRole,
  ArtworkType,
  ArtworkRarity,
  WonderCategory,
  Artwork,
  GreatPerson,
  Wonder,
  Civilization,
  WorldState,
} from '../types.ts';
import { WONDER_POOL } from './data.ts';
import { RNG } from './rng.ts';
import { addEvent } from './events.ts';

export function createArtwork(s: WorldState, c: Civilization, p: GreatPerson, r: RNG) {
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
          p.stars * 11 +
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
    artistId: p.id,
    cultureId: c.cultureId,
    realmId: c.id,
    cityId: city.id,
  };
  s.artworks.push(art);
  p.artworkIds.push(art.id);
  city.artworkIds.push(art.id);
  culture.artworkIds.push(art.id);
  culture.heritage.push(art.name);
  p.impact += rating / 4;
  p.achievement = `Created ${art.name} (${rarity})`;
  addEvent(
    s,
    'culture',
    `${art.name} is created`,
    `${p.name} created a ${rarity.toLowerCase()} ${type.toLowerCase()} in ${city.name}, rated ${rating}/100.`,
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

export function createWonder(s: WorldState, c: Civilization, p: GreatPerson, r: RNG) {
  const available = WONDER_POOL.filter(
    w => c.technology >= w.minTech && !s.wonders.some(x => x.name === w.name),
  );
  if (!available.length) return;
  const roleMap: Record<PersonRole, WonderCategory[] | undefined> = {
    Scientist: ['Scientific'],
    Engineer: ['Engineering', 'Scientific'],
    Merchant: ['Commercial'],
    General: ['Military'],
    Artist: ['Cultural'],
    Politician: ['Engineering', 'Commercial'],
    'Religious Figure': ['Religious'],
  };
  const suited = available.filter(w => roleMap[p.role]?.includes(w.category));
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
    builderPersonId: p.id,
    startedYear: s.year - r.int(3, 18),
    completedYear: s.year,
    status: 'standing',
    effect: def.effect,
    gdpBonus: b.g,
    armyBonus: b.a,
    scienceBonus: b.s,
    cultureBonus: b.cu,
    religionBonus: b.re,
    historicalRelevance: 70 + p.stars * 6,
  };
  s.wonders.push(w);
  city.wonderIds.push(w.id);
  p.wonderIds.push(w.id);
  p.impact += 35;
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
