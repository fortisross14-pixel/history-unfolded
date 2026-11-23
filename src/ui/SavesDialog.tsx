import { useState } from 'react';
import type { GameState } from '../engine/types.ts';
import { downloadText } from './download.ts';
import { InfoButton } from './bits.tsx';
import { exportSave, loadSave, saveGame, savesOf } from './save.ts';

/** Save now, under a name, or to a file; load an earlier save of this game. */
export function SavesDialog({
  game,
  onLoad,
  onClose,
  report,
}: {
  game: GameState;
  onLoad: (s: GameState) => void;
  onClose: () => void;
  report: (ok: boolean, msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [, setV] = useState(0);
  const saves = savesOf(game);
  const when = (t: number) => new Date(t).toLocaleString();
  return (
    <div className="modal-back" onClick={onClose}>
      <div
        className="modal saves-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Saves"
        onClick={e => e.stopPropagation()}
      >
        <header>
          <h2>
            Saves <small>turn {game.turn}</small>
          </h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="row">
          <button
            className="primary"
            onClick={() => {
              const r = saveGame(game, true);
              report(r.ok, r.ok ? 'Saved.' : `Could not save: ${r.reason}.`);
              setV(v => v + 1);
            }}
          >
            Save now
          </button>
          <button
            onClick={() => {
              const f = exportSave(game);
              downloadText(f.filename, f.text);
              report(true, `Saved to the file ${f.filename}.`);
            }}
            title="A file to keep, or to load in another browser from the menu"
          >
            Export file
          </button>
        </div>
        <div className="row">
          <input
            placeholder="Name"
            value={name}
            maxLength={40}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            aria-label="Save name"
          />
          <button
            disabled={!name.trim()}
            onClick={() => {
              const r = saveGame(game, true, name);
              report(r.ok, r.ok ? `Saved as “${name.trim()}”.` : `Could not save: ${r.reason}.`);
              setName('');
              setV(v => v + 1);
            }}
          >
            Save as
          </button>
        </div>
        <h3>
          This game’s saves{' '}
          <InfoButton label="About saves">
            <span>Autosaves: last three turns.</span>
            <span>Named saves: up to five a game.</span>
          </InfoButton>
        </h3>
        <ul className="save-entries">
          {saves.map(e => (
            <li key={e.key}>
              <span>
                <b>{e.name ?? (e.manual ? 'Saved' : 'Autosave')}</b> · turn {e.turn}{' '}
                <small className="muted">{when(e.savedAt)}</small>
              </span>
              <button
                className="small"
                onClick={() => {
                  const r = loadSave(e.key);
                  if (r.state) onLoad(r.state);
                  else report(false, r.warning ?? 'Could not load.');
                }}
              >
                Load
              </button>
            </li>
          ))}
          {!saves.length && <li className="muted">None yet.</li>}
        </ul>
      </div>
    </div>
  );
}
