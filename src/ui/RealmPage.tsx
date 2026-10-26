import { useState } from 'react';
import type { Civilization, ModKey, RenameKind, WorldState } from '../types.ts';
import { displayYear, eraName, populationOf } from '../engine/index.ts';
import { realmModifiers, type ModSource } from '../engine/modifiers.ts';
import { realmOutput, type Breakdown } from '../engine/economy.ts';
import { governmentDef } from '../engine/government.ts';
import { BREAKTHROUGHS, knows, researchCost } from '../engine/eras.ts';
import { qualityOf } from '../engine/buildings.ts';
import { wonderDef, wondersOf } from '../engine/wonders.ts';
import { formatMod } from '../engine/legacy.ts';
import { type Sel, fmt, Section, List } from './shared.tsx';
import { RealmCourt } from './RealmCourt.tsx';
import { Diplomacy, NationalCharacter } from './NationalCharacter.tsx';
import { RenameTitle } from './RenameTitle.tsx';
import { RarityBadge } from './CharacterPage.tsx';

type Tab = 'overview' | 'court' | 'economy' | 'diplomacy' | 'wars' | 'history';

const pctText = (n: number) => `${n >= 0 ? '+' : '−'}${Math.round(Math.abs(n) * 100)}%`;

/** A stat with an expandable list of where it comes from. */
function Stat({
  label,
  value,
  note,
  breakdown,
  sources,
  modKey,
}: {
  label: string;
  value: string;
  note?: string;
  breakdown?: Breakdown;
  sources: ModSource[];
  modKey?: ModKey;
}) {
  const mods = modKey ? sources.filter(x => x.key === modKey) : [];
  const parts = breakdown ? [...breakdown.base].sort((a, b) => b.value - a.value) : [];
  return (
    <details className="stat">
      <summary>
        <small>{label}</small>
        <strong>{value}</strong>
        {note && <em>{note}</em>}
      </summary>
      <div className="stat-detail">
        {parts.slice(0, 8).map(p => (
          <div key={p.label}>
            <span>{p.label}</span>
            <b>{fmt(p.value, 1)}</b>
          </div>
        ))}
        {parts.length > 8 && (
          <div>
            <span>{parts.length - 8} more</span>
            <b>
              {fmt(
                parts.slice(8).reduce((n, p) => n + p.value, 0),
                1,
              )}
            </b>
          </div>
        )}
        {modKey && (
          <div className="stat-bonus">
            <span>Modifiers</span>
            <b>
              {modKey === 'stability'
                ? formatMod('stability', breakdown?.bonus ?? 0)
                : pctText(breakdown?.bonus ?? mods.reduce((n, m) => n + m.value, 0))}
            </b>
          </div>
        )}
        {mods
          .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
          .map(m => (
            <div key={m.label} className="stat-mod">
              <span>{m.label}</span>
              <b>{formatMod(m.key, m.value)}</b>
            </div>
          ))}
      </div>
    </details>
  );
}

