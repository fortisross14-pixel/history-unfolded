/**
 * Diplomacy: what peoples think of each other (opinion), what they remember, and the deals
 * they make: trade, non-aggression pacts and alliances. War and peace live in game.ts but call
 * in here so that every declaration, betrayal and conquest is remembered.
 */
import { OPPOSED, TAGS } from '../data/culture.ts';
import { GOODS } from '../data/goods.ts';
import { marketSpend, marketStock } from './economy.ts';
import { distance } from './hex.ts';
import { tagCounts } from './mods.ts';
import type { Bundle, City, GameState, Offer, Proposal, Treaty } from './types.ts';

export const DEAL_TURNS = 20;
export const PACT_TURNS = 30;

// ---------------------------------------------------------------- memory

export function remember(
  s: GameState,
  to: number,
  about: number,
  kind: string,
  text: string,
  value: number,
  fade = 0.2,
) {
  if (to === about) return;
  s.memories.push({ to, about, kind, text, value, turn: s.turn, fade });
}

function fadeMemories(s: GameState) {
  for (const m of s.memories)
    m.value = m.value > 0 ? Math.max(0, m.value - m.fade) : Math.min(0, m.value + m.fade);
  s.memories = s.memories.filter(m => Math.abs(m.value) >= 1);
}

// ---------------------------------------------------------------- treaties

const pairIs = (t: { a: number; b: number }, a: number, b: number) =>
  (t.a === a && t.b === b) || (t.a === b && t.b === a);
export const treatiesOf = (s: GameState, a: number, b: number) =>
  s.treaties.filter(t => pairIs(t, a, b));
export const hasPact = (s: GameState, a: number, b: number) =>
  treatiesOf(s, a, b).some(t => t.kind === 'pact');
export const allied = (s: GameState, a: number, b: number) =>
  treatiesOf(s, a, b).some(t => t.kind === 'alliance');
export const alliesOf = (s: GameState, a: number) =>
  s.treaties
    .filter(t => t.kind === 'alliance' && (t.a === a || t.b === a))
    .map(t => (t.a === a ? t.b : t.a));
const atWarPair = (s: GameState, a: number, b: number) => s.wars.some(w => pairIs(w, a, b));

/** War ends every treaty between the two. */
export function breakTreaties(s: GameState, a: number, b: number) {
  s.treaties = s.treaties.filter(t => !pairIs(t, a, b));
}

// ---------------------------------------------------------------- opinion

export interface OpinionPart {
  label: string;
  value: number;
}

/** What `of` thinks of `about`, with the reasons. */
export function opinionParts(s: GameState, of: number, about: number): OpinionPart[] {
  const parts: OpinionPart[] = [];
  const A = s.civs[of],
    B = s.civs[about];
  const ta = tagCounts(A),
    tb = tagCounts(B);
  const strong = (t: Record<string, number>, k: string) => (t[k] ?? 0) >= 2;
  const shared = Object.keys(ta).filter(t => strong(ta, t) && strong(tb, t));
  if (shared.length)
    parts.push({
      label: `Shared ideas (${shared.map(t => TAGS[t].name).join(', ')})`,
      value: Math.min(24, shared.length * 8),
    });
  for (const [x, y] of OPPOSED)
    if ((strong(ta, x) && strong(tb, y)) || (strong(ta, y) && strong(tb, x)))
      parts.push({ label: `Clashing ideas (${TAGS[x].name} / ${TAGS[y].name})`, value: -15 });
  if (atWarPair(s, of, about)) parts.push({ label: 'At war', value: -40 });
  for (const t of treatiesOf(s, of, about)) {
    if (t.kind === 'pact') parts.push({ label: 'Non-aggression pact', value: 10 });
    if (t.kind === 'alliance') parts.push({ label: 'Allies', value: 25 });
    if (t.kind === 'trade') parts.push({ label: 'Trading partners', value: 5 });
  }
  const enemiesA = s.wars.filter(w => w.a === of || w.b === of).map(w => (w.a === of ? w.b : w.a));
  const common = enemiesA.filter(e => e !== about && atWarPair(s, about, e));
  if (common.length)
    parts.push({
      label: `Common enemy (${common.map(e => s.civs[e].name).join(', ')})`,
      value: 15,
    });
  const g = { w: s.map.w, h: s.map.h };
  const close = s.cities.some(
    c => c.civId === of && s.cities.some(d => d.civId === about && distance(g, c.hex, d.hex) <= 6),
  );
  if (close) parts.push({ label: 'Crowded borders', value: -10 });
  // memories, summed by kind so the list stays readable
  const byKind = new Map<string, OpinionPart>();
  for (const m of s.memories) {
    if (m.to !== of || m.about !== about) continue;
    const ex = byKind.get(m.kind);
    if (ex) ex.value += m.value;
    else byKind.set(m.kind, { label: m.text, value: m.value });
  }
  for (const p of byKind.values()) parts.push({ label: p.label, value: Math.round(p.value) });
  return parts;
}

