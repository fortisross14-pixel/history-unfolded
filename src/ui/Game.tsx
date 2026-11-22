import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TECHS } from '../data/techs.ts';
import type { BattleReport } from '../engine/combat.ts';
import {
  assignDesign,
  attack,
  buildRoad,
  canAttack,
  cityAt,
  declareWar,
  endTurn,
  formation,
  formationsAt,
  fortify,
  foundCity,
  levy,
  merge,
  offerPeace,
  orderMove,
  planPath,
  player,
  previewBattle,
  reachable,
  rename,
  score,
  setResearch,
  setResearchGoal,
  techCost,
  split,
  trainSettlers,
  visibleHexes,
  type Result,
} from '../engine/game.ts';
import type { GameState } from '../engine/types.ts';
import type { Assets } from '../render/assets.ts';
import type { Overlay } from '../render/mapRenderer.ts';
import { BattleDialog } from './BattleDialog.tsx';
import { CityDialog } from './CityDialog.tsx';
import { CityPanel } from './CityPanel.tsx';
import { DesignsDialog } from './DesignsDialog.tsx';
import { FormationPanel } from './FormationPanel.tsx';
import { HexPanel } from './HexPanel.tsx';
import { MapView } from './MapView.tsx';
import { PeoplesDialog } from './PeoplesDialog.tsx';
import { ResearchDialog } from './ResearchDialog.tsx';
import { ProposalDialog } from './ProposalDialog.tsx';
import { answerProposal, proposeDeal } from '../engine/diplomacy.ts';
import { CultureDialog, KeepDialog, TagChip } from './CultureDialog.tsx';
import { resolveUpheaval, startUpheaval, takeNode } from '../engine/culture.ts';
import { cityEconomy } from '../engine/economy.ts';
import { identity } from '../engine/mods.ts';
import { DOMAINS } from '../data/culture.ts';
import { saveGame } from './save.ts';

type Sel =
  | { kind: 'formation'; id: number }
  | { kind: 'city'; id: number }
  | { kind: 'hex'; hex: number }
  | null;
