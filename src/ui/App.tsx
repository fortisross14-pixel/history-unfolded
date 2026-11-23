import { useEffect, useState } from 'react';
import { newGame } from '../engine/game.ts';
import type { GameSettings, GameState } from '../engine/types.ts';
import { loadAssets, type Assets } from '../render/assets.ts';
import { Game } from './Game.tsx';
import { Menu } from './Menu.tsx';
import { loadGame, saveGame } from './save.ts';

export function App() {
  const [assets, setAssets] = useState<Assets | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  // a fresh game on the same seed still needs a fresh screen
  const [run, setRun] = useState(0);

  useEffect(() => {
    loadAssets().then(setAssets);
  }, []);

  if (!assets) return <div className="loading">Unrolling the map…</div>;
  if (!game) {
    return (
      <Menu
        onStart={(settings: GameSettings) => {
          const g = newGame(settings);
          saveGame(g);
          setGame(g);
        }}
        onImport={g => {
          saveGame(g);
          setRun(n => n + 1);
          setGame(g);
        }}
        onContinue={id => {
          const r = loadGame(id);
          if (r.warning) alert(r.warning);
          if (r.state) setGame(r.state);
        }}
      />
    );
  }
  return (
    <Game
      key={`${game.settings.map.seed}-${run}`}
      initial={game}
      assets={assets}
      onQuit={() => setGame(null)}
      onLoad={g => {
        setRun(n => n + 1);
        setGame(g);
      }}
      onRematch={() => {
        const g = newGame(game.settings);
        saveGame(g);
        setRun(n => n + 1);
        setGame(g);
      }}
    />
  );
}
