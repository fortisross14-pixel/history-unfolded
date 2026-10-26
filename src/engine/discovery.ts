import type { BreakthroughId, Character, Civilization, Moment, WorldState } from '../types.ts';
import { RNG } from './rng.ts';
import { BREAKTHROUGHS, breakthroughName, knows } from './eras.ts';
import { learn } from './research.ts';
import { addEvent } from './events.ts';
import { idx } from './lookup.ts';
import { endMoment, momentEvent, momentSlotFree, startMoment } from './moments.ts';
import { findRelation } from './diplomacy.ts';
import { isGreatPower } from './power.ts';
import { realmModifiers } from './modifiers.ts';
import { fullName } from './characters.ts';

const techName = breakthroughName;

/** A moment ends once this share of living realms has adopted the breakthrough. */
const WAVE_DONE = 0.75;
const WAVE_MAX_YEARS = 120;

/**
 * Called when a realm makes a breakthrough nobody else has: the start of a
 * Great Discovery that will spread outward as a wave.
 */
export function beginDiscovery(s: WorldState, c: Civilization, id: BreakthroughId, ch?: Character) {
  if (!momentSlotFree(s) || s.moments.some(m => m.kind === 'discovery' && m.subject === id)) return;
  const name = techName(id);
  const m = startMoment(
    s,
    'discovery',
    `The Spread of ${name}`,
    id,
    c.id,
    [c.id],
    `${ch ? `${fullName(ch)} of ${c.name}` : c.name} achieved ${name}. The breakthrough will spread outward through trade, alliances and faith.`,
    { originCharacterId: ch?.id },
  );
  m.series.push([s.year, 1]);
}

/** How strongly a realm is exposed to a breakthrough it lacks. */
function exposure(s: WorldState, c: Civilization, knowers: Set<number>, neighbors: Civilization[]) {
  let e = Math.min(4, neighbors.filter(n => knowers.has(n.id)).length * 2);
  for (const id of c.knownRealmIds) {
    if (!knowers.has(id)) continue;
    if (findRelation(s, c.id, id, 'Alliance') || findRelation(s, c.id, id, 'Marriage')) e += 1;
    const other = idx(s).civ.get(id);
    if (other && other.faithId && other.faithId === c.faithId) e += 0.25;
  }
  return Math.min(6, e);
}

/**
 * Yearly diffusion of every known breakthrough. Mercantile realms adopt fast,
 * inward-looking ones resist, and printing speeds everything up.
 */
export function spreadDiscoveries(s: WorldState, neighborsOf: Map<number, Civilization[]>, r: RNG) {
  const living = s.civilizations.filter(c => c.provinces.length);
  for (const t of BREAKTHROUGHS) {
    const knowers = new Set(living.filter(c => knows(c, t.id)).map(c => c.id));
    if (!knowers.size) continue;
    for (const c of living) {
      if (knowers.has(c.id) || t.era > c.era + 1) continue;
      const e = exposure(s, c, knowers, neighborsOf.get(c.id) ?? []);
      if (!e) continue;
      const openness = (0.7 + c.axes.economy / 100) * (0.6 + c.axes.ambition / 250);
      const press = knows(c, 'printing') ? 1.3 : 1;
      const research = 1 + Math.max(-0.5, realmModifiers(s, c).total.research);
      if (!r.chance(e * 0.012 * openness * press * research)) continue;
      adopt(s, c, t.id);
    }
  }
}

function adopt(s: WorldState, c: Civilization, id: BreakthroughId) {
  learn(s, c, id, 'spread');
  const m = s.moments.find(x => x.active && x.kind === 'discovery' && x.subject === id);
  const name = techName(id);
  if (m) {
    m.realmIds.push(c.id);
    // Only great powers and new continents make the headlines.
    const continent = s.provinces[c.provinces[0]]?.continentId;
    const firstThere = !m.realmIds.slice(0, -1).some(rid => {
      const other = idx(s).civ.get(rid);
      return other && s.provinces[other.provinces[0]]?.continentId === continent;
    });
    if (isGreatPower(s, c) || firstThere)
      momentEvent(
        s,
        m,
        s.year,
        `${name} reaches ${c.name}`,
        firstThere
          ? `${name} crosses to ${s.continents.find(x => x.id === continent)?.name ?? 'a new land'} through ${c.name}.`
          : `The great power ${c.name} adopts ${name}.`,
        [c.id],
      );
  }
  addEvent(
    s,
    'technology',
    `${name} reaches ${c.name}`,
    `${name} spread into ${c.name}.`,
    4,
    [c.id],
    {
      breakthroughIds: [id],
      momentIds: m ? [m.id] : [],
      tags: ['technology diffusion'],
    },
  );
}

/** Yearly bookkeeping for a discovery moment: record the wave, end it when it has crested. */
export function tickDiscovery(s: WorldState, m: Moment) {
  const living = s.civilizations.filter(c => c.provinces.length);
  const id = m.subject as BreakthroughId;
  const count = living.filter(c => knows(c, id)).length;
  m.series.push([s.year, count]);
  const share = count / Math.max(1, living.length);
  if (share < WAVE_DONE && s.year - m.startYear < WAVE_MAX_YEARS) return;
  endMoment(
    s,
    m,
    `${techName(id)} spread to ${count} of ${living.length} realms in ${s.year - m.startYear} years.`,
  );
}