function Overview({
  c,
  world,
  open,
}: {
  c: Civilization;
  world: WorldState;
  open: (s: Sel) => void;
}) {
  const mods = realmModifiers(world, c);
  const out = realmOutput(world, c, mods.total);
  const ruler = world.characters.find(x => x.id === c.rulerId);
  const gov = governmentDef(c.government);
  const next = BREAKTHROUGHS.find(b => !knows(c, b.id) && b.era <= c.era + 1);
  return (
    <>
      <div className="stat-grid">
        <Stat
          label="Development"
          value={fmt(c.development)}
          note={`≈ ${fmt(populationOf(c.development, c.era))} people`}
          sources={mods.sources}
          modKey="growth"
        />
        <Stat
          label="Wealth"
          value={fmt(c.wealth, 1)}
          breakdown={out.wealth}
          sources={mods.sources}
          modKey="wealth"
        />
        <Stat
          label="Manpower"
          value={fmt(c.manpower, 1)}
          note={`Army ${fmt(c.armySize)} / ${fmt(c.armyCapacity)}`}
          breakdown={out.manpower}
          sources={mods.sources}
          modKey="army"
        />
        <Stat
          label="Navy"
          value={fmt(c.navy)}
          note={`of ${fmt(c.navyCapacity)}`}
          sources={mods.sources}
          modKey="navy"
        />
        <Stat
          label="Influence"
          value={fmt(c.influence, 1)}
          breakdown={out.influence}
          sources={mods.sources}
          modKey="influence"
        />
        <Stat
          label="Stability"
          value={fmt(c.stability)}
          note={`drifting toward ${fmt(52 + mods.total.stability)}`}
          breakdown={{
            base: [{ label: 'Baseline', value: 52 }],
            bonus: mods.total.stability,
            total: 52 + mods.total.stability,
          }}
          sources={mods.sources}
          modKey="stability"
        />
        <Stat
          label="Research"
          value={`${fmt(out.research.total, 1)} / year`}
          note={
            next
              ? `${fmt(c.research)} of ${researchCost(next.era)} toward being first`
              : 'At the frontier'
          }
          breakdown={out.research}
          sources={mods.sources}
          modKey="research"
        />
        <Stat
          label="Power"
          value={`${(c.power / 10).toFixed(1)}%`}
          note="share of the world's land, wealth and forces"
          sources={[]}
        />
      </div>
      <NationalCharacter c={c} />
      <Section title="State">
        <List
          items={[
            { name: `${c.government}`, sub: gov.effect },
            ...(ruler
              ? [
                  {
                    name: `${ruler.name}${ruler.nickname ? ` ${ruler.nickname}` : ''}`,
                    sub: `Ruler · ${ruler.rarity} · ${ruler.traits.join(', ')}`,
                    onClick: () => open({ type: 'character', id: ruler.id }),
                  },
                ]
              : []),
            {
              name: `${eraName(c.era)}`,
              sub: `${c.breakthroughs.length} of ${BREAKTHROUGHS.length} breakthroughs`,
            },
          ]}
        />
      </Section>
    </>
  );
}

function Economy({
  c,
  world,
  open,
}: {
  c: Civilization;
  world: WorldState;
  open: (s: Sel) => void;
}) {
  const cities = c.cityIds.map(id => world.cities.find(x => x.id === id)!).filter(Boolean);
  const routes = world.tradeRoutes.filter(
    t =>
      t.active && (c.cityIds.includes(t.originCityId) || c.cityIds.includes(t.destinationCityId)),
  );
  const wonders = wondersOf(world, c);
  return (
    <>
      <Section title="Cities">
        <List
          items={cities
            .sort((a, b) => b.wealth - a.wealth)
            .map(x => ({
              name: `${x.name}${x.isCapital ? ' (capital)' : ''}`,
              sub: `Wealth ${fmt(x.wealth, 1)} · manpower ${fmt(x.manpower, 1)} · influence ${fmt(x.influence, 1)} · ${x.buildings.map(b => `${qualityOf(b)} ${b.type}`).join(', ') || 'no buildings'}`,
              onClick: () => open({ type: 'city', id: x.id }),
            }))}
        />
      </Section>
      <Section title="Wonders">
        <List
          items={wonders.map(w => ({
            name: w.name,
            sub: wonderDef(w.kind).effect,
            onClick: () => open({ type: 'wonder', id: w.id }),
          }))}
        />
      </Section>
      <Section title="Trade routes">
        <List
          items={routes.map(t => ({
            name: t.name,
            sub: `Each end city earns ${Math.round(t.bonus * 100)}% more wealth · since ${displayYear(t.createdYear)}`,
          }))}
        />
      </Section>
      <Section title="Breakthroughs">
        <div className="chips">
          {BREAKTHROUGHS.map(b => (
            <span className={knows(c, b.id) ? 'known' : ''} key={b.id} title={b.effect}>
              {b.name}
            </span>
          ))}
        </div>
      </Section>
    </>
  );
}

function Wars({ c, world, open }: { c: Civilization; world: WorldState; open: (s: Sel) => void }) {
  return (
    <Section title="Wars">
      <List
        items={[...c.warIds]
          .reverse()
          .map(id => world.wars.find(x => x.id === id))
          .filter((w): w is NonNullable<typeof w> => !!w)
          .map(w => {
            const result = w.active
              ? 'ACTIVE'
              : w.winnerIds.includes(c.id)
                ? 'VICTORY'
                : w.loserIds.includes(c.id)
                  ? 'DEFEAT'
                  : 'STALEMATE';
            return {
              name: `${result} · ${w.name}`,
              sub: `${w.type} · ${displayYear(w.startYear)}${w.endYear !== undefined ? `–${displayYear(w.endYear)}` : ''} · ${w.great ? `Great War, ${w.keyBattles.length} key battles` : 'quick war'}`,
              onClick: () => open({ type: 'war', id: w.id }),
            };
          })}
      />
    </Section>
  );
}

