/** AI-only archipelago game: do peoples take to the sea, settle islands and invade? */
import { endTurn, foundCity, newGame } from '../src/engine/game.ts';
const seed = Number(process.argv[2] ?? 3),
  turns = Number(process.argv[3] ?? 200);
const s = newGame({
  map: {
    type: 'archipelago',
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
const t0 = performance.now();
for (let t = 1; t <= turns; t++) {
  endTurn(s);
  if (t % 50 === 0) {
    console.log(`-- turn ${s.turn} (${((performance.now() - t0) / t).toFixed(0)} ms/turn)`);
    for (const c of s.civs.filter(x => x.alive && !x.isPlayer)) {
      const fl = s.formations.filter(f => f.civId === c.id && f.kind === 'fleet');
      console.log(
        `${c.name.padEnd(9)} cities ${s.cities.filter(x => x.civId === c.id).length} fleets ${fl.length} (${fl.map(f => f.cohorts.length).join(',')}) aboard ${s.formations.filter(f => f.civId === c.id && f.aboard !== undefined).length} sea ${c.sea ? c.sea.stage : '-'} techs ${c.techs.includes('sailing') ? 'sail' : ''}${c.techs.includes('navigation') ? '+nav' : ''}`,
      );
    }
  }
}
console.log(
  s.log
    .filter(e => /launched|founded|captured|Battle/.test(e.text))
    .slice(-14)
    .map(e => `${e.turn}: ${e.text}`)
    .join('\n'),
);
