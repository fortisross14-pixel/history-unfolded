import { useEffect, useState } from 'react';
import { canInstall, install, installed, installHelp, onInstallChange } from './install.ts';

/** Install the game as an app; explains how when the browser makes no offer. */
export function InstallButton({ className }: { className?: string }) {
  const [, setV] = useState(0);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const off = onInstallChange(() => setV(v => v + 1));
    return () => {
      off();
    };
  }, []);
  if (installed()) return null;
  return (
    <span className="install">
      <button
        className={className ?? 'secondary'}
        onClick={async () => {
          if (canInstall()) await install();
          else setHelp(h => !h);
        }}
        title="Install History Unfolded as an app on this device"
      >
        Install app
      </button>
      {help && <small className="muted install-help">{installHelp()}</small>}
    </span>
  );
}
