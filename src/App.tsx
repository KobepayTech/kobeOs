import { useEffect } from 'react';
import { Desktop } from '@/os/Desktop';
import { Taskbar } from '@/os/Taskbar';
import { WindowManager } from '@/os/WindowManager';
import { NotificationCenter } from '@/os/NotificationCenter';
import { useTheme } from '@/os/useTheme';
import { useOSStore } from '@/os/store';
import { appRegistry } from '@/os/registry';

export default function App() {
  const { theme } = useTheme();
  const setApps = useOSStore((s) => s.setApps);

  useEffect(() => {
    setApps(appRegistry);
  }, [setApps]);

  return (
    <div
      className="h-screen w-screen overflow-hidden"
      data-theme={theme}
      style={{ background: 'var(--os-wallpaper, linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%))' }}
    >
      <Desktop />
      <WindowManager />
      <Taskbar />
      <NotificationCenter />
    </div>
  );
}
