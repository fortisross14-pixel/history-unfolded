import type { Province, Character, War, Civilization, WorldState } from '../types.ts';
import { RNG } from './rng.ts';
import { neigh } from './util.ts';
import { buildingTotal } from './buildings.ts';
import { addEvent } from './events.ts';
import { addDeed, earnNickname, killCharacter, notifyAmbition } from './characters.ts';
import { deposeRuler, newRuler } from './dynasty.ts';
import { courtOf, idx, isAlive } from './lookup.ts';
import { TRAITS } from './traits.ts';
import { warShapesAxes } from './axes.ts';
import { addRelation, afterWar, alliesOf, findRelation } from './diplomacy.ts';
import { realmModifiers } from './modifiers.ts';
import { isGreatPower, topPowers } from './power.ts';
import { momentSlotFree } from './moments.ts';
import { startGreatWar } from './greatwar.ts';

// ---- Commanders ---------------------------------------------------------------

/** The realm's best general, or the ruler in person if there is none. */
export function commanderFor(s: WorldState, c: Civilization): Character | null {
  const general = courtOf(s, c.id)
    .filter(x => x.role === 'General')
    .sort((a, b) => b.skill - a.skill)[0];
  if (general) return general;
  const ruler = idx(s).char.get(c.rulerId);
  return isAlive(ruler) && s.year - ruler.born >= 18 && !ruler.traits.includes('Craven')
    ? ruler
    : null;
}

/** The realm's best admiral, falling back to its land commander. */
export function admiralFor(s: WorldState, c: Civilization): Character | null {
  const admiral = courtOf(s, c.id)
    .filter(x => x.role === 'Admiral')
    .sort((a, b) => b.skill - a.skill)[0];
  return admiral ?? commanderFor(s, c);
}

/** Battle multiplier from a commander's skill and command traits. */
export function commandOf(g: Character | null) {
  if (!g) return 0.88;
  const traits = g.traits.reduce((n, t) => n * (TRAITS[t].command ?? 1), 1);
  const skill = g.role === 'General' || g.role === 'Admiral' ? g.skill : g.skill * 0.6;
  return Math.min(1.75, (0.88 + skill * 0.0032) * traits);
}

/** Fame, capture or death for a commander after a fight. */
export function commanderFate(
  s: WorldState,
  g: Character | null,
  won: boolean,
  battle: string,
  r: RNG,
) {
  if (!g) return '';
  if (won) {
    g.battlesWon++;
    addDeed(s, g, `Victory at ${battle}`, 3);
    return '';
  }
  g.battlesLost++;
  const risk = 0.08 * (g.traits.includes('Brave') ? 2 : 1);
  if (r.chance(risk)) {
    addDeed(s, g, `Fell at ${battle}`, 4);
    killCharacter(s, g, 'battle');
    return `${g.name} falls`;
  }
  if (r.chance(0.12)) {
    addDeed(s, g, `Captured at ${battle} and later ransomed`, 1);
    return `${g.name} is captured`;
  }
  return '';
}

// ---- Strength -------------------------------------------------------------------

/** Fighting edge from the era; breakthroughs like bronze or gunpowder add war power via modifiers. */
export function techFactor(c: Civilization) {
  return 0.9 + c.era * 0.08;
}

const TERRAIN_DEFENSE: Record<string, number> = {
  mountain: 1.3,
  forest: 1.15,
  desert: 1.05,
  tundra: 1.1,
};

/** Defender's bonus from the ground along the front and its fortresses. */
export function defenseFactor(s: WorldState, defender: Civilization, attacker: Civilization) {
  const front = defender.provinces
    .map(id => s.provinces[id])
    .filter(p => neigh(p, s).some(n => n.ownerId === attacker.id));
  const ground = front.length
    ? front.reduce((n, p) => n + (TERRAIN_DEFENSE[p.terrain] ?? 1), 0) / front.length
    : 1.05;
  const forts = defender.cityIds.reduce(
    (n, id) => n + buildingTotal(idx(s).city.get(id)?.buildings ?? [], 'defense'),
    0,
  );
  return ground * (1 + Math.min(0.3, forts));
}

/** Whether the realms' border touches the sea, so fleets can join in. */
export function coastalFront(s: WorldState, a: Civilization, d: Civilization) {
  return d.provinces.some(id => {
    const p = s.provinces[id];
    const ns = neigh(p, s);
    return ns.some(n => n.ownerId === a.id) && ns.some(n => n.terrain === 'ocean');
  });
}