type Dialog =
  | { kind: 'research' }
  | { kind: 'culture' }
  | { kind: 'city'; cityId: number; hex?: number }
  | { kind: 'designs'; open?: number | 'new' }
  | { kind: 'peoples' }
  | { kind: 'battle'; report: BattleReport }
  | { kind: 'war'; civId: number; then?: () => void }
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
  const [dialog, setDialog] = useState<Dialog>(null);
  const [center, setCenter] = useState<{ hex: number; n: number } | null>(null);
  const toastId = useRef(0);

  const toast = useCallback((text: string, bad = false) => {
    const id = ++toastId.current;
    setToasts(t => [...t.slice(-4), { id, text, bad }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), bad ? 5000 : 3800);
  }, []);
  const report = (r: Result) => {
    if (r.msg) toast(r.msg, !r.ok);
    bump();
    return r;
  };

  const vis = useMemo(() => visibleHexes(game, me.id), [version]);
  const selF = sel?.kind === 'formation' ? formation(game, sel.id) : undefined;
  const mySelF = selF && selF.civId === me.id ? selF : undefined;
  const selCity = sel?.kind === 'city' ? game.cities.find(c => c.id === sel.id) : undefined;

  const idle = () =>
    game.formations.filter(f => f.civId === me.id && f.moves > 0 && !f.fortified && !f.path.length);
  const focus = (hex: number) => setCenter({ hex, n: Date.now() });
  const selectNext = () => {
    const list = idle();
    if (!list.length) return false;
    const cur = list.findIndex(f => f.id === selF?.id);
    const f = list[(cur + 1) % list.length];
    setSel({ kind: 'formation', id: f.id });
    focus(f.hex);
    return true;
  };

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

  // test hook: lets the browser smoke test inspect and steer the game
  useEffect(() => {
    (window as unknown as { __hu: unknown }).__hu = {
      game,
      focus,
      bump,
      select: (id: number) => setSel({ kind: 'formation', id }),
    };
  });

  const doEndTurn = () => {
    const events = endTurn(game);
    saveGame(game);
    events.forEach(e =>
      toast(e, /declared war on the|captured .* from|attacked/.test(e) && e.includes(me.name)),
    );
    if (
      !me.researching &&
      game.cities.some(c => c.civId === me.id) &&
      Object.keys(TECHS).some(t => !me.techs.includes(t))
    )
      toast('Choose something to research.');
    bump();
    if (!selectNext()) setSel(null);
  };

  /** Attack an adjacent enemy; asks to declare war first when at peace. */
  const doAttack = (hex: number) => {
    if (!mySelF) return;
    const chk = canAttack(game, mySelF.id, hex);
    if (chk.problem) return toast(chk.problem, true);
    const go = () => {
      const r = attack(game, mySelF.id, hex);
      report({ ok: r.ok, msg: r.ok ? undefined : r.msg } as Result);
      if (r.report) setDialog({ kind: 'battle', report: r.report });
      else if (r.msg) toast(r.msg, !r.ok);
      if (!game.formations.includes(mySelF)) setSel(null);
      saveGame(game);
    };
    if (chk.needsWar !== undefined) setDialog({ kind: 'war', civId: chk.needsWar, then: go });
    else go();
  };

  const enemyAt = (hex: number) =>
    vis[hex] === 1 &&
    (formationsAt(game, hex).some(f => f.civId !== me.id) ||
      (cityAt(game, hex) && cityAt(game, hex)!.civId !== me.id));

  const moveTo = (hex: number) => {
    if (!mySelF) return;
    if (enemyAt(hex)) return doAttack(hex);
    const r = orderMove(game, mySelF.id, hex);
    report(r);
    if (!game.formations.includes(mySelF)) {
      const host = formationsAt(game, hex).find(f => f.civId === me.id && f.kind === mySelF.kind);
      setSel(host ? { kind: 'formation', id: host.id } : null);
    }
  };

  const onClick = (hex: number) => {
    const mineHere = formationsAt(game, hex).filter(f => f.civId === me.id);
    const cityHere = cityAt(game, hex);
    // with a unit selected, clicking an adjacent enemy attacks; clicking open ground moves
    if (mySelF && hex !== mySelF.hex) {
      if (enemyAt(hex) && canAttack(game, mySelF.id, hex).target) return doAttack(hex);
      if (
        !mineHere.length &&
        !(cityHere && cityHere.civId === me.id) &&
        !enemyAt(hex) &&
        game.civs[me.id].explored[hex]
      )
        return moveTo(hex);
    }
    const here = formationsAt(game, hex).filter(f => f.civId === me.id || vis[hex]);
    if (here.length) {
      const ids = here.map(f => f.id);
      const cur = selF ? ids.indexOf(selF.id) : -1;
      if (cur >= 0 && cur === ids.length - 1 && cityHere) {
        setSel({ kind: 'city', id: cityHere.id });
        return;
      }
      setSel({ kind: 'formation', id: ids[(cur + 1) % ids.length] });
      return;
    }
    if (cityHere && game.civs[me.id].explored[hex]) {
      setSel({ kind: 'city', id: cityHere.id });
      return;
    }
    setSel({ kind: 'hex', hex });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || dialog) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        doEndTurn();
      } else if (e.key === ' ' || e.key === 'n') {
        e.preventDefault();
        selectNext();
      } else if (e.key === 'Escape') setSel(null);
      else if (e.key === 'f' && mySelF) report(fortify(game, mySelF.id));
      else if (e.key === 'b' && mySelF?.kind === 'settlers') report(foundCity(game, mySelF.id));
      else if (e.key === 'd') setDialog({ kind: 'designs' });
      else if (e.key === 'k') setDialog({ kind: 'culture' });
      else if (e.key === 't') setDialog({ kind: 'research' });
      else if (e.key === 'r' && mySelF) report(buildRoad(game, mySelF.id));
      else if (e.key === 'c' && selCity && selCity.civId === me.id)
        setDialog({ kind: 'city', cityId: selCity.id });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // hovering an adjacent enemy shows the expected battle
  const battlePreview = useMemo(() => {
    if (!mySelF || hover < 0 || !enemyAt(hover)) return null;
    const chk = canAttack(game, mySelF.id, hover);
    if (chk.problem) return { problem: chk.problem };
    return { report: previewBattle(game, mySelF.id, hover), needsWar: chk.needsWar };
  }, [hover, version, sel]);

  const overlay = useMemo(() => {
    const o: Overlay = { hoverHex: hover };
    if (selF) o.selectedFormation = selF.id;
    if (sel?.kind === 'hex') o.selectedHex = sel.hex;
    if (selCity) o.selectedHex = selCity.hex;
    if (mySelF) {
      o.reach = reachable(game, mySelF);
      if (battlePreview && !('problem' in battlePreview)) o.target = hover;
      else if (
        hover >= 0 &&
        hover !== mySelF.hex &&
        game.civs[me.id].explored[hover] &&
        !enemyAt(hover)
      )
        o.path = planPath(game, mySelF, hover) ?? undefined;
      else if (mySelF.path.length) o.path = mySelF.path;
    }
    return o;
  }, [sel, hover, version, battlePreview]);

  const research_ = me.researching ? TECHS[me.researching] : null;
  const culturePerTurn = Math.round(
    game.cities
      .filter(c => c.civId === me.id)
      .reduce((a, c) => a + cityEconomy(game, c).total.culture, 0),
  );
  const myCities = game.cities.filter(c => c.civId === me.id);
  const idleCount = idle().length;
  const wars = game.wars.filter(w => w.a === me.id || w.b === me.id).length;

  const proposal = game.proposals.find(p => p.to === me.id);
  if (game.ended || !me.alive) {
    const e = game.ended;
    const won = e && e.winner === me.id;
    const ranking = game.civs.slice().sort((a, b) => score(game, b.id) - score(game, a.id));
    return (
      <div className="menu">
        <div className="menu-card">
          <h1>{won ? 'Victory' : me.alive ? 'The age is over' : 'Your people are no more'}</h1>
          <p className="subtitle">
            Turn {game.turn}. {won && e?.reason === 'conquest' ? `The ${me.name} stand alone.` : ''}
            {e?.reason === 'score'
              ? `The ${game.civs[e.winner].name} are remembered as the greatest people of the age.`
              : ''}
            {!me.alive ? ` The chronicles will remember the ${me.name}.` : ''}
          </p>
          <table className="stats">
            <tbody>
              {ranking.map(c => (
                <tr key={c.id}>
                  <td>
                    <span className="swatch" style={{ background: c.color }} /> {c.name}
                    {c.alive ? '' : ' (gone)'}
                  </td>
                  <td>score {score(game, c.id)}</td>
                  <td>
                    {identity(c)
                      .slice(0, 2)
                      .map(i => (
                        <TagChip key={i.tag} tag={i.tag} />
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {me.alive && e && (
            <button
              className="wide"
              onClick={() => {
                game.settings.turnLimit = (game.settings.turnLimit ?? 400) + 100;
                delete game.ended;
                bump();
              }}
            >
              Keep playing (100 more turns)
            </button>
          )}
          <button className="primary wide" onClick={onQuit}>
            Back to the menu
          </button>
        </div>
      </div>
    );
  }

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
          <small className="muted">/{game.settings.turnLimit ?? 400}</small>
        </span>
        <span title="Gold">⛁ {me.gold}</span>
        <button className="research-btn" onClick={() => setDialog({ kind: 'research' })}>
          {research_ ? (
            <>
              🔬 {research_.name} {Math.floor(me.science)}/{techCost(game, me, research_.id)}
            </>
          ) : (
            <>🔬 Choose research</>
          )}
        </button>
        <button className="research-btn" onClick={() => setDialog({ kind: 'culture' })} title="K">
          🎭 {Math.floor(me.culture.points)} (+{culturePerTurn})
          {me.culture.upheaval ? (
            <b className="war-pill">{DOMAINS[me.culture.upheaval.domain].upheaval}</b>
          ) : (
            ''
          )}
        </button>
        <span className="ident-bar">
          {identity(me)
            .slice(0, 2)
            .map(i => (
              <TagChip key={i.tag} tag={i.tag} />
            ))}
        </span>
        <button onClick={() => setDialog({ kind: 'designs' })} title="D">
          ⚔ Unit designs ({me.designs.length})
        </button>
        <button onClick={() => setDialog({ kind: 'peoples' })}>
          👥 Peoples
          {wars ? (
            <b className="war-pill">
              {wars} war{wars > 1 ? 's' : ''}
            </b>
          ) : (
            ''
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
            onAssign={(ids, designId) => report(assignDesign(game, selF.id, ids, designId))}
            onDesigns={open => setDialog({ kind: 'designs', open })}
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
              if (r.ok && !me.researching) setDialog({ kind: 'research' });
            }}
            onFortify={() => report(fortify(game, selF.id))}
            onRename={n => report(rename(game, selF.id, n))}
            onClearOrders={() => {
              selF.path = [];
              bump();
            }}
            onRoad={() => report(buildRoad(game, selF.id))}
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
            onOpen={() => setDialog({ kind: 'city', cityId: selCity.id })}
            onSettlers={() => {
              const r = report(trainSettlers(game, selCity.id));
              if (r.ok) {
                const f = formationsAt(game, selCity.hex)
                  .filter(x => x.civId === me.id && x.kind === 'settlers')
                  .pop();
                if (f) setSel({ kind: 'formation', id: f.id });
              }
            }}
          />
        )}
        {sel?.kind === 'hex' && (
          <HexPanel
            game={game}
            hex={sel.hex}
            civId={me.id}
            onOpenDistrict={cityId => setDialog({ kind: 'city', cityId, hex: sel.hex })}
          />
        )}
        {!sel && (
          <div className="panel">
            <h2>Orders</h2>
            <p className="muted">
              Click a unit or city. With a unit selected, click a hex to move or an adjacent enemy
              to attack. Drag to pan, scroll to zoom.
            </p>
            <p className="muted small">
              Keys: Space next unit · Enter end turn · F fortify · B found city · R road · C city ·
              D designs · T research · K culture · Esc deselect
            </p>
          </div>
        )}
      </aside>

      {battlePreview ? (
        <div className="hover-info">
          <div className="panel preview">
            {'problem' in battlePreview ? (
              <p className="bad">{battlePreview.problem}</p>
            ) : (
              <>
                <h2>{battlePreview.needsWar !== undefined ? 'Attack (declares war)' : 'Attack'}</h2>
                {battlePreview.report ? (
                  <>
                    <p>
                      Expected: you lose <b className="bad">{battlePreview.report.attacker.lost}</b>
                      , they lose <b>{battlePreview.report.defender.lost}</b> of{' '}
                      {battlePreview.report.defender.start}
                    </p>
                    <p className="muted small">
                      {battlePreview.report.outcome === 'defender-broke'
                        ? 'They should break.'
                        : battlePreview.report.outcome === 'attacker-broke'
                          ? 'Your troops would likely break first.'
                          : 'Likely indecisive.'}{' '}
                      Luck can swing it.
                    </p>
                  </>
                ) : (
                  <p>Undefended: they will scatter.</p>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        hover >= 0 &&
        game.civs[me.id].explored[hover] === 1 &&
        sel?.kind !== 'hex' && (
          <div className="hover-info">
            <HexPanel game={game} hex={hover} civId={me.id} />
          </div>
        )
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

      {dialog?.kind === 'designs' && (
        <DesignsDialog
          game={game}
          civId={me.id}
          open={dialog.open}
          report={report}
          onClose={() => {
            setDialog(null);
            bump();
          }}
        />
      )}
      {dialog?.kind === 'research' && (
        <ResearchDialog
          game={game}
          civ={me}
          onClose={() => setDialog(null)}
          onPick={id => {
            setResearchGoal(game, me.id, null);
            report(setResearch(game, me.id, id));
            setDialog(null);
          }}
          onGoal={id => report(setResearchGoal(game, me.id, id))}
        />
      )}
      {dialog?.kind === 'culture' && (
        <CultureDialog
          game={game}
          civ={me}
          perTurn={culturePerTurn}
          onClose={() => setDialog(null)}
          onTake={id => report(takeNode(game, me.id, id))}
          onUpheaval={d => report(startUpheaval(game, me.id, d))}
        />
      )}
      {me.culture.choosing && (
        <KeepDialog
          civ={me}
          onKeep={ids => {
            report(resolveUpheaval(game, me.id, ids));
            saveGame(game);
          }}
        />
      )}
      {dialog?.kind === 'peoples' && (
        <PeoplesDialog
          game={game}
          civId={me.id}
          onClose={() => setDialog(null)}
          onWar={id => setDialog({ kind: 'war', civId: id })}
          onPeace={id => report(offerPeace(game, me.id, id))}
          onDeal={(id, o) => {
            const r = proposeDeal(game, me.id, id, o);
            report({ ok: r.ok, msg: r.msg } as Result);
          }}
        />
      )}
      {dialog?.kind === 'war' && (
        <div className="modal-back" onClick={() => setDialog(null)}>
          <div className="modal confirm" onClick={e => e.stopPropagation()}>
            <h2>Declare war on the {game.civs[dialog.civId].name}?</h2>
            <p className="muted">
              They will remember. Peace can only be made after a few turns of fighting.
            </p>
            <div className="row">
              <button
                className="primary"
                onClick={() => {
                  report(declareWar(game, me.id, dialog.civId));
                  const then = dialog.then;
                  setDialog(null);
                  then?.();
                }}
              >
                Declare war
              </button>
              <button onClick={() => setDialog(null)}>Not now</button>
            </div>
          </div>
        </div>
      )}
      {dialog?.kind === 'city' && (
        <CityDialog
          game={game}
          c={game.cities.find(x => x.id === dialog.cityId)!}
          startHex={dialog.hex}
          report={report}
          onClose={() => {
            setDialog(null);
            bump();
          }}
        />
      )}
      {proposal && !dialog && (
        <ProposalDialog
          game={game}
          p={proposal}
          onAnswer={yes => {
            const r = answerProposal(game, proposal.id, yes);
            report({ ok: r.ok, msg: r.msg } as Result);
          }}
        />
      )}
      {dialog?.kind === 'battle' && (
        <BattleDialog report={dialog.report} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
