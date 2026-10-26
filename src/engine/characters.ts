import type {
  Ambition,
  AmbitionType,
  Character,
  CharacterRole,
  Civilization,
  DeathCause,
  Rarity,
  TraitId,
  WorldState,
} from '../types.ts';
import { RNG } from './rng.ts';
import { addEvent } from './events.ts';
import { idx, isAlive, registerCharacter, courtOf } from './lookup.ts';
import { FIRST_NAMES, SURNAME_END, SURNAME_START } from './data.ts';
import {
  GENERATIONAL_CAP,
  RARITIES,
  ROLE_TRAITS,
  TRAITS,
  TRAIT_IDS,
  rarityDef,
  rarityRank,
} from './traits.ts';
import { grantAmbitionLegacy } from './legacy.ts';

// ---- Names ------------------------------------------------------------------

export function generateSurname(r: RNG) {
  return r.pick(SURNAME_START) + r.pick(SURNAME_END);
}

/** Family name: dynasty surname for royals, otherwise a generated one. */
export function surnameOf(s: WorldState, ch: Character) {
  const parts = ch.name.split(' ');
  const last = parts.at(-1)!;
  if (ch.dynastyId) {
    const d = idx(s).dynasty.get(ch.dynastyId);
    if (d) return d.name.replace(/ Dynasty$/, '');
  }
  return last;
}

export const age = (s: WorldState, ch: Character) => s.year - ch.born;

/** 1 (Common) to 5 (Generational). */
export const level = (ch: Character) => rarityRank(ch.rarity) + 1;

/** "Alaric II the Great" style display name. */
export const fullName = (ch: Character) => (ch.nickname ? `${ch.name} ${ch.nickname}` : ch.name);

// ---- Rarity, traits and ambitions --------------------------------------------

export function rollRarity(s: WorldState, r: RNG, min?: Rarity): Rarity {
  const alive = idx(s).generationalAlive;
  // Make sure the world is rarely without a Generational talent, but never crowded.
  const boost = alive === 0 ? 3 : 1;
  let q = r.next();
  let rarity: Rarity = 'Common';
  for (let i = RARITIES.length - 1; i >= 0; i--) {
    const def = RARITIES[i];
    const chance = def.id === 'Generational' ? def.chance * boost : def.chance;
    if (q < chance) {
      rarity = def.id;
      break;
    }
    q -= chance;
  }
  if (min && rarityRank(rarity) < rarityRank(min)) rarity = min;
  if (rarity === 'Generational' && alive >= GENERATIONAL_CAP) rarity = 'Legend';
  return rarity;
}

export function rollTraits(r: RNG, role: CharacterRole, inherited: TraitId[] = []): TraitId[] {
  const count = r.chance(0.6) ? 2 : 3;
  const traits: TraitId[] = [];
  const fits = (t: TraitId) =>
    !traits.includes(t) && !traits.includes(TRAITS[t].opposite as TraitId);
  for (const t of inherited) if (traits.length < count && fits(t) && r.chance(0.5)) traits.push(t);
  let guard = 0;
  while (traits.length < count && guard++ < 30) {
    const t = r.chance(0.45) ? r.pick(ROLE_TRAITS[role]) : r.pick(TRAIT_IDS);
    // Madness is rare.
    if (t === 'Mad' && !r.chance(0.25)) continue;
    if (fits(t)) traits.push(t);
  }
  return traits;
}

const AMBITION_LABEL: Record<AmbitionType, (target: string) => string> = {
  conquer: t => `Conquer ${t}`,
  expand: () => 'Expand the realm',
  'found-religion': () => 'Found a new religion',
  'reach-continent': () => 'Reach a new continent',
  'build-wonder': () => 'Build a wonder of the world',
  'grow-wealth': () => 'Make the realm rich',
  'great-discovery': () => 'Make a great discovery',
  'win-battles': () => 'Win five battles',
  reform: () => 'Reform the state',
};

