import type { Character, Reign, WorldState } from '../types.ts';
import { displayYear } from '../engine/index.ts';
import { TRAITS } from '../engine/traits.ts';
import { describeMods } from '../engine/legacy.ts';
import { type Sel, fmt, pct, Metrics, Section, List } from './shared.tsx';

const RARITY_CLASS: Record<Character['rarity'], string> = {
  Common: 'rarity-common',
  Rare: 'rarity-rare',
  Epic: 'rarity-epic',
  Legend: 'rarity-legend',
  Generational: 'rarity-generational',
};

export function RarityBadge({ rarity }: { rarity: Character['rarity'] }) {
  return <span className={`rarity-badge ${RARITY_CLASS[rarity]}`}>{rarity}</span>;
}

const DEATH_TEXT: Record<NonNullable<Character['deathCause']>, string> = {
  age: 'Died of old age',
  battle: 'Fell in battle',
  illness: 'Died of illness',
  assassination: 'Assassinated',
  executed: 'Executed',
};

/** Start → end of one reign, like a season stat line. */
function ReignCard({ reign, world }: { reign: Reign; world: WorldState }) {
  const realm = world.civilizations.find(c => c.id === reign.realmId);
  const live = reign.end === undefined && realm;
  const end = {
    provinces: reign.endProvinces ?? (live ? realm.provinces.length : reign.startProvinces),
    wealth: reign.endWealth ?? (live ? realm.wealth : reign.startWealth),
    breakthroughs:
      reign.endBreakthroughs ?? (live ? realm.breakthroughs.length : reign.startBreakthroughs),
    development: reign.endDevelopment ?? (live ? realm.development : reign.startDevelopment),
  };
  const delta = (a: number, b: number) => `${b - a >= 0 ? '+' : ''}${fmt(b - a)}`;
  const rows: [string, string, string, string][] = [
    [
      'Territory',
      fmt(reign.startProvinces),
      fmt(end.provinces),
      delta(reign.startProvinces, end.provinces),
    ],
    ['Wealth', fmt(reign.startWealth, 1), fmt(end.wealth, 1), pct(reign.startWealth, end.wealth)],
    [
      'Breakthroughs',
      fmt(reign.startBreakthroughs),
      fmt(end.breakthroughs),
      delta(reign.startBreakthroughs, end.breakthroughs),
    ],
    [
      'Development',
      fmt(reign.startDevelopment),
      fmt(end.development),
      pct(reign.startDevelopment, end.development),
    ],
  ];
  return (
    <div className="reign-card">
      <div className="reign-card-head">
        <strong>{realm?.name ?? 'A lost realm'}</strong>
        <span>
          {displayYear(reign.start)}–{reign.end !== undefined ? displayYear(reign.end) : 'present'}{' '}
          · {(reign.end ?? world.year) - reign.start} years
          {reign.regentId ? ' · began under a regency' : ''}
        </span>
      </div>
      <table className="reign-table">
        <thead>
          <tr>
            <th />
            <th>Start</th>
            <th>End</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b, d]) => (
            <tr key={label}>
              <td>{label}</td>
              <td>{a}</td>
              <td>{b}</td>
              <td className={d.startsWith('-') ? 'neg' : 'pos'}>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {reign.endReason && <small>Reign ended: {reign.endReason}</small>}
    </div>
  );
}

