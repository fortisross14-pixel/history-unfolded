/**
 * Three ways to play, each needing a credible path: the player's settlements handed to governors
 * under a war, a growth (builder) and a trade priority, 400 turns on the same maps. Logs where
 * each finishes; each should reach the top two in at least one game, or win.
 * Usage: node --no-warnings scripts/buildscheck.ts [seeds]
 */
import { aiTurn } from '../src/engine/ai.ts';
import { cityEconomy } from '../src/engine/economy.ts';
import {
  availableTechs,
  endTurn,
  newGame,
  player,
  score,
  setPriority,
} from '../src/engine/game.ts';
import { aiHuntRaiders } from '../src/engine/raiders.ts';
import { aiWonderTurn } from '../src/engine/wonders.ts';

const seeds = (process.argv[2] ?? '29,47').split(',').map(Number);
let failures = 0;
const best: Record<string, number> = {};
for (const style of ['war', 'growth', 'trade'] as const)
  for (const seed of seeds) {
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
      playerName: 'Player',
      turnLimit: 400,
    });
    const me = player(s);
    setPriority(s, me.id, style);
    while (!s.ended && s.turn <= 400 && me.alive) {
      me.isPlayer = false;
      aiTurn(s, me);
      aiHuntRaiders(s, me);
      aiWonderTurn(s, me, c => cityEconomy(s, c).total.prod);
      me.isPlayer = true;
      // the player plays through governors: every settlement follows the priority
      for (const c of s.cities) if (c.civId === me.id) c.auto = true;
      if (!me.researching) me.researching = availableTechs(me)[0]?.id ?? null;
      endTurn(s);
    }
    const ranked = s.civs
      .filter(c => c.alive && !c.independent)
      .sort((a, b) => score(s, b.id) - score(s, a.id));
    const rank = me.alive ? ranked.indexOf(me) + 1 : 99;
    const won = s.ended?.winner === me.id;
    best[style] = Math.min(best[style] ?? 99, won ? 0 : rank);
    console.log(
      `     ${style}, seed ${seed}: ${won ? `won (${s.ended!.reason})` : `rank ${rank}`} at turn ${s.turn}, ` +
        `${s.cities.filter(c => c.civId === me.id).length} settlements, score ${me.alive ? score(s, me.id) : 0}` +
        (s.ended && !won ? `; ${s.civs[s.ended.winner]?.name ?? '-'} won (${s.ended.reason})` : ''),
    );
  }
for (const [style, r] of Object.entries(best)) {
  const ok = r <= 2;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${style}: best ${r === 0 ? 'a win' : `rank ${r}`}`);
}
if (failures) process.exit(1);
console.log('all three builds have a credible path');
