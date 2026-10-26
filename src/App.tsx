import { useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Clock3, Globe2, Landmark, RotateCcw, TrendingUp, Trophy } from 'lucide-react';
import { advanceWorld, createWorld, displayYear, eraName } from './engine/index.ts';
import type { WorldState } from './types.ts';
import { type View, type MapMode, type Sel } from './ui/shared.tsx';
import { loadSlots, persist } from './ui/storage.ts';
import { Title } from './ui/TitleScreen.tsx';
import { World } from './ui/WorldView.tsx';
import { Evolution } from './ui/Evolution.tsx';
import { HallOfFame } from './ui/HallOfFame.tsx';
import { Chronicle } from './ui/Chronicle.tsx';
import { Almanac } from './ui/Almanac.tsx';
import { Drawer } from './ui/Drawer.tsx';

export default function App() {
  const [slots, setSlots] = useState(loadSlots),
    [active, setActive] = useState<number | null>(null),
    [setup, setSetup] = useState<number | null>(null);
  const world = active ? slots.find(s => s.slot === active)?.world : null;
  const save = (w: WorldState) => {
    setSlots(prev => {
      const next = prev.map(s =>
        s.slot === active ? { ...s, world: w, updatedAt: Date.now() } : s,
      );
      persist(next);
      return next;
    });
  };
  if (!world)
    return (
      <Title
        slots={slots}
        start={setSetup}
        load={setActive}
        del={slot => {
          const next = slots.map(s => (s.slot === slot ? { ...s, world: null, updatedAt: 0 } : s));
          setSlots(next);
          persist(next);
        }}
        setup={setup}
        cancel={() => setSetup(null)}
        create={(slot, cfg) => {
          const w = createWorld(cfg);
          const next = slots.map(s =>
            s.slot === slot ? { ...s, world: w, updatedAt: Date.now() } : s,
          );
          setSlots(next);
          persist(next);
          setSetup(null);
          setActive(slot);
        }}
      />
    );
  return <Game world={world} save={save} exit={() => setActive(null)} />;
}

export function Game({
  world,
  save,
  exit,
}: {
  world: WorldState;
  save: (w: WorldState) => void;
  exit: () => void;
}) {
  const [view, setView] = useState<View>('world'),
    [mode, setMode] = useState<MapMode>('political'),
    [sel, setSel] = useState<Sel>(null);
  const advance = (n: number) => save(advanceWorld(world, n));
  const navItems: [View, typeof Globe2, string][] = [
    ['world', Globe2, 'World'],
    ['chronicle', BookOpen, 'Chronicle'],
    ['almanac', Landmark, 'Almanac'],
    ['evolution', TrendingUp, 'Evolution'],
    ['hall', Trophy, 'Hall of Fame'],
  ];
  return (
    <div className="app">
      <header>
        <button className="logo" onClick={() => setView('world')}>
          <Globe2 />
          <span>HISTORY UNFOLDED</span>
        </button>
        <nav>
          {navItems.map(([v, Icon, label]) => (
            <button className={view === v ? 'active' : ''} onClick={() => setView(v)} key={v}>
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <button className="save-slots" onClick={exit}>
          <RotateCcw />
          <span>Save slots</span>
        </button>
      </header>
      <div className="timebar">
        <div className="current-date">
          <Clock3 />
          <span>
            <strong>{displayYear(world.year)}</strong>
            <small>{eraName(world.year)}</small>
          </span>
        </div>
        <div className="advance-controls">
          {[1, 5, 10, 25].map(n => (
            <button onClick={() => advance(n)} key={n}>
              +{n}
              <small>{n === 1 ? 'year' : 'years'}</small>
            </button>
          ))}
        </div>
      </div>
      {view === 'world' && <World world={world} mode={mode} setMode={setMode} open={setSel} />}{' '}
      {view === 'chronicle' && <Chronicle world={world} open={setSel} />}{' '}
      {view === 'almanac' && <Almanac world={world} open={setSel} />}{' '}
      {view === 'evolution' && <Evolution world={world} open={setSel} />}{' '}
      {view === 'hall' && <HallOfFame world={world} open={setSel} />}{' '}
      {sel &&
        createPortal(
          <Drawer
            key={`${sel.type}-${sel.id}`}
            world={world}
            sel={sel}
            close={() => setSel(null)}
            open={setSel}
          />,
          document.body,
        )}
    </div>
  );
}
