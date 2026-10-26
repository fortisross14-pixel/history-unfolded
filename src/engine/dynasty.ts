import type { Character, Civilization, Dynasty, Reign, WorldState } from '../types.ts';
import { RNG } from './rng.ts';
import { addEvent } from './events.ts';
import { courtOf, idx, isAlive, moveCharacter } from './lookup.ts';
import { DYNASTY_NAMES, FIRST_NAMES, REAL_DYNASTIES } from './data.ts';
import { chooseDatabase, dynastySurname, romanNumeral } from './naming.ts';
import {
  addDeed,
  killCharacter,
  createCharacter,
  earnNickname,
  fullName,
  generateSurname,
  pickAmbition,
} from './characters.ts';
import { TRAITS, rarityRank } from './traits.ts';
import { addRelation, endRelation, findRelation, relationsOf } from './diplomacy.ts';

/** Age at which an heir may rule without a regent. */
export const MAJORITY = 16;

/** Realm id used for exiled characters. */
export const EXILE = -1;

export function createDynasty(s: WorldState, c: Civilization, r: RNG, wanted?: string): Dynasty {
  const used = new Set(s.dynasties.map(d => dynastySurname(d)));
  const pool = chooseDatabase(s.config.nameMode, r) ? REAL_DYNASTIES : DYNASTY_NAMES;
  const available = pool.filter(n => !used.has(n));
  let surname = wanted ?? (available.length ? r.pick(available) : generateSurname(r));
  if (used.has(surname)) surname = wanted ? `${surname}-${generateSurname(r)}` : generateSurname(r);
  const d: Dynasty = {
    id: s.nextIds.dynasty++,
    name: `${surname} Dynasty`,
    founderId: null,
    foundedYear: s.year,
    originCultureId: c.cultureId,
    originRealmId: c.id,
    rulerIds: [],
    realmIds: [c.id],
    marriedIntoIds: [],
    totalYearsInPower: 0,
    peakTerritory: c.provinces.length,
    peakGDP: c.gdp,
    peakPopulation: c.population,
    warsWon: 0,
    wonderIds: [],
    status: 'ruling',
    historicalRelevance: 1,
  };
  s.dynasties.push(d);
  idx(s).dynasty.set(d.id, d);
  c.dynastyId = d.id;
  return d;
}

/** "Alaric II Torren": first name, regnal number within the dynasty, house name. */
function regnalName(s: WorldState, first: string, d: Dynasty) {
  const surname = dynastySurname(d);
  const count = d.rulerIds.filter(id => {
    const prior = idx(s).char.get(id);
    return prior?.name.startsWith(`${first} `);
  }).length;
  return `${first} ${romanNumeral(count + 1)} ${surname}`;
}

function reignScore(c: Civilization, reign: Reign) {
  const growth =
    Math.max(0, c.provinces.length - reign.startProvinces) * 3 +
    Math.max(0, c.technology - reign.startTechnology) / 5 +
    Math.max(0, (c.gdp / Math.max(0.1, reign.startGDP) - 1) * 30);
  return Math.min(100, Math.round(20 + growth));
}

/** Closes the current reign record, if the realm has one open. */
export function endReign(s: WorldState, c: Civilization, reason: string) {
  const reign = [...s.reigns].reverse().find(x => x.realmId === c.id && x.end === undefined);
  if (!reign) return;
  reign.end = s.year;
  reign.endReason = reason;
  reign.endProvinces = c.provinces.length;
  reign.endTechnology = c.technology;
  reign.endGDP = c.gdp;
  reign.endPopulation = c.population;
  reign.score = reignScore(c, reign);
  const ruler = idx(s).char.get(reign.characterId);
  if (ruler) {
    const gained = c.provinces.length - reign.startProvinces;
    if (gained >= 4) addDeed(s, ruler, `Expanded ${c.name} by ${gained} provinces`, gained);
    earnNickname(s, ruler);
  }
}

