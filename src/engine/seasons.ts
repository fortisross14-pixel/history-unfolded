import type { Character, Season, SeasonAward, WorldState } from '../types.ts';
import { displayYear } from './util.ts';
import { fullName } from './characters.ts';
import { idx } from './lookup.ts';

/** Province owners as a compact string: one base-36 id per province, empty for nobody. */
export function encodeOwners(s: WorldState) {
  return s.provinces.map(p => (p.ownerId ? p.ownerId.toString(36) : '')).join(',');
}

export function decodeOwners(map: string) {
  return map.split(',').map(x => (x ? parseInt(x, 36) : null));
}

/** Fame a character earned from deeds inside the century. */
const fameIn = (ch: Character, from: number, to: number) =>
  ch.deeds.filter(d => d.year > from && d.year <= to).reduce((n, d) => n + d.fame, 0);

function bestCharacter(s: WorldState, from: number, to: number, roles: Character['role'][] | null) {
  let best: { ch: Character; fame: number } | null = null;
  for (const ch of s.characters) {
    if (roles && !roles.includes(ch.role) && !(ch.formerRole && roles.includes(ch.formerRole)))
      continue;
    if (ch.born > to || (ch.died !== undefined && ch.died <= from)) continue;
    const fame = fameIn(ch, from, to);
    if (fame > 0 && (!best || fame > best.fame)) best = { ch, fame };
  }
  return best;
}

/** Awards for one century: ruler, Great War, rising power, explorer, and the century's star. */
function awards(s: WorldState, from: number, to: number): SeasonAward[] {
  const out: SeasonAward[] = [];
  const ruler = bestCharacter(s, from, to, ['Ruler']);
  if (ruler)
    out.push({
      title: 'Ruler of the Century',
      kind: 'character',
      id: ruler.ch.id,
      name: fullName(ruler.ch),
      reason: `${ruler.ch.deeds.filter(d => d.year > from && d.year <= to).sort((a, b) => b.fame - a.fame)[0]?.text ?? 'A great reign'}`,
    });
  const wars = s.wars.filter(w => w.great && w.startYear <= to && (w.endYear ?? s.year) > from);
  const war = wars.sort(
    (a, b) =>
      b.territoriesChanged * 3 +
      b.keyBattles.length * 5 +
      (b.attackerLosses + b.defenderLosses) / 1000 -
      (a.territoriesChanged * 3 +
        a.keyBattles.length * 5 +
        (a.attackerLosses + a.defenderLosses) / 1000),
  )[0];
  if (war)
    out.push({
      title: 'Great War of the Century',
      kind: 'war',
      id: war.id,
      name: war.name,
      reason: `${war.keyBattles.length} key battles, ${war.territoriesChanged} provinces changed hands`,
    });
  // Rising power: the biggest gain in power share since the last century mark.
  const before = s.evolutionSnapshots.find(x => x.year === from);
  const after = s.evolutionSnapshots.find(x => x.year === to);
  if (before && after) {
    const rise = after.realms
      .filter(r => before.realms.some(b => b.realmId === r.realmId))
      .map(r => ({
        r,
        gain: r.greatPower - (before.realms.find(b => b.realmId === r.realmId)?.greatPower ?? 0),
      }))
      .sort((a, b) => b.gain - a.gain)[0];
    if (rise && rise.gain > 0)
      out.push({
        title: 'Rising Power',
        kind: 'realm',
        id: rise.r.realmId,
        name: rise.r.name,
        reason: `Power share up ${(rise.gain / 10).toFixed(1)} points, to ${(rise.r.greatPower / 10).toFixed(1)}%`,
      });
  }
  const explorer = bestCharacter(s, from, to, ['Explorer', 'Admiral']);
  if (explorer)
    out.push({
      title: 'Greatest Explorer',
      kind: 'character',
      id: explorer.ch.id,
      name: fullName(explorer.ch),
      reason:
        explorer.ch.deeds
          .filter(d => d.year > from && d.year <= to)
          .sort((a, b) => b.fame - a.fame)[0]?.text ?? 'Sailed far',
    });
  const star = bestCharacter(s, from, to, null);
  if (star && star.ch.id !== ruler?.ch.id)
    out.push({
      title: 'Figure of the Century',
      kind: 'character',
      id: star.ch.id,
      name: fullName(star.ch),
      reason: `${star.ch.rarity} ${star.ch.role.toLowerCase()} · ${star.fame} fame this century`,
    });
  return out;
}

/** Closes the century that ends this year (called right after the century snapshot). */
export function closeSeason(s: WorldState) {
  const to = s.year;
  const from = to - 100;
  const previous = s.seasons.at(-1);
  const mapAfter = encodeOwners(s);
  const mapBefore = previous?.mapAfter ?? mapAfter;
  const ids = new Set(
    [...decodeOwners(mapBefore), ...decodeOwners(mapAfter)].filter((x): x is number => x !== null),
  );
  const palette = [...ids].map(id => {
    const c = idx(s).civ.get(id);
    return { id, name: c?.name ?? 'Lost realm', color: c?.color ?? '#555' };
  });
  const headlines = s.events
    .filter(e => e.year > from && e.year <= to && e.worldChronicle)
    .sort((a, b) => b.importance - a.importance || b.year - a.year)
    .slice(0, 8)
    .map(e => ({ year: e.year, title: e.title, text: e.description }));
  const season: Season = {
    year: to,
    headlines,
    mapBefore,
    mapAfter,
    palette,
    awards: awards(s, from, to),
    realmsBefore:
      previous?.realmsAfter ?? new Set(decodeOwners(mapBefore).filter(x => x !== null)).size,
    realmsAfter: s.civilizations.filter(c => c.provinces.length).length,
  };
  s.seasons.push(season);
}

export const seasonTitle = (year: number) => {
  const n = Math.ceil(year / 100);
  if (year <= 0)
    return `${Math.abs(Math.floor((year - 1) / 100))}${ordinal(Math.abs(Math.floor((year - 1) / 100)))} century BCE`;
  return `${n}${ordinal(n)} century`;
};

function ordinal(n: number) {
  const t = n % 100;
  if (t >= 11 && t <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

/** Span of years a season covers, for display. */
export const seasonSpan = (year: number) => `${displayYear(year - 99)}–${displayYear(year)}`;
