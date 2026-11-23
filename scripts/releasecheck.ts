/** Headless checks of Release 1 conveniences: sentry, victory toggles. */
import {
  declareWar,
  endTurn,
  foundCity,
  setPriority,
  setSupply,
  newGame,
  player,
  sentry,
  SENTRY_RANGE,
  wakeSentries,
} from '../src/engine/game.ts';
import { distance } from '../src/engine/hex.ts';
import { victoryOn, victoryTurn } from '../src/engine/victory.ts';
import type { GameState } from '../src/engine/types.ts';
import { classify, collapseRoutine, groupNews, locate } from '../src/ui/news.ts';
import { exportSave, importSave } from '../src/ui/save.ts';
import { whyCulture, whyGold, whyScience } from '../src/engine/breakdown.ts';
import { cityDistricts, cityEconomy, industryStatus, slotPreview } from '../src/engine/economy.ts';
import { codexEntries, searchCodex } from '../src/ui/codex.ts';
import { GUIDE, guideSeen, guideStep, startGuide } from '../src/ui/guide.ts';

let failures = 0;
const check = (cond: unknown, what: string) => {
  if (!cond) {
    failures++;
    console.log('FAIL', what);
  } else console.log('ok  ', what);
};
const make = (noVictory?: GameState['settings']['noVictory']): GameState =>
  newGame({
    map: {
      type: 'continents',
      size: 'small',
      seaLevel: 'normal',
      climate: 'normal',
      rainfall: 'normal',
      resources: 'normal',
      mountains: 'normal',
      seed: 12,
    },
    civCount: 4,
    playerName: 'Test',
    noVictory,
  });

// ---------------------------------------------------------------- sentry
{
  const s = make();
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  const f = s.formations.find(x => x.civId === me.id && x.kind === 'army')!;
  check(sentry(s, f.id).ok && f.sentry, 'a unit can stand sentry');
  check(wakeSentries(s, me.id).length === 0 && f.sentry, 'it stays on sentry while all is quiet');
  // an enemy comes near
  const rival = s.civs.find(c => !c.independent && c.id !== me.id)!;
  const theirs = s.formations.find(x => x.civId === rival.id)!;
  declareWar(s, me.id, rival.id);
  const g = { w: s.map.w, h: s.map.h };
  theirs.hex = f.hex + 2;
  check(distance(g, f.hex, theirs.hex) <= SENTRY_RANGE, 'the enemy is within range');
  const woke = wakeSentries(s, me.id);
  check(woke.length === 1 && !f.sentry, `an enemy near wakes it: ${woke[0]}`);
  sentry(s, f.id);
  sentry(s, f.id);
  check(!f.sentry, 'sentry toggles off');
}

// ---------------------------------------------------------------- victory toggles
{
  const s = make(['cultural', 'scientific']);
  check(!victoryOn(s, 'cultural') && !victoryOn(s, 'scientific'), 'turned-off victories are off');
  check(victoryOn(s, 'conquest') && victoryOn(s, 'economic'), 'the others stay on');
  // a people that would hold the cultural goal does not win by it
  const me = player(s);
  for (const c of s.civs) c.stats = { gdp: 1, culture: c.id === me.id ? 1000 : 1 };
  me.techs.push('renaissance-age', 'medieval-age', 'classical-age');
  s.holding = { cultural: { civId: me.id, since: s.turn - 50 } };
  const r = victoryTurn(s);
  check(!r.winner || r.winner.kind !== 'cultural', 'a turned-off goal never wins');
  check(make().settings.noVictory === undefined, 'all on by default');
}

