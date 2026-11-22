/**
 * A simple AI. It designs troops from what it has researched (a spear line with archers behind
 * it, cavalry once it has horses), equips its levies with what its cities can pay for, expands
 * with settlers, keeps a garrison in each city and goes to war when it feels much stronger.
 */
import {
  DEFAULT_LOADOUT,
  DEFAULT_SHIP,
  ITEM_LIST,
  ITEMS,
  type ItemInfo,
  type Loadout,
} from '../data/items.ts';
import { isWater } from '../data/terrain.ts';
import {
  assignDesign,
  atWar,
  attack,
  canFoundCity,
  declareWar,
  formationsAt,
  foundCity,
  gridOf,
  levy,
  merge,
  militaryPower,
  planPath,
  previewBattle,
  refitPreview,
  saveDesign,
  supplyingCity,
  trainSettlers,
  advance,
} from './game.ts';
import { distance, neighbors, within } from './hex.ts';
import { SLOT_TYPES } from '../data/slots.ts';
import { CULTURE_LIST, DOMAIN_LIST } from '../data/culture.ts';
import { canStartUpheaval, nodeCost, nodeStatus, startUpheaval, takeNode } from './culture.ts';
import {
  allied,
  capitalOf,
  evaluateOffer,
  executeOffer,
  hasPact,
  ledgerOf,
  newProposal,
  opinion,
} from './diplomacy.ts';
import { DEPOSITS, GOODS } from '../data/goods.ts';
import {
  buildShip,
  cargoOf,
  cityGuard,
  cityWalls,
  orderMove,
  passable,
  refit,
  roomOn,
  stepCost,
} from './game.ts';
import { findPath } from './path.ts';
import {
  cityDistricts,
  marketStock,
  constructionQueue,
  isCentre,
  slotProblem,
  workable,
} from './economy.ts';
import { districtRoom, placeDistrict, setSlot, upgradeInfo, upgradeSettlement } from './game.ts';
import type { City, District } from './types.ts';
import { hexFood, isPassableLand } from './mapgen.ts';
import { hashSeed, mulberry32, type Rng } from './rng.ts';
import type { Civ, Formation, GameState } from './types.ts';
import {
  capOf,
  COHORT_SIZE,
  isRanged,
  loadoutProblem,
  oceanGoing,
  people,
  power,
} from './units.ts';

interface Plan {
  name: string;
  role: 'front' | 'ranged';
  rank: number;
  loadout: (t: string[]) => Loadout;
}

const has = (t: string[], id: string) => t.includes(id);
const PLANS: Plan[] = [
  {
    name: 'Spear levy',
    role: 'front',
    rank: 0,
    loadout: () => ({ ...DEFAULT_LOADOUT, weapon: 'spear', shield: 'wicker-shield' }),
  },
  {
    name: 'Javelineers',
    role: 'ranged',
    rank: 0,
    loadout: () => ({ ...DEFAULT_LOADOUT, weapon: 'javelins', shield: 'wicker-shield' }),
  },
  {
    name: 'Spearmen',
    role: 'front',
    rank: 1,
    loadout: t => ({
      ...DEFAULT_LOADOUT,
      weapon: 'spear',
      shield: 'hide-shield',
      armour: has(t, 'tanning') ? 'leather' : 'padded',
      helmet: has(t, 'tanning') ? 'leather-cap' : 'no-helmet',
    }),
  },
  {
    name: 'Slingers',
    role: 'ranged',
    rank: 1,
    loadout: () => ({ ...DEFAULT_LOADOUT, weapon: 'sling', armour: 'padded' }),
  },
  {
    name: 'Archers',
    role: 'ranged',
    rank: 2,
    loadout: t => ({
      ...DEFAULT_LOADOUT,
      weapon: 'bow',
      armour: 'padded',
      helmet: has(t, 'tanning') ? 'leather-cap' : 'no-helmet',
    }),
  },
  {
    name: 'Swordsmen',
    role: 'front',
    rank: 3,
    loadout: () => ({
      ...DEFAULT_LOADOUT,
      weapon: 'bronze-sword',
      shield: 'bronze-shield',
      helmet: 'bronze-helmet',
      armour: 'bronze-scale',
    }),
  },
  {
    name: 'Riders',
    role: 'front',
    rank: 2,
    loadout: t => ({
      ...DEFAULT_LOADOUT,
      weapon: has(t, 'bronze-working') ? 'bronze-sword' : 'spear',
      shield: 'hide-shield',
      mount: 'horse',
    }),
  },
  // later eras: each only appears once its gear is researched
  {
    name: 'Composite archers',
    role: 'ranged',
    rank: 3,
    loadout: t => ({
      ...DEFAULT_LOADOUT,
      weapon: 'composite-bow',
      armour: has(t, 'tanning') ? 'leather' : 'padded',
      helmet: has(t, 'iron-working') ? 'iron-helmet' : 'no-helmet',
    }),
  },
  {
    name: 'Men-at-arms',
    role: 'front',
    rank: 4,
    loadout: () => ({
      ...DEFAULT_LOADOUT,
      weapon: 'iron-sword',
      shield: 'kite-shield',
      helmet: 'iron-helmet',
      armour: 'chain-mail',
      boots: 'marching-boots',
    }),
  },
  {
    name: 'Longbowmen',
    role: 'ranged',
    rank: 4,
    loadout: () => ({
      ...DEFAULT_LOADOUT,
      weapon: 'longbow',
      armour: 'leather',
      helmet: 'iron-helmet',
    }),
  },
  {
    name: 'Crossbowmen',
    role: 'ranged',
    rank: 5,
    loadout: () => ({
      ...DEFAULT_LOADOUT,
      weapon: 'crossbow',
      shield: 'pavise',
      helmet: 'iron-helmet',
      armour: 'chain-mail',
    }),
  },
  {
    name: 'Pikemen',
    role: 'front',
    rank: 5,
    loadout: () => ({
      ...DEFAULT_LOADOUT,
      weapon: 'pike',
      helmet: 'iron-helmet',
      armour: 'chain-mail',
      boots: 'marching-boots',
    }),
  },
  {
    name: 'Knights',
    role: 'front',
    rank: 6,
    loadout: () => ({
      ...DEFAULT_LOADOUT,
      weapon: 'lance',
      shield: 'kite-shield',
      helmet: 'great-helm',
      armour: 'plate-armour',
      mount: 'barded-horse',
    }),
  },
  {
    name: 'Arquebusiers',
    role: 'ranged',
    rank: 6,
    loadout: () => ({
      ...DEFAULT_LOADOUT,
      weapon: 'arquebus',
      helmet: 'iron-helmet',
      armour: 'leather',
    }),
  },
  {
    name: 'Musketeers',
    role: 'ranged',
    rank: 7,
    loadout: () => ({
      ...DEFAULT_LOADOUT,
      weapon: 'musket',
      kit: 'bayonet',
      armour: 'cuirass',
      boots: 'hobnailed-boots',
    }),
  },
];