/**
 * Fighting strength of one side's leader: army, technology, commander,
 * war-power modifiers and national character. Allies add a share of theirs.
 */
export function sideStrength(s: WorldState, w: War, side: 'attacker' | 'defender') {
  const ids = side === 'attacker' ? w.attackerIds : w.defenderIds;
  const enemyIds = side === 'attacker' ? w.defenderIds : w.attackerIds;
  const lead = idx(s).civ.get(ids[0]);
  const enemy = idx(s).civ.get(enemyIds[0]);
  if (!lead || !enemy || !lead.provinces.length) return 0;
  const mods = realmModifiers(s, lead).total;
  const zeal = w.type === 'Religious War' && lead.axes.faith < 35 ? 1.1 : 1;
  const drive = 1 + (lead.axes.ambition - 50) / 500;
  const ground = side === 'defender' ? defenseFactor(s, lead, enemy) : 1;
  let troops = lead.armySize;
  for (const id of ids.slice(1)) {
    const ally = idx(s).civ.get(id);
    if (ally && ally.provinces.length) troops += ally.armySize * 0.3;
  }
  const fleet = coastalFront(
    s,
    side === 'attacker' ? lead : enemy,
    side === 'attacker' ? enemy : lead,
  )
    ? 1 + 0.3 * (lead.navy / Math.max(1, lead.navy + enemy.navy) - 0.5)
    : 1;
  return (
    Math.pow(Math.max(1, troops), 0.96) *
    techFactor(lead) *
    commandOf(commanderFor(s, lead)) *
    (1 + mods.warPower) *
    zeal *
    drive *
    ground *
    fleet
  );
}

// ---- Declaring war ------------------------------------------------------------

export function chooseWarType(
  s: WorldState,
  a: Civilization,
  d: Civilization,
  r: RNG,
): { type: War['type']; rationale: string; goal: string } {
  const borderProvinces = d.provinces.filter(id =>
    neigh(s.provinces[id], s).some(n => n.ownerId === a.id),
  );
  const sharedCulture = borderProvinces.filter(
    id => s.provinces[id].cultureId === a.cultureId,
  ).length;
  const rivalry = findRelation(s, a.id, d.id, 'Rival');
  const options: { weight: number; type: War['type']; rationale: string; goal: string }[] = [
    {
      weight: 45,
      type: 'Expansion War',
      rationale: `${a.name} seeks additional land and strategic depth along its border with ${d.name}.`,
      goal: 'Capture and permanently annex neighboring provinces.',
    },
  ];
  // Zealous peoples wage holy wars; tolerant ones almost never do.
  if (a.faithId && d.faithId && a.faithId !== d.faithId)
    options.push({
      weight: 20 * ((100 - a.axes.faith) / 50) ** 2,
      type: 'Religious War',
      rationale: `${a.name} and ${d.name} follow rival religions, and the border has become a center of religious tension.`,
      goal: `Force ${d.name} to adopt the attacker’s majority religion after a decisive victory.`,
    });
  if (a.wealth < d.wealth * 0.72 && a.armyCapacity > d.armyCapacity * 1.2)
    options.push({
      weight: 18 * (0.5 + a.axes.economy / 100),
      type: 'Commercial War',
      rationale: `The poorer but militarily stronger ${a.name} seeks to seize part of ${d.name}’s exceptional wealth.`,
      goal: 'Extract reparations worth up to 15% of the defender’s annual GDP.',
    });
  if (sharedCulture > 0)
    options.push({
      weight: 18,
      type: 'Cultural Reunification',
      rationale: `${a.name} claims culturally related borderlands currently governed by ${d.name}.`,
      goal: 'Transfer provinces dominated by the attacker’s culture.',
    });
  if (a.dynastyId && a.influence > d.influence * 1.15)
    options.push({
      weight: 8,
      type: 'Dynastic Claim',
      rationale: `The ruling dynasty of ${a.name} asserts a claim over the throne of ${d.name}.`,
      goal: 'Install the attacker’s dynasty in the defeated realm.',
    });
  if (rivalry)
    options.push({
      weight: 10 + Math.min(15, (rivalry.wars ?? 0) * 5),
      type: 'Punitive War',
      rationale: `A long rivalry and unresolved grievances have driven ${a.name} to punish ${d.name}.`,
      goal: 'Damage the enemy’s stability and treasury.',
    });
  let roll = r.next() * options.reduce((n, o) => n + o.weight, 0);
  for (const o of options) {
    roll -= o.weight;
    if (roll <= 0) return o;
  }
  return options[0];
}