/** Picks a life ambition that fits the character's role, traits and realm. */
export function pickAmbition(s: WorldState, ch: Character, c: Civilization, r: RNG): Ambition {
  const has = (t: TraitId) => ch.traits.includes(t);
  const unknownContinents = s.continents.some(x => !c.knownContinentIds.includes(x.id));
  const neighbors = c.knownRealmIds
    .map(id => idx(s).civ.get(id))
    .filter((x): x is Civilization => !!x && x.provinces.length > 0);
  const options: [AmbitionType, number][] = [];
  switch (ch.role) {
    case 'Ruler':
    case 'Heir':
      options.push(['expand', 3], ['grow-wealth', 2], ['reform', 2]);
      if (neighbors.length) options.push(['conquer', has('Ambitious') || has('Cruel') ? 5 : 2]);
      if (has('Patron') || has('Builder')) options.push(['build-wonder', 4]);
      if (has('Seafarer') && unknownContinents) options.push(['reach-continent', 4]);
      break;
    case 'General':
      options.push(['win-battles', 4]);
      if (neighbors.length) options.push(['conquer', 2]);
      break;
    case 'Admiral':
    case 'Explorer':
      options.push(unknownContinents ? ['reach-continent', 5] : ['expand', 2]);
      if (ch.role === 'Admiral') options.push(['win-battles', 2]);
      break;
    case 'Merchant':
      options.push(['grow-wealth', 5]);
      break;
    case 'Scholar':
      options.push(['great-discovery', 5]);
      if (has('Patron') || has('Builder')) options.push(['build-wonder', 1]);
      break;
    case 'Prophet':
      options.push(s.religions.length < 7 ? ['found-religion', 5] : ['reform', 2]);
      break;
    default:
      options.push(['reform', 4], ['grow-wealth', 1]);
  }
  let roll = r.next() * options.reduce((n, o) => n + o[1], 0);
  let type = options[0][0];
  for (const [t, w] of options) {
    roll -= w;
    if (roll <= 0) {
      type = t;
      break;
    }
  }
  const target = type === 'conquer' ? r.pick(neighbors) : undefined;
  const baseline =
    type === 'expand'
      ? c.provinces.length
      : type === 'grow-wealth'
        ? c.wealth
        : type === 'win-battles'
          ? ch.battlesWon
          : undefined;
  return {
    type,
    label: AMBITION_LABEL[type](target?.name ?? ''),
    targetId: target?.id,
    baseline,
    deadline: ch.born + Math.min(ch.lifespan, 65),
    status: 'pending',
  };
}

// ---- Creation ------------------------------------------------------------------

export interface NewCharacter {
  role: CharacterRole;
  realm: Civilization;
  born?: number;
  dynastyId?: number | null;
  name?: string;
  parentIds?: number[];
  inheritedTraits?: TraitId[];
  rarity?: Rarity;
  minRarity?: Rarity;
}

export function createCharacter(s: WorldState, r: RNG, o: NewCharacter): Character {
  const rarity = o.rarity ?? rollRarity(s, r, o.minRarity);
  const def = rarityDef(rarity);
  const traits = rollTraits(r, o.role, o.inheritedTraits);
  const born = o.born ?? s.year - r.int(20, 34);
  // Some children never reach adulthood: that is what makes successions dramatic.
  const diesYoung = o.born === s.year && r.chance(0.12);
  const baseLifespan = diesYoung ? r.int(3, 19) : r.int(48, 82);
  const lifespan = Math.max(
    diesYoung ? 3 : 30,
    baseLifespan + traits.reduce((n, t) => n + (TRAITS[t].lifespan ?? 0), 0),
  );
  const ch: Character = {
    id: s.nextIds.character++,
    name: o.name ?? `${r.pick(FIRST_NAMES)} ${generateSurname(r)}`,
    role: o.role,
    realmId: o.realm.id,
    dynastyId: o.dynastyId ?? null,
    cultureId: o.realm.cultureId,
    religionId: o.realm.faithId,
    born,
    lifespan,
    parentIds: o.parentIds ?? [],
    rarity,
    skill: r.int(def.skill[0], def.skill[1]),
    traits,
    ambition: null,
    deeds: [],
    fame: 0,
    legacyIds: [],
    battlesWon: 0,
    battlesLost: 0,
  };
  if (o.role !== 'Heir' && o.role !== 'Consort') ch.ambition = pickAmbition(s, ch, o.realm, r);
  s.characters.push(ch);
  registerCharacter(s, ch);
  if (rarityRank(rarity) >= 3 && o.role !== 'Heir' && o.role !== 'Consort') {
    addEvent(
      s,
      'great-person',
      `${ch.name} rises in ${o.realm.name}`,
      `A ${rarity} ${o.role.toLowerCase()} appears in ${o.realm.name}: ${traits.join(', ')}. Ambition: ${ch.ambition?.label ?? 'none'}.`,
      rarity === 'Generational' ? 9 : 7,
      [o.realm.id],
      {
        personIds: [ch.id],
        tags: ['character', rarity, o.role],
        worldChronicle: rarity === 'Generational',
      },
    );
  }
  return ch;
}