function History({
  c,
  world,
  open,
}: {
  c: Civilization;
  world: WorldState;
  open: (s: Sel) => void;
}) {
  const reigns = world.reigns.filter(r => r.realmId === c.id).reverse();
  const events = world.events.filter(e => e.civIds.includes(c.id)).slice(0, 40);
  return (
    <>
      <Section title="Rulers">
        <List
          items={reigns.map(r => ({
            name: r.name,
            sub: `${displayYear(r.start)}–${r.end !== undefined ? displayYear(r.end) : 'present'} · territory ${r.startProvinces} → ${r.endProvinces ?? c.provinces.length} · reign score ${r.score}`,
            onClick: () => open({ type: 'character', id: r.characterId }),
          }))}
        />
      </Section>
      <Section title="Names and governments">
        <List
          items={[
            ...c.nameHistory.map(n => ({
              name: n.name,
              sub: `${n.rank} from ${displayYear(n.from)} · ${n.reason}`,
            })),
            ...c.governmentHistory.map(g => ({
              name: g.government,
              sub: `${displayYear(g.from)}–${g.to !== undefined ? displayYear(g.to) : 'present'} · ${g.reason}`,
            })),
          ]}
        />
      </Section>
      <Section title="Recent events">
        <List
          items={events.map(e => ({
            name: e.title,
            sub: `${displayYear(e.year)} · ${e.description}`,
          }))}
        />
      </Section>
    </>
  );
}

/** The Realm section: one country at a time, with every number explained. */
export function RealmPage({
  world,
  realmId,
  setRealm,
  open,
  rename,
}: {
  world: WorldState;
  realmId: number | null;
  setRealm: (id: number) => void;
  open: (s: Sel) => void;
  rename: (kind: RenameKind, id: number, name: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const living = world.civilizations
    .filter(x => x.provinces.length)
    .sort((a, b) => b.power - a.power);
  const c = world.civilizations.find(x => x.id === realmId) ?? living[0];
  if (!c)
    return (
      <main className="page">
        <p className="empty">No realms remain.</p>
      </main>
    );
  const ruler = world.characters.find(x => x.id === c.rulerId);
  const tabs: Tab[] = ['overview', 'court', 'economy', 'diplomacy', 'wars', 'history'];
  return (
    <main className="page realm-page">
      <div className="page-title-row">
        <div>
          <span className="eyebrow" style={{ color: c.color }}>
            {c.provinces.length
              ? `${c.rank} · ${c.government} · ${(c.power / 10).toFixed(1)}% of world power`
              : `Fallen in ${displayYear(c.nameHistory.at(-1)?.from ?? world.year)}`}
          </span>
          <RenameTitle title={c.name} onRename={name => rename('realm', c.id, name)} />
          {ruler && (
            <p className="page-intro">
              Ruled by{' '}
              <button className="link" onClick={() => open({ type: 'character', id: ruler.id })}>
                {ruler.name}
                {ruler.nickname ? ` ${ruler.nickname}` : ''}
              </button>{' '}
              <RarityBadge rarity={ruler.rarity} />
            </p>
          )}
        </div>
        <label className="almanac-picker">
          Realm
          <select value={c.id} onChange={e => setRealm(+e.target.value)}>
            {living.map(x => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="subtabs">
        {tabs.map(t => (
          <button className={tab === t ? 'active' : ''} onClick={() => setTab(t)} key={t}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview c={c} world={world} open={open} />}
      {tab === 'court' && <RealmCourt c={c} world={world} open={open} />}
      {tab === 'economy' && <Economy c={c} world={world} open={open} />}
      {tab === 'diplomacy' && <Diplomacy c={c} world={world} open={open} />}
      {tab === 'wars' && <Wars c={c} world={world} open={open} />}
      {tab === 'history' && <History c={c} world={world} open={open} />}
    </main>
  );
}
