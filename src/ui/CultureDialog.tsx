import { useState } from 'react';
import { CULTURE, DOMAIN_LIST, DOMAINS, TAG_TIERS, TAGS, type Domain } from '../data/culture.ts';
import { describeMods } from '../data/mods.ts';
import { ERAS } from '../data/techs.ts';
import { MAJOR_AT, MAJORS } from '../data/tomes.ts';
import {
  majorCost,
  missionCost,
  missionLabel,
  missionProgress,
  offerFor,
  pickProblem,
} from '../engine/culture.ts';
import { identity, majorDomains } from '../engine/mods.ts';
import { MANDATES, survey } from '../engine/tomes.ts';
import type { Civ, GameState, TomeMission } from '../engine/types.ts';
import { Art, Ico, InfoButton } from './bits.tsx';
import { EffChips, modEffs } from './NationDialog.tsx';
import './r4-culture.css';

interface Props {
  game: GameState;
  civ: Civ;
  perTurn: number;
  onPick: (d: Domain) => void;
  onBuy: (node: string) => void;
  onMajor: () => void;
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

/** A major buff's chips, and its extra rule if it has one. */
function MajorEffs({ d }: { d: Domain }) {
  const mj = MAJORS[d];
  return (
    <>
      <EffChips effs={modEffs(mj.mods)} />
      {mj.extra && <small className="tome-extra">{mj.extra}</small>}
    </>
  );
}

/** Culture: the Tome of this age, its missions and major buff, and the Tomes closed before. */
export function CultureDialog({ game, civ, perTurn, onPick, onBuy, onMajor, onClose }: Props) {
  const [confirm, setConfirm] = useState<Domain | null>(null);
  const c = civ.culture;
  const t = c.tome;
  const ident = identity(civ);
  const won = majorDomains(civ);
  const x = survey(game, civ);

  const missionCard = (m: TomeMission, age: number) => {
    const node = CULTURE[m.node];
    const md = MANDATES[m.task];
    const taken = !!t?.taken.includes(m.node);
    const done = !!t?.done.includes(m.node);
    const p = missionProgress(game, civ, m, age, x);
    const cost = missionCost(game, civ, age);
    const state = done ? 'done' : taken ? 'active' : 'open';
    return (
      <div key={m.node} className={`mission-card ${state}`} title={node.note}>
        <div className="mission-head">
          <Art k={`culture/${node.id}`} size={40} />
          <span>
            <b>{node.name}</b>
            <span className="mission-task">
              <Ico name={md?.icon ?? 'culture'} fallback="•" size={16} /> {missionLabel(m, age)}
            </span>
          </span>
        </div>
        <div className="mission-bar" title={`${p.have} / ${p.need}`}>
          <span style={{ width: `${(p.have / p.need) * 100}%` }} />
          <small>
            {p.have}/{p.need}
          </small>
        </div>
        <EffChips effs={modEffs(node.mods)} />
        {node.tags.length > 0 && (
          <span className="tags">
            {node.tags.map(tg => (
              <TagChip key={tg} tag={tg} />
            ))}
          </span>
        )}
        {done ? (
          <span className="mission-state done">
            <Ico name="check" fallback="✓" size={16} /> Done
          </span>
        ) : taken ? (
          <span className="mission-state active">
            <Ico name="end-turn" fallback="⧗" size={16} /> Active
          </span>
        ) : (
          <button
            className="buy"
            disabled={c.points < cost}
            title={`${cost} culture`}
            onClick={() => onBuy(m.node)}
          >
            <Ico name="culture" fallback="♪" size={16} /> {cost}
          </button>
        )}
      </div>
    );
  };

  const picker = () => {
    const age = c.pickDue!;
    return (
      <>
        <h3 className="tome-due">
          <Ico name="culture" fallback="♪" size={20} /> Choose a Tome · {ERAS[age]} age
        </h3>
        <div className="tome-picker">
          {DOMAIN_LIST.map(d => {
            const why = pickProblem(civ, d);
            const sample = why ? [] : offerFor(game, civ, d, age).slice(0, 3);
            return (
              <button
                key={d}
                className="tome-pick-card"
                data-domain={d}
                disabled={!!why}
                title={why ?? DOMAINS[d].note}
                style={{ borderTopColor: DOMAINS[d].color }}
                onClick={() => setConfirm(d)}
              >
                <span className="tome-pick-head">
                  <Art k={`domain/${d}`} size={44} />
                  <b style={{ color: DOMAINS[d].color }}>{DOMAINS[d].name}</b>
                </span>
                <span className="tome-major-mini">
                  <Ico name="crown" fallback="♛" size={16} /> {MAJORS[d].name}
                </span>
                <MajorEffs d={d} />
                {why ? (
                  <small className="muted">{why}</small>
                ) : (
                  <ul className="tome-sample">
                    {sample.map(m => (
                      <li key={m.node}>
                        <Art k={`culture/${m.node}`} size={20} /> {missionLabel(m, age)}
                      </li>
                    ))}
                  </ul>
                )}
              </button>
            );
          })}
        </div>
      </>
    );
  };

  const tomeView = () => {
    if (!t) return null;
    const d = t.domain;
    const mCost = majorCost(game, civ, t.age);
    return (
      <>
        <div className="tome-card" data-domain={d} style={{ borderLeftColor: DOMAINS[d].color }}>
          <Art k={`domain/${d}`} size={64} />
          <div>
            <h3 style={{ color: DOMAINS[d].color }}>Tome of {DOMAINS[d].name}</h3>
            <span className="chips">
              <span className="chip" title="Age">
                <Ico name="research" fallback="⌛" size={16} /> <b>{ERAS[t.age]}</b>
              </span>
              <span className="chip" title={`Missions done (${MAJOR_AT} open the major buff)`}>
                <Ico name="check" fallback="✓" size={16} />{' '}
                <b>
                  {t.done.length}/{t.offered.length}
                </b>
              </span>
            </span>
          </div>
        </div>
        <div className="mission-grid">{t.offered.map(m => missionCard(m, t.age))}</div>
        <div className={`major-card ${t.major}`} style={{ borderColor: DOMAINS[d].color }}>
          <Ico name="crown" fallback="♛" size={28} />
          <div>
            <b>{MAJORS[d].name}</b>
            <small className="muted"> {MAJORS[d].note}</small>
            <div>
              <MajorEffs d={d} />
            </div>
          </div>
          {t.major === 'bought' ? (
            <span className="mission-state done">
              <Ico name="check" fallback="✓" size={16} /> Won
            </span>
          ) : t.major === 'open' ? (
            <button
              className="buy primary"
              disabled={c.points < mCost}
              title={`${mCost} culture`}
              onClick={onMajor}
            >
              <Ico name="culture" fallback="♪" size={16} /> {mCost}
            </button>
          ) : (
            <span className="mission-state locked" title={`Complete ${MAJOR_AT} missions`}>
              <Ico name="lock" fallback="🔒" size={16} /> {t.done.length}/{MAJOR_AT}
            </span>
          )}
        </div>
      </>
    );
  };

  const history = c.history ?? [];
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal culture r4-culture" onClick={e => e.stopPropagation()}>
        <header>
          <h2>
            Culture{' '}
            <small className="chips nd-head-chips">
              <span className="chip" title="Culture (a turn)">
                <Ico name="culture" fallback="♪" size={18} /> <b>{Math.floor(c.points)}</b>{' '}
                <span className="delta good">+{perTurn}</span>
              </span>
              <span className="chip" title="Buffs kept">
                <Ico name="check" fallback="✓" size={16} /> <b>{c.taken.length}</b>
              </span>
              <span className="chip" title="Major buffs won">
                <Ico name="crown" fallback="♛" size={16} /> <b>{won.length}</b>
              </span>
              <InfoButton label="About Tomes">
                <span>
                  One Tome an age. A mission costs culture; done, its buff stays for good.{' '}
                  {MAJOR_AT} done open the major buff: buy it and it is yours forever.
                </span>
                <span>
                  When any people enters a new age, every open Tome closes: an unbought major buff
                  is lost. The same Tome cannot be opened twice in a row.
                </span>
              </InfoButton>
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
                {TAG_TIERS.map((n, k) => (
                  <i key={n} className={k < i.tier ? 'on' : ''} />
                ))}
              </span>
            </span>
          ))}
        </div>

        {c.pickDue && !t ? picker() : tomeView()}

        {history.length > 0 && (
          <div className="tome-history">
            <h4 className="muted">Closed Tomes</h4>
            {[...history].reverse().map(h => (
              <div key={`${h.domain}-${h.age}-${h.turn}`} className="tome-closed">
                <Art k={`domain/${h.domain}`} size={28} />
                <b style={{ color: DOMAINS[h.domain].color }}>{DOMAINS[h.domain].name}</b>
                <small className="muted">{ERAS[h.age]}</small>
                <span className="tome-kept">
                  {h.done.map(id => (
                    <span
                      key={id}
                      title={`${CULTURE[id]?.name}: ${describeMods(CULTURE[id]?.mods ?? {})}`}
                    >
                      <Art k={`culture/${id}`} size={22} fallback={CULTURE[id]?.name} />
                    </span>
                  ))}
                </span>
                <span className={`tome-major-state ${h.major}`} title={MAJORS[h.domain].name}>
                  <Ico name="crown" fallback="♛" size={14} />{' '}
                  {h.major === 'won' ? 'major won' : 'major lost'}
                </span>
              </div>
            ))}
          </div>
        )}

        {confirm && (
          <div className="modal-back tome-confirm-back" onClick={() => setConfirm(null)}>
            <div className="modal confirm tome-confirm" onClick={e => e.stopPropagation()}>
              <h2>
                <Art k={`domain/${confirm}`} size={36} /> Tome of {DOMAINS[confirm].name}
              </h2>
              <p className="muted small">
                {ERAS[c.pickDue ?? 1]} age · <Ico name="crown" fallback="♛" size={14} />{' '}
                {MAJORS[confirm].name}
              </p>
              <MajorEffs d={confirm} />
              <div className="row">
                <button onClick={() => setConfirm(null)}>Cancel</button>
                <button
                  className="primary"
                  onClick={() => {
                    onPick(confirm);
                    setConfirm(null);
                  }}
                >
                  Open
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
