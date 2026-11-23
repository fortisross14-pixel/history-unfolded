/**
 * The balance matrix: every difficulty × several seeds × two game lengths, with the player's
 * people played by the AI (research chosen for it). Logs how each game ends (who, how, when),
 * where the player's people finish, how strong rivals get, stalls (long stretches where the
 * world's score stands still) and turn time. Writes a JSON summary next to the log.
 * Usage: node --no-warnings scripts/matrix.ts [out.json] [seeds,comma] [lengths,comma]
 */
import { writeFileSync } from 'node:fs';
import { aiTurn } from '../src/engine/ai.ts';
import { aiHuntRaiders } from '../src/engine/raiders.ts';
import { aiWonderTurn } from '../src/engine/wonders.ts';
import { cityEconomy } from '../src/engine/economy.ts';
import { DIFFICULTY_ORDER, type Difficulty } from '../src/engine/difficulty.ts';
import { availableTechs, endTurn, newGame, player, score } from '../src/engine/game.ts';
import { ageOf } from '../src/data/techs.ts';
import type { GameState } from '../src/engine/types.ts';

const out = process.argv[2] ?? 'matrix.json';
const seeds = (process.argv[3] ?? '11,29,47').split(',').map(Number);
const lengths = (process.argv[4] ?? '200,400').split(',').map(Number);

interface Row {
  difficulty: Difficulty;
  seed: number;
  length: number;
  ended: string;
  winner: string;
  endTurn: number;
  playerRank: number;
  playerScore: number;
  rivalAvg: number;
  rivalBest: number;
  topAge: number;
  wars: number;
  captures: number;
  pillages: number;
  ruinsLeft: number;
  faiths: number;
  wonders: number;
  longestStall: number;
  msAvg: number;
  msWorst: number;
}
const rows: Row[] = [];

for (const length of lengths)
  for (const seed of seeds)
    for (const difficulty of DIFFICULTY_ORDER) {
      const s: GameState = newGame({
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
        playerName: 'Player',
        turnLimit: length,
        difficulty,
      });
      const me = player(s);
      let wars = 0,
        captures = 0,
        pillages = 0,
        stall = 0,
        longestStall = 0,
        lastWorld = 0,
        total = 0,
        worst = 0,
        n = 0;
      while (!s.ended && s.turn <= length) {
        if (me.alive) {
          me.isPlayer = false;
          aiTurn(s, me);
          // what the turn does for AI peoples beyond aiTurn: hunt raiders, build wonders
          aiHuntRaiders(s, me);
          aiWonderTurn(s, me, c => cityEconomy(s, c).total.prod);
          me.isPlayer = true;
          if (!me.researching) me.researching = availableTechs(me)[0]?.id ?? null;
          // the player answers its own pending choices like the AI would: first option
        }
        const t0 = performance.now();
        endTurn(s);
        const ms = performance.now() - t0;
        total += ms;
        worst = Math.max(worst, ms);
        n++;
        for (const e of s.log.filter(x => x.turn === s.turn - 1)) {
          if (/declared war on/.test(e.text)) wars++;
          if (/captured .* from/.test(e.text)) captures++;
          if (/Raiders pillaged/.test(e.text)) pillages++;
        }
        const world = s.civs
          .filter(c => c.alive && !c.independent)
          .reduce((a, c) => a + score(s, c.id), 0);
        if (world <= lastWorld) stall++;
        else stall = 0;
        longestStall = Math.max(longestStall, stall);
        lastWorld = world;
        if (!me.alive && !s.ended) break;
      }
      const great = s.civs.filter(c => !c.independent && !c.raiders);
      const ranked = great.filter(c => c.alive).sort((a, b) => score(s, b.id) - score(s, a.id));
      const rivals = great.filter(c => c.alive && !c.isPlayer);
      const row: Row = {
        difficulty,
        seed,
        length,
        ended: s.ended?.reason ?? (me.alive ? 'limit' : 'player-gone'),
        winner: s.ended ? (s.civs[s.ended.winner]?.name ?? '-') : '-',
        endTurn: s.turn,
        playerRank: me.alive ? ranked.indexOf(me) + 1 : 0,
        playerScore: me.alive ? score(s, me.id) : 0,
        rivalAvg: Math.round(
          rivals.reduce((a, c) => a + score(s, c.id), 0) / Math.max(1, rivals.length),
        ),
        rivalBest: Math.max(0, ...rivals.map(c => score(s, c.id))),
        topAge: Math.max(...great.map(c => ageOf(c.techs))),
        wars,
        captures,
        pillages,
        ruinsLeft: s.ruins?.length ?? 0,
        faiths: s.faiths?.length ?? 0,
        wonders: s.wonders?.length ?? 0,
        longestStall,
        msAvg: Math.round(total / Math.max(1, n)),
        msWorst: Math.round(worst),
      };
      rows.push(row);
      console.log(JSON.stringify(row));
      writeFileSync(out, JSON.stringify(rows, null, 1));
    }

// summary by difficulty
for (const d of DIFFICULTY_ORDER) {
  const r = rows.filter(x => x.difficulty === d);
  const avg = (k: keyof Row) =>
    Math.round(r.reduce((a, x) => a + (x[k] as number), 0) / Math.max(1, r.length));
  console.log(
    `${d}: rival avg ${avg('rivalAvg')}, player rank ${avg('playerRank')}, wars ${avg('wars')}, captures ${avg('captures')}, pillages ${avg('pillages')}, endings ${r.map(x => x.ended).join('/')}`,
  );
}
