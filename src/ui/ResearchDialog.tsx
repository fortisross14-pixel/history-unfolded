import { useState } from 'react';
import { DEPOSITS } from '../data/goods.ts';
import { ITEM_LIST } from '../data/items.ts';
import { describeMods } from '../data/mods.ts';
import { SLOT_LIST } from '../data/slots.ts';
import { ageOf, ageTechs, ERAS, TECH_LIST, TECHS, type TechInfo } from '../data/techs.ts';
import { TAGS } from '../data/culture.ts';
import { availableTechs, goalStep, knownInAge, techCost } from '../engine/game.ts';
import { tagCounts } from '../engine/mods.ts';
import { Art, GoodIcon, Ico, InfoButton } from './bits.tsx';
import './declutter-world.css';
import type { Civ, GameState } from '../engine/types.ts';

interface Props {
  game: GameState;
  civ: Civ;
  onPick: (id: string) => void;
  onGoal: (id: string | null) => void;
  onClose: () => void;
}

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
  const works = Object.values(DEPOSITS)
    .filter(d => d.tech === t.id)
    .map(d => d.name);
  if (works.length) out.push(`⛏ works ${works.join(', ')}`);
  if (t.mods) out.push(`★ ${describeMods(t.mods)}`);
  return out;
}

/** What a tech gives, as pictures: gear, buildings, deposits; its other effects in one line. */
function UnlockIcons({ t }: { t: TechInfo }) {
  const items = ITEM_LIST.filter(i => i.tech === t.id);
  const slots = SLOT_LIST.filter(x => x.tech === t.id);
  const deps = Object.entries(DEPOSITS).filter(([, d]) => d.revealedBy === t.id || d.tech === t.id);
  return (
    <>
      {items.length + slots.length + deps.length > 0 && (
        <span className="w-unlocks">
          {items.map(i => (
            <span key={i.id} title={`Gear: ${i.name}`}>
              <Art k={`item/${i.id}`} size={20} fallback={<small>⚔ {i.name}</small>} />
            </span>
          ))}
          {slots.map(x => (
            <span key={x.id} title={`Building: ${x.name}`}>
              <Art k={`building/${x.id}`} size={20} fallback={<small>▦ {x.name}</small>} />
            </span>
          ))}
          {deps.map(([id, d]) => (
            <span
              key={id}
              className="w-dep"
              title={`${d.revealedBy === t.id ? 'Reveals' : 'Works'} ${d.name}`}
            >
              {d.revealedBy === t.id ? (
                <Ico name="eye" fallback="👁" size={12} />
              ) : (
                <Ico name="hammer" fallback="⛏" size={12} />
              )}
              <GoodIcon id={Object.keys(d.yields)[0]} size={18} />
            </span>
          ))}
        </span>
      )}
      {t.mods && <small>★ {describeMods(t.mods)}</small>}
    </>
  );
}

/**
 * Research, one age at a time. The current age's techs can be taken in any order (a few need
 * another of the same age first); its gate opens the next age once enough of them are known.
 * Ages not reached yet stay hidden.
 */
