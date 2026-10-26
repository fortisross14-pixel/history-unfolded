import type { Character, Civilization, KeyBattle, Moment, War, WorldState } from '../types.ts';
import { RNG } from './rng.ts';
import { idx } from './lookup.ts';
import { distance, neigh } from './util.ts';
import { endMoment, momentEvent, startMoment } from './moments.ts';
import {
  admiralFor,
  annexAll,
  uniqueWarName,
  cedeFront,
  commandOf,
  commanderFate,
  commanderFor,
  convertRealm,
  finishWar,
  payReparations,
  sideStrength,
  takeThrone,
} from './war.ts';
import { addRelation, alliesOf, endRelation, findRelation } from './diplomacy.ts';
import { addEvent } from './events.ts';
import { fullName } from './characters.ts';

/** Momentum a side must hold for a full year to win outright. */
const VICTORY_MOMENTUM = 70;
const VICTORY_TICKS = 4;
/** War weariness at which a side sues for peace. */
const EXHAUSTION = 100;
const MAX_YEARS = 25;

const civ = (s: WorldState, id: number) => idx(s).civ.get(id);

/** "Kingdom of Faron" → "Faron", for war names. */
const core = (name: string) =>
  name
    .replace(/^(Kingdom of |Duchy of |Republic of |Free )/, '')
    .replace(/ (Empire|Tribe|Settlements|Rebels)$/, '');
const living = (s: WorldState, ids: number[]) =>
  ids.map(id => civ(s, id)).filter((c): c is Civilization => !!c && c.provinces.length > 0);

export function startGreatWar(s: WorldState, w: War, r: RNG) {
  const a = civ(s, w.attackerIds[0])!;
  const d = civ(s, w.defenderIds[0])!;
  w.great = true;
  const m = startMoment(
    s,
    'war',
    `The ${uniqueWarName(s, w.type === 'Civil War' ? `Great ${w.name}` : `Great War of ${core(a.name)} and ${core(d.name)}`)}`,
    w.type,
    a.id,
    [...w.participantIds],
    `${a.name} and ${d.name} go to war. Great powers are involved, and the outcome will reshape the balance of the world.`,
    { warId: w.id, momentum: 0, weariness: [0, 0], streak: 0 },
  );
  w.name = m.title.replace(/^The /, '');
  w.momentId = m.id;
  m.series.push([s.year, 0]);
  void r;
}

const LAND_WINS = [
  'the enemy flank collapses',
  'a night assault breaks the line',
  'the cavalry charge carries the day',
  'the siege lines are stormed',
  'the river crossing is forced',
  'the reserves arrive in time',
];
const SEA_WINS = [
  'the enemy fleet is scattered',
  'fireships break the line',
  'the enemy flagship strikes its colours',
  'a storm favours the bold',
];

/** Picks a province on the front line, preferring the coast for sea battles. */
function frontProvince(s: WorldState, a: Civilization, d: Civilization, r: RNG, naval: boolean) {
  const front = d.provinces
    .map(id => s.provinces[id])
    .filter(p => neigh(p, s).some(n => n.ownerId === a.id));
  const coast = front.filter(p => neigh(p, s).some(n => n.terrain === 'ocean'));
  const pool =
    naval && coast.length ? coast : front.length ? front : d.provinces.map(id => s.provinces[id]);
  return pool.length ? r.pick(pool) : null;
}

function battleName(w: War, place: string, naval: boolean, r: RNG) {
  const base = naval
    ? r.pick([`Battle of the ${place} Strait`, `Battle off ${place}`, `Battle of ${place} Bay`])
    : `Battle of ${place}`;
  const count = w.keyBattles.filter(b => b.name.startsWith(base)).length;
  return count
    ? `${base} (${['second', 'third', 'fourth', 'fifth'][count - 1] ?? count + 1})`
    : base;
}

/**
 * A rare, named battle that swings momentum hard. Commanders win fame, are
 * captured or fall. Only these battles are stored.
 */
