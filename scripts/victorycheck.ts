/** Headless checks of the five victories: when they open, what they ask, holding and warnings. */
import { AGE_GATE, TECH_LIST } from '../src/data/techs.ts';
import { checkVictory, foundCity, newGame, player } from '../src/engine/game.ts';
import type { GameState } from '../src/engine/types.ts';
import { HOLD, isOpen, progress, VICTORY, VICTORIES } from '../src/engine/victory.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};

const fresh = (): GameState =>
  newGame({
    map: {
      type: 'continents',
      size: 'small',
      seaLevel: 'normal',
      climate: 'normal',
      rainfall: 'normal',
      resources: 'normal',
      mountains: 'normal',
      seed: 5,
    },
    civCount: 4,
    playerName: 'Test',
  });
const toAge = (techs: string[], age: number) => {
  for (let a = 2; a <= age; a++) if (!techs.includes(AGE_GATE[a])) techs.push(AGE_GATE[a]);
};
const great = (s: GameState) => s.civs.filter(c => c.alive && !c.independent);

// ---- opening by age
{
  const s = fresh();
  const me = player(s);
  check(
    VICTORIES.filter(v => isOpen(me, v))
      .map(v => v.id)
      .join() === 'conquest',
    'at the start only Conquest is open',
  );
  toAge(me.techs, 4);
  check(
    isOpen(me, VICTORY.cultural) && isOpen(me, VICTORY.economic) && !isOpen(me, VICTORY.diplomatic),
    'the Renaissance opens Cultural and Economic, not yet Diplomatic',
  );
  toAge(me.techs, 5);
  check(
    isOpen(me, VICTORY.diplomatic) && isOpen(me, VICTORY.scientific),
    'the Industrial age opens Diplomatic and Scientific',
  );
}

// ---- economic dominance: half the world's GDP, held for HOLD turns, with a warning first
{
  const s = fresh();
  const me = player(s);
  const rival = great(s).find(c => !c.isPlayer)!;
  for (const c of s.civs) c.stats = { gdp: 100, culture: 10 };
  rival.stats = { gdp: 100 * s.civs.length, culture: 10 };
  check(progress(s, rival, 'economic').met, 'a people making half the world GDP meets the goal');
  const news = checkVictory(s);
  check(!s.holding?.economic, 'but not before it reaches the Renaissance');
  toAge(rival.techs, 4);
  const warn = checkVictory(s);
  check(
    s.holding?.economic?.civId === rival.id && warn.some(n => n.startsWith('Warning')),
    `once open, the hold starts and the player is warned: "${warn[0] ?? news[0] ?? ''}"`,
  );
  s.turn += HOLD - 1;
  checkVictory(s);
  check(!s.ended, `no win one turn short of ${HOLD}`);
  s.turn += 1;
  checkVictory(s);
  check(
    s.ended?.reason === 'economic' && s.ended.winner === rival.id,
    `held ${HOLD} turns, it wins Economic dominance`,
  );
  check(me.alive, 'the player is told, not eliminated');
}

// ---- a hold that slips resets
{
  const s = fresh();
  const me = player(s);
  toAge(me.techs, 4);
  for (const c of s.civs) c.stats = { gdp: 100, culture: 10 };
  me.stats = { gdp: 100, culture: 1000 };
  checkVictory(s);
  check(s.holding?.cultural?.civId === me.id, 'the player holds Cultural domination');
  s.turn += 5;
  me.stats = { gdp: 100, culture: 10 };
  checkVictory(s);
  check(!s.holding?.cultural, 'losing the share drops the hold');
}

// ---- diplomatic federation: a league with most of the world's people, led by you
{
  const s = fresh();
  const me = player(s);
  toAge(me.techs, 5);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  const others = s.civs.filter(c => c.id !== me.id && c.alive);
  for (const c of s.cities) c.pop = c.civId === me.id ? 9000 : 2000;
  for (const o of others.slice(0, Math.ceil(others.length * 0.7)))
    s.treaties.push({ kind: 'alliance', a: me.id, b: o.id, since: s.turn, until: -1 });
  const p = progress(s, me, 'diplomatic');
  check(p.met, `a large league led by the player meets the goal (${p.text})`);
}

// ---- scientific: every Industrial tech and the three projects, wins at once
{
  const s = fresh();
  const me = player(s);
  toAge(me.techs, 5);
  for (const t of TECH_LIST) if (t.era === 5 && !t.project) me.techs.push(t.id);
  check(!progress(s, me, 'scientific').met, 'all Industrial techs alone are not enough');
  for (const t of TECH_LIST) if (t.project) me.techs.push(t.id);
  checkVictory(s);
  check(
    s.ended?.reason === 'scientific' && s.ended.winner === me.id,
    'the three projects win at once',
  );
}

console.log(failures ? `${failures} failures` : 'all victory checks passed');
process.exit(failures ? 1 : 0);
