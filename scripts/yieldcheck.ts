/**
 * The city's "why?" numbers add up: a tannery with no hides stands idle and says so; with hides
 * its use and its leatherwork show in the breakdowns; every good's breakdown sums to the
 * settlement's net, and every yield's breakdown sums to the settlement's total, in every
 * settlement of a few games played on for a while.
 * Usage: node --no-warnings scripts/yieldcheck.ts [seeds] [turns]
 */
import { aiTurn } from '../src/engine/ai.ts';
import { SLOT_TYPES } from '../src/data/slots.ts';
import {
  cityBuildings,
  cityGoodFlows,
  cityGoodNetRaw,
  whyCityGood,
  whyCityYield,
  whyCityYieldRaw,
  whyRealmGood,
  YIELD_KEYS,
} from '../src/engine/breakdown.ts';
import {
  cityDistricts,
  cityEconomy,
  civGoods,
  invalidateMarkets,
  isCentre,
  marketCities,
} from '../src/engine/economy.ts';
import { endTurn, foundCity, newGame, player } from '../src/engine/game.ts';
import type { GameState } from '../src/engine/types.ts';

let failures = 0;
const check = (cond: boolean, what: string) => {
  if (!cond) {
    failures++;
    console.log(`FAIL ${what}`);
  }
};
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

const game = (seed: number): GameState =>
  newGame({
    map: {
      type: 'continents',
      size: 'small',
      seaLevel: 'normal',
      climate: 'normal',
      rainfall: 'normal',
      resources: 'normal',
      mountains: 'normal',
      seed,
    },
    civCount: 4,
    playerName: 'Test',
  });

/** Every settlement's breakdowns add up to its numbers. */
function sums(s: GameState, tag: string) {
  for (const c of s.cities) {
    const e = cityEconomy(s, c);
    for (const k of YIELD_KEYS) {
      const raw = whyCityYieldRaw(s, c, k, e);
      const sum = raw.lines.reduce((a, l) => a + l.value, 0);
      check(
        near(sum, e.total[k], 1e-6),
        `${tag} ${c.name} ${k}: lines ${sum} vs total ${e.total[k]}`,
      );
      const shown = whyCityYield(s, c, k, e);
      const shownSum = shown.lines.reduce((a, l) => a + l.value, 0);
      check(
        Math.abs(shownSum - shown.total) < 0.01,
        `${tag} ${c.name} ${k}: shown lines ${shownSum} vs ${shown.total}`,
      );
    }
    // goods: made = total.goods, used = inputs (+ the army's powder at the first settlement)
    const flows = cityGoodFlows(s, c, e);
    for (const f of flows) {
      const raw = cityGoodNetRaw(s, c, f.good, e);
      const made = raw.made.reduce((a, l) => a + l.value, 0);
      const used = -raw.used
        .filter(l => l.label !== 'Army (powder)')
        .reduce((a, l) => a + l.value, 0);
      check(
        near(made, e.total.goods[f.good] ?? 0, 1e-6),
        `${tag} ${c.name} ${f.good}: made ${made} vs ${e.total.goods[f.good] ?? 0}`,
      );
      check(
        near(used, e.inputs[f.good] ?? 0, 1e-6),
        `${tag} ${c.name} ${f.good}: used ${used} vs ${e.inputs[f.good] ?? 0}`,
      );
      check(near(raw.net, f.net), `${tag} ${c.name} ${f.good}: net ${raw.net} vs ${f.net}`);
    }
    for (const g of Object.keys({ ...e.total.goods, ...e.inputs }))
      check(
        flows.some(f => f.good === g),
        `${tag} ${c.name}: ${g} missing from the goods list`,
      );
  }
  // the realm's ledger and its breakdown agree
  for (const civ of s.civs) {
    if (!civ.alive) continue;
    const ledger = civGoods(s, civ.id);
    for (const [g, l] of Object.entries(ledger)) {
      const w = whyRealmGood(s, civ.id, g);
      check(
        Math.abs(w.total - l.net) <= 0.11,
        `${tag} ${civ.name} ${g}: realm why ${w.total} vs ledger ${l.net}`,
      );
    }
  }
}

