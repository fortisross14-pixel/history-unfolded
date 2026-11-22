/** Checks free peoples (gifts, alliance, tribute, absorbing, conquest) and history events. */
import { allied, opinion, proposeDeal } from '../src/engine/diplomacy.ts';
import { EVENTS, HISTORY_EVENTS, resolveEvent } from '../src/engine/events.ts';
import {
  absorb,
  absorbCost,
  absorbProblem,
  ABSORB_ALLIED_TURNS,
  giveGift,
  standing,
  tributeTo,
} from '../src/engine/independents.ts';
import { checkVictory, endTurn, foundCity, newGame, player } from '../src/engine/game.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};

const s = newGame({
  map: {
    type: 'pangaea',
    size: 'small',
    seaLevel: 'normal',
    climate: 'normal',
    rainfall: 'normal',
    resources: 'normal',
    mountains: 'normal',
    seed: 7,
  },
  civCount: 4,
  playerName: 'Test',
});
const me = player(s);
foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
const free = s.civs.filter(c => c.independent);
check(free.length >= 3, `free peoples on a small map (${free.length})`);
const f = free[0];
me.met.push(f.id);
f.met.push(me.id);
const fCity = s.cities.find(c => c.civId === f.id)!;
check(
  fCity && s.formations.some(x => x.civId === f.id && x.hex === fCity.hex),
  'free city has a garrison',
);

// ---- befriending with gifts
me.gold = 1000;
const before = opinion(s, f.id, me.id);
check(giveGift(s, me.id, f.id, 50).ok, 'gift accepted');
check(
  opinion(s, f.id, me.id) > before + 20,
  `gift wins them over (${before} → ${opinion(s, f.id, me.id)})`,
);
check(
  standing(s, f.id, me.id) === 'Friends',
  `friends after the gift (${standing(s, f.id, me.id)})`,
);
check(tributeTo(s, f.id, me.id).gold === 1, 'friends send a little gold');

// ---- alliance and exclusivity
giveGift(s, me.id, f.id, 50);
const r = proposeDeal(s, me.id, f.id, { give: {}, get: {}, alliance: true });
check(r.ok && allied(s, me.id, f.id), `alliance sworn: ${r.msg}`);
const rival = s.civs.find(c => !c.isPlayer && !c.independent)!;
rival.met.push(f.id);
f.met.push(rival.id);
s.civs[rival.id].gold = 1000;
giveGift(s, rival.id, f.id, 100);
const r2 = proposeDeal(s, rival.id, f.id, { give: {}, get: {}, alliance: true });
check(!r2.ok, `a free people swears to one people only: ${r2.msg}`);
const t = tributeTo(s, f.id, me.id);
check(t.gold === 3 && Object.values(t.goods)[0] === 2, 'allies send gold and their goods');
const goldBefore = me.gold;
const ev = endTurn(s);
void ev;
check(me.gold >= goldBefore + 3 - 5, 'tribute arrives each turn');

// ---- absorbing
check(absorbProblem(s, me.id, f.id)?.includes('too young'), 'cannot absorb a young alliance');
s.turn += ABSORB_ALLIED_TURNS;
giveGift(s, me.id, f.id, 100);
const cost = absorbCost(s, f.id);
check(cost >= 150, `absorbing costs gold (${cost})`);
const popBefore = fCity.pop;
const ab = absorb(s, me.id, f.id);
check(ab.ok, `absorb: ${ab.msg}`);
check(fCity.civId === me.id && !f.alive, 'their city is ours, the free people gone');
check(fCity.pop < popBefore, 'some people leave rather than be ruled');
const other = free[1];
check(
  s.memories.some(m => m.to === other.id && m.about === me.id && m.kind === 'swallowed'),
  'other free peoples remember it',
);
checkVictory(s);
check(!s.ended, 'free peoples do not count for conquest victory');

// ---- events
check(HISTORY_EVENTS.length >= 15, `${HISTORY_EVENTS.length} history events`);
check(
  HISTORY_EVENTS.every(e => e.choices.length >= 2 && EVENTS[e.id] === e),
  'every event has at least two choices',
);
const myCity = s.cities.find(c => c.civId === me.id)!;
s.events.push({ id: 9999, eventId: 'harvest', civId: me.id, turn: s.turn, cityId: myCity.id });
const food = myCity.food;
const res = resolveEvent(s, 9999, 0);
check(res.ok && myCity.food === food + 40, `event choice applies: ${res.msg}`);
check(!s.events.some(e => e.id === 9999), 'answered event is gone');
me.gold = 0;
s.events.push({ id: 9998, eventId: 'scholars', civId: me.id, turn: s.turn, cityId: myCity.id });
check(!resolveEvent(s, 9998, 0).ok, 'a choice you cannot afford is refused');

// ---- a long game: events happen, free peoples live their lives
let happened = 0;
for (let i = 0; i < 120; i++) {
  const seen = JSON.stringify(s.lastEvent);
  endTurn(s);
  if (JSON.stringify(s.lastEvent) !== seen) happened++;
  // answer the player's events like a lazy player would
  for (const p of s.events.filter(e => e.civId === me.id)) resolveEvent(s, p.id, 1);
}
check(happened >= 15, `turns with history events, of 120: ${happened}`);
const aiFreeDeals = s.treaties.filter(
  t => t.kind === 'alliance' && (s.civs[t.a].independent || s.civs[t.b].independent),
).length;
console.log(
  `     free peoples after ${s.turn} turns: ${s.civs.filter(c => c.independent && c.alive).length} free, ${aiFreeDeals} alliances, ${s.log.filter(e => e.text.includes('have joined the')).length} absorbed`,
);

console.log(failures ? `${failures} failures` : 'all free-people and event checks OK');
process.exit(failures ? 1 : 0);
