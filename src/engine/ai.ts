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
  newProposal,
  opinion,
} from './diplomacy.ts';
import { buildShip, cityGuard, cityWalls, orderMove, roomOn } from './game.ts';
import {
  cityDistricts,
  cityEconomy,
  marketStock,
  constructionQueue,
  districtAt,
  districtSites,
  slotProblem,
} from './economy.ts';
import { placeDistrict, setSlot, territory } from './game.ts';
import type { City } from './types.ts';
import { hexFood, isPassableLand } from './mapgen.ts';
import { hashSeed, mulberry32, type Rng } from './rng.ts';
import type { Civ, Formation, GameState } from './types.ts';
import { capOf, COHORT_SIZE, isRanged, loadoutProblem, people, power } from './units.ts';

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
  const score = (n: (typeof CULTURE_LIST)[number]) =>
    n.tags.filter(t => civ.leanings.includes(t)).length * 3 +
    (5 - n.tier) * 0.5 +
    rng() * 2 -
    nodeCost(s, civ, n) / 60;
  const best = avail.sort((a, b) => score(b) - score(a))[0];
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
    for (const n of within(g, k, 1)) v += hexFood(s.map, n) + (s.map.deposit[n] ? 1.5 : 0);
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

// slot types the AI likes, most wanted first (for a hex where they are valid)
const PRIORITY = [
  'copper-mine',
  'tin-mine',
  'iron-mine',
  'horse-stud',
  'quarry',
  'woodlot',
  'grain-field',
  'cattle-pasture',
  'fishing-dock',
  'pig-pen',
  'hunting-lodge',
  'plantation',
  'gold-mine',
  'silver-mine',
  'sheep-run',
];
const CENTRE = [
  'houses',
  'market',
  'houses',
  'workshop',
  null,
  'school',
  'granary',
  'armoury',
  'barracks',
];

/** Fill a district plan for this hex: what is worth building there, two of each at most. */
function planFor(s: GameState, civ: Civ, hex: number): { slots: (string | null)[]; score: number } {
  const slots: (string | null)[] = new Array(9).fill(null);
  let score = 0,
    k = 0,
    mines = 0;
  const order = [0, 1, 2, 3, 5, 6, 7, 8];
  for (const t of PRIORITY) {
    if (slotProblem(s, civ.id, hex, false, t)) continue;
    const n = t.endsWith('mine') || t === 'quarry' ? 3 : 2;
    for (let j = 0; j < n && k < order.length; j++) {
      slots[order[k++]] = t;
      score += t.endsWith('mine') ? 3 : 1;
      if (t.endsWith('mine') || t === 'quarry') mines++;
    }
  }
  slots[4] =
    mines >= 2 && !slotProblem(s, civ.id, hex, false, 'infirmary')
      ? 'infirmary'
      : k < 8
        ? 'houses'
        : null;
  while (k < order.length)
    slots[order[k++]] = !slotProblem(s, civ.id, hex, false, 'pig-pen') ? 'pig-pen' : 'houses';
  return { slots, score };
}

