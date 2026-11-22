import type { BattleReport } from '../engine/combat.ts';
import { Art } from './bits.tsx';

const OUTCOME: Record<BattleReport['outcome'], string> = {
  'defender-broke': 'Victory',
  'attacker-broke': 'Repulsed',
  held: 'Indecisive',
  skirmish: 'Skirmish',
};

export function BattleDialog({ report, onClose }: { report: BattleReport; onClose: () => void }) {
  const side = (s: BattleReport['attacker']) => (
    <div className="battle-side">
      <b>{s.name}</b>
      <div>
        {s.start.toLocaleString()} fought ·{' '}
        <span className="bad">{s.lost.toLocaleString()} lost</span>
        {s.broke ? ' · broke' : ''}
      </div>
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
          {side(report.attacker)}
          <span className="vs">vs</span>
          {side(report.defender)}
        </div>
        <ol className="battle-lines">
          {report.lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
        <button className="primary wide" onClick={onClose}>
          Continue
        </button>
      </div>
    </div>
  );
}
