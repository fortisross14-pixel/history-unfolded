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
import { Art, Ico, InfoButton } from './bits.tsx';
import { EffChips, modEffs } from './NationDialog.tsx';

interface Props {
  game: GameState;
  civ: Civ;
  perTurn: number;
  onTake: (id: string) => void;
  onUpheaval: (d: Domain) => void;
  onClose: () => void;
}

export function TagChip({ tag }: { tag: string }) {
  return (
    <span className={`tag tag-${tag}`}>
      <Art k={`tag/${tag}`} size={14} className="tag-art" />
      {TAGS[tag]?.name ?? tag}
    </span>
  );
}

/** The culture web: nine domains, four tiers, forks that close doors, tension and upheavals. */
export function CultureDialog({ game, civ, perTurn, onTake, onUpheaval, onClose }: Props) {
  const [focus, setFocus] = useState<Domain | 'all'>('all');
  // by default only what can be taken now (and what is held); locked paths on request
  const [showAll, setShowAll] = useState(false);
  const visible = (n: CultureNode) => {
    const k = nodeStatus(civ, n).kind;
    return showAll || k === 'taken' || k === 'available' || k === 'legacy' || k === 'upheaval';
  };
  const hidden = CULTURE_LIST.filter(n => !visible(n)).length;
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
            ? `Legacy ½ · ${cost}`
            : 'Legacy ½'
          : st.kind === 'locked'
            ? `Closed by ${CULTURE[st.by].name}`
            : st.kind === 'upheaval'
              ? 'In upheaval'
              : st.kind === 'needs'
                ? `Needs ${st.missing
                    .map(m =>
                      m
                        .split('|')
                        .map(x => CULTURE[x]?.name ?? x)
                        .join(' or '),
                    )
                    .join(', ')}`
                : null;
    const crossReq = [...n.requires, ...n.requiresAny].filter(r => CULTURE[r]?.domain !== n.domain);
    return (
      <button
        key={n.id}
        className={`cnode ${st.kind} ${can ? 'can' : ''}`}
        disabled={!can}
        onClick={() => onTake(n.id)}
        title={n.note}
      >
        <span className="cnode-head">
          <Art k={`culture/${n.id}`} size={28} />
          <b>{n.name}</b>
        </span>
        <span className="tags">
          {n.tags.map(t => (
            <TagChip key={t} tag={t} />
          ))}
        </span>
        <EffChips effs={modEffs(n.mods, st.kind === 'legacy' ? 0.5 : 1)} />
        {crossReq.length > 0 && (
          <small
            className="muted"
            title={crossReq
              .map(r => `${CULTURE[r].name} (${DOMAINS[CULTURE[r].domain].name})`)
              .join(', ')}
          >
            ↔ {crossReq.map(r => CULTURE[r].name).join(', ')}
          </small>
        )}
        {reason ? (
          <small className={`cstate ${st.kind}`}>{reason}</small>
        ) : (
          <small className={`cstate ${st.kind}`} title={`${cost} culture`}>
            <Ico name="culture" fallback="♪" size={14} /> {cost}
          </small>
        )}
      </button>
    );
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal culture" onClick={e => e.stopPropagation()}>
        <header>
          <h2>
            Culture{' '}
            <small className="chips nd-head-chips">
              <span className="chip" title="Culture (a turn)">
                <Ico name="culture" fallback="♪" size={18} /> <b>{Math.floor(c.points)}</b>{' '}
                <span className="delta good">+{perTurn}</span>
              </span>
              <span className="chip" title="Adopted">
                <Ico name="check" fallback="✓" size={16} /> <b>{c.taken.length}</b>
              </span>
              {c.legacy.length ? (
                <span className="chip" title="Legacy (half effect)">
                  ½ <b>{c.legacy.length}</b>
                </span>
              ) : null}
            </small>
          </h2>
          <button className="x" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="identity">
          <span className="muted small">Identity</span>
          {ident.length === 0 && <span className="muted small">—</span>}
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
          {ident.some(i => i.tier > 0) && (
            <InfoButton label="Identity bonuses">
              {ident
                .filter(i => i.tier > 0)
                .map(i => (
                  <span key={i.tag}>
                    <b>{TAGS[i.tag].name}:</b>{' '}
                    {TAGS[i.tag].tiers.slice(0, i.tier).map(describeMods).join(', ')}
                  </span>
                ))}
            </InfoButton>
          )}
        </div>
        {c.upheaval && (
          <p className="upheaval-banner">
            {DOMAINS[c.upheaval.domain].upheaval}: {c.upheaval.turnsLeft} turns left{' '}
            <InfoButton label="About upheavals">
              Yields and morale suffer until it ends; then the old{' '}
              {DOMAINS[c.upheaval.domain].name.toLowerCase()} gives way and closed paths reopen.
            </InfoButton>
          </p>
        )}

        <div className="row filter-row">
          <button className={showAll ? 'on' : ''} onClick={() => setShowAll(v => !v)}>
            {showAll ? 'Hide locked' : `Locked (${hidden})`}
          </button>
        </div>
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
                  <Art k={`domain/${d}`} size={40} />
                  <h3 style={{ color: DOMAINS[d].color }} title={DOMAINS[d].note}>
                    {DOMAINS[d].name}
                  </h3>
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
                  <small title="Tension">
                    <Ico name="warning" fallback="!" size={14} /> {Math.round(t)}
                  </small>
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
                  const nodes = CULTURE_LIST.filter(
                    n => n.domain === d && n.tier === tier && visible(n),
                  );
                  if (!nodes.length) return null;
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
        <p className="muted small">
          Keep up to {KEEP_AFTER_UPHEAVAL}. The rest: ½ effect, no tags; their forks reopen.
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
              <b>{CULTURE[id].name}</b> <EffChips effs={modEffs(CULTURE[id].mods)} />
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