// ---- Deeds, fame and nicknames -------------------------------------------------

export function addDeed(s: WorldState, ch: Character, text: string, fame: number) {
  ch.deeds.push({ year: s.year, text, fame });
  ch.fame = Math.round(ch.fame + fame * rarityDef(ch.rarity).fame);
}

/** Counts deeds whose text starts with the given words, e.g. "Won". */
const deedCount = (ch: Character, prefix: string) =>
  ch.deeds.filter(d => d.text.startsWith(prefix)).length;

/**
 * Picks a nickname from what the character did. Called at notable moments and
 * at death; once a nickname is earned it is kept.
 */
export function earnNickname(s: WorldState, ch: Character) {
  if (ch.nickname) return;
  const has = (t: TraitId) => ch.traits.includes(t);
  const reign = idx(s).reigns.get(ch.id) ?? [];
  const gained = reign.reduce(
    (n, x) =>
      n + ((x.endProvinces ?? idx(s).civ.get(x.realmId)?.provinces.length ?? 0) - x.startProvinces),
    0,
  );
  const startSize = reign.reduce((n, x) => n + x.startProvinces, 0);
  const years = reign.reduce((n, x) => n + ((x.end ?? s.year) - x.start), 0);
  const warsWon = deedCount(ch, 'Won');
  const warsLost = deedCount(ch, 'Lost');
  const lived = (ch.died ?? s.year) - ch.born;
  const great = rarityRank(ch.rarity) >= 2;
  let nick: string | undefined;
  if (has('Mad')) nick = 'the Mad';
  else if (deedCount(ch, 'Discovered') > 0) nick = 'the Navigator';
  else if (deedCount(ch, 'Founded the faith') > 0) nick = 'the Prophet';
  else if (reign.length && gained >= 10 && great) nick = 'the Great';
  else if (warsWon >= 3) nick = has('Brave') ? 'the Lionheart' : 'the Conqueror';
  else if (ch.battlesWon >= 6) nick = 'the Invincible';
  else if (reign.length && startSize > 4 && gained <= -startSize * 0.3) nick = 'the Unlucky';
  else if (warsLost >= 2 && warsWon === 0) nick = 'the Unready';
  else if (deedCount(ch, 'Completed') > 0) nick = 'the Magnificent';
  else if (deedCount(ch, 'Revealed') > 0) nick = 'the Learned';
  else if (reign.length && ch.died !== undefined && lived < 25) nick = 'the Young';
  else if (reign.length && years >= 40) nick = 'the Old';
  else if (ch.fame >= 25 && has('Cruel')) nick = 'the Cruel';
  else if (ch.fame >= 25 && has('Just')) nick = 'the Just';
  else if (ch.fame >= 25 && has('Pious')) nick = 'the Pious';
  else if (ch.fame >= 25 && (has('Brilliant') || has('Reformer'))) nick = 'the Wise';
  else if (ch.fame >= 25 && has('Builder')) nick = 'the Builder';
  else if (ch.fame >= 25 && has('Lucky')) nick = 'the Fortunate';
  else if (ch.fame >= 25 && has('Greedy')) nick = 'the Rich';
  if (nick) ch.nickname = nick;
}

// ---- Ambitions ----------------------------------------------------------------

export function achieveAmbition(s: WorldState, ch: Character, how: string) {
  const a = ch.ambition;
  if (!a || a.status !== 'pending') return;
  a.status = 'achieved';
  a.resolvedYear = s.year;
  addDeed(s, ch, `Fulfilled a lifelong ambition: ${a.label.toLowerCase()} (${how})`, 12);
  grantAmbitionLegacy(s, ch, a.type);
  const realm = idx(s).civ.get(ch.realmId);
  addEvent(
    s,
    'great-person',
    `${fullName(ch)} fulfills an ambition`,
    `${ch.name} achieved the goal to ${a.label.toLowerCase()}: ${how}.`,
    rarityRank(ch.rarity) >= 3 ? 8 : 6,
    realm ? [realm.id] : [],
    { personIds: [ch.id], tags: ['ambition', a.type] },
  );
}

/** Ambition hooks that fire from other systems ("a war was won", "a continent was found"). */
export function notifyAmbition(
  s: WorldState,
  realmId: number,
  type: AmbitionType,
  how: string,
  targetId?: number,
  characterId?: number,
) {
  for (const ch of courtOf(s, realmId)) {
    const a = ch.ambition;
    if (!a || a.status !== 'pending' || a.type !== type) continue;
    if (characterId !== undefined && ch.id !== characterId && ch.role !== 'Ruler') continue;
    if (a.targetId !== undefined && targetId !== undefined && a.targetId !== targetId) continue;
    achieveAmbition(s, ch, how);
  }
}

