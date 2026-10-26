import { useState } from 'react';
import { displayYear, TECHNOLOGIES } from '../engine/index.ts';
import type { Culture, Wonder, WorldState } from '../types.ts';
import { type Sel, fmt, pct, link, Table, Section } from './shared.tsx';
import { World } from './WorldView.tsx';

export type AlmanacTab =
  | 'realms'
  | 'cities'
  | 'buildings'
  | 'continents'
  | 'religions'
  | 'cultures'
  | 'reigns'
  | 'dynasties'
  | 'wars'
  | 'technology'
  | 'artworks'
  | 'wonders'
  | 'natural'
  | 'routes'
  | 'diplomacy';

export function Almanac({ world, open }: { world: WorldState; open: (s: Sel) => void }) {
  const [sub, setSub] = useState<AlmanacTab>('realms'),
    [realmFilter, setRealmFilter] = useState('all');
  const tabs: AlmanacTab[] = [
    'realms',
    'cities',
    'buildings',
    'continents',
    'religions',
    'cultures',
    'reigns',
    'dynasties',
    'wars',
    'technology',
    'artworks',
    'wonders',
    'natural',
    'routes',
    'diplomacy',
  ];
  return (
    <main className="page almanac-page">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">Encyclopedia of the world</span>
          <h1>World Almanac</h1>
        </div>
        <label className="almanac-picker">
          Section
          <select value={sub} onChange={e => setSub(e.target.value as AlmanacTab)}>
            {tabs.map(x => (
              <option value={x} key={x}>
                {x[0].toUpperCase() + x.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {sub === 'artworks' && (
        <div className="filters">
          <select value={realmFilter} onChange={e => setRealmFilter(e.target.value)}>
            <option value="all">All realms</option>
            {world.civilizations.map(c => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <AlmanacTable tab={sub} world={world} open={open} realmFilter={realmFilter} />
    </main>
  );
}

export function AlmanacTable({
  tab,
  world,
  open,
  realmFilter,
}: {
  tab: AlmanacTab;
  world: WorldState;
  open: (s: Sel) => void;
  realmFilter: string;
}) {
  if (tab === 'realms')
    return (
      <Table
        heads={[
          'Realm',
          'Continent',
          'Rank',
          'Government',
          'Provinces',
          'Cities',
          'Population',
          'Army',
          'GDP',
          'Tech',
          'Stability',
          'Score',
        ]}
        rows={world.civilizations
          .filter(c => c.provinces.length)
          .map(c => [
            link(c.name, () => open({ type: 'realm', id: c.id })),
            world.continents.find(ct => ct.id === world.provinces[c.provinces[0]]?.continentId)
              ?.name ?? 'Unknown',
            c.rank,
            c.government,
            c.provinces.length,
            c.cityIds.length,
            c.population,
            c.armySize,
            +c.gdp.toFixed(1),
            Math.round(c.technology),
            Math.round(c.stability),
            c.historicalScore,
          ])}
      />
    );
  if (tab === 'cities')
    return (
      <Table
        heads={[
          'City',
          'Realm',
          'Continent',
          'Founded',
          'Population',
          'Prosperity',
          'Buildings',
          'Wonders',
        ]}
        rows={world.cities.map(c => [
          link(c.name, () => open({ type: 'city', id: c.id })),
          world.civilizations.find(x => x.id === c.currentRealmId)?.name,
          world.continents[c.continentId]?.name,
          displayYear(c.foundedYear),
          c.population,
          Math.round(c.prosperity),
          c.buildings.length,
          c.wonderIds.length,
        ])}
      />
    );
  if (tab === 'buildings') {
    const rows = world.cities.flatMap(city =>
      city.buildings.map(b => [
        b.name,
        link(city.name, () => open({ type: 'city', id: city.id })),
        world.civilizations.find(c => c.id === city.currentRealmId)?.name,
        b.type,
        b.rarity,
        b.impact,
        displayYear(b.builtYear),
        world.characters.find(p => p.id === b.lastBuilderId)?.name ??
          world.characters.find(p => p.id === b.builderId)?.name ??
          'Realm project',
        `GDP +${(b.gdpBonus * 100).toFixed(1)}% · Army +${(b.armyBonus * 100).toFixed(1)}% · Science +${(b.scienceBonus * 100).toFixed(1)}% · Culture +${(b.cultureBonus * 100).toFixed(1)}%`,
      ]),
    );
    return (
      <Table
        heads={[
          'Building',
          'City',
          'Realm',
          'Type',
          'Rarity',
          'Impact',
          'Founded',
          'Last builder',
          'Effects',
        ]}
        rows={rows}
      />
    );
  }
  if (tab === 'continents')
    return (
      <Table
        heads={['Continent', 'Hexagons', 'Population', 'Realms', 'Cities', 'First foreign contact']}
        rows={world.continents.map(c => [
          link(c.name, () => open({ type: 'continent', id: c.id })),
          c.provinceIds.length,
          c.provinceIds.reduce((n, id) => n + world.provinces[id].population, 0),
          world.civilizations.filter(r =>
            r.provinces.some(id => world.provinces[id].continentId === c.id),
          ).length,
          world.cities.filter(x => x.continentId === c.id).length,
          c.discoveredYear ? displayYear(c.discoveredYear) : 'Unknown',
        ])}
      />
    );
  if (tab === 'religions') {
    const paganProvinces = world.provinces.filter(
        p => p.terrain !== 'ocean' && p.religionId === null,
      ),
      paganFollowers = paganProvinces.reduce((n, p) => n + p.population, 0);
    return (
      <Table
        heads={[
          'Religion',
          'Founded',
          'Followers',
          'Provinces',
          'Founder',
          'Holy sites',
          'Expansion',
          'Loyalty',
        ]}
        rows={[
          ...world.religions.map(r => [
            link(r.name, () => open({ type: 'religion', id: r.id })),
            displayYear(r.founded),
            Math.round(r.followers),
            r.provinces,
            world.characters.find(p => p.id === r.founderId)?.name ?? 'Unknown',
            r.holyProvinceIds.length,
            r.expansion,
            r.loyalty,
          ]),
          [
            'Pagan / Unorganized',
            'Before recorded history',
            paganFollowers,
            paganProvinces.length,
            '—',
            0,
            '—',
            '—',
          ],
        ]}
      />
    );
  }
  if (tab === 'cultures')
    return (
      <Table
        heads={['Culture', 'Population', 'Provinces', 'Strength', 'Heritage']}
        rows={world.cultures.map(c => [
          link(c.name, () => open({ type: 'culture', id: c.id })),
          c.population,
          c.provinces,
          c.strength,
          c.heritage.length,
        ])}
      />
    );
  if (tab === 'reigns')
    return (
      <Table
        heads={[
          'Ruler',
          'Realm',
          'Dynasty',
          'Reign',
          'Years',
          'Province Δ',
          'Tech Δ',
          'Wealth Δ',
          'Score',
        ]}
        rows={[...world.reigns]
          .sort((a, b) => b.score - a.score)
          .slice(0, 150)
          .map(r => {
            const realm = world.civilizations.find(c => c.id === r.realmId);
            return [
              link(r.name, () => open({ type: 'character', id: r.characterId })),
              realm?.name,
              world.dynasties.find(d => d.id === r.dynastyId)?.name ?? '—',
              `${displayYear(r.start)}–${r.end !== undefined ? displayYear(r.end) : 'present'}`,
              (r.end ?? world.year) - r.start,
              (r.endProvinces ?? realm?.provinces.length ?? r.startProvinces) - r.startProvinces,
              Math.round(
                (r.endTechnology ?? realm?.technology ?? r.startTechnology) - r.startTechnology,
              ),
              pct(r.startGDP, r.endGDP ?? realm?.gdp),
              r.score,
            ];
          })}
      />
    );
  if (tab === 'dynasties')
    return (
      <Table
        heads={[
          'Dynasty',
          'Founded',
          'Ended',
          'Status',
          'Realms ruled',
          'Rulers',
          'Years',
          'Peak provinces',
          'Peak population',
          'Peak GDP',
          'Relevance',
        ]}
        rows={world.dynasties.map(d => [
          link(d.name, () => open({ type: 'dynasty', id: d.id })),
          displayYear(d.foundedYear),
          d.endedYear ? displayYear(d.endedYear) : '—',
          d.status,
          d.realmIds
            .map(id => world.civilizations.find(c => c.id === id)?.name ?? `Realm ${id}`)
            .join(', '),
          d.rulerIds.length,
          d.totalYearsInPower,
          d.peakTerritory,
          fmt(d.peakPopulation ?? 0),
          fmt(d.peakGDP, 1),
          d.historicalRelevance,
        ])}
      />
    );
  if (tab === 'wars')
    return (
      <Table
        heads={[
          'War',
          'Type',
          'Started',
          'Ended',
          'Duration',
          'Participants',
          'Losses',
          'Kind',
          'Winner',
        ]}
        rows={world.wars.map(w => [
          link(w.name, () => open({ type: 'war', id: w.id })),
          w.type,
          displayYear(w.startYear),
          w.endYear ? displayYear(w.endYear) : 'Active',
          (w.endYear ?? world.year) - w.startYear,
          w.participantIds.map(id => world.civilizations.find(c => c.id === id)?.name).join(', '),
          w.attackerLosses + w.defenderLosses,
          w.great ? `Great War (${w.keyBattles.length} key battles)` : 'Quick',
          w.active
            ? 'Active'
            : w.winnerIds.length
              ? w.winnerIds.map(id => world.civilizations.find(c => c.id === id)?.name).join(', ')
              : 'Stalemate',
        ])}
      />
    );
  if (tab === 'technology')
    return (
      <Table
        heads={['Technology', 'Field', 'Earliest', 'Effect', 'Known by']}
        rows={TECHNOLOGIES.map(t => [
          t.name,
          t.field,
          displayYear(t.earliestYear),
          t.effect,
          world.civilizations.filter(c => c.knownTechnologies.some(k => k.technologyId === t.id))
            .length,
        ])}
      />
    );
  if (tab === 'artworks') {
    const data = world.artworks.filter(a => realmFilter === 'all' || a.realmId === +realmFilter);
    return (
      <Table
        heads={['Artwork', 'Type', 'Rarity', 'Rating', 'Year', 'Patron', 'Realm', 'Culture']}
        rows={data.map(a => [
          link(a.name, () => open({ type: 'artwork', id: a.id })),
          a.type,
          a.rarity,
          a.rating,
          displayYear(a.year),
          world.characters.find(p => p.id === a.patronId)?.name,
          world.civilizations.find(c => c.id === a.realmId)?.name,
          world.cultures.find(c => c.id === a.cultureId)?.name,
        ])}
      />
    );
  }
  if (tab === 'wonders')
    return (
      <Table
        heads={[
          'Wonder',
          'Category',
          'City',
          'Realm',
          'Builder',
          'Completed',
          'Status',
          'Relevance',
        ]}
        rows={world.wonders.map(w => [
          link(w.name, () => open({ type: 'wonder', id: w.id })),
          w.category,
          world.cities.find(c => c.id === w.cityId)?.name,
          world.civilizations.find(c => c.id === w.realmId)?.name,
          world.characters.find(p => p.id === w.builderId)?.name,
          displayYear(w.completedYear),
          w.status,
          w.historicalRelevance,
        ])}
      />
    );
  if (tab === 'natural')
    return (
      <Table
        heads={['Natural Wonder', 'Continent', 'Owner', 'Effect']}
        rows={world.naturalWonders.map(n => [
          link(n.name, () => open({ type: 'natural', id: n.id })),
          world.continents[world.provinces[n.provinceId].continentId!]?.name,
          world.civilizations.find(c => c.id === world.provinces[n.provinceId].ownerId)?.name ??
            'Unclaimed',
          n.effect,
        ])}
      />
    );
  if (tab === 'routes')
    return (
      <Table
        heads={[
          'Trade Route',
          'Origin',
          'Destination',
          'Founder',
          'Created',
          'GDP Bonus',
          'Status',
        ]}
        rows={world.tradeRoutes.map(r => [
          r.name,
          world.cities.find(c => c.id === r.originCityId)?.name,
          world.cities.find(c => c.id === r.destinationCityId)?.name,
          world.characters.find(p => p.id === r.founderId)?.name,
          displayYear(r.createdYear),
          `${(r.gdpBonus * 100).toFixed(1)}%`,
          r.active ? 'Active' : 'Closed',
        ])}
      />
    );
  const name = (id: number) => world.civilizations.find(c => c.id === id)?.name ?? 'a lost realm';
  return (
    <Table
      heads={['Relation', 'Between', 'Since', 'Until', 'Reason', 'Wars']}
      rows={world.relations.map(r => [
        r.union ? 'Personal union' : r.type,
        r.type === 'Vassal' ? `${name(r.a)} over ${name(r.b)}` : `${name(r.a)} and ${name(r.b)}`,
        displayYear(r.since),
        r.until !== undefined ? displayYear(r.until) : '—',
        r.reason,
        r.wars ?? 0,
      ])}
    />
  );
}
