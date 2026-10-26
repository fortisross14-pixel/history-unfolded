import type {
  Character,
  City,
  Civilization,
  Culture,
  Dynasty,
  Legacy,
  RealmEvent,
  Reign,
  Religion,
  WorldState,
} from '../types.ts';

/**
 * Fast id lookups for one world. Built once per simulated year and kept in a
 * WeakMap, so it never ends up in saves. Code that creates entities during
 * the year registers them here too.
 */
export interface Index {
  civ: Map<number, Civilization>;
  city: Map<number, City>;
  char: Map<number, Character>;
  dynasty: Map<number, Dynasty>;
  religion: Map<number, Religion>;
  culture: Map<number, Culture>;
  /** Living characters by realm id. */
  court: Map<number, Character[]>;
  /** Active legacies by realm id. */
  legacies: Map<number, Legacy[]>;
  generationalAlive: number;
  reigns: Map<number, Reign[]>;
  /** Active realm events by realm id. */
  realmEvents: Map<number, RealmEvent[]>;
  /** Per-realm counts that feed the legacy score, built once a year. */
  legacy: Map<
    number,
    { arts: number; wonders: number; wins: number; cities: number; faiths: number }
  >;
  /** Living realms sorted by power, cached after power is updated. */
  ranking?: Civilization[];
}

const cache = new WeakMap<WorldState, Index>();

const byId = <T extends { id: number }>(list: T[]) => new Map(list.map(x => [x.id, x]));

export function rebuildIndex(s: WorldState): Index {
  const court = new Map<number, Character[]>();
  let generationalAlive = 0;
  for (const ch of s.characters) {
    if (ch.died !== undefined) continue;
    if (ch.rarity === 'Generational') generationalAlive++;
    const list = court.get(ch.realmId);
    if (list) list.push(ch);
    else court.set(ch.realmId, [ch]);
  }
  const legacies = new Map<number, Legacy[]>();
  for (const l of s.legacies) {
    if (l.end < s.year) continue;
    const list = legacies.get(l.realmId);
    if (list) list.push(l);
    else legacies.set(l.realmId, [l]);
  }
  const reigns = new Map<number, Reign[]>();
  for (const r of s.reigns) {
    const list = reigns.get(r.characterId);
    if (list) list.push(r);
    else reigns.set(r.characterId, [r]);
  }
  const realmEvents = new Map<number, RealmEvent[]>();
  for (const e of s.realmEvents) {
    if (!e.active) continue;
    const list = realmEvents.get(e.realmId);
    if (list) list.push(e);
    else realmEvents.set(e.realmId, [e]);
  }
  const legacy = new Map<
    number,
    { arts: number; wonders: number; wins: number; cities: number; faiths: number }
  >();
  const entry = (id: number) => {
    let x = legacy.get(id);
    if (!x) legacy.set(id, (x = { arts: 0, wonders: 0, wins: 0, cities: 0, faiths: 0 }));
    return x;
  };
  for (const a of s.artworks) entry(a.realmId).arts += a.rating / 10;
  for (const w of s.wonders) entry(w.realmId).wonders++;
  for (const w of s.wars) for (const id of w.winnerIds) entry(id).wins++;
  for (const c of s.cities) entry(c.founderRealmId).cities++;
  const chars = byId(s.characters);
  for (const rel of s.religions) {
    const founder = rel.founderId ? chars.get(rel.founderId) : undefined;
    if (founder) entry(founder.realmId).faiths++;
  }
  const index: Index = {
    civ: byId(s.civilizations),
    city: byId(s.cities),
    char: chars,
    dynasty: byId(s.dynasties),
    religion: byId(s.religions),
    culture: byId(s.cultures),
    court,
    legacies,
    generationalAlive,
    reigns,
    realmEvents,
    legacy,
  };
  cache.set(s, index);
  return index;
}

/** The current index for this world, building it on first use. */
export function idx(s: WorldState): Index {
  return cache.get(s) ?? rebuildIndex(s);
}

export const isAlive = (ch: Character | undefined): ch is Character =>
  !!ch && ch.died === undefined;

/** Living characters attached to a realm (ruler, heir, consort and notables). */
export function courtOf(s: WorldState, realmId: number): Character[] {
  return (idx(s).court.get(realmId) ?? []).filter(isAlive);
}

export function registerCharacter(s: WorldState, ch: Character) {
  const index = idx(s);
  index.char.set(ch.id, ch);
  const list = index.court.get(ch.realmId);
  if (list) list.push(ch);
  else index.court.set(ch.realmId, [ch]);
  if (ch.rarity === 'Generational') index.generationalAlive++;
}

/** Moves a living character to another realm's court. */
export function moveCharacter(s: WorldState, ch: Character, realmId: number) {
  const index = idx(s);
  const old = index.court.get(ch.realmId);
  if (old)
    index.court.set(
      ch.realmId,
      old.filter(x => x.id !== ch.id),
    );
  ch.realmId = realmId;
  const list = index.court.get(realmId);
  if (list) list.push(ch);
  else index.court.set(realmId, [ch]);
}

export function registerLegacy(s: WorldState, legacy: Legacy) {
  const index = idx(s);
  const list = index.legacies.get(legacy.realmId);
  if (list) list.push(legacy);
  else index.legacies.set(legacy.realmId, [legacy]);
}