function planDistricts(s: GameState, civ: Civ, c: City) {
  // replanning is costly: each city looks again every few turns, staggered
  if ((s.turn + c.id) % 3 !== 0 && cityDistricts(s, c).length > 1) return;
  const outer = cityDistricts(s, c).filter(d => d.hex !== c.hex);
  // the city centre fills in once there is a district bringing in goods
  const centre = districtAt(s, c.hex);
  if (outer.length && centre && centre.slots.every((x, i) => i === 4 || !x.type)) {
    CENTRE.forEach((t, i) => {
      if (t && !slotProblem(s, civ.id, c.hex, true, t)) setSlot(s, centre.id, i, t);
    });
  }
  if (outer.length && constructionQueue(s, c).length > 3) return;
  const e = cityEconomy(s, c);
  // out of room: a residential quarter
  if (outer.length && c.pop + 500 >= e.total.housing) {
    const site = districtSites(s, c, territory(s)).find(h => !districtAt(s, h));
    const homes = [
      'houses',
      'market',
      'houses',
      'school',
      'houses',
      'market',
      'houses',
      'houses',
      'houses',
    ];
    if (site !== undefined) placeDistrict(s, c.id, site, `${c.name} houses`, homes);
    return;
  }
  // only plan more work when there are people to do it
  if (outer.length && e.workers - e.workersUsed < 500) return;
  let best = -1,
    bp: (string | null)[] = [],
    bv = 0;
  const hasWood = outer.some(d => d.slots.some(x => x.type === 'woodlot'));
  for (const h of districtSites(s, c, territory(s))) {
    if (districtAt(s, h)) continue;
    const p = planFor(s, civ, h);
    // the first district should bring in wood
    const v = p.score + (!hasWood && p.slots.includes('woodlot') ? 5 : 0);
    if (v > bv) {
      bv = v;
      best = h;
      bp = p.slots;
    }
  }
  if (best >= 0) {
    const main = bp.find(t => t && t !== 'houses' && t !== 'infirmary');
    placeDistrict(
      s,
      c.id,
      best,
      `${c.name} ${main ? SLOT_TYPES[main].name.toLowerCase() + 's' : 'quarter'}`,
      bp,
    );
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
  for (const c of cities) {
    const armies = mine().filter(f => f.kind === 'army' && f.name !== 'Scouts').length;
    if (
      !settlersOut &&
      s.turn > 6 &&
      c.pop >= 3000 &&
      (cities.length < 4 || (cities.length < 7 && rng() < 0.15))
    )
      trainSettlers(s, c.id);
    else if (c.pop >= 3000 && armies < cities.length * 2 + 1) levy(s, c.id);
  }

  // --- diplomacy and war
  aiDiplomacy(s, civ, rng);
  const enemies = s.civs.filter(o => o.alive && o.id !== civ.id && atWar(s, civ.id, o.id));
  const camp = enemies.length ? planCampaign(s, civ, enemies) : ((civ.ai = undefined), undefined);
  if (enemies.length && !camp && !civ.sea) {
    // no enemy city reachable by land: carry the biggest army across the sea
    const army = mine()
      .filter(
        f =>
          f.kind === 'army' &&
          f.name !== 'Scouts' &&
          f.aboard === undefined &&
          !cities.some(c => c.hex === f.hex && f.fortified),
      )
      .sort((a, b) => b.cohorts.length - a.cohorts.length)[0];
    const target = s.cities.filter(
      c =>
        enemies.some(e => e.id === c.civId) &&
        neighbors(g, c.hex).some(k => s.map.terrain[k] === 'coast'),
    );
    if (army && army.cohorts.length >= 6 && target.length)
      startSeaTask(
        s,
        civ,
        army,
        target.sort((a, b) => distance(g, a.hex, army.hex) - distance(g, b.hex, army.hex))[0].hex,
      );
  }
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
      const centre = districtAt(s, c.hex);
      if (!centre || cityDistricts(s, c).some(d => d.slots.some(x => x.type === 'shipyard')))
        continue;
      if (slotProblem(s, civ.id, c.hex, true, 'shipyard', centre.id)) continue;
      const i = centre.slots.findIndex(x => !x.type || (x.type === 'barracks' && !x.built));
      if (i >= 0) setSlot(s, centre.id, i, 'shipyard');
    }

  // --- formations
  const garrisoned = new Set<number>();
  runSeaTask(s, civ, rng);
  // enemy armies close to our cities, found once for all our formations
  const threats = enemies.length
    ? s.formations.filter(
        o =>
          o.kind === 'army' &&
          enemies.some(e => e.id === o.civId) &&
          cities.some(c => distance(g, c.hex, o.hex) <= 3),
      )
    : [];
  for (const f of mine()) {
    if (!s.formations.includes(f)) continue;
    if (f.aboard !== undefined || civ.sea?.cargo === f.id || civ.sea?.fleet === f.id) continue;
    if (f.kind === 'fleet') {
      fleetOrders(s, civ, f, enemies);
      continue;
    }
    equip(s, civ, f);
    if (f.moves > 0 && (s.turn + f.id) % 3 === 0) upgrade(s, civ, f);
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
    // garrison: one army sits in each city
    const home = cities.find(c => c.hex === f.hex && !garrisoned.has(c.id));
    if (home && (!enemies.length || cities.length > garrisoned.size + 1 || people(f) < 400)) {
      garrisoned.add(home.id);
      // fold a second army on the same hex into the garrison while there is room
      for (const o of formationsAt(s, f.hex))
        if (
          o !== f &&
          o.civId === civ.id &&
          o.kind === 'army' &&
          o.cohorts.length + f.cohorts.length <= capOf(f, s) &&
          o.name !== 'Scouts'
        )
          merge(s, o.id, f.id);
      f.fortified = true;
      continue;
    }
    const ungarrisoned = cities.find(
      c =>
        !garrisoned.has(c.id) &&
        !formationsAt(s, c.hex).some(x => x.civId === civ.id && x.kind === 'army' && x !== f),
    );
    if (!enemies.length) {
      if (ungarrisoned && f.hex !== ungarrisoned.hex) {
        f.path = planPath(s, f, ungarrisoned.hex) ?? [];
        advance(s, f);
      } else f.fortified = true;
      continue;
    }
    // at war: weakened formations go home to recover
    if (people(f) < f.cohorts.length * COHORT_SIZE * 0.55 && cities.length) {
      const c = cities
        .slice()
        .sort((a, b) => distance(g, a.hex, f.hex) - distance(g, b.hex, f.hex))[0];
      if (f.hex !== c.hex) {
        f.path = planPath(s, f, c.hex) ?? [];
        advance(s, f);
      }
      continue;
    }
    // defend: an enemy army close to one of our cities comes first
    const threat = threats.find(o => distance(g, f.hex, o.hex) <= 6);
    if (threat) {
      if (strikeIfGood(s, f, threat.hex)) continue;
      f.path = pathNextTo(s, f, threat.hex) ?? [];
      advance(s, f);
      if (s.formations.includes(f) && f.moves > 0 && distance(g, f.hex, threat.hex) === 1)
        strikeIfGood(s, f, threat.hex);
      continue;
    }
    // opportunity: an enemy right next to us
    const adj = neighbors(g, f.hex).find(h =>
      s.formations.some(o => o.hex === h && enemies.some(e => e.id === o.civId)),
    );
    if (adj !== undefined && strikeIfGood(s, f, adj)) continue;
    if (!camp) continue;
    const target = s.cities.find(c => c.id === camp.targetCity)!;
    if (camp.phase === 'gather') {
      // assemble at the staging city and fold into big formations
      if (f.hex !== camp.staging) {
        f.path = planPath(s, f, camp.staging) ?? [];
        advance(s, f);
      }
      if (s.formations.includes(f) && f.hex === camp.staging)
        for (const o of formationsAt(s, f.hex))
          if (
            o !== f &&
            o.civId === civ.id &&
            o.kind === 'army' &&
            o.name !== 'Scouts' &&
            o.cohorts.length + f.cohorts.length <= capOf(f, s) &&
            s.formations.includes(o)
          )
            merge(s, o.id, f.id);
      continue;
    }
    // march on the target city and assault it
    if (distance(g, f.hex, target.hex) === 1) {
      if (!strikeIfGood(s, f, target.hex, 0.75)) f.fortified = true;
      continue;
    }
    f.path = pathNextTo(s, f, target.hex) ?? [];
    advance(s, f);
    if (s.formations.includes(f) && f.moves > 0 && distance(g, f.hex, target.hex) === 1)
      strikeIfGood(s, f, target.hex, 0.75);
  }
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

/**
 * A campaign: pick the softest enemy city we can reach by land, gather the field armies at our
 * nearest city, march once strong enough (or after waiting long enough), regroup if bled white.
 */
function planCampaign(s: GameState, civ: Civ, enemies: Civ[]) {
  const g = gridOf(s);
  const cities = s.cities.filter(c => c.civId === civ.id);
  const field = s.formations.filter(
    f =>
      f.civId === civ.id &&
      f.kind === 'army' &&
      f.name !== 'Scouts' &&
      !cities.some(c => c.hex === f.hex && f.fortified),
  );
  if (!cities.length || !field.length) return undefined;
  let camp = civ.ai;
  const valid =
    camp && s.cities.some(c => c.id === camp!.targetCity && enemies.some(e => e.id === c.civId));
  if (!valid) {
    const probe = field[0];
    let best: { city: (typeof s.cities)[number]; staging: number; v: number } | undefined;
    for (const c of s.cities) {
      if (!enemies.some(e => e.id === c.civId)) continue;
      const home = cities
        .slice()
        .sort((a, b) => distance(g, a.hex, c.hex) - distance(g, b.hex, c.hex))[0];
      const d = distance(g, home.hex, c.hex);
      if (d > 18) continue;
      if (!pathNextTo(s, { ...probe, hex: home.hex }, c.hex)) continue; // not reachable over land
      const v = d * 3 + cityDefence(s, c.hex) / 4;
      if (!best || v < best.v) best = { city: c, staging: home.hex, v };
    }
    if (!best) return undefined;
    camp = civ.ai = {
      targetCity: best.city.id,
      staging: best.staging,
      phase: 'gather',
      since: s.turn,
    };
  }
  const c = camp!;
  const target = s.cities.find(x => x.id === c.targetCity)!;
  const near = (h: number) =>
    field.filter(f => distance(g, f.hex, h) <= 2).reduce((a, f) => a + power(f), 0);
  const need = cityDefence(s, target.hex) * 1.3;
  if (c.phase === 'gather' && (near(c.staging) >= need || s.turn - c.since > 12)) {
    c.phase = 'march';
    c.since = s.turn;
  } else if (c.phase === 'march' && field.reduce((a, f) => a + power(f), 0) < need * 0.5) {
    c.phase = 'gather';
    c.since = s.turn;
  }
  return c;
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
      return mineP > militaryPower(s, o.id) * need + 5;
    });
    if (targets.length)
      declareWar(
        s,
        civ.id,
        targets.sort((a, b) => opinion(s, civ.id, a.id) - opinion(s, civ.id, b.id))[0].id,
      );
  }

  // seek peace when the war goes badly or drags on
  for (const o of enemies) {
    const w = s.wars.find(
      x => (x.a === civ.id && x.b === o.id) || (x.b === civ.id && x.a === o.id),
    )!;
    const length = s.turn - w.since;
    const losing = mineP < militaryPower(s, o.id) * 0.8;
    if (length < 10 || !(losing || length >= 25)) continue;
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
  // trade: our surplus for something we lack that the player has plenty of
  const surplus = Object.keys(mine).filter(k => mine[k] > 120 && (theirs[k] ?? 0) < 40);
  const want = Object.keys(theirs).filter(k => theirs[k] > 60 && (mine[k] ?? 0) < 20);
  if (surplus.length && want.length && op > -20) {
    const give = surplus[Math.floor(rng() * surplus.length)],
      get = want[Math.floor(rng() * want.length)];
    newProposal(s, {
      from: civ.id,
      to: me.id,
      kind: 'trade',
      offer: {
        give: { goodsPerTurn: { [give]: 3 } },
        get: { goodsPerTurn: { [get]: 2 } },
        turns: 20,
      },
      text: `The ${civ.name} offer a trade: 3 ${give} a turn for 2 ${get} a turn, for 20 turns.`,
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
function portFor(s: GameState, civ: Civ, f: Formation) {
  const g = gridOf(s);
  return s.cities
    .filter(
      c =>
        c.civId === civ.id &&
        cityDistricts(s, c).some(d => d.slots.some(x => x.built && x.type === 'shipyard')),
    )
    .sort((a, b) => distance(g, a.hex, f.hex) - distance(g, b.hex, f.hex))
    .find(c => c.hex === f.hex || planPath(s, f, c.hex));
}

/** Where to land: a free land hex next to water. For settlers, a good city site; for armies, next to the target. */
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
    if (!fleet || fleet.hex === c.landing || planPath(s, fleet, c.landing)) return c;
  return undefined;
}

function startSeaTask(s: GameState, civ: Civ, cargo: Formation, targetHex: number | null) {
  if (!civ.techs.includes('sailing')) return;
  const port = portFor(s, civ, cargo);
  if (!port) return;
  const spot = pickLanding(s, civ, cargo, undefined, targetHex, port.hex);
  if (!spot) return;
  civ.sea = {
    fleet: -1,
    cargo: cargo.id,
    port: port.hex,
    landing: spot.landing,
    dest: spot.dest,
    stage: 'load',
    since: s.turn,
  };
  cargo.path = [];
}

/** Step through a sea crossing: get ships, load at the port, sail, land. */
function runSeaTask(s: GameState, civ: Civ, rng: Rng) {
  ensureShipDesigns(s, civ);
  const t = civ.sea;
  if (!t) return;
  const g = gridOf(s);
  const cargo = s.formations.find(f => f.id === t.cargo);
  const port = s.cities.find(c => c.hex === t.port && c.civId === civ.id);
  if (!cargo || !port || s.turn - t.since > 40) {
    civ.sea = undefined;
    return;
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
      fleet.path = planPath(s, fleet, t.landing) ?? [];
      if (!fleet.path.length) {
        const spot = pickLanding(
          s,
          civ,
          cargo,
          fleet,
          cargo.kind === 'settlers' ? null : null,
          fleet.hex,
        );
        if (!spot) {
          civ.sea = undefined;
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
    if (cargo.aboard === undefined) civ.sea = undefined;
  }
  void rng;
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