// ---------------------------------------------------------------- news: grouped and located
{
  const s = make();
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  const town = s.cities.find(c => c.civId === me.id)!;
  const army = s.formations.find(f => f.civId === me.id && f.kind === 'army')!;
  const rival = s.civs.find(c => !c.independent && c.id !== me.id)!;
  check(
    classify(`The ${rival.name} declared war on the ${me.name}!`) === 'urgent',
    'war is urgent',
  );
  check(
    classify(`Raiders pillaged ${town.name}: 12 gold carried off.`) === 'urgent',
    'a raid is urgent',
  );
  check(
    classify(`${town.name}: Farm in Centre finished.`) === 'act',
    'a finished building is to act on',
  );
  check(classify('The Tolhuan learned Masonry.') === 'info', 'rivals’ news is for information');
  const t1 = locate(s, me.id, `${town.name}: Farm in Centre finished.`);
  check(t1?.kind === 'city' && t1.id === town.id, 'a settlement’s news goes to the settlement');
  const t2 = locate(s, me.id, `${army.name} wakes: raiders nearby.`);
  check(t2?.kind === 'formation' && t2.id === army.id, 'a unit’s news goes to the unit');
  const t3 = locate(s, me.id, 'Research complete: Pottery. More food.');
  check(t3?.kind === 'dialog' && t3.dialog === 'research', 'research news opens research');
  const t4 = locate(s, me.id, `The ${rival.name} are massing troops on the ${me.name} border.`);
  check(t4?.kind === 'dialog' && t4.dialog === 'peoples', 'a rival’s threat opens Peoples');
  const g = groupNews(['a', `Raiders pillaged ${town.name}.`, 'Research complete: X.']);
  check(g.urgent.length === 1 && g.act.length === 1 && g.info.length === 1, 'news is grouped');
  const folded = collapseRoutine([
    `${town.name}: Farm in Centre finished.`,
    `${town.name}: Houses in Centre finished.`,
    `${town.name}: Mine in Hills finished.`,
    'Something else.',
  ]);
  check(
    folded.length === 2 && /3 buildings finished/.test(folded[1]),
    `routine lines fold into one: ${folded[1]}`,
  );
  check(
    locate(s, me.id, folded[1])?.kind === 'city',
    'the folded line still goes to the settlement',
  );
}

// ---------------------------------------------------------------- save files
{
  const s = make();
  const f = exportSave(s);
  check(/^history-unfolded-test-turn-1\.json$/.test(f.filename), `export file name: ${f.filename}`);
  const back = importSave(f.text);
  check(back.turn === s.turn && back.uid === s.uid, 'an exported game imports back');
  let msg = '';
  try {
    importSave('{"hello": 1}');
  } catch (e) {
    msg = (e as Error).message;
  }
  check(/not a History Unfolded save|save/i.test(msg), `a wrong file is refused: ${msg}`);
  check(make().uid !== make().uid, 'two games on the same map are told apart');
}

// ---------------------------------------------------------------- the teaching layer
{
  // why?: the lines add up, settlements included
  const s = make();
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  const g = whyGold(s, me.id);
  check(
    Math.abs(g.lines.reduce((a, l) => a + l.value, 0) - g.total) < 0.01,
    `gold: the lines add up to ${g.total}`,
  );
  const army = s.formations.find(f => f.civId === me.id && f.kind === 'army')!;
  for (const co of army.cohorts) co.loadout = { ...co.loadout, weapon: 'axe' };
  check(
    whyGold(s, me.id).lines.some(l => l.value < 0 && /upkeep/.test(l.label)),
    'troop upkeep shows as a cost',
  );
  check(whyScience(s, me.id).total >= 0 && whyCulture(s, me.id).total >= 0, 'science and culture');

  // the Codex
  const all = codexEntries();
  check(all.length > 200, `the Codex has ${all.length} entries`);
  check(new Set(all.map(e => e.id)).size === all.length, 'every entry has its own id');
  for (const q of ['siege', 'raiders', 'bronze', 'faith', 'great pyramid', 'sentry'])
    check(searchCodex(q).length > 0, `search “${q}” finds ${searchCodex(q)[0]?.title}`);
  check(
    searchCodex('').every(e => e.group === 'Basics'),
    'an empty search shows the basics',
  );
  check(searchCodex('zzqqx').length === 0, 'nonsense finds nothing');
}
{
  // the guide: on for a new Standard game, steps ticked by the game itself
  const s = make();
  const me = player(s);
  startGuide(s, me.id);
  check(guideStep(s, me.id)?.step.id === 'found', 'the guide starts with founding');
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  check(guideStep(s, me.id)?.step.id === 'research', 'founding ticks itself');
  me.researching = 'pottery';
  check(guideStep(s, me.id)?.step.id === 'district', 'then plan a building');
  guideSeen(s, 'victory');
  check(GUIDE.length === 10, 'ten steps');
  s.guide!.off = true;
  check(guideStep(s, me.id) === null, 'the guide can be hidden');
  const hard = newGame({ ...s.settings, difficulty: 'hard' });
  startGuide(hard, player(hard).id);
  check(guideStep(hard, player(hard).id) === null, 'off on Veteran');
}

