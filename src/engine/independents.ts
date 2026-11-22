/**
 * Free peoples: small independent cities that never expand. A people can win them over with
 * gifts, swear an alliance (they then send tribute every turn and fight at its side), absorb
 * them at a price once the alliance is old and warm, or simply conquer them.
 *
 * The alliance is meant to be the efficient choice: tribute costs nothing and keeps flowing,
 * while absorbing costs a lot of gold, some of the people leave, and every other free people
 * grows wary of the one who swallowed a neighbour.
 */
import { INDEPENDENT_PRESETS } from '../data/civs.ts';
import { GOODS } from '../data/goods.ts';
import {
  alliesOf,
  attitude,
  capitalOf,
  evaluateOffer,
  executeOffer,
  newProposal,
  opinion,
  remember,
  treatiesOf,
} from './diplomacy.ts';
import { invalidateMarkets } from './economy.ts';
import type { Civ, GameState } from './types.ts';

export const FRIEND_OPINION = 30;
export const ABSORB_OPINION = 60;
/** an alliance must be this old before the free people will consider joining */
export const ABSORB_ALLIED_TURNS = 10;
/** share of the people who leave rather than be ruled by another */
export const ABSORB_LOSS = 0.2;

export const ALLY_TRIBUTE_GOLD = 3;
export const ALLY_TRIBUTE_GOODS = 2;
export const FRIEND_TRIBUTE_GOLD = 1;

export const isFree = (c: Civ) => !!c.independent;

/** The good a free people is known for. */
export function specialtyOf(s: GameState, civId: number): string {
  const civ = s.civs[civId];
  return INDEPENDENT_PRESETS.find(p => p.name === civ.name)?.good ?? 'grain';
}

export type Standing = 'At war' | 'Allies' | 'Friends' | 'Wary' | 'Cold' | 'Hostile';

/** How a free people stands towards a people. */
export function standing(s: GameState, freeId: number, about: number): Standing {
  if (s.wars.some(w => (w.a === freeId && w.b === about) || (w.b === freeId && w.a === about)))
    return 'At war';
  if (alliesOf(s, freeId).includes(about)) return 'Allies';
  const op = opinion(s, freeId, about);
  if (op >= FRIEND_OPINION) return 'Friends';
  const a = attitude(op);
  return a === 'Hostile' ? 'Hostile' : a === 'Cold' ? 'Cold' : 'Wary';
}

/** The ally a free people is sworn to, if any (they swear to one people only). */
export const protectorOf = (s: GameState, freeId: number): number | undefined =>
  alliesOf(s, freeId).find(a => !s.civs[a].independent);

/** Gold it takes to absorb a free people: more for bigger cities. */
export function absorbCost(s: GameState, freeId: number): number {
  const pop = s.cities.filter(c => c.civId === freeId).reduce((a, c) => a + c.pop, 0);
  return Math.round((150 + pop / 15) / 10) * 10;
}

/** Why `by` cannot absorb the free people right now, or null. */
export function absorbProblem(s: GameState, by: number, freeId: number): string | null {
  const free = s.civs[freeId];
  if (!free.independent || !free.alive) return 'Only a free people can be absorbed.';
  const t = treatiesOf(s, by, freeId).find(x => x.kind === 'alliance');
  if (!t) return 'They must be your allies first.';
  const age = s.turn - t.since;
  if (age < ABSORB_ALLIED_TURNS)
    return `The alliance is too young (${ABSORB_ALLIED_TURNS - age} more turns).`;
  const op = opinion(s, freeId, by);
  if (op < ABSORB_OPINION) return `They are not ready to join you (opinion ${op}, need ${ABSORB_OPINION}).`;
  const cost = absorbCost(s, freeId);
  if (s.civs[by].gold < cost) return `It takes ${cost} gold to win over their elders.`;
  return null;
}

/** Make a free people part of `by`: its city and troops change hands. */
export function absorb(
  s: GameState,
  by: number,
  freeId: number,
  free = false,
): { ok: boolean; msg: string } {
  const why = free ? null : absorbProblem(s, by, freeId);
  if (why) return { ok: false, msg: why };
  const A = s.civs[by],
    F = s.civs[freeId];
  if (!free) A.gold -= absorbCost(s, freeId);
  for (const c of s.cities)
    if (c.civId === freeId) {
      c.civId = by;
      c.pop = Math.max(1000, Math.round((c.pop * (1 - ABSORB_LOSS)) / 50) * 50);
    }
  for (const f of s.formations) if (f.civId === freeId) f.civId = by;
  for (const h of F.explored.keys()) if (F.explored[h]) A.explored[h] = 1;
  s.treaties = s.treaties.filter(t => t.a !== freeId && t.b !== freeId);
  s.wars = s.wars.filter(w => w.a !== freeId && w.b !== freeId);
  F.alive = false;
  invalidateMarkets();
  for (const o of s.civs)
    if (o.alive && o.independent && o.id !== freeId)
      remember(s, o.id, by, 'swallowed', 'Swallowed a free people', -12, 0.1);
  const msg = `The ${F.name} have joined the ${A.name}.`;
  s.log.push({ turn: s.turn, civId: by, text: msg });
  return { ok: true, msg };
}