function keyBattle(s: WorldState, w: War, m: Moment, t: number, sa: number, sd: number, r: RNG) {
  const a = civ(s, w.attackerIds[0])!;
  const d = civ(s, w.defenderIds[0])!;
  const naval =
    a.navy > 0 && d.navy > 0 && r.chance(0.2 + ((a.axes.horizon + d.axes.horizon) / 200) * 0.4);
  const place = frontProvince(s, a, d, r, naval);
  if (!place) return;
  const ga: Character | null = naval ? admiralFor(s, a) : commanderFor(s, a);
  const gd: Character | null = naval ? admiralFor(s, d) : commanderFor(s, d);
  const pa =
    sa * commandOf(ga) * (naval ? Math.max(0.2, (a.navy / Math.max(1, a.navy + d.navy)) * 2) : 1);
  const pd =
    sd * commandOf(gd) * (naval ? Math.max(0.2, (d.navy / Math.max(1, a.navy + d.navy)) * 2) : 1);
  const attackerWins = r.next() < pa / Math.max(1, pa + pd);
  const winnerG = attackerWins ? ga : gd;
  const loserG = attackerWins ? gd : ga;
  const size = 15 + Math.round(r.next() * 20 + (winnerG ? (winnerG.skill - 50) / 5 : 0));
  const swing = attackerWins ? size : -size;
  const name = battleName(w, place.name, naval, r);
  const fate = commanderFate(s, loserG, false, name, r);
  commanderFate(s, winnerG, true, name, r);
  const winner = attackerWins ? a : d;
  const text = [
    `${name}: ${r.pick(naval ? SEA_WINS : LAND_WINS)}`,
    fate,
    winnerG ? `${fullName(winnerG)} triumphs` : '',
    `+${Math.abs(swing)} momentum to ${winner.name}`,
  ]
    .filter(Boolean)
    .join(', ');
  const kb: KeyBattle = {
    t,
    name,
    provinceId: place.id,
    naval,
    winner: attackerWins ? 'attacker' : 'defender',
    swing,
    text,
    // Always [attacker commander, defender commander]; 0 when a side had none.
    characterIds: [ga?.id ?? 0, gd?.id ?? 0],
  };
  w.keyBattles.push(kb);
  momentEvent(s, m, t, name, text, [a.id, d.id], kb.characterIds.filter(Boolean), swing);
  // Key battles cost both armies dearly.
  const lossA = Math.round(a.armySize * (attackerWins ? 0.04 : 0.1));
  const lossD = Math.round(d.armySize * (attackerWins ? 0.1 : 0.04));
  a.armySize -= lossA;
  d.armySize -= lossD;
  w.attackerLosses += lossA;
  w.defenderLosses += lossD;
  m.momentum = Math.max(-100, Math.min(100, (m.momentum ?? 0) + swing));
}

/** Allies may join a war that goes badly for their friend, or leave a hopeless one. */
function alliesMove(s: WorldState, w: War, m: Moment, t: number, r: RNG) {
  const momentum = m.momentum ?? 0;
  const sides: ['attacker' | 'defender', number[], number][] = [
    ['attacker', w.attackerIds, momentum > 20 ? 0.05 : 0.01],
    ['defender', w.defenderIds, momentum > 30 ? 0.1 : 0.03],
  ];
  for (const [side, ids, chance] of sides) {
    const lead = civ(s, ids[0]);
    const enemyIds = side === 'attacker' ? w.defenderIds : w.attackerIds;
    if (!lead) continue;
    for (const ally of alliesOf(s, lead)) {
      if (
        w.participantIds.includes(ally.id) ||
        enemyIds.some(id => findRelation(s, ally.id, id, 'Alliance'))
      )
        continue;
      if (!r.chance(chance)) continue;
      ids.push(ally.id);
      w.participantIds.push(ally.id);
      ally.warIds.push(w.id);
      if (!m.realmIds.includes(ally.id)) m.realmIds.push(ally.id);
      momentEvent(
        s,
        m,
        t,
        `${ally.name} enters the war`,
        `${ally.name} joins the ${side === 'attacker' ? 'attack' : 'defence'} beside its ally ${lead.name}.`,
        [ally.id, lead.id],
      );
    }
  }
  const tired = m.weariness ?? [0, 0];
  for (const [i, ids] of [w.attackerIds, w.defenderIds].entries()) {
    if (tired[i] < 60) continue;
    for (const id of ids.slice(1)) {
      if (!r.chance(0.03)) continue;
      const ally = civ(s, id);
      ids.splice(ids.indexOf(id), 1);
      const enemy = civ(s, (i === 0 ? w.defenderIds : w.attackerIds)[0]);
      if (ally && enemy)
        addRelation(s, 'Truce', ally.id, enemy.id, 'Separate peace', { until: s.year + 15 });
      if (ally)
        momentEvent(
          s,
          m,
          t,
          `${ally.name} makes a separate peace`,
          `Exhausted, ${ally.name} abandoned the war.`,
          [ally.id],
        );
    }
  }
}

