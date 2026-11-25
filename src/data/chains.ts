/**
 * Production chains, worked out from the data: for every good, what makes it (buildings, the
 * deposits they work, open land) and what uses it (buildings' inputs and build costs, gear,
 * comforts, hearths, wonders). The Codex and scripts/chaincheck.ts both read this, so neither
 * can drift from the game.
 */
import { DEPOSITS, GOODS, isComfort } from './goods.ts';
import { ITEM_LIST } from './items.ts';
import { RURAL_GROUPS, SLOT_TYPES, type SlotType } from './slots.ts';
import { TECHS } from './techs.ts';
import { VEGETATION } from './terrain.ts';
import { WONDER_LIST } from './wonders.ts';

/** What cities burn in their hearths, best first (economy.ts: coal, else wood). */
export const HEARTH_FUEL = ['coal', 'wood'];

export type RefKind =
  | 'building'
  | 'deposit'
  | 'land'
  | 'input'
  | 'build'
  | 'gear'
  | 'powder'
  | 'comfort'
  | 'hearth'
  | 'wonder'
  | 'food';

export interface ChainRef {
  kind: RefKind;
  /** the Codex entry it points at (building-…, gear-…, good-…), if any */
  entry?: string;
  name: string;
  /** the deposit worked, for a deposit source */
  deposit?: string;
  /** a unit a turn (sources, inputs) or per cohort / per building (costs) */
  amount?: number;
  /** techs it needs */
  techs: string[];
  /** a few words on how */
  how: string;
}

const techName = (t: string) => TECHS[t]?.name ?? t;
const eraOf = (techs: string[]) => techs.reduce((a, t) => Math.max(a, TECHS[t]?.era ?? 1), 1);
const goodName = (g: string) => GOODS[g]?.name ?? g;
const list = (o: Record<string, number> | undefined) =>
  Object.entries(o ?? {})
    .map(([g, n]) => `${n} ${goodName(g).toLowerCase()}`)
    .join(', ');

/** Where a building may stand, in a few words. */
export function whereBuilt(t: SlotType): string {
  const bits: string[] = [];
  if (t.centreRow) bits.push('the centre row, one per settlement');
  else if (t.needs?.centre) bits.push('the centre');
  if (RURAL_GROUPS.includes(t.group)) bits.push('towns only (rural)');
  if (t.needs?.water) bits.push('by a coast or lake');
  if (t.needs?.land?.relief) bits.push(`with ${t.needs.land.relief.join(' or ')} on the land`);
  if (t.needs?.land?.terrain) bits.push(`on ${t.needs.land.terrain.join(' or ')}`);
  if (t.needs?.deposit)
    bits.push(`by ${t.needs.deposit.map(d => DEPOSITS[d]?.name ?? d).join(' or ')}`);
  if (t.role === 'great') bits.push('one in the realm');
  if (t.role === 'multiplier') bits.push('one per district');
  return bits.length ? bits.join('; ') : 'any district';
}

/** Every way to get a good. */
export function goodSources(g: string): ChainRef[] {
  const out: ChainRef[] = [];
  const food = GOODS[g]?.kind === 'food';
  for (const t of Object.values(SLOT_TYPES)) {
    const n = t.out.goods?.[g] ?? 0;
    const alt = t.alt?.out.goods?.[g] ?? 0;
    if (!n && !alt) continue;
    const from = list(n ? t.inputs : t.alt?.inputs);
    out.push({
      kind: 'building',
      entry: `building-${t.id}`,
      name: t.name,
      amount: n || alt,
      techs: t.tech ? [t.tech] : [],
      how: `${n || alt} a turn${from ? ` from ${from}` : ''}, ${t.fixed ? 'every settlement' : t.tech ? techName(t.tech) : 'from the start'}`,
    });
  }
  for (const [id, d] of Object.entries(DEPOSITS)) {
    const n = d.gives.goods?.[g] ?? 0;
    const feeds = food && d.yields[g] && d.gives.food;
    if (!n && !feeds) continue;
    const by = SLOT_TYPES[d.by];
    const techs = [by?.tech, d.tech, d.revealedBy].filter((x): x is string => !!x);
    const need = [d.tech, d.revealedBy].filter(Boolean).map(t => techName(t!));
    out.push({
      kind: feeds && !n ? 'food' : 'deposit',
      entry: `building-${d.by}`,
      name: `${by?.name ?? d.by} on ${d.name.toLowerCase()}`,
      deposit: id,
      amount: n || d.gives.food,
      techs: [...new Set(techs)],
      how: `+${n || d.gives.food}${n ? '' : ' food'} a turn${d.special ? ', 3+ in the district on the deposit' : ''}${[by?.tech, ...need].filter(Boolean).length ? `, ${[by?.tech ? techName(by.tech) : '', ...need].filter(Boolean).join(', ')}` : ''}`,
    });
  }
  const veg = Object.entries(VEGETATION).filter(([, v]) => g === 'wood' && v.wood > 0);
  if (veg.length)
    out.push({
      kind: 'land',
      name: 'Open land',
      techs: [],
      how: `a town's unbuilt ${veg.map(([, v]) => v.name.toLowerCase()).join(' and ')} hexes`,
    });
  return out;
}

