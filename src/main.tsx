import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.tsx';
import './styles.css';
import './ivory.css';
import './ui/declutter.css';
import './ui/r4-style.css';
import { IconSprite } from './ui/icons.tsx';
import { applySettings } from './ui/settings.ts';
import { startInstall } from './ui/install.ts';
import { initStore, persistStore } from './ui/store.ts';

applySettings();
startInstall();

// the saves load from IndexedDB before the menu asks whether there is a game to continue
void initStore().then(() => {
  persistStore();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <IconSprite />
      <App />
    </StrictMode>,
  );
});
