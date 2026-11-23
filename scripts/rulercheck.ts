/**
 * Rulers: rivals are different historical rulers with their nation's name, colour and settlement
 * names; each strength does what it says (moves, ignoring terrain, research and culture each age,
 * yields, upkeep); a player's own ruler takes their name, face, strengths, colour and borrowed or
 * invented names; a save keeps it all.
 */
import { RULER_BY_ID, TRAITS } from '../src/data/rulers.ts';
import { personalityOf } from '../src/data/leaders.ts';
import {
  ageGifts,
  deserialize,
  foundCity,
  fullMoves,
  newGame,
  player,
  serialize,
  stepCost,
} from '../src/engine/game.ts';
import { civMods } from '../src/engine/mods.ts';
import { neighbors } from '../src/engine/hex.ts';
import { isPassableLand } from '../src/engine/mapgen.ts';
import type { GameSettings, GameState, RulerSetup } from '../src/engine/types.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};
const make = (ruler?: RulerSetup, more: Partial<GameSettings> = {}): GameState =>
  newGame({
    map: {
      type: 'continents',
      size: 'standard',
      seaLevel: 'normal',
      climate: 'normal',
      rainfall: 'normal',
      resources: 'normal',
      mountains: 'normal',
      seed: 23,
    },
    civCount: 6,
    playerName: '',
    ruler,
    ...more,
  });
const hist = (id: string): RulerSetup => {
  const r = RULER_BY_ID[id];
  return { id: r.id, name: r.name, face: r.face, major: r.major, minor: r.minor };
};

// ---------------------------------------------------------------- rivals
{
  const s = make(hist('alexander'));
  const great = s.civs.filter(c => !c.independent && !c.raiders);
  const me = player(s);
  check(
    me.name === 'Macedonians' && me.ruler?.name === 'Alexander the Great',
    `you lead the ${me.name}`,
  );
  const ids = great.map(c => c.ruler?.id);
  check(
    new Set(ids).size === great.length && ids.every(Boolean),
    `every people has its own ruler (${ids.join(', ')})`,
  );
  check(!ids.slice(1).includes('alexander'), 'no rival is your ruler');
  check(new Set(great.map(c => c.color)).size === great.length, 'no two peoples share a colour');
  const rival = great[1];
  check(
    personalityOf(s.settings.map.seed, rival)?.id === RULER_BY_ID[rival.ruler!.id!].personality,
    `${rival.ruler!.name} behaves as ${RULER_BY_ID[rival.ruler!.id!].personality}`,
  );
  const first = s.cities.find(c => c.civId === rival.id);
  check(
    first && RULER_BY_ID[rival.ruler!.id!].cities[0] === first.name,
    `their capital is ${first?.name}`,
  );
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  check(
    s.cities.find(c => c.civId === me.id)?.name === 'Pella',
    'your capital takes your nation’s first name',
  );
  // swift: one more move
  const army = s.formations.find(f => f.civId === me.id && f.kind === 'army')!;
  const base = fullMoves(s, army) - civMods(s, me.id).moves;
  check(
    civMods(s, me.id).moves === 1 && fullMoves(s, army) === base + 1,
    `Alexander’s troops move ${base + 1} instead of ${base}`,
  );
  check(
    civMods(s, me.id).attackPct >= TRAITS.warlord.minor.attackPct!,
    'and fight harder (minor: warlord)',
  );
  const fict = make(hist('alexander'), { rivals: 'fictional' });
  check(
    fict.civs.filter(c => !c.independent && !c.isPlayer && !c.raiders).every(c => !c.ruler),
    'invented rivals when asked',
  );
}

// ---------------------------------------------------------------- pathfinder: ground does not slow them
{
  const s = make(hist('genghis-khan'));
  const me = player(s);
  const army = s.formations.find(f => f.civId === me.id && f.kind === 'army')!;
  const g = { w: s.map.w, h: s.map.h };
  // put hills and forest next to the army
  const to = neighbors(g, army.hex).find(h => isPassableLand(s.map, h))!;
  s.map.relief[to] = 'hills';
  s.map.vegetation[to] = 'forest';
  check(
    stepCost(s, army, army.hex, to) === 1,
    'Genghis Khan’s troops cross forested hills at one move',
  );
  const other = make(hist('lorenzo'));
  const a2 = other.formations.find(f => f.civId === player(other).id && f.kind === 'army')!;
  const to2 = neighbors(g, a2.hex).find(h => isPassableLand(other.map, h))!;
  other.map.relief[to2] = 'hills';
  other.map.vegetation[to2] = 'forest';
  check(stepCost(other, a2, a2.hex, to2) > 1, 'other troops are slowed there');
}

// ---------------------------------------------------------------- sage and visionary: gifts each age
{
  const s = make({
    name: 'Ada',
    face: 'face/3',
    major: 'sage',
    minor: 'visionary',
    color: '#2f8a3c',
    nation: 'Lovelace',
    names: 'invented',
  });
  const me = player(s);
  check(
    me.name === 'Lovelace' && me.ruler?.name === 'Ada' && me.ruler?.face === 'face/3',
    'your own ruler: name, people and face',
  );
  check(me.color === '#2f8a3c', 'and banner colour');
  check(
    me.science > 0 && me.culture.points > 0,
    `a ruler’s gifts on the first age (${Math.round(me.science)} science, ${Math.round(me.culture.points)} culture)`,
  );
  const sci = me.science,
    cul = me.culture.points;
  ageGifts(s, me);
  check(me.science > sci && me.culture.points > cul, 'and again on each new age');
  check(!me.cityList, 'invented settlement names');
  const borrow = make({
    name: 'Ada',
    face: 'face/3',
    major: 'merchant',
    minor: 'builder',
    names: 'elizabeth',
  });
  check(player(borrow).cityList?.[0] === 'London', 'or a nation’s names, borrowed');
  check(
    civMods(borrow, player(borrow).id).goldPct >= 25 &&
      civMods(borrow, player(borrow).id).prodPct >= 8,
    'major in full, minor lighter',
  );
  const back = deserialize(serialize(s));
  check(
    back.civs[0].ruler?.name === 'Ada' && back.civs[1].ruler?.id === s.civs[1].ruler?.id,
    'a save keeps the rulers',
  );
}

// ---------------------------------------------------------------- drillmaster
{
  const s = make(hist('caesar'));
  check(civMods(s, player(s).id).upkeepPct <= -35, 'Caesar’s troops cost a third less to keep');
}

// ---------------------------------------------------------------- older settings: no ruler for the player
{
  const s = make(undefined);
  check(
    !player(s).ruler && player(s).name === 'Aurelians',
    'without a ruler set up, the player is as before',
  );
}

if (failures) {
  console.log(`${failures} ruler check(s) failed`);
  process.exit(1);
}
console.log('all ruler checks OK');
