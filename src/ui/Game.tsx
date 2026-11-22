import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TECHS } from '../data/techs.ts';
import {
  cityAt,
  endTurn,
  formation,
  formationsAt,
  fortify,
  foundCity,
  levy,
  merge,
  orderMove,
  planPath,
  player,
  reachable,
  refit,
  rename,
  setResearch,
  split,
  type Result,
} from '../engine/game.ts';
import type { GameState } from '../engine/types.ts';
import type { Assets } from '../render/assets.ts';
import { CityPanel } from './CityPanel.tsx';
import { FormationPanel } from './FormationPanel.tsx';
import { HexPanel } from './HexPanel.tsx';
import { LoadoutDialog } from './LoadoutDialog.tsx';
import { MapView } from './MapView.tsx';
import { ResearchDialog } from './ResearchDialog.tsx';
import { saveGame } from './save.ts';

type Sel =
  | { kind: 'formation'; id: number }
  | { kind: 'city'; id: number }
  | { kind: 'hex'; hex: number }
  | null;

export function Game({
  initial,
  assets,
  onQuit,
}: {
  initial: GameState;
  assets: Assets;
  onQuit: () => void;
}) {
  const gref = useRef(initial);
  const game = gref.current;
  const me = player(game);
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion(v => v + 1), []);
  const [sel, setSel] = useState<Sel>(null);
  const [hover, setHover] = useState(-1);
  const [toasts, setToasts] = useState<{ id: number; text: string; bad?: boolean }[]>([]);
  const [equip, setEquip] = useState<{ fid: number; cohortIds: number[] } | null>(null);
  const [research, setResearchOpen] = useState(false);
  const [center, setCenter] = useState<{ hex: number; n: number } | null>(null);
  const toastId = useRef(0);

  const toast = useCallback((text: string, bad = false) => {
    const id = ++toastId.current;
    setToasts(t => [...t.slice(-4), { id, text, bad }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), bad ? 5000 : 3500);
  }, []);
  const report = (r: Result) => {
    if (r.msg) toast(r.msg, !r.ok);
    bump();
    return r;
  };

  const selF = sel?.kind === 'formation' ? formation(game, sel.id) : undefined;
  const mySelF = selF && selF.civId === me.id ? selF : undefined;
  const selCity = sel?.kind === 'city' ? game.cities.find(c => c.id === sel.id) : undefined;

  const idle = () =>
    game.formations.filter(f => f.civId === me.id && f.moves > 0 && !f.fortified && !f.path.length);
  const focus = (hex: number) => setCenter({ hex, n: Date.now() });
  const selectNext = () => {
    const list = idle();
    if (!list.length) {
      setSel(null);
      return false;
    }
    const cur = list.findIndex(f => f.id === selF?.id);
    const f = list[(cur + 1) % list.length];
    setSel({ kind: 'formation', id: f.id });
    focus(f.hex);
    return true;
  };

  // start: centre on our settlers
  useEffect(() => {
    const first =
      game.formations.find(f => f.civId === me.id && f.kind === 'settlers') ??
      game.formations.find(f => f.civId === me.id);
    const c = game.cities.find(x => x.civId === me.id);
    if (first) {
      setSel({ kind: 'formation', id: first.id });
      focus(first.hex);
    } else if (c) focus(c.hex);
  }, []);

  const doEndTurn = () => {
    const events = endTurn(game);
    saveGame(game);
    events.forEach(e => toast(e));
    if (
      !me.researching &&
      game.cities.some(c => c.civId === me.id) &&
      TECHS &&
      Object.keys(TECHS).some(t => !me.techs.includes(t))
    )
      toast('Choose something to research.');
    bump();
    if (!selectNext()) setSel(null);
  };

  const moveTo = (hex: number) => {
    if (!mySelF) return;
    const r = orderMove(game, mySelF.id, hex);
    report(r);
    if (!game.formations.includes(mySelF)) {
      // merged: select the formation that absorbed it
      const host = formationsAt(game, hex).find(f => f.civId === me.id && f.kind === mySelF.kind);
      setSel(host ? { kind: 'formation', id: host.id } : null);
    }
  };

  const onClick = (hex: number) => {
    const mineHere = formationsAt(game, hex).filter(f => f.civId === me.id);
    const cityHere = cityAt(game, hex);
    if (
      mySelF &&
      hex !== mySelF.hex &&
      !mineHere.length &&
      !(cityHere && cityHere.civId === me.id)
    ) {
      if (game.civs[me.id].explored[hex]) {
        moveTo(hex);
        return;
      }
    }
    const anyHere = formationsAt(game, hex).filter(f => f.civId === me.id || visibleHex(hex));
    if (anyHere.length) {
      // clicking the same hex cycles through what stands there, then the city
      const ids = anyHere.map(f => f.id);
      const cur = selF ? ids.indexOf(selF.id) : -1;
      if (cur >= 0 && cur === ids.length - 1 && cityHere) {
        setSel({ kind: 'city', id: cityHere.id });
        return;
      }
      setSel({ kind: 'formation', id: ids[(cur + 1) % ids.length] });
      return;
    }
    if (cityHere) {
      setSel({ kind: 'city', id: cityHere.id });
      return;
    }
    setSel({ kind: 'hex', hex });
  };
  const visibleHex = (hex: number) => {
    // foreign formations are only clickable where we can see them; cheap check via explored + adjacency is enough here
    return game.civs[me.id].explored[hex] === 1;
  };

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || equip || research) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        doEndTurn();
      } else if (e.key === ' ' || e.key === 'n') {
        e.preventDefault();
        selectNext();
      } else if (e.key === 'Escape') setSel(null);
      else if (e.key === 'f' && mySelF) report(fortify(game, mySelF.id));
      else if (e.key === 'b' && mySelF?.kind === 'settlers') report(foundCity(game, mySelF.id));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // overlay: reachable hexes and the planned path to the hovered hex
  const overlay = useMemo(() => {
    const o: {
      selectedFormation?: number;
      selectedHex?: number;
      hoverHex?: number;
      reach?: Set<number>;
      path?: number[];
    } = { hoverHex: hover };
    if (selF) o.selectedFormation = selF.id;
    if (sel?.kind === 'hex') o.selectedHex = sel.hex;
    if (selCity) o.selectedHex = selCity.hex;
    if (mySelF) {
      o.reach = reachable(game, mySelF);
      if (hover >= 0 && hover !== mySelF.hex && game.civs[me.id].explored[hover])
        o.path = planPath(game, mySelF, hover) ?? undefined;
      else if (mySelF.path.length) o.path = mySelF.path;
    }
    return o;
  }, [sel, hover, version]);

  const research_ = me.researching ? TECHS[me.researching] : null;
  const myCities = game.cities.filter(c => c.civId === me.id);
  const idleCount = idle().length;

  return (
    <div className="game">
      <div className="map-wrap">
        <MapView
          game={game}
          civId={me.id}
          assets={assets}
          version={version}
          overlay={overlay}
          centerOn={center}
          onClick={onClick}
          onMove={h => (mySelF ? moveTo(h) : onClick(h))}
          onHover={setHover}
        />
      </div>

      <header className="topbar">
        <span className="civ-name">
          <span className="swatch" style={{ background: me.color }} />
          {me.name}
        </span>
        <span>
          Turn <b>{game.turn}</b>
        </span>
        <span title="Gold">⛁ {me.gold}</span>
        <button className="research-btn" onClick={() => setResearchOpen(true)}>
          {research_ ? (
            <>
              🔬 {research_.name} {me.science}/{research_.cost}
            </>
          ) : (
            <>🔬 Choose research</>
          )}
        </button>
        <span className="muted">
          {myCities.length} {myCities.length === 1 ? 'city' : 'cities'}
        </span>
        <span className="spacer" />
        <button
          onClick={() => {
            saveGame(game);
            toast('Saved.');
          }}
        >
          Save
        </button>
        <button
          onClick={() => {
            saveGame(game);
            onQuit();
          }}
        >
          Menu
        </button>
      </header>

      <aside className="side">
        {selF && (
          <FormationPanel
            game={game}
            f={selF}
            mine={selF.civId === me.id}
            onEquip={ids => setEquip({ fid: selF.id, cohortIds: ids })}
            onSplit={ids => {
              const r = split(game, selF.id, ids);
              report(r);
              if (r.ok && 'id' in r && r.id) setSel({ kind: 'formation', id: r.id });
            }}
            onMerge={other => {
              report(merge(game, selF.id, other));
              setSel({ kind: 'formation', id: other });
            }}
            onSelect={id => setSel({ kind: 'formation', id })}
            onFound={() => {
              const hex = selF.hex;
              const r = report(foundCity(game, selF.id));
              const c = cityAt(game, hex);
              if (r.ok && c) setSel({ kind: 'city', id: c.id });
              if (r.ok && !me.researching) setResearchOpen(true);
            }}
            onFortify={() => report(fortify(game, selF.id))}
            onRename={n => report(rename(game, selF.id, n))}
            onClearOrders={() => {
              selF.path = [];
              bump();
            }}
          />
        )}
        {selCity && (
          <CityPanel
            game={game}
            c={selCity}
            mine={selCity.civId === me.id}
            onLevy={() => {
              const r = report(levy(game, selCity.id));
              if (r.ok) {
                const f = formationsAt(game, selCity.hex)
                  .filter(x => x.civId === me.id)
                  .pop();
                if (f) setSel({ kind: 'formation', id: f.id });
              }
            }}
          />
        )}
        {sel?.kind === 'hex' && <HexPanel game={game} hex={sel.hex} civId={me.id} />}
        {!sel && (
          <div className="panel">
            <h2>Orders</h2>
            <p className="muted">
              Click a unit or city. Right-click a hex to move the selected unit. Drag to pan, scroll
              to zoom.
            </p>
            <p className="muted small">
              Keys: Space next unit · Enter end turn · F fortify · B found city · Esc deselect
            </p>
          </div>
        )}
      </aside>

      {hover >= 0 && game.civs[me.id].explored[hover] === 1 && sel?.kind !== 'hex' && (
        <div className="hover-info">
          <HexMini game={game} hex={hover} civId={me.id} />
        </div>
      )}

      <div className="turn-box">
        <button className="next" onClick={selectNext} disabled={!idleCount}>
          {idleCount ? `Next unit (${idleCount})` : 'All units ordered'}
        </button>
        <button className="end-turn" onClick={doEndTurn}>
          End turn ⏎
        </button>
      </div>

      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.bad ? 'bad' : ''}`}>
            {t.text}
          </div>
        ))}
      </div>

      {equip && selF && (
        <LoadoutDialog
          game={game}
          fid={equip.fid}
          cohortIds={equip.cohortIds}
          start={selF.cohorts.find(c => c.id === equip.cohortIds[0])!.loadout}
          bump={bump}
          onClose={() => setEquip(null)}
          onApply={l => {
            const r = report(refit(game, equip.fid, equip.cohortIds, l));
            if (r.ok) setEquip(null);
          }}
        />
      )}
      {research && (
        <ResearchDialog
          civ={me}
          onClose={() => setResearchOpen(false)}
          onPick={id => {
            report(setResearch(game, me.id, id));
            setResearchOpen(false);
          }}
        />
      )}
    </div>
  );
}

function HexMini({ game, hex, civId }: { game: GameState; hex: number; civId: number }) {
  return <HexPanel game={game} hex={hex} civId={civId} />;
}