export function opinion(s: GameState, of: number, about: number): number {
  return Math.max(
    -100,
    Math.min(
      100,
      opinionParts(s, of, about).reduce((a, p) => a + p.value, 0),
    ),
  );
}

export function attitude(v: number): string {
  return v >= 50 ? 'Friendly' : v >= 15 ? 'Warm' : v > -15 ? 'Wary' : v > -50 ? 'Cold' : 'Hostile';
}

// ---------------------------------------------------------------- valuing deals

const PRICE: Record<string, number> = {
  wood: 1,
  stone: 1.5,
  hides: 1.5,
  copper: 3,
  tin: 3,
  iron: 4,
  coal: 3,
  saltpeter: 5,
  horses: 4,
};
const priceOf = (g: string) => PRICE[g] ?? (GOODS[g]?.kind === 'luxury' ? 4 : 2);

export const capitalOf = (s: GameState, civId: number): City | undefined =>
  s.cities.filter(c => c.civId === civId).sort((a, b) => a.id - b.id)[0];

/** How much a people values goods: scarce goods are worth more to it. */
function goodValue(s: GameState, civId: number, g: string, n: number): number {
  const cap = capitalOf(s, civId);
  const have = cap ? (marketStock(s, cap)[g] ?? 0) : 0;
  const need = have < 15 ? 1.6 : have < 60 ? 1 : have < 200 ? 0.6 : 0.3;
  return priceOf(g) * need * n;
}

function bundleValue(s: GameState, civId: number, b: Bundle, turns: number): number {
  let v = (b.gold ?? 0) + (b.goldPerTurn ?? 0) * turns * 0.7;
  for (const [g, n] of Object.entries(b.goods ?? {})) v += goodValue(s, civId, g, n);
  for (const [g, n] of Object.entries(b.goodsPerTurn ?? {}))
    v += goodValue(s, civId, g, n * turns) * 0.7;
  return v;
}

/** Can the side pay the one-off part of a bundle right now? */
function canPay(s: GameState, civId: number, b: Bundle): string | null {
  if ((b.gold ?? 0) > s.civs[civId].gold) return `${s.civs[civId].name} lack the gold.`;
  const cap = capitalOf(s, civId);
  const goods = { ...(b.goods ?? {}) };
  // the first turn of a per-turn deal must also be payable
  for (const [g, n] of Object.entries(b.goodsPerTurn ?? {})) goods[g] = (goods[g] ?? 0) + n;
  if (Object.keys(goods).length && !cap) return `${s.civs[civId].name} have no city to pay from.`;
  const stock = cap ? marketStock(s, cap) : {};
  for (const [g, n] of Object.entries(goods))
    if ((stock[g] ?? 0) < n) return `${s.civs[civId].name} lack ${GOODS[g]?.name ?? g}.`;
  return null;
}

export interface Evaluation {
  accept: boolean;
  value: number;
  reason: string;
}

/** Would `to` accept this offer from `from`? */
export function evaluateOffer(s: GameState, from: number, to: number, o: Offer): Evaluation {
  const turns = o.turns ?? DEAL_TURNS;
  const op = opinion(s, to, from);
  const payFrom = canPay(s, from, o.give);
  if (payFrom) return { accept: false, value: 0, reason: payFrom };
  const payTo = canPay(s, to, o.get);
  if (payTo) return { accept: false, value: 0, reason: payTo };
  const war = atWarPair(s, from, to);
  if (war && !o.peace)
    return { accept: false, value: 0, reason: 'You are at war: offer peace first.' };
  let value = bundleValue(s, to, o.give, turns) - bundleValue(s, to, o.get, turns);
  if (o.peace) {
    if (!war) return { accept: false, value: 0, reason: 'You are not at war.' };
    const w = s.wars.find(x => pairIs(x, from, to))!;
    const length = s.turn - w.since;
    if (length < 6)
      return {
        accept: false,
        value: 0,
        reason: `They want this war to run its course (${6 - length} more turns).`,
      };
    const mine = powerOfCiv(s, to),
      theirs = powerOfCiv(s, from);
    // how the war is going for them (`to`): losses, cities taken, and who is stronger now
    const myDead = w.dead?.[to] ?? 0,
      theirDead = w.dead?.[from] ?? 0;
    const winning = theirDead > myDead * 1.3 + 200 || (w.taken?.[to] ?? 0) > (w.taken?.[from] ?? 0);
    const losing = myDead > theirDead * 1.3 + 200 || (w.taken?.[from] ?? 0) > (w.taken?.[to] ?? 0);
    const quiet = w.lastFight !== undefined ? s.turn - w.lastFight >= 15 : length >= 40;
    value +=
      length * 0.5 +
      (winning ? -35 : losing ? 30 : 0) +
      (quiet ? 15 : 0) +
      (theirs / Math.max(1, mine) - 1) * 25;
  }
  if (o.pact) {
    if (hasPact(s, from, to))
      return { accept: false, value: 0, reason: 'You already have a pact.' };
    if (op < -10) return { accept: false, value: 0, reason: 'They do not trust you.' };
    value += op * 0.3;
  }
  if (o.alliance) {
    if (allied(s, from, to)) return { accept: false, value: 0, reason: 'You are already allies.' };
    if (op < 40)
      return {
        accept: false,
        value: 0,
        reason: `They are not close enough to you (${attitude(op).toLowerCase()}).`,
      };
    value += 10;
  }
  const empty =
    !o.peace &&
    !o.pact &&
    !o.alliance &&
    bundleValue(s, to, o.give, turns) === 0 &&
    bundleValue(s, to, o.get, turns) === 0;
  if (empty) return { accept: false, value: 0, reason: 'Put something in the deal.' };
  // friends forgive a slightly bad deal, rivals want a margin
  const need = 3 - op * 0.25;
  const accept = value >= need;
  return {
    accept,
    value,
    reason: accept
      ? 'They would accept.'
      : value > need - 15
        ? 'They want a little more.'
        : 'They want much more.',
  };
}