/** Move one outdated or outclassed group per turn to the best design the market can pay for. */
function upgrade(s: GameState, civ: Civ, f: Formation) {
  if (f.kind !== 'army' || f.name === 'Scouts' || !supplyingCity(s, civ.id, f.hex)) return;
  const rankOf = (id: number | null) => {
    const d = civ.designs.find(x => x.id === id);
    return PLANS.find(p => p.name === d?.name);
  };
  for (const c of f.cohorts) {
    if (c.designId === null) continue;
    const plan = rankOf(c.designId);
    if (!plan) continue;
    const better = PLANS.filter(p => p.role === plan.role && p.rank > plan.rank)
      .map(p => ({ p, d: civ.designs.find(d => d.name === p.name) }))
      .filter(x => x.d)
      .sort((a, b) => b.p.rank - a.p.rank);
    const same = f.cohorts.filter(x => x.designId === c.designId).map(x => x.id);
    const current = civ.designs.find(d => d.id === c.designId)!;
    const outdated = JSON.stringify(current.loadout) !== JSON.stringify(c.loadout);
    for (const { d } of [...better, ...(outdated ? [{ d: current }] : [])]) {
      const pv = refitPreview(s, f.id, same, d!.loadout);
      if (pv.problem === null && !pv.missing.length) {
        assignDesign(s, f.id, same, d!.id);
        return;
      }
    }
  }
}

/** Spend culture on the choice that best fits the people's leanings. */
function chooseCulture(s: GameState, civ: Civ, rng: Rng) {
  const avail = CULTURE_LIST.filter(n => nodeStatus(civ, n).kind === 'available');
  if (!avail.length) return;
  // score each choice once (no random draws inside a sort), then take the best
  const scored = avail.map(n => ({
    n,
    v:
      n.tags.filter(t => civ.leanings.includes(t)).length * 3 +
      (5 - n.tier) * 0.5 +
      rng() * 2 -
      nodeCost(s, civ, n) / 60,
  }));
  const best = scored.reduce((a, b) => (b.v > a.v ? b : a)).n;
  if (civ.culture.points >= nodeCost(s, civ, best)) takeNode(s, civ.id, best.id);
  // the AI calls its own upheaval when a domain is close to boiling
  const hot = DOMAIN_LIST.find(d => civ.culture.tension[d] >= 125);
  if (hot && !canStartUpheaval(civ, hot)) startUpheaval(s, civ.id, hot);
}

function ensureDesigns(s: GameState, civ: Civ) {
  for (const p of PLANS) {
    const l = p.loadout(civ.techs);
    if (loadoutProblem(l, civ.techs)) continue;
    const ex = civ.designs.find(d => d.name === p.name);
    if (!ex) saveDesign(s, civ.id, p.name, l);
    else if (JSON.stringify(ex.loadout) !== JSON.stringify(l))
      saveDesign(s, civ.id, p.name, l, ex.id);
  }
}

/** Equip plain levy cohorts: about 60% front line, 40% ranged, best design the city can pay for. */
function equip(s: GameState, civ: Civ, f: Formation) {
  if (f.kind !== 'army' || f.name === 'Scouts' || f.moves <= 0) return;
  if (!supplyingCity(s, civ.id, f.hex)) return;
  const raw = f.cohorts.filter(c => c.designId === null);
  if (!raw.length) return;
  const ranged = f.cohorts.filter(c => c.designId !== null && isRanged(c.loadout)).length;
  const wantRanged = Math.round(f.cohorts.length * 0.4) - ranged;
  const options = (role: Plan['role']) =>
    PLANS.filter(p => p.role === role)
      .map(p => ({ p, d: civ.designs.find(d => d.name === p.name) }))
      .filter(x => x.d)
      .sort((a, b) => b.p.rank - a.p.rank);
  const tryAssign = (ids: number[], role: Plan['role']) => {
    for (const { d } of options(role)) {
      const pv = refitPreview(s, f.id, ids, d!.loadout);
      if (pv.problem === null && !pv.missing.length) return assignDesign(s, f.id, ids, d!.id).ok;
    }
    return false;
  };
  const rIds = raw.slice(0, Math.max(0, wantRanged)).map(c => c.id);
  const fIds = raw.slice(Math.max(0, wantRanged)).map(c => c.id);
  if (rIds.length) tryAssign(rIds, 'ranged');
  if (fIds.length) tryAssign(fIds, 'front');
}

function bestSite(s: GameState, f: Formation, rng: Rng): number {
  const g = gridOf(s);
  let best = -1,
    bv = -Infinity;
  for (const k of within(g, f.hex, 9)) {
    if (!isPassableLand(s.map, k) || formationsAt(s, k).some(x => x.civId !== f.civId)) continue;
    if (canFoundCity(s, { ...f, hex: k })) continue;
    let v = 0;
    for (const n of within(g, k, 1)) {
      // a hex next to an older settlement is theirs
      if (n !== k && s.cities.some(c => distance(g, c.hex, n) <= 1)) continue;
      v += hexFood(s.map, n) + (s.map.deposit[n] ? 1.5 : 0);
    }
    // towns cluster: close to home is easy to join by road and to defend
    const home = s.cities.filter(c => c.civId === f.civId);
    const nearest = home.length ? Math.min(...home.map(c => distance(g, c.hex, k))) : 3;
    if (nearest > 4) v -= (nearest - 4) * 1.5;
    v -= distance(g, f.hex, k) * 0.6 + rng() * 0.5;
    if (v > bv) {
      bv = v;
      best = k;
    }
  }
  return best;
}

/** Path to the best free hex next to `target`. */
function pathNextTo(s: GameState, f: Formation, target: number): number[] | null {
  let best: number[] | null = null;
  for (const n of neighbors(gridOf(s), target)) {
    if (n === f.hex) return [];
    const p = planPath(s, f, n);
    if (p && (!best || p.length < best.length)) best = p;
  }
  return best;
}

const CENTRE = [
  'houses',
  'market',
  'houses',
  'workshop',
  null,
  'school',
  'houses',
  'granary',
  'barracks',
];
// a city's quarters: each cell names what it wants; anything not yet researched waits
const QUARTERS: Record<string, (string | null)[]> = {
  research: [
    'school',
    'library',
    'houses',
    'library',
    'university',
    'school',
    'houses',
    'printing-house',
    'observatory',
  ],
  industry: [
    'workshop',
    'smithy',
    'houses',
    'armoury',
    'foundry',
    'tannery',
    'houses',
    'guild-hall',
    'weaver',
  ],
  market: [
    'market',
    'bank',
    'houses',
    'market',
    'mint',
    'bank',
    'tenements',
    'stock-exchange',
    'aqueduct',
  ],
  civic: [
    'shrine',
    'temple',
    'houses',
    'monument',
    'amphitheatre',
    'houses',
    'cathedral',
    'houses',
    'tenements',
  ],
};
const QUARTER_ORDER = ['research', 'industry', 'market', 'civic', 'research'];

/**
 * A town's working district: a block of four for the most valuable special good on its land
 * (special goods need three of the building in one district), animals or crops beside it,
 * woodcutters, and houses to fill.
 */