/** Puts a character on the throne and opens a reign record. */
export function crown(
  s: WorldState,
  c: Civilization,
  ch: Character,
  r: RNG,
  reason: string,
  union = false,
) {
  endReign(s, c, reason);
  const dynasty = ch.dynastyId ? idx(s).dynasty.get(ch.dynastyId) : undefined;
  // In a personal union the ruler keeps living at their home court.
  if (ch.realmId !== c.id && !union) moveCharacter(s, ch, c.id);
  ch.formerRole = ch.role === 'Ruler' ? ch.formerRole : ch.role;
  ch.role = 'Ruler';
  if (!ch.ambition || ch.ambition.status !== 'pending') ch.ambition = pickAmbition(s, ch, c, r);
  c.rulerId = ch.id;
  if (c.heirId === ch.id) c.heirId = 0;
  if (dynasty) {
    c.dynastyId = dynasty.id;
    if (!dynasty.rulerIds.includes(ch.id)) dynasty.rulerIds.push(ch.id);
    dynasty.founderId ??= ch.id;
    if (!dynasty.realmIds.includes(c.id)) dynasty.realmIds.push(c.id);
  }
  const minor = s.year - ch.born < MAJORITY;
  const reign: Reign = {
    id: s.nextIds.reign++,
    characterId: ch.id,
    name: ch.name,
    realmId: c.id,
    dynastyId: ch.dynastyId,
    start: s.year,
    government: c.government,
    startProvinces: c.provinces.length,
    startTechnology: c.technology,
    startGDP: c.gdp,
    startPopulation: c.population,
    score: 1,
  };
  s.reigns.push(reign);
  const known = idx(s).reigns.get(ch.id);
  if (known) known.push(reign);
  else idx(s).reigns.set(ch.id, [reign]);
  c.regentId = 0;
  if (minor && !union) startRegency(s, c, ch, reign, r);
  addEvent(
    s,
    'politics',
    `${fullName(ch)} takes the throne`,
    `${fullName(ch)} (${ch.rarity}; ${ch.traits.join(', ')}) begins to rule ${c.name} after ${reason}${minor ? ` at the age of ${s.year - ch.born}` : ''}. Ambition: ${ch.ambition?.label ?? 'none'}.`,
    rarityRank(ch.rarity) >= 3 ? 7 : 5,
    [c.id],
    {
      personIds: [ch.id],
      dynastyIds: ch.dynastyId ? [ch.dynastyId] : [],
      tags: ['ruler', 'succession'],
    },
  );
}

function startRegency(s: WorldState, c: Civilization, child: Character, reign: Reign, r: RNG) {
  const court = courtOf(s, c.id);
  let regent =
    court.filter(x => x.role === 'Statesman').sort((a, b) => b.skill - a.skill)[0] ??
    court.find(x => x.role === 'Consort' && child.parentIds.includes(x.id));
  regent ??= createCharacter(s, r, { role: 'Statesman', realm: c });
  c.regentId = regent.id;
  reign.regentId = regent.id;
  reign.regencyEnd = child.born + MAJORITY;
  addDeed(s, regent, `Became regent for the child ruler ${child.name}`, 3);
  addEvent(
    s,
    'politics',
    `Regency in ${c.name}`,
    `${regent.name} governs ${c.name} as regent until ${child.name} comes of age.`,
    5,
    [c.id],
    { personIds: [regent.id, child.id], tags: ['regency'] },
  );
}

/**
 * Removes the ruler (and heir) after a revolution, conquest or dynastic war.
 * They are executed or sent into exile, where they live out their days.
 */
export function deposeRuler(s: WorldState, c: Civilization, r: RNG, reason: string) {
  endReign(s, c, reason);
  // A realm in personal union simply leaves the union; the shared ruler is safe at home.
  const union = unionOf(s, c);
  if (union) {
    endRelation(s, union);
    c.rulerId = 0;
    c.heirId = 0;
    c.regentId = 0;
    return;
  }
  for (const id of [c.rulerId, c.heirId, c.regentId]) {
    const ch = idx(s).char.get(id);
    if (!isAlive(ch)) continue;
    if (ch.id === c.rulerId && r.chance(0.3)) {
      addDeed(s, ch, `Deposed: ${reason}`, 0);
      killCharacter(s, ch, 'executed');
    } else {
      addDeed(s, ch, `Exiled from ${c.name}`, 0);
      moveCharacter(s, ch, EXILE);
    }
  }
  c.rulerId = 0;
  c.heirId = 0;
  c.regentId = 0;
}

/** Creates a brand-new ruler for a realm: a new dynasty founder or a relative. */
export function newRuler(
  s: WorldState,
  c: Civilization,
  r: RNG,
  reason: string,
  newDynasty = false,
) {
  let d = c.dynastyId ? idx(s).dynasty.get(c.dynastyId) : undefined;
  if (newDynasty || !d || !['ruling', 'restored'].includes(d.status)) d = createDynasty(s, c, r);
  const ch = createCharacter(s, r, {
    role: 'Ruler',
    realm: c,
    dynastyId: d.id,
    born: s.year - r.int(18, 42),
    name: regnalName(s, r.pick(FIRST_NAMES), d),
  });
  crown(s, c, ch, r, reason);
  return ch;
}

/**
 * Called when the ruler has died or been removed. Picks the heir, a relative,
 * or a new dynasty.
 */