/** Send gold to a people as a gift: it is remembered for a while. */
export function giveGift(s: GameState, from: number, to: number, gold: number) {
  const A = s.civs[from];
  if (gold <= 0) return { ok: false, msg: 'Nothing to give.' };
  if (A.gold < gold) return { ok: false, msg: `You have only ${A.gold} gold.` };
  if (s.wars.some(w => (w.a === from && w.b === to) || (w.b === from && w.a === to)))
    return { ok: false, msg: 'They will not take gifts from an enemy.' };
  A.gold -= gold;
  s.civs[to].gold += gold;
  // small peoples are easier to impress than great ones
  const worth = s.civs[to].independent ? gold * 0.6 : gold * 0.3;
  remember(s, to, from, 'gift', 'Sent us gifts', Math.min(35, worth), 0.25);
  s.log.push({
    turn: s.turn,
    civId: from,
    text: `The ${A.name} sent the ${s.civs[to].name} a gift of ${gold} gold.`,
  });
  return { ok: true, msg: `The ${s.civs[to].name} thank you for the gift.` };
}

/** What a free people sends a people each turn, given their standing. */
export function tributeTo(s: GameState, freeId: number, to: number) {
  const st = standing(s, freeId, to);
  if (st === 'Allies')
    return { gold: ALLY_TRIBUTE_GOLD, goods: { [specialtyOf(s, freeId)]: ALLY_TRIBUTE_GOODS } };
  if (st === 'Friends') return { gold: FRIEND_TRIBUTE_GOLD, goods: {} };
  return { gold: 0, goods: {} as Record<string, number> };
}

/**
 * A free people's turn: keep a garrison, send tribute to friends and allies, seek peace when a
 * war drags on. Free peoples never expand and never start wars.
 */
export function independentTurn(s: GameState, civ: Civ, levy: (cityId: number) => void): string[] {
  const out: string[] = [];
  const me = s.civs.find(c => c.isPlayer)!;
  const city = capitalOf(s, civ.id);
  if (!city) return out;
  const garrison = s.formations.filter(f => f.civId === civ.id && f.kind === 'army');
  if (!garrison.length && city.pop >= 2500) levy(city.id);
  for (const f of s.formations)
    if (f.civId === civ.id && f.kind === 'army' && f.hex === city.hex) f.fortified = true;

  for (const o of s.civs) {
    if (!o.alive || o.independent || o.id === civ.id) continue;
    const t = tributeTo(s, civ.id, o.id);
    if (!t.gold && !Object.keys(t.goods).length) continue;
    o.gold += t.gold;
    const cap = capitalOf(s, o.id);
    if (cap) for (const [g, n] of Object.entries(t.goods)) cap.stockpile[g] = (cap.stockpile[g] ?? 0) + n;
  }

  for (const w of s.wars) {
    if (w.a !== civ.id && w.b !== civ.id) continue;
    const other = w.a === civ.id ? w.b : w.a;
    const length = s.turn - w.since;
    if (length < 8) continue;
    const offer = { give: {}, get: {}, peace: true };
    if (other === me.id) {
      if (length % 6 === 0 && !s.proposals.some(p => p.from === civ.id))
        newProposal(s, {
          from: civ.id,
          to: me.id,
          kind: 'peace',
          offer,
          text: `The elders of the ${civ.name} ask for peace.`,
        });
    } else if (evaluateOffer(s, civ.id, other, offer).accept) executeOffer(s, civ.id, other, offer);
  }
  return out;
}

/** Describe the per-turn gift for the UI. */
export function describeTribute(t: { gold: number; goods: Record<string, number> }): string {
  const parts: string[] = [];
  if (t.gold) parts.push(`${t.gold} gold`);
  for (const [g, n] of Object.entries(t.goods)) parts.push(`${n} ${GOODS[g]?.name ?? g}`);
  return parts.length ? `${parts.join(' + ')} a turn` : 'nothing';
}
