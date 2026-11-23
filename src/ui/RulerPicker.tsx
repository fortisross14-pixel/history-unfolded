import { useState } from 'react';
import { CIV_PRESETS } from '../data/civs.ts';
import {
  EMBLEMS,
  FACES,
  RULER_BY_ID,
  RULERS,
  TRAIT_LIST,
  TRAITS,
  type TraitId,
} from '../data/rulers.ts';
import { Badge } from './Badge.tsx';
import type { RulerSetup } from '../engine/types.ts';
import { Art, InfoButton } from './bits.tsx';
import { EffChips, modEffs } from './NationDialog.tsx';
import './declutter-ruler.css';

/** A ruler's two strengths as chips: the major one in full, the minor one lighter. */
export function TraitChips({ major, minor }: { major: TraitId; minor: TraitId }) {
  return (
    <span className="rp-traits">
      <span className="rp-trait major" title={`Major: ${TRAITS[major].name}`}>
        <b>{TRAITS[major].name}</b>
        <EffChips effs={modEffs(TRAITS[major].major)} />
      </span>
      <span className="rp-trait minor" title={`Minor: ${TRAITS[minor].name}`}>
        <small>{TRAITS[minor].name}</small>
        <EffChips effs={modEffs(TRAITS[minor].minor)} />
      </span>
    </span>
  );
}

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('');

/**
 * The second step of a new game: lead a historical ruler, or make one of your own: name, people,
 * face, a major and a minor strength, banner colour and the names your settlements take.
 */
