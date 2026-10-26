import type { Civilization, Relation, RelationType, WorldState } from '../types.ts';
import { RNG } from './rng.ts';
import { addEvent } from './events.ts';
import { idx } from './lookup.ts';
import type { ModTotals } from './modifiers.ts';
import { topPowers } from './power.ts';

/** Years of peace forced after a war ends. */
export const TRUCE_YEARS = 20;

export const involves = (rel: Relation, id: number) => rel.a === id || rel.b === id;
export const other = (rel: Relation, id: number) => (rel.a === id ? rel.b : rel.a);

export function relationsOf(s: WorldState, id: number, type?: RelationType) {
  return s.relations.filter(rel => involves(rel, id) && (!type || rel.type === type));
}

export function findRelation(s: WorldState, a: number, b: number, type: RelationType) {
  return s.relations.find(rel => rel.type === type && involves(rel, a) && involves(rel, b));
}

export function addRelation(
  s: WorldState,
  type: RelationType,
  a: number,
  b: number,
  reason: string,
  extra: Partial<Relation> = {},
) {
  const existing = findRelation(s, a, b, type);
  if (existing) return existing;
  const rel: Relation = { id: s.nextIds.relation++, type, a, b, since: s.year, reason, ...extra };
  s.relations.push(rel);
  return rel;
}

export function endRelation(s: WorldState, rel: Relation) {
  s.relations = s.relations.filter(x => x.id !== rel.id);
}

const living = (s: WorldState, id: number) => {
  const c = idx(s).civ.get(id);
  return c && c.provinces.length ? c : undefined;
};

export const alliesOf = (s: WorldState, c: Civilization) =>
  relationsOf(s, c.id, 'Alliance')
    .map(rel => living(s, other(rel, c.id)))
    .filter((x): x is Civilization => !!x);

export const overlordOf = (s: WorldState, c: Civilization) => {
  const rel = s.relations.find(x => x.type === 'Vassal' && x.b === c.id);
  return rel ? living(s, rel.a) : undefined;
};

export const vassalsOf = (s: WorldState, c: Civilization) =>
  s.relations
    .filter(x => x.type === 'Vassal' && x.a === c.id)
    .map(x => living(s, x.b))
    .filter((x): x is Civilization => !!x);

/** Whether a can declare war on b at all. */
export function canAttack(s: WorldState, a: Civilization, b: Civilization) {
  if (overlordOf(s, a)) return false;
  for (const type of ['Truce', 'Alliance', 'Vassal', 'Marriage'] as RelationType[])
    if (findRelation(s, a.id, b.id, type)) return false;
  return true;
}

/** Records the end of a war: a truce, and a rivalry that grows with each war. */
export function afterWar(s: WorldState, a: Civilization, b: Civilization) {
  addRelation(s, 'Truce', a.id, b.id, 'Peace treaty', { until: s.year + TRUCE_YEARS });
  const rival = addRelation(s, 'Rival', a.id, b.id, 'Old enemies');
  rival.wars = (rival.wars ?? 0) + 1;
  for (const rel of [findRelation(s, a.id, b.id, 'Alliance')]) if (rel) endRelation(s, rel);
}

function announce(s: WorldState, title: string, text: string, ids: number[], importance = 5) {
  addEvent(s, 'diplomacy', title, text, importance, ids, { tags: ['diplomacy'] });
}

/** Expired truces and fading rivalries; called once per year. */
export function diplomacyUpkeep(s: WorldState) {
  s.relations = s.relations.filter(rel => {
    if (!living(s, rel.a) || !living(s, rel.b)) return false;
    if (rel.until !== undefined && rel.until < s.year) return false;
    // Rivalries without a war for 150 years fade away.
    if (rel.type === 'Rival' && s.year - rel.since > 150 + (rel.wars ?? 0) * 60) return false;
    return true;
  });
}

