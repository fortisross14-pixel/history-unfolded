import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fx } from '../render/fx.ts';
import { isMuted, setMuted, sound } from './sound.ts';
import { difficultyOf } from '../engine/difficulty.ts';
import { VICTORY } from '../engine/victory.ts';
import { VictoryDialog } from './VictoryDialog.tsx';
import { NationDialog } from './NationDialog.tsx';
import { CrisisDialog } from './CrisisDialog.tsx';
import { StatsChart, StatsDialog } from './StatsDialog.tsx';
import { CRISIS } from '../engine/crises.ts';
import { TECHS } from '../data/techs.ts';
import type { BattleReport } from '../engine/combat.ts';
import {
  availableTechs,
  renameCity,
  trainCrew,
  assignDesign,
  attack,
  buildRoad,
  buildShip,
  isPort,
  isWaterHex,
  shipFor,
  canAttack,
  cityAt,
  declareWar,
  endTurn,
  formation,
  formationsAt,
  fortify,
  sentry,
  foundCity,
  levy,
  merge,
  offerPeace,
  orderMove,
  automate,
  automateCity,
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
  territoryRadius,
} from '../engine/game.ts';
import type { GameState } from '../engine/types.ts';
import type { Assets } from '../render/assets.ts';
import type { Insets, Overlay } from '../render/mapRenderer.ts';
import { BattleDialog } from './BattleDialog.tsx';
import { CityDialog } from './CityDialog.tsx';
import { CityPanel } from './CityPanel.tsx';
import { DesignsDialog } from './DesignsDialog.tsx';
import { FormationPanel } from './FormationPanel.tsx';
import { HexPanel } from './HexPanel.tsx';
import { MapView, mapMode, setMapMode } from './MapView.tsx';
import { Minimap } from './Minimap.tsx';
import { EmpireDialog } from './EmpireDialog.tsx';
import { FaithDialog } from './FaithDialog.tsx';
import { WhyPop } from './WhyPop.tsx';
import { GUIDE, guideSeen, guideStep, startGuide, type GuideStep } from './guide.ts';
import { CodexDialog } from './CodexDialog.tsx';
import { whyCulture, whyGold, whyScience } from '../engine/breakdown.ts';
import { SettingsDialog } from './SettingsDialog.tsx';
import { SavesDialog } from './SavesDialog.tsx';
import { settings } from './settings.ts';
import { NewsList } from './TurnNews.tsx';
import { locate, type NewsTarget } from './news.ts';
import { WonderDialog } from './WonderDialog.tsx';
import { foundProblem, tenetDue } from '../engine/faith.ts';
import { promoteColony } from '../engine/colonies.ts';
import { PeoplesDialog } from './PeoplesDialog.tsx';
import { GoodsDialog } from './GoodsDialog.tsx';
import { DynastiesDialog } from './DynastiesDialog.tsx';
import { RealmEventDialog } from './RealmEventDialog.tsx';
import { pendingRealmEvent } from '../engine/realmEvents.ts';
import { assignGovernor } from '../engine/dynasty.ts';
import { ResearchDialog } from './ResearchDialog.tsx';
import { ProposalDialog } from './ProposalDialog.tsx';
import { answerProposal, ledgerOf, proposeDeal } from '../engine/diplomacy.ts';
import { playerEvent, resolveEvent } from '../engine/events.ts';
import { absorb, giveGift } from '../engine/independents.ts';
import { EventDialog } from './EventDialog.tsx';
import { Icon } from './icons.tsx';
import { CultureDialog, KeepDialog, TagChip } from './CultureDialog.tsx';
import { resolveUpheaval, startUpheaval, takeNode } from '../engine/culture.ts';
import { cityEconomy, constructionQueue } from '../engine/economy.ts';
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
  | { kind: 'report' }
  | { kind: 'keys' }
  | { kind: 'culture' }
  | { kind: 'city'; cityId: number; hex?: number; tab?: 'overview' | 'districts' }
  | { kind: 'designs'; open?: number | 'new' }
  | { kind: 'peoples' }
  | { kind: 'goods' }
  | { kind: 'victory' }
  | { kind: 'nation'; age?: number }
  | { kind: 'crisis' }
  | { kind: 'stats'; tab?: 'rank' | 'chart' | 'chronicle' }
  | { kind: 'empire'; tab?: 'cities' | 'armies' | 'find' }
  | { kind: 'faith' }
  | { kind: 'settings' }
  | { kind: 'name-city'; cityId: number }
  | { kind: 'codex'; q?: string }
  | { kind: 'saves' }
  | { kind: 'wonders'; cityId?: number }
  | { kind: 'dynasties' }
  | { kind: 'realm-event' }
  | { kind: 'battle'; report: BattleReport }
  | { kind: 'war'; civId: number; then?: () => void }
  | null;

/** The last step opened a window (research, an event, trinkets): carry on after it. */
const afterWindow = (key: string) => !!key && !key.startsWith('unit:') && !key.startsWith('city:');

/** "research, 2 cities, 3 units" */
function todoSummary(list: { key: string }[]): string {
  const n = (k: string) => list.filter(t => t.key.startsWith(k)).length;
  const parts: string[] = [];
  if (n('research')) parts.push('choose research');
  if (n('trinkets')) parts.push('give out trinkets');
  if (n('event')) parts.push('an event to decide');
  const c = n('city:'),
    u = n('unit:');
  if (c) parts.push(`plan ${c} cit${c > 1 ? 'ies' : 'y'}`);
  if (u) parts.push(`${u} unit${u > 1 ? 's' : ''} to order`);
  return parts.join(', ');
}

/** What the Next button will do: the item after the current one. */
function nextLabel(
  list: { key: string; label: string }[],
  last: string,
  sel: { kind: string; id?: number } | null,
): string {
  const here =
    sel?.kind === 'formation' ? `unit:${sel.id}` : sel?.kind === 'city' ? `city:${sel.id}` : '';
  const at = list.findIndex(t => t.key === (afterWindow(last) ? last : here || last));
  const t = list[(at + 1) % list.length];
  const more = list.length - 1;
  const what = t.key.startsWith('unit:') ? `Next: ${t.label}` : t.label;
  return more ? `${what} (+${more})` : what;
}

