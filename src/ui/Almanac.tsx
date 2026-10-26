import { useState } from 'react';
import type { WorldState } from '../types.ts';
import { BREAKTHROUGHS, displayYear, eraName, populationOf } from '../engine/index.ts';
import { buildingDef, qualityOf } from '../engine/buildings.ts';
import { wonderDef } from '../engine/wonders.ts';
import { GOVERNMENTS } from '../engine/government.ts';
import { type Sel, pct, link, Table } from './shared.tsx';

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
  | 'breakthroughs'
  | 'governments'
  | 'wonders'
  | 'routes'
  | 'diplomacy';

export const ALMANAC_TABS: AlmanacTab[] = [
  'realms',
  'cities',
  'buildings',
  'continents',
  'religions',
  'cultures',
  'reigns',
  'dynasties',
  'wars',
  'breakthroughs',
  'governments',
  'wonders',
  'routes',
  'diplomacy',
];

/** Sortable tables of everything in the world. */
export function Almanac({ world, open }: { world: WorldState; open: (s: Sel) => void }) {
  const [sub, setSub] = useState<AlmanacTab>('realms');
  return (
    <>
      <div className="filters">
        <label className="almanac-picker">
          Table
          <select value={sub} onChange={e => setSub(e.target.value as AlmanacTab)}>
            {ALMANAC_TABS.map(x => (
              <option value={x} key={x}>
                {x[0].toUpperCase() + x.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <AlmanacTable tab={sub} world={world} open={open} />
    </>
  );
}

const realmName = (world: WorldState, id: number | null | undefined) =>
  world.civilizations.find(c => c.id === id)?.name ?? '—';

export function AlmanacTable({
  tab,
  world,
  open,
}: {
  tab: AlmanacTab;
  world: WorldState;
  open: (s: Sel) => void;
}) {
  const realm = (id: number | null | undefined) =>
    id ? link(realmName(world, id), () => open({ type: 'realm', id })) : '—';
  switch (tab) {
    case 'realms':
      return (
        <Table
          heads={[
            'Realm',
            'Rank',
            'Government',
            'Era',
            'Provinces',
            'Development',
            'People',
            'Wealth',
            'Army',
            'Navy',
            'Stability',
            'Power %',
          ]}
          rows={world.civilizations
            .filter(c => c.provinces.length)
            .map(c => [
              realm(c.id),
              c.rank,
              c.government,
              eraName(c.era),
              c.provinces.length,
              c.development,
              populationOf(c.development, c.era),
              +c.wealth.toFixed(1),
              c.armySize,
              c.navy,
              Math.round(c.stability),
              +(c.power / 10).toFixed(1),
            ])}
        />
      );
    case 'cities':
      return (
        <Table
          heads={[
            'City',
            'Realm',
            'Founded',
            'Development',
            'Wealth',
            'Manpower',
            'Influence',
            'Buildings',
            'Wonders',
          ]}
          rows={world.cities.map(c => [
            link(c.name, () => open({ type: 'city', id: c.id })),
            realm(c.currentRealmId),
            displayYear(c.foundedYear),
            +world.provinces[c.provinceId].development.toFixed(1),
            +c.wealth.toFixed(1),
            +c.manpower.toFixed(1),
            +c.influence.toFixed(1),
            c.buildings.length,
            c.wonderIds.length,
          ])}
        />
      );
    case 'buildings':
      return (
        <Table
          heads={['Building', 'Quality', 'City', 'Realm', 'Built', 'Builder', 'Effect']}
          rows={world.cities.flatMap(city =>
            city.buildings.map(b => [
              b.type,
              qualityOf(b),
              link(city.name, () => open({ type: 'city', id: city.id })),
              realm(city.currentRealmId),
              displayYear(b.builtYear),
              world.characters.find(p => p.id === b.builderId)?.name ?? 'The realm',
              buildingDef(b.type).text,
            ]),
          )}
        />
      );
    case 'continents':
      return (
        <Table
          heads={[
            'Continent',
            'Land',
            'Development',
            'Realms',
            'Cities',
            'First reached from overseas',
          ]}
          rows={world.continents.map(c => [
            link(c.name, () => open({ type: 'continent', id: c.id })),
            c.provinceIds.length,
            Math.round(c.provinceIds.reduce((n, id) => n + world.provinces[id].development, 0)),
            world.civilizations.filter(r =>
              r.provinces.some(id => world.provinces[id].continentId === c.id),
            ).length,
            world.cities.filter(x => x.continentId === c.id).length,
            c.discoveredYear !== undefined ? displayYear(c.discoveredYear) : '—',
          ])}
        />
      );
    case 'religions':
      return (
        <Table
          heads={['Religion', 'Founded', 'Founder', 'Provinces', 'States', 'Spread', 'Tolerance']}
          rows={world.religions.map(r => [
            link(r.name, () => open({ type: 'religion', id: r.id })),
            displayYear(r.founded),
            world.characters.find(p => p.id === r.founderId)?.name ?? '—',
            r.provinces,
            world.civilizations.filter(c => c.provinces.length && c.faithId === r.id).length,
            r.expansion,
            r.tolerance,
          ])}
        />
      );
    case 'cultures':
      return (
        <Table
          heads={['Culture', 'Since', 'Provinces', 'Strength %']}
          rows={world.cultures.map(c => [
            link(c.name, () => open({ type: 'culture', id: c.id })),
            displayYear(c.founded),
            c.provinces,
            c.strength,
          ])}
        />
      );
    case 'reigns':
      return (
        <Table
          heads={[
            'Ruler',
            'Realm',
            'Reign',
            'Years',
            'Province Δ',
            'Breakthroughs Δ',
            'Wealth Δ',
            'Score',
          ]}
          rows={[...world.reigns]
            .sort((a, b) => b.score - a.score)
            .slice(0, 200)
            .map(r => {
              const c = world.civilizations.find(x => x.id === r.realmId);
              return [
                link(r.name, () => open({ type: 'character', id: r.characterId })),
                realm(r.realmId),
                `${displayYear(r.start)}–${r.end !== undefined ? displayYear(r.end) : 'present'}`,
                (r.end ?? world.year) - r.start,
                (r.endProvinces ?? c?.provinces.length ?? r.startProvinces) - r.startProvinces,
                (r.endBreakthroughs ?? c?.breakthroughs.length ?? r.startBreakthroughs) -
                  r.startBreakthroughs,
                pct(r.startWealth, r.endWealth ?? c?.wealth),
                r.score,
              ];
            })}
        />
      );
    case 'dynasties':
      return (
        <Table
          heads={[
            'Dynasty',
            'Founded',
            'Ended',
            'Status',
            'Years in power',
            'Reigns',
            'Peak provinces',
          ]}
          rows={world.dynasties.map(d => [
            link(d.name, () => open({ type: 'dynasty', id: d.id })),
            displayYear(d.foundedYear),
            d.endedYear !== undefined ? displayYear(d.endedYear) : '—',
            d.status,
            d.totalYearsInPower,
            d.rulerIds.length,
            d.peakTerritory,
          ])}
        />
      );
    case 'wars':
      return (
        <Table
          heads={['War', 'Kind', 'Type', 'Started', 'Ended', 'Losses', 'Land', 'Winner']}
          rows={world.wars.map(w => [
            link(w.name, () => open({ type: 'war', id: w.id })),
            w.great ? `Great War (${w.keyBattles.length} key battles)` : 'Quick',
            w.type,
            displayYear(w.startYear),
            w.endYear !== undefined ? displayYear(w.endYear) : 'Active',
            w.attackerLosses + w.defenderLosses,
            w.territoriesChanged,
            w.active
              ? 'Active'
              : w.winnerIds.length
                ? realmName(world, w.winnerIds[0])
                : 'Stalemate',
          ])}
        />
      );
    case 'breakthroughs':
      return (
        <Table
          heads={[
            'Breakthrough',
            'Era',
            'Earliest',
            'Effect',
            'First made by',
            'Realms that know it',
          ]}
          rows={BREAKTHROUGHS.map(b => {
            const first = world.civilizations
              .flatMap(c => c.breakthroughs.filter(k => k.id === b.id).map(k => ({ c, k })))
              .sort((x, y) => x.k.year - y.k.year)[0];
            return [
              b.name,
              eraName(b.era),
              displayYear(b.earliest),
              b.effect,
              first ? `${first.c.name}, ${displayYear(first.k.year)}` : '—',
              world.civilizations.filter(
                c => c.provinces.length && c.breakthroughs.some(k => k.id === b.id),
              ).length,
            ];
          })}
        />
      );
    case 'governments':
      return (
        <Table
          heads={['Government', 'Effect', 'Realms now']}
          rows={GOVERNMENTS.map(g => [
            g.type,
            g.effect,
            world.civilizations.filter(c => c.provinces.length && c.government === g.type).length,
          ])}
        />
      );
    case 'wonders':
      return (
        <Table
          heads={['Wonder', 'Effect', 'City', 'Held by', 'Builder', 'Completed']}
          rows={world.wonders.map(w => {
            const city = world.cities.find(c => c.id === w.cityId);
            return [
              link(w.name, () => open({ type: 'wonder', id: w.id })),
              wonderDef(w.kind).effect,
              city?.name ?? '—',
              realm(city?.currentRealmId),
              world.characters.find(p => p.id === w.builderId)?.name ?? '—',
              displayYear(w.completedYear),
            ];
          })}
        />
      );
    case 'routes':
      return (
        <Table
          heads={['Trade route', 'Founder', 'Opened', 'Bonus', 'Status']}
          rows={world.tradeRoutes.map(r => [
            r.name,
            world.characters.find(p => p.id === r.founderId)?.name ?? '—',
            displayYear(r.createdYear),
            `${Math.round(r.bonus * 100)}%`,
            r.active ? 'Active' : 'Closed',
          ])}
        />
      );
    case 'diplomacy':
      return (
        <Table
          heads={['Relation', 'Between', 'Since', 'Until', 'Reason', 'Wars']}
          rows={world.relations.map(r => [
            r.union ? 'Personal union' : r.type,
            r.type === 'Vassal'
              ? `${realmName(world, r.a)} over ${realmName(world, r.b)}`
              : `${realmName(world, r.a)} and ${realmName(world, r.b)}`,
            displayYear(r.since),
            r.until !== undefined ? displayYear(r.until) : '—',
            r.reason,
            r.wars ?? 0,
          ])}
        />
      );
  }
}
