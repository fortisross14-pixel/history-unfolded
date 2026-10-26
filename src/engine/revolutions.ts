import type { AxisKey, Civilization, Moment, TechnologyId, WorldState } from '../types.ts';
import { RNG } from './rng.ts';
import { has } from './util.ts';
import { idx, courtOf } from './lookup.ts';
import { endMoment, momentEvent, momentSlotFree, startMoment } from './moments.ts';
import { isGreatPower } from './power.ts';
import { revolution, triggerCivilWar } from './realms.ts';
import { createCharacter } from './characters.ts';
import { reformProvince, schism } from './religion.ts';

/**
 * World Revolutions: rare ideological waves. Each starts in one realm, then
 * presses on every connected country, moving national axes and setting off
 * revolts where the state is weak.
 */
interface WaveDef {
  id: string;
  title: string;
  from: number;
  to: number;
  requires?: TechnologyId;
  years: number;
  /** How suitable a realm is as the starting point (0 = never). */
  origin: (c: Civilization) => number;
  /** Yearly push on each affected realm's axes. */
  push: Partial<Record<AxisKey, number>>;
  /** Local upheaval in a weak realm; returns a headline or null. */
  revolt?: (s: WorldState, c: Civilization, r: RNG) => string | null;
  start?: (s: WorldState, c: Civilization, m: Moment, r: RNG) => void;
  /** Extra yearly effect on each affected realm. */
  each?: (s: WorldState, c: Civilization, m: Moment, r: RNG) => void;
}

const statesmanFor = (s: WorldState, c: Civilization, r: RNG) =>
  courtOf(s, c.id).find(x => x.role === 'Statesman') ??
  createCharacter(s, r, { role: 'Statesman', realm: c, minRarity: 'Rare' });

const WAVES: WaveDef[] = [
  {
    id: 'philosophers',
    title: 'The Age of Philosophers',
    from: -700,
    to: 200,
    requires: 'writing',
    years: 90,
    origin: c => (c.axes.faith >= 45 && c.cityIds.length ? c.axes.faith : 0),
    push: { faith: 0.15, economy: 0.05 },
  },
  {
    id: 'fragmentation',
    title: 'The Great Fragmentation',
    from: 400,
    to: 1200,
    years: 120,
    origin: c => (c.provinces.length >= 15 ? c.provinces.length : 0),
    push: { order: 0.3 },
    revolt: (s, c, r) => {
      if (c.axes.order < 58 || c.stability > 45 || c.provinces.length < 10) return null;
      triggerCivilWar(s, c, r, 'feudal fragmentation');
      return `Great lords carve up ${c.name}`;
    },
  },
  {
    id: 'reformation',
    title: 'The Reformation',
    from: 1400,
    to: 1750,
    requires: 'printing',
    years: 100,
    origin: c => (c.faithId && c.axes.faith > 30 && c.axes.faith < 70 ? 50 : 0),
    push: { faith: -0.15 },
    start: (s, c, m, r) => {
      const reformed = schism(s, c, r);
      if (reformed) m.subject = `reformation:${reformed}`;
    },
    each: (s, c, m, r) => {
      const reformedId = Number(m.subject.split(':')[1]);
      if (reformedId && r.chance(0.15)) reformProvince(s, c, reformedId);
    },
    revolt: (s, c, r) => {
      if (c.stability > 35 || c.provinces.length < 8) return null;
      triggerCivilWar(s, c, r, 'religious polarization');
      return `Wars of religion tear ${c.name} apart`;
    },
  },
  {
    id: 'republican',
    title: 'The Age of Revolutions',
    from: 1750,
    to: 1900,
    requires: 'printing',
    years: 80,
    origin: c => (c.axes.order > 50 && c.stability < 60 ? c.axes.order : 0),
    push: { faith: 0.1, economy: 0.1 },
    revolt: (s, c, r) => {
      if (!/Monarchy|Court|Kingship|Chiefdom/.test(c.government) || c.stability > 45) return null;
      revolution(s, c, statesmanFor(s, c, r), r);
      return `Revolution in ${c.name}: the monarchy falls`;
    },
  },
  {
    id: 'nationalism',
    title: 'The Rise of Nations',
    from: 1810,
    to: 1950,
    years: 90,
    origin: c => (c.axes.ambition > 55 ? c.axes.ambition : 0),
    push: { ambition: 0.1, order: -0.2 },
    revolt: (s, c, r) => {
      const foreign = c.provinces.filter(id => s.provinces[id].cultureId !== c.cultureId).length;
      if (foreign < c.provinces.length * 0.3 || c.provinces.length < 8 || c.stability > 50)
        return null;
      triggerCivilWar(s, c, r, 'national awakening');
      return `Subject peoples rise against ${c.name}`;
    },
  },
];

