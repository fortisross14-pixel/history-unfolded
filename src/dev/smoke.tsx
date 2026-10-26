// Used by scripts/ui-smoke.ts: renders every page and panel to a string.
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { advanceWorld, createWorld } from '../engine/index.ts';
import type { WorldState } from '../types.ts';
import type { Sel } from '../ui/shared.tsx';
import { World } from '../ui/WorldView.tsx';
import { Characters } from '../ui/Characters.tsx';
import { Chronicle } from '../ui/Chronicle.tsx';
import { Almanac, AlmanacTable, type AlmanacTab } from '../ui/Almanac.tsx';
import { Evolution } from '../ui/Evolution.tsx';
import { HallOfFame } from '../ui/HallOfFame.tsx';
import { Drawer, RealmDetail } from '../ui/Drawer.tsx';

const noop = () => {};

function selections(w: WorldState): NonNullable<Sel>[] {
  const firstIds = <T extends { id: number }>(list: T[], n = 3) => list.slice(-n).map(x => x.id);
  const out: NonNullable<Sel>[] = [];
  const add = (type: NonNullable<Sel>['type'], ids: number[]) =>
    ids.forEach(id => out.push({ type, id }));
  add('realm', firstIds(w.civilizations.filter(c => c.provinces.length)));
  add('city', firstIds(w.cities));
  add('continent', firstIds(w.continents));
  add('character', [
    ...firstIds(w.characters, 6),
    ...w.characters
      .filter(c => c.rarity === 'Generational')
      .map(c => c.id)
      .slice(0, 3),
  ]);
  add('religion', firstIds(w.religions));
  add('culture', firstIds(w.cultures));
  add('dynasty', firstIds(w.dynasties));
  add('war', firstIds(w.wars));
  add('battle', firstIds(w.battles));
  add('artwork', firstIds(w.artworks));
  add('wonder', firstIds(w.wonders));
  add('natural', firstIds(w.naturalWonders));
  return out;
}

export async function renderAll(years: number): Promise<string[]> {
  const world = advanceWorld(
    createWorld(
      { name: 'Smoke', mapSize: 'medium', mapVariant: 1, tribeCount: 30, nameMode: 'mixed' },
      4242,
    ),
    years,
  );
  const pages: [string, ReactElement][] = [
    ['World', <World world={world} mode="political" setMode={noop} open={noop} />],
    ['Characters', <Characters world={world} open={noop} />],
    ['Chronicle', <Chronicle world={world} open={noop} />],
    ['Almanac', <Almanac world={world} open={noop} />],
    ['Evolution', <Evolution world={world} open={noop} />],
    ['Hall of Fame', <HallOfFame world={world} open={noop} />],
  ];
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
    'battles',
    'technology',
    'artworks',
    'wonders',
    'natural',
    'routes',
    'rivalries',
  ];
  for (const tab of tabs)
    pages.push([
      `Almanac/${tab}`,
      <AlmanacTable tab={tab} world={world} open={noop} realmFilter="all" />,
    ]);
  for (const sel of selections(world))
    pages.push([
      `Drawer ${sel.type} #${sel.id}`,
      <Drawer world={world} sel={sel} close={noop} open={noop} rename={noop} />,
    ]);
  const realm = world.civilizations.find(c => c.provinces.length)!;
  for (const tab of [
    'summary',
    'history',
    'cities',
    'court',
    'military',
    'culture',
    'religion',
    'economy',
    'events',
    'exploration',
  ])
    pages.push([`Realm tab ${tab}`, <RealmDetail c={realm} world={world} tab={tab} open={noop} />]);
  const failures: string[] = [];
  for (const [label, el] of pages) {
    try {
      renderToString(el);
    } catch (e) {
      failures.push(`${label}: ${(e as Error).message}`);
    }
  }
  console.log(`Rendered ${pages.length} views of a world at year ${world.year}.`);
  return failures;
}
