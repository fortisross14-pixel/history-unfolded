/**
 * Towns and colonies. The realm grows as one piece: a new settlement is a town only when its
 * land will touch or overlap the realm's (within twice the territory radius of one of its towns,
 * so 3 or 4 hexes away with the usual radius of 2). Founded further out, it is a colony:
 *
 * - one district, and only what gathers (farms, pastures, fishing, woodlots, mines) with the
 *   houses to run them and the docks or harbour to ship from;
 * - its goods reach the realm only by road, or by sea when it lies on the coast and the realm has
 *   a harbour; otherwise they stay where they are;
 * - once the realm's towns reach it, it can be made a town, for gold.
 *
 * Later ages loosen this: from the Renaissance a colony may grow to four districts and build
 * anything; from the Industrial age every new settlement is a town, wherever it stands.
 */
import { SLOT_TYPES } from '../data/slots.ts';
import { ageOf } from '../data/techs.ts';
import { distance } from './hex.ts';
import type { City, GameState, Tier } from './types.ts';

/** Slot groups a colony may build (before the Renaissance). */
const COLONY_GROUPS = new Set(['farming', 'forestry', 'extraction', 'residential']);
/** Single buildings a colony may build besides: to ship its goods. */
const COLONY_EXTRA = new Set(['harbour', 'shipyard', 'town-hall']);

export const RENAISSANCE = 4;
export const INDUSTRIAL = 5;

/** The realm's reach for joining a town: twice the territory radius. */
const reach = (radius: number) => radius * 2;

/**
 * Would a settlement founded on `hex` by this people be a town or a colony? The first settlement
 * is always a town, and so is every one from the Industrial age.
 */
export function foundKind(
  s: GameState,
  civId: number,
  hex: number,
  radius: number,
): 'town' | 'colony' {
  const civ = s.civs[civId];
  if (civ.independent || ageOf(civ.techs) >= INDUSTRIAL) return 'town';
  const towns = s.cities.filter(c => c.civId === civId && !c.colony);
  if (!towns.length) return 'town';
  const g = { w: s.map.w, h: s.map.h };
  return towns.some(c => distance(g, c.hex, hex) <= reach(radius)) ? 'town' : 'colony';
}

/** What a colony may still not do, by the people's age. */
export function colonyLimits(s: GameState, c: City): { maxTier: Tier; gatherOnly: boolean } | null {
  if (!c.colony) return null;
  const age = ageOf(s.civs[c.civId].techs);
  if (age >= INDUSTRIAL) return null;
  if (age >= RENAISSANCE) return { maxTier: 'city', gatherOnly: false };
  return { maxTier: 'settlement', gatherOnly: true };
}

/** Why a colony cannot have this building, or null. */
export function colonyBuildProblem(s: GameState, c: City, typeId: string): string | null {
  const lim = colonyLimits(s, c);
  if (!lim?.gatherOnly) return null;
  const t = SLOT_TYPES[typeId];
  if (!t || COLONY_GROUPS.has(t.group) || COLONY_EXTRA.has(typeId)) return null;
  return 'A colony only gathers: farms, pastures, woodlots, mines, houses and docks (anything from the Renaissance).';
}

/** Can a colony be made a town now (the realm's towns reach it), and for how much gold? */
export function promoteInfo(
  s: GameState,
  c: City,
  radius: number,
): { gold: number; problem: string | null } | null {
  if (!c.colony) return null;
  const civ = s.civs[c.civId];
  const gold = 40 * Math.max(1, ageOf(civ.techs));
  const g = { w: s.map.w, h: s.map.h };
  const joined = s.cities.some(
    x => x.civId === c.civId && !x.colony && x !== c && distance(g, x.hex, c.hex) <= reach(radius),
  );
  if (!joined)
    return {
      gold,
      problem: `Not joined to your lands yet: found a town within ${reach(radius)} hexes of it first.`,
    };
  if (civ.gold < gold)
    return { gold, problem: `Needs ${gold} gold (${Math.floor(civ.gold)} now).` };
  return { gold, problem: null };
}

export function promoteColony(
  s: GameState,
  cityId: number,
  radius: number,
): { ok: boolean; msg: string } {
  const c = s.cities.find(x => x.id === cityId);
  const info = c && promoteInfo(s, c, radius);
  if (!c || !info) return { ok: false, msg: 'Not a colony.' };
  if (info.problem) return { ok: false, msg: info.problem };
  s.civs[c.civId].gold -= info.gold;
  c.colony = undefined;
  return { ok: true, msg: `${c.name} is a town of the realm now.` };
}
