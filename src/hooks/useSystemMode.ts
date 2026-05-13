import { useState, useEffect } from 'react';
export type SystemMode = 'live-usb' | 'installed' | 'development' | 'unknown';
export function useSystemMode(): SystemMode {
  const [mode, setMode] = useState<SystemMode>('unknown');
  useEffect(() => {
    const isElectron = window.navigator.userAgent.toLowerCase().includes('electron');
    if (!isElectron) { setMode('development'); return; }
    fetch('file:///proc/mounts').then(r => r.text()).then(m => {
      if (m.includes('/dev/sr0') || m.includes('/dev/cdrom') || m.includes('overlay') || m.includes('aufs')) setMode('live-usb');
      else if (m.includes('/dev/sda') || m.includes('/dev/nvme') || m.includes('/dev/mmc')) setMode('installed');
      else setMode('installed');
    }).catch(() => setMode('installed'));
  }, []);
  return mode;
}
