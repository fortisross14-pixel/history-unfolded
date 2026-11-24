/**
 * Wild beasts: lairs of wolves, bears and boars in the wild land from the first turn, a few near
 * every people's start (never next to it), and old guardians at some ruins. Each lair keeps a pack
 * that roams a little around it and falls on weak things nearby (a lone scout, workers). A pack's
 * strength follows the peoples near it: about three in four fights go to a decent early army (the
 * starting levy with spears), while a lone scout mostly loses. Marching an army onto a lair
 * clears it and pays for it: pelts, meat or gold.
 *
 * Packs belong to the hidden raider people (raiders.ts), so they are hostile to everyone without
 * any war, and are moved and fought with the ordinary rules. Their state lives on s.raiders.lairs.
 */
import { DEFAULT_LOADOUT, type Loadout } from '../data/items.ts';
import { ageOf } from '../data/techs.ts';
import {
  attack,
  formationStrength,
  isWaterHex,
  log,
  orderMove,
  spawnFormation,
  territory,
} from './game.ts';
import { distance, neighbors, within } from './hex.ts';
import { isPassableLand } from './mapgen.ts';
import { hashSeed, mulberry32 } from './rng.ts';
import { searchRuins } from './ruins.ts';
import type { Civ, Formation, GameState } from './types.ts';
import { COHORT_SIZE, COMMAND_CAP, LEVY_COHORTS, isCivilian } from './units.ts';

export type Beast = 'wolves' | 'bears' | 'boars' | 'guardians';
export interface Lair {
  hex: number;
  kind: Beast;
  /** the pack that lives here, while it does */
  fid?: number;
  /** turn a new pack gathers when the old one is gone */
  next: number;
  /** turn the pack last grew to match the peoples near it */
  grown?: number;
}

export const BEASTS: Record<
  Beast,
  { pack: string; lair: string; loadout: Loadout; roams: boolean; goods: Record<string, number> }
> = {
  wolves: {
    pack: 'Wolf pack',
    lair: 'a wolf den',
    loadout: { ...DEFAULT_LOADOUT, weapon: 'spear', armour: 'padded' },
    roams: true,
    goods: { furs: 3, hides: 2 },
  },
  bears: {
    pack: 'Bears',
    lair: 'a bear cave',
    loadout: { ...DEFAULT_LOADOUT, weapon: 'axe', armour: 'leather' },
    roams: true,
    goods: { furs: 4, hides: 1 },
  },
  boars: {
    pack: 'Wild boars',
    lair: 'a boar wallow',
    loadout: { ...DEFAULT_LOADOUT, weapon: 'spear', shield: 'hide-shield' },
    roams: true,
    goods: { hides: 3, meat: 3 },
  },
  guardians: {
    pack: 'Ruin guardians',
    lair: 'the guardians of the ruins',
    loadout: { ...DEFAULT_LOADOUT, weapon: 'bronze-sword', shield: 'wicker-shield' },
    roams: false,
    goods: { copper: 2, tin: 2 },
  },
};

/**
 * A pack's strength against the reference army of the people nearest it (see refArmy), and the
 * guardians' at ruins (a little stronger: what they guard is worth more).
 */
export const WILD = { packRatio: 1, guardRatio: 1.1, spread: 0.12 };
/** each kind's number against how it fights: bears fight below theirs, boars a little above */
const KIND_RATIO: Record<Beast, number> = { wolves: 0.98, boars: 1.01, bears: 1.15, guardians: 1 };
/** lairs near each people's start, and how far from it */
export const LAIRS_PER_START = 3;
export const LAIR_NEAR = [3, 8] as const;
/** one more lair in the wild for about this many hexes of open land */
const LAND_PER_LAIR = 140;
/** a pack gone, the next gathers this many turns later */
const REGROW = 14;
/** packs grow to match the peoples near them this often */
const GROW_EVERY = 8;
/** no pack hunts before this turn: the first steps out of camp are safe */
const QUIET_UNTIL = 4;

export const lairAt = (s: GameState, hex: number) => s.raiders?.lairs?.find(l => l.hex === hex);
export const packOf = (s: GameState, f: Formation) =>
  s.raiders?.lairs?.find(l => l.fid === f.id && f.civId === s.raiders!.civ);
export const lairsSeenBy = (s: GameState, civId: number) =>
  (s.raiders?.lairs ?? []).filter(l => s.civs[civId].explored[l.hex]);

const greatPeoples = (s: GameState) => s.civs.filter(c => c.alive && !c.independent);

/** Where a people stands: its first city, or its settlers while it has none. */
function homeOf(s: GameState, civId: number): number | undefined {
  const c = s.cities.filter(x => x.civId === civId).sort((a, b) => a.id - b.id)[0];
  if (c) return c.hex;
  return s.formations.find(f => f.civId === civId && f.kind === 'settlers')?.hex;
}