let powerOfCiv: (s: GameState, civId: number) => number = () => 1;
/** game.ts registers its power function here (keeps the module graph simple). */
export function setPowerFn(f: (s: GameState, civId: number) => number) {
  powerOfCiv = f;
}
let endWarFn: (s: GameState, a: number, b: number) => void = () => {};
export function setEndWarFn(f: (s: GameState, a: number, b: number) => void) {
  endWarFn = f;
}

function pay(s: GameState, from: number, to: number, b: Bundle) {
  const src = capitalOf(s, from),
    dst = capitalOf(s, to);
  if (b.gold) {
    s.civs[from].gold -= b.gold;
    s.civs[to].gold += b.gold;
  }
  if (b.goods && src && dst && marketSpend(s, src, b.goods))
    for (const [g, n] of Object.entries(b.goods)) dst.stockpile[g] = (dst.stockpile[g] ?? 0) + n;
}

/** Carry out an accepted offer. */
export function executeOffer(s: GameState, from: number, to: number, o: Offer) {
  const turns = o.turns ?? DEAL_TURNS;
  pay(s, from, to, o.give);
  pay(s, to, from, o.get);
  const perTurn = (b: Bundle) => !!(b.goldPerTurn || Object.keys(b.goodsPerTurn ?? {}).length);
  if (perTurn(o.give) || perTurn(o.get))
    s.treaties.push({
      kind: 'trade',
      a: from,
      b: to,
      since: s.turn,
      until: s.turn + turns,
      aGives: { goodsPerTurn: o.give.goodsPerTurn, goldPerTurn: o.give.goldPerTurn },
      bGives: { goodsPerTurn: o.get.goodsPerTurn, goldPerTurn: o.get.goldPerTurn },
    });
  if (o.peace) {
    endWarFn(s, from, to);
    remember(s, to, from, 'peace', 'Made peace with us', 10, 0.1);
    remember(s, from, to, 'peace', 'Made peace with us', 10, 0.1);
  }
  if (o.pact)
    s.treaties.push({ kind: 'pact', a: from, b: to, since: s.turn, until: s.turn + PACT_TURNS });
  if (o.alliance) s.treaties.push({ kind: 'alliance', a: from, b: to, since: s.turn, until: -1 });
  const gift = bundleValue(s, to, o.give, turns) - bundleValue(s, to, o.get, turns);
  if (gift > 10) remember(s, to, from, 'gift', 'Generous dealings', Math.min(25, gift / 4), 0.15);
  s.log.push({
    turn: s.turn,
    civId: from,
    text: `The ${s.civs[from].name} and the ${s.civs[to].name} agreed: ${describeOffer(s, o)}.`,
  });
}

/** The player (or an AI) offers a deal to another people. */
export function proposeDeal(
  s: GameState,
  from: number,
  to: number,
  o: Offer,
): { ok: boolean; msg: string } {
  const e = evaluateOffer(s, from, to, o);
  if (!e.accept) return { ok: false, msg: `The ${s.civs[to].name} decline. ${e.reason}` };
  executeOffer(s, from, to, o);
  return { ok: true, msg: `The ${s.civs[to].name} accept.` };
}

