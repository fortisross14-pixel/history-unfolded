import { TECH_LIST } from '../data/techs.ts';
import { availableTechs } from '../engine/game.ts';
import type { Civ } from '../engine/types.ts';

export function ResearchDialog({
  civ,
  onPick,
  onClose,
}: {
  civ: Civ;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const avail = new Set(availableTechs(civ).map(t => t.id));
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal research" onClick={e => e.stopPropagation()}>
        <header>
          <h2>
            Research <small>{civ.science} science stored</small>
          </h2>
          <button className="x" onClick={onClose}>
            ×
          </button>
        </header>
        <p className="muted">
          Research unlocks parts, not finished units: you decide who carries them.
        </p>
        <div className="techs">
          {TECH_LIST.map(t => {
            const known = civ.techs.includes(t.id);
            const on = civ.researching === t.id;
            return (
              <button
                key={t.id}
                className={`tech ${known ? 'known' : ''} ${on ? 'on' : ''}`}
                disabled={!avail.has(t.id)}
                onClick={() => onPick(t.id)}
              >
                <b>{t.name}</b>
                <small>
                  {known ? 'Known' : `${t.cost} science`}
                  {t.requires.length ? ` · needs ${t.requires.join(', ')}` : ''}
                </small>
                <span>{t.note}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
