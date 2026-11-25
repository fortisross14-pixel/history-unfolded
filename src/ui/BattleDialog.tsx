import type { BattleReport } from '../engine/combat.ts';
import type { BattleRecord } from '../engine/types.ts';
import { Art, Chip, InfoButton } from './bits.tsx';
import './declutter-map.css';
import './r4-health.css';
import './r4-interact.css';

const OUTCOME: Record<BattleReport['outcome'], string> = {
  'defender-broke': 'Victory',
  'attacker-broke': 'Repulsed',
  held: 'Indecisive',
  skirmish: 'Skirmish',
};

/** The engine's "what decided it" reasons as one- or two-word tags (full text on hover). */
const PLACE: Record<string, string> = {
  'behind walls': 'Walls',
  'in the town': 'Town',
  'on high ground': 'High ground',
  'in the woods': 'Woods',
  'dug in': 'Dug in',
};
function whyTag(text: string): string {
  const num = /^Numbers: ([\d.]+) to 1$/.exec(text);
  if (num) return `Numbers ${num[1]}:1`;
  const fixed: Record<string, string> = {
    'Better weapons and training': 'Weapons',
    'Heavier armour': 'Armour',
    'Good ground': 'Ground',
    'Their archers had no front line to screen them': 'Unscreened archers',
    'Archers attacking without a front line': 'Unscreened archers',
    'Cavalry on open ground': 'Open-ground cavalry',
    'No room for the charge': 'No charge room',
    'Higher morale': 'Morale',
  };
  if (fixed[text]) return fixed[text];
  const parts = text.toLowerCase().split(' and ');
  if (parts.every(x => PLACE[x])) return parts.map(x => PLACE[x]).join(' · ');
  return text;
}

/** Defending, the outcome reads the other way round. */
const OUTCOME_DEF: Record<BattleReport['outcome'], string> = {
  'defender-broke': 'Defeat',
  'attacker-broke': 'Held the line',
  held: 'Indecisive',
  skirmish: 'Skirmish',
};

export function BattleDialog({
  report,
  record,
  onGo,
  onClose,
}: {
  report: BattleReport;
  /** from the Battles list: turn, place, and which side the player was on */
  record?: BattleRecord;
  /** show the place on the map */
  onGo?: () => void;
  onClose: () => void;
}) {
  const defending = record?.side === 'defender';
  const title = record
    ? record.winner === null
      ? (defending ? OUTCOME_DEF : OUTCOME)[report.outcome]
      : record.winner === record.side
        ? 'Victory'
        : 'Defeat'
    : OUTCOME[report.outcome];
  // the window greets a win with a light sweeping its ribbon; a loss gets a muted ribbon
  const mood = ['Victory', 'Held the line'].includes(title)
    ? 'won'
    : ['Defeat', 'Repulsed'].includes(title)
      ? 'lost'
      : 'even';
  const side = (s: BattleReport['attacker'], ours: boolean) => (
    <div className="battle-side">
      <b>{s.name}</b>
      <span className="chips">
        <Chip icon="people" n={s.start.toLocaleString()} title="Fought" />
        <span className="chip" title="Lost">
          <b className={`delta ${ours ? 'bad' : 'good'}`}>−{s.lost.toLocaleString()}</b>
        </span>
        {s.broke && <span className="fp-tag bad">Broke</span>}
      </span>
      <div className="bar">
        <span style={{ width: `${Math.min(100, (s.lost / Math.max(1, s.start)) * 100)}%` }} />
      </div>
    </div>
  );
  return (
    <div className="modal-back" onClick={onClose}>
      <div className={`modal battle battle-${mood}`} onClick={e => e.stopPropagation()}>
        <header>
          <h2 className="battle-ribbon">
            <span>{title}</span>
          </h2>
          <button className="x" onClick={onClose}>
            ×
          </button>
        </header>
        <Art k={`battle/${report.scene ?? 'field'}`} className="battle-art" />
        {record && (
          <div className="battle-meta small muted">
            <span>Turn {record.turn}</span>
            <span>{record.place.replace(/^./, c => c.toUpperCase())}</span>
            {record.att.house && <span>Attackers led by House {record.att.house.name}</span>}
            {record.def.house && <span>Defenders led by House {record.def.house.name}</span>}
            {onGo && (
              <button className="link" onClick={onGo}>
                Show on map ›
              </button>
            )}
          </div>
        )}
        <div className="battle-sides">
          {side(report.attacker, !defending)}
          <span className="vs">vs</span>
          {side(report.defender, defending)}
        </div>
        {report.why && report.why.length > 0 && (
          <div className="battle-why-tags" aria-label="What decided it">
            {report.why.map((w, i) => (
              <span
                key={i}
                className={`fp-tag ${(w.side === 'attacker') !== defending ? 'good' : 'bad'}`}
                title={`${w.text} (for ${(w.side === 'attacker') !== defending ? 'you' : 'them'})`}
              >
                {(w.side === 'attacker') !== defending ? '▲' : '▼'} {whyTag(w.text)}
              </span>
            ))}
          </div>
        )}
        {report.lines.length > 0 && (
          <div className="battle-detail">
            <InfoButton label="Round by round">
              <ol className="battle-lines">
                {report.lines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ol>
            </InfoButton>
            <small className="muted">Rounds</small>
          </div>
        )}
        <button className="primary wide" onClick={onClose}>
          Continue
        </button>
      </div>
    </div>
  );
}
