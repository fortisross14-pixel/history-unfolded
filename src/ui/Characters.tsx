import { useState } from 'react';
import type { Character, CharacterRole, WorldState } from '../types.ts';
import { displayYear } from '../engine/index.ts';
import { rarityRank } from '../engine/traits.ts';
import { type Sel, Table, link } from './shared.tsx';
import { RarityBadge } from './CharacterPage.tsx';

type Filter = 'living' | 'legends' | 'all';

/** A card for each living Legend or Generational character: the stars of the age. */
function Spotlight({ world, open }: { world: WorldState; open: (s: Sel) => void }) {
  const stars = world.characters
    .filter(ch => ch.died === undefined && rarityRank(ch.rarity) >= 3)
    .sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || b.fame - a.fame)
    .slice(0, 8);
  if (!stars.length) return null;
  return (
    <section className="spotlight">
      <span className="eyebrow">Stars of the age</span>
      <div className="spotlight-grid">
        {stars.map(ch => (
          <button
            key={ch.id}
            className={`spotlight-card rarity-${ch.rarity.toLowerCase()}`}
            onClick={() => open({ type: 'character', id: ch.id })}
          >
            <RarityBadge rarity={ch.rarity} />
            <strong>
              {ch.name}
              {ch.nickname ? ` ${ch.nickname}` : ''}
            </strong>
            <span>
              {ch.role} of {world.civilizations.find(c => c.id === ch.realmId)?.name ?? 'exile'}
            </span>
            <small>{ch.traits.join(' · ')}</small>
            {ch.ambition && (
              <em>
                {ch.ambition.status === 'achieved' ? '✓ ' : ''}
                {ch.ambition.label}
              </em>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

export function Characters({ world, open }: { world: WorldState; open: (s: Sel) => void }) {
  const [filter, setFilter] = useState<Filter>('living');
  const [role, setRole] = useState<CharacterRole | 'all'>('all');
  const shown = world.characters.filter(
    (ch: Character) =>
      (filter === 'all' ||
        (filter === 'living' ? ch.died === undefined : rarityRank(ch.rarity) >= 3)) &&
      (role === 'all' || ch.role === role) &&
      ch.role !== 'Consort',
  );
  const roles: CharacterRole[] = [
    'Ruler',
    'Heir',
    'General',
    'Admiral',
    'Explorer',
    'Merchant',
    'Scholar',
    'Prophet',
    'Statesman',
  ];
  return (
    <main className="page characters-page">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">The people who make history</span>
          <h1>Characters</h1>
        </div>
        <div className="filters">
          <select value={filter} onChange={e => setFilter(e.target.value as Filter)}>
            <option value="living">Living</option>
            <option value="legends">Legends of every age</option>
            <option value="all">Everyone remembered</option>
          </select>
          <select value={role} onChange={e => setRole(e.target.value as CharacterRole | 'all')}>
            <option value="all">All roles</option>
            {roles.map(r => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>
      <Spotlight world={world} open={open} />
      <Table
        heads={['Name', 'Rarity', 'Role', 'Realm', 'Born', 'Died', 'Fame', 'Ambition']}
        rows={shown
          .sort((a, b) => b.fame - a.fame)
          .slice(0, 300)
          .map(ch => [
            link(`${ch.name}${ch.nickname ? ` ${ch.nickname}` : ''}`, () =>
              open({ type: 'character', id: ch.id }),
            ),
            ch.rarity,
            ch.role,
            world.civilizations.find(c => c.id === ch.realmId)?.name ?? 'Exile',
            displayYear(ch.born),
            ch.died !== undefined ? displayYear(ch.died) : 'Alive',
            ch.fame,
            ch.ambition ? `${ch.ambition.label} (${ch.ambition.status})` : '—',
          ])}
      />
    </main>
  );
}