/** Yearly check for ambitions that are measured, not triggered. */
export function checkAmbition(s: WorldState, ch: Character, c: Civilization) {
  const a = ch.ambition;
  if (!a || a.status !== 'pending') return;
  if (a.type === 'expand' && c.provinces.length >= (a.baseline ?? 0) + 6)
    achieveAmbition(s, ch, `${c.name} grew to ${c.provinces.length} provinces`);
  else if (a.type === 'grow-wealth' && c.wealth >= (a.baseline ?? Infinity) * 1.6)
    achieveAmbition(s, ch, `the treasury of ${c.name} grew by 60%`);
  else if (a.type === 'win-battles' && ch.battlesWon >= (a.baseline ?? 0) + 5)
    achieveAmbition(s, ch, `${ch.battlesWon} battles won`);
  else if (a.type === 'reform' && c.stability >= 75 && s.year - ch.born >= 30)
    achieveAmbition(s, ch, `${c.name} became stable and well governed`);
  else if (a.type === 'conquer' && a.targetId !== undefined) {
    const target = idx(s).civ.get(a.targetId);
    if (!target || !target.provinces.length) a.status = 'failed';
  }
  if (a.status === 'pending' && s.year > a.deadline) failAmbition(s, ch, c);
}

function failAmbition(s: WorldState, ch: Character, c: Civilization) {
  const a = ch.ambition!;
  a.status = 'failed';
  a.resolvedYear = s.year;
  if (ch.role !== 'Ruler') return;
  // A ruler who gives up on a lifelong dream sours the court.
  c.stability = Math.max(5, c.stability - 8);
  addDeed(s, ch, `Gave up the dream to ${a.label.toLowerCase()}`, 0);
}

// ---- Death ------------------------------------------------------------------------

export function killCharacter(s: WorldState, ch: Character, cause: DeathCause) {
  if (!isAlive(ch)) return;
  ch.died = s.year;
  ch.deathCause = cause;
  if (ch.rarity === 'Generational') idx(s).generationalAlive--;
  const realm = idx(s).civ.get(ch.realmId);
  if (ch.ambition?.status === 'pending') {
    ch.ambition.status = 'failed';
    ch.ambition.resolvedYear = s.year;
  }
  earnNickname(s, ch);
  // Generational talents always leave something behind.
  if (ch.rarity === 'Generational' && !ch.legacyIds.length && realm?.provinces.length)
    grantAmbitionLegacy(s, ch, ch.role === 'Merchant' ? 'grow-wealth' : 'reform');
  const notable = ch.fame >= 20 || rarityRank(ch.rarity) >= 3 || ch.role === 'Ruler';
  if (!notable || !realm) return;
  const how: Record<DeathCause, string> = {
    age: 'died of old age',
    battle: 'fell in battle',
    illness: 'died of illness',
    assassination: 'was assassinated',
    executed: 'was executed',
  };
  addEvent(
    s,
    'great-person',
    `${fullName(ch)} ${how[cause].split(' ')[0]}`,
    `${fullName(ch)}, ${ch.rarity} ${ch.role.toLowerCase()} of ${realm.name}, ${how[cause]} aged ${s.year - ch.born}.`,
    ch.role === 'Ruler' ? 6 : ch.fame >= 40 ? 8 : 4,
    [realm.id],
    {
      personIds: [ch.id],
      tags: ['death', ch.role, cause],
      worldChronicle: ch.rarity === 'Generational' || ch.fame >= 80,
    },
  );
}

/** Yearly risk of dying from age, illness or (for rulers) assassination. */
export function deathCheck(s: WorldState, ch: Character, c: Civilization | undefined, r: RNG) {
  const years = s.year - ch.born;
  if (years >= ch.lifespan) return killCharacter(s, ch, 'age');
  const sickly = ch.traits.includes('Sickly') ? 3 : 1;
  if (years > 1 && r.chance(0.0025 * sickly)) return killCharacter(s, ch, 'illness');
  if (ch.role === 'Ruler' && c) {
    const traitRisk = ch.traits.reduce((n, t) => n * (TRAITS[t].assassination ?? 1), 1);
    const unrest = c.stability < 30 ? 3 : c.stability < 50 ? 1.5 : 1;
    if (r.chance(0.0016 * traitRisk * unrest)) return killCharacter(s, ch, 'assassination');
  }
}