// ---------------------------------------------------------------- building preview
{
  const s = make();
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  const town = s.cities.find(c => c.civId === me.id)!;
  town.pop = 3000;
  const d = cityDistricts(s, town)[0];
  d.slots[0] = { type: 'houses', built: true, progress: 0, paid: true };
  d.slots[1] = { type: 'houses', built: true, progress: 0, paid: true };
  const pv = slotPreview(s, town, d, 2, 'woodlot');
  check(
    (pv.goods.wood ?? 0) > 0,
    `a woodlot on an empty plot shows its own wood: ${JSON.stringify(pv)}`,
  );
  check(d.slots[2].type === null, 'the preview leaves the plot as it was');
  const bad = slotPreview(s, town, d, 0, 'woodlot');
  check(!!bad.why && /housing/.test(bad.why), `replacing a house says why: ${bad.why}`);
}

// ---------------------------------------------------------------- empire priority
{
  const s = make();
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  const town = s.cities.find(c => c.civId === me.id)!;
  check(setPriority(s, me.id, 'expand').ok && me.priority === 'expand', 'the priority is set');
  town.auto = true;
  town.pop = 5000;
  me.gold = 500;
  const before = s.cities.filter(c => c.civId === me.id).length;
  for (let t = 0; t < 25; t++) endTurn(s);
  const settlers = s.formations.filter(f => f.civId === me.id && f.kind === 'settlers');
  const after = s.cities.filter(c => c.civId === me.id).length;
  check(
    after > before || settlers.some(f => f.auto === 'settle'),
    `expand: governed towns send settlers who settle on their own (${before} → ${after} settlements)`,
  );
  check(
    s.cities.filter(c => c.civId === me.id).every(c => !c.colony),
    'automatic settlers found towns that join the realm',
  );
  setPriority(s, me.id, 'balanced');
  check(me.priority === undefined, 'balanced clears it');
}

// ---------------------------------------------------------------- shortages: who comes first
{
  const s = make();
  const me = player(s);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  const town = s.cities.find(c => c.civId === me.id)!;
  town.tier = 'city';
  town.pop = 9000;
  town.stockpile = { wood: 5, coal: 1, iron: 5 };
  const d = cityDistricts(s, town)[0];
  d.slots[0] = { type: 'houses', built: true, progress: 0, paid: true };
  d.slots[1] = { type: 'houses', built: true, progress: 0, paid: true };
  check(setSupply(s, me.id, 'homes').ok && me.supply === 'homes', 'homes first is set');
  const homes = cityEconomy(s, town);
  check(homes.fuel.good !== null, `homes first: the hearths get their fuel (${homes.fuel.good})`);
  setSupply(s, me.id, 'army');
  const st = industryStatus(s, town);
  check(Array.isArray(st.short) && typeof st.rail === 'boolean', 'the rail and power status reads');
  setSupply(s, me.id, 'industry');
  check(me.supply === undefined, 'factories first is the default');
}

if (failures) {
  console.log(`${failures} release check(s) failed`);
  process.exit(1);
}
console.log('all release checks OK');