// ---- the tannery
{
  const s = game(11);
  const me = player(s);
  if (!me.techs.includes('tanning')) me.techs.push('tanning');
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  const c = s.cities.find(x => x.civId === me.id)!;
  c.pop = 6000;
  const d = cityDistricts(s, c).find(isCentre)!;
  // housing first (a district works with two houses), then the tannery
  const free = () => d.slots.findIndex((x, i) => !x.type && i < 9);
  const housing = Object.values(SLOT_TYPES).find(
    t => t.group === 'residential' && !t.tech && !t.fixed,
  )!;
  while (
    d.slots.filter(x => x.built && x.type && SLOT_TYPES[x.type].group === 'residential').length < 2
  ) {
    const i = free();
    if (i < 0) break;
    d.slots[i] = { type: housing.id, built: true, progress: 0, paid: true };
  }
  const ti = free();
  check(ti >= 0, 'a free plot for the tannery');
  d.slots[ti] = { type: 'tannery', built: true, progress: 0, paid: true };
  for (const x of marketCities(s, c)) x.stockpile.hides = 0;
  invalidateMarkets();
  let row = cityBuildings(s, c).find(b => b.type === 'tannery')!;
  check(!!row, 'the tannery has a row');
  check(row.idle === 'no hides', `no hides: the tannery says why (${row.idle})`);
  check(!row.takes.hides, 'no hides: the tannery takes none');
  console.log(`no hides: ${row.name} ${row.idle}, makes ${JSON.stringify(row.makes.goods)}`);

  for (const x of marketCities(s, c)) x.stockpile.hides = 0;
  c.stockpile.hides = 10;
  invalidateMarkets();
  row = cityBuildings(s, c).find(b => b.type === 'tannery')!;
  check(!row.idle, `with hides the tannery runs (${row.idle})`);
  check(row.takes.hides === 1, 'with hides the tannery takes 1');
  check((row.makes.goods.leatherwork ?? 0) > 0, 'with hides the tannery makes leatherwork');
  const why = whyCityGood(s, c, 'hides');
  const tanLine = why.lines.find(l => l.label.startsWith('Tannery'));
  check(
    !!tanLine && tanLine.value === -1,
    `the hides breakdown names the tannery: ${JSON.stringify(why.lines)}`,
  );
  const leather = whyCityGood(s, c, 'leatherwork');
  check(
    leather.lines.some(l => l.label.startsWith('Tannery') && l.value > 0),
    `the leatherwork breakdown names the tannery: ${JSON.stringify(leather.lines)}`,
  );
  const flow = cityGoodFlows(s, c).find(f => f.good === 'hides')!;
  check(
    flow.store >= 10 && flow.turnsLeft !== null,
    `hides store ${flow.store}, out in ${flow.turnsLeft}`,
  );
  console.log(
    `with hides: ${why.total} a turn: ${why.lines.map(l => `${l.label} ${l.value}`).join(', ')}; ${why.note}`,
  );
  const prod = whyCityYield(s, c, 'prod');
  console.log(
    `production ${prod.total}: ${prod.lines.map(l => `${l.label} ${l.value}`).join(', ')}`,
  );
  sums(s, 'tannery');
}

// ---- a few games played on
const seeds = (process.argv[2] ?? '3,8').split(',').map(Number);
const turns = Number(process.argv[3] ?? 60);
for (const seed of seeds) {
  const s = game(seed);
  for (let t = 0; t < turns && !s.ended; t++) {
    const me = player(s);
    me.isPlayer = false;
    aiTurn(s, me);
    me.isPlayer = true;
    endTurn(s);
    if (t % 20 === 19) sums(s, `seed ${seed} turn ${s.turn}`);
  }
  sums(s, `seed ${seed} end`);
  console.log(`seed ${seed}: ${s.cities.length} settlements checked at turn ${s.turn}`);
}

if (failures) {
  console.log(`${failures} failure(s)`);
  process.exit(1);
}
console.log('yieldcheck: ok');