function planFor(s: GameState, civ: Civ, hex: number): { slots: (string | null)[]; score: number } {
  const slots: (string | null)[] = new Array(9).fill(null);
  const order = [0, 1, 2, 3, 5, 6, 7, 8];
  let k = 0,
    score = 0;
  const ok = (t: string) => !slotProblem(s, civ.id, hex, false, t);
  const put = (t: string, n: number) => {
    for (let j = 0; j < n && k < order.length; j++) slots[order[k++]] = t;
  };
  const worth = (g: Record<string, number> | undefined) =>
    Object.keys(g ?? {}).reduce((a, x) => a + (GOODS[x]?.kind === 'luxury' ? 3 : 2), 0);
  const specials = ['mine', 'plantation', 'fishing-dock', 'hunting-lodge']
    .filter(ok)
    .map(t => {
      const open = workable(s, civ.id, hex, t, 9).open.filter(d => DEPOSITS[d].special);
      return { t, v: open.reduce((a, d) => a + worth(DEPOSITS[d].gives.goods), 0) };
    })
    .filter(x => x.v > 0)
    .sort((a, b) => b.v - a.v);
  if (specials[0]) {
    put(specials[0].t, 4);
    score += specials[0].v * 2;
  }
  if (workable(s, civ.id, hex, 'pasture', 1).open.length) put('pasture', 2);
  if (workable(s, civ.id, hex, 'farm', 1).open.length) put('farm', 2);
  if (ok('fishing-dock') && workable(s, civ.id, hex, 'fishing-dock', 1).open.length)
    put('fishing-dock', 1);
  put('woodlot', 1);
  // stone for building comes from plain mines when the land holds no richer seam
  if (specials[0]?.t !== 'mine') put('mine', 2);
  slots[4] = specials[0]?.t === 'mine' && ok('infirmary') ? 'infirmary' : 'houses';
  while (k < order.length) put(k % 2 ? 'farm' : 'pasture', 1);
  return { slots, score };
}

/** Fill a district's empty cells from a layout; cells it cannot take yet get houses or wait. */
function fillDistrict(s: GameState, civ: Civ, c: City, d: District, plan: (string | null)[]) {
  const centre = isCentre(d);
  for (let i = 0; i < 9; i++) {
    if (d.slots[i].type) continue;
    const want = plan[i];
    // a building that works up goods waits until the market has some of them
    const stock = marketStock(s, c);
    if (
      want &&
      Object.keys(SLOT_TYPES[want]?.inputs ?? {}).some(g => g !== 'wood' && (stock[g] ?? 0) < 10)
    )
      continue;
    if (want && !slotProblem(s, civ.id, c.hex, centre, want, d.id)) setSlot(s, d.id, i, want);
    else if (
      want === 'houses' ||
      (!want && i !== 4) ||
      (want && SLOT_TYPES[want] && !SLOT_TYPES[want].tech)
    ) {
      if (!slotProblem(s, civ.id, c.hex, centre, 'houses', d.id)) setSlot(s, d.id, i, 'houses');
    }
  }
}

function planDistricts(s: GameState, civ: Civ, c: City) {
  // replanning is costly: each settlement looks again every few turns, staggered
  const ds = cityDistricts(s, c);
  if ((s.turn + c.id) % 3 !== 0 && ds.length > 1) return;
  const centre = ds.find(isCentre);
  if (c.tier === 'town') {
    // a town's second district works the land
    if (ds.length < 2) {
      const p = planFor(s, civ, c.hex);
      const main = p.slots.find(t => t && t !== 'houses' && t !== 'infirmary');
      placeDistrict(
        s,
        c.id,
        `${c.name} ${main ? SLOT_TYPES[main].name.toLowerCase() + 's' : 'fields'}`,
        p.slots,
      );
      return;
    }
    // cells waiting on research get filled once it arrives
    if (centre) fillDistrict(s, civ, c, centre, CENTRE);
    // cells left empty (a blueprint gap, research since) get another look
    const fields = ds.find(d => !isCentre(d));
    if (fields && fields.slots.some(x => !x.type)) {
      const p = planFor(s, civ, c.hex);
      fillDistrict(s, civ, c, fields, p.slots);
    }
    return;
  }
  // a city: its quarters, in order, then fill what research has opened
  if (constructionQueue(s, c).length > 4) return;
  if (centre)
    fillDistrict(
      s,
      civ,
      c,
      centre,
      CENTRE.map(t => (t === 'granary' ? 'library' : t)),
    );
  const others = ds.filter(d => !isCentre(d));
  others.forEach((d, k) => fillDistrict(s, civ, c, d, QUARTERS[QUARTER_ORDER[k] ?? 'research']));
  if (districtRoom(s, c) > 0) {
    const kind = QUARTER_ORDER[others.length] ?? 'research';
    const r = placeDistrict(s, c.id, `${c.name} ${kind} quarter`, []);
    const d = s.districts.find(x => x.id === r.id);
    if (d) fillDistrict(s, civ, c, d, QUARTERS[kind]);
  }
}

/** Raise the best town to a city once it has towns around it to feed it; then a metropolis. */
function planUpgrades(s: GameState, civ: Civ, cities: City[]) {
  const towns = cities.filter(c => c.tier === 'town');
  const big = cities.filter(c => c.tier !== 'town');
  // about one city for every three towns: cities live on what towns send them
  const wantCity = towns.length >= 3 * (big.length + 1) - 1;
  const cands = [...cities].sort((a, b) => b.pop - a.pop);
  for (const c of cands) {
    if (c.tier === 'town' && !wantCity) continue;
    if (c.tier === 'metropolis') continue;
    if (c.tier === 'city' && big.length < 3) continue;
    const u = upgradeInfo(s, c);
    if (u.problem) continue;
    // keep a reserve of gold for war and refits
    if (civ.gold - u.gold < 40) continue;
    if (upgradeSettlement(s, c.id).ok) {
      trace(s, civ, `${c.name} becomes a ${c.tier}`);
      return;
    }
  }
}