/** One year of a Great War: four seasons of momentum. */
export function tickGreatWar(s: WorldState, m: Moment, r: RNG) {
  const w = s.wars.find(x => x.id === m.warId);
  if (!w || !w.active) return;
  for (let season = 0; season < 4; season++) {
    const t = s.year + season / 4;
    const attackers = living(s, w.attackerIds);
    const defenders = living(s, w.defenderIds);
    if (!attackers.length || attackers[0].id !== w.attackerIds[0])
      return peace(s, w, m, 'defender', r);
    if (!defenders.length || defenders[0].id !== w.defenderIds[0])
      return peace(s, w, m, 'attacker', r);
    const a = attackers[0];
    const d = defenders[0];
    // Supply: armies far from their own capital fight worse.
    const aCap = idx(s).city.get(a.capitalCityId)?.provinceId ?? a.provinces[0];
    const dCap = idx(s).city.get(d.capitalCityId)?.provinceId ?? d.provinces[0];
    const supply = Math.max(0.55, 1 - distance(s, aCap, dCap) * 0.012);
    // Money: the richer side keeps its armies in the field longer.
    const money = (x: Civilization, y: Civilization) =>
      0.9 + 0.2 * (x.wealth / Math.max(1, x.wealth + y.wealth));
    const wear = m.weariness ?? [0, 0];
    const sa = sideStrength(s, w, 'attacker') * supply * money(a, d) * (1 - wear[0] / 250);
    const sd = sideStrength(s, w, 'defender') * money(d, a) * (1 - wear[1] / 250);
    const noise = (r.next() + r.next() + r.next() - 1.5) * 6;
    const delta = (14 * (sa - sd)) / Math.max(1, sa + sd) + noise;
    m.momentum = Math.max(-100, Math.min(100, (m.momentum ?? 0) * 0.97 + delta));
    if (r.chance(0.05 + Math.abs(delta) / 150)) keyBattle(s, w, m, t, sa, sd, r);
    // Steady losses; the side losing ground loses more.
    const pressure = (m.momentum ?? 0) / 100;
    const lossA = Math.round(a.armySize * (0.012 + Math.max(0, -pressure) * 0.02));
    const lossD = Math.round(d.armySize * (0.012 + Math.max(0, pressure) * 0.02));
    a.armySize -= lossA;
    d.armySize -= lossD;
    w.attackerLosses += lossA;
    w.defenderLosses += lossD;
    m.weariness = [
      wear[0] + 1.1 + Math.max(0, -pressure) * 2,
      wear[1] + 1.1 + Math.max(0, pressure) * 2,
    ];
    alliesMove(s, w, m, t, r);
    m.series.push([t, Math.round(m.momentum ?? 0)]);
    const mo = m.momentum ?? 0;
    m.streak = Math.abs(mo) >= VICTORY_MOMENTUM ? (m.streak ?? 0) + 1 : 0;
    if ((m.streak ?? 0) >= VICTORY_TICKS)
      return peace(s, w, m, mo > 0 ? 'attacker' : 'defender', r);
    const [wa, wd] = m.weariness;
    if ((wa >= EXHAUSTION && wd >= EXHAUSTION) || s.year - w.startYear >= MAX_YEARS)
      return peace(s, w, m, Math.abs(mo) >= 35 ? (mo > 0 ? 'attacker' : 'defender') : null, r);
    if (wa >= EXHAUSTION * 1.2) return peace(s, w, m, 'defender', r);
    if (wd >= EXHAUSTION * 1.2) return peace(s, w, m, 'attacker', r);
  }
}

interface Demand {
  label: string;
  cost: number;
  apply: () => string;
}

/**
 * Peace conference: the winner lists demands, most wanted first; the loser
 * accepts as many as the final momentum forces it to.
 */
