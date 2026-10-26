import type { Character, City, Civilization, ModKey, Wonder, WorldState } from '../types.ts';
import { RNG } from './rng.ts';
import { addEvent } from './events.ts';
import { addDeed, earnNickname, notifyAmbition } from './characters.ts';
import { idx } from './lookup.ts';
import { neigh } from './util.ts';

export interface WonderDef {
  kind: string;
  /** "{city}" is replaced with the city's name. */
  name: string;
  era: number;
  coastal?: boolean;
  effect: string;
  mods: Partial<Record<ModKey, number>>;
}

/** Nine wonders, one of each in the world, each with a clear lasting bonus for its owner. */
export const WONDERS: WonderDef[] = [
  {
    kind: 'temple',
    name: 'Great Temple of {city}',
    era: 1,
    effect: 'Faith spread +25%, influence +10%',
    mods: { faithSpread: 0.25, influence: 0.1 },
  },
  {
    kind: 'gardens',
    name: 'Hanging Gardens of {city}',
    era: 1,
    effect: 'Growth +10%, stability +4',
    mods: { growth: 0.1, stability: 4 },
  },
  {
    kind: 'library',
    name: 'Great Library of {city}',
    era: 2,
    effect: 'Research +15%, influence +5%',
    mods: { research: 0.15, influence: 0.05 },
  },
  {
    kind: 'colossus',
    name: 'Colossus of {city}',
    era: 2,
    coastal: true,
    effect: 'Navy +20%, influence +10%',
    mods: { navy: 0.2, influence: 0.1 },
  },
  {
    kind: 'wall',
    name: 'Great Wall of {city}',
    era: 2,
    effect: 'War power +8%, stability +3',
    mods: { warPower: 0.08, stability: 3 },
  },
  {
    kind: 'bazaar',
    name: 'Grand Bazaar of {city}',
    era: 3,
    effect: 'Wealth +12%',
    mods: { wealth: 0.12 },
  },
  {
    kind: 'cathedral',
    name: 'Great Cathedral of {city}',
    era: 3,
    effect: 'Influence +20%, faith spread +10%',
    mods: { influence: 0.2, faithSpread: 0.1 },
  },
  {
    kind: 'observatory',
    name: 'Royal Observatory of {city}',
    era: 4,
    effect: 'Research +20%, exploration +15%',
    mods: { research: 0.2, exploration: 0.15 },
  },
  {
    kind: 'exchange',
    name: 'Grand Exchange of {city}',
    era: 5,
    effect: 'Wealth +20%',
    mods: { wealth: 0.2 },
  },
];

export const wonderDef = (kind: string) => WONDERS.find(w => w.kind === kind)!;

/** The realm that holds a wonder is whoever holds its city now. */
export const wonderOwner = (s: WorldState, w: Wonder) => idx(s).city.get(w.cityId)?.currentRealmId;

export function wondersOf(s: WorldState, c: Civilization) {
  return s.wonders.filter(w => c.cityIds.includes(w.cityId));
}

/** A great patron raises the next wonder their era allows. Returns false if none is left. */
export function createWonder(s: WorldState, c: Civilization, by: Character, r: RNG) {
  const taken = new Set(s.wonders.map(w => w.kind));
  const cities = c.cityIds.map(id => idx(s).city.get(id)).filter((x): x is City => !!x);
  if (!cities.length) return false;
  const options = WONDERS.filter(d => d.era <= c.era && !taken.has(d.kind));
  if (!options.length) return false;
  const def = r.pick(options);
  const coastalCities = cities.filter(x =>
    neigh(s.provinces[x.provinceId], s).some(n => n.terrain === 'ocean'),
  );
  const pool = def.coastal ? coastalCities : cities;
  if (!pool.length) return false;
  const city = pool.find(x => x.isCapital) ?? r.pick(pool);
  const w: Wonder = {
    id: s.nextIds.wonder++,
    kind: def.kind,
    name: def.name.replace('{city}', city.name),
    cityId: city.id,
    builderId: by.id,
    completedYear: s.year,
  };
  s.wonders.push(w);
  city.wonderIds.push(w.id);
  addDeed(s, by, `Completed the ${w.name}`, 25);
  notifyAmbition(s, c.id, 'build-wonder', `completed the ${w.name}`, undefined, by.id);
  earnNickname(s, by);
  addEvent(
    s,
    'wonder',
    `The ${w.name} is completed`,
    `${by.name} completed the ${w.name} for ${c.name}: ${def.effect}.`,
    10,
    [c.id],
    {
      personIds: [by.id],
      cityIds: [city.id],
      wonderIds: [w.id],
      tags: ['wonder'],
      worldChronicle: true,
    },
  );
  return true;
}
