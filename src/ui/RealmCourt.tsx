import type { Character, Civilization, ModKey, WorldState } from '../types.ts';
import { displayYear } from '../engine/index.ts';
import { realmModifiers } from '../engine/modifiers.ts';
import { courtOf } from '../engine/lookup.ts';
import { describeMods, formatMod, modLabel } from '../engine/legacy.ts';
import { type Sel, Section, List } from './shared.tsx';
import { RarityBadge } from './CharacterPage.tsx';

const SEAT_ORDER = [
  'Ruler',
  'Heir',
  'Consort',
  'Statesman',
  'General',
  'Admiral',
  'Explorer',
  'Merchant',
  'Scholar',
  'Prophet',
];

function Seat({
  ch,
  label,
  world,
  open,
}: {
  ch: Character;
  label: string;
  world: WorldState;
  open: (s: Sel) => void;
}) {
  return (
    <button className="court-seat" onClick={() => open({ type: 'character', id: ch.id })}>
      <small>{label}</small>
      <strong>
        {ch.name}
        {ch.nickname ? ` ${ch.nickname}` : ''}
      </strong>
      <span>
        <RarityBadge rarity={ch.rarity} /> {ch.traits.join(' · ')}
      </span>
      <em>
        Age {world.year - ch.born}
        {ch.ambition?.status === 'pending' ? ` · wants to ${ch.ambition.label.toLowerCase()}` : ''}
      </em>
    </button>
  );
}

/** One modifier with every source that makes it up. */
function ModRow({
  k,
  total,
  sources,
}: {
  k: ModKey;
  total: number;
  sources: { label: string; value: number }[];
}) {
  return (
    <div className="mod-row">
      <strong>
        {modLabel(k)} {formatMod(k, total)}
      </strong>
      <span>{sources.map(src => `${src.label} ${formatMod(k, src.value)}`).join(' · ')}</span>
    </div>
  );
}

export function RealmCourt({
  c,
  world,
  open,
}: {
  c: Civilization;
  world: WorldState;
  open: (s: Sel) => void;
}) {
  const court = courtOf(world, c.id).sort(
    (a, b) => SEAT_ORDER.indexOf(a.role) - SEAT_ORDER.indexOf(b.role),
  );
  const mods = realmModifiers(world, c);
  const keys = (Object.keys(mods.total) as ModKey[]).filter(k =>
    mods.sources.some(x => x.key === k),
  );
  const legacies = world.legacies.filter(l => l.realmId === c.id).sort((a, b) => b.start - a.start);
  const regent = court.find(x => x.id === c.regentId);
  return (
    <>
      <Section title="Court">
        <div className="court-grid">
          {court.map(ch => (
            <Seat
              key={ch.id}
              ch={ch}
              world={world}
              open={open}
              label={ch.id === regent?.id ? 'Regent' : ch.id === c.heirId ? 'Heir' : ch.role}
            />
          ))}
        </div>
      </Section>
      <Section title="Why the numbers are what they are">
        {keys.length ? (
          keys.map(k => (
            <ModRow
              key={k}
              k={k}
              total={mods.total[k]}
              sources={mods.sources.filter(x => x.key === k)}
            />
          ))
        ) : (
          <p className="empty">No modifiers yet.</p>
        )}
      </Section>
      <Section title="Legacies">
        <List
          items={legacies.map(l => ({
            name: `${l.name}${l.end >= world.year ? '' : ' (faded)'}`,
            sub: `${describeMods(l.mods)} · ${displayYear(l.start)}–${displayYear(l.end)} · ${l.reason}`,
            onClick: () => open({ type: 'character', id: l.characterId }),
          }))}
        />
      </Section>
    </>
  );
}