export function newWar(
  s: WorldState,
  a: Civilization,
  d: Civilization,
  plan: { type: War['type']; rationale: string; goal: string },
  name: string,
): War {
  return {
    id: s.nextIds.war++,
    name,
    type: plan.type,
    rationale: plan.rationale,
    goal: plan.goal,
    startYear: s.year,
    attackerIds: [a.id],
    defenderIds: [d.id],
    participantIds: [a.id, d.id],
    winnerIds: [],
    loserIds: [],
    attackerLosses: 0,
    defenderLosses: 0,
    territoriesChanged: 0,
    goldTransferred: 0,
    religionChanged: false,
    decisiveVictory: false,
    active: true,
    great: false,
    keyBattles: [],
    terms: [],
  };
}

/** Provinces held by every realm on both sides. */
const combinedSize = (s: WorldState, w: War) =>
  w.participantIds.reduce((n, id) => n + (idx(s).civ.get(id)?.provinces.length ?? 0), 0);

/**
 * A war becomes a Great War (a World Moment) when a great power fights, or
 * when the alliances involved are huge, and a moment slot is free. Every
 * other war is settled at once by a single roll.
 */
export function launchWar(s: WorldState, w: War, r: RNG) {
  s.wars.push(w);
  for (const id of w.participantIds) idx(s).civ.get(id)?.warIds.push(w.id);
  const a = idx(s).civ.get(w.attackerIds[0])!;
  const d = idx(s).civ.get(w.defenderIds[0])!;
  const land = s.provinces.filter(p => p.ownerId !== null).length;
  const big = combinedSize(s, w) >= land * 0.3;
  // Only a real contest is a Great War: the weaker side needs a quarter of the stronger's power.
  const sidePower = (ids: number[]) =>
    ids.reduce((n, id) => n + (idx(s).civ.get(id)?.power ?? 0), 0);
  const [pa, pd] = [sidePower(w.attackerIds), sidePower(w.defenderIds)];
  const contest = Math.min(pa, pd) >= Math.max(pa, pd) * 0.25;
  const great = ((isGreatPower(s, a) || isGreatPower(s, d)) && contest) || (big && contest);
  if (great && momentSlotFree(s)) startGreatWar(s, w, r);
  else resolveQuickWar(s, w, a, d, r);
}

export function startWar(s: WorldState, a: Civilization, d: Civilization, r: RNG) {
  if (
    s.wars.some(w => w.active && w.participantIds.includes(a.id) && w.participantIds.includes(d.id))
  )
    return;
  const plan = chooseWarType(s, a, d, r);
  const focus = idx(s).city.get(d.capitalCityId)?.name ?? d.originTribe;
  const w = newWar(s, a, d, plan, `${plan.type} of ${focus}`);
  addRelation(s, 'Rival', a.id, d.id, plan.type);
  // Defensive allies answer the call.
  const allies = alliesOf(s, d).filter(
    x => x.id !== a.id && !findRelation(s, x.id, a.id, 'Alliance'),
  );
  for (const ally of allies) {
    w.defenderIds.push(ally.id);
    w.participantIds.push(ally.id);
  }
  // Against the strongest power, allies who also fear it form a coalition.
  const top = topPowers(s, 1)[0];
  if (top && top.id === d.id)
    for (const ally of alliesOf(s, a))
      if (!w.participantIds.includes(ally.id) && findRelation(s, ally.id, d.id, 'Rival')) {
        w.attackerIds.push(ally.id);
        w.participantIds.push(ally.id);
      }
  addEvent(
    s,
    'military',
    `${w.name} begins`,
    `${a.name} declared a ${plan.type.toLowerCase()} against ${d.name}. ${plan.rationale} Goal: ${plan.goal}${allies.length ? ` ${allies.map(x => x.name).join(', ')} joined in defence of their ally.` : ''}`,
    7,
    [a.id, d.id],
    { warIds: [w.id], tags: ['war', plan.type] },
  );
  launchWar(s, w, r);
}

