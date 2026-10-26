import type { NameMode, PersonRole, Dynasty, Civilization, WorldState } from '../types.ts';
import {
  ROOTS,
  REAL_CITIES,
  CITY_SUFFIX,
  HISTORICAL_NAMES,
  REAL_PROVINCES,
  FICTIONAL_PROVINCES,
} from './data.ts';
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

export function uniqueName(s: WorldState, role: PersonRole, r: RNG) {
  const pool = HISTORICAL_NAMES[role].filter(n => !s.usedHistoricalNames.includes(n));
  const name = pool.length
    ? r.pick(pool)
    : `${r.pick(['Aurelia', 'Cassian', 'Elira', 'Marcus', 'Samira', 'Leontes', 'Nadia', 'Tariq', 'Mina', 'Darius'])} ${r.pick(ROOTS)}`;
  s.usedHistoricalNames.push(name);
  return name;
}

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

export function numberedRulerName(
  s: WorldState,
  first: string,
  dynastyId: number,
  surname: string,
) {
  const count =
    s.rulers.filter(r => r.dynastyId === dynastyId && r.name.startsWith(`${first} `)).length + 1;
  return `${first} ${romanNumeral(count)} ${surname}`;
}

export function numberedBattleName(s: WorldState, base: string) {
  const count = s.battles.filter(b => b.name === base || b.name.startsWith(`${base} (`)).length + 1;
  return `${base} (${count})`;
}