/** Yearly diplomacy for one realm: alliances, rivalries, vassals. */
export function diplomacyYear(
  s: WorldState,
  c: Civilization,
  neighbors: Civilization[],
  mods: ModTotals,
  r: RNG,
) {
  const allies = relationsOf(s, c.id, 'Alliance');
  // New alliances: shared rivals, shared faith and royal marriages bring realms together.
  if (allies.length < 2 && r.chance(0.006 * Math.max(0.2, 1 + mods.diplomacy))) {
    const rivals = new Set(relationsOf(s, c.id, 'Rival').map(x => other(x, c.id)));
    const candidates = c.knownRealmIds
      .map(id => living(s, id))
      .filter(
        (x): x is Civilization =>
          !!x &&
          !rivals.has(x.id) &&
          canAttack(s, c, x) &&
          relationsOf(s, x.id, 'Alliance').length < 3,
      )
      .map(x => {
        const sharedRival = relationsOf(s, x.id, 'Rival').some(rel => rivals.has(other(rel, x.id)));
        const married = !!findRelation(s, c.id, x.id, 'Marriage');
        const score =
          1 +
          (sharedRival ? 4 : 0) +
          (married ? 3 : 0) +
          (x.faithId && x.faithId === c.faithId ? 2 : 0) +
          (neighbors.includes(x) ? 1 : 0);
        return { x, score };
      });
    const total = candidates.reduce((n, o) => n + o.score, 0);
    let roll = r.next() * total;
    for (const { x, score } of candidates) {
      roll -= score;
      if (roll > 0) continue;
      addRelation(s, 'Alliance', c.id, x.id, 'Mutual interest');
      announce(
        s,
        `${c.name} and ${x.name} form an alliance`,
        `${c.name} and ${x.name} pledged to defend one another.`,
        [c.id, x.id],
      );
      break;
    }
  }
  for (const rel of allies) if (r.chance(0.003)) endRelation(s, rel);
  // A dominant power frightens its neighbours into rivalry (and so into coalitions).
  const [top, second] = topPowers(s, 2);
  if (
    top &&
    top.id !== c.id &&
    second &&
    top.power > second.power * 1.5 &&
    neighbors.includes(top) &&
    r.chance(0.02)
  )
    if (!findRelation(s, c.id, top.id, 'Rival') && !findRelation(s, c.id, top.id, 'Vassal')) {
      addRelation(s, 'Rival', c.id, top.id, `Fear of ${top.name}`);
      announce(
        s,
        `${c.name} fears ${top.name}`,
        `The rise of ${top.name} has turned ${c.name} into a wary rival, looking for allies.`,
        [c.id, top.id],
        5,
      );
    }
  // Ambitious neighbours of similar size become rivals.
  if (c.axes.ambition > 60 && r.chance(0.002)) {
    const peer = neighbors.find(
      n =>
        n.axes.ambition > 50 &&
        n.provinces.length > c.provinces.length * 0.5 &&
        n.provinces.length < c.provinces.length * 2,
    );
    if (
      peer &&
      !findRelation(s, c.id, peer.id, 'Rival') &&
      !findRelation(s, c.id, peer.id, 'Alliance')
    ) {
      addRelation(s, 'Rival', c.id, peer.id, 'Border tension');
      announce(
        s,
        `${c.name} and ${peer.name} become rivals`,
        `Two ambitious neighbours, ${c.name} and ${peer.name}, now see each other as the main threat.`,
        [c.id, peer.id],
        6,
      );
    }
  }
  // Vassals pay tribute (see modifiers) and may break free when the overlord falters.
  const lord = s.relations.find(x => x.type === 'Vassal' && x.b === c.id);
  const overlord = lord ? living(s, lord.a) : undefined;
  if (lord && overlord && !lord.union) {
    const weak = overlord.stability < 35 ? 3 : 1;
    if (r.chance(0.003 * (c.axes.ambition / 50) * weak)) {
      endRelation(s, lord);
      addRelation(s, 'Rival', c.id, overlord.id, 'Broke free');
      announce(
        s,
        `${c.name} breaks free of ${overlord.name}`,
        `${c.name} stopped paying tribute and declared its independence from ${overlord.name}.`,
        [c.id, overlord.id],
        7,
      );
    } else if (s.year - lord.since > 120 && c.cultureId === overlord.cultureId && r.chance(0.004)) {
      annexVassal(s, overlord, c);
    }
  }
}

/** A long-loyal vassal of the same culture is absorbed peacefully. */
function annexVassal(s: WorldState, lord: Civilization, vassal: Civilization) {
  for (const id of [...vassal.provinces]) {
    const p = s.provinces[id];
    p.ownerId = lord.id;
    lord.provinces.push(id);
    if (p.cityId) {
      const city = idx(s).city.get(p.cityId);
      if (city) {
        city.currentRealmId = lord.id;
        city.ownershipHistory.at(-1)!.to = s.year;
        city.ownershipHistory.push({ realmId: lord.id, from: s.year });
        lord.cityIds.push(city.id);
      }
    }
  }
  lord.population += vassal.population;
  lord.gdp += vassal.gdp;
  vassal.provinces = [];
  vassal.cityIds = [];
  s.relations = s.relations.filter(x => !involves(x, vassal.id));
  addEvent(
    s,
    'diplomacy',
    `${lord.name} absorbs ${vassal.name}`,
    `After generations as a loyal vassal, ${vassal.name} was peacefully integrated into ${lord.name}.`,
    8,
    [lord.id, vassal.id],
    {
      tags: ['diplomacy', 'annexation'],
      worldChronicle: true,
    },
  );
}