// ---- Quick wars ---------------------------------------------------------------

/**
 * One roll settles an ordinary war: army, technology, commander, terrain and
 * national character on each side. No battles are stored.
 */
function resolveQuickWar(s: WorldState, w: War, a: Civilization, d: Civilization, r: RNG) {
  const sa = sideStrength(s, w, 'attacker') * (0.8 + r.next() * 0.4);
  const sd = sideStrength(s, w, 'defender') * (0.8 + r.next() * 0.4);
  const p = sa ** 1.6 / Math.max(1, sa ** 1.6 + sd ** 1.6);
  const roll = r.next();
  const close = Math.abs(p - 0.5) < 0.1;
  const civil = w.type === 'Civil War';
  const years = r.int(1, 5);
  // Both sides bleed; the loser far more.
  const attackerWon = roll < p;
  const loss = (c: Civilization, lost: boolean) =>
    Math.round(c.armySize * (lost ? 0.25 + r.next() * 0.2 : 0.08 + r.next() * 0.1));
  w.attackerLosses = loss(a, !attackerWon);
  w.defenderLosses = loss(d, attackerWon);
  a.armySize = Math.max(0, a.armySize - w.attackerLosses);
  d.armySize = Math.max(0, d.armySize - w.defenderLosses);
  // Close wars can end in stalemate; a stalemated civil war leaves two states.
  if (close && r.chance(civil ? 0.25 : 0.35)) {
    finishWar(s, w, null, false, r, years);
    return;
  }
  const winner = attackerWon ? a : d;
  // Civil wars tend to end with one side crushed; small realms are swallowed whole.
  const edge = civil ? 0.58 : 0.72;
  const decisive = attackerWon
    ? p > edge && roll < p * 0.75
    : p < 1 - edge && roll > p + (1 - p) * 0.3;
  const g = commanderFor(s, winner);
  if (g && g.role === 'General') g.battlesWon += r.int(1, 3);
  finishWar(s, w, winner, decisive, r, years);
}

// ---- Ending wars --------------------------------------------------------------

export function transferProvince(
  s: WorldState,
  from: Civilization,
  to: Civilization,
  province: Province,
) {
  province.ownerId = to.id;
  from.provinces = from.provinces.filter(id => id !== province.id);
  if (!to.provinces.includes(province.id)) to.provinces.push(province.id);
  const city = province.cityId ? idx(s).city.get(province.cityId) : null;
  if (city) {
    city.currentRealmId = to.id;
    const last = city.ownershipHistory.at(-1);
    if (last && !last.to) last.to = s.year;
    city.ownershipHistory.push({ realmId: to.id, from: s.year });
    from.cityIds = from.cityIds.filter(id => id !== city.id);
    if (!to.cityIds.includes(city.id)) to.cityIds.push(city.id);
  }
  // Conquest is destructive: the province loses a tenth of its development.
  province.development = Math.max(1, province.development * 0.9);
}

/** Takes every province of the loser, front or not. */
export function annexAll(s: WorldState, loser: Civilization, winner: Civilization) {
  const all = loser.provinces.map(id => s.provinces[id]);
  for (const p of all) transferProvince(s, loser, winner, p);
  return all.length;
}

/** Moves up to `count` of the loser's provinces that border the winner. */
export function cedeFront(s: WorldState, loser: Civilization, winner: Civilization, count: number) {
  let moved = 0;
  const front = loser.provinces
    .map(id => s.provinces[id])
    .filter(p => neigh(p, s).some(n => n.ownerId === winner.id))
    .sort((x, y) => y.development - x.development);
  for (const p of front) {
    if (moved >= count) break;
    transferProvince(s, loser, winner, p);
    moved++;
  }
  return moved;
}

