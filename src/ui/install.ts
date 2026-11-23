/**
 * Installing the game as an app (Android, Windows, macOS, Linux; iOS through Add to Home Screen).
 * The browser offers the install once the page has a manifest and a service worker; we keep its
 * offer and show our own Install button with it.
 */
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let offer: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(f => f());

export function startInstall() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    offer = e as InstallPrompt;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    offer = null;
    changed();
  });
  // the offline cache and the browser's install offer both need a service worker
  if ('serviceWorker' in navigator && import.meta.env.PROD)
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* no offline cache: the game still runs */
    });
}

export const onInstallChange = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

/** Already running as an installed app? */
export const installed = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true);

export const canInstall = () => !!offer;

/** Ask the browser to install; false when it has no offer to make. */
export async function install(): Promise<boolean> {
  if (!offer) return false;
  await offer.prompt();
  const r = await offer.userChoice;
  offer = null;
  changed();
  return r.outcome === 'accepted';
}

/** What to do when the browser makes no offer, for this device. */
export function installHelp(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'On iPhone or iPad: tap Share, then Add to Home Screen.';
  if (/Android/.test(ua))
    return 'On Android: open the browser menu (⋮) and choose Install app or Add to Home screen.';
  if (/Firefox/.test(ua))
    return 'Firefox cannot install web apps on the desktop: open the game in Chrome or Edge and use Install.';
  return 'In Chrome or Edge: use the install icon at the right of the address bar, or the menu’s Install History Unfolded.';
}