export function CharacterPage({
  ch,
  world,
  open,
}: {
  ch: Character;
  world: WorldState;
  open: (s: Sel) => void;
}) {
  const realm = world.civilizations.find(c => c.id === ch.realmId);
  const dynasty = world.dynasties.find(d => d.id === ch.dynastyId);
  const reigns = world.reigns.filter(r => r.characterId === ch.id);
  const legacies = world.legacies.filter(l => l.characterId === ch.id);
  const relative = (id: number | undefined) =>
    id ? world.characters.find(x => x.id === id) : undefined;
  const parents = ch.parentIds.map(relative).filter((x): x is Character => !!x);
  const children = world.characters.filter(x => x.parentIds.includes(ch.id));
  const mentor = relative(ch.mentorId);
  const spouse = relative(ch.spouseId);
  const age = (ch.died ?? world.year) - ch.born;
  const family = [
    ...parents.map(p => ({ who: p, label: 'Parent' })),
    ...(spouse ? [{ who: spouse, label: 'Spouse' }] : []),
    ...children.map(p => ({ who: p, label: 'Child' })),
    ...(mentor ? [{ who: mentor, label: 'Mentor' }] : []),
  ];
  return (
    <>
      <div className="career-hero">
        <RarityBadge rarity={ch.rarity} />
        <span className="career-role">
          {ch.role}
          {ch.formerRole ? ` (formerly ${ch.formerRole.toLowerCase()})` : ''}
        </span>
        {ch.nickname && <span className="career-nick">“{ch.nickname}”</span>}
      </div>
      <Metrics
        vals={[
          ['Skill', `${ch.skill}/100`],
          ['Fame', fmt(ch.fame)],
          ['Age', `${age}`],
          [
            'Status',
            ch.died === undefined
              ? 'Alive'
              : `${DEATH_TEXT[ch.deathCause ?? 'age']} ${displayYear(ch.died)}`,
          ],
        ]}
      />
      <Section title="Traits">
        <div className="trait-list">
          {ch.traits.map(t => (
            <div className="trait" key={t}>
              <strong>{t}</strong>
              <small>{TRAITS[t].effect}</small>
            </div>
          ))}
        </div>
      </Section>
      {ch.ambition && (
        <Section title="Life ambition">
          <p className={`ambition ${ch.ambition.status}`}>
            <b>{ch.ambition.label}</b> ·{' '}
            {ch.ambition.status === 'pending'
              ? `pursuing until ${displayYear(ch.ambition.deadline)}`
              : ch.ambition.status === 'achieved'
                ? `achieved ${displayYear(ch.ambition.resolvedYear ?? world.year)}`
                : `failed ${displayYear(ch.ambition.resolvedYear ?? world.year)}`}
          </p>
        </Section>
      )}
      {legacies.length > 0 && (
        <Section title="Legacies">
          <List
            items={legacies.map(l => ({
              name: `${l.name}${l.end >= world.year ? '' : ' (faded)'}`,
              sub: `${describeMods(l.mods)} · ${displayYear(l.start)}–${displayYear(l.end)}`,
              onClick: () => open({ type: 'realm', id: l.realmId }),
            }))}
          />
        </Section>
      )}
      {reigns.length > 0 && (
        <Section title="Reign report card">
          {reigns.map(r => (
            <ReignCard reign={r} world={world} key={r.id} />
          ))}
        </Section>
      )}
      <Section title="Timeline">
        <ol className="timeline">
          <li>
            <time>{displayYear(ch.born)}</time>
            <span>
              Born{dynasty ? ` into the ${dynasty.name}` : ''}
              {realm ? ` in ${realm.name}` : ''}
            </span>
          </li>
          {ch.deeds.map((d, i) => (
            <li key={i} className={d.fame >= 10 ? 'major' : ''}>
              <time>{displayYear(d.year)}</time>
              <span>{d.text}</span>
            </li>
          ))}
          {ch.died !== undefined && (
            <li>
              <time>{displayYear(ch.died)}</time>
              <span>
                {DEATH_TEXT[ch.deathCause ?? 'age']} aged {age}
              </span>
            </li>
          )}
        </ol>
      </Section>
      {family.length > 0 && (
        <Section title="Family and mentors">
          <List
            items={family.map(({ who, label }) => ({
              name: `${who.name}${who.nickname ? ` ${who.nickname}` : ''}`,
              sub: `${label} · ${who.rarity} ${who.role.toLowerCase()} · ${displayYear(who.born)}–${who.died !== undefined ? displayYear(who.died) : ''}`,
              onClick: () => open({ type: 'character', id: who.id }),
            }))}
          />
        </Section>
      )}
      <Section title="Realm">
        <List
          items={[
            ...(realm
              ? [
                  {
                    name: realm.name,
                    sub: `${realm.rank} · ${realm.government}`,
                    onClick: () => open({ type: 'realm', id: realm.id }),
                  },
                ]
              : []),
            ...(dynasty
              ? [
                  {
                    name: dynasty.name,
                    sub: `Founded ${displayYear(dynasty.foundedYear)} · ${dynasty.status}`,
                    onClick: () => open({ type: 'dynasty', id: dynasty.id }),
                  },
                ]
              : []),
          ]}
        />
      </Section>
    </>
  );
}