/** Everything that uses a good. */
export function goodUsers(g: string): ChainRef[] {
  const out: ChainRef[] = [];
  for (const t of Object.values(SLOT_TYPES)) {
    const n = t.inputs?.[g] ?? t.alt?.inputs[g] ?? 0;
    if (n)
      out.push({
        kind: 'input',
        entry: `building-${t.id}`,
        name: t.name,
        amount: n,
        techs: t.tech ? [t.tech] : [],
        how: `burns ${n} a turn${list(t.out.goods) ? ` for ${list(t.out.goods)}` : ''}`,
      });
  }
  for (const i of ITEM_LIST) {
    const n = i.cost[g] ?? 0;
    if (n)
      out.push({
        kind: 'gear',
        entry: `gear-${i.id}`,
        name: i.name,
        amount: n,
        techs: i.tech ? [i.tech] : [],
        how: `${n} per ${i.naval ? 'ship' : 'cohort'}`,
      });
    if (i.powder && g === 'saltpeter')
      out.push({
        kind: 'powder',
        entry: `gear-${i.id}`,
        name: `${i.name} (powder)`,
        amount: i.powder,
        techs: i.tech ? [i.tech] : [],
        how: `${i.powder} a turn per cohort`,
      });
  }
  for (const t of Object.values(SLOT_TYPES)) {
    const n = t.build.goods?.[g] ?? 0;
    if (n && !t.fixed)
      out.push({
        kind: 'build',
        entry: `building-${t.id}`,
        name: t.name,
        amount: n,
        techs: t.tech ? [t.tech] : [],
        how: `${n} to build`,
      });
  }
  for (const w of WONDER_LIST) {
    const n = w.goods[g] ?? 0;
    if (n)
      out.push({
        kind: 'wonder',
        entry: `wonder-${w.id}`,
        name: w.name,
        amount: n,
        techs: [w.tech],
        how: `${n} to start`,
      });
  }
  if (isComfort(g))
    out.push({ kind: 'comfort', name: 'Comforts', techs: [], how: 'settlements enjoy it' });
  if (HEARTH_FUEL.includes(g))
    out.push({ kind: 'hearth', name: 'Hearths', techs: [], how: 'cities burn it as fuel' });
  if (GOODS[g]?.kind === 'food')
    out.push({ kind: 'food', name: 'Food', techs: [], how: 'feeds the people' });
  return out;
}

/** The earliest age a good can be had in, by building the right things (inputs included). */
export function goodEra(g: string, seen = new Set<string>()): number {
  if (seen.has(g)) return Infinity;
  seen.add(g);
  let best = Infinity;
  for (const src of goodSources(g)) {
    let era = eraOf(src.techs);
    if (src.kind === 'building') {
      const t = SLOT_TYPES[src.entry!.slice('building-'.length)];
      const ins = t.out.goods?.[g] ? t.inputs : t.alt?.inputs;
      for (const i of Object.keys(ins ?? {})) era = Math.max(era, goodEra(i, new Set(seen)));
    }
    best = Math.min(best, era);
  }
  return best;
}

/** The age a gear piece opens in. */
export const gearEra = (techs: string[]) => eraOf(techs);

/**
 * The chains a good belongs to, as lines like "Hides → Tannery → Leather → Leather armour, …":
 * every building that works it up or makes it from something else, else its sources and users.
 */
export function goodChains(g: string): string[] {
  const usersOf = (x: string) => {
    const u = goodUsers(x).filter(r => r.kind === 'gear' || r.kind === 'input');
    const names = [...new Set(u.map(r => r.name))];
    const comfort = isComfort(x) ? ['comforts'] : [];
    const all = [...names, ...comfort];
    return all.length > 8 ? `${all.slice(0, 8).join(', ')}…` : all.join(', ');
  };
  const out: string[] = [];
  // where it comes from, when the land or a plain building gives it
  const plain = goodSources(g).filter(
    r => r.kind !== 'building' || !Object.keys(SLOT_TYPES[r.entry!.slice(9)].inputs ?? {}).length,
  );
  if (plain.length) {
    const src = [...new Set(plain.map(r => r.name.replace(/ on .*$/, '')))];
    const u = goodUsers(g);
    const gear = [...new Set(u.filter(r => r.kind === 'gear').map(r => r.name))];
    const more = [
      ...(u.some(r => r.kind === 'build') ? ['buildings'] : []),
      ...(u.some(r => r.kind === 'input') && !gear.length
        ? u.filter(r => r.kind === 'input').map(r => r.name)
        : []),
      ...(isComfort(g) ? ['comforts'] : []),
      ...(HEARTH_FUEL.includes(g) ? ['hearths'] : []),
      ...(GOODS[g]?.kind === 'food' ? ['food'] : []),
    ];
    const tail = [...(gear.length > 6 ? [`${gear.slice(0, 6).join(', ')}…`] : gear), ...more].join(
      ', ',
    );
    out.push(`${src.slice(0, 4).join(', ')} → ${goodName(g)}${tail ? ` → ${tail}` : ''}`);
  }
  for (const t of Object.values(SLOT_TYPES)) {
    for (const [ins, outs] of [
      [t.inputs, t.out.goods],
      [t.alt?.inputs, t.alt?.out.goods],
    ] as const) {
      if (!ins || !outs) continue;
      if (!ins[g] && !outs[g]) continue;
      const made = Object.keys(outs);
      if (!made.length) continue;
      const tail = made.map(usersOf).filter(Boolean).join('; ');
      out.push(
        `${Object.keys(ins).map(goodName).join(' + ')} → ${t.name} → ${made.map(goodName).join(' + ')}${tail ? ` → ${tail}` : ''}`,
      );
    }
  }
  return [...new Set(out)];
}
