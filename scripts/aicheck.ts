/**
 * AI behaviour checks over several AI-only games: wars lead to battles, campaigns commit instead
 * of flip-flopping, nobody is left stranded aboard ships, cities change hands.
 * Usage: node --no-warnings scripts/aicheck.ts [turns]
 */
import { aiTrace } from '../src/engine/ai.ts';
import { endTurn, foundCity, newGame } from '../src/engine/game.ts';
import type { MapType } from '../src/engine/types.ts';

const turns = Number(process.argv[2] ?? 220);
let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};

const games: [MapType, number][] = [
  ['pangaea', 1],
  ['continents', 2],
  ['pangaea', 7],
  ['archipelago', 3],
  ['archipelago', 8],
];
let warTurns = 0,
  battles = 0,
  captures = 0,
  flips = 0,
  campaigns = 0,
  strandedMax = 0,
  landings = 0;
for (const [type, seed] of games) {
  const s = newGame({
    map: {
      type,
      size: 'standard',
      seaLevel: 'normal',
      climate: 'normal',
      rainfall: 'normal',
      resources: 'normal',
      mountains: 'normal',
      seed,
    },
    civCount: 6,
    playerName: '',
  });
  foundCity(s, s.formations.find(f => f.civId === 0 && f.kind === 'settlers')!.id);
  const aboardSince = new Map<number, number>();
  const tr: ReturnType<typeof aiTrace> = [];
  for (let t = 0; t < turns; t++) {
    aiTrace().length = 0;
    endTurn(s);
    tr.push(...aiTrace());
    warTurns += s.wars.length;
    for (const f of s.formations) {
      if (f.aboard === undefined) aboardSince.delete(f.id);
      else if (!aboardSince.has(f.id)) aboardSince.set(f.id, s.turn);
      else if (s.civs[f.civId].sea?.cargo !== f.id)
        strandedMax = Math.max(strandedMax, s.turn - aboardSince.get(f.id)!);
    }
  }
  const b = s.log.filter(e => e.text.startsWith('Battle')).length;
  const cap = s.log.filter(e => e.text.includes(' captured ')).length;
  const land = tr.filter(e => e.msg.startsWith('landed')).length;
  // a flip: going back to gathering within 3 turns of starting to march
  const perCiv = new Map<number, { turn: number; msg: string }[]>();
  for (const e of tr) perCiv.set(e.civ, [...(perCiv.get(e.civ) ?? []), e]);
  let f = 0;
  for (const list of perCiv.values())
    for (let i = 1; i < list.length; i++)
      if (
        list[i].msg.startsWith('gather') &&
        list[i - 1].msg.startsWith('march') &&
        list[i].turn - list[i - 1].turn < 3
      )
        f++;
  const camps = tr.filter(e => e.msg.startsWith('campaign')).length;
  battles += b;
  captures += cap;
  flips += f;
  campaigns += camps;
  landings += land;
  console.log(
    `     ${type} ${seed}: wars ${s.log.filter(e => e.text.includes('declared war')).length}, campaigns ${camps}, battles ${b}, captures ${cap}, landings ${land}, quick flips ${f}`,
  );
}
check(
  battles >= warTurns / 60,
  `wars lead to fighting: ${battles} battles over ${warTurns} war-turns`,
);
check(captures >= 2, `cities change hands: ${captures}`);
check(
  flips <= campaigns * 0.2,
  `campaigns commit: ${flips} quick march→gather flips in ${campaigns} campaigns`,
);
check(
  strandedMax <= 15,
  `nobody stranded aboard ships (longest ${strandedMax} turns without a crossing)`,
);
console.log(`     sea landings: ${landings}`);
console.log(failures ? `${failures} failures` : 'all AI checks passed');
process.exit(failures ? 1 : 0);
