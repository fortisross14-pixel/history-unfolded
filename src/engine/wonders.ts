/**
 * World wonders as a race. Each wonder exists once in the world. A settlement (a town or
 * bigger) starts one by paying its goods; from then on half its production goes to it (all of
 * it when nothing else is queued), with nothing more to manage. The first to finish takes it;
 * everyone else building it gets half their work back as gold. A wonder gives its holder a realm
 * bonus, culture every turn and score, and changes hands with its city.
 */
import { WONDERS, WONDER_CULTURE, WONDER_LIST, type WonderDef } from '../data/wonders.ts';
import { difficultyOf } from './difficulty.ts';
import { isCoastal, marketSpend, marketStock, rankOf } from './economy.ts';
import { log } from './game.ts';
import { tagCounts } from './mods.ts';
import { hashSeed, mulberry32 } from './rng.ts';
import type { City, Civ, GameState } from './types.ts';

/** share of a settlement's production that goes to its wonder while other work is queued */
export const WONDER_SHARE = 0.5;
/** share of the work returned as gold when a rival finishes first */
export const WONDER_REFUND = 0.5;

export const wonderDone = (s: GameState, id: string) => s.wonders?.find(w => w.id === id);
/** The wonders a settlement holds. */
export const wondersIn = (s: GameState, cityId: number) =>
  (s.wonders ?? []).filter(w => w.cityId === cityId).map(w => WONDERS[w.id]);
/** The wonders a people holds (through its settlements). */
export function wondersOf(s: GameState, civId: number): WonderDef[] {
  const mine = new Set(s.cities.filter(c => c.civId === civId).map(c => c.id));
  return (s.wonders ?? []).filter(w => mine.has(w.cityId)).map(w => WONDERS[w.id]);
}
/** Who is building a wonder now, and how far along (0..1). */
export const builders = (s: GameState, id: string) =>
  s.cities
    .filter(c => c.wonder?.id === id)
    .map(c => ({ city: c, share: c.wonder!.progress / WONDERS[id].prod }));

/** Why a settlement cannot start a wonder, or null. */
export function wonderProblem(s: GameState, cityId: number, id: string): string | null {
  const w = WONDERS[id];
  const c = s.cities.find(x => x.id === cityId);
  if (!w || !c) return 'No such wonder.';
  const civ = s.civs[c.civId];
  if (civ.independent) return 'Free peoples build no wonders.';
  const done = wonderDone(s, id);
  if (done)
    return `Already built, in ${s.cities.find(x => x.id === done.cityId)?.name ?? 'a lost city'}.`;
  if (!civ.techs.includes(w.tech)) return 'Needs research first.';
  if (c.wonder?.id === id) return 'Already being built here.';
  if (rankOf(c.tier) < rankOf('town')) return 'Needs a town or bigger.';
  if (w.coast && !isCoastal(s, c)) return 'Needs a settlement by the sea.';
  if (s.cities.some(x => x !== c && x.civId === c.civId && x.wonder?.id === id))
    return `Already being built in ${s.cities.find(x => x !== c && x.civId === c.civId && x.wonder?.id === id)!.name}.`;
  const stock = marketStock(s, c);
  const short = Object.entries(w.goods).filter(([k, n]) => (stock[k] ?? 0) < n);
  if (short.length)
    return `Needs ${short.map(([k, n]) => `${n} ${k}`).join(' and ')} in its market to start.`;
  return null;
}

/** Start a wonder (pays its goods). Switching from another wonder loses that work. */
export function startWonder(
  s: GameState,
  cityId: number,
  id: string,
): { ok: boolean; msg: string } {
  const why = wonderProblem(s, cityId, id);
  if (why) return { ok: false, msg: why };
  const c = s.cities.find(x => x.id === cityId)!;
  const w = WONDERS[id];
  if (!marketSpend(s, c, w.goods)) return { ok: false, msg: 'The goods are not there.' };
  c.wonder = { id, progress: 0 };
  const msg = `${c.name} begins the ${w.name}.`;
  log(s, c.civId, msg);
  return { ok: true, msg };
}

