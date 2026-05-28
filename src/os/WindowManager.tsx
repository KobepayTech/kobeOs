import { Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AppWindow } from './AppWindow';
import { SubscriptionGate } from './SubscriptionGate';
import { AppErrorBoundary } from './ErrorBoundary';
import { useOSStore } from './store';

/**
 * Renders all open windows managed by the OS store.
 * Each app is wrapped in a SubscriptionGate that enforces the tier declared
 * in the app's manifest before rendering the component.
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
          const tier = app.subscriptionTier ?? 'free';
          return (
            // Each window is sized and positioned by AppWindow itself.
            // Do NOT use inset-0 here — that would make every wrapper cover
            // the full desktop and intercept clicks meant for windows below.
            <div key={win.id} className="pointer-events-none" style={{ position: 'absolute', inset: 0 }}>
              <AppWindow window={win}>
                <SubscriptionGate required={tier}>
                  <AppErrorBoundary appName={app.name}>
                    <Suspense
                      fallback={
                        <div className="flex items-center justify-center h-full text-os-text-muted">
                          Loading...
                        </div>
                      }
                    >
                      <Component />
                    </Suspense>
                  </AppErrorBoundary>
                </SubscriptionGate>
              </AppWindow>
            </div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
