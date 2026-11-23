import { useState } from 'react';
import { MAP_SIZES, MAP_TYPES } from '../engine/mapgen.ts';
import { randomSeed } from '../engine/rng.ts';
import type { GameSettings, GameState, Level3, MapSize, MapType } from '../engine/types.ts';
import { deleteGame, importSave, listGames } from './save.ts';
import { SettingsDialog } from './SettingsDialog.tsx';
import { InstallButton } from './InstallButton.tsx';
import { artUrl } from '../render/art.ts';
import { DIFFICULTIES, DIFFICULTY_ORDER, type Difficulty } from '../engine/difficulty.ts';
import { VICTORY } from '../engine/victory.ts';

const L3 = (labels: [string, string, string]) =>
  (['low', 'normal', 'high'] as Level3[]).map((v, i) => ({ v, label: labels[i] }));

export function Menu({
  onStart,
  onContinue,
  onImport,
}: {
  onStart: (s: GameSettings) => void;
  onContinue: (id?: string) => void;
  /** a game read from a save file */
  onImport?: (s: GameState) => void;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [importError, setImportError] = useState('');
  const [type, setType] = useState<MapType>('random');
  const [size, setSize] = useState<MapSize>('standard');
  const [civs, setCivs] = useState<number>(MAP_SIZES.standard.civs);
  const [seaLevel, setSea] = useState<Level3>('normal');
  const [climate, setClimate] = useState<Level3>('normal');
  const [rainfall, setRain] = useState<Level3>('normal');
  const [resources, setRes] = useState<Level3>('normal');
  const [mountains, setMtn] = useState<Level3>('normal');
  const [seed, setSeed] = useState<number>(randomSeed());
  const [name, setName] = useState('');
  const [games, setGames] = useState(listGames);
  const [turnLimit, setTurnLimit] = useState(400);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [noVictory, setNoVictory] = useState<NonNullable<GameSettings['noVictory']>>([]);

  const select = <T extends string>(
    label: string,
    value: T,
    set: (v: T) => void,
    opts: { v: T; label: string }[],
  ) => (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={e => set(e.target.value as T)}>
        {opts.map(o => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div
      className="menu"
      style={
        artUrl('title/title')
          ? { backgroundImage: `url(${artUrl('title/title')})`, backgroundSize: 'cover' }
          : undefined
      }
    >
      <div className="menu-card">
        <h1>History Unfolded</h1>
        <p className="subtitle">Every people starts the same. What they become is up to you.</p>
        <div className="menu-tools">
          <label className="button-like" title="Load a game saved to a file with Export">
            Import a save file
            <input
              type="file"
              accept=".json,application/json"
              hidden
              onChange={async e => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  const st = importSave(await file.text());
                  setImportError('');
                  onImport?.(st);
                } catch (err) {
                  setImportError(err instanceof Error ? err.message : 'Could not read that file.');
                }
              }}
            />
          </label>
          <button className="secondary" onClick={() => setShowSettings(true)}>
            Settings
          </button>
          <InstallButton />
        </div>
        {importError && <p className="bad small">{importError}</p>}
        {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
        {games.length > 0 && (
          <div className="saves">
            <button className="primary wide" onClick={() => onContinue(games[0].id)}>
              Continue: {games[0].civ}, turn {games[0].turn}
            </button>
            {games.length > 1 && (
              <div className="save-list">
                {games.slice(1).map(g => (
                  <span key={g.id} className="save-row">
                    <button onClick={() => onContinue(g.id)}>
                      {g.civ} · {g.mapType} · turn {g.turn}
                    </button>
                    <button
                      className="x small"
                      title="Delete this game"
                      onClick={() => {
                        deleteGame(g.id);
                        setGames(listGames());
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <h2>New game</h2>
        <div className="map-types difficulty" role="radiogroup" aria-label="Difficulty">
          {DIFFICULTY_ORDER.map(d => (
            <button
              key={d}
              role="radio"
              aria-checked={difficulty === d}
              className={`map-type ${difficulty === d ? 'on' : ''}`}
              onClick={() => setDifficulty(d)}
            >
              <b>{DIFFICULTIES[d].name}</b>
              <small>{DIFFICULTIES[d].promise}</small>
            </button>
          ))}
        </div>
        <ul className="difficulty-notes muted small">
          {DIFFICULTIES[difficulty].notes.map(n => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <fieldset className="victory-toggles">
          <legend>Victories</legend>
          <label title="Always on">
            <input type="checkbox" checked disabled /> Conquest
          </label>
          {(['cultural', 'economic', 'diplomatic', 'scientific'] as const).map(k => (
            <label key={k} title={VICTORY[k].goal}>
              <input
                type="checkbox"
                checked={!noVictory.includes(k)}
                onChange={e =>
                  setNoVictory(v => (e.target.checked ? v.filter(x => x !== k) : [...v, k]))
                }
              />{' '}
              {VICTORY[k].name}
            </label>
          ))}
          <span className="muted small">The best score wins at the last turn either way.</span>
        </fieldset>
        <div className="map-types">
          {MAP_TYPES.map(t => (
            <button
              key={t.id}
              className={`map-type ${type === t.id ? 'on' : ''}`}
              onClick={() => setType(t.id)}
            >
              <b>{t.name}</b>
              <small>{t.note}</small>
            </button>
          ))}
        </div>
        <div className="fields">
          {select(
            'Map size',
            size,
            v => {
              setSize(v);
              setCivs(MAP_SIZES[v].civs);
            },
            (Object.keys(MAP_SIZES) as MapSize[]).map(k => ({
              v: k,
              label: `${k[0].toUpperCase() + k.slice(1)} (${MAP_SIZES[k].w}×${MAP_SIZES[k].h})`,
            })),
          )}
          <label className="field">
            <span>Peoples</span>
            <select value={civs} onChange={e => setCivs(Number(e.target.value))}>
              {Array.from({ length: MAP_SIZES[size].civs - 1 }, (_, i) => i + 2).map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          {select(
            'Sea level',
            seaLevel,
            setSea,
            L3(['Low (more land)', 'Normal', 'High (more sea)']),
          )}
          {select('Climate', climate, setClimate, L3(['Cold', 'Temperate', 'Hot']))}
          {select('Rainfall', rainfall, setRain, L3(['Dry', 'Normal', 'Wet']))}
          {select('Resources', resources, setRes, L3(['Sparse', 'Normal', 'Abundant']))}
          {select('Mountains', mountains, setMtn, L3(['Few', 'Normal', 'Many']))}
          <label className="field">
            <span>Seed</span>
            <span className="row">
              <input
                type="number"
                value={seed}
                onChange={e => setSeed(Number(e.target.value) || 0)}
              />
              <button onClick={() => setSeed(randomSeed())} title="New random seed">
                ↻
              </button>
            </span>
          </label>
          <label className="field">
            <span>Game length</span>
            <select value={turnLimit} onChange={e => setTurnLimit(Number(e.target.value))}>
              {[200, 300, 400, 600].map(n => (
                <option key={n} value={n}>
                  {n} turns
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Your people</span>
            <input
              placeholder="Aurelians"
              value={name}
              maxLength={24}
              onChange={e => setName(e.target.value)}
            />
          </label>
        </div>
        <button
          className="primary wide"
          onClick={() =>
            onStart({
              map: { type, size, seaLevel, climate, rainfall, resources, mountains, seed },
              civCount: civs,
              playerName: name.trim(),
              turnLimit,
              difficulty,
              noVictory: noVictory.length ? noVictory : undefined,
            })
          }
        >
          Begin
        </button>
      </div>
    </div>
  );
}