export function succession(s: WorldState, c: Civilization, r: RNG) {
  const old = idx(s).char.get(c.rulerId);
  const heir = idx(s).char.get(c.heirId);
  const cause = old?.deathCause ? `the death of ${old.name}` : 'succession';
  if (isAlive(heir)) {
    const d = heir.dynastyId ? idx(s).dynasty.get(heir.dynastyId) : undefined;
    if (d) heir.name = regnalName(s, heir.name.split(' ')[0], d);
    crown(s, c, heir, r, cause);
    return;
  }
  if (inheritCrown(s, c, r, cause)) return;
  const dynasty = c.dynastyId ? idx(s).dynasty.get(c.dynastyId) : undefined;
  // A distant cousin may still be found. Older dynasties have fewer claimants left.
  const dynastyAge = dynasty ? s.year - dynasty.foundedYear : 999;
  if (dynasty && r.chance(dynastyAge < 150 ? 0.7 : 0.45)) {
    newRuler(s, c, r, `${cause}, as a cousin of the ${dynasty.name}`);
    return;
  }
  if (dynasty) {
    dynasty.status = 'extinct';
    dynasty.endedYear = s.year;
    addEvent(
      s,
      'politics',
      `The ${dynasty.name} ends`,
      `${old?.name ?? 'The ruler'} left no heir. The ${dynasty.name} is extinct and ${c.name} faces a succession crisis.`,
      8,
      [c.id],
      {
        dynastyIds: [dynasty.id],
        tags: ['dynasty ended', 'succession crisis'],
        worldChronicle: true,
      },
    );
    if (c.provinces.length >= 8) c.stability = Math.max(8, c.stability - 20);
  }
  newRuler(s, c, r, 'a succession crisis', true);
}

/** The union relation that binds this realm to a senior realm, if any. */
export const unionOf = (s: WorldState, c: Civilization) =>
  s.relations.find(x => x.type === 'Vassal' && x.union && x.b === c.id);

/**
 * With no heir, a crown may pass to a realm linked by royal marriage: both
 * realms then share one ruler (a personal union, junior partner as vassal).
 */
function inheritCrown(s: WorldState, c: Civilization, r: RNG, cause: string) {
  for (const marriage of relationsOf(s, c.id, 'Marriage')) {
    const otherId = marriage.a === c.id ? marriage.b : marriage.a;
    const senior = idx(s).civ.get(otherId);
    if (!senior || !senior.provinces.length || unionOf(s, senior) || !r.chance(0.35)) continue;
    const heir = idx(s).char.get(senior.rulerId);
    if (
      !isAlive(heir) ||
      s.wars.some(
        w => w.active && w.participantIds.includes(c.id) && w.participantIds.includes(senior.id),
      )
    )
      continue;
    for (const rel of [
      findRelation(s, c.id, senior.id, 'Rival'),
      findRelation(s, c.id, senior.id, 'Alliance'),
    ])
      if (rel) endRelation(s, rel);
    addRelation(s, 'Vassal', senior.id, c.id, `Personal union under ${heir.name}`, { union: true });
    crown(s, c, heir, r, `${cause}, inheriting the crown through marriage`, true);
    addDeed(s, heir, `Inherited the crown of ${c.name}`, 12);
    addEvent(
      s,
      'diplomacy',
      `${senior.name} inherits the crown of ${c.name}`,
      `With no heir of its own, ${c.name} passed by marriage to ${fullName(heir)}, already ruler of ${senior.name}. The two realms now share one ruler.`,
      9,
      [senior.id, c.id],
      {
        personIds: [heir.id],
        tags: ['personal union', 'diplomacy'],
        worldChronicle: true,
      },
    );
    return true;
  }
  return false;
}

/** Royal marriages link dynasties; a known foreign house is preferred. */
function arrangeMarriage(s: WorldState, c: Civilization, ch: Character, r: RNG) {
  const own = ch.dynastyId;
  const partners = c.knownRealmIds
    .map(id => idx(s).civ.get(id))
    .filter(
      (x): x is Civilization =>
        !!x && x.provinces.length > 0 && !!x.dynastyId && x.dynastyId !== own,
    );
  const partner = partners.length && r.chance(0.75) ? r.pick(partners) : null;
  const dynastyId = partner?.dynastyId ?? null;
  const surname = dynastyId ? dynastySurname(idx(s).dynasty.get(dynastyId)!) : generateSurname(r);
  const spouse = createCharacter(s, r, {
    role: 'Consort',
    realm: c,
    dynastyId,
    born: ch.born + r.int(-6, 8),
    name: `${r.pick(FIRST_NAMES)} ${surname}`,
  });
  spouse.spouseId = ch.id;
  ch.spouseId = spouse.id;
  if (partner && own) {
    const a = idx(s).dynasty.get(own)!;
    const b = idx(s).dynasty.get(partner.dynastyId!)!;
    if (!a.marriedIntoIds.includes(b.id)) a.marriedIntoIds.push(b.id);
    if (!b.marriedIntoIds.includes(a.id)) b.marriedIntoIds.push(a.id);
    // The marriage binds the two realms for a generation.
    addRelation(s, 'Marriage', c.id, partner.id, `${ch.name} married ${spouse.name}`, {
      until: s.year + 30,
    });
    addEvent(
      s,
      'diplomacy',
      `Royal marriage between ${c.name} and ${partner.name}`,
      `${ch.name} of ${c.name} married ${spouse.name} of the ${b.name}, linking the two houses.`,
      5,
      [c.id, partner.id],
      { personIds: [ch.id, spouse.id], dynastyIds: [a.id, b.id], tags: ['royal marriage'] },
    );
  }
}

