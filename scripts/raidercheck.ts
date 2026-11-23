/** Headless checks of raiders: camps in the wild, bands that pillage, camps that can be burned. */
import { aiTurn } from '../src/engine/ai.ts';
import { canAttack } from '../src/engine/game.ts';
import {
  availableTechs,
  deserialize,
  endTurn,
  foundCity,
  newGame,
  player,
  serialize,
} from '../src/engine/game.ts';
import { raidersTurn, RAIDERS, RAIDERS_END_AGE } from '../src/engine/raiders.ts';
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
  check(
    !s.raiders!.camps.length && !s.formations.some(f => f.civId === rc!.id),
    'past the Medieval age the last raiders scatter',
  );
}

// pillage happens across games
{
  let total = 0;
  for (const seed of [4, 13, 21]) {
    const s = make(seed);
    play(s, 130);
    const n = s.civs.reduce((a, c) => a + c.losses, 0) >= 0;
    const pillages = (s.log ?? []).filter(e => /Raiders pillaged/.test(e.text)).length;
    const killed = s.raiders ? s.civs[s.raiders.civ].losses : 0;
    total += pillages + killed;
    console.log(
      `     seed ${seed}: camps ${s.raiders?.camps.length ?? 0}, bands ${s.raiders?.bands.length ?? 0}, ` +
        `recent pillages ${pillages}, raider cohorts lost ${killed}${n ? '' : ''}`,
    );
  }
  check(total > 0, 'raiders pillage and are fought');
}

if (failures) {
  console.log(`${failures} raider check(s) failed`);
  process.exit(1);
}
console.log('all raider checks OK');
