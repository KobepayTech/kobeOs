import { useState, useEffect } from 'react';

export type SystemMode = 'live-usb' | 'installed' | 'development' | 'unknown';

function hasElectronSystemMode(): boolean {
  if (typeof window === 'undefined') return false;
  const getSystemMode = window.kobeOS?.system?.getSystemMode;
  return typeof getSystemMode === 'function';
}

function getSystemModeFromElectron(): Promise<'live-usb' | 'installed'> | null {
  if (!hasElectronSystemMode()) return null;
  return window.kobeOS.system.getSystemMode();
}

export function useSystemMode(): SystemMode {
  const [mode, setMode] = useState<SystemMode>(() => {
    // The preload bridge is the authoritative Electron check. User-agent
    // sniffing is unreliable in embedded and test browsers.
    return hasElectronSystemMode() ? 'unknown' : 'development';
  });

  useEffect(() => {
    // /proc/mounts is only readable from Electron's main process. Ask the
    // preload bridge instead of attempting a blocked file:// fetch in the
    // renderer.
    const request = getSystemModeFromElectron();
    if (!request) return;
    void request.then((result) => setMode(result)).catch(() => setMode('unknown'));
  }, []);

  return mode;
}
