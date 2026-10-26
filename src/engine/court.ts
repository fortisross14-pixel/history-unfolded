import type { Character, CharacterRole, Civilization, Rank, WorldState } from '../types.ts';
import { RNG } from './rng.ts';
import { addEvent } from './events.ts';
import { courtOf, idx } from './lookup.ts';
import { neigh } from './util.ts';
import { knows } from './eras.ts';
import {
  addDeed,
  createCharacter,
  earnNickname,
  fullName,
  level,
  notifyAmbition,
  surnameOf,
} from './characters.ts';
import { createRoute } from './economy.ts';
import { buildable, build } from './buildings.ts';
import type { BuildingType } from '../types.ts';
import { foundReligion } from './religion.ts';
import { frontier, invent } from './research.ts';
import { revolution } from './realms.ts';
import type { ModTotals } from './modifiers.ts';

const NOTABLE_ROLES: CharacterRole[] = [
  'General',
  'Admiral',
  'Explorer',
  'Merchant',
  'Scholar',
  'Prophet',
  'Statesman',
];

/** How many notables (besides the royal family) a court supports. */
const COURT_SIZE: Record<Rank, number> = {
  Tribe: 0,
  Settlement: 1,
  'City-State': 2,
  Duchy: 2,
  Kingdom: 3,
  Empire: 4,
};

export const isNotable = (ch: Character) => NOTABLE_ROLES.includes(ch.role);
const isCoastal = (s: WorldState, c: Civilization) =>
  c.provinces.some(id => neigh(s.provinces[id], s).some(n => n.terrain === 'ocean'));

/**
 * Which kind of notable the realm is most likely to produce right now. The
 * national character matters: sea peoples produce explorers and admirals,
 * merchants come from mercantile realms, prophets from zealous ones.
 */
function roleWeights(s: WorldState, c: Civilization, atWar: boolean): [CharacterRole, number][] {
  const coastal = isCoastal(s, c);
  const sailing = knows(c, 'deep_sailing');
  const unknown = s.continents.some(x => !c.knownContinentIds.includes(x.id));
  const a = c.axes;
  const sea = a.horizon / 50;
  return [
    ['General', (atWar ? 5 : 2) * (0.5 + a.ambition / 100)],
    ['Admiral', coastal && sailing ? 1.5 * sea : 0],
    ['Explorer', coastal ? (sailing && unknown ? 4 : 0.6) * sea : 0],
    ['Merchant', (c.cityIds.length ? 2 : 0.5) * (a.economy / 50)],
    ['Scholar', (c.cityIds.length ? 2 : 0.5) * (0.5 + a.faith / 100)],
    ['Prophet', (c.faithId ? 0.8 : 1.6) * ((100 - a.faith) / 50)],
    ['Statesman', (c.stability < 40 ? 3 : 1.5) * (0.5 + (100 - a.order) / 100)],
  ];
}

export function spawnNotables(s: WorldState, c: Civilization, atWar: boolean, r: RNG) {
  const notables = courtOf(s, c.id).filter(isNotable);
  if (notables.length >= COURT_SIZE[c.rank] || !r.chance(0.03)) return;
  const weights = roleWeights(s, c, atWar).filter(([, w]) => w > 0);
  let roll = r.next() * weights.reduce((n, [, w]) => n + w, 0);
  for (const [role, w] of weights) {
    roll -= w;
    if (roll <= 0) {
      createCharacter(s, r, { role, realm: c });
      return;
    }
  }
}

const cityOf = (s: WorldState, c: Civilization, r: RNG) =>
  idx(s).city.get(r.pick(c.cityIds)) ?? idx(s).city.get(c.capitalCityId);

/** Builds or improves one building of the given kinds in a random city, if any is possible. */
function buildOneOf(s: WorldState, c: Civilization, ch: Character, kinds: BuildingType[], r: RNG) {
  if (!c.cityIds.length) return;
  const city = cityOf(s, c, r);
  if (!city) return;
  const coastal = neigh(s.provinces[city.provinceId], s).some(n => n.terrain === 'ocean');
  const defs = buildable(c, city, coastal).filter(d => kinds.includes(d.type));
  if (defs.length) build(s, c, city, r.pick(defs), ch);
}

