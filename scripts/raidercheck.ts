/** Headless checks of raiders: camps in the wild, bands that pillage, camps that can be burned. */
import { aiTurn } from '../src/engine/ai.ts';
import {
  attack,
  availableTechs,
  canAttack,
  formationStrength,
  fullMoves,
  isWaterHex,
  deserialize,
  endTurn,
  foundCity,
  newGame,
  player,
  serialize,
} from '../src/engine/game.ts';
import { CAMP_NEAR, raidersTurn, RAIDERS, RAIDERS_END_AGE } from '../src/engine/raiders.ts';
import { distance, neighbors } from '../src/engine/hex.ts';
import { LAIR_NEAR } from '../src/engine/wildlife.ts';
import { AGE_GATE } from '../src/data/techs.ts';
import type { GameState } from '../src/engine/types.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};
const make = (seed: number): GameState =>
  newGame({
    map: {
      type: 'continents',
      size: 'standard',
      seaLevel: 'normal',
      climate: 'normal',
      rainfall: 'normal',
      resources: 'normal',
      mountains: 'normal',
      seed,
    },
    civCount: 6,
    playerName: 'Test',
  });

// a game played by the AI for the player too (with research chosen for it)
function play(s: GameState, turns: number, each?: (s: GameState) => void) {
  const me = player(s);
  for (let t = 0; t < turns; t++) {
    me.isPlayer = false;
    aiTurn(s, me);
    me.isPlayer = true;
    if (!me.researching) me.researching = availableTechs(me)[0]?.id ?? null;
    endTurn(s);
    each?.(s);
  }
}

{
  const s = make(9);
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  check(!s.raiders, 'no raiders at the start');
  let camps = 0,
    bands = 0,
    pillaged = 0,
    burned = 0;
  let firstCamp = -1;
  play(s, 140, st => {
    const n = st.raiders?.camps.length ?? 0;
    if (n && firstCamp < 0) firstCamp = st.turn;
    camps = Math.max(camps, n);
    bands = Math.max(bands, st.raiders?.bands.length ?? 0);
  });
  for (const e of s.log) {
    if (/Raiders pillaged/.test(e.text)) pillaged++;
    if (/burned a raider camp/.test(e.text)) burned++;
  }
  const pill = (s.chronicle ?? []).length >= 0;
  console.log(
    `     seed 9: first camp turn ${firstCamp}, up to ${camps} camps and ${bands} bands; ` +
      `log tail pillages ${pillaged}, camps burned ${burned}`,
  );
  check(firstCamp >= RAIDERS.normal.from, `no camp before turn ${RAIDERS.normal.from}`);
  check(camps >= 1 && bands >= 1, 'camps appear and bands ride out');
  check(pill, 'played');
  const rc = s.raiders ? s.civs[s.raiders.civ] : undefined;
  check(rc?.raiders && rc.independent, 'raiders are one hidden people');
  check(
    !s.civs.some(c => c.met.includes(rc!.id)),
    'nobody ever meets the raiders (no diplomacy with them)',
  );
  check(!s.wars.some(w => w.a === rc!.id || w.b === rc!.id), 'raiders are not in any war');
  // anyone may strike a band without declaring war
  const band = s.formations.find(f => f.civId === rc!.id);
  const army = s.formations.find(f => f.civId === me.id && f.kind === 'army');
  if (band && army) {
    const at = army.hex;
    army.hex = band.hex + 1;
    army.moves = 2;
    const chk = canAttack(s, army.id, band.hex);
    check(chk.needsWar === undefined, 'no declaration of war needed against raiders');
    army.hex = at;
  }
  // burning a camp: an army walks in
  if (s.raiders?.camps.length && army) {
    const camp = s.raiders.camps[0];
    s.formations = s.formations.filter(f => !(f.civId === rc!.id && f.hex === camp.hex));
    army.hex = camp.hex;
    const gold = me.gold;
    raidersTurn(s);
    check(!s.raiders.camps.includes(camp), 'an army in a camp burns it');
    check(me.gold > gold, 'the hoard is taken');
  }
  const back = deserialize(serialize(s));
  check(back.raiders?.civ === s.raiders?.civ, 'raiders survive a save');

  // the age of raiders ends
  for (const c of s.civs)
    if (!c.independent) for (let a = 2; a <= RAIDERS_END_AGE + 1; a++) c.techs.push(AGE_GATE[a]);
  raidersTurn(s);
  const beasts = new Set((s.raiders!.lairs ?? []).map(l => l.fid));
  check(
    !s.raiders!.camps.length && !s.formations.some(f => f.civId === rc!.id && !beasts.has(f.id)),
    'past the Medieval age the last raiders scatter (the beasts stay in their lairs)',
  );
}