/** What the winner takes after a quick war, by war goal. */
export function applyWarOutcome(
  s: WorldState,
  w: War,
  a: Civilization,
  d: Civilization,
  winner: Civilization,
  decisive: boolean,
  r: RNG,
) {
  w.decisiveVictory = decisive;
  // A civil war ends with one government for the whole country.
  if (w.type === 'Civil War' && winner.id !== a.id) {
    w.territoriesChanged += annexAll(s, a, d);
    w.outcome = `The rebels of ${d.name} won and took over all of ${a.name}.`;
    return;
  }
  if (winner.id !== a.id) {
    w.outcome = `${d.name} repelled the attack and preserved its independence.`;
    a.stability = Math.max(5, a.stability - 6);
    return;
  }
  if (w.type === 'Civil War' || w.type === 'Annexation War') {
    const count =
      decisive || w.type === 'Civil War'
        ? d.provinces.length
        : Math.max(1, Math.ceil(d.provinces.length * 0.3));
    const candidates = [...d.provinces]
      .map(id => s.provinces[id])
      .filter(p => decisive || neigh(p, s).some(n => n.ownerId === a.id));
    for (const p of candidates.slice(0, count)) {
      transferProvince(s, d, a, p);
      w.territoriesChanged++;
    }
    w.outcome = decisive
      ? `${a.name} destroyed ${d.name} and reunited all of its territory.`
      : `${a.name} won a limited victory and annexed ${w.territoriesChanged} provinces; both states survived.`;
  } else if (
    w.type === 'Expansion War' &&
    decisive &&
    a.provinces.length > d.provinces.length * 3 &&
    d.provinces.length > 2 &&
    r.chance(0.5)
  ) {
    addRelation(s, 'Vassal', a.id, d.id, `Defeated in the ${w.name}`);
    w.outcome = `${d.name} submitted to ${a.name} and became its tributary vassal.`;
  } else if (w.type === 'Expansion War') {
    // A realm much smaller than its conqueror is swallowed whole.
    const swallow =
      d.provinces.length <= Math.max(4, Math.min(8, a.provinces.length * 0.25)) ||
      (decisive && d.provinces.length <= 8);
    const limit = swallow
      ? d.provinces.length
      : decisive
        ? Math.max(1, Math.ceil(d.provinces.length * 0.3))
        : Math.max(1, Math.ceil(d.provinces.length * 0.12));
    w.territoriesChanged += swallow ? annexAll(s, d, a) : cedeFront(s, d, a, limit);
    w.outcome = `${a.name} annexed ${w.territoriesChanged} neighboring province${w.territoriesChanged === 1 ? '' : 's'} from ${d.name}.`;
  } else if (w.type === 'Religious War' && a.faithId) {
    const faith = idx(s).religion.get(a.faithId)?.name ?? 'the attacker’s religion';
    if (decisive) {
      convertRealm(s, d, a.faithId);
      w.religionChanged = true;
      w.outcome = `After its decisive defeat, ${d.name} adopted ${faith} as its majority religion.`;
    } else {
      const border = d.provinces
        .map(id => s.provinces[id])
        .filter(p => neigh(p, s).some(n => n.ownerId === a.id))
        .slice(0, Math.max(1, Math.ceil(d.provinces.length * 0.12)));
      border.forEach(p => (p.religionId = a.faithId));
      w.outcome = `${faith} gained ${border.length} contested border province${border.length === 1 ? '' : 's'}, but ${d.name} kept its state religion.`;
    }
  } else if (w.type === 'Commercial War') {
    w.goldTransferred = payReparations(s, d, a, decisive ? 0.15 : 0.07);
    w.outcome = `${d.name} paid ${w.goldTransferred.toFixed(0)} gold in reparations.`;
  } else if (w.type === 'Dynastic Claim' && a.dynastyId) {
    takeThrone(s, a, d, r);
    w.outcome = `The ${idx(s).dynasty.get(a.dynastyId)?.name ?? 'attacker’s dynasty'} took the throne of ${d.name}.`;
  } else if (w.type === 'Cultural Reunification') {
    const claims = d.provinces
      .map(id => s.provinces[id])
      .filter(p => p.cultureId === a.cultureId && neigh(p, s).some(n => n.ownerId === a.id));
    const limit = decisive
      ? Math.max(1, Math.ceil(claims.length * 0.75))
      : Math.min(1, claims.length);
    for (const p of claims.slice(0, limit)) {
      transferProvince(s, d, a, p);
      w.territoriesChanged++;
    }
    w.outcome = `${a.name} incorporated ${w.territoriesChanged} culturally related province${w.territoriesChanged === 1 ? '' : 's'}.`;
  } else {
    w.goldTransferred = payReparations(s, d, a, decisive ? 0.08 : 0.04);
    d.stability = Math.max(5, d.stability - (decisive ? 15 : 8));
    w.outcome = `${d.name} lost stability and paid ${w.goldTransferred.toFixed(0)} gold.`;
  }
}

