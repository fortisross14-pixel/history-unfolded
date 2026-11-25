/**
 * Production chains hold together: every good is made by something the player can build (or a
 * deposit the maps place) and used by something; every gear piece's goods can be had by the age
 * of the tech that opens it; hunting lodges and a tannery put a cohort in leather armour within
 * a few turns and keep doing it; the Codex has an entry for every good, building and gear piece,
 * and each good's entry lists exactly the sources and users the data has.
 * Usage: node --no-warnings scripts/chaincheck.ts
 */
import { goodEra, gearEra, goodSources, goodUsers } from '../src/data/chains.ts';
import { GOODS } from '../src/data/goods.ts';
import { DEFAULT_LOADOUT, ITEM_LIST } from '../src/data/items.ts';
import { SLOT_TYPES } from '../src/data/slots.ts';
import { TECHS } from '../src/data/techs.ts';
import {
  cityDistricts,
  cityEconomy,
  invalidateMarkets,
  isCentre,
  marketCities,
  marketStock,
} from '../src/engine/economy.ts';
import {
  endTurn,
  foundCity,
  levy,
  newGame,
  player,
  refit,
  refitPreview,
} from '../src/engine/game.ts';
import type { GameState } from '../src/engine/types.ts';
import { codexEntry, searchCodex } from '../src/ui/codex.ts';

let failures = 0;
const check = (cond: boolean, what: string) => {
  if (!cond) failures++;
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);
};

