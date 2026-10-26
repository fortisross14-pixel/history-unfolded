import type { GreatPerson, Religion, Civilization, WorldState } from '../types.ts';
import { chooseDatabase } from './naming.ts';
import { RNG } from './rng.ts';
import { REAL_RELIGIONS, FICTIONAL_RELIGIONS } from './data.ts';
import { addEvent } from './events.ts';

export function foundReligion(s: WorldState, c: Civilization, p: GreatPerson, r: RNG) {
  if (s.religions.length >= 6 || p.religionId) return;
  const city = s.cities.find(x => x.id === c.capitalCityId);
  const holyProvince = city?.provinceId ?? c.provinces[0];
  if (holyProvince === undefined) return;
  const place = city?.name ?? `${c.originTribe} homeland`;
  const founderBase = p.name
    .split(' ')
    .at(-1)!
    .replace(/[^A-Za-z]/g, '');
  const religionPool = chooseDatabase(s.config.nameMode, r) ? REAL_RELIGIONS : FICTIONAL_RELIGIONS;
  const availableReligionNames = religionPool.filter(n => !s.religions.some(rel => rel.name === n));
  const name = r.chance(0.42)
    ? `${founderBase}${r.pick(['ism', 'ianism', 'ite Faith'])}`
    : availableReligionNames.length
      ? r.pick(availableReligionNames)
      : `${c.originTribe} ${r.pick(['Covenant', 'Way', 'Faith', 'Tradition'])}`;
  const rel: Religion = {
    id: s.nextIds.religion++,
    name,
    color: `hsl(${r.int(0, 359)} 60% 58%)`,
    followers: Math.max(40, Math.round(c.population * 0.35)),
    founded: s.year,
    founderPersonId: p.id,
    holyProvinceIds: [holyProvince],
    doctrine: r.pick([
      'Harmony and learning',
      'Sacred law',
      'Pilgrimage and charity',
      'Ancestral wisdom',
      'Universal salvation',
    ]),
    expansion: r.int(35, 90),
    loyalty: r.int(40, 95),
    tolerance: r.int(20, 85),
    schismIds: [],
    provinces: 1,
  };
  s.religions.push(rel);
  s.provinces[holyProvince].holySiteReligionIds.push(rel.id);
  s.provinces[holyProvince].religionId = rel.id;
  c.faithId = rel.id;
  p.religionId = rel.id;
  p.followersGained += rel.followers;
  p.impact += 30;
  p.careerMilestones.push('founded-religion');
  p.achievement = `Founded ${rel.name}`;
  if (city) city.religiousImportance += 30;
  addEvent(
    s,
    'religion',
    `${rel.name} is founded`,
    `${p.name} founded ${rel.name} at ${place}, which became its first holy site.`,
    10,
    [c.id],
    {
      personIds: [p.id],
      cityIds: city ? [city.id] : [],
      religionIds: [rel.id],
      tags: ['religion founded', 'holy site'],
      worldChronicle: true,
    },
  );
}

export function processOfficialConversion(s: WorldState, c: Civilization, r: RNG) {
  const owned = c.provinces.map(id => s.provinces[id]).filter(Boolean);
  if (!owned.length) return;
  const totals = new Map<number, number>();
  let pagan = 0;
  for (const p of owned) {
    if (p.religionId === null) pagan += p.population;
    else totals.set(p.religionId, (totals.get(p.religionId) ?? 0) + p.population);
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const candidate = ranked[0];
  if (candidate) {
    const share = candidate[1] / Math.max(1, c.population),
      currentShare = c.faithId ? (totals.get(c.faithId) ?? 0) / Math.max(1, c.population) : 0;
    const eraBonus = s.year >= 0 && s.year <= 1600 ? 0.1 : s.year > 1600 ? 0.025 : 0;
    if (
      candidate[0] !== c.faithId &&
      share >= 0.38 &&
      r.chance(0.0015 + share * 0.003 + eraBonus * 0.002)
    ) {
      const previous = c.faithId;
      c.faithId = candidate[0];
      for (const p of owned) p.religionId = candidate[0];
      const stabilityChange = share >= 0.55 ? 18 : -16;
      c.stability = Math.max(5, Math.min(100, c.stability + stabilityChange));
      addEvent(
        s,
        'religion',
        `${c.name} converts`,
        `${c.name} officially adopted ${s.religions.find(x => x.id === candidate[0])?.name ?? 'a new faith'}. ${share >= 0.55 ? 'The conversion reflected the majority faith and strengthened stability.' : 'The imposed conversion divided the realm and reduced stability.'}`,
        8,
        [c.id],
        {
          religionIds: [candidate[0], ...(previous ? [previous] : [])],
          tags: ['official conversion'],
          worldChronicle: share >= 0.55,
        },
      );
    }
  }
  if (s.year > 1600 && pagan / c.population < 0.35 && r.chance(0.0012 + (s.year - 1600) / 200000)) {
    const count = Math.max(1, Math.ceil(owned.length * 0.08));
    for (const p of [...owned].sort(() => r.next() - 0.5).slice(0, count)) p.religionId = null;
    addEvent(
      s,
      'religion',
      `Agnostic thought spreads in ${c.name}`,
      `Secular and agnostic ideas reduced organized religious affiliation across ${count} province${count === 1 ? '' : 's'}.`,
      5,
      [c.id],
      { tags: ['agnosticism', 'secularization'] },
    );
  }
}