export function ResearchDialog({ game, civ, onPick, onGoal, onClose }: Props) {
  const age = ageOf(civ.techs);
  // earlier ages stay reachable for what was skipped
  const ages = Array.from({ length: age }, (_, i) => i + 1);
  const [shown, setShown] = useState(age);
  const avail = new Set(availableTechs(civ).map(t => t.id));
  const tags = tagCounts(civ);
  const next = civ.researchGoal ? goalStep(civ, civ.researchGoal) : null;
  const list = ageTechs(shown).sort((a, b) => {
    const rank = (t: TechInfo) => (civ.techs.includes(t.id) ? 2 : avail.has(t.id) ? 0 : 1);
    return rank(a) - rank(b) || a.cost - b.cost;
  });
  const gate = TECH_LIST.find(t => t.gate !== undefined && t.era === shown);
  const known = knownInAge(civ, shown);

  const card = (t: TechInfo) => {
    const isKnown = civ.techs.includes(t.id);
    const on = civ.researching === t.id;
    const can = avail.has(t.id);
    const fav = t.favoured && (tags[t.favoured] ?? 0) >= 2;
    const cost = techCost(game, civ, t.id);
    const missing = t.requires.filter(r => !civ.techs.includes(r));
    return (
      <button
        key={t.id}
        className={`tech-card ${isKnown ? 'known' : ''} ${on ? 'on' : ''} ${can ? 'can' : ''} ${next === t.id ? 'next' : ''} ${civ.researchGoal === t.id ? 'path' : ''}`}
        disabled={isKnown}
        onClick={() => (can ? onPick(t.id) : onGoal(t.id))}
        title={[t.note, ...techUnlocks(t)].filter(Boolean).join('\n')}
      >
        <span className="tech-head">
          <Art k={`tech/${t.id}`} size={30} className="tech-art" />
          <b>{t.name}</b>
          <small>
            {isKnown ? '✓' : on ? `${Math.floor(civ.science)}/${cost}` : cost}
            {fav && !isKnown ? (
              <span className="good" title={`${TAGS[t.favoured!].name} culture: −20% cost`}>
                {' '}
                −20%
              </span>
            ) : (
              ''
            )}
          </small>
        </span>
        <span className="tech-unlocks">
          <UnlockIcons t={t} />
          {!isKnown && missing.length > 0 && (
            <small className="needs">after {missing.map(r => TECHS[r].name).join(', ')}</small>
          )}
        </span>
      </button>
    );
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal research"
        role="dialog"
        aria-modal="true"
        aria-label="Research"
        onClick={e => e.stopPropagation()}
      >
        <header>
          <h2>
            Research{' '}
            <small className="chips w-inline">
              <span>{ERAS[age]}</span>
              <span className="chip" title="Science stored">
                <Ico name="flask" fallback="⚗" size={16} /> <b>{Math.floor(civ.science)}</b>
              </span>
              {civ.researching && <span title="Researching">→ {TECHS[civ.researching].name}</span>}
              {civ.researchGoal && (
                <span className="chip" title="Goal">
                  <Ico name="target" fallback="◎" size={16} /> {TECHS[civ.researchGoal].name}
                  <button
                    className="link"
                    onClick={() => onGoal(null)}
                    aria-label="Clear goal"
                    title="Clear goal"
                  >
                    ×
                  </button>
                </span>
              )}
              <InfoButton label="About research">
                <span>Research unlocks parts, not finished units.</span>
                <span>Any order within an age; the age&apos;s last step opens the next.</span>
                <span>A tech not yet open: set as goal.</span>
                <span>Techs your culture leans toward: −20% cost.</span>
              </InfoButton>
            </small>
          </h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {ages.length > 1 && (
          <div className="age-tabs" role="tablist">
            {ages.map(e => {
              const left = ageTechs(e).filter(t => !civ.techs.includes(t.id)).length;
              return (
                <button
                  key={e}
                  role="tab"
                  aria-selected={shown === e}
                  className={shown === e ? 'on' : ''}
                  onClick={() => setShown(e)}
                >
                  <Art k={`era/${ERAS[e].toLowerCase()}`} size={22} className="era-art" />
                  {ERAS[e]}
                  {left ? <small title={`${left} left`}> · {left}</small> : <small> ✓</small>}
                </button>
              );
            })}
          </div>
        )}
        <div className="age-grid">{list.map(card)}</div>
        {gate && (
          <div className={`age-gate ${civ.techs.includes(gate.id) ? 'done' : ''}`}>
            <div className="age-gate-text">
              <b>{gate.name}</b>
              {civ.techs.includes(gate.id) ? (
                <small>✓</small>
              ) : (
                <small className="chips">
                  <span title={`${ERAS[shown]} techs known, of ${gate.gate} needed`}>
                    {Math.min(known, gate.gate!)}/{gate.gate}
                  </span>
                  <span title="New techs it opens">+{ageTechs(shown + 1).length} techs</span>
                  <span className="chip" title="Science">
                    <Ico name="flask" fallback="⚗" size={14} />{' '}
                    <b>{techCost(game, civ, gate.id)}</b>
                  </span>
                </small>
              )}
              <span className="age-meter" aria-hidden>
                <span style={{ width: `${Math.min(100, (known / gate.gate!) * 100)}%` }} />
              </span>
            </div>
            {!civ.techs.includes(gate.id) && (
              <button
                className={avail.has(gate.id) ? 'primary' : ''}
                onClick={() => (avail.has(gate.id) ? onPick(gate.id) : onGoal(gate.id))}
              >
                {civ.researching === gate.id
                  ? `${Math.floor(civ.science)}/${techCost(game, civ, gate.id)}`
                  : avail.has(gate.id)
                    ? 'Research'
                    : civ.researchGoal === gate.id
                      ? 'Goal set'
                      : 'Aim for it'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
