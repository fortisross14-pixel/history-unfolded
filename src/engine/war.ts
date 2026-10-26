import type { Province, Character, Battle, War, Civilization, WorldState } from '../types.ts';
import { RNG } from './rng.ts';
import { neigh, has, recalcRealmFromProvinces, distance } from './util.ts';
import { addEvent } from './events.ts';
import { numberedBattleName } from './naming.ts';
import { addDeed, earnNickname, fullName, killCharacter, notifyAmbition } from './characters.ts';
import { deposeRuler, newRuler } from './dynasty.ts';
import { courtOf, idx, isAlive } from './lookup.ts';
import { TRAITS } from './traits.ts';

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

/** Battle multiplier from a commander's skill and command traits. */
export function commandOf(g: Character | null) {
  if (!g) return 0.88;
  const traits = g.traits.reduce((n, t) => n * (TRAITS[t].command ?? 1), 1);
  const skill = g.role === 'General' ? g.skill : g.skill * 0.6;
  return Math.min(1.75, (0.88 + skill * 0.0032) * traits);
}

/** Fame, wounds and death for the commanders of one battle. */
function commanderFate(
  s: WorldState,
  g: Character | null,
  won: boolean,
  battle: string,
  size: number,
  r: RNG,
) {
  if (!g) return;
  if (won) {
    g.battlesWon++;
    if (size >= 30) addDeed(s, g, `Victory at ${battle}`, 3);
  } else g.battlesLost++;
  const risk = (won ? 0.01 : 0.04) * (g.traits.includes('Brave') ? 2 : 1);
  if (r.chance(risk)) {
    addDeed(s, g, `Fell at ${battle}`, 4);
    killCharacter(s, g, 'battle');
  }
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
  if (isAlive(wRuler)) {
    addDeed(s, wRuler, `Won the ${w.name}`, decisive ? 12 : 7);
    earnNickname(s, wRuler);
  }
  if (isAlive(lRuler)) addDeed(s, lRuler, `Lost the ${w.name}`, 2);
  const general = commanderFor(s, winner);
  if (general && general.role === 'General')
    addDeed(s, general, `Won the ${w.name} in command`, decisive ? 8 : 5);
  notifyAmbition(s, winner.id, 'conquer', `defeated ${loser.name} in the ${w.name}`, loser.id);
}

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
  const rivalry = s.rivalries.find(
    x => x.realmIds.includes(a.id) && x.realmIds.includes(d.id) && x.warIds.length > 0,
  );
  const options: { weight: number; type: War['type']; rationale: string; goal: string }[] = [
    {
      weight: 45,
      type: 'Expansion War',
      rationale: `${a.name} seeks additional land and strategic depth along its border with ${d.name}.`,
      goal: 'Capture and permanently annex neighboring provinces.',
    },
  ];
  if (a.faithId && d.faithId && a.faithId !== d.faithId)
    options.push({
      weight: 20,
      type: 'Religious War',
      rationale: `${a.name} and ${d.name} follow rival religions, and the border has become a center of religious tension.`,
      goal: `Force ${d.name} to adopt the attacker’s majority religion after a decisive victory.`,
    });
  if (a.gdp < d.gdp * 0.72 && a.armyCapacity > d.armyCapacity * 1.2)
    options.push({
      weight: 18,
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
  if (a.dynastyId && a.prestige > d.prestige * 1.15)
    options.push({
      weight: 8,
      type: 'Dynastic Claim',
      rationale: `The ruling dynasty of ${a.name} asserts a claim over the throne of ${d.name}.`,
      goal: 'Install the attacker’s dynasty in the defeated realm.',
    });
  if (rivalry)
    options.push({
      weight: 10 + Math.min(15, rivalry.intensity / 5),
      type: 'Punitive War',
      rationale: `A long rivalry and unresolved grievances have driven ${a.name} to punish ${d.name}.`,
      goal: 'Damage the enemy’s prestige, stability and treasury.',
    });
  let roll = r.next() * options.reduce((n, o) => n + o.weight, 0);
  for (const o of options) {
    roll -= o.weight;
    if (roll <= 0) return o;
  }
  return options[0];
}

export function startWar(s: WorldState, a: Civilization, d: Civilization, r: RNG) {
  if (
    s.wars.some(w => w.active && w.participantIds.includes(a.id) && w.participantIds.includes(d.id))
  )
    return;
  const plan = chooseWarType(s, a, d, r);
  const focus = s.cities.find(x => x.id === d.capitalCityId)?.name ?? d.originTribe;
  const war: War = {
    id: s.nextIds.war++,
    name: `${plan.type} of ${focus}`,
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
    battles: 0,
    battleIds: [],
    territoriesChanged: 0,
    gdpTransferred: 0,
    religionChanged: false,
    decisiveVictory: false,
    active: true,
  };
  s.wars.push(war);
  a.warIds.push(war.id);
  d.warIds.push(war.id);
  let riv = s.rivalries.find(
    x => x.status === 'active' && x.realmIds.includes(a.id) && x.realmIds.includes(d.id),
  );
  if (!riv) {
    const cause =
      plan.type === 'Religious War'
        ? 'religion'
        : plan.type === 'Commercial War'
          ? 'trade'
          : plan.type === 'Dynastic Claim'
            ? 'dynasty'
            : plan.type === 'Cultural Reunification'
              ? 'cultural'
              : 'border';
    riv = {
      id: s.nextIds.rivalry++,
      realmIds: [a.id, d.id],
      startedYear: s.year,
      cause,
      warIds: [],
      battleIds: [],
      totalCasualties: 0,
      provincesExchanged: 0,
      intensity: 25,
      status: 'active',
    };
    s.rivalries.push(riv);
    a.rivalryIds.push(riv.id);
    d.rivalryIds.push(riv.id);
  }
  riv.warIds.push(war.id);
  addEvent(
    s,
    'military',
    `${war.name} begins`,
    `${a.name} declared a ${plan.type.toLowerCase()} against ${d.name}. ${plan.rationale} Goal: ${plan.goal}`,
    8,
    [a.id, d.id],
    { warIds: [war.id], tags: ['war', plan.type] },
  );
}

export function transferProvince(
  s: WorldState,
  from: Civilization,
  to: Civilization,
  province: Province,
) {
  province.ownerId = to.id;
  from.provinces = from.provinces.filter(id => id !== province.id);
  if (!to.provinces.includes(province.id)) to.provinces.push(province.id);
  const city = province.cityId ? s.cities.find(x => x.id === province.cityId) : null;
  if (city) {
    city.currentRealmId = to.id;
    const last = city.ownershipHistory.at(-1);
    if (last && !last.to) last.to = s.year;
    city.ownershipHistory.push({ realmId: to.id, from: s.year });
    from.cityIds = from.cityIds.filter(id => id !== city.id);
    if (!to.cityIds.includes(city.id)) to.cityIds.push(city.id);
  }
  recalcRealmFromProvinces(s, from);
  recalcRealmFromProvinces(s, to);
}

export function applyWarOutcome(
  s: WorldState,
  w: War,
  a: Civilization,
  d: Civilization,
  winner: Civilization,
  loser: Civilization,
  decisive: boolean,
  r: RNG,
) {
  w.decisiveVictory = decisive;
  if (winner.id !== a.id) {
    w.outcome = `${d.name} repelled the attack and preserved its political independence.`;
    d.prestige += 8;
    a.stability = Math.max(5, a.stability - 6);
    return;
  }
  if (w.type === 'Civil War' || w.type === 'Annexation War') {
    const transferCount = decisive
      ? d.provinces.length
      : Math.max(1, Math.ceil(d.provinces.length * 0.3));
    const candidates = [...d.provinces]
      .map(id => s.provinces[id])
      .filter(p => decisive || neigh(p, s).some(n => n.ownerId === a.id));
    for (const p of candidates.slice(0, transferCount)) {
      transferProvince(s, d, a, p);
      w.territoriesChanged++;
    }
    w.outcome = decisive
      ? `${a.name} destroyed ${d.name} and reunited all of its territory.`
      : `${a.name} won a limited victory and annexed ${w.territoriesChanged} provinces; both successor states survived.`;
  } else if (w.type === 'Expansion War') {
    const limit =
      decisive && d.provinces.length <= 6
        ? d.provinces.length
        : decisive
          ? Math.max(1, Math.ceil(d.provinces.length * 0.22))
          : 1;
    let moved = 0;
    for (const p of d.provinces
      .map(id => s.provinces[id])
      .filter(p => neigh(p, s).some(n => n.ownerId === a.id))
      .sort((x, y) => y.fertility - x.fertility)) {
      if (moved >= limit) break;
      transferProvince(s, d, a, p);
      moved++;
      w.territoriesChanged++;
    }
    w.outcome = `${a.name} annexed ${w.territoriesChanged} neighboring province${w.territoriesChanged === 1 ? '' : 's'} from ${d.name}.`;
  } else if (w.type === 'Religious War' && a.faithId) {
    const faith = s.religions.find(x => x.id === a.faithId)?.name ?? 'the attacker’s religion';
    if (decisive) {
      d.faithId = a.faithId;
      for (const id of d.provinces) s.provinces[id].religionId = a.faithId;
      w.religionChanged = true;
      w.outcome = `After its decisive defeat, ${d.name} adopted ${faith} as its majority religion.`;
    } else {
      const border = d.provinces
        .map(id => s.provinces[id])
        .filter(p => neigh(p, s).some(n => n.ownerId === a.id))
        .slice(0, Math.max(1, Math.ceil(d.provinces.length * 0.12)));
      border.forEach(p => (p.religionId = a.faithId));
      w.outcome = `${faith} gained control of ${border.length} contested border province${border.length === 1 ? '' : 's'}, but ${d.name} retained its state religion.`;
    }
  } else if (w.type === 'Commercial War') {
    const share = decisive ? 0.15 : 0.07,
      amount = Math.max(0, d.gdp * share);
    d.gdp = Math.max(0.1, d.gdp - amount);
    a.gdp += amount;
    w.gdpTransferred = amount;
    w.outcome = `${d.name} paid reparations worth ${amount.toFixed(1)}, equal to ${(share * 100).toFixed(0)}% of its annual GDP.`;
  } else if (w.type === 'Dynastic Claim' && a.dynastyId) {
    const old = s.dynasties.find(x => x.id === d.dynastyId);
    if (old) {
      old.status = 'deposed';
      old.endedYear = s.year;
    }
    d.dynastyId = a.dynastyId;
    const dynasty = s.dynasties.find(x => x.id === a.dynastyId);
    if (dynasty && !dynasty.realmIds.includes(d.id)) dynasty.realmIds.push(d.id);
    deposeRuler(s, d, r, `dynastic settlement imposed by ${a.name}`);
    newRuler(s, d, r, `dynastic settlement imposed by ${a.name}`);
    w.outcome = `The ${dynasty?.name ?? 'attacker’s dynasty'} took the throne of ${d.name}.`;
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
    const amount = d.gdp * (decisive ? 0.08 : 0.04);
    d.gdp = Math.max(0.1, d.gdp - amount);
    a.gdp += amount;
    w.gdpTransferred = amount;
    d.stability = Math.max(5, d.stability - (decisive ? 15 : 8));
    d.prestige = Math.max(0, d.prestige - (decisive ? 18 : 9));
    w.outcome = `${d.name} lost prestige, stability and ${amount.toFixed(1)} in punitive reparations.`;
  }
}

export function battle(s: WorldState, w: War, r: RNG) {
  const a = s.civilizations.find(x => x.id === w.attackerIds[0]),
    d = s.civilizations.find(x => x.id === w.defenderIds[0]);
  if (!a || !d || !a.provinces.length || !d.provinces.length) {
    w.active = false;
    return;
  }
  const borderA = a.provinces
    .flatMap(id => neigh(s.provinces[id], s))
    .filter(p => p.ownerId === d.id);
  if (!borderA.length) {
    w.active = false;
    w.endYear = s.year;
    w.outcome = 'The war ended because the opposing realms no longer shared an accessible front.';
    return;
  }
  const target = r.pick(borderA),
    aCap = s.cities.find(x => x.id === a.capitalCityId)?.provinceId ?? a.provinces[0],
    dCap = s.cities.find(x => x.id === d.capitalCityId)?.provinceId ?? d.provinces[0];
  const aShare = Math.max(0.12, 0.72 - distance(s, aCap, target.id) * 0.035),
    dShare = Math.max(0.12, 0.72 - distance(s, dCap, target.id) * 0.035);
  const ag = commanderFor(s, a),
    dg = commanderFor(s, d);
  const aN = Math.max(1, Math.round(a.armySize * aShare * (0.72 + r.next() * 0.28))),
    dN = Math.max(1, Math.round(d.armySize * dShare * (0.72 + r.next() * 0.28)));
  const tech = (c: Civilization) =>
    Math.min(
      2.15,
      0.85 +
        c.technology / 1500 +
        (has(c, 'bronze') ? 0.07 : 0) +
        (has(c, 'iron') ? 0.12 : 0) +
        (has(c, 'gunpowder') ? 0.22 : 0),
    );
  const power = (n: number, c: Civilization, g: Character | null) =>
    Math.pow(n, 0.96) * tech(c) * commandOf(g) * (0.91 + r.next() * 0.18);
  const ap = power(aN, a, ag),
    dp = power(dN, d, dg),
    winnerSide = ap > dp ? 'attacker' : 'defender';
  const ratio = Math.max(ap, dp) / Math.max(1, Math.min(ap, dp));
  const winnerRate = Math.max(0.1, 0.3 - Math.min(0.2, (ratio - 1) * 0.09) + r.next() * 0.1);
  const loserRate = Math.min(0.7, 0.44 + Math.min(0.22, (ratio - 1) * 0.1) + r.next() * 0.05);
  const aRate = winnerSide === 'attacker' ? winnerRate : loserRate,
    dRate = winnerSide === 'defender' ? winnerRate : loserRate;
  const aCas = Math.min(aN, Math.max(1, Math.round(aN * aRate))),
    dCas = Math.min(dN, Math.max(1, Math.round(dN * dRate)));
  const b: Battle = {
    id: s.nextIds.battle++,
    warId: w.id,
    name: numberedBattleName(s, `Battle of ${target.name}`),
    year: s.year,
    provinceId: target.id,
    attacker: {
      realmIds: [a.id],
      generalId: ag?.id ?? null,
      combatants: aN,
      casualties: aCas,
      power: ap,
    },
    defender: {
      realmIds: [d.id],
      generalId: dg?.id ?? null,
      combatants: dN,
      casualties: dCas,
      power: dp,
    },
    winner: winnerSide,
    significance: Math.min(
      100,
      Math.round((aN + dN) / 700 + (Math.abs(ap - dp) / Math.max(ap, dp)) * 40),
    ),
  };
  s.battles.push(b);
  w.battleIds.push(b.id);
  w.battles++;
  w.attackerLosses += aCas;
  w.defenderLosses += dCas;
  a.armySize = Math.max(0, a.armySize - aCas);
  d.armySize = Math.max(0, d.armySize - dCas);
  commanderFate(s, ag, winnerSide === 'attacker', b.name, b.significance, r);
  commanderFate(s, dg, winnerSide === 'defender', b.name, b.significance, r);
  const riv = s.rivalries.find(
    x => x.status === 'active' && x.realmIds.includes(a.id) && x.realmIds.includes(d.id),
  );
  if (riv) {
    riv.battleIds.push(b.id);
    riv.totalCasualties += aCas + dCas;
    riv.provincesExchanged = w.territoriesChanged;
    riv.intensity = Math.min(100, riv.intensity + 5);
  }
  addEvent(
    s,
    'military',
    b.name,
    `${winnerSide === 'attacker' ? a.name : d.name} won${(winnerSide === 'attacker' ? ag : dg) ? ` under ${fullName((winnerSide === 'attacker' ? ag : dg)!)}` : ''}. ${aN.toLocaleString()} attackers and ${dN.toLocaleString()} defenders fought; ${(aCas + dCas).toLocaleString()} were lost.`,
    8,
    [a.id, d.id],
    {
      personIds: [ag?.id, dg?.id].filter((x): x is number => !!x),
      warIds: [w.id],
      battleIds: [b.id],
      tags: ['battle', w.type],
    },
  );
  const aRatio = a.armySize / Math.max(1, a.armyCapacity),
    dRatio = d.armySize / Math.max(1, d.armyCapacity);
  let capitulator: Civilization | null = null,
    victor: Civilization | null = null;
  if (aRatio < 0.2 || dRatio < 0.2) {
    if (aRatio < 0.2 && dRatio < 0.2) {
      capitulator = a.armySize <= d.armySize ? a : d;
      victor = capitulator.id === a.id ? d : a;
    } else if (aRatio < 0.2) {
      capitulator = a;
      victor = d;
    } else {
      capitulator = d;
      victor = a;
    }
  }
  const normalEnd = w.battles >= r.int(2, 6) || !d.provinces.length;
  if (capitulator || normalEnd) {
    w.active = false;
    w.endYear = s.year;
    const casualtyBalance =
      Math.abs(w.attackerLosses - w.defenderLosses) /
      Math.max(1, w.attackerLosses + w.defenderLosses);
    const armyBalance = Math.abs(
      a.armySize / Math.max(1, a.armyCapacity) - d.armySize / Math.max(1, d.armyCapacity),
    );
    const stalemate =
      !capitulator && casualtyBalance < 0.12 && armyBalance < 0.12 && w.battles >= 3;
    if (stalemate) {
      w.winnerIds = [];
      w.loserIds = [];
      w.decisiveVictory = false;
      w.outcome = `${a.name} and ${d.name} exhausted one another without achieving the war goal. The conflict ended in stalemate.`;
      addEvent(s, 'military', `${w.name} ends in stalemate`, w.outcome, 7, [a.id, d.id], {
        warIds: [w.id],
        tags: ['war ended', w.type, 'stalemate'],
      });
    } else {
      const winner = capitulator ? victor! : winnerSide === 'attacker' ? a : d,
        loser = winner.id === a.id ? d : a;
      w.winnerIds = [winner.id];
      w.loserIds = [loser.id];
      const winnerRatio = winner.armySize / Math.max(1, winner.armyCapacity),
        loserRatio = loser.armySize / Math.max(1, loser.armyCapacity);
      const decisive =
        !!capitulator ||
        winnerRatio > loserRatio * 1.8 ||
        Math.abs(w.attackerLosses - w.defenderLosses) >
          Math.max(3, (w.attackerLosses + w.defenderLosses) * 0.3);
      applyWarOutcome(s, w, a, d, winner, loser, decisive, r);
      warDeeds(s, w, winner, loser, decisive);
      winner.prestige += decisive ? 14 : 8;
      loser.stability = Math.max(5, loser.stability - (decisive ? 12 : 5));
      addEvent(
        s,
        'military',
        `${w.name} ends`,
        `${winner.name} defeated ${loser.name}. ${w.outcome}`,
        decisive ? 10 : 8,
        [a.id, d.id],
        {
          warIds: [w.id],
          tags: ['war ended', w.type, decisive ? 'decisive victory' : 'limited victory'],
          worldChronicle: decisive,
        },
      );
    }
  }
}
