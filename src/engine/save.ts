import type { Character, Rarity, TraitId, WorldState } from '../types.ts';
import { economyFromV4 } from './migrate-v5.ts';

/**
 * Save schema version. Bump it whenever WorldState changes shape and add a
 * migration below that upgrades a world from the previous version.
 */
export const SAVE_VERSION = 5;

type Migration = (world: any) => any;

const RARITY_BY_STARS: Rarity[] = ['Common', 'Rare', 'Epic', 'Legend', 'Generational'];
const SKILL_BY_RARITY: Record<Rarity, number> = {
  Common: 30,
  Rare: 48,
  Epic: 62,
  Legend: 79,
  Generational: 94,
};

/** v1 → v2: great people and ruler records become one Character model plus reigns. */
function charactersFromV1(w: any) {
  const roleMap: Record<string, Character['role']> = {
    Scientist: 'Scholar',
    Engineer: 'Scholar',
    Artist: 'Scholar',
    Merchant: 'Merchant',
    'Religious Figure': 'Prophet',
    General: 'General',
    Politician: 'Statesman',
  };
  const traitMap: Record<string, TraitId> = {
    Genius: 'Brilliant',
    Ambitious: 'Ambitious',
    Charismatic: 'Charismatic',
    Disciplined: 'Strategist',
    Radical: 'Reformer',
    Patient: 'Just',
    Visionary: 'Builder',
    Builder: 'Builder',
    Conqueror: 'Ambitious',
    Reformer: 'Reformer',
    Diplomat: 'Charismatic',
    Traditionalist: 'Just',
  };
  const characters: Character[] = [];
  let generationalAlive = 0;
  for (const p of w.people ?? []) {
    let rarity = RARITY_BY_STARS[(p.stars ?? 1) - 1] ?? 'Common';
    if (rarity === 'Generational' && p.active) {
      if (generationalAlive >= 3) rarity = 'Legend';
      else generationalAlive++;
    }
    const traits: TraitId[] = [traitMap[p.trait] ?? 'Ambitious'];
    if (p.role === 'Artist') traits.push('Patron');
    const age = (p.died ?? w.year) - p.born;
    characters.push({
      id: p.id,
      name: p.name,
      role: roleMap[p.role] ?? 'Statesman',
      realmId: p.realmId,
      dynastyId: null,
      cultureId: p.cultureId ?? null,
      religionId: p.religionId ?? null,
      born: p.born,
      died: p.active ? undefined : (p.died ?? w.year),
      deathCause: p.active ? undefined : 'age',
      lifespan: p.active ? age + 20 : age,
      parentIds: [],
      rarity,
      skill: SKILL_BY_RARITY[rarity],
      traits,
      ambition: null,
      deeds:
        p.achievement && p.achievement !== 'Career beginning'
          ? [
              {
                year: p.died ?? w.year,
                text: p.achievement,
                fame: Math.round(p.historicalRelevance / 4),
              },
            ]
          : [],
      fame: p.historicalRelevance ?? 0,
      legacyIds: [],
      battlesWon: p.battlesWon ?? 0,
      battlesLost: p.battlesLost ?? 0,
    });
  }
  // Ruler records get fresh ids after the great people.
  const rulerIdMap = new Map<number, number>();
  let nextId = w.nextIds.person ?? characters.length + 1;
  // Old reign records; the v4 → v5 migration renames their fields.
  const reigns: any[] = [];
  const currentRulers = new Set((w.civilizations ?? []).map((c: any) => c.rulerId));
  for (const r of w.rulers ?? []) {
    const id = nextId++;
    rulerIdMap.set(r.id, id);
    const avg = Math.round((r.administration + r.military + r.diplomacy) / 3);
    const rarity: Rarity =
      avg >= 85 ? 'Legend' : avg >= 70 ? 'Epic' : avg >= 50 ? 'Rare' : 'Common';
    const alive = currentRulers.has(r.id) && r.reignEnd === undefined;
    const died = alive ? undefined : (r.reignEnd ?? w.year);
    characters.push({
      id,
      name: r.name,
      role: 'Ruler',
      realmId: r.realmId,
      dynastyId: r.dynastyId ?? null,
      cultureId: null,
      religionId: null,
      born: r.born,
      died,
      deathCause: alive ? undefined : 'age',
      lifespan: alive
        ? Math.max(w.year - r.born + 1, (r.plannedReignEnd ?? w.year + 10) - r.born)
        : died! - r.born,
      parentIds: [],
      rarity,
      skill: avg,
      traits: [traitMap[r.trait] ?? 'Just'],
      ambition: null,
      deeds: [],
      fame: Math.round((r.historicalRelevance ?? 1) / 2),
      legacyIds: [],
      battlesWon: 0,
      battlesLost: 0,
    });
    reigns.push({
      id: reigns.length + 1,
      characterId: id,
      name: r.name,
      realmId: r.realmId,
      dynastyId: r.dynastyId ?? null,
      start: r.reignStart,
      end: r.reignEnd,
      endReason: r.reignEnd !== undefined ? 'succession' : undefined,
      government: r.government,
      startProvinces: r.startProvinces,
      endProvinces: r.endProvinces,
      startTechnology: r.startTechnology,
      endTechnology: r.endTechnology,
      startGDP: r.startGDP,
      endGDP: r.endGDP,
      startPopulation: r.startPopulation,
      endPopulation: r.endPopulation,
      score: r.historicalRelevance ?? 1,
    });
  }
  for (const c of w.civilizations ?? []) {
    c.rulerId = rulerIdMap.get(c.rulerId) ?? 0;
    c.heirId = 0;
    c.regentId = 0;
  }
  for (const d of w.dynasties ?? []) {
    d.rulerIds = (d.rulerIds ?? []).map((id: number) => rulerIdMap.get(id)).filter(Boolean);
    d.founderId = d.rulerIds[0] ?? null;
    delete d.founderPersonId;
    d.marriedIntoIds = [];
  }
  for (const rel of w.religions ?? []) {
    rel.founderId = rel.founderPersonId ?? null;
    delete rel.founderPersonId;
  }
  for (const won of w.wonders ?? []) {
    won.builderId = won.builderPersonId;
    delete won.builderPersonId;
  }
  for (const route of w.tradeRoutes ?? []) {
    route.founderId = route.founderPersonId;
    delete route.founderPersonId;
  }
  for (const art of w.artworks ?? []) {
    art.patronId = art.artistId;
    delete art.artistId;
  }
  for (const city of w.cities ?? [])
    for (const b of city.buildings ?? []) {
      b.builderId = b.builderPersonId;
      b.lastBuilderId = b.lastBuilderPersonId;
      delete b.builderPersonId;
      delete b.lastBuilderPersonId;
      for (const u of b.upgradeHistory ?? []) {
        u.characterId = u.personId;
        delete u.personId;
      }
    }
  for (const c of w.civilizations ?? [])
    for (const k of c.knownTechnologies ?? []) {
      if (k.source === 'scientist') k.source = 'scholar';
      k.sourceCharacterId = k.sourcePersonId;
      delete k.sourcePersonId;
    }
  for (const con of w.continents ?? []) {
    con.discoveredByCharacterId = con.discoveredByPersonId;
    delete con.discoveredByPersonId;
  }
  w.hallOfFame = (w.hallOfFame ?? []).map((h: any) =>
    h.category === 'person'
      ? { ...h, category: 'character' }
      : h.category === 'ruler'
        ? { ...h, category: 'character', entityId: rulerIdMap.get(h.entityId) ?? h.entityId }
        : h,
  );
  w.characters = characters;
  w.reigns = reigns;
  w.legacies = [];
  w.overrides = { realm: {}, city: {}, character: {}, dynasty: {}, continent: {}, war: {} };
  w.nextIds.character = nextId;
  w.nextIds.reign = reigns.length + 1;
  w.nextIds.legacy = 1;
  delete w.nextIds.person;
  delete w.nextIds.ruler;
  delete w.people;
  delete w.rulers;
  return w;
}

