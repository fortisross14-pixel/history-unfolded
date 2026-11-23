import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.tsx';
import './styles.css';
import './ivory.css';
import './ui/declutter.css';
import { IconSprite } from './ui/icons.tsx';
import { applySettings } from './ui/settings.ts';
import { startInstall } from './ui/install.ts';

applySettings();
startInstall();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IconSprite />
    <App />
  </StrictMode>,
);
