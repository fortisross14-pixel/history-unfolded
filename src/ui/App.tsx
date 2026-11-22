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
      key={game.settings.map.seed}
      initial={game}
      assets={assets}
      onQuit={() => setGame(null)}
    />
  );
}
