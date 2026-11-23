/**
 * Raiders: a threat of the early ages that belongs to no people. Camps appear in empty land near
 * settlements; each sends out bands that make for the nearest settlement, pillage it (gold and
 * people) and carry the loot home, and that attack troops and workers weaker than themselves on
 * the way. Burning a camp (marching an army into it) ends it and pays its hoard. Raiders cannot be
 * met, bargained with or befriended; as the world enters the Medieval age no new camps appear,
 * and by the Renaissance the last bands scatter.
 *
 * They are one hidden "people" (civ.raiders) so their bands use the ordinary rules for moving and
 * fighting; it is hostile to everyone without being at war in the diplomatic sense.
 */
import { ageOf } from '../data/techs.ts';
import { difficultyOf } from './difficulty.ts';
import {
  addRaiderCiv,
  cityGuard,
  attack,
  isWaterHex,
  log,
  orderMove,
  spawnFormation,
  territory,
} from './game.ts';
import { distance, neighbors } from './hex.ts';
import { isPassableLand } from './mapgen.ts';
import { hashSeed, mulberry32 } from './rng.ts';
import type { City, Civ, Formation, GameState } from './types.ts';

export interface RaiderCamp {
  hex: number;
  since: number;
  /** turn the next band rides out */
  next: number;
}
export interface RaiderState {
  civ: number;
  camps: RaiderCamp[];
  /** bands and the camp they belong to (its hex), and loot they carry home */
  bands: { fid: number; camp: number; loot?: number; orphan?: number }[];
  /** settlements pillaged recently, by id: the turn (a town is not raided again at once) */
  raided: Record<number, number>;
}

/** turn the first camp may appear, chance per turn of a new one, camps per great people */
export const RAIDERS = {
  casual: { from: 35, chance: 0.04, perPeople: 0.34, band: 2 },
  normal: { from: 25, chance: 0.06, perPeople: 0.5, band: 3 },
  hard: { from: 18, chance: 0.08, perPeople: 0.67, band: 3 },
};
/** no new camps once a great people reaches this age; bands scatter at the next */
export const RAIDERS_END_AGE = 3;
export const BANDS_PER_CAMP = 2;
/** a settlement is not raided again within this many turns */
export const RAID_COOLDOWN = 16;

export const isRaider = (s: GameState, civId: number) => !!s.civs[civId]?.raiders;
/** Raiders and everyone else are always hostile, at war or not. */
export const raiderHostile = (s: GameState, a: number, b: number) =>
  a !== b && (isRaider(s, a) || isRaider(s, b));
export const campAt = (s: GameState, hex: number) => s.raiders?.camps.find(c => c.hex === hex);

const greatPeoples = (s: GameState) => s.civs.filter(c => c.alive && !c.independent);
const leadingAge = (s: GameState) => Math.max(1, ...greatPeoples(s).map(c => ageOf(c.techs)));

/** The raider people, made the first time it is needed. */
function raiderCiv(s: GameState): Civ {
  if (s.raiders) return s.civs[s.raiders.civ];
  const civ = addRaiderCiv(s);
  s.raiders = { civ: civ.id, camps: [], bands: [], raided: {} };
  return civ;
}

/** Where a new camp may go: empty wild land, near enough to someone to matter. */
function campSite(s: GameState, r: () => number): number | undefined {
  const g = { w: s.map.w, h: s.map.h };
  const own = territory(s);
  const cities = s.cities;
  const me = s.civs.find(c => c.isPlayer);
  const mine = cities.filter(c => c.civId === me?.id);
  const level = difficultyOf(s).id;
  const nearPlayer = (i: number) => mine.some(c => distance(g, c.hex, i) <= 8);
  const options: number[] = [];
  for (let i = 0; i < g.w * g.h; i++) {
    if (own[i] >= 0 || isWaterHex(s, i) || !isPassableLand(s.map, i)) continue;
    if (s.formations.some(f => f.hex === i)) continue;
    if (s.raiders?.camps.some(c => distance(g, c.hex, i) < 6)) continue;
    let near = Infinity;
    for (const c of cities) near = Math.min(near, distance(g, c.hex, i));
    if (near < 4 || near > 8) continue;
    // Discovery: raiders keep away from the player while the game is young
    if (level === 'casual' && s.turn < 90 && nearPlayer(i)) continue;
    options.push(i);
  }
  // Veteran: the first camp near the player's lands comes early
  if (level === 'hard' && !s.raiders?.camps.some(c => nearPlayer(c.hex))) {
    const close = options.filter(nearPlayer);
    if (close.length) return close[Math.floor(r() * close.length)];
  }
  return options.length ? options[Math.floor(r() * options.length)] : undefined;
}

/** A band's cohorts: the difficulty's size near the player's lands, the standard size elsewhere. */
function bandSize(s: GameState, camp: number) {
  const g = { w: s.map.w, h: s.map.h };
  const me = s.civs.find(c => c.isPlayer);
  const nearPlayer = s.cities.some(c => c.civId === me?.id && distance(g, c.hex, camp) <= 9);
  const base = nearPlayer ? RAIDERS[difficultyOf(s).id].band : RAIDERS.normal.band;
  return base + (leadingAge(s) - 1);
}

