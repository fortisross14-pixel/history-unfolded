import type { EventCategory, HistoryEvent, WorldState } from '../types.ts';
import { idx } from './lookup.ts';

/** The chronicle keeps this many recent events (World Chronicle entries live on in moments and records). */
const KEEP_EVENTS = 1800;

/** Adds an entry to the chronicle, newest first. */
export function addEvent(
  s: WorldState,
  category: EventCategory,
  title: string,
  description: string,
  importance: number,
  civIds: number[] = [],
  extra: Partial<HistoryEvent> = {},
) {
  const e: HistoryEvent = {
    id: s.nextIds.event++,
    year: s.year,
    category,
    title,
    description,
    importance,
    civIds,
    personIds: [],
    cityIds: [],
    continentIds: [],
    breakthroughIds: [],
    warIds: [],
    momentIds: [],
    religionIds: [],
    cultureIds: [],
    wonderIds: [],
    dynastyIds: [],
    tags: [category],
    worldChronicle: false,
    ...extra,
  };
  s.events.unshift(e);
  for (const id of civIds) idx(s).civ.get(id)?.historyEventIds.push(e.id);
  // Trim in batches so adding an event stays cheap.
  if (s.events.length > KEEP_EVENTS + 200) s.events.length = KEEP_EVENTS;
  return e;
}
