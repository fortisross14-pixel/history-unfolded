import type { BattleReport } from '../engine/combat.ts';
import { Art, Chip, InfoButton } from './bits.tsx';
import './declutter-map.css';

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

export function BattleDialog({ report, onClose }: { report: BattleReport; onClose: () => void }) {
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
      <div className="modal battle" onClick={e => e.stopPropagation()}>
        <header>
          <h2>{OUTCOME[report.outcome]}</h2>
          <button className="x" onClick={onClose}>
            ×
          </button>
        </header>
        <Art k={`battle/${report.scene ?? 'field'}`} className="battle-art" />
        <div className="battle-sides">
          {side(report.attacker, true)}
          <span className="vs">vs</span>
          {side(report.defender, false)}
        </div>
        {report.why && report.why.length > 0 && (
          <div className="battle-why-tags" aria-label="What decided it">
            {report.why.map((w, i) => (
              <span
                key={i}
                className={`fp-tag ${w.side === 'attacker' ? 'good' : 'bad'}`}
                title={`${w.text} (for ${w.side === 'attacker' ? 'you' : 'them'})`}
              >
                {w.side === 'attacker' ? '▲' : '▼'} {whyTag(w.text)}
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
