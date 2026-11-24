/**
 * "Why?" for the player's main numbers: where this turn's gold, science and culture come from,
 * line by line, as the end of the turn will count them (before random events and one-off sums).
 */
import { GOODS } from '../data/goods.ts';
import { SLOT_TYPES } from '../data/slots.ts';
import { capitalOf } from './diplomacy.ts';
import {
  cityDistricts,
  cityEconomy,
  isCentre,
  marketCities,
  marketStock,
  powderNeed,
  type CityEconomy,
} from './economy.ts';
import { faithIncome } from './faith.ts';
import { cohortUpkeep } from './game.ts';
import { tributeTo } from './independents.ts';
import { civMods, pct } from './mods.ts';
import { wonderCulture } from './wonders.ts';
import type { City, GameState } from './types.ts';

export interface WhyLine {
  label: string;
  value: number;
}
export interface Why {
  total: number;
  lines: WhyLine[];
  note?: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Settlements by what they make, the biggest few named, the rest summed. */
function bySettlement(
  s: GameState,
  civId: number,
  pick: 'gold' | 'science' | 'culture',
): WhyLine[] {
  const rows = s.cities
    .filter(c => c.civId === civId)
    .map(c => ({ label: c.name, value: cityEconomy(s, c).total[pick] }))
    .filter(r => r.value)
    .sort((a, b) => b.value - a.value);
  const top = rows.slice(0, 4).map(r => ({ label: r.label, value: round1(r.value) }));
  const rest = rows.slice(4).reduce((a, r) => a + r.value, 0);
  if (rest) top.push({ label: `${rows.length - 4} other settlements`, value: round1(rest) });
  return top;
}

export function whyGold(s: GameState, civId: number): Why {
  const lines = bySettlement(s, civId, 'gold');
  let upkeep = 0;
  for (const f of s.formations)
    if (f.civId === civId) for (const co of f.cohorts) upkeep += cohortUpkeep(co);
  upkeep = Math.round(upkeep * pct(civMods(s, civId).upkeepPct));
  if (upkeep) lines.push({ label: 'Troop and ship upkeep', value: -upkeep });
  const faith = faithIncome(s, civId).gold;
  if (faith) lines.push({ label: 'Tithes from your faith', value: round1(faith) });
  let deals = 0;
  for (const t of s.treaties) {
    if (t.kind !== 'trade') continue;
    if (t.a === civId) deals += (t.bGives?.goldPerTurn ?? 0) - (t.aGives?.goldPerTurn ?? 0);
    if (t.b === civId) deals += (t.aGives?.goldPerTurn ?? 0) - (t.bGives?.goldPerTurn ?? 0);
  }
  if (deals) lines.push({ label: 'Deals (gold a turn)', value: deals });
  const tribute = s.civs
    .filter(c => c.alive && c.independent && !c.raiders)
    .reduce((a, c) => a + tributeTo(s, c.id, civId).gold, 0);
  if (tribute) lines.push({ label: 'Gifts from free peoples', value: tribute });
  const total = round1(lines.reduce((a, l) => a + l.value, 0));
  return {
    total,
    lines,
    note: 'Events, edicts, deals paid at once and the start of a crisis come on top.',
  };
}

export function whyScience(s: GameState, civId: number): Why {
  const lines = bySettlement(s, civId, 'science');
  return { total: round1(lines.reduce((a, l) => a + l.value, 0)), lines };
}

export function whyCulture(s: GameState, civId: number): Why {
  const lines = bySettlement(s, civId, 'culture');
  const wonders = s.cities
    .filter(c => c.civId === civId)
    .reduce((a, c) => a + wonderCulture(s, c.id), 0);
  if (wonders) lines.push({ label: 'World wonders', value: wonders });
  const pilgrims = faithIncome(s, civId).culture;
  if (pilgrims) lines.push({ label: 'Pilgrims of your faith', value: pilgrims });
  return { total: round1(lines.reduce((a, l) => a + l.value, 0)), lines };
}

// ---------------------------------------------------------------- one settlement

export type YieldKey = 'food' | 'prod' | 'science' | 'gold' | 'culture';
export const YIELD_KEYS: YieldKey[] = ['food', 'prod', 'science', 'gold', 'culture'];
export const YIELD_NAME: Record<YieldKey, string> = {
  food: 'Food',
  prod: 'Production',
  science: 'Science',
  gold: 'Gold',
  culture: 'Culture',
};

/** A built building of a settlement, as it ran this turn. */
export interface BuildingRow {
  districtId: number;
  district: string;
  centre: boolean;
  slot: number;
  type: string;
  name: string;
  /** workers it has (0 when idle) and needs */
  workers: number;
  labour: number;
  staffed: boolean;
  /** 1 full, ½ past what the land holds, ⅓ short of its inputs, 0 idle */
  rate: number;
  /** goods it took this turn */
  takes: Record<string, number>;
  /** yields and goods it made this turn (before the settlement-wide changes) */
  makes: Record<YieldKey, number> & { goods: Record<string, number> };
  /** short, why it stands idle or runs slow: "no hides", "no workers" */
  idle?: string;
  note?: string;
}

/** "Short of hides, iron: a third of its output" → "no hides, iron". */
function shortIdle(r: {
  idle?: string;
  note?: string;
  problem: string | null;
}): string | undefined {
  if (r.problem) return r.problem;
  if (r.idle) return r.idle === 'No workers' ? 'no workers' : r.idle;
  const m = r.note?.match(/^Short of ([^:]+):/);
  if (m)
    return `no ${m[1]
      .split(', ')
      .map(g => (GOODS[g]?.name ?? g).toLowerCase())
      .join(', ')}`;
  return undefined;
}

/** Every built building of a settlement, district by district, with what it took and made. */
export function cityBuildings(s: GameState, c: City, e = cityEconomy(s, c)): BuildingRow[] {
  const rows: BuildingRow[] = [];
  for (const d of cityDistricts(s, c)) {
    const reps = e.slots.get(d.id) ?? [];
    d.slots.forEach((st, i) => {
      const t = st.type ? SLOT_TYPES[st.type] : undefined;
      const r = reps[i];
      if (!t || !st.built || !r) return;
      const makes = {
        food: 0,
        prod: 0,
        science: 0,
        gold: 0,
        culture: 0,
        goods: {} as Record<string, number>,
      };
      if (r.staffed) {
        for (const k of YIELD_KEYS) makes[k] = r.out[k];
        for (const [g, n] of Object.entries(r.out.goods)) if (n) makes.goods[g] = n;
      }
      rows.push({
        districtId: d.id,
        district: d.name,
        centre: isCentre(d),
        slot: i,
        type: t.id,
        name: t.name,
        workers: r.staffed ? t.labour : 0,
        labour: t.labour,
        staffed: r.staffed,
        rate: r.staffed ? r.rate : 0,
        takes: { ...(r.uses ?? {}) },
        makes,
        idle: shortIdle(r),
        note: r.note,
      });
    });
  }
  return rows;
}

/** Lines summed by label (two farms → "Farm ×2"), biggest first. */
function grouped(items: { label: string; value: number }[]): WhyLine[] {
  const by = new Map<string, { n: number; value: number }>();
  for (const it of items) {
    if (Math.abs(it.value) < 1e-9) continue;
    const x = by.get(it.label) ?? { n: 0, value: 0 };
    x.n++;
    x.value += it.value;
    by.set(it.label, x);
  }
  return [...by.entries()]
    .map(([label, x]) => ({ label: x.n > 1 ? `${label} ×${x.n}` : label, value: x.value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * One yield of a settlement, building by building, then the open land and the settlement-wide
 * changes (fuel, comforts, the people, the coast, a railway). The lines sum to the total.
 */
export function whyCityYieldRaw(s: GameState, c: City, k: YieldKey, e = cityEconomy(s, c)) {
  const items = cityBuildings(s, c, e).map(b => ({ label: b.name, value: b.makes[k] }));
  const lines = grouped(items);
  if (e.subsistence[k]) lines.push({ label: 'Open land', value: e.subsistence[k] });
  for (const st of e.steps)
    if (Math.abs(st.d[k]) > 1e-9) lines.push({ label: st.label, value: st.d[k] });
  return { total: e.total[k], lines };
}

export function whyCityYield(s: GameState, c: City, k: YieldKey, e = cityEconomy(s, c)): Why {
  const raw = whyCityYieldRaw(s, c, k, e);
  const lines = raw.lines
    .filter(l => l.label !== 'Rounding')
    .map(l => ({ label: l.label, value: round1(l.value) }));
  // the tenths lost to rounding each line go to the biggest, so the lines add up as shown
  const off = round1(round1(raw.total) - lines.reduce((x, l) => x + l.value, 0));
  const big = lines.reduce<WhyLine | null>(
    (b, l) => (!b || Math.abs(l.value) > Math.abs(b.value) ? l : b),
    null,
  );
  if (big && off) big.value = round1(big.value + off);
  return {
    total: round1(raw.total),
    lines,
    note:
      k === 'food'
        ? `${e.eat} eaten: ${e.surplus >= 0 ? '+' : ''}${round1(e.surplus)} left`
        : undefined,
  };
}

/** A good in a settlement: who makes it, who uses it, the store and how long it lasts. */
export interface GoodFlow {
  good: string;
  /** positive, by building (and the open land) */
  made: WhyLine[];
  /** negative, by building, hearths, homes, the army */
  used: WhyLine[];
  /** trade deals (the capital only), + bought, − sold */
  traded: number;
  net: number;
  /** in the market's store (shared by the linked settlements) */
  store: number;
  /** the net of the whole market, when it is more than this settlement */
  marketNet: number;
  /** turns until the store runs out at the market's net, or null if it does not */
  turnsLeft: number | null;
}

function tradeOf(s: GameState, civId: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of s.treaties) {
    if (t.kind !== 'trade' || (t.a !== civId && t.b !== civId)) continue;
    const give = t.a === civId ? t.aGives : t.bGives;
    const get = t.a === civId ? t.bGives : t.aGives;
    for (const [g, n] of Object.entries(give?.goodsPerTurn ?? {})) out[g] = (out[g] ?? 0) - n;
    for (const [g, n] of Object.entries(get?.goodsPerTurn ?? {})) out[g] = (out[g] ?? 0) + n;
  }
  return out;
}

/** Each good's made and used lines for one settlement (unrounded), with its trade and army. */
function goodLines(s: GameState, c: City, e: CityEconomy) {
  const made: Record<string, { label: string; value: number }[]> = {};
  const used: Record<string, { label: string; value: number }[]> = {};
  const add = (into: typeof made, g: string, label: string, value: number) =>
    (into[g] ??= []).push({ label, value });
  for (const b of cityBuildings(s, c, e)) {
    for (const [g, n] of Object.entries(b.makes.goods)) add(made, g, b.name, n);
    for (const [g, n] of Object.entries(b.takes)) add(used, g, b.name, -n);
  }
  for (const [g, n] of Object.entries(e.subsistence.goods)) add(made, g, 'Open land', n);
  for (const st of e.steps)
    for (const [g, n] of Object.entries(st.d.goods)) add(made, g, st.label, n);
  if (e.fuel.good && e.fuel.need) add(used, e.fuel.good, 'Hearths (fuel)', -e.fuel.need);
  for (const [g, n] of Object.entries(e.comfort.got)) add(used, g, 'Homes (comforts)', -n);
  // the realm's powder and its trade deals come out of, and go into, the first settlement
  if (s.cities.find(x => x.civId === c.civId)?.id === c.id) {
    const powder = powderNeed(s, c.civId);
    if (powder) add(used, 'saltpeter', 'Army (powder)', -powder);
  }
  const traded = capitalOf(s, c.civId)?.id === c.id ? tradeOf(s, c.civId) : {};
  return { made, used, traded };
}

const netOf = (l: ReturnType<typeof goodLines>, g: string) =>
  (l.made[g] ?? []).reduce((a, x) => a + x.value, 0) +
  (l.used[g] ?? []).reduce((a, x) => a + x.value, 0) +
  (l.traded[g] ?? 0);

/** Every good a settlement makes, uses or holds, with its sources. */
export function cityGoodFlows(s: GameState, c: City, e = cityEconomy(s, c)): GoodFlow[] {
  const mine = goodLines(s, c, e);
  const market = marketCities(s, c);
  const others = market.filter(x => x.id !== c.id).map(x => goodLines(s, x, cityEconomy(s, x)));
  const stock = marketStock(s, c);
  const goods = new Set([
    ...Object.keys(mine.made),
    ...Object.keys(mine.used),
    ...Object.keys(mine.traded),
    ...Object.keys(stock).filter(g => (stock[g] ?? 0) >= 0.05),
  ]);
  return [...goods]
    .filter(g => GOODS[g])
    .map(g => {
      const net = netOf(mine, g);
      const marketNet = net + others.reduce((a, l) => a + netOf(l, g), 0);
      const store = stock[g] ?? 0;
      return {
        good: g,
        made: grouped(mine.made[g] ?? []),
        used: grouped(mine.used[g] ?? []).reverse(),
        traded: mine.traded[g] ?? 0,
        net,
        store,
        marketNet,
        turnsLeft: marketNet < -1e-9 ? Math.floor(store / -marketNet) : null,
      };
    })
    .sort(
      (a, b) =>
        (GOODS[a.good].kind ?? '').localeCompare(GOODS[b.good].kind ?? '') ||
        a.good.localeCompare(b.good),
    );
}

function flowWhy(f: GoodFlow, market: number): Why {
  const lines = [...f.made, ...f.used].map(l => ({ label: l.label, value: round1(l.value) }));
  if (f.traded) lines.push({ label: 'Trade deals', value: round1(f.traded) });
  const parts: string[] = [];
  if (market > 1 && Math.abs(f.marketNet - f.net) > 0.05)
    parts.push(`Market of ${market}: ${f.marketNet >= 0 ? '+' : ''}${round1(f.marketNet)} a turn.`);
  parts.push(
    `Store ${Math.floor(f.store)}${f.turnsLeft !== null ? `: ${f.turnsLeft ? `out in ${f.turnsLeft} turns` : 'out'}` : ''}.`,
  );
  return { total: round1(f.net), lines: lines.filter(l => l.value), note: parts.join(' ') };
}

/** "Why −1 hides?": a good's makers and users in one settlement. */
export function whyCityGood(s: GameState, c: City, g: string, e = cityEconomy(s, c)): Why {
  const f = cityGoodFlows(s, c, e).find(x => x.good === g);
  if (!f) return { total: 0, lines: [] };
  return flowWhy(f, marketCities(s, c).length);
}

/** The goods lines for one settlement, unrounded, for checks: net = Σ made + Σ used + traded. */
export function cityGoodNetRaw(s: GameState, c: City, g: string, e = cityEconomy(s, c)) {
  const l = goodLines(s, c, e);
  return {
    net: netOf(l, g),
    made: l.made[g] ?? [],
    used: l.used[g] ?? [],
    traded: l.traded[g] ?? 0,
  };
}

/** A good across the realm, by building kind, hearths, homes, army and trade (the Goods ledger). */
export function whyRealmGood(s: GameState, civId: number, g: string): Why {
  const made: { label: string; value: number }[] = [];
  const used: { label: string; value: number }[] = [];
  let traded = 0;
  let stock = 0;
  for (const c of s.cities) {
    if (c.civId !== civId) continue;
    const l = goodLines(s, c, cityEconomy(s, c));
    made.push(...(l.made[g] ?? []));
    used.push(...(l.used[g] ?? []));
    traded += l.traded[g] ?? 0;
    stock += Math.max(0, c.stockpile[g] ?? 0);
  }
  // the realm's lines count each building kind once ("Tannery ×3")
  const lines = [...grouped(made), ...grouped(used).reverse()].map(l => ({
    label: l.label,
    value: round1(l.value),
  }));
  if (traded) lines.push({ label: 'Trade deals', value: round1(traded) });
  const net =
    made.reduce((a, x) => a + x.value, 0) + used.reduce((a, x) => a + x.value, 0) + traded;
  const out = net < -1e-9 ? Math.floor(stock / -net) : null;
  return {
    total: round1(net),
    lines: lines.filter(l => l.value),
    note: `Store ${Math.floor(stock)}${out !== null ? `: ${out ? `out in ${out} turns` : 'out'}` : ''}.`,
  };
}