/** v2 → v3: culture's three axes become five national axes on each realm; rivalries become relations. */
function personalityFromV2(w: any) {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const isOcean = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < w.width &&
    y < w.height &&
    w.provinces[y * w.width + x]?.terrain === 'ocean';
  const coastal = (id: number) => {
    const p = w.provinces[id];
    const ds =
      p.x % 2
        ? [
            [1, 0],
            [-1, 0],
            [0, -1],
            [0, 1],
            [1, 1],
            [-1, 1],
          ]
        : [
            [1, 0],
            [-1, 0],
            [0, -1],
            [0, 1],
            [1, -1],
            [-1, -1],
          ];
    return ds.some(([dx, dy]) => isOcean(p.x + dx, p.y + dy));
  };
  for (const c of w.civilizations ?? []) {
    const culture = (w.cultures ?? []).find((x: any) => x.id === c.cultureId) ?? {};
    const share = c.provinces.length ? c.provinces.filter(coastal).length / c.provinces.length : 0;
    c.axes = {
      ambition: clamp(50 + (culture.peacefulViolent ?? 0) * 4),
      horizon: clamp(20 + share * 60),
      economy: clamp(50 - (culture.economicCreative ?? 0) * 4),
      faith: 50,
      order: clamp(50 - (culture.unstableStable ?? 0) * 4),
    };
    c.navy = 0;
    c.navyCapacity = 0;
    delete c.rivalryIds;
  }
  for (const culture of w.cultures ?? []) {
    delete culture.peacefulViolent;
    delete culture.economicCreative;
    delete culture.unstableStable;
  }
  w.relations = (w.rivalries ?? [])
    .filter((r: any) => r.status === 'active')
    .map((r: any, i: number) => ({
      id: i + 1,
      type: 'Rival',
      a: r.realmIds[0],
      b: r.realmIds[1],
      since: r.startedYear,
      wars: r.warIds?.length ?? 0,
      reason: `Old ${r.cause} rivalry`,
    }));
  w.nextIds.relation = w.relations.length + 1;
  delete w.nextIds.rivalry;
  delete w.rivalries;
  return w;
}

