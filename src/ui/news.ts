/**
 * Turn news for the player: each line sorted as urgent, to act on, or for information, and
 * linked to what it is about (a settlement, a unit, or the screen that deals with it), so an
 * alert can take the player there in one click.
 */
import type { GameState } from '../engine/types.ts';

export type NewsGroup = 'urgent' | 'act' | 'info';

export type NewsTarget =
  | { kind: 'city'; id: number; hex: number }
  | { kind: 'formation'; id: number; hex: number }
  | {
      kind: 'dialog';
      dialog:
        | 'peoples'
        | 'research'
        | 'goods'
        | 'nation'
        | 'faith'
        | 'wonders'
        | 'crisis'
        | 'dynasties'
        | 'culture'
        | 'victory';
    };

const URGENT =
  /declared war on|captured .* from|pillaged|massing troops|besieged|is starving|strikes the|lost the race|rides toward|Warning:|wakes:|cede |civil war|rises against|joined their allies against/i;
const ACT =
  /finished|Research complete|A new age|choose|Give it to a house|is complete in|takes up a new tenet|Found a faith|offer|ask for peace|can now|trinket|Smoke in the hills/i;

export function classify(text: string): NewsGroup {
  if (URGENT.test(text)) return 'urgent';
  if (ACT.test(text)) return 'act';
  return 'info';
}

/** What a line of news is about, if anything the player can go to. */
export function locate(s: GameState, civId: number, text: string): NewsTarget | null {
  // the player's own units first, by name (longest first so "1st Levy Guard" beats "1st Levy")
  const units = s.formations
    .filter(f => f.civId === civId && f.name.length > 3 && text.includes(f.name))
    .sort((a, b) => b.name.length - a.name.length);
  if (units[0] && !/scattered|destroyed|lost/.test(text))
    return { kind: 'formation', id: units[0].id, hex: units[0].hex };
  // settlements: the player's, then those it knows
  const known = s.civs[civId].explored;
  const towns = s.cities
    .filter(c => text.includes(c.name) && (c.civId === civId || known[c.hex]))
    .sort(
      (a, b) =>
        Number(b.civId === civId) - Number(a.civId === civId) || b.name.length - a.name.length,
    );
  if (towns[0]) return { kind: 'city', id: towns[0].id, hex: towns[0].hex };
  // otherwise the screen that deals with it
  if (/research|learned/i.test(text)) return { kind: 'dialog', dialog: 'research' };
  if (/faith|tenet/i.test(text)) return { kind: 'dialog', dialog: 'faith' };
  if (/wonder|completed? the/i.test(text)) return { kind: 'dialog', dialog: 'wonders' };
  if (/crisis|plague|famine|schism|strikes|debt/i.test(text))
    return { kind: 'dialog', dialog: 'crisis' };
  if (/short of|goods|market/i.test(text)) return { kind: 'dialog', dialog: 'goods' };
  if (/House |trinket|governor/i.test(text)) return { kind: 'dialog', dialog: 'dynasties' };
  if (/\bage\b|direction|policy|edict/i.test(text)) return { kind: 'dialog', dialog: 'nation' };
  if (/goal|victory/i.test(text)) return { kind: 'dialog', dialog: 'victory' };
  if (/upheaval|culture/i.test(text)) return { kind: 'dialog', dialog: 'culture' };
  if (s.civs.some(c => c.id !== civId && !c.raiders && text.includes(c.name)))
    return { kind: 'dialog', dialog: 'peoples' };
  return null;
}

/** A turn's news, grouped: urgent first. */
export function groupNews(lines: string[]): Record<NewsGroup, string[]> {
  const out: Record<NewsGroup, string[]> = { urgent: [], act: [], info: [] };
  for (const l of lines) out[classify(l)].push(l);
  return out;
}

export const GROUP_NAME: Record<NewsGroup, string> = {
  urgent: 'Needs you now',
  act: 'To act on',
  info: 'For your information',
};