/** Yearly actions of one court notable. Passive bonuses come from modifiers.ts. */
export function notableActs(
  s: WorldState,
  c: Civilization,
  ch: Character,
  mods: ModTotals,
  r: RNG,
) {
  const lvl = level(ch);
  const career = s.year - ch.born - 18;
  switch (ch.role) {
    case 'Scholar': {
      // A great scholar may be first in the world to a breakthrough whose time has come.
      const open = frontier(s, c);
      if (open.length && lvl >= 3 && r.chance(0.002 * lvl * (1 + mods.research)))
        invent(s, c, r.pick(open).id, r, ch);
      if (lvl >= 3 && career > 5 && r.chance(0.012 * (1 + mods.build)))
        buildOneOf(s, c, ch, ['Library', 'University', 'Granary'], r);
      break;
    }
    case 'Merchant': {
      const routes = s.tradeRoutes.filter(t => t.founderId === ch.id).length;
      if (routes < lvl - 1 && r.chance(0.02 + lvl * 0.004)) createRoute(s, c, ch, r);
      if (lvl >= 2 && r.chance(0.012 * (1 + mods.build)))
        buildOneOf(s, c, ch, ['Market', 'Harbor', 'Guild Hall', 'Factory'], r);
      break;
    }
    case 'General': {
      c.armySize = Math.min(c.armyCapacity, c.armySize + Math.round(c.armyCapacity * lvl * 0.0015));
      if (lvl >= 3 && r.chance(0.008 * (1 + mods.build)))
        buildOneOf(s, c, ch, ['Barracks', 'Fortress'], r);
      break;
    }
    case 'Prophet': {
      const founded = ch.deeds.some(d => d.text.startsWith('Founded the faith'));
      if (
        !founded &&
        lvl >= 4 &&
        s.religions.length < 6 &&
        career > 3 &&
        r.chance(lvl === 5 ? 0.03 : 0.012)
      )
        foundReligion(s, c, ch, r);
      if (lvl >= 3 && c.faithId && r.chance(0.01)) buildOneOf(s, c, ch, ['Temple'], r);
      break;
    }
    case 'Statesman': {
      const pressure = Math.max(0, c.axes.order - 50) * 0.8 + Math.max(0, 45 - c.stability);
      const radical = ch.traits.includes('Reformer') || ch.traits.includes('Ambitious');
      if (
        radical &&
        lvl >= 3 &&
        pressure > 40 &&
        c.provinces.length >= 3 &&
        r.chance(0.004 + pressure / 20000)
      )
        revolution(s, c, ch, r);
      else if (lvl >= 3 && career > 6 && !ch.deeds.some(d => d.text.startsWith('Enacted'))) {
        const gain = Math.min(20, 4 + lvl * 3);
        c.stability = Math.min(100, c.stability + gain);
        addDeed(s, ch, `Enacted reforms that steadied ${c.name}`, 6 + lvl);
        addEvent(
          s,
          'politics',
          `${fullName(ch)} reforms ${c.name}`,
          `${ch.name} enacted major reforms, raising stability by ${gain}.`,
          lvl >= 4 ? 8 : 6,
          [c.id],
          {
            personIds: [ch.id],
            tags: ['reform'],
          },
        );
      }
      break;
    }
    case 'Explorer':
    case 'Admiral':
      explore(s, c, ch, mods, r);
      break;
  }
  // Patrons sponsor the arts in any role: fame for them, influence for the realm (see modifiers).
  if (ch.traits.includes('Patron') && c.cityIds.length && r.chance(0.006 + lvl * 0.002) && lvl >= 3)
    addDeed(s, ch, `Sponsored a flowering of the arts in ${cityOf(s, c, r)?.name ?? c.name}`, lvl);
}

/**
 * Explorers (and, less often, admirals) find new continents once their realm
 * has deep-water sailing. Before that they chart nearby coasts. Whatever they
 * find first may be named after them or their patron.
 */
