/**
 * The painted interface pieces of art/R5-UI-SHEETS.md (gilded frame, medallion ring, title
 * divider, button plate, parchment, oxblood and leather textures, a banner per culture domain).
 * Each one that exists in the art manifest becomes a CSS custom property `--im-art-<name>` and a
 * class `ui-art-<name>` on <html>; src/ui/r4-imperator.css uses them and draws its own CSS
 * version of every piece that is missing.
 */
import { artUrl, loadArtManifest } from '../render/art.ts';
import { DOMAINS } from '../data/culture.ts';

const PIECES = ['frame', 'medal', 'divider', 'plate', 'parchment', 'oxblood', 'leather'];

export async function applyUiArt(): Promise<void> {
  await loadArtManifest();
  const root = document.documentElement;
  for (const name of PIECES) {
    const url = artUrl(`ui/${name}`);
    if (!url) continue;
    root.style.setProperty(`--im-art-${name}`, `url("${url}")`);
    root.classList.add(`ui-art-${name}`);
  }
  // one banner per culture domain, picked by the [data-domain] the Tome cards carry
  const rules = Object.keys(DOMAINS)
    .map(d => [d, artUrl(`banner/${d}`)] as const)
    .filter(([, url]) => url)
    .map(([d, url]) => `[data-domain="${d}"]{--im-banner:url("${url}")}`);
  if (rules.length) {
    const style = document.createElement('style');
    style.dataset.uiArt = '';
    style.textContent = rules.join('\n');
    document.head.appendChild(style);
    root.classList.add('ui-art-banner');
  }
}