const game = (seed: number, size = 'small'): GameState =>
  newGame({
    map: {
      type: 'continents',
      size: size as 'small',
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

// ---- every good has a source and a use
const placed = new Set<string>();
for (const seed of [1, 2, 3, 4, 5, 6])
  for (const d of game(seed).map.deposit) if (d) placed.add(d.kind);
for (const g of Object.keys(GOODS)) {
  // a building (the town hall stands in every settlement), open land, or a deposit some map places
  const src = goodSources(g).filter(
    r => r.kind === 'land' || r.kind === 'building' || (!!r.deposit && placed.has(r.deposit)),
  );
  check(
    src.length > 0,
    `${GOODS[g].name}: made by ${src.map(r => r.name).join(', ') || 'nothing'}`,
  );
  const use = goodUsers(g);
  check(
    use.length > 0,
    `${GOODS[g].name}: used by ${use.length} (${[...new Set(use.map(r => r.kind))].join(', ')})`,
  );
  check(goodEra(g) < Infinity, `${GOODS[g].name}: obtainable from age ${goodEra(g)}`);
}

// ---- gear costs are obtainable by the gear's age
for (const i of ITEM_LIST) {
  const era = gearEra(i.tech ? [i.tech] : []);
  const late = Object.keys(i.cost).filter(g => goodEra(g) > era);
  if (late.length || Object.keys(i.cost).length)
    check(
      !late.length,
      `${i.name} (${i.tech ? TECHS[i.tech].name : 'no tech'}, age ${era}): ${Object.keys(i.cost)
        .map(g => `${g} age ${goodEra(g)}`)
        .join(', ')}`,
    );
}
// leather gear costs leather; the cheapest first-age pieces stay on raw hides
for (const id of ['leather', 'leather-cap', 'marching-boots'])
  check(!!ITEM_LIST.find(i => i.id === id)?.cost.leatherwork, `${id} costs tannery leather`);
for (const id of ['padded', 'sandals', 'hide-shield'])
  check(!!ITEM_LIST.find(i => i.id === id)?.cost.hides, `${id} stays on raw hides`);
check(GOODS.leatherwork.name === 'Leather', 'the tannery good is called Leather');
check(!!SLOT_TYPES['hunting-lodge'].out.goods?.hides, 'a hunting lodge makes hides anywhere');

// ---- the leather chain: hunting lodges and a tannery put cohorts in leather
const N = 6;
{
  const s = game(11);
  const me = player(s);
  for (const t of ['tanning', 'archery']) if (!me.techs.includes(t)) me.techs.push(t);
  foundCity(s, s.formations.find(f => f.civId === me.id && f.kind === 'settlers')!.id);
  const c = s.cities.find(x => x.civId === me.id)!;
  c.pop = 3000;
  const d = cityDistricts(s, c).find(isCentre)!;
  const free = () => d.slots.findIndex(x => !x.type);
  for (const type of ['houses', 'houses', 'hunting-lodge', 'hunting-lodge', 'tannery']) {
    const i = free();
    if (i >= 0) d.slots[i] = { type, built: true, progress: 0, paid: true };
  }
  for (const x of marketCities(s, c)) {
    x.stockpile.hides = 0;
    x.stockpile.leatherwork = 0;
  }
  invalidateMarkets();
  const e = cityEconomy(s, c);
  const madeHides = e.total.goods.hides ?? 0;
  check(madeHides >= 1, `two hunting lodges make ${madeHides} hides a turn (no game needed)`);
  const lv = levy(s, c.id);
  const f = s.formations.find(x => x.civId === me.id && x.kind === 'army' && x.hex === c.hex);
  check(lv.ok && !!f, `a levy raised: ${lv.msg}`);
  const leather = { ...DEFAULT_LOADOUT, weapon: 'spear', armour: 'leather' };
  let equipped = 0;
  let firstAt = -1;
  for (let t = 1; t <= 4 * N && f; t++) {
    endTurn(s);
    invalidateMarkets();
    const raw = f.cohorts.find(co => co.loadout.armour !== 'leather');
    if (!raw) break;
    f.moves = 1;
    const pv = refitPreview(s, f.id, [raw.id], leather);
    if (pv.problem === null && !pv.missing.length && refit(s, f.id, [raw.id], leather).ok) {
      equipped++;
      if (firstAt < 0) firstAt = t;
    }
  }
  const stock = marketStock(s, c);
  check(
    firstAt > 0 && firstAt <= N,
    `first cohort in leather armour on turn ${firstAt} (within ${N})`,
  );
  check(
    equipped >= 3,
    `one tannery and two lodges equip ${equipped} cohorts in ${4 * N} turns (hides ${stock.hides ?? 0}, leather ${stock.leatherwork ?? 0} left)`,
  );
}

// ---- the Codex: an entry for every good, building and gear piece, matching the data
for (const g of Object.keys(GOODS)) {
  const e = codexEntry(`good-${g}`);
  check(!!e, `Codex entry for ${GOODS[g].name}`);
  if (!e) continue;
  const get = e.sections?.find(x => x.title === 'Get it from')?.items ?? [];
  const use = e.sections?.find(x => x.title === 'Used by')?.items ?? [];
  const src = goodSources(g);
  const users = goodUsers(g);
  check(
    (src.length ? get.length === src.length : get.length === 1) &&
      src.every(r => get.some(i => i.text.startsWith(r.name))),
    `Codex ${GOODS[g].name}: ${src.length} sources listed`,
  );
  check(
    (users.length ? use.length === users.length : use.length === 1) &&
      users.every(r => use.some(i => i.text.startsWith(r.name) && i.entry === r.entry)),
    `Codex ${GOODS[g].name}: ${users.length} users listed`,
  );
  check(
    searchCodex(GOODS[g].name)[0]?.id === `good-${g}` ||
      searchCodex(GOODS[g].name).some(x => x.id === `good-${g}`),
    `Codex search finds ${GOODS[g].name}`,
  );
}
let links = 0,
  broken: string[] = [];
for (const b of Object.values(SLOT_TYPES)) {
  const e = codexEntry(`building-${b.id}`);
  check(!!e && !!e.sections?.length, `Codex entry for ${b.name}`);
}
for (const i of ITEM_LIST.filter(x => !x.empty)) {
  const e = codexEntry(`gear-${i.id}`);
  const cost = e?.sections?.find(x => x.title.startsWith('Cost'))?.items ?? [];
  check(
    !!e &&
      Object.keys(i.cost).every(g => cost.some(x => x.entry === `good-${g}`)) &&
      (!!Object.keys(i.cost).length || cost.length === 1),
    `Codex entry for ${i.name} with its cost`,
  );
}
for (const id of [
  ...Object.keys(GOODS).map(g => `good-${g}`),
  ...Object.keys(SLOT_TYPES).map(b => `building-${b}`),
  ...ITEM_LIST.filter(x => !x.empty).map(i => `gear-${i.id}`),
])
  for (const sc of codexEntry(id)?.sections ?? [])
    for (const it of sc.items)
      if (it.entry) {
        links++;
        if (!codexEntry(it.entry)) broken.push(`${id} → ${it.entry}`);
      }
check(!broken.length, `${links} Codex links, none broken ${broken.slice(0, 5).join(', ')}`);
const hides = codexEntry('good-hides')!;
const chain = hides.sections?.find(x => x.title === 'Chain')?.items.map(x => x.text) ?? [];
check(
  chain.some(t => /^Hides → Tannery → Leather → .*Leather armour/.test(t)),
  `the hides chain reads: ${chain.join(' | ')}`,
);

if (failures) {
  console.log(`${failures} failure(s)`);
  process.exit(1);
}
console.log('chaincheck: ok');