/**
 * Gold paid is real: it comes out of the loser's richest provinces and is
 * spent building up the winner's capital. Returns the gold paid.
 */
export function payReparations(s: WorldState, from: Civilization, to: Civilization, share: number) {
  const gold = from.wealth * share * 5;
  const richest = from.provinces
    .map(id => s.provinces[id])
    .sort((a, b) => b.development - a.development)
    .slice(0, 3);
  for (const p of richest) p.development = Math.max(1, p.development * (1 - share * 0.6));
  const capital = idx(s).city.get(to.capitalCityId);
  if (capital) s.provinces[capital.provinceId].development += Math.min(5, gold / 40);
  return gold;
}

export function convertRealm(s: WorldState, c: Civilization, faithId: number) {
  c.faithId = faithId;
  for (const id of c.provinces) s.provinces[id].religionId = faithId;
}

export function takeThrone(s: WorldState, a: Civilization, d: Civilization, r: RNG) {
  const old = d.dynastyId ? idx(s).dynasty.get(d.dynastyId) : undefined;
  if (old) {
    old.status = 'deposed';
    old.endedYear = s.year;
  }
  d.dynastyId = a.dynastyId;
  const dynasty = a.dynastyId ? idx(s).dynasty.get(a.dynastyId) : undefined;
  if (dynasty && !dynasty.realmIds.includes(d.id)) dynasty.realmIds.push(d.id);
  deposeRuler(s, d, r, `dynastic settlement imposed by ${a.name}`);
  newRuler(s, d, r, `dynastic settlement imposed by ${a.name}`);
}

/** Deeds and ambitions when a war ends. */
function warDeeds(
  s: WorldState,
  w: War,
  winner: Civilization,
  loser: Civilization,
  decisive: boolean,
) {
  const wRuler = idx(s).char.get(winner.rulerId);
  const lRuler = idx(s).char.get(loser.rulerId);
  const weight = w.great ? 2 : 1;
  if (isAlive(wRuler)) {
    addDeed(s, wRuler, `Won the ${w.name}`, (decisive ? 12 : 7) * weight);
    earnNickname(s, wRuler);
  }
  if (isAlive(lRuler)) addDeed(s, lRuler, `Lost the ${w.name}`, 2);
  const general = commanderFor(s, winner);
  if (general && general.role === 'General')
    addDeed(s, general, `Won the ${w.name} in command`, (decisive ? 8 : 5) * weight);
  notifyAmbition(s, winner.id, 'conquer', `defeated ${loser.name} in the ${w.name}`, loser.id);
}

/**
 * Shared ending for every war: outcome (for quick wars), deeds, national
 * character, truce and chronicle entry. Great Wars pass their own terms.
 */
export function finishWar(
  s: WorldState,
  w: War,
  winner: Civilization | null,
  decisive: boolean,
  r: RNG,
  years = 0,
) {
  const a = idx(s).civ.get(w.attackerIds[0])!;
  const d = idx(s).civ.get(w.defenderIds[0])!;
  w.active = false;
  w.endYear = s.year + years;
  if (!winner) {
    w.outcome ??= `${a.name} and ${d.name} exhausted one another without reaching the war goal.`;
  } else {
    const loser = winner.id === a.id ? d : a;
    w.winnerIds = winner.id === a.id ? [...w.attackerIds] : [...w.defenderIds];
    w.loserIds = winner.id === a.id ? [...w.defenderIds] : [...w.attackerIds];
    if (!w.great) applyWarOutcome(s, w, a, d, winner, decisive, r);
    w.decisiveVictory = decisive;
    loser.stability = Math.max(5, loser.stability - (decisive ? 12 : 5));
    warDeeds(s, w, winner, loser, decisive);
    warShapesAxes(winner, true, decisive);
    warShapesAxes(loser, false, decisive);
  }
  afterWar(s, a, d);
  const verdict = winner ? `${winner.name} won. ${w.outcome}` : w.outcome!;
  addEvent(
    s,
    'military',
    `${w.name} ends`,
    verdict,
    w.great ? 10 : decisive ? 8 : 6,
    [a.id, d.id],
    {
      warIds: [w.id],
      tags: [
        'war ended',
        w.type,
        winner ? (decisive ? 'decisive victory' : 'victory') : 'stalemate',
      ],
      worldChronicle: w.great || decisive,
    },
  );
}