export function aiTurn(s: GameState, civ: Civ) {
  const g = gridOf(s);
  const rng = mulberry32(hashSeed(s.settings.map.seed, s.turn * 131 + civ.id));
  ensureDesigns(s, civ);
  chooseCulture(s, civ, rng);
  const cities = s.cities.filter(c => c.civId === civ.id);
  const mine = () => s.formations.filter(f => f.civId === civ.id);

  // --- cities: settlers first while small, then levies
  const settlersOut = mine().some(f => f.kind === 'settlers');
  for (const c of cities) planDistricts(s, civ, c);
  if ((s.turn + civ.id) % 4 === 0) planUpgrades(s, civ, cities);
  // one town at a time is left to grow into a city: no settlers or levies from it
  const towns = cities.filter(c => c.tier === 'town');
  const ranked = cities.filter(c => c.tier !== 'town');
  const rising =
    towns.length >= 3 * (ranked.length + 1) - 1
      ? towns.slice().sort((a, b) => b.pop - a.pop)[0]
      : undefined;
  for (const c of cities) {
    const armies = mine().filter(f => f.kind === 'army' && f.name !== 'Scouts').length;
    if (c === rising && armies >= 1) continue;
    // towns send out settlers; a city keeps its people and only gives levies when large
    const town = c.tier === 'town';
    if (
      town &&
      !settlersOut &&
      s.turn > 6 &&
      c.pop >= 3000 &&
      (cities.length < 6 || (cities.length < 14 && rng() < 0.2))
    )
      trainSettlers(s, c.id);
    else if (c.pop >= (town ? 3000 : 8000) && armies < cities.length * 2 + 1) levy(s, c.id);
  }

  // --- diplomacy and war
  aiDiplomacy(s, civ, rng);
  const enemies = s.civs.filter(o => o.alive && o.id !== civ.id && atWar(s, civ.id, o.id));
  // at war with a seafaring people: keep a couple of warships
  if (enemies.some(e => s.formations.some(f => f.civId === e.id && f.kind === 'fleet'))) {
    const war = civ.designs.find(d => d.name === 'Warships');
    const have = mine()
      .filter(f => f.kind === 'fleet')
      .reduce((n, f) => n + f.cohorts.filter(c => c.designId === war?.id).length, 0);
    const port = cities.find(
      c =>
        cityDistricts(s, c).some(d => d.slots.some(x => x.built && x.type === 'shipyard')) &&
        c.pop > 3000,
    );
    if (war && port && have < 2 && rng() < 0.3) buildShip(s, port.id, war.id);
  }
  // coastal cities get a shipyard once Sailing is known
  if (civ.techs.includes('sailing'))
    for (const c of cities) {
      const centre = cityDistricts(s, c).find(isCentre);
      if (!centre || cityDistricts(s, c).some(d => d.slots.some(x => x.type === 'shipyard')))
        continue;
      if (slotProblem(s, civ.id, c.hex, true, 'shipyard', centre.id)) continue;
      // a lake-only harbour leads nowhere
      if (!neighbors(g, c.hex).some(k => s.map.terrain[k] === 'coast')) continue;
      const i = centre.slots.findIndex(x => !x.type || (x.type === 'barracks' && !x.built));
      if (i >= 0) setSlot(s, centre.id, i, 'shipyard');
    }

  // --- formations
  // troops that walked onto a ship on their way somewhere step back ashore
  for (const f of mine())
    if (f.aboard !== undefined && f.kind !== 'fleet' && civ.sea?.cargo !== f.id) {
      const shore = neighbors(g, f.hex).find(
        h =>
          isPassableLand(s.map, h) &&
          !s.cities.some(c => c.hex === h && c.civId !== civ.id) &&
          !s.formations.some(o => o.hex === h && o.civId !== civ.id),
      );
      if (shore !== undefined && f.moves > 0) orderMove(s, f.id, shore);
    }
  runSeaTask(s, civ, rng);
  for (const f of mine()) {
    if (!s.formations.includes(f)) continue;
    if (f.aboard !== undefined || civ.sea?.cargo === f.id || civ.sea?.fleet === f.id) continue;
    if (f.kind === 'fleet') {
      fleetOrders(s, civ, f, enemies);
      continue;
    }
    equip(s, civ, f);
    if (f.moves > 0 && (s.turn + f.id) % 3 === 0) upgrade(s, civ, f);
    if (f.kind === 'army' && f.name !== 'Scouts') continue; // see armyOrders
    if (f.kind === 'settlers') {
      // settle on arrival; pick a site if there is no route yet
      if (!f.path.length) {
        if (canFoundCity(s, f) === null && (cities.length === 0 || bestSite(s, f, rng) === f.hex)) {
          foundCity(s, f.id);
          continue;
        }
        const site = bestSite(s, f, rng);
        if (site >= 0) f.path = planPath(s, f, site) ?? [];
        if (!f.path.length && canFoundCity(s, f) === null) {
          foundCity(s, f.id);
          continue;
        }
        // nowhere left on this land: cross the water
        if (!f.path.length && !civ.sea) startSeaTask(s, civ, f, null);
      }
      advance(s, f);
      if (s.formations.includes(f) && !f.path.length && canFoundCity(s, f) === null)
        foundCity(s, f.id);
      continue;
    }
    if (f.name === 'Scouts') {
      if (!f.path.length) {
        let best = -1,
          bd = Infinity;
        for (const k of within(g, f.hex, 8)) {
          if (civ.explored[k] || !isPassableLand(s.map, k)) continue;
          const d = distance(g, f.hex, k) + rng() * 2;
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
        if (best >= 0) f.path = planPath(s, f, best) ?? [];
      }
      advance(s, f);
      continue;
    }
  }
  armyOrders(s, civ, enemies, rng);
}

/** Attack if the expected exchange favours us (`ratio` < 1 accepts worse trades, for sieges). */
function strikeIfGood(s: GameState, f: Formation, hex: number, ratio = 0.9): boolean {
  if (f.moves <= 0) return false;
  const pv = previewBattle(s, f.id, hex);
  const good =
    !pv ||
    pv.outcome === 'defender-broke' ||
    pv.defender.lost / Math.max(1, pv.defender.start) >=
      (pv.attacker.lost / Math.max(1, pv.attacker.start)) * ratio;
  if (!good) return false;
  attack(s, f.id, hex);
  return true;
}

/** Estimated strength holding a city: its army plus its guard behind walls. */
function cityDefence(s: GameState, cityHex: number): number {
  const c = s.cities.find(x => x.hex === cityHex)!;
  const g = gridOf(s);
  let p = 0;
  for (const o of s.formations)
    if (o.civId === c.civId && o.kind === 'army' && distance(g, o.hex, c.hex) <= 1) p += power(o);
  const guard = {
    ...s.formations[0],
    kind: 'army' as const,
    cohorts: cityGuard(s, c),
    civId: c.civId,
  };
  p += power(guard) * (1 + cityWalls(s, c).walls);
  return p * 1.6; // walls and the city bonus
}

// ---------------------------------------------------------------- armies

/** Debug trace of AI decisions (not saved). Read it with aiTrace() in diagnostic scripts. */
const TRACE: { turn: number; civ: number; msg: string }[] = [];
export function trace(s: GameState, civ: Civ, msg: string) {
  TRACE.push({ turn: s.turn, civ: civ.id, msg });
  if (TRACE.length > 2000) TRACE.splice(0, 500);
}
export const aiTrace = () => TRACE;

const MIN_PHASE = 3;

/** A free land hex next to `cityHex`, toward `toward`, where armies can gather. */
function stagingHex(s: GameState, civ: Civ, cityHex: number, toward: number): number {
  const g = gridOf(s);
  const opts = neighbors(g, cityHex).filter(
    h =>
      isPassableLand(s.map, h) &&
      !s.cities.some(c => c.hex === h) &&
      !s.formations.some(o => o.hex === h && o.civId !== civ.id),
  );
  opts.sort((a, b) => distance(g, a, toward) - distance(g, b, toward));
  return opts[0] ?? cityHex;
}

/**
 * Pick the campaign target: the softest enemy city the field armies can reach over land,
 * from home or from where a member already stands (after a landing).
 */
function chooseTarget(s: GameState, civ: Civ, enemies: Civ[], members: Formation[]) {
  const g = gridOf(s);
  const cities = s.cities.filter(c => c.civId === civ.id);
  const probe = members[0];
  let best: { city: (typeof s.cities)[number]; staging: number; v: number } | undefined;
  for (const c of s.cities) {
    if (!enemies.some(e => e.id === c.civId)) continue;
    const home = cities
      .slice()
      .sort((a, b) => distance(g, a.hex, c.hex) - distance(g, b.hex, c.hex))[0];
    const fromField = members
      .slice()
      .sort((a, b) => distance(g, a.hex, c.hex) - distance(g, b.hex, c.hex))[0];
    const start =
      home && distance(g, home.hex, c.hex) <= distance(g, fromField.hex, c.hex) + 3
        ? home.hex
        : fromField.hex;
    const d = distance(g, start, c.hex);
    if (d > 20) continue;
    if (!pathNextTo(s, { ...probe, hex: start }, c.hex)) continue;
    const v = d * 3 + cityDefence(s, c.hex) / 4;
    if (!best || v < best.v)
      best = {
        city: c,
        staging:
          start === fromField.hex && start !== home?.hex ? start : stagingHex(s, civ, start, c.hex),
        v,
      };
  }
  return best;
}

/**
 * Every army each turn. Roles: one garrison per city; wounded armies heal at home until 80%;
 * enough field armies to cover a threat answer it; the rest are the campaign, which gathers next
 * to a staging city, marches together, waits until assembled, then assaults the strongest first.
 * Phases last at least MIN_PHASE turns and switch on separate thresholds, so the AI does not
 * flip-flop.
 */
function armyOrders(s: GameState, civ: Civ, enemies: Civ[], rng: Rng) {
  const g = gridOf(s);
  const cities = s.cities.filter(c => c.civId === civ.id);
  const armies = s.formations.filter(
    f =>
      f.civId === civ.id &&
      f.kind === 'army' &&
      f.name !== 'Scouts' &&
      f.aboard === undefined &&
      civ.sea?.cargo !== f.id,
  );
  const health = (f: Formation) => people(f) / Math.max(1, f.cohorts.length * COHORT_SIZE);
  // garrisons: the biggest army standing in each city
  const garrison = new Set<number>();
  for (const c of cities) {
    const here = armies
      .filter(f => f.hex === c.hex)
      .sort((a, b) => b.cohorts.length - a.cohorts.length)[0];
    if (here) {
      garrison.add(here.id);
      here.fortified = true;
    }
  }
  const free = () => armies.filter(f => s.formations.includes(f) && !garrison.has(f.id));
  if (!enemies.length) {
    civ.ai = undefined;
    // peace: fill empty cities, fold extra armies into garrisons, else wait
    for (const c of cities) {
      if (armies.some(f => garrison.has(f.id) && f.hex === c.hex)) continue;
      const f = free()
        .filter(x => !x.path.length)
        .sort((a, b) => distance(g, a.hex, c.hex) - distance(g, b.hex, c.hex))[0];
      if (f) {
        f.path = planPath(s, f, c.hex) ?? [];
        garrison.add(f.id);
      }
    }
    for (const f of armies) if (s.formations.includes(f) && f.path.length) advance(s, f);
    for (const f of free()) if (!f.path.length) f.fortified = true;
    return;
  }

  // wounded go home and come back at 80%
  const rec = new Set(civ.recovering ?? []);
  for (const f of armies) {
    if (!s.formations.includes(f) || garrison.has(f.id)) continue;
    if (health(f) < 0.55) rec.add(f.id);
    else if (health(f) >= 0.8) rec.delete(f.id);
  }
  civ.recovering = [...rec].filter(id => armies.some(f => f.id === id));
  for (const f of free().filter(x => rec.has(x.id))) {
    const c = cities
      .slice()
      .sort((a, b) => distance(g, a.hex, f.hex) - distance(g, b.hex, f.hex))[0];
    if (c && distance(g, f.hex, c.hex) > 1) {
      f.path = pathNextTo(s, f, c.hex) ?? [];
      advance(s, f);
    } else f.fortified = true;
  }
  let field = free().filter(f => !rec.has(f.id));

  // threats: answer each with enough strength, not with everything
  const threats = s.formations.filter(
    o =>
      o.kind === 'army' &&
      enemies.some(e => e.id === o.civId) &&
      cities.some(c => distance(g, c.hex, o.hex) <= 3),
  );
  const busy = new Set<number>();
  for (const t of threats) {
    const need = power(t) * 1.2;
    let sent = 0;
    for (const f of field
      .filter(x => !busy.has(x.id) && distance(g, x.hex, t.hex) <= 7)
      .sort((a, b) => distance(g, a.hex, t.hex) - distance(g, b.hex, t.hex))) {
      if (sent >= need) break;
      busy.add(f.id);
      sent += power(f);
      if (distance(g, f.hex, t.hex) === 1) strikeIfGood(s, f, t.hex);
      else {
        f.path = pathNextTo(s, f, t.hex) ?? [];
        advance(s, f);
        if (s.formations.includes(f) && f.moves > 0 && distance(g, f.hex, t.hex) === 1)
          strikeIfGood(s, f, t.hex);
      }
    }
  }
  field = field.filter(f => !busy.has(f.id) && s.formations.includes(f));

  // opportunities next to us
  for (const f of field) {
    const adj = neighbors(g, f.hex).find(h =>
      s.formations.some(
        o => o.hex === h && o.kind !== 'fleet' && enemies.some(e => e.id === o.civId),
      ),
    );
    if (adj !== undefined && strikeIfGood(s, f, adj)) busy.add(f.id);
  }
  field = field.filter(f => !busy.has(f.id) && s.formations.includes(f));
  if (!field.length) return;

  // the campaign
  let camp = civ.ai;
  const target =
    camp && s.cities.find(c => c.id === camp!.targetCity && enemies.some(e => e.id === c.civId));
  if (!camp || !target) {
    const pick = chooseTarget(s, civ, enemies, field);
    if (!pick) {
      civ.ai = undefined;
      // nothing reachable by land: carry the biggest army over the sea
      if (!civ.sea) {
        const army = field.slice().sort((a, b) => b.cohorts.length - a.cohorts.length)[0];
        const coastal = s.cities.filter(
          c =>
            enemies.some(e => e.id === c.civId) &&
            neighbors(g, c.hex).some(k => s.map.terrain[k] === 'coast'),
        );
        // weakest reachable shore first; a siege wears the guard down, so half its defence will do
        coastal.sort((a, b) => cityDefence(s, a.hex) - cityDefence(s, b.hex));
        if (
          army.cohorts.length >= 4 &&
          coastal.length &&
          power(army) >= cityDefence(s, coastal[0].hex) * 0.5
        )
          startSeaTask(s, civ, army, coastal[0].hex);
      }
      for (const f of field) f.fortified = true;
      return;
    }
    camp = civ.ai = {
      targetCity: pick.city.id,
      staging: pick.staging,
      phase: 'gather',
      since: s.turn,
      members: [],
    };
    trace(s, civ, `campaign against ${pick.city.name}, gathering at ${pick.staging}`);
  }
  const c = camp!;
  const tgt = s.cities.find(x => x.id === c.targetCity)!;
  c.members = field.map(f => f.id);
  const members = field;
  const need = cityDefence(s, tgt.hex) * 1.3;
  const total = members.reduce((a, f) => a + power(f), 0);
  const age = s.turn - c.since;
  const setPhase = (p: typeof c.phase, why: string) => {
    c.phase = p;
    c.since = s.turn;
    trace(s, civ, `${p} (${why}; strength ${Math.round(total)} vs ${Math.round(need)})`);
  };
  if (c.phase === 'gather') {
    const gathered = members
      .filter(f => distance(g, f.hex, c.staging) <= 1)
      .reduce((a, f) => a + power(f), 0);
    if (age >= MIN_PHASE && (gathered >= need || age > 14))
      setPhase('march', gathered >= need ? 'strong enough' : 'waited long enough');
  } else if (age >= MIN_PHASE && total < need * 0.5) setPhase('gather', 'bled white');
  else if (c.phase === 'march') {
    const arrived = members.filter(f => distance(g, f.hex, tgt.hex) <= 1).length;
    if (arrived === members.length || age > 6)
      setPhase('assault', arrived === members.length ? 'all arrived' : 'stragglers left behind');
  }

  if (c.phase === 'gather') {
    for (const f of members) {
      if (distance(g, f.hex, c.staging) > 0) {
        f.path = planPath(s, f, c.staging) ?? [];
        advance(s, f);
      }
      if (!s.formations.includes(f) || f.hex !== c.staging) continue;
      for (const o of formationsAt(s, f.hex))
        if (
          o !== f &&
          o.civId === civ.id &&
          o.kind === 'army' &&
          o.name !== 'Scouts' &&
          o.aboard === undefined &&
          o.cohorts.length + f.cohorts.length <= capOf(f, s) &&
          s.formations.includes(o)
        )
          merge(s, o.id, f.id);
    }
    return;
  }
  // march (and stragglers during the assault): close in next to the city, then wait
  for (const f of members) {
    if (!s.formations.includes(f) || distance(g, f.hex, tgt.hex) === 1) continue;
    f.path = pathNextTo(s, f, tgt.hex) ?? [];
    advance(s, f);
  }
  if (c.phase === 'assault') {
    const ready = members
      .filter(f => s.formations.includes(f) && distance(g, f.hex, tgt.hex) === 1)
      .sort((a, b) => power(b) - power(a));
    for (const f of ready) {
      if (!s.cities.some(x => x.id === tgt.id && x.civId !== civ.id)) break;
      if (!strikeIfGood(s, f, tgt.hex, 0.7)) f.fortified = true;
    }
  }
  void rng;
}

/** Can our armies get at one of their cities: by land, or by sea from one of our ports? */
function canReach(s: GameState, civ: Civ, o: Civ): boolean {
  const g = gridOf(s);
  const ours = s.cities.filter(c => c.civId === civ.id);
  const army = s.formations.find(f => f.civId === civ.id && f.kind === 'army');
  if (!army || !ours.length) return false;
  const theirs = s.cities
    .filter(c => c.civId === o.id)
    .sort(
      (a, b) =>
        Math.min(...ours.map(m => distance(g, m.hex, a.hex))) -
        Math.min(...ours.map(m => distance(g, m.hex, b.hex))),
    )
    .slice(0, 3);
  for (const c of theirs) {
    const home = ours
      .slice()
      .sort((a, b) => distance(g, a.hex, c.hex) - distance(g, b.hex, c.hex))[0];
    if (distance(g, home.hex, c.hex) <= 20 && pathNextTo(s, { ...army, hex: home.hex }, c.hex))
      return true;
  }
  const port =
    ours.some(c => neighbors(g, c.hex).some(k => s.map.terrain[k] === 'coast')) &&
    civ.techs.includes('sailing');
  return port && theirs.some(c => neighbors(g, c.hex).some(k => s.map.terrain[k] === 'coast'));
}

/** War, peace, pacts and alliances, and offers to the player. */
function aiDiplomacy(s: GameState, civ: Civ, rng: Rng) {
  const g = gridOf(s);
  const me = s.civs.find(c => c.isPlayer)!;
  const cities = s.cities.filter(c => c.civId === civ.id);
  const mineP = militaryPower(s, civ.id);
  const others = s.civs.filter(o => o.alive && o.id !== civ.id && civ.met.includes(o.id));
  const pending = s.proposals.some(p => p.from === civ.id);
  const enemies = others.filter(o => atWar(s, civ.id, o.id));

  // declare war on a weaker neighbour we dislike
  if (!enemies.length && s.turn > 30 && rng() < 0.06) {
    const targets = others.filter(o => {
      if (allied(s, civ.id, o.id)) return false;
      const near = s.cities.some(
        c => c.civId === o.id && cities.some(m => distance(g, c.hex, m.hex) <= 14),
      );
      if (!near) return false;
      const op = opinion(s, civ.id, o.id);
      const pact = hasPact(s, civ.id, o.id);
      if (pact && !(op < -60 && mineP > militaryPower(s, o.id) * 3)) return false;
      if (op > 10) return false;
      const need = op < -40 ? 1.1 : op < -15 ? 1.3 : 1.6;
      return mineP > militaryPower(s, o.id) * need + 5 && canReach(s, civ, o);
    });
    if (targets.length)
      declareWar(
        s,
        civ.id,
        targets.sort((a, b) => opinion(s, civ.id, a.id) - opinion(s, civ.id, b.id))[0].id,
      );
  }

  // seek peace when the war goes badly, or has gone quiet for a long time
  for (const o of enemies) {
    const w = s.wars.find(
      x => (x.a === civ.id && x.b === o.id) || (x.b === civ.id && x.a === o.id),
    )!;
    const length = s.turn - w.since;
    const myDead = w.dead?.[civ.id] ?? 0,
      theirDead = w.dead?.[o.id] ?? 0;
    const losing =
      myDead > theirDead * 1.4 + 300 ||
      (w.taken?.[o.id] ?? 0) > (w.taken?.[civ.id] ?? 0) ||
      mineP < militaryPower(s, o.id) * 0.6;
    const quiet = w.lastFight !== undefined ? s.turn - w.lastFight >= 15 : length >= 40;
    if (length < 10 || !(losing || (quiet && length >= 20))) continue;
    const offer = { give: {}, get: {}, peace: true };
    if (o.isPlayer) {
      if (!pending && length % 5 === 0)
        newProposal(s, {
          from: civ.id,
          to: o.id,
          kind: 'peace',
          offer,
          text: `The ${civ.name} have had enough of this war and offer peace.`,
        });
    } else if (evaluateOffer(s, civ.id, o.id, offer).accept) executeOffer(s, civ.id, o.id, offer);
  }

  // pacts and alliances among the AI
  for (const o of others) {
    if (o.isPlayer || atWar(s, civ.id, o.id)) continue;
    const a = opinion(s, civ.id, o.id),
      b = opinion(s, o.id, civ.id);
    if (!hasPact(s, civ.id, o.id) && a >= 25 && b >= 25 && rng() < 0.05)
      executeOffer(s, civ.id, o.id, { give: {}, get: {}, pact: true });
    else if (!allied(s, civ.id, o.id) && a >= 50 && b >= 50 && rng() < 0.03)
      executeOffer(s, civ.id, o.id, { give: {}, get: {}, alliance: true });
  }

  // offers and demands to the player
  if (pending || !others.includes(me) || atWar(s, civ.id, me.id) || rng() > 0.05) return;
  const op = opinion(s, civ.id, me.id);
  const cap = capitalOf(s, civ.id),
    theirCap = capitalOf(s, me.id);
  if (!cap || !theirCap) return;
  const mine = marketStock(s, cap),
    theirs = marketStock(s, theirCap);
  const near = s.cities.some(
    c => c.civId === me.id && cities.some(m => distance(g, c.hex, m.hex) <= 12),
  );
  if (mineP > militaryPower(s, me.id) * 2 && op < -15 && near && !hasPact(s, civ.id, me.id)) {
    const gold = Math.min(me.gold, 40 + s.turn / 4);
    if (gold >= 20) {
      newProposal(s, {
        from: civ.id,
        to: me.id,
        kind: 'demand',
        offer: { give: {}, get: { gold: Math.round(gold) } },
        text: `The ${civ.name} demand ${Math.round(gold)} gold as tribute. Refuse, and they may come for it.`,
      });
      return;
    }
  }
  if (op >= 55 && !allied(s, civ.id, me.id)) {
    newProposal(s, {
      from: civ.id,
      to: me.id,
      kind: 'alliance',
      offer: { give: {}, get: {}, alliance: true },
      text: `The ${civ.name} propose an alliance: an attack on one is an attack on both.`,
    });
    return;
  }
  if (op >= 25 && !hasPact(s, civ.id, me.id)) {
    newProposal(s, {
      from: civ.id,
      to: me.id,
      kind: 'pact',
      offer: { give: {}, get: {}, pact: true },
      text: `The ${civ.name} propose a non-aggression pact.`,
    });
    return;
  }
  // trade by the turn: sell what we have to spare to a player who runs short, or buy what
  // we run short of from a player with plenty
  void mine;
  void theirs;
  if (op <= -20) return;
  const ours = ledgerOf(s, civ.id),
    yours = ledgerOf(s, me.id);
  const price = (g: string) => (GOODS[g]?.kind === 'luxury' ? 3 : g === 'wood' ? 1 : 2);
  const sell = Object.keys(ours).find(
    g => ours[g].net >= 2 && ours[g].stock >= 20 && (yours[g]?.net ?? 0) < 0,
  );
  if (sell) {
    const n = Math.max(1, Math.min(Math.floor(ours[sell].net), Math.ceil(-yours[sell].net)));
    const gold = Math.max(1, Math.round(n * price(sell) * 0.8));
    newProposal(s, {
      from: civ.id,
      to: me.id,
      kind: 'trade',
      offer: { give: { goodsPerTurn: { [sell]: n } }, get: { goldPerTurn: gold }, turns: 20 },
      text: `The ${civ.name} see you run short of ${GOODS[sell]?.name.toLowerCase() ?? sell}: ${n} a turn for ${gold} gold a turn, for 20 turns.`,
    });
    return;
  }
  const buy = Object.keys(ours).find(
    g => ours[g].net < 0 && (yours[g]?.net ?? 0) >= 2 && (yours[g]?.stock ?? 0) >= 20,
  );
  if (buy && civ.gold > 60) {
    const n = Math.max(1, Math.min(Math.floor(yours[buy].net), Math.ceil(-ours[buy].net)));
    const gold = Math.max(1, Math.round(n * price(buy)));
    newProposal(s, {
      from: civ.id,
      to: me.id,
      kind: 'trade',
      offer: { give: { goldPerTurn: gold }, get: { goodsPerTurn: { [buy]: n } }, turns: 20 },
      text: `The ${civ.name} would buy ${n} ${GOODS[buy]?.name.toLowerCase() ?? buy} a turn for ${gold} gold a turn, for 20 turns.`,
    });
  }
}

// ---------------------------------------------------------------- at sea

/** The best part the people knows for a slot, by a score. */
function bestPart(
  civ: Civ,
  slot: 'weapon' | 'armour' | 'mount' | 'kit',
  score: (it: ItemInfo) => number,
): string {
  const opts = ITEM_LIST.filter(
    i => i.naval && i.slot === slot && (!i.tech || civ.techs.includes(i.tech)),
  );
  return opts.sort((a, b) => score(b) - score(a))[0].id;
}

function ensureShipDesigns(s: GameState, civ: Civ) {
  const prot = (i: ItemInfo) => Object.values(i.protection ?? {}).reduce((a, n) => a + (n ?? 0), 0);
  const hullT = bestPart(civ, 'armour', i => (i.capacity ?? 0) * 2 + (i.ocean ? 5 : 0));
  const hullW = bestPart(civ, 'armour', i => prot(i) + (i.ocean ? 3 : 0));
  const rig = bestPart(civ, 'mount', i => i.move ?? 0);
  const gun = bestPart(civ, 'weapon', i => (i.attack ?? 0) * (i.ranged ? 1.3 : 1));
  const want: [string, Loadout][] = [
    ['Transports', { ...DEFAULT_SHIP, armour: hullT, mount: rig, kit: 'troop-deck' }],
    ['Warships', { ...DEFAULT_SHIP, armour: hullW, mount: rig, weapon: gun, kit: 'marines' }],
  ];
  for (const [name, l] of want) {
    if (loadoutProblem(l, civ.techs)) continue;
    const ex = civ.designs.find(d => d.name === name);
    if (!ex) saveDesign(s, civ.id, name, l);
    else if (JSON.stringify(ex.loadout) !== JSON.stringify(l))
      saveDesign(s, civ.id, name, l, ex.id);
  }
}

/** An own port (city with a shipyard) that `f` can walk to, nearest first. */
/** Own ports (cities with a shipyard on the coast) that `f` can walk to, nearest first. */
function portsFor(s: GameState, civ: Civ, f: Formation) {
  const g = gridOf(s);
  return s.cities
    .filter(
      c =>
        c.civId === civ.id &&
        neighbors(g, c.hex).some(k => s.map.terrain[k] === 'coast') &&
        cityDistricts(s, c).some(d => d.slots.some(x => x.built && x.type === 'shipyard')),
    )
    .sort((a, b) => distance(g, a.hex, f.hex) - distance(g, b.hex, f.hex))
    .filter(c => c.hex === f.hex || planPath(s, f, c.hex))
    .slice(0, 3);
}

/** Where to land: a free land hex next to water. For settlers, a good city site; for armies, next to the target. */
/** A sea route planned on the true map: the AI's admirals know which waters are open ocean. */
function seaPath(s: GameState, f: Formation, target: number): number[] | null {
  const pass = passable(s, f);
  return findPath(gridOf(s), f.hex, target, (from, to) =>
    pass(to) ? stepCost(s, f, from, to) : Infinity,
  );
}

function pickLanding(
  s: GameState,
  civ: Civ,
  cargo: Formation,
  fleet: Formation | undefined,
  targetHex: number | null,
  from: number,
) {
  const g = gridOf(s);
  const cands: { dest: number; landing: number; v: number }[] = [];
  const area = targetHex !== null ? neighbors(g, targetHex) : within(g, from, 28);
  for (const h of area) {
    if (
      !isPassableLand(s.map, h) ||
      s.formations.some(o => o.hex === h) ||
      s.cities.some(c => c.hex === h)
    )
      continue;
    if (targetHex === null && canFoundCity(s, { ...cargo, hex: h })) continue;
    const water = neighbors(g, h).find(
      k =>
        s.map.terrain[k] === 'coast' && !s.formations.some(o => o.hex === k && o.civId !== civ.id),
    );
    if (water === undefined) continue;
    let v = -distance(g, from, h) * 0.3;
    if (targetHex === null)
      for (const n of within(g, h, 1)) v += hexFood(s.map, n) + (s.map.deposit[n] ? 1.5 : 0);
    cands.push({ dest: h, landing: water, v });
  }
  cands.sort((a, b) => b.v - a.v);
  for (const c of cands.slice(0, 6))
    if (!fleet || fleet.hex === c.landing || seaPath(s, fleet, c.landing)) return c;
  return undefined;
}

function startSeaTask(s: GameState, civ: Civ, cargo: Formation, targetHex: number | null) {
  if (!civ.techs.includes('sailing')) return;
  const g = gridOf(s);
  const design = civ.designs.find(d => d.name === 'Transports');
  if (!design) return;
  // a port only counts if a transport could really sail from it to the landing
  for (const port of portsFor(s, civ, cargo)) {
    const berth = neighbors(g, port.hex).find(k => s.map.terrain[k] === 'coast');
    if (berth === undefined) continue;
    const probe: Formation = {
      id: -1,
      civId: civ.id,
      name: 'probe',
      kind: 'fleet',
      hex: berth,
      moves: 0,
      path: [],
      fortified: false,
      cohorts: [{ id: -1, strength: 100, xp: 0, designId: design.id, loadout: design.loadout }],
    };
    const spot = pickLanding(s, civ, cargo, probe, targetHex, port.hex);
    if (!spot) continue;
    civ.sea = {
      fleet: -1,
      cargo: cargo.id,
      port: port.hex,
      landing: spot.landing,
      dest: spot.dest,
      stage: 'load',
      since: s.turn,
      target: targetHex ?? undefined,
    };
    cargo.path = [];
    trace(s, civ, `${cargo.name} will cross from ${port.name} to ${spot.dest}`);
    return;
  }
}

/** Step through a sea crossing: get ships, load at the port, sail, land. */
function runSeaTask(s: GameState, civ: Civ, rng: Rng) {
  ensureShipDesigns(s, civ);
  const t = civ.sea;
  if (!t) return;
  const g = gridOf(s);
  const cargo = s.formations.find(f => f.id === t.cargo);
  const port = s.cities.find(c => c.hex === t.port && c.civId === civ.id);
  if (!cargo || !port) {
    civ.sea = undefined;
    return;
  }
  if (s.turn - t.since > 40 && !t.abort) {
    if (cargo.aboard === undefined) {
      civ.sea = undefined;
      return;
    }
    abortCrossing(s, civ, t, 'took too long');
  }
  let fleet = s.formations.find(f => f.id === t.fleet);
  // ships: an idle fleet with room near the port, else build transports
  if (!fleet) {
    fleet = s.formations.find(
      f =>
        f.civId === civ.id &&
        f.kind === 'fleet' &&
        roomOn(s, f) >= cargo.cohorts.length &&
        distance(g, f.hex, port.hex) <= 6,
    );
    if (fleet) t.fleet = fleet.id;
  }
  if (
    !fleet ||
    (t.stage === 'load' && roomOn(s, fleet) < cargo.cohorts.length && cargo.aboard !== fleet.id)
  ) {
    const d = civ.designs.find(x => x.name === 'Transports');
    if (d) buildShip(s, port.id, d.id);
    return;
  }
  if (t.stage === 'load') {
    // older coastal hulls hold the whole fleet to the shore: refit them while in port
    const d = civ.designs.find(x => x.name === 'Transports');
    if (d && ITEMS[d.loadout.armour].ocean && !oceanGoing(fleet) && fleet.aboard === undefined) {
      const old = fleet.cohorts.filter(c => !ITEMS[c.loadout.armour].ocean).map(c => c.id);
      if (!cargoOf(s, fleet).length) refit(s, fleet.id, old, d.loadout);
    }
    if (cargo.aboard === fleet.id) {
      t.stage = 'sail';
    } else {
      // ship waits by the port, cargo walks down and boards
      if (distance(g, fleet.hex, port.hex) > 1) {
        const berth = neighbors(g, port.hex).find(
          k =>
            isWater(s.map.terrain[k]) && !s.formations.some(o => o.hex === k && o.civId !== civ.id),
        );
        if (berth !== undefined) {
          fleet.path = planPath(s, fleet, berth) ?? [];
          advance(s, fleet);
        }
      }
      if (distance(g, cargo.hex, fleet.hex) === 1) orderMove(s, cargo.id, fleet.hex);
      else if (cargo.hex !== port.hex) {
        cargo.path = planPath(s, cargo, port.hex) ?? [];
        advance(s, cargo);
        if (distance(g, cargo.hex, fleet.hex) === 1 && cargo.moves > 0)
          orderMove(s, cargo.id, fleet.hex);
      }
      if (cargo.aboard === fleet.id) t.stage = 'sail';
      return;
    }
  }
  if (t.stage === 'sail') {
    if (fleet.hex !== t.landing) {
      fleet.path = seaPath(s, fleet, t.landing) ?? [];
      if (!fleet.path.length) {
        const spot = t.abort
          ? undefined
          : pickLanding(s, civ, cargo, fleet, t.target ?? null, fleet.hex);
        if (!spot) {
          // no way there: bring the cargo home instead of leaving it at sea
          if (t.abort) {
            const alt = neighbors(g, fleet.hex).find(
              h =>
                isPassableLand(s.map, h) &&
                !s.formations.some(o => o.hex === h && o.civId !== civ.id),
            );
            if (alt !== undefined) {
              t.dest = alt;
              t.landing = fleet.hex;
              t.stage = 'unload';
            } else civ.sea = undefined;
          } else abortCrossing(s, civ, t, 'no sea route');
          return;
        }
        t.landing = spot.landing;
        t.dest = spot.dest;
        fleet.path = planPath(s, fleet, t.landing) ?? [];
      }
      advance(s, fleet);
    }
    if (fleet.hex === t.landing) t.stage = 'unload';
  }
  if (t.stage === 'unload') {
    if (cargo.aboard === undefined) {
      civ.sea = undefined;
      return;
    }
    if (cargo.moves <= 0) return;
    const r = orderMove(s, cargo.id, t.dest);
    if (!r.ok) {
      // the beach is taken: try any free land next to the ship
      const alt = neighbors(g, fleet.hex).find(
        h =>
          isPassableLand(s.map, h) &&
          !s.formations.some(o => o.hex === h) &&
          !s.cities.some(c => c.hex === h && c.civId !== civ.id),
      );
      if (alt !== undefined) orderMove(s, cargo.id, alt);
    }
    if (cargo.aboard === undefined) {
      // an invasion that landed carries on as a land campaign against its target
      const tgt =
        t.target !== undefined
          ? s.cities.find(c => c.hex === t.target && c.civId !== civ.id)
          : undefined;
      if (tgt && cargo.kind === 'army' && !t.abort) {
        civ.ai = {
          targetCity: tgt.id,
          staging: cargo.hex,
          phase: 'march',
          since: s.turn,
          members: [cargo.id],
        };
        trace(s, civ, `landed next to ${tgt.name}`);
      }
      civ.sea = undefined;
    }
  }
  void rng;
}

/** Turn a crossing around: sail back to the port and land the cargo there. */
function abortCrossing(s: GameState, civ: Civ, t: NonNullable<Civ['sea']>, why: string) {
  const g = gridOf(s);
  const berth = neighbors(g, t.port).find(k => isWater(s.map.terrain[k]));
  trace(s, civ, `crossing abandoned: ${why}`);
  t.abort = true;
  t.since = s.turn;
  if (berth === undefined) {
    civ.sea = undefined;
    return;
  }
  t.landing = berth;
  t.dest = t.port;
  t.stage = 'sail';
}

/** Fleets not on a crossing: warships hunt nearby enemy ships; transports wait in port. */
function fleetOrders(s: GameState, civ: Civ, f: Formation, enemies: Civ[]) {
  const g = gridOf(s);
  const armed = f.cohorts.some(
    c => isRanged(c.loadout) || (ITEMS[c.loadout.weapon].attack ?? 0) >= 3,
  );
  if (!armed || !enemies.length) return;
  const prey = s.formations
    .filter(
      o =>
        o.kind === 'fleet' && enemies.some(e => e.id === o.civId) && distance(g, o.hex, f.hex) <= 8,
    )
    .sort((a, b) => distance(g, a.hex, f.hex) - distance(g, b.hex, f.hex))[0];
  if (!prey) return;
  if (distance(g, prey.hex, f.hex) === 1) {
    strikeIfGood(s, f, prey.hex);
    return;
  }
  f.path = pathNextTo(s, f, prey.hex) ?? [];
  advance(s, f);
  if (s.formations.includes(f) && distance(g, prey.hex, f.hex) === 1) strikeIfGood(s, f, prey.hex);
}
