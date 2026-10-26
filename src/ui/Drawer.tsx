import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { RenameKind, WorldState } from '../types.ts';
import { displayYear } from '../engine/index.ts';
import { buildingDef, qualityOf } from '../engine/buildings.ts';
import { wonderDef } from '../engine/wonders.ts';
import { type Sel, fmt, Metrics, Section, List } from './shared.tsx';
import { CharacterPage } from './CharacterPage.tsx';
import { RenameTitle } from './RenameTitle.tsx';
import { MomentPage, WarPage } from './MomentPage.tsx';

/** Entities the player can rename from their page. */
const RENAMEABLE: Partial<Record<NonNullable<Sel>['type'], RenameKind>> = {
  city: 'city',
  character: 'character',
  dynasty: 'dynasty',
  continent: 'continent',
  war: 'war',
};

const realmName = (world: WorldState, id: number | null | undefined) =>
  world.civilizations.find(c => c.id === id)?.name ?? 'a lost realm';

/** Title and body for one entity. Realms have their own page (RealmPage). */
function detail(
  sel: NonNullable<Sel>,
  world: WorldState,
  open: (s: Sel) => void,
): { title: string; body: ReactNode } {
  switch (sel.type) {
    case 'city': {
      const c = world.cities.find(x => x.id === sel.id)!;
      const p = world.provinces[c.provinceId];
      return {
        title: c.name,
        body: (
          <>
            <Metrics
              vals={[
                ['Wealth', fmt(c.wealth, 1)],
                ['Manpower', fmt(c.manpower, 1)],
                ['Influence', fmt(c.influence, 1)],
                ['Development', fmt(p.development, 1)],
              ]}
            />
            <Section title="How the city earns">
              <p>
                Wealth, manpower and influence come from the province's development
                {c.isCapital ? ', with a capital bonus of +50% to wealth and influence' : ''},
                raised by the buildings below and by trade routes. They add up to the realm's
                totals.
              </p>
            </Section>
            <Section title="Buildings">
              <List
                items={c.buildings.map(b => ({
                  name: `${qualityOf(b)} ${b.type}`,
                  sub: `${buildingDef(b.type).text} (×${(0.6 + 0.2 * b.level).toFixed(1)} for quality) · built ${displayYear(b.builtYear)}${b.builderId ? ` by ${world.characters.find(x => x.id === b.builderId)?.name ?? 'someone forgotten'}` : ''}`,
                  onClick: b.builderId
                    ? () => open({ type: 'character', id: b.builderId! })
                    : undefined,
                }))}
              />
            </Section>
            <Section title="Wonders">
              <List
                items={c.wonderIds
                  .map(id => world.wonders.find(w => w.id === id)!)
                  .map(w => ({
                    name: w.name,
                    sub: wonderDef(w.kind).effect,
                    onClick: () => open({ type: 'wonder', id: w.id }),
                  }))}
              />
            </Section>
            <Section title="History">
              <List
                items={[
                  {
                    name: `Founded ${displayYear(c.foundedYear)}`,
                    sub: `by ${realmName(world, c.founderRealmId)}${c.namedAfterId ? `, named after ${world.characters.find(x => x.id === c.namedAfterId)?.name ?? 'a hero'}` : ''}`,
                  },
                  ...c.ownershipHistory.map(o => ({
                    name: realmName(world, o.realmId),
                    sub: `${displayYear(o.from)}–${o.to !== undefined ? displayYear(o.to) : 'present'}`,
                    onClick: () => open({ type: 'realm', id: o.realmId }),
                  })),
                ]}
              />
            </Section>
          </>
        ),
      };
    }
    case 'continent': {
      const c = world.continents.find(x => x.id === sel.id)!;
      const realms = world.civilizations.filter(r =>
        r.provinces.some(id => world.provinces[id].continentId === c.id),
      );
      return {
        title: c.name,
        body: (
          <>
            <Metrics
              vals={[
                ['Land', fmt(c.provinceIds.length)],
                [
                  'Development',
                  fmt(c.provinceIds.reduce((n, id) => n + world.provinces[id].development, 0)),
                ],
                ['Realms', fmt(realms.length)],
                ['Cities', fmt(world.cities.filter(x => x.continentId === c.id).length)],
              ]}
            />
            <Section title="Discovery">
              <p>
                {c.discoveredYear !== undefined
                  ? `First reached from overseas by ${realmName(world, c.discoveredByRealmId)} in ${displayYear(c.discoveredYear)}${c.originalName ? `; once called ${c.originalName}` : ''}.`
                  : 'No foreign realm has reached this continent yet.'}
              </p>
            </Section>
            <Section title="Realms">
              <List
                items={realms.map(r => ({
                  name: r.name,
                  sub: `${r.rank} · ${(r.power / 10).toFixed(1)}% of world power`,
                  onClick: () => open({ type: 'realm', id: r.id }),
                }))}
              />
            </Section>
          </>
        ),
      };
    }
    case 'character': {
      const ch = world.characters.find(x => x.id === sel.id);
      if (!ch)
        return {
          title: 'Forgotten',
          body: <p className="empty">This person has faded from memory.</p>,
        };
      return {
        title: `${ch.name}${ch.nickname ? ` ${ch.nickname}` : ''}`,
        body: <CharacterPage ch={ch} world={world} open={open} />,
      };
    }
    case 'religion': {
      const r = world.religions.find(x => x.id === sel.id)!;
      const states = world.civilizations.filter(c => c.provinces.length && c.faithId === r.id);
      const parent = world.religions.find(x => x.id === r.parentReligionId);
      return {
        title: r.name,
        body: (
          <>
            <Metrics
              vals={[
                ['Provinces', fmt(r.provinces)],
                ['States', fmt(states.length)],
                ['Spread', fmt(r.expansion)],
                ['Tolerance', fmt(r.tolerance)],
              ]}
            />
            <Section title="Foundation">
              <p>
                Founded {displayYear(r.founded)} by{' '}
                {world.characters.find(p => p.id === r.founderId)?.name ?? 'an unknown founder'}
                {parent ? `, breaking away from ${parent.name}` : ''}. Doctrine: {r.doctrine}.
                Spread sets how fast states of this faith convert their lands; low tolerance makes
                religious civil wars possible.
              </p>
            </Section>
            <Section title="States of this faith">
              <List
                items={states.map(c => ({
                  name: c.name,
                  sub: c.rank,
                  onClick: () => open({ type: 'realm', id: c.id }),
                }))}
              />
            </Section>
          </>
        ),
      };
    }
    case 'culture': {
      const c = world.cultures.find(x => x.id === sel.id)!;
      const realms = world.civilizations.filter(r => r.provinces.length && r.cultureId === c.id);
      return {
        title: c.name,
        body: (
          <>
            <Metrics
              vals={[
                ['Provinces', fmt(c.provinces)],
                ['Strength', `${c.strength}%`],
                ['Realms', fmt(realms.length)],
                ['Since', displayYear(c.founded)],
              ]}
            />
            <Section title="Cultural strength">
              <p>
                Strength is this culture's share of the world's influence. A much stronger
                neighbouring culture unsettles realms of a different faith or government, and realms
                slowly bring their foreign provinces into their own culture.
              </p>
            </Section>
            <Section title="Realms">
              <List
                items={realms.map(r => ({
                  name: r.name,
                  sub: r.rank,
                  onClick: () => open({ type: 'realm', id: r.id }),
                }))}
              />
            </Section>
          </>
        ),
      };
    }
    case 'dynasty': {
      const d = world.dynasties.find(x => x.id === sel.id)!;
      const reigns = world.reigns.filter(r => r.dynastyId === d.id);
      return {
        title: d.name,
        body: (
          <>
            <Metrics
              vals={[
                ['Years in power', fmt(d.totalYearsInPower)],
                ['Reigns', fmt(reigns.length)],
                ['Peak provinces', fmt(d.peakTerritory)],
                ['Status', d.status],
              ]}
            />
            <Section title="Rulers">
              <List
                items={reigns.map(r => ({
                  name: r.name,
                  sub: `${realmName(world, r.realmId)} · ${displayYear(r.start)}–${r.end !== undefined ? displayYear(r.end) : 'present'} · reign score ${r.score}`,
                  onClick: () => open({ type: 'character', id: r.characterId }),
                }))}
              />
            </Section>
            <Section title="Married into">
              <List
                items={d.marriedIntoIds
                  .map(id => world.dynasties.find(x => x.id === id))
                  .filter((x): x is NonNullable<typeof x> => !!x)
                  .map(x => ({
                    name: x.name,
                    sub: x.status,
                    onClick: () => open({ type: 'dynasty', id: x.id }),
                  }))}
              />
            </Section>
          </>
        ),
      };
    }
    case 'wonder': {
      const w = world.wonders.find(x => x.id === sel.id)!;
      const city = world.cities.find(c => c.id === w.cityId);
      return {
        title: w.name,
        body: (
          <>
            <Metrics
              vals={[
                ['Completed', displayYear(w.completedYear)],
                ['City', city?.name ?? '—'],
                ['Held by', realmName(world, city?.currentRealmId)],
                ['Effect', wonderDef(w.kind).effect],
              ]}
            />
            <Section title="Builder">
              <List
                items={[
                  {
                    name:
                      world.characters.find(c => c.id === w.builderId)?.name ?? 'Someone forgotten',
                    sub: 'Whoever holds the city enjoys the bonus.',
                    onClick: () => open({ type: 'character', id: w.builderId }),
                  },
                ]}
              />
            </Section>
          </>
        ),
      };
    }
    case 'war': {
      const w = world.wars.find(x => x.id === sel.id)!;
      return { title: w.name, body: <WarPage war={w} world={world} open={open} /> };
    }
    case 'moment': {
      const m = world.moments.find(x => x.id === sel.id)!;
      return { title: m.title, body: <MomentPage m={m} world={world} open={open} /> };
    }
    default:
      return { title: '', body: null };
  }
}

export function Drawer({
  world,
  sel,
  close,
  open,
  rename,
}: {
  world: WorldState;
  sel: NonNullable<Sel>;
  close: () => void;
  open: (s: Sel) => void;
  rename: (kind: RenameKind, id: number, name: string) => void;
}) {
  const { title, body } = detail(sel, world, open);
  const kind = RENAMEABLE[sel.type];
  return (
    <aside className="drawer">
      <button className="close" onClick={close} aria-label="Close">
        <X />
      </button>
      <div className="drawerhero">
        <span className="eyebrow">{sel.type}</span>
        {kind ? (
          <RenameTitle title={title} onRename={name => rename(kind, sel.id, name)} />
        ) : (
          <h1>{title}</h1>
        )}
      </div>
      {body}
    </aside>
  );
}