function peace(s: WorldState, w: War, m: Moment, side: 'attacker' | 'defender' | null, r: RNG) {
  const a = civ(s, w.attackerIds[0])!;
  const d = civ(s, w.defenderIds[0])!;
  if (!side) {
    w.terms = ['White peace: both sides keep what they hold'];
    w.outcome = `Exhaustion forced ${a.name} and ${d.name} to make peace with nothing gained.`;
    finishWar(s, w, null, false, r);
    endMoment(s, m, w.outcome);
    return;
  }
  const winner = side === 'attacker' ? a : d;
  const loser = side === 'attacker' ? d : a;
  // A side that was wiped out (or split apart) cannot negotiate.
  if (!winner.provinces.length || !loser.provinces.length) {
    const survivor = winner.provinces.length ? winner : loser.provinces.length ? loser : null;
    w.outcome = survivor ? `${survivor.name} was the last side standing.` : `Both sides collapsed.`;
    finishWar(s, w, survivor, true, r);
    endMoment(s, m, w.outcome);
    return;
  }
  const force = Math.abs(m.momentum ?? 0);
  let budget = Math.max(0.6, Math.min(3.2, (force - 30) / 20));
  const decisive = force >= 85;
  const landCount = Math.max(1, Math.ceil(loser.provinces.length * 0.12 * (force / 70)));
  const demands: Demand[] = [];
  const land: Demand = {
    label: 'land',
    cost: 1,
    apply: () => {
      const n = cedeFront(s, loser, winner, landCount);
      w.territoriesChanged += n;
      return n ? `${loser.name} ceded ${n} province${n === 1 ? '' : 's'}` : '';
    },
  };
  const gold: Demand = {
    label: 'gold',
    cost: 0.6,
    apply: () => {
      const amount = payReparations(s, loser, winner, decisive ? 0.15 : 0.08);
      w.goldTransferred += amount;
      return `${loser.name} paid ${amount.toFixed(0)} gold`;
    },
  };
  const vassal: Demand = {
    label: 'vassal',
    cost: 1.6,
    apply: () => {
      if (winner.power < loser.power * 1.6 || findRelation(s, winner.id, loser.id, 'Vassal'))
        return '';
      addRelation(s, 'Vassal', winner.id, loser.id, `Terms of the ${w.name}`);
      return `${loser.name} became a vassal of ${winner.name}`;
    },
  };
  const marriage: Demand = {
    label: 'marriage',
    cost: 0.3,
    apply: () => {
      if (!winner.dynastyId || !loser.dynastyId) return '';
      addRelation(s, 'Marriage', winner.id, loser.id, `Sealed the peace of the ${w.name}`, {
        until: s.year + 30,
      });
      return `A royal marriage joined the houses of ${winner.name} and ${loser.name}`;
    },
  };
  const faith: Demand = {
    label: 'faith',
    cost: 1,
    apply: () => {
      if (!winner.faithId || winner.faithId === loser.faithId) return '';
      convertRealm(s, loser, winner.faithId);
      w.religionChanged = true;
      return `${loser.name} adopted the faith of ${winner.name}`;
    },
  };
  const throne: Demand = {
    label: 'throne',
    cost: 1.5,
    apply: () => {
      if (!winner.dynastyId) return '';
      takeThrone(s, winner, loser, r);
      return `${winner.name}'s dynasty took the throne of ${loser.name}`;
    },
  };
  // A civil war is fought for the whole country.
  const reunify: Demand = {
    label: 'reunify',
    cost: 0,
    apply: () => {
      const n = annexAll(s, loser, winner);
      w.territoriesChanged += n;
      return `${winner.name} reunited the country, taking all ${n} provinces of ${loser.name}`;
    },
  };
  if (w.type === 'Civil War') demands.push(reunify);
  // The war goal comes first; then whatever else momentum can extract.
  if (side === 'attacker') {
    if (w.type === 'Religious War') demands.push(faith);
    if (w.type === 'Dynastic Claim') demands.push(throne);
    if (w.type === 'Commercial War' || w.type === 'Punitive War') demands.push(gold);
  }
  demands.push(land, gold, vassal, marriage);
  const terms: string[] = [];
  const used = new Set<string>();
  for (const demand of demands) {
    if (terms.length && budget < demand.cost) continue;
    if (used.has(demand.label)) continue;
    used.add(demand.label);
    const text = demand.apply();
    if (!text) continue;
    terms.push(text);
    budget -= demand.cost;
    if (budget <= 0) break;
  }
  w.terms = terms;
  w.outcome = `${winner.name} won the ${w.name} with momentum ${Math.round(force)}. Terms: ${terms.join('; ') || 'none'}.`;
  finishWar(s, w, winner, decisive, r);
  // The best general of the war is the one with the most key-battle wins.
  const wins = new Map<number, number>();
  for (const b of w.keyBattles) {
    const id = b.characterIds[b.winner === 'attacker' ? 0 : 1];
    if (id) wins.set(id, (wins.get(id) ?? 0) + 1);
  }
  const best = [...wins.entries()].sort((x, y) => y[1] - x[1])[0];
  const hero = best ? idx(s).char.get(best[0]) : undefined;
  endMoment(
    s,
    m,
    `${winner.name} prevailed after ${s.year - w.startYear + 1} years and ${w.keyBattles.length} key battles. ${terms.join('. ')}.${hero ? ` Hero of the war: ${fullName(hero)}.` : ''}`,
  );
  if (hero)
    addEvent(
      s,
      'military',
      `${fullName(hero)}, hero of the ${w.name}`,
      `${hero.name} won ${best[1]} key battles.`,
      7,
      [winner.id],
      { personIds: [hero.id], warIds: [w.id], tags: ['hero'] },
    );
  for (const rel of [findRelation(s, a.id, d.id, 'Alliance')]) if (rel) endRelation(s, rel);
}
