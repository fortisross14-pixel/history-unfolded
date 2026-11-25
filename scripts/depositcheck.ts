/**
 * Deposits in a district: hidden until their tech, then "not yet" while the tech to work them is
 * missing, "workable" once known, "worked" once the building stands, and the output the report
 * gives matches the settlement's totals. The info card matches DEPOSITS. Whales off the shore
 * are worked by fishing boats in the district next to them (no district can stand on water).
 * Usage: node --no-warnings scripts/depositcheck.ts [seeds]
 */
import { DEPOSITS, SPECIAL_MIN } from '../src/data/goods.ts';
import { SLOT_TYPES } from '../src/data/slots.ts';
import { TECHS } from '../src/data/techs.ts';
import { isWater } from '../src/data/terrain.ts';
import {
  cityEconomy,
  depositCard,
  depositGain,
  districtDeposits,
  emptySlot,
  hexDeposit,
  invalidateMarkets,
  landOf,
} from '../src/engine/economy.ts';
import { districtHexProblem, foundCity, newGame, placeDistrict } from '../src/engine/game.ts';
import { neighbors } from '../src/engine/hex.ts';
import type { City, District, GameState } from '../src/engine/types.ts';

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
    civCount: 2,
    playerName: 'Test',
  });

/** The player's first settlement, founded if need be, grown to a large town. */
function town(s: GameState): City | undefined {
  let c = s.cities.find(x => x.civId === 0);
  if (!c) {
    const f = s.formations.find(x => x.civId === 0 && x.kind !== 'fleet');
    if (f) foundCity(s, f.id);
    c = s.cities.find(x => x.civId === 0);
  }
  if (!c) return undefined;
  c.tier = 'large-town';
  c.pop = 12000;
  return c;
}

const set = (s: GameState, d: District, types: (string | null)[]) => {
  types.forEach((t, i) => (d.slots[i] = { ...emptySlot(t), built: !!t, paid: true }));
  invalidateMarkets();
};
const learn = (s: GameState, ...ids: string[]) => {
  for (const id of ids) if (!s.civs[0].techs.includes(id)) s.civs[0].techs.push(id);
};
const forget = (s: GameState, ...ids: string[]) => {
  s.civs[0].techs = s.civs[0].techs.filter(t => !ids.includes(t));
};
const status = (s: GameState, c: City, d: District, kind: string) =>
  districtDeposits(s, c, d).find(x => x.kind === kind);