const waveOf = (m: Moment) => WAVES.find(w => w.id === m.subject.split(':')[0]);

/** Starts each wave once, when its era opens and a moment slot is free. */
export function maybeStartRevolution(s: WorldState, r: RNG) {
  for (const def of WAVES) {
    if (s.year < def.from || s.year > def.to) continue;
    if (s.moments.some(m => m.kind === 'revolution' && m.subject.split(':')[0] === def.id))
      continue;
    const late = s.year > (def.from + def.to) / 2;
    if (!momentSlotFree(s) || !r.chance(late ? 0.05 : 0.01)) continue;
    const candidates = s.civilizations
      .filter(c => c.provinces.length && (!def.requires || has(c, def.requires)))
      .map(c => ({ c, score: def.origin(c) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);
    if (!candidates.length) continue;
    const origin = candidates[Math.min(candidates.length - 1, r.int(0, 2))].c;
    const m = startMoment(
      s,
      'revolution',
      def.title,
      def.id,
      origin.id,
      [origin.id],
      `${def.title} begins in ${origin.name}. New ideas will press on every connected country.`,
    );
    m.series.push([s.year, 1]);
    def.start?.(s, origin, m, r);
    return;
  }
}

/** One year of a wave: spread to connected realms, push their axes, spark revolts. */
export function tickRevolution(
  s: WorldState,
  m: Moment,
  neighborsOf: Map<number, Civilization[]>,
  r: RNG,
) {
  const def = waveOf(m);
  if (!def) return endMoment(s, m, 'The movement faded.');
  const reached = new Set(m.realmIds);
  const printing = (c: Civilization) => (has(c, 'printing') ? 1.5 : 1);
  for (const c of s.civilizations) {
    if (!c.provinces.length || reached.has(c.id)) continue;
    const touching = (neighborsOf.get(c.id) ?? []).some(n => reached.has(n.id));
    const known = c.knownRealmIds.some(id => reached.has(id));
    if (!touching && !known) continue;
    if (!r.chance((touching ? 0.06 : 0.015) * printing(c))) continue;
    m.realmIds.push(c.id);
    reached.add(c.id);
    if (isGreatPower(s, c))
      momentEvent(
        s,
        m,
        s.year,
        `${def.title} reaches ${c.name}`,
        `The great power ${c.name} is swept up in ${def.title.toLowerCase()}.`,
        [c.id],
      );
  }
  for (const id of m.realmIds) {
    const c = idx(s).civ.get(id);
    if (!c || !c.provinces.length) continue;
    for (const [axis, v] of Object.entries(def.push) as [AxisKey, number][])
      c.axes[axis] = Math.max(0, Math.min(100, c.axes[axis] + v));
    def.each?.(s, c, m, r);
    if (def.revolt && r.chance(0.02)) {
      const headline = def.revolt(s, c, r);
      if (headline)
        momentEvent(s, m, s.year, headline, `${headline}, part of ${def.title.toLowerCase()}.`, [
          c.id,
        ]);
    }
  }
  m.series.push([s.year, m.realmIds.length]);
  if (s.year - m.startYear < def.years) return;
  const revolts = m.events.filter(e => !e.title.includes('reaches')).length;
  endMoment(
    s,
    m,
    `${def.title} reached ${m.realmIds.length} realms over ${s.year - m.startYear} years and set off ${revolts} upheavals.`,
  );
}