/** A probe army: `n` full cohorts in one loadout, of a people (its bonuses count). */
function probe(civId: number, loadout: Loadout, n: number, people = COHORT_SIZE): Formation {
  return {
    id: -1,
    civId,
    name: '',
    kind: 'army',
    hex: 0,
    moves: 0,
    path: [],
    fortified: false,
    cohorts: Array.from({ length: n }, (_, k) => ({
      id: -1 - k,
      strength: k === n - 1 ? people : COHORT_SIZE,
      xp: 0,
      designId: null,
      loadout: { ...loadout },
    })),
  };
}

/**
 * The army a people near a lair could fairly bring: the starting levy re-armed with spears, or
 * the people's typical army (the median of those of three cohorts or more) when it is stronger.
 */
export function refArmy(s: GameState, civId: number): number {
  let ref = formationStrength(
    s,
    probe(civId, { ...DEFAULT_LOADOUT, weapon: 'spear' }, LEVY_COHORTS),
  );
  const armies = s.formations
    .filter(f => f.civId === civId && f.kind === 'army' && f.cohorts.length >= 3)
    .map(f => formationStrength(s, f))
    .sort((a, b) => a - b);
  if (armies.length) ref = Math.max(ref, armies[Math.floor(armies.length / 2)]);
  return ref;
}

/** The great people nearest a hex (by its home), if any. */
function nearestPeople(s: GameState, hex: number): Civ | undefined {
  const g = { w: s.map.w, h: s.map.h };
  let best: Civ | undefined,
    bd = Infinity;
  for (const c of greatPeoples(s)) {
    const h = homeOf(s, c.id);
    if (h === undefined) continue;
    const d = distance(g, h, hex);
    if (d < bd) [best, bd] = [c, d];
  }
  return best;
}

/** The strength a lair's pack should have now. */
export function packTarget(s: GameState, lair: Lair): number {
  const near = nearestPeople(s, lair.hex);
  const ref = near ? refArmy(s, near.id) : 100;
  // some lairs are fiercer than others: the number on the map tells which
  const vary =
    1 + (mulberry32(hashSeed(s.settings.map.seed, lair.hex * 97))() * 2 - 1) * WILD.spread;
  const base = lair.kind === 'guardians' ? WILD.guardRatio : WILD.packRatio;
  return ref * base * KIND_RATIO[lair.kind] * vary;
}

/** Cohorts that give a pack of this kind (about) this strength. */
function cohortsFor(s: GameState, civId: number, kind: Beast, target: number) {
  const l = BEASTS[kind].loadout;
  const one = Math.max(1, formationStrength(s, probe(civId, l, 1)));
  const want = Math.min(COMMAND_CAP, Math.max(1, target / one));
  const full = Math.floor(want);
  const part = Math.round((want - full) * COHORT_SIZE);
  const out: { strength: number }[] = [];
  for (let k = 0; k < full; k++) out.push({ strength: COHORT_SIZE });
  if (part >= 25 && full < COMMAND_CAP) out.push({ strength: part });
  if (!out.length) out.push({ strength: Math.max(25, part) });
  return out;
}

/** Gather (or regrow) the pack of a lair, sized to the peoples near it. */
function gather(s: GameState, civId: number, lair: Lair): Formation {
  const want = cohortsFor(s, civId, lair.kind, packTarget(s, lair));
  const f = spawnFormation(s, civId, lair.hex, want.length, BEASTS[lair.kind].pack);
  f.cohorts.forEach((c, k) => {
    c.loadout = { ...BEASTS[lair.kind].loadout };
    c.strength = want[k].strength;
  });
  lair.fid = f.id;
  lair.grown = s.turn;
  return f;
}

/** A pack at home grows to match the peoples near it (it never shrinks), and heals. */
function grow(s: GameState, f: Formation, lair: Lair) {
  for (const c of f.cohorts) c.strength = Math.min(COHORT_SIZE, c.strength + 10);
  if (s.turn - (lair.grown ?? 0) < GROW_EVERY) return;
  lair.grown = s.turn;
  const want = cohortsFor(s, f.civId, lair.kind, packTarget(s, lair));
  const have = f.cohorts.reduce((a, c) => a + c.strength, 0);
  const need = want.reduce((a, c) => a + c.strength, 0);
  if (need <= have) return;
  // top up the last cohort, then add new ones
  let extra = need - have;
  for (const c of f.cohorts) {
    const add = Math.min(extra, COHORT_SIZE - c.strength);
    c.strength += add;
    extra -= add;
  }
  while (extra >= 25 && f.cohorts.length < COMMAND_CAP) {
    const n = Math.min(COHORT_SIZE, extra);
    f.cohorts.push({
      id: s.nextId++,
      strength: n,
      xp: 0,
      designId: null,
      loadout: { ...BEASTS[lair.kind].loadout },
    });
    extra -= n;
  }
}

