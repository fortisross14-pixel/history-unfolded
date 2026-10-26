// Used by scripts/ui-smoke.ts: renders every page and panel to a string.
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { advanceWorld, createWorld } from '../engine/index.ts';
import type { WorldState } from '../types.ts';
import type { MapMode, Sel } from '../ui/shared.tsx';
import { World } from '../ui/WorldView.tsx';
import { Characters } from '../ui/Characters.tsx';
import { Chronicle } from '../ui/Chronicle.tsx';
import { Records } from '../ui/Records.tsx';
import { ALMANAC_TABS, AlmanacTable } from '../ui/Almanac.tsx';
import { Evolution } from '../ui/Evolution.tsx';
import { HallOfFame } from '../ui/HallOfFame.tsx';
import { Drawer } from '../ui/Drawer.tsx';
import { RealmPage } from '../ui/RealmPage.tsx';
import { RealmCourt } from '../ui/RealmCourt.tsx';
import { Diplomacy } from '../ui/NationalCharacter.tsx';
import { SeasonList, SeasonRecap } from '../ui/SeasonRecap.tsx';

const noop = () => {};

function selections(w: WorldState): NonNullable<Sel>[] {
  const lastIds = <T extends { id: number }>(list: T[], n = 3) => list.slice(-n).map(x => x.id);
  const out: NonNullable<Sel>[] = [];
  const add = (type: NonNullable<Sel>['type'], ids: number[]) =>
    ids.forEach(id => out.push({ type, id }));
  add('city', lastIds(w.cities));
  add('continent', lastIds(w.continents));
  add('character', [
    ...lastIds(w.characters, 6),
    ...w.characters
      .filter(c => c.rarity === 'Generational')
      .map(c => c.id)
      .slice(0, 3),
  ]);
  add('religion', lastIds(w.religions));
  add('culture', lastIds(w.cultures));
  add('dynasty', lastIds(w.dynasties));
  add('war', [
    ...lastIds(w.wars),
    ...w.wars
      .filter(x => x.great)
      .slice(-3)
      .map(x => x.id),
  ]);
  add('moment', lastIds(w.moments, 6));
  add('wonder', lastIds(w.wonders));
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
    ['Characters', <Characters world={world} open={noop} />],
    ['Chronicle', <Chronicle world={world} open={noop} />],
    ['Records', <Records world={world} open={noop} />],
    ['Evolution', <Evolution world={world} open={noop} />],
    ['Hall of Fame', <HallOfFame world={world} open={noop} />],
  ];
  for (const mode of ['political', 'development', 'culture', 'religion', 'geography'] as MapMode[])
    pages.push([`Map ${mode}`, <World world={world} mode={mode} setMode={noop} open={noop} />]);
  for (const tab of ALMANAC_TABS)
    pages.push([`Almanac/${tab}`, <AlmanacTable tab={tab} world={world} open={noop} />]);
  for (const sel of selections(world))
    pages.push([
      `Drawer ${sel.type} #${sel.id}`,
      <Drawer world={world} sel={sel} close={noop} open={noop} rename={noop} />,
    ]);
  for (const realm of world.civilizations.filter(c => c.provinces.length).slice(0, 4)) {
    pages.push([
      `Realm ${realm.id}`,
      <RealmPage world={world} realmId={realm.id} setRealm={noop} open={noop} rename={noop} />,
    ]);
    pages.push([`Realm ${realm.id} court`, <RealmCourt c={realm} world={world} open={noop} />]);
    pages.push([`Realm ${realm.id} diplomacy`, <Diplomacy c={realm} world={world} open={noop} />]);
  }
  for (const season of world.seasons.slice(-3))
    pages.push([
      `Season ${season.year}`,
      <SeasonRecap world={world} season={season} open={noop} close={noop} />,
    ]);
  pages.push(['Season list', <SeasonList world={world} show={noop} />]);
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
