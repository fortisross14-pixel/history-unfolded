import type { Moment, MomentEvent, MomentKind, WorldState } from '../types.ts';
import { addEvent } from './events.ts';

/**
 * Every World Moment follows the same life: start, yearly ticks that move a
 * value (momentum, or how far a wave has spread), key events, resolution and
 * lasting effects. This module holds the shared parts; war.ts, discovery.ts
 * and revolutions.ts supply each kind's tick.
 */

/** Never more than this many World Moments running at once. */
export const MAX_ACTIVE_MOMENTS = 3;

export const activeMoments = (s: WorldState) => s.moments.filter(m => m.active);
export const momentSlotFree = (s: WorldState) => activeMoments(s).length < MAX_ACTIVE_MOMENTS;

export function startMoment(
  s: WorldState,
  kind: MomentKind,
  title: string,
  subject: string,
  originRealmId: number,
  realmIds: number[],
  text: string,
  extra: Partial<Moment> = {},
): Moment {
  const m: Moment = {
    id: s.nextIds.moment++,
    kind,
    title,
    subject,
    startYear: s.year,
    active: true,
    originRealmId,
    realmIds,
    series: [],
    events: [],
    ...extra,
  };
  s.moments.push(m);
  addEvent(s, 'world', `World Moment: ${title}`, text, 10, realmIds.slice(0, 6), {
    momentIds: [m.id],
    tags: ['world moment', kind],
    worldChronicle: true,
  });
  return m;
}

export function momentEvent(
  s: WorldState,
  m: Moment,
  t: number,
  title: string,
  text: string,
  realmIds: number[] = [],
  characterIds: number[] = [],
  swing?: number,
) {
  const e: MomentEvent = { t, title, text, realmIds, characterIds, swing };
  m.events.push(e);
}

export function endMoment(s: WorldState, m: Moment, summary: string) {
  m.active = false;
  m.endYear = s.year;
  m.summary = summary;
  addEvent(s, 'world', `${m.title} ends`, summary, 10, m.realmIds.slice(0, 6), {
    momentIds: [m.id],
    tags: ['world moment', m.kind, 'resolved'],
    worldChronicle: true,
  });
}
