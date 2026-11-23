/**
 * Pacing: in seeded games, how long does the player go without a moment that matters? A moment
 * is an event to decide, an age card, a direction or tenet to choose, a crisis, an offer or a
 * war, a raid or a ruin, a settlement founded or grown, a wonder or faith news. Per age: how
 * soon after entering it the first moment comes, and the longest quiet stretch.
 * Usage: node --no-warnings scripts/pacecheck.ts [turns] [seeds]
 */
import { ageOf } from '../src/data/techs.ts';
import { aiTurn } from '../src/engine/ai.ts';
import { tenetDue } from '../src/engine/faith.ts';
import { availableTechs, endTurn, newGame, player } from '../src/engine/game.ts';
import { pendingRealmEvent, resolveRealmEvent } from '../src/engine/realmEvents.ts';

const turns = Number(process.argv[2] ?? 260);
const seeds = (process.argv[3] ?? '11,29').split(',').map(Number);
let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};

const MOMENT =
  /declared war|made peace|captured|pillaged|massing troops|strikes the|searched .* and found|founded|grew from|complete the|found a new faith|now keep|tenet|enter the|take a new direction|chapter \d/;

let worstFirst = 0,
  worstQuiet = 0;
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
  });
  const me = player(s);
  const ages: { age: number; from: number; first: number | null; quiet: number; last: number }[] =
    [];
  let age = 1;
  let waiting = 'false||';
  ages.push({ age: 1, from: 1, first: null, quiet: 0, last: 1 });
  for (let t = 0; t < turns && me.alive && !s.ended; t++) {
    me.isPlayer = false;
    aiTurn(s, me);
    me.isPlayer = true;
    if (!me.researching) me.researching = availableTechs(me)[0]?.id ?? null;
    const turn = s.turn;
    // decisions waiting for the player this turn
    let moment = false;
    if (pendingRealmEvent(s, me)) {
      moment = true;
      resolveRealmEvent(s, me, 0);
    }
    // a standing choice counts on the turn it appears, not every turn it waits
    const now = `${!!me.pathDue}|${me.crisis?.id ?? ''}|${tenetDue(s, me.id) ?? ''}`;
    if (s.ageCard || (now !== waiting && now !== 'false||')) moment = true;
    waiting = now;
    if (s.proposals.some(p => p.to === me.id)) moment = true;
    s.ageCard = undefined;
    s.proposals = s.proposals.filter(p => p.to !== me.id);
    endTurn(s);
    if (
      s.log.some(
        e =>
          e.turn === turn && (e.civId === me.id || e.text.includes(me.name)) && MOMENT.test(e.text),
      )
    )
      moment = true;
    const a = ageOf(me.techs);
    if (a > age) {
      age = a;
      ages.push({ age, from: turn, first: null, quiet: 0, last: turn });
    }
    const cur = ages[ages.length - 1];
    if (moment) {
      if (cur.first === null) cur.first = turn - cur.from;
      cur.quiet = Math.max(cur.quiet, turn - cur.last - 1);
      cur.last = turn;
    }
  }
  const cur = ages[ages.length - 1];
  cur.quiet = Math.max(cur.quiet, s.turn - cur.last - 1);
  for (const a of ages) {
    console.log(
      `     seed ${seed}, age ${a.age} from turn ${a.from}: first moment after ${a.first ?? '—'} turns, longest quiet ${a.quiet} turns`,
    );
    if (a.first !== null) worstFirst = Math.max(worstFirst, a.first);
    worstQuiet = Math.max(worstQuiet, a.quiet);
  }
}
check(worstFirst <= 5, `the first moment of an age comes within 5 turns (worst ${worstFirst})`);
check(worstQuiet < 10, `no age goes 10 turns without a moment (worst ${worstQuiet})`);
if (failures) {
  console.log(`${failures} pacing check(s) failed`);
  process.exit(1);
}
console.log('all pacing checks OK');