const lairKindFor = (s: GameState, hex: number, r: () => number): Beast => {
  const m = s.map;
  const v = m.vegetation[hex];
  const t = m.terrain[hex];
  if (m.relief[hex] === 'hills') return r() < 0.6 ? 'bears' : 'wolves';
  if (v === 'forest') return r() < 0.5 ? 'wolves' : r() < 0.5 ? 'bears' : 'boars';
  if (v === 'jungle' || v === 'marsh') return 'boars';
  if (t === 'tundra' || t === 'snow') return r() < 0.7 ? 'wolves' : 'bears';
  return r() < 0.6 ? 'wolves' : 'boars';
};

/**
 * Place the lairs, once: a few near each great people's start (not next to it), some more in
 * the wild, and guardians at some ruins away from the starts.
 */
export function placeLairs(s: GameState, civId: number) {
  const st = s.raiders!;
  const g = { w: s.map.w, h: s.map.h };
  const r = mulberry32(hashSeed(s.settings.map.seed, 6131));
  const own = territory(s);
  const homes = s.civs
    .filter(c => c.alive && !c.raiders)
    .map(c => homeOf(s, c.id))
    .filter((h): h is number => h !== undefined);
  const starts = homes.concat(s.map.starts);
  const lairs: Lair[] = [];
  const free = (i: number) =>
    !isWaterHex(s, i) &&
    isPassableLand(s.map, i) &&
    own[i] < 0 &&
    !s.formations.some(f => f.hex === i) &&
    !s.cities.some(c => c.hex === i) &&
    !s.ruins?.some(x => x.hex === i) &&
    !st.camps.some(c => c.hex === i) &&
    starts.every(h => distance(g, h, i) >= LAIR_NEAR[0]) &&
    lairs.every(l => distance(g, l.hex, i) >= 3);
  const put = (hex: number, kind?: Beast) =>
    lairs.push({ hex, kind: kind ?? lairKindFor(s, hex, r), next: s.turn });
  // near each great people's start
  for (const c of greatPeoples(s)) {
    const home = homeOf(s, c.id);
    if (home === undefined) continue;
    const ring = within(g, home, LAIR_NEAR[1]).filter(i => distance(g, home, i) >= LAIR_NEAR[0]);
    for (let k = 0, n = 0; k < 60 && n < LAIRS_PER_START && ring.length; k++) {
      const i = ring[Math.floor(r() * ring.length)];
      if (!free(i)) continue;
      put(i);
      n++;
    }
  }
  // the wild
  const land: number[] = [];
  for (let i = 0; i < g.w * g.h; i++)
    if (free(i) && starts.every(h => distance(g, h, i) >= 6)) land.push(i);
  const want = Math.round(land.length / LAND_PER_LAIR);
  for (let k = 0, n = 0; k < want * 10 && n < want && land.length; k++) {
    const i = land[Math.floor(r() * land.length)];
    if (!free(i)) continue;
    put(i);
    n++;
  }
  // guardians at some ruins away from the starts
  for (const ru of s.ruins ?? []) {
    if (starts.some(h => distance(g, h, ru.hex) < 6) || r() > 0.3) continue;
    if (s.formations.some(f => f.hex === ru.hex)) continue;
    put(ru.hex, 'guardians');
  }
  st.lairs = lairs;
  for (const l of lairs) gather(s, civId, l);
}

/** A lair cleared by an army of `by` standing on it: the reward. */
function clear(s: GameState, lair: Lair, by: Formation, out: string[]) {
  const st = s.raiders!;
  st.lairs = st.lairs!.filter(l => l !== lair);
  const pack = s.formations.find(f => f.id === lair.fid);
  if (pack) s.formations = s.formations.filter(f => f !== pack);
  const civ = s.civs[by.civId];
  const age = Math.max(1, ageOf(civ.techs));
  const gold = 10 * age + (lair.kind === 'guardians' ? 15 : 0);
  civ.gold += gold;
  const cap = s.cities.filter(c => c.civId === civ.id).sort((a, b) => a.id - b.id)[0];
  const goods = Object.entries(BEASTS[lair.kind].goods);
  if (cap) for (const [k, n] of goods) cap.stockpile[k] = (cap.stockpile[k] ?? 0) + n;
  const what = cap ? `, ${goods.map(([k, n]) => `${n} ${k}`).join(', ')}` : '';
  const msg = `${by.name} cleared ${BEASTS[lair.kind].lair}: ${gold} gold${what}.`;
  log(s, by.civId, msg);
  if (civ.isPlayer) out.push(msg);
  // guardians beaten: the ruins they kept are searched at once
  const found = s.ruins?.some(x => x.hex === lair.hex) ? searchRuins(s, by) : null;
  if (found && civ.isPlayer) out.push(found);
}

