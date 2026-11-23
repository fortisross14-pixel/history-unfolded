/**
 * "Why?" for the player's main numbers: where this turn's gold, science and culture come from,
 * line by line, as the end of the turn will count them (before random events and one-off sums).
 */
import { cityEconomy } from './economy.ts';
import { faithIncome } from './faith.ts';
import { cohortUpkeep } from './game.ts';
import { tributeTo } from './independents.ts';
import { civMods, pct } from './mods.ts';
import { wonderCulture } from './wonders.ts';
import type { GameState } from './types.ts';

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
