/** Headless checks of readable AI: personalities, intent with reasons, warnings before an attack. */
import { personalityOf } from '../src/data/leaders.ts';
import { aiTurn, intentToward, WAR_WARNING } from '../src/engine/ai.ts';
import { opinionParts } from '../src/engine/diplomacy.ts';
import {
  availableTechs,
  deserialize,
  endTurn,
  newGame,
  player,
  serialize,
} from '../src/engine/game.ts';
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
    playerName: 'Testers',
  });

{
  const s = make(7);
  const me = player(s);
  check(personalityOf(s.settings.map.seed, me) === null, 'the player has no AI personality');
  const ai = s.civs.filter(c => !c.isPlayer && !c.independent);
  check(
    ai.every(c => personalityOf(s.settings.map.seed, c) !== null),
    'every AI people has a personality',
  );
  check(
    ai.every(
      c => personalityOf(s.settings.map.seed, c)!.id === personalityOf(s.settings.map.seed, c)!.id,
    ),
    'personalities are fixed for the game',
  );
  check(
    s.civs.filter(c => c.independent).every(c => personalityOf(s.settings.map.seed, c) === null),
    'free peoples have none',
  );
  const builder = ai.find(c => personalityOf(s.settings.map.seed, c)!.id === 'builder');
  if (builder)
    check(
      opinionParts(s, builder.id, me.id).some(p => /Builder/.test(p.label)),
      'a personality shows among the reasons for an opinion',
    );
  const i = intentToward(s, ai[0].id, me.id);
  check(i.level === 'low' && i.reasons.some(r => /before turn/.test(r)), `early: ${i.label}`);
}

// long games: every AI war on the player is announced first, and personalities matter
const wars: Record<string, { peoples: number; wars: number }> = {};
let announced = 0,
  unannounced = 0,
  massings = 0,
  stoodDown = 0;
for (const seed of [5, 19, 33]) {
  const s = make(seed);
  const me = player(s);
  for (const c of s.civs) {
    const p = personalityOf(s.settings.map.seed, c);
    if (!p) continue;
    wars[p.id] ??= { peoples: 0, wars: 0 };
    wars[p.id].peoples++;
  }
  const warned = new Map<number, number>();
  for (let t = 0; t < 260; t++) {
    me.isPlayer = false;
    aiTurn(s, me);
    me.isPlayer = true;
    if (!me.researching) me.researching = availableTechs(me)[0]?.id ?? null;
    endTurn(s);
    for (const e of s.log.filter(x => x.turn === s.turn - 1)) {
      if (/are massing troops on the Testers border/.test(e.text)) {
        massings++;
        warned.set(e.civId, e.turn);
      }
      if (/stand down/.test(e.text)) stoodDown++;
      const m = /declared war on the ([^,!]+)/.exec(e.text);
      if (m) {
        const p = personalityOf(s.settings.map.seed, s.civs[e.civId]);
        if (p) wars[p.id].wars++;
        if (m[1].startsWith('Testers')) {
          const w = warned.get(e.civId);
          if (w !== undefined && e.turn - w >= WAR_WARNING.normal) announced++;
          else unannounced++;
        }
      }
    }
  }
  const back = deserialize(serialize(s));
  check(back.civs.length === s.civs.length, `seed ${seed}: a save keeps the plans`);
}
console.log(
  `     massings ${massings}, stood down ${stoodDown}; wars on the player announced ${announced}, not ${unannounced}`,
);
console.log(
  '     wars per people: ' +
    Object.entries(wars)
      .map(([k, v]) => `${k} ${(v.wars / Math.max(1, v.peoples)).toFixed(1)} (${v.peoples})`)
      .join(', '),
);
check(massings > 0, 'AI peoples announce wars on the player');
check(unannounced === 0, 'no AI people attacks the player without warning');
const rate = (k: string) => (wars[k] ? wars[k].wars / Math.max(1, wars[k].peoples) : 0);
if (wars.conqueror && wars.builder)
  check(rate('conqueror') >= rate('builder'), 'conquerors start more wars than builders');

if (failures) {
  console.log(`${failures} leader check(s) failed`);
  process.exit(1);
}
console.log('all leader checks OK');