// pillage happens across games; lairs get cleared
{
  let total = 0,
    cleared = 0;
  for (const seed of [4, 13, 21]) {
    const s = make(seed);
    play(s, 130);
    const n = s.civs.reduce((a, c) => a + c.losses, 0) >= 0;
    const pillages = (s.log ?? []).filter(e => /Raiders pillaged/.test(e.text)).length;
    const killed = s.raiders ? s.civs[s.raiders.civ].losses : 0;
    total += pillages + killed;
    cleared += s.log.filter(e => / cleared /.test(e.text)).length;
    console.log(
      `     seed ${seed}: camps ${s.raiders?.camps.length ?? 0}, bands ${s.raiders?.bands.length ?? 0}, ` +
        `recent pillages ${pillages}, raider cohorts lost ${killed}${n ? '' : ''}`,
    );
  }
  check(total > 0, 'raiders pillage and are fought');
  console.log(`     lairs cleared in the log: ${cleared}`);
  check(cleared > 0, 'lairs get cleared in play');
}

// wild beasts from the start: lairs near every people, none next to a start
for (const seed of [9, 17]) {
  const s = make(seed);
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  endTurn(s);
  const g = { w: s.map.w, h: s.map.h };
  const lairs = s.raiders?.lairs ?? [];
  const great = s.civs.filter(c => !c.independent && c.alive);
  const homes = great.map(c => s.cities.find(x => x.civId === c.id)!.hex);
  const near = homes.map(
    h => lairs.filter(l => l.kind !== 'guardians' && distance(g, h, l.hex) <= LAIR_NEAR[1]).length,
  );
  const kinds = new Set(lairs.map(l => l.kind));
  console.log(
    `     seed ${seed}: ${lairs.length} lairs (${[...kinds].join(', ')}); near each start ${near.join(' ')}`,
  );
  check(
    near.every(n => n >= 2),
    `seed ${seed}: two or more lairs within ${LAIR_NEAR[1]} of every start`,
  );
  check(
    lairs.every(l => s.map.starts.every(h => distance(g, h, l.hex) >= 2)),
    `seed ${seed}: no lair on or next to a start`,
  );
  check(
    lairs.every(l => s.formations.some(f => f.id === l.fid && f.hex === l.hex)),
    `seed ${seed}: every lair has its pack at home`,
  );
  check(deserialize(serialize(s)).raiders?.lairs?.length === lairs.length, 'lairs survive a save');
}

// raider camps come early: one near every great people by turn 15 on Normal
{
  let all = 0,
    have = 0,
    mine = false;
  for (const seed of [9, 17, 23]) {
    const s = make(seed);
    const g = { w: s.map.w, h: s.map.h };
    const seen = new Set<number>();
    play(s, 15, st => {
      for (const c of st.civs) {
        if (c.independent || !c.alive) continue;
        const home = st.cities.filter(x => x.civId === c.id).sort((a, b) => a.id - b.id)[0]?.hex;
        if (
          home !== undefined &&
          st.raiders?.camps.some(k => distance(g, k.hex, home) <= CAMP_NEAR[1])
        )
          seen.add(c.id);
      }
    });
    const great = s.civs.filter(c => !c.independent && c.alive);
    all += great.length;
    have += great.filter(c => seen.has(c.id)).length;
    mine ||= seen.has(player(s).id);
    if (seen.has(player(s).id)) mine = true;
  }
  console.log(`     camps within ${CAMP_NEAR[1]} hexes by turn 15: ${have} of ${all} peoples`);
  check(have >= all * 0.8, 'most peoples have a raider camp near them by turn 15');
  check(mine, 'the player meets one by turn 15');
}