/** How well a settlement is held: troops in it, and its townsfolk guard when ready. */
export function defence(s: GameState, c: City): number {
  const troops = s.formations
    .filter(f => f.hex === c.hex && f.civId === c.civId && f.kind === 'army')
    .reduce((a, f) => a + f.cohorts.length, 0);
  return troops + cityGuard(s, c).length * c.guard * 0.5;
}

/** The settlement a band rides for: the nearest one not raided lately. */
function targetOf(s: GameState, f: Formation, camp: number): number | undefined {
  const g = { w: s.map.w, h: s.map.h };
  const st = s.raiders!;
  let best: number | undefined,
    bd = Infinity;
  for (const c of s.cities) {
    if (s.turn - (st.raided[c.id] ?? -99) < RAID_COOLDOWN) continue;
    if (defence(s, c) >= f.cohorts.length) continue;
    const d = distance(g, camp, c.hex);
    if (d > 10) continue;
    const dd = distance(g, f.hex, c.hex);
    if (dd < bd) [best, bd] = [c.hex, dd];
  }
  return best;
}

/** Pillage a settlement next to a band: gold and people carried off. */
function pillage(s: GameState, f: Formation, cityHex: number, out: string[]) {
  const c = s.cities.find(x => x.hex === cityHex)!;
  const st = s.raiders!;
  const owner = s.civs[c.civId];
  const age = Math.max(1, ageOf(owner.techs));
  const gold = Math.min(Math.floor(owner.gold), 12 * age + f.cohorts.length * 2);
  owner.gold -= gold;
  const taken = c.pop > 1500 ? 250 : 0;
  c.pop -= taken;
  st.raided[c.id] = s.turn;
  const band = st.bands.find(b => b.fid === f.id);
  if (band) band.loot = (band.loot ?? 0) + gold;
  const msg = `Raiders pillaged ${c.name}: ${gold} gold${taken ? ` and ${taken} people` : ''} carried off.`;
  log(s, c.civId, msg);
  if (owner.isPlayer) out.push(`${msg} Burn their camp to end it.`);
}