const KEYS: [string, string][] = [
  ['Click', 'Select a unit, city or hex'],
  ['Right-click', 'Move the selected unit there, or attack'],
  ['W A S D', 'Move the map (arrow keys too)'],
  ['Wheel', 'Zoom the map'],
  ['Enter', 'End the turn (asks once if units still wait)'],
  ['Space', 'Next thing to do: research, a city to plan, a unit to order'],
  ['Esc', 'Close a window, or clear the selection'],
];

export function Game({
  initial,
  assets,
  onQuit,
  onRematch,
  onLoad,
}: {
  initial: GameState;
  assets: Assets;
  onQuit: () => void;
  /** a new game on the same map and settings */
  onRematch?: () => void;
  /** switch to another save of this game */
  onLoad?: (s: GameState) => void;
}) {
  const gref = useRef(initial);
  const game = gref.current;
  const me = player(game);
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion(v => v + 1), []);
  const [sel, setSel] = useState<Sel>(null);
  const [hover, setHover] = useState(-1);
  const [toasts, setToasts] = useState<
    { id: number; text: string; bad?: boolean; target?: NewsTarget | null }[]
  >([]);
  // the start-of-turn summary, grouped; closed by the player or the next turn
  const [summary, setSummary] = useState<string[] | null>(null);
  // the map lens for rail and power, once the realm has steam
  const [lens, setLens] = useState<'industry' | null>(null);
  // which realm screen (left buttons) the open dialog belongs to, for its tabs
  const [hub, setHub] = useState<HubId | null>(null);
  const openHub = (h: HubId) => {
    setHub(h);
    setDialog(HUB_TABS[h][0].dialog);
  };
  const [dialog, setDialog] = useState<Dialog>(null);
  const [map3d, setMap3d] = useState(mapMode() === '3d');
  const [center, setCenter] = useState<{ hex: number; n: number } | null>(null);
  const [view, setView] = useState<[number, number, number, number] | null>(null);
  const [mini, setMini] = useState(() => {
    try {
      return localStorage.getItem('hu-minimap') !== '0';
    } catch {
      return true;
    }
  });
  const toggleMini = () =>
    setMini(m => {
      try {
        localStorage.setItem('hu-minimap', m ? '0' : '1');
      } catch {
        /* no storage */
      }
      return !m;
    });
  const toastId = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  // the More menu folds away once something from it is open
  useEffect(() => {
    if (dialog) setMenuOpen(false);
  }, [dialog]);
  const [muted, setMute] = useState(isMuted());
  const [turnBanner, setTurnBanner] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(true);
  const topRef = useRef<HTMLElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  const turnRef = useRef<HTMLDivElement>(null);
  const [insets, setInsets] = useState<Insets>({ top: 0, right: 0, bottom: 0, left: 0 });
  // the map keeps the selected thing in the part of the screen the interface leaves free
  useLayoutEffect(() => {
    const vw = window.innerWidth,
      vh = window.innerHeight;
    const top = topRef.current?.getBoundingClientRect().bottom ?? 0;
    const side = sideRef.current?.getBoundingClientRect();
    const turn = turnRef.current?.getBoundingClientRect();
    const phone = vw < 700;
    const hasPanel = !!side && side.height > 20;
    const next: Insets = {
      top: Math.round(top),
      right: !phone && hasPanel ? Math.round(vw - side!.left) : 0,
      bottom: Math.round(
        phone && hasPanel ? vh - Math.min(side!.top, turn?.top ?? vh) : turn ? vh - turn.top : 0,
      ),
      left: 0,
    };
    if (next.top !== insets.top || next.right !== insets.right || next.bottom !== insets.bottom)
      setInsets(next);
  });
  // the first centring happened before the panels were measured: redo it once they are
  const recentred = useRef(false);
  useEffect(() => {
    if (recentred.current || (!insets.bottom && !insets.right)) return;
    recentred.current = true;
    const f = sel?.kind === 'formation' ? formation(game, sel.id) : undefined;
    if (f) setCenter({ hex: f.hex, n: Date.now() });
  }, [insets]);
  const endArmed = useRef(false);

  const toast = useCallback((text: string, bad = false, target?: NewsTarget | null) => {
    const id = ++toastId.current;
    if (bad) sound.deny();
    // the same words twice in a row are one message
    setToasts(t =>
      t.some(x => x.text === text) ? t : [...t.slice(-5), { id, text, bad, target }],
    );
    // bad news stays until tapped; the rest fades
    if (!bad) setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  const report = (r: Result) => {
    if (r.msg) toast(r.msg, !r.ok);
    bump();
    return r;
  };

  const selKey = sel ? `${sel.kind}:${'id' in sel ? sel.id : ''}` : '';
  useEffect(() => {
    if (selKey) sound.click();
  }, [selKey]);
  const vis = useMemo(() => visibleHexes(game, me.id), [version]);
  const selF = sel?.kind === 'formation' ? formation(game, sel.id) : undefined;
  const mySelF = selF && selF.civId === me.id ? selF : undefined;
  const selCity = sel?.kind === 'city' ? game.cities.find(c => c.id === sel.id) : undefined;

  const idle = () =>
    game.formations.filter(
      f =>
        f.civId === me.id &&
        f.moves > 0 &&
        !f.fortified &&
        !f.sentry &&
        f.skip !== game.turn &&
        !f.path.length &&
        !f.auto,
    );
  const focus = (hex: number) => setCenter({ hex, n: Date.now() });
  useEffect(() => {
    if (!dialog) setHub(null);
  }, [dialog]);
  // the guided first game: started for a new game, ticked by the game itself
  useEffect(() => {
    if (game.turn === 1 && !game.guide) {
      startGuide(game, me.id);
      bump();
    }
  }, []);
  useEffect(() => {
    if (dialog?.kind === 'peoples' || dialog?.kind === 'victory') guideSeen(game, dialog.kind);
  }, [dialog]);
  const guide = guideStep(game, me.id);
  const showGuide = (what: GuideStep['show']) => {
    const mineCities = game.cities.filter(c => c.civId === me.id).sort((a, b) => b.pop - a.pop);
    const pick = (kind: string) => game.formations.find(f => f.civId === me.id && f.kind === kind);
    if (what === 'settlers' || what === 'scouts') {
      const f =
        what === 'settlers'
          ? pick('settlers')
          : (game.formations.find(
              x => x.civId === me.id && x.kind === 'army' && /scout/i.test(x.name),
            ) ?? pick('army'));
      if (f) {
        setSel({ kind: 'formation', id: f.id });
        focus(f.hex);
      }
    } else if (what === 'city' || what === 'city-dialog') {
      const c = mineCities[0];
      if (!c) return;
      setSel({ kind: 'city', id: c.id });
      focus(c.hex);
      if (what === 'city-dialog') setDialog({ kind: 'city', cityId: c.id, tab: 'districts' });
    } else setDialog({ kind: what } as Dialog);
  };
  /** Take the player to what a piece of news is about. */
  const go = (t: NewsTarget) => {
    if (t.kind === 'city') {
      setSel({ kind: 'city', id: t.id });
      focus(t.hex);
    } else if (t.kind === 'formation') {
      setSel({ kind: 'formation', id: t.id });
      focus(t.hex);
    } else setDialog({ kind: t.dialog } as Dialog);
  };
  /** The next unit waiting for orders, after the one selected. */
  const selectNext = () => {
    const list = idle();
    if (!list.length) return false;
    const cur = list.findIndex(f => f.id === selF?.id);
    const f = list[(cur + 1) % list.length];
    setSel({ kind: 'formation', id: f.id });
    focus(f.hex);
    return true;
  };
  /**
   * What is still to do this turn: choose research, give idle cities something to build, order
   * units. Nothing opens by itself; the turn box walks through this list.
   */
  type Todo = { key: string; label: string; go: () => void };
  const todo = (): Todo[] => {
    const out: Todo[] = [];
    const mine = game.cities.filter(c => c.civId === me.id);
    if (!me.researching && mine.length && availableTechs(me).length)
      out.push({
        key: 'research',
        label: 'Choose research',
        go: () => setDialog({ kind: 'research' }),
      });
    if (me.crisis && !me.crisis.response)
      out.push({
        key: 'crisis',
        label: `Crisis: answer the ${CRISIS[me.crisis.id]?.name.toLowerCase() ?? 'crisis'}`,
        go: () => setDialog({ kind: 'crisis' }),
      });
    if (me.pathDue)
      out.push({
        key: 'nation',
        label: 'Choose a national direction',
        go: () => setDialog({ kind: 'nation' }),
      });
    if (!foundProblem(game, me.id))
      out.push({
        key: 'faith',
        label: 'Found a faith',
        go: () => setDialog({ kind: 'faith' }),
      });
    if (tenetDue(game, me.id))
      out.push({
        key: 'tenet',
        label: 'Choose a tenet for your faith',
        go: () => setDialog({ kind: 'faith' }),
      });
    const ev = pendingRealmEvent(game, me);
    if (ev)
      out.push({
        key: 'event',
        label: `Decide: ${ev.title}`,
        go: () => setDialog({ kind: 'realm-event' }),
      });
    if (me.trinkets.length)
      out.push({
        key: 'trinkets',
        label: `Give out ${me.trinkets.length} trinket${me.trinkets.length > 1 ? 's' : ''}`,
        go: () => setDialog({ kind: 'dynasties' }),
      });
    // settlements with nothing to build: one item hands them all to their governors
    const unplanned = mine.filter(c => !c.auto && !constructionQueue(game, c).length);
    if (unplanned.length >= 2)
      out.push({
        key: 'governors',
        label: `Let governors plan ${unplanned.length} settlements`,
        go: () => {
          for (const c of unplanned) automateCity(game, c.id, true);
          toast(
            `Governors now plan ${unplanned.length} settlements. Untick it in a settlement's panel to plan it yourself.`,
          );
          bump();
        },
      });
    for (const c of mine)
      if (!c.auto && !constructionQueue(game, c).length)
        out.push({
          key: `city:${c.id}`,
          label: `Plan ${c.name}`,
          go: () => {
            setSel({ kind: 'city', id: c.id });
            focus(c.hex);
            setDialog({ kind: 'city', cityId: c.id, tab: 'districts' });
          },
        });
    for (const f of idle())
      out.push({
        key: `unit:${f.id}`,
        label: f.name,
        go: () => {
          setSel({ kind: 'formation', id: f.id });
          focus(f.hex);
        },
      });
    return out;
  };
  const lastTodo = useRef('');
  const doNext = () => {
    const list = todo();
    if (!list.length) return false;
    const here =
      sel?.kind === 'formation' ? `unit:${sel.id}` : sel?.kind === 'city' ? `city:${sel.id}` : '';
    const last = lastTodo.current;
    const at = list.findIndex(t => t.key === (afterWindow(last) ? last : here || last));
    const t = list[(at + 1) % list.length];
    lastTodo.current = t.key;
    t.go();
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
      selectCity: (id: number) => setSel({ kind: 'city', id }),
      fx,
      /** click-to-act on a hex for the selected formation: move or attack */
      act: (hex: number) => moveTo(hex),
      /** show the turn summary with these lines (checks) */
      news: (lines: string[]) => setSummary(lines),
    };
  });

  const [busy, setBusy] = useState(false);
  const [lastReport, setLastReport] = useState<string[]>([]);
  const doEndTurn = () => {
    if (busy) return;
    setBusy(true);
    setArmed(-1);
    // let the "peoples move" banner paint before the AI thinks
    setTimeout(() => {
      try {
        runEndTurn();
      } finally {
        setBusy(false);
      }
    }, 30);
  };
  const runEndTurn = () => {
    const events = endTurn(game);
    setLastReport(events);
    setTurnBanner(game.turn);
    sound.turn();
    const every = settings().autosave;
    if (every && game.turn % every === 0) {
      const saved = saveGame(game);
      if (!saved.ok) toast(`Autosave failed: ${saved.reason}`, true);
    }
    // the news that needs the player stays up; the rest is summed up in the turn report
    const urgent = (e: string) =>
      /declared war on the|captured .* from|attacked/.test(e) && e.includes(me.name);
    const calm = events.filter(e => !urgent(e));
    events.filter(urgent).forEach(e => toast(e, true, locate(game, me.id, e)));
    // a few lines fade as notes; more make a summary, grouped, each line taking you there
    if (events.length <= 2) {
      calm.forEach(e => toast(e, false, locate(game, me.id, e)));
      setSummary(null);
    } else setSummary(events);
    bump();
    lastTodo.current = '';
    // a house has risen: the choice of side cannot wait in the to-do list
    if (me.civilWar?.pending) setDialog({ kind: 'dynasties' });
    // a new age: its card comes first, with the national direction when one is due
    else if (game.ageCard) {
      setDialog({ kind: 'nation', age: game.ageCard });
      game.ageCard = undefined;
    }
    // a crisis has struck: shown once, then it waits in the to-do list
    else if (game.crisisCard) {
      setDialog({ kind: 'crisis' });
      game.crisisCard = undefined;
    }
    // a new event is shown once; closed, it waits in the to-do list
    else if (game.realmEvents?.pending?.turn === game.turn) setDialog({ kind: 'realm-event' });
    if (!selectNext()) setSel(null);
  };

  /** Attack an adjacent enemy; asks to declare war first when at peace. */
  const doAttack = (hex: number) => {
    if (!mySelF) return;
    const chk = canAttack(game, mySelF.id, hex);
    if (chk.problem) return toast(chk.problem, true);
    const go = () => {
      const from = mySelF.hex;
      const r = attack(game, mySelF.id, hex);
      if (r.report) {
        const a = r.report.attacker,
          d = r.report.defender;
        fx.flash(hex, '#ffe3a3');
        if (d.lost) fx.float(hex, `−${d.lost}`, d.broke ? '#ffd166' : '#ff9b85');
        if (a.lost) fx.float(from, `−${a.lost}`, a.broke ? '#ffd166' : '#ff9b85');
        fx.shake(0.35 + Math.min(0.45, (a.lost + d.lost) / 900));
        sound.clash();
        if (game.cities.some(c => c.hex === hex && c.civId === me.id)) {
          fx.float(hex, '★', '#ffe08a', 0.45);
          setTimeout(() => sound.capture(), 350);
        }
      }
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
    if (r.ok) (mySelF.kind === 'fleet' ? sound.sail : sound.march)();
    report(r);
    if (!game.formations.includes(mySelF)) {
      const host = formationsAt(game, hex).find(f => f.civId === me.id && f.kind === mySelF.kind);
      setSel(host ? { kind: 'formation', id: host.id } : null);
    }
  };

  /** On touch the first tap on a target only previews (route or battle); the second one acts. */
  const [armed, setArmed] = useState(-1);
  const confirmTap = (hex: number, touch: boolean, act: () => void) => {
    if (touch && armed !== hex) {
      setArmed(hex);
      setHover(hex);
      return;
    }
    setArmed(-1);
    act();
  };
  const onClick = (hex: number, touch = false) => {
    const mineHere = formationsAt(game, hex).filter(f => f.civId === me.id);
    const cityHere = cityAt(game, hex);
    if (armed >= 0 && armed !== hex) setArmed(-1);
    // troops board an own ship next to them; ships sail into own ports
    if (mySelF && hex !== mySelF.hex && !enemyAt(hex)) {
      if (mySelF.kind !== 'fleet' && isWaterHex(game, hex) && shipFor(game, mySelF, hex))
        return confirmTap(hex, touch, () => moveTo(hex));
      if (mySelF.kind === 'fleet' && isPort(game, me.id, hex))
        return confirmTap(hex, touch, () => moveTo(hex));
    }
    // with a unit selected, clicking an adjacent enemy attacks; clicking open ground moves
    if (mySelF && hex !== mySelF.hex) {
      if (enemyAt(hex) && canAttack(game, mySelF.id, hex).target)
        return confirmTap(hex, touch, () => doAttack(hex));
      if (
        !mineHere.length &&
        !(cityHere && cityHere.civId === me.id) &&
        !enemyAt(hex) &&
        game.civs[me.id].explored[hex]
      )
        return confirmTap(hex, touch, () => moveTo(hex));
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
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === 'Escape' && dialog && dialog.kind !== 'war') {
        setDialog(null);
        return;
      }
      // held keys repeat; modifiers belong to the browser; focused controls keep their keys
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (
        ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tag) ||
        (e.target as HTMLElement).isContentEditable
      )
        return;
      if (dialog || proposal || me.culture.choosing || busy) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === 'Enter') {
        e.preventDefault();
        // ask once when units still wait for orders
        const left = todo();
        if (left.length && !endArmed.current) {
          endArmed.current = true;
          setTimeout(() => (endArmed.current = false), 2500);
          toast(`Still to do: ${todoSummary(left)}. Press Enter again to end the turn.`);
          return;
        }
        endArmed.current = false;
        doEndTurn();
      } else if (key === ' ') {
        e.preventDefault();
        doNext();
      } else if (key === 'Escape') {
        setSel(null);
        setArmed(-1);
      }
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
    if (lens) o.lens = lens;
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
  }, [sel, hover, version, battlePreview, lens]);

  const research_ = me.researching ? TECHS[me.researching] : null;
  const culturePerTurn = useMemo(
    () =>
      Math.round(
        game.cities
          .filter(c => c.civId === me.id)
          .reduce((a, c) => a + cityEconomy(game, c).total.culture, 0),
      ),
    [version],
  );
  const todos = todo();
  // goods running out within ten turns
  const goodsShort = useMemo(
    () =>
      Object.values(ledgerOf(game, me.id)).filter(l => l.net < 0 && l.stock < -l.net * 10).length,
    [version],
  );
  const wars = game.wars.filter(w => w.a === me.id || w.b === me.id).length;
  const massing = game.civs.filter(c => c.alive && c.warPlan?.target === me.id).length;

  const proposal = game.proposals.find(p => p.to === me.id);
  // a rival holding a victory goal: shown on the Victory button
  const rivalHold = Object.values(game.holding ?? {}).filter(h => h.civId !== me.id).length;
  const goldPerTurn = useMemo(() => Math.round(whyGold(game, me.id).total), [version]);
  const sciencePerTurn = useMemo(() => Math.round(whyScience(game, me.id).total), [version]);
  /** the realm buttons on the left: a pill when something there needs the player */
  const railPill = (h: HubId): string => {
    if (h === 'diplomacy')
      return massing ? 'threat' : wars ? `${wars} war${wars > 1 ? 's' : ''}` : '';
    if (h === 'nation')
      return me.civilWar
        ? 'civil war'
        : me.crisis && !me.crisis.response
          ? 'crisis'
          : me.pathDue
            ? 'choose'
            : me.trinkets.length
              ? `${me.trinkets.length} to give`
              : '';
    if (h === 'military') {
      const n = idle().length;
      return n ? `${n} idle` : '';
    }
    return '';
  };
  const pendingEvent = playerEvent(game);
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
            {e && e.reason !== 'score' && e.reason !== 'conquest' && e.reason !== 'defeat'
              ? `${won ? `The ${me.name}` : `The ${game.civs[e.winner].name}`} win the ${VICTORY[e.reason].name} victory.`
              : ''}
            {e?.reason === 'score'
              ? `The ${game.civs[e.winner].name} are remembered as the greatest people of the age.`
              : ''}
            {!me.alive ? ` The chronicles will remember the ${me.name}.` : ''}
          </p>
          <p className="muted small">Difficulty: {difficultyOf(game).name}</p>
          <h3>Score over the game</h3>
          <StatsChart game={game} civId={me.id} metric="score" height={200} />
          {(game.chronicle ?? []).some(c => c.civId === me.id) && (
            <>
              <h3>Your chronicle</h3>
              <ol className="chronicle short">
                {(game.chronicle ?? [])
                  .filter(c => c.civId === me.id && c.kind !== 'found')
                  .slice(-12)
                  .map((c, i) => (
                    <li key={i}>
                      <span className="chron-turn">Turn {c.turn}</span> <span>{c.text}</span>
                    </li>
                  ))}
              </ol>
            </>
          )}
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
          {onRematch && (
            <button className="wide" onClick={onRematch}>
              Play again on the same map
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
          key={map3d ? '3d' : '2d'}
          game={game}
          civId={me.id}
          assets={assets}
          version={version}
          overlay={overlay}
          centerOn={center}
          onClick={onClick}
          onMove={h => (mySelF ? moveTo(h) : onClick(h))}
          onHover={setHover}
          insets={insets}
          onView={r => setView(v => (v && v.every((x, i) => Math.abs(x - r[i]) < 0.05) ? v : r))}
        />
      </div>

      <header className={`topbar ${menuOpen ? 'menu-open' : ''}`} ref={topRef}>
        <span className="crest" style={{ ['--civ' as string]: me.color }} aria-hidden>
          <Icon name="crown" line />
        </span>
        <span className="civ-name">
          <span className="swatch" style={{ background: me.color }} />
          {me.name}
        </span>
        <span className="turn-count">
          Turn <b>{game.turn}</b>
          <small className="muted">/{game.settings.turnLimit ?? 400}</small>
        </span>
        <WhyPop
          className="stat"
          title="Gold a turn"
          unit="gold"
          why={() => whyGold(game, me.id)}
          onCodex={() => setDialog({ kind: 'codex', q: 'gold' })}
        >
          <span tabIndex={0} aria-label={`Gold ${Math.floor(me.gold)}`}>
            <Icon name="gold" /> {Math.floor(me.gold)}{' '}
            <small className={goldPerTurn < 0 ? 'bad' : 'muted'}>
              ({goldPerTurn >= 0 ? '+' : ''}
              {goldPerTurn})
            </small>
          </span>
        </WhyPop>
        <WhyPop
          className="stat"
          title="Science a turn"
          unit="science"
          why={() => whyScience(game, me.id)}
        >
          <button
            className="stat-btn"
            data-k="research"
            onClick={() => setDialog({ kind: 'research' })}
            title="Research"
          >
            <Icon name="research" />{' '}
            <span className="stat-name">{research_ ? research_.name : 'Choose research'}</span>
            {research_ && (
              <small className="muted">
                {' '}
                {Math.floor(me.science)}/{techCost(game, me, research_.id)}
              </small>
            )}{' '}
            <small className="muted">(+{sciencePerTurn})</small>
          </button>
        </WhyPop>
        <WhyPop
          className="stat"
          title="Culture a turn"
          unit="culture"
          why={() => whyCulture(game, me.id)}
        >
          <button
            className="stat-btn"
            data-k="culture"
            onClick={() => setDialog({ kind: 'culture' })}
            title="Culture"
          >
            <Icon name="culture" /> {Math.floor(me.culture.points)}{' '}
            <small className="muted">(+{culturePerTurn})</small>
            {me.culture.upheaval ? (
              <b className="war-pill">{DOMAINS[me.culture.upheaval.domain].upheaval}</b>
            ) : null}
          </button>
        </WhyPop>
        <div className={`minimap-box ${mini ? '' : 'closed'}`}>
          <div className="minimap-bar">
            <button
              className="link"
              onClick={() => setDialog({ kind: 'empire' })}
              title="Empire: settlements, armies, find"
            >
              <Icon name="sight" /> Find
            </button>
            <button
              className="link"
              onClick={toggleMini}
              title="Show or hide the minimap"
              aria-pressed={mini}
            >
              {mini ? 'Hide map' : 'Minimap'}
            </button>
            {me.techs.includes('steam-power') && (
              <button
                className={`link ${lens ? 'on' : ''}`}
                onClick={() => setLens(l => (l ? null : 'industry'))}
                title="Rail and power: which settlements are on the railway and what their industry lacks"
                aria-pressed={!!lens}
              >
                Rail &amp; power
              </button>
            )}
          </div>
          {guide && (
            <div className="guide-card" role="note" aria-label="Guide">
              <small className="muted">
                Guide {guide.n}/{GUIDE.length}
              </small>
              <b>{guide.step.title}</b>
              <span>{guide.step.hint}</span>
              <span className="guide-actions">
                <button className="small" onClick={() => showGuide(guide.step.show)}>
                  Show me
                </button>
                <button
                  className="link small"
                  onClick={() => {
                    game.guide!.off = true;
                    bump();
                  }}
                >
                  Hide the guide
                </button>
              </span>
            </div>
          )}
          {mini && (
            <Minimap game={game} civId={me.id} version={version} view={view} onJump={focus} />
          )}
        </div>
        <button
          className="more-btn"
          onClick={() => setMenuOpen(o => !o)}
          aria-expanded={menuOpen}
          aria-label="More"
        >
          <Icon name="menu" />
        </button>
        <span className="spacer" />
        <button
          className="secondary"
          onClick={() => setDialog({ kind: 'victory' })}
          title="Victory: the ways to win"
        >
          <Icon name="target" /> Victory
          {rivalHold ? <b className="war-pill">{rivalHold} close</b> : ''}
        </button>
        <button
          className="secondary"
          onClick={() => setDialog({ kind: 'goods' })}
          title="Goods per turn"
        >
          <Icon name="goods" /> Goods
          {goodsShort ? <b className="war-pill">{goodsShort} short</b> : ''}
        </button>
        <button
          className="secondary round"
          onClick={() => setDialog({ kind: 'report' })}
          disabled={!lastReport.length}
          title="What happened last turn"
          aria-label="Last turn"
        >
          <Icon name="report" />
        </button>
        <button
          className="secondary round"
          onClick={() => {
            const next = map3d ? '2d' : '3d';
            setMapMode(next);
            setMap3d(next === '3d');
          }}
          title={map3d ? 'Switch to the flat 2D map' : 'Switch to the low-poly 3D map'}
          aria-label={map3d ? '2D map' : '3D map'}
        >
          <Icon name="layers" />
        </button>
        <button
          className="secondary round"
          onClick={() => setDialog({ kind: 'codex' })}
          title="Codex: help for every part of the game"
          aria-label="Codex and help"
        >
          <Icon name="help" />
        </button>
        <button
          className="secondary round"
          aria-label={muted ? 'Sound off' : 'Sound on'}
          onClick={() => {
            setMuted(!muted);
            setMute(!muted);
          }}
          aria-pressed={!muted}
          title={muted ? 'Sound off' : 'Sound on'}
        >
          <Icon name={muted ? 'mute' : 'sound'} />
        </button>
        <button
          className="secondary round"
          onClick={() => setDialog({ kind: 'settings' })}
          title="Settings: sizes, motion, sound, autosave"
          aria-label="Settings"
        >
          <Icon name="settings" />
        </button>
        <button
          className="secondary"
          onClick={() => setDialog({ kind: 'saves' })}
          title="Save, save under a name, export to a file, load"
        >
          Save
        </button>
        <button
          className="secondary"
          onClick={() => {
            saveGame(game);
            onQuit();
          }}
        >
          Menu
        </button>
      </header>
      <nav className="left-rail" aria-label="Realm">
        {HUBS.map(h => (
          <button
            key={h.id}
            className={`rail-btn ${hub === h.id && dialog ? 'on' : ''}`}
            onClick={() => openHub(h.id)}
            title={h.title}
            aria-label={h.name}
          >
            <Icon name={h.icon} />
            <span className="rail-label">{h.name}</span>
            {railPill(h.id) ? <b className="war-pill">{railPill(h.id)}</b> : null}
          </button>
        ))}
      </nav>

      <aside className={`side ${sheetOpen ? '' : 'peek'} ${sel ? 'has-sel' : ''}`} ref={sideRef}>
        {sel && (
          <div className="side-bar">
            <button
              className="sheet-handle"
              onClick={() => setSheetOpen(o => !o)}
              aria-label={sheetOpen ? 'Shrink panel' : 'Expand panel'}
            >
              <span />
            </button>
            <button className="x panel-close" onClick={() => setSel(null)} aria-label="Close">
              ×
            </button>
          </div>
        )}
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
              const c = r.ok ? cityAt(game, hex) : undefined;
              if (c) {
                // a new settlement is named first
                setSel({ kind: 'city', id: c.id });
                setDialog({ kind: 'name-city', cityId: c.id });
              }
            }}
            onFortify={() => report(fortify(game, selF.id))}
            onSentry={() => {
              report(sentry(game, selF.id));
              selectNext();
            }}
            onSkip={() => {
              selF.skip = game.turn;
              if (!selectNext()) setSel(null);
              bump();
            }}
            onRename={n => report(rename(game, selF.id, n))}
            onClearOrders={() => {
              selF.path = [];
              bump();
            }}
            onRoad={() => report(buildRoad(game, selF.id))}
            onAuto={mode => report(automate(game, selF.id, mode))}
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
            onShip={designId => report(buildShip(game, selCity.id, designId))}
            onGovernor={id => report(assignGovernor(game, me.id, selCity.id, id) as Result)}
            onRename={n => report(renameCity(game, selCity.id, n))}
            onAuto={on => report(automateCity(game, selCity.id, on))}
            onWonder={() => setDialog({ kind: 'wonders', cityId: selCity.id })}
            onPromote={() =>
              report(promoteColony(game, selCity.id, territoryRadius(game, me.id)) as Result)
            }
            onCrew={kind => {
              const r = report(trainCrew(game, selCity.id, kind));
              const f = r.ok
                ? formationsAt(game, selCity.hex)
                    .filter(x => x.civId === me.id && x.kind === kind)
                    .pop()
                : undefined;
              if (f) setSel({ kind: 'formation', id: f.id });
            }}
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
            onOpenDistrict={cityId =>
              setDialog({ kind: 'city', cityId, hex: sel.hex, tab: 'districts' })
            }
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
              Keys: W A S D move the map · Space next unit · Enter end turn · Esc deselect
            </p>
          </div>
        )}
      </aside>

      {armed >= 0 && mySelF && (
        <div className="armed-bar" role="status">
          <span>
            {enemyAt(armed) ? 'Tap the enemy again to attack' : 'Tap the hex again to go there'}
          </span>
          <button className="primary" onClick={() => onClick(armed, false)}>
            {enemyAt(armed) ? 'Attack' : 'Go'}
          </button>
          <button onClick={() => setArmed(-1)}>Cancel</button>
        </div>
      )}
      {battlePreview ? (
        <div className="hover-info preview-box">
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

      {turnBanner > 0 && !busy && (
        <div
          className="turn-banner"
          key={turnBanner}
          aria-hidden
          onAnimationEnd={() => setTurnBanner(0)}
        >
          Turn {turnBanner}
        </div>
      )}
      {busy && (
        <div className="busy" role="status" aria-live="polite">
          The peoples move…
        </div>
      )}
      <div className="turn-box" ref={turnRef}>
        <button
          className="next"
          onClick={doNext}
          disabled={!todos.length}
          title={todos.length ? `To do: ${todoSummary(todos)}` : undefined}
        >
          {todos.length ? nextLabel(todos, lastTodo.current, sel) : 'All done'}
        </button>
        <button className="end-turn" onClick={doEndTurn} disabled={busy} title="End turn">
          <Icon name="end-turn" className="end-ico" line />
          <b>End turn</b>
          {todos.length ? <small>{todos.length} to do</small> : <small>All done</small>}
        </button>
      </div>

      {summary && !dialog && (
        <aside className="turn-summary" aria-label={`Turn ${game.turn - 1} in brief`}>
          <header>
            <b>Turn {game.turn - 1} in brief</b>
            <button className="x" onClick={() => setSummary(null)} aria-label="Close">
              ×
            </button>
          </header>
          <NewsList
            game={game}
            civId={me.id}
            lines={summary}
            limit={4}
            onGo={t => {
              setSummary(null);
              go(t);
            }}
          />
        </aside>
      )}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.length > 3 && (
          <button className="toast more" onClick={() => setToasts(x => x.slice(-3))}>
            +{toasts.length - 3} earlier · clear
          </button>
        )}
        {toasts.slice(-3).map(t => (
          <button
            key={t.id}
            className={`toast ${t.bad ? 'bad' : ''} ${t.target ? 'goes' : ''}`}
            onClick={() => {
              setToasts(x => x.filter(y => y.id !== t.id));
              if (t.target) go(t.target);
            }}
            title={t.target ? 'Go there' : 'Dismiss'}
          >
            {t.bad ? '⚠ ' : ''}
            {t.text}
          </button>
        ))}
      </div>
      {dialog?.kind === 'report' && (
        <div className="modal-back" onClick={() => setDialog(null)}>
          <div
            className="modal report"
            role="dialog"
            aria-modal="true"
            aria-label="Last turn"
            onClick={e => e.stopPropagation()}
          >
            <header>
              <h2>Turn {game.turn - 1}</h2>
              <button className="x" onClick={() => setDialog(null)} aria-label="Close">
                ×
              </button>
            </header>
            <NewsList
              game={game}
              civId={me.id}
              lines={lastReport}
              onGo={t => {
                setDialog(null);
                go(t);
              }}
            />
          </div>
        </div>
      )}

      {dialog?.kind === 'keys' && (
        <div className="modal-back" onClick={() => setDialog(null)}>
          <div
            className="modal keys"
            role="dialog"
            aria-modal="true"
            aria-label="Keys"
            onClick={e => e.stopPropagation()}
          >
            <header>
              <h2>Keys and mouse</h2>
              <button className="x" onClick={() => setDialog(null)} aria-label="Close">
                ×
              </button>
            </header>
            <dl className="keys-list">
              {KEYS.map(([k, what]) => (
                <div key={k}>
                  <dt>
                    {k.split(' ').map(x => (
                      <kbd key={x}>{x}</kbd>
                    ))}
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
            <p className="muted">
              On a phone or tablet: tap to select, tap a hex once to see the route or battle, tap it
              again to go. Pinch to zoom, drag to pan.
            </p>
          </div>
        </div>
      )}

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
      {dialog?.kind === 'realm-event' && (
        <RealmEventDialog
          game={game}
          civ={me}
          report={r => report({ ok: r.ok, msg: r.msg } as Result)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'dynasties' && (
        <DynastiesDialog
          game={game}
          civId={me.id}
          report={r => report({ ok: r.ok, msg: r.msg } as Result)}
          onClose={() => setDialog(null)}
        />
      )}
      {hub && dialog && HUB_TABS[hub].some(t => sameTab(t.dialog, dialog)) && (
        <div className="hub-tabs" role="tablist" aria-label={HUBS.find(h => h.id === hub)!.name}>
          <b>{HUBS.find(h => h.id === hub)!.name}</b>
          {HUB_TABS[hub].map(t => (
            <button
              key={t.label}
              role="tab"
              aria-selected={sameTab(t.dialog, dialog)}
              className={sameTab(t.dialog, dialog) ? 'on' : ''}
              onClick={() => setDialog(t.dialog)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {dialog?.kind === 'wonders' && (
        <WonderDialog
          game={game}
          civ={me}
          cityId={dialog.cityId}
          report={r => {
            report(r as Result);
            bump();
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'settings' && <SettingsDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'name-city' && (
        <NameCity
          suggested={game.cities.find(c => c.id === dialog.cityId)?.name ?? ''}
          onDone={name => {
            if (name.trim()) report(renameCity(game, dialog.cityId, name));
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === 'codex' && (
        <CodexDialog
          q={dialog.q}
          onKeys={() => setDialog({ kind: 'keys' })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'saves' && (
        <SavesDialog
          game={game}
          onClose={() => setDialog(null)}
          report={(ok, msg) => toast(msg, !ok)}
          onLoad={st => {
            setDialog(null);
            onLoad?.(st);
          }}
        />
      )}
      {dialog?.kind === 'faith' && (
        <FaithDialog
          game={game}
          civ={me}
          report={r => {
            report(r as Result);
            bump();
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'empire' && (
        <EmpireDialog
          key={dialog.tab ?? 'cities'}
          game={game}
          civId={me.id}
          tab={dialog.tab}
          onCity={id => {
            const c = game.cities.find(x => x.id === id)!;
            if (c.civId === me.id) {
              // your own settlement: its screen
              setSel({ kind: 'city', id });
              focus(c.hex);
              setDialog({ kind: 'city', cityId: id });
              return;
            }
            setDialog(null);
            focus(c.hex);
          }}
          onFormation={id => {
            const f = game.formations.find(x => x.id === id)!;
            setDialog(null);
            setSel({ kind: 'formation', id });
            focus(f.hex);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'stats' && (
        <StatsDialog
          key={dialog.tab ?? 'rank'}
          game={game}
          civId={me.id}
          tab={dialog.tab}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'crisis' && (
        <CrisisDialog
          game={game}
          civ={me}
          report={r => report(r as Result)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'nation' && (
        <NationDialog
          game={game}
          civ={me}
          age={dialog.age}
          onCrisis={() => setDialog({ kind: 'crisis' })}
          onFaith={() => setDialog({ kind: 'faith' })}
          onWonders={() => setDialog({ kind: 'wonders' })}
          report={r => report(r as Result)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'victory' && <VictoryDialog game={game} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'goods' && (
        <GoodsDialog
          game={game}
          civId={me.id}
          onClose={() => setDialog(null)}
          onDeal={(id, o) => {
            const r = proposeDeal(game, me.id, id, o);
            report({ ok: r.ok, msg: r.msg } as Result);
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
          onGift={(id, gold) => report(giveGift(game, me.id, id, gold) as Result)}
          onAbsorb={id => report(absorb(game, me.id, id) as Result)}
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
          startTab={dialog.tab}
          report={report}
          onClose={() => {
            setDialog(null);
            bump();
          }}
        />
      )}
      {pendingEvent && !dialog && !proposal && (
        <EventDialog
          game={game}
          p={pendingEvent}
          onChoose={i => {
            const r = resolveEvent(game, pendingEvent.id, i);
            report({ ok: r.ok, msg: r.msg } as Result);
            saveGame(game);
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

/** Name a settlement just founded (its suggested name is ready to keep). */
function NameCity({ suggested, onDone }: { suggested: string; onDone: (n: string) => void }) {
  const [name, setName] = useState(suggested);
  return (
    <div className="modal-back" onClick={() => onDone(name)}>
      <div
        className="modal name-city"
        role="dialog"
        aria-modal="true"
        aria-label="Name your settlement"
        onClick={e => e.stopPropagation()}
      >
        <header>
          <h2>A new settlement</h2>
        </header>
        <p className="muted small">What will it be called?</p>
        <input
          autoFocus
          value={name}
          maxLength={24}
          onFocus={e => e.target.select()}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            e.stopPropagation();
            if (e.key === 'Enter') onDone(name);
          }}
          aria-label="Settlement name"
        />
        <div className="row">
          <button className="primary" onClick={() => onDone(name)}>
            Found {name.trim() || suggested}
          </button>
        </div>
      </div>
    </div>
  );
}

type HubId = 'military' | 'cities' | 'nation' | 'diplomacy';
const HUBS: { id: HubId; name: string; icon: string; title: string }[] = [
  { id: 'military', name: 'Military', icon: 'army', title: 'Military: your units and designs' },
  { id: 'cities', name: 'Cities', icon: 'cities', title: 'Cities and wonders' },
  { id: 'nation', name: 'Nation', icon: 'flag', title: 'Nation, faith, dynasties and chronicle' },
  { id: 'diplomacy', name: 'Diplomacy', icon: 'peoples', title: 'Diplomacy and rankings' },
];
const HUB_TABS: Record<HubId, { label: string; dialog: Dialog }[]> = {
  military: [
    { label: 'Units', dialog: { kind: 'empire', tab: 'armies' } },
    { label: 'Designs', dialog: { kind: 'designs' } },
  ],
  cities: [
    { label: 'Cities', dialog: { kind: 'empire', tab: 'cities' } },
    { label: 'Wonders', dialog: { kind: 'wonders' } },
  ],
  nation: [
    { label: 'Nation', dialog: { kind: 'nation' } },
    { label: 'Faith', dialog: { kind: 'faith' } },
    { label: 'Dynasties', dialog: { kind: 'dynasties' } },
    { label: 'Chronicle', dialog: { kind: 'stats', tab: 'chronicle' } },
  ],
  diplomacy: [
    { label: 'Peoples', dialog: { kind: 'peoples' } },
    { label: 'Rankings', dialog: { kind: 'stats', tab: 'rank' } },
  ],
};
/** Is this open dialog the one a hub tab shows (same kind, and same inner tab when it has one)? */
function sameTab(a: Dialog, b: Dialog): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  const ta = (a as { tab?: string }).tab,
    tb = (b as { tab?: string }).tab;
  return !ta || !tb || ta === tb;
}
