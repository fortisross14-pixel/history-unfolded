/**
 * Ruler balance: many seeded games with every people played by the AI, the player's ruler rotated
 * through the historical ones, so each ruler appears in several games. For each ruler: games
 * played, average rank among the great peoples, average score as a share of its game's average
 * (1.00 = average), wins. Writes a JSON of every result so several runs can be merged.
 * Usage: node --no-warnings scripts/rulerbalance.ts <out.json> <seeds a-b> [turns]
 */
import { writeFileSync } from 'node:fs';
import { RULER_BY_ID, RULERS } from '../src/data/rulers.ts';
import { aiTurn } from '../src/engine/ai.ts';
import { answerProposal } from '../src/engine/diplomacy.ts';
import { cityEconomy } from '../src/engine/economy.ts';
import { availableTechs, endTurn, newGame, player, score } from '../src/engine/game.ts';
import { aiHuntRaiders } from '../src/engine/raiders.ts';
import { aiWonderTurn } from '../src/engine/wonders.ts';

const out = process.argv[2] ?? 'rulerbalance.json';
const [a, b] = (process.argv[3] ?? '1-4').split('-').map(Number);
const turns = Number(process.argv[4] ?? 250);

interface Result {
  seed: number;
  ruler: string;
  rank: number;
  share: number;
  won: boolean;
  alive: boolean;
}
const results: Result[] = [];
for (let seed = a; seed <= b; seed++) {
  const r = RULERS[seed % RULERS.length];
  const s = newGame({
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
    playerName: '',
    turnLimit: turns,
    ruler: { id: r.id, name: r.name, face: r.face, major: r.major, minor: r.minor },
  });
  const me = player(s);
  while (!s.ended && s.turn <= turns && me.alive) {
    me.isPlayer = false;
    aiTurn(s, me);
    aiHuntRaiders(s, me);
    aiWonderTurn(s, me, c => cityEconomy(s, c).total.prod);
    me.isPlayer = true;
    if (!me.researching) me.researching = availableTechs(me)[0]?.id ?? null;
    for (const p of s.proposals.filter(x => x.to === me.id))
      answerProposal(s, p.id, p.kind === 'peace');
    endTurn(s);
  }
  const great = s.civs.filter(c => !c.independent && !c.raiders);
  const scores = great.map(c => (c.alive ? score(s, c.id) : 0));
  const mean = scores.reduce((x, y) => x + y, 0) / Math.max(1, scores.length);
  const order = [...great].sort((x, y) => score(s, y.id) - score(s, x.id));
  for (const [i, c] of great.entries()) {
    if (!c.ruler?.id) continue;
    results.push({
      seed,
      ruler: c.ruler.id,
      rank: c.alive ? order.indexOf(c) + 1 : great.length,
      share: mean ? scores[i] / mean : 0,
      won: s.ended?.winner === c.id || (!s.ended && order[0] === c),
      alive: c.alive,
    });
  }
  console.log(
    `seed ${seed} (${s.turn} turns${s.ended ? `, ${s.ended.reason} by ${s.civs[s.ended.winner]?.ruler?.name}` : ''}): ` +
      order.map(c => `${c.ruler?.name ?? c.name} ${c.alive ? score(s, c.id) : 'gone'}`).join(', '),
  );
  writeFileSync(out, JSON.stringify(results, null, 1));
}

const by: Record<string, Result[]> = {};
for (const x of results) (by[x.ruler] ??= []).push(x);
console.log('\nruler                      games  rank  share  wins');
for (const [id, xs] of Object.entries(by).sort(
  (p, q) =>
    q[1].reduce((m, x) => m + x.share, 0) / q[1].length -
    p[1].reduce((m, x) => m + x.share, 0) / p[1].length,
)) {
  const avg = (f: (x: Result) => number) => xs.reduce((m, x) => m + f(x), 0) / xs.length;
  console.log(
    `${RULER_BY_ID[id].name.padEnd(26)} ${String(xs.length).padStart(5)} ${avg(x => x.rank)
      .toFixed(1)
      .padStart(5)} ${avg(x => x.share)
      .toFixed(2)
      .padStart(6)} ${String(xs.filter(x => x.won).length).padStart(5)}`,
  );
}