function run(seed: number) {
  const s = game(seed);
  const c = town(s);
  if (!c) return check(false, `seed ${seed}: no settlement`);
  const tag = `seed ${seed}`;
  const land = landOf(s, c).filter(k => k !== c.hex && !districtHexProblem(s, c, k));
  if (land.length < 3) return console.log(`${tag}: too little free land, skipped`);
  // the land, made to order: iron under the district, horses and game next to it
  const at = land[0];
  const next = neighbors({ w: s.map.w, h: s.map.h }, at).filter(
    k => landOf(s, c).includes(k) && k !== c.hex && !isWater(s.map.terrain[k]),
  );
  if (next.length < 2) return console.log(`${tag}: no land next to the district, skipped`);
  for (const k of landOf(s, c)) s.map.deposit[k] = null;
  s.map.deposit[at] = { kind: 'iron', richness: 1 };
  s.map.deposit[next[0]] = { kind: 'horses', richness: 1 };
  s.map.deposit[next[1]] = { kind: 'game', richness: 1 };
  forget(s, 'mining', 'iron-working', 'animal-husbandry', 'archery');
  const r = placeDistrict(s, c.id, 'Seams', [], at);
  const d = s.districts.find(x => x.id === r.id);
  if (!d) return check(false, `${tag}: district not laid out (${r.msg})`);

  // 1. iron is hidden before Iron Working; horses and game wait for their techs
  check(!status(s, c, d, 'iron'), `${tag}: iron shown before Iron Working`);
  check(!hexDeposit(s, c, at), `${tag}: the land map shows hidden iron`);
  const h0 = status(s, c, d, 'horses');
  check(h0?.state === 'not-yet', `${tag}: horses not "not yet" before Animal Husbandry`);
  check(
    !!h0?.why.includes(TECHS['animal-husbandry'].name),
    `${tag}: horses' reason names Animal Husbandry (${h0?.why})`,
  );
  const g0 = status(s, c, d, 'game');
  check(
    g0?.state === 'not-yet' && !!g0.why.includes(TECHS.archery.name),
    `${tag}: game needs Archery`,
  );
  learn(s, 'iron-working');
  const i0 = status(s, c, d, 'iron');
  check(i0?.state === 'not-yet', `${tag}: iron not "not yet" before Mining`);
  check(!!i0?.why.includes(TECHS.mining.name), `${tag}: iron's reason names Mining (${i0?.why})`);
  check(!!i0?.onHex, `${tag}: iron on the district's own hex`);
  check(hexDeposit(s, c, at)?.by[0]?.st.state === 'not-yet', `${tag}: land map iron not yet`);

  // 2. the techs known: workable, with the building it takes
  learn(s, 'mining', 'animal-husbandry', 'archery');
  const i1 = status(s, c, d, 'iron');
  check(i1?.state === 'workable', `${tag}: iron workable with Mining`);
  check(i1?.need === SPECIAL_MIN && i1.by === 'mine', `${tag}: iron takes ${SPECIAL_MIN} mines`);
  check(status(s, c, d, 'horses')?.state === 'workable', `${tag}: horses workable`);
  check(status(s, c, d, 'game')?.state === 'workable', `${tag}: game workable`);
  check(
    depositGain(s, c, d, 'pasture').some(x => x.kind === 'horses'),
    `${tag}: the picker marks the pasture for the horses`,
  );
  check(
    depositGain(s, c, d, 'mine').some(x => x.kind === 'iron'),
    `${tag}: the picker marks the mine for the iron`,
  );

  // 3. the buildings stand: worked, and the report's output is the economy's
  set(s, d, ['houses', 'houses', 'mine', 'mine', 'pasture', 'hunting-lodge', null, null, null]);
  const i2 = status(s, c, d, 'iron');
  check(i2?.state === 'workable', `${tag}: 2 mines do not work iron (${i2?.state})`);
  check(!!i2?.why.includes(`${SPECIAL_MIN}`), `${tag}: iron says it needs ${SPECIAL_MIN} mines`);
  set(s, d, ['houses', 'houses', 'mine', 'mine', 'mine', 'pasture', 'hunting-lodge', null, null]);
  const e = cityEconomy(s, c);
  const list = districtDeposits(s, c, d, e);
  const iron = list.find(x => x.kind === 'iron');
  const horses = list.find(x => x.kind === 'horses');
  const gameD = list.find(x => x.kind === 'game');
  check(iron?.state === 'worked', `${tag}: iron worked by 3 mines (${iron?.state}: ${iron?.why})`);
  check(horses?.state === 'worked', `${tag}: horses worked (${horses?.state}: ${horses?.why})`);
  check(gameD?.state === 'worked', `${tag}: game worked (${gameD?.state}: ${gameD?.why})`);
  check(iron?.slots.length === 3, `${tag}: 3 plots work the iron`);
  check(
    !!iron?.slots.every(i => d.slots[i].type === 'mine'),
    `${tag}: the iron plots are the mines`,
  );
  check(near(iron?.out.goods.iron ?? 0, e.total.goods.iron ?? 0), `${tag}: iron output = totals`);
  check(
    near(horses?.out.goods.horses ?? 0, e.total.goods.horses ?? 0),
    `${tag}: horses output = totals`,
  );
  check((e.total.goods.iron ?? 0) > 0, `${tag}: the town makes iron`);
  const reps = e.slots.get(d.id)!;
  check(
    near(
      reps.reduce((a, x) => a + (x.out.goods.iron ?? 0), 0),
      iron?.out.goods.iron ?? -1,
    ),
    `${tag}: the iron plots' own output = the deposit's`,
  );
  check(hexDeposit(s, c, at)?.by[0]?.st.state === 'worked', `${tag}: land map iron worked`);
  check(
    hexDeposit(s, c, next[0])?.by.some(x => x.d?.id === d.id && x.st.state === 'worked') ?? false,
    `${tag}: land map horses worked by the district`,
  );

  // 4. the info card is DEPOSITS
  for (const kind of Object.keys(DEPOSITS)) {
    const card = depositCard(s, 0, kind);
    const info = DEPOSITS[kind];
    check(
      card.by === info.by && card.byName === SLOT_TYPES[info.by].name,
      `card ${kind}: building`,
    );
    check(card.good === Object.keys(info.yields)[0], `card ${kind}: good`);
    check(
      near(card.gives.food, info.gives.food ?? 0) &&
        near(card.gives.gold, info.gives.gold ?? 0) &&
        JSON.stringify(card.gives.goods) === JSON.stringify(info.gives.goods ?? {}),
      `card ${kind}: gives`,
    );
    check(card.need === (info.special ? SPECIAL_MIN : 1), `card ${kind}: how many it takes`);
    for (const t of [info.tech, info.revealedBy, SLOT_TYPES[info.by].tech].filter(Boolean))
      check(
        card.techs.some(x => x.id === t && x.known === s.civs[0].techs.includes(t!)),
        `card ${kind}: tech ${t}`,
      );
    check(card.codex === `good-${card.good}`, `card ${kind}: Codex link`);
  }

  // 5. whales off the shore: worked from the district next to them (a bay made if need be)
  const G = { w: s.map.w, h: s.map.h };
  let shore: number | undefined, sea: number | undefined;
  for (const k of land.slice(1)) {
    const n = neighbors(G, k).filter(
      x =>
        landOf(s, c).includes(x) && x !== c.hex && x !== at && !s.districts.some(y => y.hex === x),
    );
    const wet = n.find(x => isWater(s.map.terrain[x])) ?? n.find(x => !s.map.deposit[x]);
    if (wet !== undefined) {
      shore = k;
      sea = wet;
      break;
    }
  }
  if (shore === undefined || sea === undefined) return;
  shores++;
  s.map.terrain[sea] = 'coast';
  s.map.deposit[sea] = { kind: 'whales', richness: 1 };
  learn(s, 'sailing');
  const r2 = placeDistrict(s, c.id, 'Harbour', [], shore);
  const h = s.districts.find(x => x.id === r2.id);
  if (!h) return check(false, `${tag}: harbour not laid out (${r2.msg})`);
  check(status(s, c, h, 'whales')?.state === 'workable', `${tag}: whales workable from the shore`);
  set(s, h, [
    'houses',
    'houses',
    'fishing-dock',
    'fishing-dock',
    'fishing-dock',
    null,
    null,
    null,
    null,
  ]);
  const e2 = cityEconomy(s, c);
  const wh = districtDeposits(s, c, h, e2).find(x => x.kind === 'whales');
  check(wh?.state === 'worked', `${tag}: whales worked by 3 boats (${wh?.state}: ${wh?.why})`);
  check((e2.total.goods['whale-oil'] ?? 0) > 0, `${tag}: the town makes whale oil`);
}

let shores = 0;
const seeds = Number(process.argv[2] ?? 4);
for (let i = 1; i <= seeds; i++) run(i * 101);
check(shores > 0, 'no seed had a shore to test whales on');
if (failures) {
  console.log(`${failures} deposit check(s) failed`);
  process.exit(1);
}
console.log(`deposit checks passed (${seeds} seeds, whales on ${shores})`);