export function stopWonder(s: GameState, cityId: number): { ok: boolean; msg: string } {
  const c = s.cities.find(x => x.id === cityId);
  if (!c?.wonder) return { ok: false, msg: 'Nothing to stop.' };
  const name = WONDERS[c.wonder.id].name;
  delete c.wonder;
  return { ok: true, msg: `${c.name} stops work on the ${name}; the work so far is lost.` };
}

/**
 * Called with a settlement's production each turn: the wonder takes its share (all of it when
 * nothing else is queued) and what is left goes to the queue. Returns the production left and
 * any messages for the player.
 */
export function workOnWonder(
  s: GameState,
  c: City,
  prod: number,
  queueEmpty: boolean,
): { left: number; msgs: string[] } {
  const msgs: string[] = [];
  if (!c.wonder) return { left: prod, msgs };
  const w = WONDERS[c.wonder.id];
  if (!w || wonderDone(s, w.id)) {
    delete c.wonder;
    return { left: prod, msgs };
  }
  const put = queueEmpty ? prod : prod * WONDER_SHARE;
  c.wonder.progress += put;
  if (c.wonder.progress >= w.prod) {
    delete c.wonder;
    s.wonders ??= [];
    s.wonders.push({ id: w.id, cityId: c.id, civId: c.civId, turn: s.turn });
    const civ = s.civs[c.civId];
    log(s, c.civId, `The ${civ.name} complete the ${w.name} in ${c.name}.`);
    const me = s.civs.find(x => x.isPlayer);
    if (civ.isPlayer) msgs.push(`The ${w.name} is complete in ${c.name}! ${w.note}`);
    else if (me)
      msgs.push(
        `${me.met.includes(civ.id) ? `The ${civ.name}` : 'A distant people'} completed the ${w.name}.`,
      );
    // everyone else building it loses the race: half the work comes back as gold
    for (const o of s.cities)
      if (o.wonder?.id === w.id) {
        const gold = Math.round(o.wonder.progress * WONDER_REFUND);
        s.civs[o.civId].gold += gold;
        delete o.wonder;
        if (s.civs[o.civId].isPlayer)
          msgs.push(
            `${o.name} lost the race for the ${w.name}: ${gold} gold of the work is recovered.`,
          );
      }
    return { left: queueEmpty ? 0 : prod - put, msgs };
  }
  return { left: queueEmpty ? 0 : prod - put, msgs };
}

/** Culture a settlement's wonders bring each turn. */
export const wonderCulture = (s: GameState, cityId: number) =>
  wondersIn(s, cityId).length * WONDER_CULTURE;

/** Wonders a people could start somewhere now. */
export const openWonders = (s: GameState, civ: Civ) =>
  WONDER_LIST.filter(w => civ.techs.includes(w.tech) && !wonderDone(s, w.id));

/** chance per turn that an AI people with no wonder under way starts one, by difficulty */
export const AI_WONDER_CHANCE = { casual: 0.04, normal: 0.06, hard: 0.09 };

/** AI peoples build a wonder now and then, in their most productive settlement. */
export function aiWonderTurn(s: GameState, civ: Civ, prodOf: (c: City) => number) {
  if (civ.independent || civ.isPlayer) return;
  const mine = s.cities.filter(c => c.civId === civ.id);
  const busy = mine.filter(c => c.wonder).length;
  const most = difficultyOf(s).id === 'hard' ? 2 : 1;
  if (busy >= most) return;
  const r = mulberry32(hashSeed(s.settings.map.seed, s.turn * 61 + civ.id * 389 + 9));
  if (r() > AI_WONDER_CHANCE[difficultyOf(s).id]) return;
  const tags = tagCounts(civ);
  const cities = mine
    .filter(c => !c.wonder && rankOf(c.tier) >= rankOf('town'))
    .sort((a, b) => prodOf(b) - prodOf(a));
  for (const c of cities.slice(0, 2)) {
    const pick = openWonders(s, civ)
      .filter(w => !wonderProblem(s, c.id, w.id))
      // not a race already nearly lost
      .filter(w => builders(s, w.id).every(b => b.share < 0.6))
      .map(w => ({ w, v: (w.tags ?? []).reduce((a, g) => a + (tags[g] ?? 0), 0) + r() * 2 }))
      .sort((a, b) => b.v - a.v)[0];
    if (pick) {
      startWonder(s, c.id, pick.w.id);
      return;
    }
  }
}
