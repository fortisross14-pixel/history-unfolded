/**
 * Coalitions: when one great people runs away with the game (half again the score of the next,
 * or holding a victory goal), the others who know it band together against it. Out in the open:
 * the reason is told to everyone, coalition members think worse of the leader and better of
 * each other, and they go to war against it more readily. It breaks up when the lead melts.
 * No hidden bonuses: this is the counterplay of the other peoples, not a rubber band.
 */
import { allied, hasPact, remember } from './diplomacy.ts';
import { declareWar, log, militaryPower, score } from './game.ts';

/** turns between a coalition's warning to the player and its march */
const WAR_WARNING_TURNS = 5;
import type { GameState } from './types.ts';
import { VICTORY, type VictoryKind } from './victory.ts';

export const COALITION_FROM = 100;
export const RUNAWAY = 1.5;
export const RELIEF = 1.25;

const great = (s: GameState) => s.civs.filter(c => c.alive && !c.independent);

/** Who runs away with the game, and why (a phrase after "they" or "you"). */
export function runaway(s: GameState): { civId: number; reason: string } | null {
  const g = great(s);
  if (g.length < 3) return null;
  const ranked = g.map(c => ({ c, v: score(s, c.id) })).sort((a, b) => b.v - a.v);
  const [top, next] = ranked;
  const hold = Object.entries(s.holding ?? {}).find(([, h]) => h.civId === top.c.id);
  if (hold) {
    const v = VICTORY[hold[0] as VictoryKind];
    return { civId: top.c.id, reason: `hold the ${v?.name ?? hold[0]} goal` };
  }
  if (next.v > 0 && top.v >= next.v * RUNAWAY)
    return {
      civId: top.c.id,
      reason: `have a score (${top.v}) ${(top.v / next.v).toFixed(1)} times the next people's`,
    };
  // another people may hold a goal while not leading the score
  for (const [k, h] of Object.entries(s.holding ?? {}))
    if (s.civs[h.civId]?.alive)
      return {
        civId: h.civId,
        reason: `hold the ${VICTORY[k as VictoryKind]?.name ?? k} goal`,
      };
  return null;
}

/** Each turn: form, keep or break up the coalition. Returns lines for the player. */
export function coalitionTurn(s: GameState): string[] {
  const out: string[] = [];
  if (s.turn < COALITION_FROM) return out;
  const me = s.civs.find(c => c.isPlayer);
  const c = s.coalition;
  const r = runaway(s);
  if (c) {
    const leader = s.civs[c.against];
    const g = great(s).filter(x => x.id !== c.against);
    const top = Math.max(0, ...g.map(x => score(s, x.id)));
    const stillHolds = Object.values(s.holding ?? {}).some(h => h.civId === c.against);
    if (
      !leader?.alive ||
      (!stillHolds && score(s, c.against) < top * RELIEF) ||
      (r && r.civId !== c.against)
    ) {
      s.coalition = undefined;
      if (me && (c.members.includes(me.id) || c.against === me.id))
        out.push(
          `The coalition against the ${leader?.name ?? 'leader'} breaks up: the danger has passed.`,
        );
    } else {
      out.push(...jointWar(s));
      return out;
    }
  }
  if (!r) return out;
  const leader = s.civs[r.civId];
  const holdsGoal = Object.values(s.holding ?? {}).some(h => h.civId === leader.id);
  const members = great(s)
    .filter(
      x =>
        x.id !== leader.id &&
        // a held victory goal is news everywhere; otherwise only those who know the leader join
        (holdsGoal || x.met.includes(leader.id)) &&
        !allied(s, x.id, leader.id),
    )
    .map(x => x.id);
  if (members.length < 2) return out;
  s.coalition = { against: leader.id, members, since: s.turn, reason: r.reason };
  // an embargo: members end their trade treaties with the leader
  const before = s.treaties.length;
  s.treaties = s.treaties.filter(
    t =>
      t.kind !== 'trade' ||
      !(
        (t.a === leader.id && members.includes(t.b)) ||
        (t.b === leader.id && members.includes(t.a))
      ),
  );
  const cut = before - s.treaties.length;
  for (const m of members) {
    remember(s, m, leader.id, 'coalition', 'Grows too strong', -20, 0.1);
    for (const o of members) if (o !== m) remember(s, m, o, 'coalition', 'Stands with us', 10, 0.1);
  }
  // a held goal is news everywhere: the members now know the leader
  if (holdsGoal)
    for (const m of members) {
      if (!s.civs[m].met.includes(leader.id)) s.civs[m].met.push(leader.id);
      if (!leader.met.includes(m)) leader.met.push(m);
    }
  const names = members.map(id => s.civs[id].name);
  if (me?.id === leader.id)
    out.push(
      `A coalition forms against you: the ${names.join(', the ')} fear you, because you ${r.reason}.${cut ? ` They end ${cut} trade treaties with you.` : ''} Expect war.`,
    );
  else if (me && members.includes(me.id))
    out.push(
      `The peoples band together against the ${leader.name}, because they ${r.reason}. They count you among them.`,
    );
  out.push(...jointWar(s));
  return out;
}

/**
 * Together they are strong enough: when the members' combined strength reaches the leader's,
 * the AI members not already at war (and not bound by a pact) declare war together. The
 * player is never dragged in.
 */
function jointWar(s: GameState): string[] {
  const c = s.coalition;
  if (!c || (s.turn - c.since) % 5) return [];
  const leader = c.against;
  const free = c.members.filter(
    m =>
      !s.civs[m].isPlayer &&
      s.civs[m].alive &&
      !hasPact(s, m, leader) &&
      !s.wars.some(w => w.a === m || w.b === m),
  );
  const together = c.members
    .filter(m => s.civs[m].alive && !s.civs[m].isPlayer)
    .reduce((a, m) => a + militaryPower(s, m), 0);
  if (free.length < 2 || together < militaryPower(s, leader) * 0.9) {
    delete c.warned;
    return [];
  }
  const me = s.civs.find(x => x.isPlayer);
  // against the player, the coalition gathers in the open first: the same warning as any rival
  if (me?.id === leader && (c.warned === undefined || s.turn - c.warned < WAR_WARNING_TURNS)) {
    if (c.warned !== undefined) return [];
    c.warned = s.turn;
    for (const m of free)
      log(
        s,
        m,
        `The ${s.civs[m].name} are massing troops on the ${me.name} border (the coalition means to march on you).`,
      );
    return [
      `Warning: the coalition gathers (${free.map(m => `the ${s.civs[m].name}`).join(', ')}): they mean to march on you together.`,
    ];
  }
  delete c.warned;
  for (const m of free) declareWar(s, m, leader);
  const names = free.map(m => `the ${s.civs[m].name}`).join(', ');
  return me?.id === leader
    ? [`The coalition marches: ${names} declare war on you together.`]
    : me && c.members.includes(me.id)
      ? [`The coalition marches: ${names} declare war on the ${s.civs[leader].name}.`]
      : [];
}

/** Is this people a coalition member and that one its target? */
export const coalitionTarget = (s: GameState, civId: number, target: number) =>
  !!s.coalition && s.coalition.against === target && s.coalition.members.includes(civId);