/** v3 → v4: battles are no longer stored; wars gain Great War fields; World Moments appear. */
function momentsFromV3(w: any) {
  for (const war of w.wars ?? []) {
    delete war.battles;
    delete war.battleIds;
    war.great = false;
    war.keyBattles = [];
    war.terms = [];
    if (war.active) {
      // Old-style wars in progress end where they stand.
      war.active = false;
      war.endYear = w.year;
      war.outcome = 'The war petered out without a decision.';
    }
  }
  for (const e of w.events ?? []) {
    delete e.battleIds;
    e.momentIds = [];
  }
  w.hallOfFame = (w.hallOfFame ?? []).filter((h: any) => h.category !== 'battle');
  for (const c of w.civilizations ?? []) c.power = 0;
  w.moments = [];
  w.nextIds.moment = 1;
  delete w.nextIds.battle;
  delete w.battles;
  return w;
}

/** migrations[n] upgrades a world from version n to version n + 1. */
const migrations: Record<number, Migration> = {
  1: charactersFromV1,
  2: personalityFromV2,
  3: momentsFromV3,
  4: economyFromV4,
};

/**
 * Brings a stored world up to SAVE_VERSION. Returns null when the save is
 * older than the first versioned format (those cannot be upgraded).
 */
export function migrateWorld(raw: any): WorldState | null {
  if (!raw || typeof raw !== 'object') return null;
  let world = raw;
  let version: number = typeof world.version === 'number' ? world.version : 0;
  if (version < 1) return null;
  while (version < SAVE_VERSION) {
    const step = migrations[version];
    if (!step) return null;
    world = step(world);
    version++;
    world.version = version;
  }
  return world as WorldState;
}
