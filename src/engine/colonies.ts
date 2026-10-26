import type { Civilization, WorldState } from '../types.ts';
import { RNG } from './rng.ts';
import { addEvent } from './events.ts';
import { idx } from './lookup.ts';
import { has, neigh } from './util.ts';
import type { ModTotals } from './modifiers.ts';
import { addDeed, fullName } from './characters.ts';

/**
 * Seafaring, ambitious realms with deep-water ships and a fleet plant
 * colonies on empty coasts of continents they know about.
 */
export function colonize(s: WorldState, c: Civilization, mods: ModTotals, r: RNG) {
  if (!has(c, 'deep_sailing') || c.navy <= 0 || c.axes.horizon < 55) return;
  const drive =
    (c.axes.horizon / 100) * (c.axes.ambition / 100) * Math.max(0.2, 1 + mods.exploration);
  if (!r.chance(0.012 * drive)) return;
  const home = s.provinces[c.provinces[0]]?.continentId;
  const known = new Set(c.knownContinentIds.filter(id => id !== home));
  const sites = s.provinces.filter(
    p =>
      p.ownerId === null &&
      p.terrain !== 'ocean' &&
      p.continentId !== null &&
      known.has(p.continentId) &&
      neigh(p, s).some(n => n.terrain === 'ocean'),
  );
  if (!sites.length) return;
  const site = r.pick(sites);
  site.ownerId = c.id;
  site.cultureId = c.cultureId;
  if (c.faithId) site.religionId = c.faithId;
  c.provinces.push(site.id);
  const continent = s.continents.find(x => x.id === site.continentId);
  // An explorer or admiral at court gets the credit.
  const captain = idx(s)
    .court.get(c.id)
    ?.find(x => x.died === undefined && (x.role === 'Explorer' || x.role === 'Admiral'));
  if (captain) addDeed(s, captain, `Founded the colony of ${site.name} on ${continent?.name}`, 6);
  addEvent(
    s,
    'exploration',
    `${c.name} plants a colony on ${continent?.name ?? 'a distant shore'}`,
    `${captain ? `${fullName(captain)} led settlers` : 'Settlers sailed'} from ${c.name} to ${site.name}, founding an overseas colony.`,
    6,
    [c.id],
    {
      personIds: captain ? [captain.id] : [],
      continentIds: site.continentId !== null ? [site.continentId] : [],
      tags: ['colony', 'exploration'],
    },
  );
}
