/** Runs AI-only games and prints how each people is doing every N turns. */
import { endTurn, newGame } from '../src/engine/game.ts';
const seed = Number(process.argv[2] ?? 1),
  turns = Number(process.argv[3] ?? 150);
const s = newGame({
  map: {
    type: 'pangaea',
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
// the "player" founds its city and then idles
const st = s.formations.find(f => f.civId === 0 && f.kind === 'settlers')!;
import('../src/engine/game.ts').then(({ foundCity }) => {
  foundCity(s, st.id);
  for (let t = 1; t <= turns; t++) {
    endTurn(s);
    if (t % 30 === 0) {
      console.log(`-- turn ${s.turn}`);
      for (const c of s.civs) {
        const cities = s.cities.filter(x => x.civId === c.id);
        const fs = s.formations.filter(f => f.civId === c.id);
        const coh = fs.flatMap(f => f.cohorts);
        console.log(
          `${c.name.padEnd(9)} alive=${c.alive} cities=${cities.length} pop=${cities.map(x => x.pop).join(',')} forms=${fs.length} (${fs.map(f => f.kind[0] + f.cohorts.length).join(' ')}) equipped=${coh.filter(x => x.designId !== null).length}/${coh.length} techs=${c.techs.length} store=${JSON.stringify(cities[0]?.stockpile)}`,
        );
      }
    }
  }
  console.log(
    s.log
      .filter(e => /war|Battle|captured|no more|founded/.test(e.text))
      .slice(-25)
      .map(e => `${e.turn}: ${e.text}`)
      .join('\n'),
  );
});
