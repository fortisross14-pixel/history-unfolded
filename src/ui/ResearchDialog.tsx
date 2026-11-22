import { useMemo } from 'react';
import { DEPOSITS } from '../data/goods.ts';
import { ITEM_LIST } from '../data/items.ts';
import { describeMods } from '../data/mods.ts';
import { SLOT_LIST } from '../data/slots.ts';
import { ERAS, TECH_LIST, TECHS, type TechInfo } from '../data/techs.ts';
import { TAGS } from '../data/culture.ts';
import { availableTechs, goalStep, techCost } from '../engine/game.ts';
import { tagCounts } from '../engine/mods.ts';
import { Art } from './bits.tsx';
import type { Civ, GameState } from '../engine/types.ts';

interface Props {
  game: GameState;
  civ: Civ;
  onPick: (id: string) => void;
  onGoal: (id: string | null) => void;
  onClose: () => void;
}

const W = 230,
  H = 84,
  GX = 70,
  GY = 12;

/** What a tech gives, in words. */
export function techUnlocks(t: TechInfo): string[] {
  const out: string[] = [];
  const items = ITEM_LIST.filter(i => i.tech === t.id).map(i => i.name);
  const slots = SLOT_LIST.filter(x => x.tech === t.id).map(x => x.name);
  const reveals = Object.values(DEPOSITS)
    .filter(d => d.revealedBy === t.id)
    .map(d => d.name);
  if (items.length) out.push(`⚔ ${items.join(', ')}`);
  if (slots.length) out.push(`▦ ${slots.join(', ')}`);
  if (reveals.length) out.push(`👁 reveals ${reveals.join(', ')}`);
  if (t.mods) out.push(`★ ${describeMods(t.mods)}`);
  return out;
}

/** The research tree: four eras, prerequisites drawn as lines. Click to research or set a goal. */
export function ResearchDialog({ game, civ, onPick, onGoal, onClose }: Props) {
  const avail = new Set(availableTechs(civ).map(t => t.id));
  const tags = tagCounts(civ);
  // lay out each era in a column, deeper techs lower down
  const pos = useMemo(() => {
    const depth = (id: string): number => {
      const t = TECHS[id];
      const same = t.requires.filter(r => TECHS[r].era === t.era);
      return same.length ? 1 + Math.max(...same.map(depth)) : 0;
    };
    const p: Record<string, { x: number; y: number }> = {};
    for (let era = 1; era <= 4; era++) {
      const list = TECH_LIST.filter(t => t.era === era).sort(
        (a, b) => depth(a.id) - depth(b.id) || a.cost - b.cost,
      );
      list.forEach((t, i) => (p[t.id] = { x: (era - 1) * (W + GX), y: 30 + i * (H + GY) }));
    }
    return p;
  }, []);
  const height = Math.max(...Object.values(pos).map(p => p.y)) + H + 20;
  const width = 4 * W + 3 * GX;
  // the path to the goal
  const path = new Set<string>();
  if (civ.researchGoal) {
    const walk = (id: string) => {
      if (civ.techs.includes(id) || path.has(id)) return;
      path.add(id);
      TECHS[id].requires.forEach(walk);
    };
    walk(civ.researchGoal);
  }
  const next = civ.researchGoal ? goalStep(civ, civ.researchGoal) : null;

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal research" onClick={e => e.stopPropagation()}>
        <header>
          <h2>
            Research{' '}
            <small>
              {civ.techs.length}/{TECH_LIST.length} known · {Math.floor(civ.science)} science stored
              {civ.researching ? ` · researching ${TECHS[civ.researching].name}` : ''}
              {civ.researchGoal ? ` · goal ${TECHS[civ.researchGoal].name}` : ''}
            </small>
          </h2>
          <button className="x" onClick={onClose}>
            ×
          </button>
        </header>
        <p className="muted small">
          Research unlocks parts, not finished units. Click an available tech to research it, or any
          later one to set it as a goal: research then follows its prerequisites. Techs your culture
          leans towards cost 20% less.
          {civ.researchGoal && (
            <button className="link" onClick={() => onGoal(null)}>
              clear goal
            </button>
          )}
        </p>
        <div className="tree-scroll">
          <div className="tree" style={{ width, height }}>
            {[1, 2, 3, 4].map(e => (
              <div key={e} className="era-label" style={{ left: (e - 1) * (W + GX), width: W }}>
                {ERAS[e]}
              </div>
            ))}
            <svg className="tree-lines" width={width} height={height}>
              {TECH_LIST.flatMap(t =>
                t.requires.map(r => {
                  const a = pos[r],
                    b = pos[t.id];
                  const known = civ.techs.includes(r);
                  const hot = path.has(t.id) && (path.has(r) || known);
                  const sameCol = a.x === b.x;
                  const d = sameCol
                    ? `M ${a.x + 8} ${a.y + H / 2} C ${a.x - 24} ${a.y + H / 2}, ${b.x - 24} ${b.y + H / 2}, ${b.x} ${b.y + H / 2}`
                    : `M ${a.x + W} ${a.y + H / 2} C ${a.x + W + GX / 2} ${a.y + H / 2}, ${b.x - GX / 2} ${b.y + H / 2}, ${b.x} ${b.y + H / 2}`;
                  return (
                    <path
                      key={`${r}-${t.id}`}
                      d={d}
                      className={`tl ${known ? 'known' : ''} ${hot ? 'hot' : ''}`}
                    />
                  );
                }),
              )}
            </svg>
            {TECH_LIST.map(t => {
              const known = civ.techs.includes(t.id);
              const on = civ.researching === t.id;
              const can = avail.has(t.id);
              const fav = t.favoured && (tags[t.favoured] ?? 0) >= 2;
              const cost = techCost(game, civ, t.id);
              return (
                <button
                  key={t.id}
                  className={`tech-card ${known ? 'known' : ''} ${on ? 'on' : ''} ${can ? 'can' : ''} ${path.has(t.id) ? 'path' : ''} ${next === t.id ? 'next' : ''}`}
                  style={{ left: pos[t.id].x, top: pos[t.id].y, width: W, height: H }}
                  disabled={known}
                  onClick={() => (can ? onPick(t.id) : onGoal(t.id))}
                  title={t.note}
                >
                  <span className="tech-head">
                    <Art k={`tech/${t.id}`} size={30} className="tech-art" />
                    <b>{t.name}</b>
                    <small>
                      {known ? '✓' : on ? `${Math.floor(civ.science)}/${cost}` : cost}
                      {fav && !known ? ` · ${TAGS[t.favoured!].name} −20%` : ''}
                    </small>
                  </span>
                  <span className="tech-unlocks">
                    {techUnlocks(t).map((u, i) => (
                      <small key={i}>{u}</small>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