/** Heirs take one trait from each parent at most, then are shaped by a mentor. */
function bearHeir(s: WorldState, c: Civilization, ruler: Character, r: RNG) {
  const spouse = ruler.spouseId ? idx(s).char.get(ruler.spouseId) : undefined;
  const inherited = [...ruler.traits, ...(spouse?.traits ?? [])];
  const heir = createCharacter(s, r, {
    role: 'Heir',
    realm: c,
    dynastyId: ruler.dynastyId,
    born: s.year,
    parentIds: [ruler.id, ...(spouse ? [spouse.id] : [])],
    inheritedTraits: inherited,
    name: `${r.pick(FIRST_NAMES)} ${ruler.name.split(' ').at(-1)}`,
  });
  c.heirId = heir.id;
}

function mentorHeir(s: WorldState, c: Civilization, heir: Character, r: RNG) {
  const mentors = courtOf(s, c.id).filter(
    x => !['Ruler', 'Heir', 'Consort'].includes(x.role) && s.year - x.born >= 30,
  );
  if (!mentors.length) return;
  const mentor = mentors.sort((a, b) => b.skill - a.skill)[0];
  heir.mentorId = mentor.id;
  // A great mentor lifts the pupil's ability and may pass on a trait.
  heir.skill = Math.min(100, heir.skill + Math.round(mentor.skill / 12));
  const gift = mentor.traits.find(
    t => !heir.traits.includes(t) && !heir.traits.includes(TRAITS[t].opposite as never),
  );
  if (gift && r.chance(0.6)) {
    if (heir.traits.length >= 3) heir.traits.pop();
    heir.traits.push(gift);
  }
  addDeed(s, mentor, `Tutored the heir ${heir.name}`, 2);
}

/** Yearly ruler upkeep: marriage, children, mentoring, regency end, succession. */
export function rulerLifeCycle(s: WorldState, c: Civilization, r: RNG) {
  let ruler = idx(s).char.get(c.rulerId);
  const union = unionOf(s, c);
  if (union) {
    // The junior realm follows the senior crown, or breaks away when it changes hands.
    if (isAlive(ruler)) return;
    const senior = idx(s).civ.get(union.a);
    const heir = senior ? idx(s).char.get(senior.rulerId) : undefined;
    if (senior && isAlive(heir) && r.chance(0.6)) {
      crown(s, c, heir, r, `the union with ${senior.name}`, true);
      return;
    }
    endRelation(s, union);
    addEvent(
      s,
      'diplomacy',
      `${c.name} leaves its union`,
      `On the death of the shared ruler, ${c.name} chose a crown of its own.`,
      6,
      [c.id],
      { tags: ['personal union'] },
    );
  }
  if (!isAlive(ruler)) {
    succession(s, c, r);
    ruler = idx(s).char.get(c.rulerId)!;
  }
  // Regency ends when the child ruler comes of age, or if the regent dies.
  if (c.regentId) {
    const regent = idx(s).char.get(c.regentId);
    if (!isAlive(regent) || s.year - ruler.born >= MAJORITY) {
      c.regentId = 0;
      addEvent(
        s,
        'politics',
        `${ruler.name} rules alone`,
        `The regency in ${c.name} has ended.`,
        4,
        [c.id],
        {
          personIds: [ruler.id],
          tags: ['regency'],
        },
      );
    }
  }
  const rulerAge = s.year - ruler.born;
  const diplomacy = 1 + (ruler.traits.includes('Charismatic') ? 0.5 : 0);
  let spouse = ruler.spouseId ? idx(s).char.get(ruler.spouseId) : undefined;
  if (!isAlive(spouse) && rulerAge >= 16 && rulerAge < 50 && r.chance(0.12 * diplomacy)) {
    arrangeMarriage(s, c, ruler, r);
    spouse = idx(s).char.get(ruler.spouseId!);
  }
  const heir = idx(s).char.get(c.heirId);
  if (!isAlive(heir)) {
    c.heirId = 0;
    const fertile = rulerAge >= 17 && rulerAge < 55;
    const chance = isAlive(spouse) ? 0.16 : 0.03;
    if (fertile && r.chance(chance)) bearHeir(s, c, ruler, r);
  } else if (s.year - heir.born === 12) mentorHeir(s, c, heir, r);
}
