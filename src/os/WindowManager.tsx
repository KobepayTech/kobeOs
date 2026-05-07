import { Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AppWindow } from './AppWindow';
import { useOSStore } from './store';

/**
 * Renders all open windows managed by the OS store.
 */
export function WindowManager() {
  const windows = useOSStore((s) => s.windows);
  const apps = useOSStore((s) => s.apps);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>
      <AnimatePresence>
        {windows.map((win) => {
          const app = apps.find((a) => a.id === win.appId);
          if (!app) return null;
          const Component = app.component;
          return (
            <div key={win.id} className="pointer-events-auto" style={{ position: 'absolute', inset: 0 }}>
              <AppWindow window={win}>
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center h-full text-os-text-muted">
                      Loading...
                    </div>
                  }
                >
                  <Component />
                </Suspense>
              </AppWindow>
            </div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
