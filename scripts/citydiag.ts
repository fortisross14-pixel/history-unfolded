/** Prints one AI capital's districts and economy every 20 turns. */
import { endTurn, foundCity, newGame } from '../src/engine/game.ts';
import { cityDistricts, cityEconomy, constructionQueue } from '../src/engine/economy.ts';
const seed = Number(process.argv[2] ?? 1),
  turns = Number(process.argv[3] ?? 100),
  civ = Number(process.argv[4] ?? 1);
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
  if (t % 20 === 0) {
    const c = s.cities.find(x => x.civId === civ)!;
    const e = cityEconomy(s, c);
    const r = (n: number) => Math.round(n * 10) / 10;
    console.log(
      `-- turn ${s.turn} ${c.name} pop ${c.pop}/${e.total.housing} workers ${e.workersUsed}/${e.workers} food ${r(e.total.food)}-${e.eat} prod ${r(e.total.prod)} sci ${e.total.science} gold ${e.total.gold} goods ${JSON.stringify(e.total.goods)} inputs ${JSON.stringify(e.inputs)} queue ${constructionQueue(s, c).length}`,
    );
    console.log('   store', JSON.stringify(c.stockpile));
    for (const d of cityDistricts(s, c)) {
      const rep = e.slots.get(d.id)!;
      console.log(
        `   ${d.name.padEnd(22)} ${d.slots.map((x, i) => (x.type ? `${x.type}${x.built ? (rep[i].staffed ? '' : '(idle:' + (rep[i].idle ?? rep[i].problem) + ')') : '(todo)'}` : '-')).join(' ')}`,
      );
    }
  }
}