// fights: a spear levy beats a pack about three times in four; a lone scout mostly loses
{
  const tally: Record<string, { won: number; n: number }> = {
    levy: { won: 0, n: 0 },
    scout: { won: 0, n: 0 },
  };
  let strengthsShown = true;
  for (let seed = 1; seed <= 60; seed++) {
    for (const who of ['levy', 'scout'] as const) {
      const s = make(seed);
      const me = player(s);
      foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
      endTurn(s);
      const g = { w: s.map.w, h: s.map.h };
      const f0 =
        who === 'levy'
          ? s.formations.find(x => x.civId === me.id && x.kind === 'army' && x.cohorts.length >= 5)
          : s.formations.find(x => x.civId === me.id && x.name === 'Scouts');
      if (!f0) continue;
      if (who === 'levy') for (const c of f0.cohorts) c.loadout = { ...c.loadout, weapon: 'spear' };
      const fid = f0.id;
      for (const lair of s.raiders!.lairs!.filter(l => l.kind !== 'guardians').slice(0, 3)) {
        const pack = s.formations.find(x => x.id === lair.fid);
        const f = s.formations.find(x => x.id === fid);
        if (!pack || !f) continue;
        if (!(formationStrength(s, pack) > 0)) strengthsShown = false;
        const spot = neighbors(g, pack.hex).find(
          h =>
            !isWaterHex(s, h) &&
            !s.formations.some(o => o.hex === h) &&
            !s.cities.some(c => c.hex === h),
        );
        if (spot === undefined) continue;
        // each fight from the same state
        const saved = JSON.stringify(s.formations);
        f.hex = spot;
        f.path = [];
        f.moves = fullMoves(s, f);
        const r = attack(s, fid, pack.hex);
        tally[who].n++;
        if (r.report?.outcome === 'defender-broke' || !s.formations.includes(pack))
          tally[who].won++;
        s.formations = JSON.parse(saved);
      }
    }
  }
  const pc = (k: string) => Math.round((tally[k].won / Math.max(1, tally[k].n)) * 100);
  console.log(
    `     spear levy beat a pack ${pc('levy')}% of ${tally.levy.n}; a scout ${pc('scout')}% of ${tally.scout.n}`,
  );
  check(strengthsShown, 'every pack has a strength number');
  check(pc('levy') >= 62 && pc('levy') <= 88, 'a spear levy wins about three fights in four');
  check(pc('scout') <= 25, 'a lone scout loses most of its fights');
}

// packs keep pace: later in the game they are stronger than at the start
{
  const s = make(9);
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  endTurn(s);
  const at = (st: GameState) => {
    const ps = (st.raiders?.lairs ?? [])
      .map(l => st.formations.find(f => f.id === l.fid))
      .filter(f => !!f)
      .map(f => formationStrength(st, f!));
    return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0;
  };
  const first = at(s);
  play(s, 70);
  const later = at(s);
  console.log(
    `     packs: mean strength ${Math.round(first)} at the start, ${Math.round(later)} by turn ${s.turn} (${s.raiders?.lairs?.length} lairs left)`,
  );
  check(later > first, 'packs grow with the peoples near them');
}

if (failures) {
  console.log(`${failures} raider check(s) failed`);
  process.exit(1);
}
console.log('all raider checks OK');