function explore(s: WorldState, c: Civilization, ch: Character, mods: ModTotals, r: RNG) {
  const base = ch.role === 'Explorer' ? 0.012 : 0.004;
  if (!r.chance(base * (ch.skill / 50) * (1 + mods.exploration))) return;
  const unknown = s.continents.filter(x => !c.knownContinentIds.includes(x.id));
  if (knows(c, 'deep_sailing') && unknown.length)
    return discoverContinent(s, c, ch, r.pick(unknown), r);
  chartCoast(s, c, ch, r);
}

const LAND_SUFFIX = ['ia', 'ania', 'land', 'ica'];

function placeName(s: WorldState, c: Civilization, ch: Character, r: RNG) {
  // Explorers name places after themselves, or flatter their patron.
  const ruler = idx(s).char.get(c.rulerId);
  const root = ruler && r.chance(0.35) ? ruler.name.split(' ')[0] : surnameOf(s, ch);
  return { root, honoree: root === surnameOf(s, ch) ? ch : ruler! };
}

export function discoverContinent(
  s: WorldState,
  c: Civilization,
  ch: Character,
  con: WorldState['continents'][number],
  r: RNG,
) {
  c.knownContinentIds.push(con.id);
  const first = con.discoveredYear === undefined;
  con.discoveredByRealmId ??= c.id;
  con.discoveredByCharacterId ??= ch.id;
  con.discoveredYear ??= s.year;
  let named = '';
  if (first && !s.overrides.continent[con.id]) {
    const { root, honoree } = placeName(s, c, ch, r);
    const name = root.replace(/[aeiou]$/i, '') + r.pick(LAND_SUFFIX);
    if (!s.continents.some(x => x.name === name)) {
      con.originalName = con.name;
      con.name = name;
      named = ` and named it ${name} in honour of ${honoree === ch ? 'themself' : honoree.name}`;
    }
  }
  const home = s.provinces[c.provinces[0]]?.continentId;
  const natives = s.civilizations.filter(x =>
    x.provinces.some(id => s.provinces[id].continentId === con.id),
  );
  for (const x of natives) {
    if (!c.knownRealmIds.includes(x.id)) c.knownRealmIds.push(x.id);
    if (!x.knownRealmIds.includes(c.id)) x.knownRealmIds.push(c.id);
    if (home !== undefined && home !== null && !x.knownContinentIds.includes(home))
      x.knownContinentIds.push(home);
  }
  addDeed(s, ch, `Discovered ${con.name}`, first ? 25 : 10);
  notifyAmbition(s, c.id, 'reach-continent', `reached ${con.name}`);
  earnNickname(s, ch);
  addEvent(
    s,
    'exploration',
    `${c.name} discovers ${con.name}`,
    `${fullName(ch)} crossed the open ocean${named} and made contact with ${natives.length} realms.`,
    10,
    [c.id, ...natives.map(x => x.id)],
    {
      personIds: [ch.id],
      continentIds: [con.id],
      breakthroughIds: ['deep_sailing'],
      tags: ['first contact', 'continent discovery'],
      worldChronicle: first,
    },
  );
}

/** Names an unclaimed or frontier coastal province "Cape Torren" and similar. */
function chartCoast(s: WorldState, c: Civilization, ch: Character, r: RNG) {
  if (ch.deeds.some(d => d.text.startsWith('Charted'))) return;
  const home = s.provinces[c.provinces[0]]?.continentId;
  const coast = s.provinces.filter(
    p =>
      p.terrain !== 'ocean' &&
      p.continentId === home &&
      !p.cityId &&
      (p.ownerId === null || p.ownerId === c.id) &&
      !/^(Cape|Port|Bay of) /.test(p.name) &&
      neigh(p, s).some(n => n.terrain === 'ocean'),
  );
  if (!coast.length) return;
  const p = r.pick(coast);
  const { root } = placeName(s, c, ch, r);
  const name = r.pick(['Cape {n}', 'Bay of {n}', 'Port {n}']).replace('{n}', root);
  if (s.provinces.some(x => x.name === name)) return;
  const old = p.name;
  p.name = name;
  addDeed(s, ch, `Charted the coast and named ${name}`, 4);
  addEvent(
    s,
    'exploration',
    `${name} is charted`,
    `${fullName(ch)} charted the coast of ${old}, which is now called ${name}.`,
    4,
    [c.id],
    {
      personIds: [ch.id],
      tags: ['exploration', 'naming'],
    },
  );
}
