import { useState } from 'react';
import {
  CULTURE,
  CULTURE_LIST,
  DOMAIN_LIST,
  DOMAINS,
  TAG_TIERS,
  TAGS,
  type CultureNode,
  type Domain,
} from '../data/culture.ts';
import { describeMods } from '../data/mods.ts';
import {
  canStartUpheaval,
  FORCED_AT,
  KEEP_AFTER_UPHEAVAL,
  keepable,
  nodeCost,
  nodeStatus,
  UPHEAVAL_AT,
} from '../engine/culture.ts';
import { identity } from '../engine/mods.ts';
import type { Civ, GameState } from '../engine/types.ts';

interface Props {
  game: GameState;
  civ: Civ;
  perTurn: number;
  onTake: (id: string) => void;
  onUpheaval: (d: Domain) => void;
  onClose: () => void;
}

export function TagChip({ tag }: { tag: string }) {
  return <span className={`tag tag-${tag}`}>{TAGS[tag]?.name ?? tag}</span>;
}

/** The culture web: nine domains, four tiers, forks that close doors, tension and upheavals. */
export function CultureDialog({ game, civ, perTurn, onTake, onUpheaval, onClose }: Props) {
  const [focus, setFocus] = useState<Domain | 'all'>('all');
  const ident = identity(civ);
  const c = civ.culture;
  const domains = focus === 'all' ? DOMAIN_LIST : [focus];

  const nodeCard = (n: CultureNode) => {
    const st = nodeStatus(civ, n);
    const cost = nodeCost(game, civ, n);
    const can =
      (st.kind === 'available' || (st.kind === 'legacy' && st.adoptable)) && c.points >= cost;
    const reason =
      st.kind === 'taken'
        ? 'Adopted'
        : st.kind === 'legacy'
          ? st.adoptable
            ? `Legacy (half effect) · re-adopt for ${cost}`
            : 'Legacy (half effect)'
          : st.kind === 'locked'
            ? `Closed by ${CULTURE[st.by].name}`
            : st.kind === 'upheaval'
              ? 'Domain in upheaval'
              : st.kind === 'needs'
                ? `Needs ${st.missing
                    .map(m =>
                      m
                        .split('|')
                        .map(x => CULTURE[x]?.name ?? x)
                        .join(' or '),
                    )
                    .join(', ')}`
                : `${cost} culture`;
    const crossReq = [...n.requires, ...n.requiresAny].filter(r => CULTURE[r]?.domain !== n.domain);
    return (
      <button
        key={n.id}
        className={`cnode ${st.kind} ${can ? 'can' : ''}`}
        disabled={!can}
        onClick={() => onTake(n.id)}
        title={n.note}
      >
        <b>{n.name}</b>
        <span className="tags">
          {n.tags.map(t => (
            <TagChip key={t} tag={t} />
          ))}
        </span>
        <small>{describeMods(n.mods)}</small>
        {crossReq.length > 0 && (
          <small className="muted">
            ↔{' '}
            {crossReq
              .map(r => `${CULTURE[r].name} (${DOMAINS[CULTURE[r].domain].name})`)
              .join(', ')}
          </small>
        )}
        <small className={`cstate ${st.kind}`}>{reason}</small>
      </button>
    );
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal culture" onClick={e => e.stopPropagation()}>
        <header>
          <h2>
            Culture{' '}
            <small>
              {Math.floor(c.points)} culture (+{perTurn}/turn) · {c.taken.length} adopted
              {c.legacy.length ? ` · ${c.legacy.length} legacy` : ''}
            </small>
          </h2>
          <button className="x" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="identity">
          <span className="muted small">Identity:</span>
          {ident.length === 0 && (
            <span className="muted small">none yet: every people starts the same.</span>
          )}
          {ident.map(i => (
            <span
              key={i.tag}
              className="ident"
              title={`${TAGS[i.tag].note} Bonuses at ${TAG_TIERS.join(', ')}: ${TAGS[i.tag].tiers.map(describeMods).join(' | ')}`}
            >
              <TagChip tag={i.tag} /> {i.count}
              <span className="pips">
                {TAG_TIERS.map((t, k) => (
                  <i key={t} className={k < i.tier ? 'on' : ''} />
                ))}
              </span>
            </span>
          ))}
        </div>
        {ident.some(i => i.tier > 0) && (
          <p className="small">
            {ident
              .filter(i => i.tier > 0)
              .map(
                i =>
                  `${TAGS[i.tag].name}: ${TAGS[i.tag].tiers.slice(0, i.tier).map(describeMods).join(', ')}`,
              )
              .join(' · ')}
          </p>
        )}
        {c.upheaval && (
          <p className="upheaval-banner">
            {DOMAINS[c.upheaval.domain].upheaval} in progress: {c.upheaval.turnsLeft} turns left.
            Yields and morale suffer until it ends; then the old{' '}
            {DOMAINS[c.upheaval.domain].name.toLowerCase()} gives way and closed paths reopen.
          </p>
        )}

        <div className="domain-tabs">
          <button className={focus === 'all' ? 'on' : ''} onClick={() => setFocus('all')}>
            All
          </button>
          {DOMAIN_LIST.map(d => (
            <button
              key={d}
              className={focus === d ? 'on' : ''}
              onClick={() => setFocus(d)}
              style={{ borderColor: DOMAINS[d].color }}
            >
              {DOMAINS[d].name}
            </button>
          ))}
        </div>

        <div className="web">
          {domains.map(d => {
            const t = c.tension[d];
            const why = canStartUpheaval(civ, d);
            return (
              <div key={d} className="domain-row" style={{ borderLeftColor: DOMAINS[d].color }}>
                <div className="domain-head">
                  <h3 style={{ color: DOMAINS[d].color }}>{DOMAINS[d].name}</h3>
                  <small className="muted">{DOMAINS[d].note}</small>
                  <div
                    className="tension"
                    title={`Tension builds as you go deep down a path and when neighbours with opposed ideas press on you. At ${UPHEAVAL_AT} you may call a ${DOMAINS[d].upheaval.toLowerCase()}; at ${FORCED_AT} it comes on its own.`}
                  >
                    <span
                      style={{
                        width: `${Math.min(100, (t / FORCED_AT) * 100)}%`,
                        background: t >= UPHEAVAL_AT ? 'var(--bad)' : DOMAINS[d].color,
                      }}
                    />
                    <i style={{ left: `${(UPHEAVAL_AT / FORCED_AT) * 100}%` }} />
                  </div>
                  <small>Tension {Math.round(t)}</small>
                  <button
                    className="small-btn"
                    disabled={!!why}
                    title={why ?? ''}
                    onClick={() => onUpheaval(d)}
                  >
                    {DOMAINS[d].upheaval}
                  </button>
                </div>
                {[1, 2, 3, 4].map(tier => {
                  const nodes = CULTURE_LIST.filter(n => n.domain === d && n.tier === tier);
                  // group fork members together under a "choose one" bracket
                  const forks = [...new Set(nodes.filter(n => n.fork).map(n => n.fork!))];
                  return (
                    <div key={tier} className="tier">
                      {forks.map(f => (
                        <div key={f} className="fork">
                          <span className="fork-label">choose one</span>
                          {nodes.filter(n => n.fork === f).map(nodeCard)}
                        </div>
                      ))}
                      {nodes.filter(n => !n.fork).map(nodeCard)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** After an upheaval: pick up to two choices in the domain to keep; the rest become legacy. */
export function KeepDialog({ civ, onKeep }: { civ: Civ; onKeep: (ids: string[]) => void }) {
  const d = civ.culture.choosing!;
  const opts = keepable(civ, d);
  const [pick, setPick] = useState<string[]>([]);
  return (
    <div className="modal-back">
      <div className="modal confirm keep" onClick={e => e.stopPropagation()}>
        <h2>The {DOMAINS[d].upheaval.toLowerCase()} is over</h2>
        <p className="muted">
          Keep up to {KEEP_AFTER_UPHEAVAL} of your {DOMAINS[d].name.toLowerCase()} choices. The
          others become legacy: half their effect, no tags. Forks they closed open again, so you can
          take a new path.
        </p>
        <div className="keep-list">
          {opts.map(id => (
            <label key={id} className={`keep-row ${pick.includes(id) ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={pick.includes(id)}
                disabled={!pick.includes(id) && pick.length >= KEEP_AFTER_UPHEAVAL}
                onChange={e =>
                  setPick(e.target.checked ? [...pick, id] : pick.filter(x => x !== id))
                }
              />
              <b>{CULTURE[id].name}</b>{' '}
              <small className="muted">{describeMods(CULTURE[id].mods)}</small>
            </label>
          ))}
          {!opts.length && <p className="muted">Nothing to keep.</p>}
        </div>
        <button className="primary wide" onClick={() => onKeep(pick)}>
          Keep {pick.length ? pick.map(id => CULTURE[id].name).join(' and ') : 'nothing'}
        </button>
      </div>
    </div>
  );
}