/** Once a turn, when the raiders act. Returns messages for the player. */
export function raidersTurn(s: GameState): string[] {
  const out: string[] = [];
  // how many camps and when: the same on every level (the level decides where, and how strong
  // the bands near the player are)
  const diff = { ...RAIDERS.normal, from: RAIDERS[difficultyOf(s).id].from };
  const age = leadingAge(s);
  const me = s.civs.find(c => c.isPlayer);
  const g = { w: s.map.w, h: s.map.h };
  if (!s.raiders && (s.turn < diff.from || age >= RAIDERS_END_AGE)) return out;
  const civ = raiderCiv(s);
  const st = s.raiders!;
  const r = mulberry32(hashSeed(s.settings.map.seed, s.turn * 4219 + 77));
  const bandsOf = (camp: number) => st.bands.filter(b => b.camp === camp && !b.orphan).length;
  // forget bands that are gone
  st.bands = st.bands.filter(b => s.formations.some(f => f.id === b.fid));

  // the age of raiders ends: the last bands scatter
  if (age > RAIDERS_END_AGE) {
    if (st.camps.length || st.bands.length) {
      st.camps = [];
      s.formations = s.formations.filter(f => f.civId !== civ.id);
      st.bands = [];
      if (me)
        out.push('With order on the roads and walls round every town, the last raiders scatter.');
    }
    return out;
  }

  // camps burned: an army of anyone stands on one
  for (const camp of [...st.camps]) {
    const army = s.formations.find(
      f => f.hex === camp.hex && f.kind === 'army' && f.civId !== civ.id,
    );
    if (!army) continue;
    st.camps = st.camps.filter(c => c !== camp);
    const hoard =
      25 * age + st.bands.filter(b => b.camp === camp.hex).reduce((a, b) => a + (b.loot ?? 0), 0);
    s.civs[army.civId].gold += hoard;
    for (const b of st.bands) if (b.camp === camp.hex) b.orphan = s.turn;
    const msg = `The ${s.civs[army.civId].name} burned a raider camp and took its hoard of ${hoard} gold.`;
    log(s, army.civId, msg);
    if (army.civId === me?.id) out.push(msg);
  }

  // new camps, while the early ages last
  const room = Math.ceil(greatPeoples(s).length * diff.perPeople);
  if (age < RAIDERS_END_AGE && s.turn >= diff.from && st.camps.length < room && r() < diff.chance) {
    const hex = campSite(s, r);
    if (hex !== undefined) {
      st.camps.push({ hex, since: s.turn, next: s.turn + 2 });
      const near = me && s.cities.some(c => c.civId === me.id && distance(g, c.hex, hex) <= 9);
      if (near && me.explored[hex])
        out.push('Smoke in the hills: raiders have made camp near your lands.');
    }
  }

  // bands ride out
  for (const camp of st.camps) {
    if (s.turn < camp.next || bandSize(s, camp.hex) <= 0) continue;
    if (bandsOf(camp.hex) >= BANDS_PER_CAMP) continue;
    if (s.formations.some(f => f.hex === camp.hex)) continue;
    const f = spawnFormation(s, civ.id, camp.hex, bandSize(s, camp.hex), 'Raider band');
    for (const co of f.cohorts) co.loadout = { ...co.loadout, weapon: age >= 2 ? 'axe' : 'spear' };
    st.bands.push({ fid: f.id, camp: camp.hex });
    camp.next = s.turn + 9 + Math.floor(r() * 5);
  }

  // bands act: fight what is weaker next to them, pillage, go home with the loot
  for (const b of [...st.bands]) {
    const f = s.formations.find(x => x.id === b.fid);
    if (!f) continue;
    // a band whose camp burned wanders a while, then breaks up
    if (b.orphan !== undefined && s.turn - b.orphan > 8) {
      s.formations = s.formations.filter(x => x !== f);
      st.bands = st.bands.filter(x => x !== b);
      continue;
    }
    const adj = neighbors(g, f.hex);
    // easy prey next door: workers, settlers, small armies
    const prey = s.formations.find(
      o =>
        o.civId !== civ.id &&
        adj.includes(o.hex) &&
        !isWaterHex(s, o.hex) &&
        !s.cities.some(c => c.hex === o.hex) &&
        (o.kind !== 'army' || o.cohorts.length < f.cohorts.length),
    );
    if (prey && f.moves > 0) {
      attack(s, f.id, prey.hex);
      if (!s.formations.includes(f)) continue;
    }
    const home = b.loot !== undefined || f.cohorts.length <= 1;
    if (home && b.orphan === undefined) {
      if (f.hex === b.camp) {
        // safely home: the band rests and rides again later
        b.loot = undefined;
        continue;
      }
      orderMove(s, f.id, b.camp);
      continue;
    }
    const target = targetOf(s, f, b.camp);
    if (target === undefined) continue;
    if (adj.includes(target)) {
      pillage(s, f, target, out);
      continue;
    }
    // close in on the town: the hex next to it nearest the band
    const ring = neighbors(g, target)
      .filter(
        h => !isWaterHex(s, h) && isPassableLand(s.map, h) && !s.formations.some(o => o.hex === h),
      )
      .sort((x, y) => distance(g, f.hex, x) - distance(g, f.hex, y));
    if (ring[0] !== undefined) {
      if (
        me &&
        s.cities.some(c => c.hex === target && c.civId === me.id) &&
        distance(g, f.hex, target) <= 5 &&
        !f.path.length
      )
        out.push(
          `A raider band of ${f.cohorts.length} cohorts rides toward ${s.cities.find(c => c.hex === target)!.name}.`,
        );
      orderMove(s, f.id, ring[0]);
      // arrived next to it this turn: pillage at once
      if (neighbors(g, f.hex).includes(target)) pillage(s, f, target, out);
    }
  }
  return out;
}

/** Great AI peoples deal with raiders near home: strike weak bands, burn close camps. */
export function aiHuntRaiders(s: GameState, civ: Civ) {
  const st = s.raiders;
  if (!st || civ.independent) return;
  const g = { w: s.map.w, h: s.map.h };
  const mine = s.cities.filter(c => c.civId === civ.id);
  const armies = s.formations.filter(f => f.civId === civ.id && f.kind === 'army' && f.moves > 0);
  for (const a of armies) {
    const band = s.formations.find(
      o =>
        o.civId === st.civ &&
        neighbors(g, a.hex).includes(o.hex) &&
        o.cohorts.length <= a.cohorts.length,
    );
    if (band) attack(s, a.id, band.hex);
  }
  for (const camp of st.camps) {
    if (!mine.some(c => distance(g, c.hex, camp.hex) <= 7)) continue;
    const hunter = armies
      .filter(a => s.formations.includes(a) && a.cohorts.length >= 3 && a.moves > 0)
      .sort((x, y) => distance(g, x.hex, camp.hex) - distance(g, y.hex, camp.hex))[0];
    if (!hunter || distance(g, hunter.hex, camp.hex) > 10) continue;
    const guard = s.formations.find(o => o.hex === camp.hex);
    if (!guard) orderMove(s, hunter.id, camp.hex);
    else if (guard.civId === st.civ) {
      // a band at home: strike it from next door, or close in
      if (neighbors(g, hunter.hex).includes(camp.hex)) attack(s, hunter.id, camp.hex);
      else {
        const next = neighbors(g, camp.hex)
          .filter(h => !s.formations.some(o => o.hex === h) && !isWaterHex(s, h))
          .sort((x, y) => distance(g, hunter.hex, x) - distance(g, hunter.hex, y))[0];
        if (next !== undefined) orderMove(s, hunter.id, next);
      }
    }
  }
}

/** Camps in sight of a people, for the map. */
export const campsSeenBy = (s: GameState, civId: number) =>
  (s.raiders?.camps ?? []).filter(c => s.civs[civId].explored[c.hex]);