/** Once a turn, inside the raiders' turn: lairs cleared, packs gathered, grown, roaming, hunting. */
export function wildlifeTurn(s: GameState, civ: Civ): string[] {
  const out: string[] = [];
  const st = s.raiders!;
  if (!st.lairs) {
    // the start of a game (or an older save while the early game lasts)
    if (s.turn > 40) st.lairs = [];
    else placeLairs(s, civ.id);
  }
  const g = { w: s.map.w, h: s.map.h };
  const r = mulberry32(hashSeed(s.settings.map.seed, s.turn * 2713 + 5));
  const own = territory(s);
  for (const lair of [...st.lairs!]) {
    let f = lair.fid !== undefined ? s.formations.find(x => x.id === lair.fid) : undefined;
    // an army of anyone on the lair clears it
    const army = s.formations.find(
      o => o.hex === lair.hex && o.kind === 'army' && o.civId !== civ.id,
    );
    if (army) {
      clear(s, lair, army, out);
      continue;
    }
    if (!f) {
      if (lair.fid !== undefined) {
        lair.fid = undefined;
        lair.next = s.turn + REGROW;
      }
      if (s.turn < lair.next || s.formations.some(o => o.hex === lair.hex)) continue;
      f = gather(s, civ.id, lair);
    }
    f.path = [];
    if (f.hex === lair.hex) grow(s, f, lair);
    if (s.turn < QUIET_UNTIL) continue;
    const mine = formationStrength(s, f);
    // weak prey next to the pack, close to its lair: troops much weaker, or workers
    const adj = neighbors(g, f.hex);
    const prey = s.formations.find(
      o =>
        o.civId !== civ.id &&
        adj.includes(o.hex) &&
        distance(g, o.hex, lair.hex) <= 3 &&
        !isWaterHex(s, o.hex) &&
        o.aboard === undefined &&
        !s.cities.some(c => c.hex === o.hex) &&
        o.kind !== 'settlers' &&
        o.kind !== 'fleet' &&
        (isCivilian(o) || formationStrength(s, o) < mine * 0.6),
    );
    if (prey && f.moves > 0 && r() < 0.4) {
      attack(s, f.id, prey.hex);
      if (!s.formations.includes(f)) continue;
      // the pack goes back to its lair after the kill
      if (f.hex !== lair.hex) orderMove(s, f.id, lair.hex);
      continue;
    }
    if (!BEASTS[lair.kind].roams) {
      if (f.hex !== lair.hex) orderMove(s, f.id, lair.hex);
      continue;
    }
    // roam a little: out one hex now and then, and home again
    if (f.hex !== lair.hex) {
      if (r() < 0.6) orderMove(s, f.id, lair.hex);
    } else if (r() < 0.25) {
      const opts = neighbors(g, lair.hex).filter(
        h =>
          !isWaterHex(s, h) &&
          isPassableLand(s.map, h) &&
          !s.formations.some(o => o.hex === h) &&
          !s.cities.some(c => c.hex === h) &&
          own[h] < 0,
      );
      if (opts.length) orderMove(s, f.id, opts[Math.floor(r() * opts.length)]);
    }
  }
  return out;
}

/** Great AI peoples clear lairs near home with an army clearly stronger than the pack. */
export function aiHuntLairs(s: GameState, civ: Civ) {
  const st = s.raiders;
  if (!st?.lairs?.length || civ.independent) return;
  const g = { w: s.map.w, h: s.map.h };
  const mine = s.cities.filter(c => c.civId === civ.id);
  for (const lair of st.lairs) {
    if (!mine.some(c => distance(g, c.hex, lair.hex) <= 6)) continue;
    const pack = s.formations.find(f => f.id === lair.fid);
    const need = pack ? formationStrength(s, pack) * 1.1 : 0;
    const hunter = s.formations
      .filter(
        a =>
          a.civId === civ.id &&
          a.kind === 'army' &&
          a.moves > 0 &&
          a.cohorts.length >= 3 &&
          formationStrength(s, a) >= need,
      )
      .sort((x, y) => distance(g, x.hex, lair.hex) - distance(g, y.hex, lair.hex))[0];
    if (!hunter || distance(g, hunter.hex, lair.hex) > 8) continue;
    if (!pack) {
      if (!s.formations.some(o => o.hex === lair.hex)) orderMove(s, hunter.id, lair.hex);
      continue;
    }
    if (neighbors(g, hunter.hex).includes(pack.hex)) attack(s, hunter.id, pack.hex);
    else {
      const next = neighbors(g, pack.hex)
        .filter(h => !s.formations.some(o => o.hex === h) && !isWaterHex(s, h))
        .sort((x, y) => distance(g, hunter.hex, x) - distance(g, hunter.hex, y))[0];
      if (next !== undefined) orderMove(s, hunter.id, next);
    }
  }
}
