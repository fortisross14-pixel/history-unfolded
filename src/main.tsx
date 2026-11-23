import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.tsx';
import './styles.css';
import './ivory.css';
import { IconSprite } from './ui/icons.tsx';
import { applySettings } from './ui/settings.ts';

applySettings();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IconSprite />
    <App />
  </StrictMode>,
);
