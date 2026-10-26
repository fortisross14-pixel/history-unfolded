import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Clock3,
  Crown,
  Globe2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import {
  advanceUntilMoment,
  advanceWorld,
  createWorld,
  displayYear,
  eraName,
} from './engine/index.ts';
import type { Moment, RenameKind, WorldState } from './types.ts';
import { type View, type MapMode, type Sel } from './ui/shared.tsx';
import { loadSlots, persist } from './ui/storage.ts';
import { Title } from './ui/TitleScreen.tsx';
import { World } from './ui/WorldView.tsx';
import { Chronicle } from './ui/Chronicle.tsx';
import { Records } from './ui/Records.tsx';
import { RealmPage } from './ui/RealmPage.tsx';
import { Drawer } from './ui/Drawer.tsx';
import { Characters } from './ui/Characters.tsx';
import { renameEntity } from './engine/rename.ts';

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
  const [view, setView] = useState<View>('map'),
    [realmId, setRealmId] = useState<number | null>(null),
    [mode, setMode] = useState<MapMode>('political'),
    [sel, setSel] = useState<Sel>(null);
  const [pauseOnMoments, setPauseOnMoments] = useState(readPausePref);
  const [headline, setHeadline] = useState<Moment | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const advance = (n: number) => {
    setHeadline(null);
    if (!pauseOnMoments) return save(advanceWorld(world, n));
    const { world: next, started } = advanceUntilMoment(world, n);
    save(next);
    if (started) setHeadline(started);
  };
  const watch = (m: Moment) => {
    setHeadline(null);
    setSel({ type: 'moment', id: m.id });
    setLive(m.id);
  };
  // Live mode: one year per beat while the watched moment is still running.
  const watched = live ? world.moments.find(m => m.id === live) : undefined;
  useEffect(() => {
    if (!live) return;
    if (!watched?.active) {
      setLive(null);
      return;
    }
    const t = setTimeout(() => save(advanceWorld(world, 1)), 900);
    return () => clearTimeout(t);
  }, [live, world]);
  const navItems: [View, typeof Globe2, string][] = [
    ['map', Globe2, 'Map'],
    ['realm', Crown, 'Realm'],
    ['characters', Users, 'Characters'],
    ['chronicle', BookOpen, 'Chronicle'],
    ['records', Trophy, 'Records'],
  ];
  // Realms open as a full page; everything else opens in the side panel.
  const open = (s: Sel) => {
    if (s?.type === 'realm') {
      setRealmId(s.id);
      setView('realm');
      setSel(null);
    } else setSel(s);
  };
  const rename = (kind: RenameKind, id: number, name: string) =>
    save(renameEntity(world, kind, id, name));
  return (
    <div className="app">
      <header>
        <button className="logo" onClick={() => setView('map')}>
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
            <small>
              {eraName(
                Math.max(1, ...world.civilizations.filter(c => c.provinces.length).map(c => c.era)),
              )}
            </small>
          </span>
        </div>
        {live && watched ? (
          <div className="live-controls">
            <Radio />
            <span>
              Watching <b>{watched.title}</b> live
            </span>
            <button onClick={() => setLive(null)}>
              <Pause /> Stop
            </button>
          </div>
        ) : (
          <label className="pause-toggle" title="Stop advancing when a World Moment begins">
            <input
              type="checkbox"
              checked={pauseOnMoments}
              onChange={e => {
                setPauseOnMoments(e.target.checked);
                writePausePref(e.target.checked);
              }}
            />
            Pause on World Moments
          </label>
        )}
        <div className="advance-controls">
          {[1, 5, 10, 25].map(n => (
            <button onClick={() => advance(n)} key={n}>
              +{n}
              <small>{n === 1 ? 'year' : 'years'}</small>
            </button>
          ))}
        </div>
      </div>
      {headline && (
        <div className="moment-alert" role="status">
          <span className="eyebrow">A World Moment begins · {displayYear(headline.startYear)}</span>
          <strong>{headline.title}</strong>
          <div>
            <button className="primary" onClick={() => watch(headline)}>
              <Play /> Watch live
            </button>
            <button
              onClick={() => (setSel({ type: 'moment', id: headline.id }), setHeadline(null))}
            >
              Open
            </button>
            <button aria-label="Dismiss" onClick={() => setHeadline(null)}>
              <X />
            </button>
          </div>
        </div>
      )}
      {view === 'map' && <World world={world} mode={mode} setMode={setMode} open={open} />}
      {view === 'realm' && (
        <RealmPage
          world={world}
          realmId={realmId}
          setRealm={setRealmId}
          open={open}
          rename={rename}
        />
      )}
      {view === 'characters' && <Characters world={world} open={open} />}
      {view === 'chronicle' && <Chronicle world={world} open={open} />}
      {view === 'records' && <Records world={world} open={open} />}
      {sel &&
        createPortal(
          <Drawer
            key={`${sel.type}-${sel.id}`}
            world={world}
            sel={sel}
            close={() => setSel(null)}
            open={open}
            rename={rename}
          />,
          document.body,
        )}
    </div>
  );
}

// Per-viewer preference; storage may be unavailable, so it falls back to "on".
const PAUSE_KEY = 'history-unfolded-pause-on-moments';
function readPausePref() {
  try {
    return localStorage.getItem(PAUSE_KEY) !== 'off';
  } catch {
    return true;
  }
}
function writePausePref(on: boolean) {
  try {
    localStorage.setItem(PAUSE_KEY, on ? 'on' : 'off');
  } catch {
    // Not saved; the toggle still works for this session.
  }
}
