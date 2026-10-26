import type { NameMode, Province, Dynasty, Civilization, WorldState } from '../types.ts';
import { REAL_CITIES, CITY_SUFFIX, REAL_PROVINCES, FICTIONAL_PROVINCES } from './data.ts';
import { RNG } from './rng.ts';

export const chooseDatabase = (mode: NameMode, r: RNG) =>
  mode === 'real' || (mode === 'mixed' && r.chance(0.5));

export const uniqueFrom = (pool: string[], used: Set<string>, fallback: string, r: RNG) => {
  const available = pool.filter(x => !used.has(x));
  return available.length ? r.pick(available) : fallback;
};

export const dynastySurname = (d: Dynasty) =>
  d.name.replace(/^House of /, '').replace(/ Dynasty$/, '');

export const uniqueProvinceName = (mode: NameMode, index: number, r: RNG, used: Set<string>) => {
  const real = chooseDatabase(mode, r),
    pool = real ? REAL_PROVINCES : FICTIONAL_PROVINCES;
  const base = pool[index % pool.length];
  const qualifiers = real
    ? [
        'North',
        'South',
        'East',
        'West',
        'Upper',
        'Lower',
        'Greater',
        'Lesser',
        'New',
        'Old',
        'High',
        'Coastal',
        'Central',
      ]
    : [
        'Northern',
        'Southern',
        'Eastern',
        'Western',
        'Upper',
        'Lower',
        'Greater',
        'Lesser',
        'New',
        'Old',
        'High',
        'Coastal',
        'Central',
      ];
  let name = base;
  if (used.has(name)) {
    for (const q of qualifiers) {
      const candidate = `${q} ${base}`;
      if (!used.has(candidate)) {
        name = candidate;
        break;
      }
    }
  }
  if (used.has(name)) {
    const second = pool[(index * 7 + 13) % pool.length];
    name = `${base}-${second}`;
    if (used.has(name)) {
      for (const q of qualifiers) {
        const candidate = `${q} ${base}-${second}`;
        if (!used.has(candidate)) {
          name = candidate;
          break;
        }
      }
    }
  }
  used.add(name);
  return name;
};

export const politicalCoreName = (c: Civilization, s: WorldState) => {
  const capital = s.cities.find(x => x.id === c.capitalCityId)?.name;
  const last = [...c.nameHistory]
    .reverse()
    .find(h => !['Tribe', 'Settlement'].includes(h.rank))?.name;
  return (last ?? capital ?? c.originTribe)
    .replace(/^(Duchy of |Kingdom of |Greater |Lesser |Eastern |Western |Northern |Southern )/, '')
    .replace(/ Empire$/, '')
    .replace(/ Settlements?$/, '')
    .replace(/ian$/, 'ia')
    .replace(/ean$/, 'ea');
};

export function capitalName(root: string, r: RNG, s?: WorldState) {
  if (s && chooseDatabase(s.config.nameMode, r)) {
    const used = new Set(s.cities.map(c => c.name));
    return uniqueFrom(REAL_CITIES, used, `${root}${r.pick(CITY_SUFFIX)}`, r);
  }
  return `${root}${r.pick(CITY_SUFFIX)}`;
}

export function romanNumeral(n: number) {
  const vals: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  for (const [v, s] of vals)
    while (n >= v) {
      out += s;
      n -= v;
    }
  return out || 'I';
}

/**
 * Name for a new city: usually the province name, but great rulers and saints
 * sometimes give their name to a city ("Alaricopolis", "Port Alaric", "Saint Mina").
 */
export function cityNameFor(
  s: WorldState,
  c: Civilization,
  p: Province,
  coastal: boolean,
  r: RNG,
): { name: string; namedAfterId?: number } {
  const used = new Set(s.cities.map(x => x.name));
  const ruler = s.characters.find(x => x.id === c.rulerId);
  const saint = c.faithId
    ? s.characters.find(x => x.id === s.religions.find(rel => rel.id === c.faithId)?.founderId)
    : undefined;
  const options: { name: string; namedAfterId?: number }[] = [];
  if (ruler && ['Epic', 'Legend', 'Generational'].includes(ruler.rarity) && r.chance(0.45)) {
    const first = ruler.name.split(' ')[0];
    const pattern = coastal
      ? r.pick(['Port {n}', '{n}opolis', '{n}haven'])
      : r.pick(['{n}opolis', '{n}grad', 'Fort {n}', '{n}burg']);
    options.push({ name: pattern.replace('{n}', first), namedAfterId: ruler.id });
  }
  if (saint && saint.died !== undefined && r.chance(0.2))
    options.push({ name: `Saint ${saint.name.split(' ')[0]}`, namedAfterId: saint.id });
  const pick = options.find(o => !used.has(o.name));
  return pick ?? { name: p.name };
}