export function RulerPicker({
  initial,
  rivals,
  onRivals,
  onBack,
  onBegin,
}: {
  initial: RulerSetup;
  rivals: 'historical' | 'fictional';
  onRivals: (r: 'historical' | 'fictional') => void;
  onBack: () => void;
  onBegin: (r: RulerSetup) => void;
}) {
  const [mode, setMode] = useState<'historical' | 'own'>(initial.id ? 'historical' : 'own');
  const [pick, setPick] = useState(initial.id ?? RULERS[0].id);
  const [name, setName] = useState(initial.id ? '' : initial.name);
  const [nation, setNation] = useState(initial.id ? '' : (initial.nation ?? ''));
  const [face, setFace] = useState(initial.id ? FACES[0] : initial.face);
  const [major, setMajor] = useState<TraitId>(initial.id ? 'scholar' : initial.major);
  const [minor, setMinor] = useState<TraitId>(initial.id ? 'merchant' : initial.minor);
  const [color, setColor] = useState(initial.color ?? CIV_PRESETS[0].color);
  const [names, setNames] = useState(initial.names ?? 'invented');
  const [emblem, setEmblem] = useState(
    initial.id ? 'emblem/custom-1' : (initial.emblem ?? 'emblem/custom-1'),
  );

  const setup = (): RulerSetup => {
    if (mode === 'historical') {
      const r = RULER_BY_ID[pick];
      return { id: r.id, name: r.name, face: r.face, major: r.major, minor: r.minor };
    }
    return {
      name: name.trim() || 'Your ruler',
      nation: nation.trim() || undefined,
      face,
      major,
      minor,
      color,
      names,
      emblem,
    };
  };

  return (
    <div className="ruler-picker">
      <div className="rp-head">
        <button className="link" onClick={onBack}>
          ← Map
        </button>
        <h2>Ruler</h2>
        <div className="setting-opts" role="tablist">
          <button
            className={mode === 'historical' ? 'on' : ''}
            onClick={() => setMode('historical')}
          >
            Historical
          </button>
          <button className={mode === 'own' ? 'on' : ''} onClick={() => setMode('own')}>
            Your own
          </button>
        </div>
      </div>

      {mode === 'historical' ? (
        <div className="rp-grid" role="radiogroup" aria-label="Historical rulers">
          {RULERS.map(r => (
            <button
              key={r.id}
              role="radio"
              aria-checked={pick === r.id}
              className={`rp-card ${pick === r.id ? 'on' : ''}`}
              onClick={() => setPick(r.id)}
            >
              <Art
                k={r.face}
                size={64}
                className="rp-face"
                fallback={<span className="rp-face blank">{initials(r.name)}</span>}
              />
              <span className="rp-who">
                <b>{r.name}</b>
                <small>
                  <Badge colour={r.color} emblem={`emblem/${r.id}`} name={r.nation} size={20} />{' '}
                  {r.nation}
                </small>
                <TraitChips major={r.major} minor={r.minor} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="rp-own">
          <div className="fields">
            <label className="field">
              <span>Name</span>
              <input
                value={name}
                maxLength={28}
                placeholder="Your ruler"
                onChange={e => setName(e.target.value)}
              />
            </label>
            <label className="field">
              <span>People</span>
              <input
                value={nation}
                maxLength={24}
                placeholder="Aurelians"
                onChange={e => setNation(e.target.value)}
              />
            </label>
          </div>
          <h3>Face</h3>
          <div className="rp-faces" role="radiogroup" aria-label="Face">
            {FACES.map((f, i) => (
              <button
                key={f}
                role="radio"
                aria-checked={face === f}
                aria-label={`Face ${i + 1}`}
                className={`rp-facebtn ${face === f ? 'on' : ''}`}
                onClick={() => setFace(f)}
              >
                <Art
                  k={f}
                  size={56}
                  className="rp-face"
                  fallback={<span className="rp-face blank">{i + 1}</span>}
                />
              </button>
            ))}
          </div>
          <h3>
            Strengths{' '}
            <InfoButton label="About strengths">
              <span>The major strength works in full; the minor one in a lighter form.</span>
              <span>They may be in the same area or in different ones.</span>
            </InfoButton>
          </h3>
          <div className="rp-pick2">
            {(['major', 'minor'] as const).map(slot => (
              <div key={slot} className="rp-traitpick" role="radiogroup" aria-label={slot}>
                <small className="muted">{slot === 'major' ? 'Major' : 'Minor'}</small>
                {TRAIT_LIST.map(t => {
                  const on = (slot === 'major' ? major : minor) === t.id;
                  return (
                    <button
                      key={t.id}
                      role="radio"
                      aria-checked={on}
                      className={`rp-traitbtn ${on ? 'on' : ''}`}
                      onClick={() => (slot === 'major' ? setMajor(t.id) : setMinor(t.id))}
                    >
                      <b>{t.name}</b>
                      <EffChips effs={modEffs(slot === 'major' ? t.major : t.minor)} />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <h3>Badge</h3>
          <div className="rp-emblems" role="radiogroup" aria-label="Badge">
            {EMBLEMS.map(e => (
              <button
                key={e}
                role="radio"
                aria-checked={emblem === e}
                aria-label={e.replace('emblem/', '')}
                className={`rp-emblembtn ${emblem === e ? 'on' : ''}`}
                onClick={() => setEmblem(e)}
              >
                <Badge colour={color} emblem={e} name={nation || 'A'} size={36} />
              </button>
            ))}
          </div>
          <h3>Banner</h3>
          <div className="rp-colors" role="radiogroup" aria-label="Banner colour">
            {CIV_PRESETS.map(p => (
              <button
                key={p.color}
                role="radio"
                aria-checked={color === p.color}
                aria-label={p.color}
                className={`rp-color ${color === p.color ? 'on' : ''}`}
                style={{ background: p.color }}
                onClick={() => setColor(p.color)}
              />
            ))}
          </div>
          <label className="field">
            <span>Settlement names</span>
            <select value={names} onChange={e => setNames(e.target.value)}>
              <option value="invented">Invented</option>
              {RULERS.map(r => (
                <option key={r.id} value={r.id}>
                  {r.nation} ({r.cities.slice(0, 2).join(', ')}…)
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="rp-foot">
        <label className="field">
          <span>Rivals</span>
          <select
            value={rivals}
            onChange={e => onRivals(e.target.value as 'historical' | 'fictional')}
          >
            <option value="historical">Historical rulers</option>
            <option value="fictional">Invented peoples</option>
          </select>
        </label>
        <button className="primary wide" onClick={() => onBegin(setup())}>
          Begin
        </button>
      </div>
    </div>
  );
}