export function describeBundle(b: Bundle, turns = DEAL_TURNS): string {
  const parts: string[] = [];
  if (b.gold) parts.push(`${b.gold} gold`);
  for (const [g, n] of Object.entries(b.goods ?? {}))
    if (n) parts.push(`${n} ${GOODS[g]?.name.toLowerCase() ?? g}`);
  if (b.goldPerTurn) parts.push(`${b.goldPerTurn} gold a turn`);
  for (const [g, n] of Object.entries(b.goodsPerTurn ?? {}))
    if (n) parts.push(`${n} ${GOODS[g]?.name.toLowerCase() ?? g} a turn`);
  if ((b.goldPerTurn || Object.keys(b.goodsPerTurn ?? {}).length) && parts.length)
    parts[parts.length - 1] += ` for ${turns} turns`;
  return parts.join(', ');
}

export function describeOffer(s: GameState, o: Offer): string {
  const parts: string[] = [];
  if (o.peace) parts.push('peace');
  if (o.pact) parts.push(`a non-aggression pact for ${PACT_TURNS} turns`);
  if (o.alliance) parts.push('an alliance');
  const g = describeBundle(o.give, o.turns),
    t = describeBundle(o.get, o.turns);
  if (g) parts.push(`${g} one way`);
  if (t) parts.push(`${t} the other`);
  void s;
  return parts.join('; ') || 'nothing';
}

// ---------------------------------------------------------------- proposals to the player

export function answerProposal(
  s: GameState,
  id: number,
  yes: boolean,
): { ok: boolean; msg: string } {
  const p = s.proposals.find(x => x.id === id);
  if (!p) return { ok: false, msg: 'That offer is gone.' };
  s.proposals = s.proposals.filter(x => x !== p);
  const them = s.civs[p.from];
  if (!yes) {
    if (p.kind === 'demand') {
      remember(s, p.from, p.to, 'refused', 'Refused our demand', -25, 0.15);
      return { ok: true, msg: `You refused the ${them.name}. They will not forget.` };
    }
    remember(s, p.from, p.to, 'rebuffed', 'Turned down our offer', -3, 0.1);
    return { ok: true, msg: 'Declined.' };
  }
  const why = canPay(s, p.to, p.offer.get) ?? canPay(s, p.from, p.offer.give);
  if (why) return { ok: false, msg: why };
  executeOffer(s, p.from, p.to, p.offer);
  if (p.kind === 'demand') remember(s, p.from, p.to, 'paid', 'Paid us tribute', 10, 0.1);
  return { ok: true, msg: `Agreed with the ${them.name}.` };
}

// ---------------------------------------------------------------- every turn

/** Trade flows, expiring treaties, fading memories. Returns messages for the player. */
export function diplomacyTurn(s: GameState): string[] {
  const out: string[] = [];
  const me = s.civs.find(c => c.isPlayer)!;
  for (const t of [...s.treaties]) {
    if (t.until >= 0 && s.turn > t.until) {
      s.treaties = s.treaties.filter(x => x !== t);
      if (t.a === me.id || t.b === me.id)
        out.push(
          `Your ${t.kind === 'pact' ? 'pact' : 'trade deal'} with the ${s.civs[t.a === me.id ? t.b : t.a].name} has run out.`,
        );
      continue;
    }
    if (t.kind !== 'trade') continue;
    const ok = flow(s, t, t.a, t.b, t.aGives) && flow(s, t, t.b, t.a, t.bGives);
    if (!ok) {
      s.treaties = s.treaties.filter(x => x !== t);
      if (t.a === me.id || t.b === me.id)
        out.push(
          `A trade deal with the ${s.civs[t.a === me.id ? t.b : t.a].name} collapsed: a side could not pay.`,
        );
    }
  }
  // old proposals lapse
  s.proposals = s.proposals.filter(p => s.turn - p.turn <= 1);
  fadeMemories(s);
  return out;
}

function flow(s: GameState, t: Treaty, from: number, to: number, b?: Bundle): boolean {
  if (!b) return true;
  if (b.goldPerTurn) {
    if (s.civs[from].gold < b.goldPerTurn) {
      remember(s, to, from, 'unpaid', 'Failed to pay what was agreed', -10, 0.2);
      return false;
    }
    s.civs[from].gold -= b.goldPerTurn;
    s.civs[to].gold += b.goldPerTurn;
  }
  if (b.goodsPerTurn && Object.keys(b.goodsPerTurn).length) {
    const src = capitalOf(s, from),
      dst = capitalOf(s, to);
    if (!src || !dst || !marketSpend(s, src, b.goodsPerTurn)) {
      remember(s, to, from, 'unpaid', 'Failed to deliver what was agreed', -10, 0.2);
      return false;
    }
    for (const [g, n] of Object.entries(b.goodsPerTurn))
      dst.stockpile[g] = (dst.stockpile[g] ?? 0) + n;
  }
  void t;
  return true;
}

export function newProposal(s: GameState, p: Omit<Proposal, 'id' | 'turn'>): Proposal {
  const full = { ...p, id: s.nextId++, turn: s.turn };
  s.proposals.push(full);
  return full;
}
