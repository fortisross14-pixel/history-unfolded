import type { ReactNode } from 'react';
import { GOODS } from '../data/goods.ts';
import { pendingRealmEvent, resolveRealmEvent } from '../engine/realmEvents.ts';
import type { Civ, GameState } from '../engine/types.ts';
import { Delta, GoodIcon, Ico } from './bits.tsx';
import './declutter-world.css';
import './r4-missionev.css';

const KIND_ICON: Record<string, string> = {
  land: '🌾',
  people: '🏘',
  court: '👑',
  trade: '⚖',
  war: '⚔',
  faith: '✨',
  knowledge: '📜',
};

/** What a number in an effect line is about: its icon, and whether more of it is bad. */
const RES: Record<string, { icon: string; fb: string; name: string; down?: boolean }> = {
  gold: { icon: 'coin', fb: '🪙', name: 'Gold' },
  culture: { icon: 'lyre', fb: '♪', name: 'Culture' },
  science: { icon: 'flask', fb: '⚗', name: 'Science' },
  food: { icon: 'wheat', fb: '🌾', name: 'Food' },
  people: { icon: 'people', fb: '👥', name: 'People' },
  unrest: { icon: 'bell', fb: '!', name: 'Unrest', down: true },
  experience: { icon: 'helm', fb: '★', name: 'Experience' },
  'religious tension': { icon: 'drop', fb: '✝', name: 'Religious tension', down: true },
};
const GOOD_BY_NAME = Object.fromEntries(
  Object.entries(GOODS).map(([id, g]) => [g.name.toLowerCase(), id]),
);
const KEYS = [...Object.keys(RES), ...Object.keys(GOOD_BY_NAME)].sort(
  (a, b) => b.length - a.length,
);
const SIGNED = /^(.*?)\s*([+−-])\s?([\d,]+)(%?)\s*(.*)$/;

/** First sentence only: flavour text stays short. */
export const firstSentence = (t: string) => t.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? t;

/**
 * An effect line from the engine ("+15 gold; the Veskari think less of you") as icon chips with
 * signed, coloured numbers; what cannot be a chip stays as a few words. The full line is the
 * tooltip.
 */
export function EffectChips({ text }: { text: string }) {
  const clauses = text
    .replace(/\.$/, '')
    .split(/;\s*|,\s+(?=House )/)
    .map(x => x.trim())
    .filter(Boolean);
  const chips: ReactNode[] = [];
  const words: string[] = [];
  let lastKey = '';
  clauses.forEach((cl, i) => {
    if (cl === 'nothing') {
      words.push('nothing');
      return;
    }
    const op = cl.match(/^the (.+?) (think|take) (.+?)( of you)?$/i);
    if (op) {
      const t = op[3];
      const bad = /less|offence/.test(t);
      const much = /much/.test(t);
      chips.push(
        <span key={i} className="w-eff" title={cl}>
          {op[1]}{' '}
          <span className={`delta ${bad ? 'bad' : 'good'}`}>
            {bad ? '−' : much ? '++' : '+'}opinion
          </span>
        </span>,
      );
      return;
    }
    const m = cl.match(SIGNED);
    if (m && !/^about\b/i.test(cl)) {
      const [, prefix, sign, digits, pct, rest] = m;
      const lower = rest.toLowerCase();
      const key = KEYS.find(k => lower.startsWith(k)) ?? (rest === '' ? lastKey : '');
      if (key && prefix.split(' ').length <= 4) {
        lastKey = key;
        const n = Number(digits.replace(/,/g, '')) * (sign === '+' ? 1 : -1);
        const r = RES[key];
        const good = GOOD_BY_NAME[key];
        const who = prefix.replace(/:$/, '');
        chips.push(
          <span key={i} className="chip w-eff" title={cl}>
            {who && <small>{who}</small>}
            {good ? (
              <GoodIcon id={good} size={18} />
            ) : (
              <Ico name={r.icon} fallback={r.fb} size={18} />
            )}
            <Delta n={n} good={r?.down ? 'down' : 'up'} unit={pct || undefined} />
          </span>,
        );
        return;
      }
    }
    words.push(cl);
  });
  return (
    <span className="chips w-effects" title={text}>
      {chips}
      {words.length > 0 && <small className="w-words">{words.join(' · ')}</small>}
    </span>
  );
}

/** A story that asks for a choice: each choice a short label and its effects as chips. */
export function RealmEventDialog({
  game,
  civ,
  report,
  onClose,
}: {
  game: GameState;
  civ: Civ;
  report: (r: { ok: boolean; msg?: string }) => void;
  onClose: () => void;
}) {
  const ev = pendingRealmEvent(game, civ);
  if (!ev) return null;
  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal event"
        role="dialog"
        aria-modal="true"
        aria-label={ev.title}
        onClick={e => e.stopPropagation()}
      >
        <header>
          <h2>
            <span className="event-icon">{KIND_ICON[ev.kind] ?? '❖'}</span> {ev.title}
            {ev.story && (
              <small title={`${ev.story.name}, chapter ${ev.story.chapter} of ${ev.story.of}`}>
                {' '}
                {ev.story.chapter}/{ev.story.of}
              </small>
            )}
          </h2>
          <button className="x" onClick={onClose} aria-label="Later" title="Decide later">
            ×
          </button>
        </header>
        <p className="event-text" title={ev.text}>
          {firstSentence(ev.text)}
        </p>
        <div className="event-choices">
          {ev.choices.map((ch, i) => (
            <button
              key={i}
              className={`event-choice${ch.mission ? ' mev-choice' : ''}`}
              disabled={!!ch.blocked}
              title={ch.blocked ?? ch.effect}
              onClick={() => {
                report(resolveRealmEvent(game, civ, i));
                onClose();
              }}
            >
              <b>{ch.label}</b>
              {ch.mission && (
                <span className="mev-tag" title={`Culture mission: ${ch.mission}`}>
                  <Ico name="culture" fallback="♪" size={14} /> Mission · {ch.mission}
                </span>
              )}
              {ch.blocked ? <small>{ch.blocked}</small> : <EffectChips text={ch.effect} />}
            </button>
          ))}
        </div>
        <p className="muted small">At turn end: first choice.</p>
      </div>
    </div>
  );
}
