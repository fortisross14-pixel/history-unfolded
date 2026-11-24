/** Prints research and culture pace for AI peoples (techs known, science/turn, culture choices). */
import { endTurn, foundCity, newGame } from '../src/engine/game.ts';
import { cityEconomy } from '../src/engine/economy.ts';
import { identity } from '../src/engine/mods.ts';
const seed = Number(process.argv[2] ?? 1),
  turns = Number(process.argv[3] ?? 300);
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
foundCity(s, s.formations.find(f => f.civId === 0 && f.kind === 'settlers')!.id);
for (let t = 1; t <= turns; t++) {
  endTurn(s);
  if (t % 50 === 0) {
    console.log(`-- turn ${s.turn}`);
    for (const c of s.civs.filter(x => x.alive && !x.isPlayer)) {
      const cs = s.cities.filter(x => x.civId === c.id);
      const sci = cs.reduce((a, x) => a + cityEconomy(s, x).total.science, 0);
      const cul = cs.reduce((a, x) => a + cityEconomy(s, x).total.culture, 0);
      const pop = cs.reduce((a, x) => a + x.pop, 0);
      const id = identity(c)
        .slice(0, 3)
        .map(i => `${i.tag}${i.count}`)
        .join(' ');
      const tome = c.culture.tome;
      console.log(
        `${c.name.padEnd(9)} towns ${cs.filter(x => x.tier === 'town').length} cities ${cs.filter(x => x.tier === 'city').length}${cs.some(x => x.tier === 'metropolis') ? '+M' : ''} pop ${(pop / 1000).toFixed(0)}k techs ${c.techs.length} sci ${sci.toFixed(0)}/t culture ${c.culture.taken.length} kept ${(c.culture.history ?? []).filter(h => h.major === 'won').length + (tome?.major === 'bought' ? 1 : 0)} majors ${cul.toFixed(0)}/t  [${id}] tome ${tome ? `${tome.domain} ${tome.done.length}/${tome.taken.length}` : '-'}`,
      );
    }
  }
}
console.log(
  s.log
    .filter(e => /Tome|crisis|win the/i.test(e.text))
    .slice(-8)
    .map(e => `${e.turn}: ${e.text}`)
    .join('\n'),
);
