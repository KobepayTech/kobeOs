import { Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AppWindow } from './AppWindow';
import { SubscriptionGate } from './SubscriptionGate';
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
            <div key={win.id} className="pointer-events-auto" style={{ position: 'absolute', inset: 0 }}>
              <AppWindow window={win}>
                <SubscriptionGate required={tier}>
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center h-full text-os-text-muted">
                        Loading...
                      </div>
                    }
                  >
                    <Component />
                  </Suspense>
                </SubscriptionGate>
              </AppWindow>
            </div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
