/** Checks opinion and memories, deals, pacts, alliances, trade flows, demands and victory. */
import {
  allied,
  answerProposal,
  capitalOf,
  evaluateOffer,
  hasPact,
  newProposal,
  opinion,
  opinionParts,
  proposeDeal,
  remember,
} from '../src/engine/diplomacy.ts';
import {
  atWar,
  checkVictory,
  declareWar,
  endTurn,
  foundCity,
  newGame,
  player,
  score,
} from '../src/engine/game.ts';

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
    seed: 11,
  },
  civCount: 4,
  playerName: 'Test',
});
const me = player(s);
foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
for (const c of s.civs)
  for (const o of s.civs) if (c !== o && !c.met.includes(o.id)) c.met.push(o.id);
const [a, b, c] = s.civs.filter(x => !x.isPlayer);

// ---- opinion and memory
const before = opinion(s, a.id, me.id);
remember(s, a.id, me.id, 'gift', 'Generous dealings', 30, 1);
check(
  opinion(s, a.id, me.id) === Math.min(100, before + 30),
  `a gift raises opinion (${before} → ${opinion(s, a.id, me.id)})`,
);
check(
  opinionParts(s, a.id, me.id).some(p => p.label === 'Generous dealings'),
  'and shows up as a reason',
);
endTurn(s);
check(opinion(s, a.id, me.id) < before + 30, 'memories fade');

// ---- a pact needs some trust; then breaking it is remembered by everyone
remember(s, a.id, me.id, 'friend', 'Old friends', 40, 0);
const pact = proposeDeal(s, me.id, a.id, { give: {}, get: {}, pact: true });
check(pact.ok && hasPact(s, me.id, a.id), 'non-aggression pact agreed: ' + pact.msg);
const cBefore = opinion(s, c.id, me.id);
declareWar(s, me.id, a.id);
check(atWar(s, me.id, a.id) && !hasPact(s, me.id, a.id), 'war breaks the pact');
check(opinion(s, c.id, me.id) < cBefore, 'third parties remember the treachery');
check(
  opinionParts(s, a.id, me.id).some(p => p.label === 'Declared war on us'),
  'the victim remembers who started it',
);

// ---- peace: refused at first, accepted once the war has dragged on
const early = proposeDeal(s, me.id, a.id, { give: {}, get: {}, peace: true });
check(!early.ok, 'peace refused straight away: ' + early.msg);
s.wars.find(w => w.a === me.id && w.b === a.id)!.since -= 30;
const later = proposeDeal(s, me.id, a.id, { give: { gold: me.gold }, get: {}, peace: true });
check(later.ok && !atWar(s, me.id, a.id), 'peace after a long war: ' + later.msg);

// ---- alliances: allies join a war against their partner
remember(s, b.id, c.id, 'friend', 'Old friends', 80, 0);
remember(s, c.id, b.id, 'friend', 'Old friends', 80, 0);
const al = proposeDeal(s, b.id, c.id, { give: {}, get: {}, alliance: true });
check(al.ok && allied(s, b.id, c.id), 'two AI peoples ally');
declareWar(s, a.id, b.id);
check(atWar(s, a.id, c.id), 'the ally joins the war against the aggressor');

// ---- trade: goods flow every turn while both can pay
const capMe = capitalOf(s, me.id)!,
  capB = capitalOf(s, b.id)!;
capMe.stockpile.wood = 100;
capB.stockpile.stone = 100;
remember(s, b.id, me.id, 'friend', 'Old friends', 30, 0);
const offer = {
  give: { goodsPerTurn: { wood: 2 } },
  get: { goodsPerTurn: { stone: 1 } },
  turns: 10,
};
const ev = evaluateOffer(s, me.id, b.id, offer);
const deal = proposeDeal(s, me.id, b.id, offer);
check(deal.ok || !ev.accept, `trade offer evaluated (${ev.reason})`);
if (deal.ok) {
  const stone0 = capMe.stockpile.stone ?? 0;
  endTurn(s);
  check((capMe.stockpile.stone ?? 0) >= stone0 + 1, 'stone arrives each turn');
}
check(
  !proposeDeal(s, me.id, b.id, { give: { gold: 999999 }, get: {} }).ok,
  'cannot offer what you do not have',
);

// ---- demands: refusing is remembered
const dem = newProposal(s, {
  from: c.id,
  to: me.id,
  kind: 'demand',
  offer: { give: {}, get: { gold: 1 } },
  text: 'Pay up',
});
const op0 = opinion(s, c.id, me.id);
answerProposal(s, dem.id, false);
check(opinion(s, c.id, me.id) < op0, 'refusing a demand angers them');

// ---- score and victory
check(score(s, me.id) > 0, `score ${score(s, me.id)}`);
for (const o of s.civs) if (!o.isPlayer) o.alive = false;
checkVictory(s);
check(s.ended?.reason === 'conquest' && s.ended.winner === me.id, 'last people standing wins');

console.log(failures ? `${failures} failures` : 'all diplomacy checks passed');
process.exit(failures ? 1 : 0);
