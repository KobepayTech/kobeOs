import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Loader2, WifiOff, X } from 'lucide-react';
import { installMarketplaceApp } from '@/lib/appMarketplace';
import { appCatalogue, getInstalledAppRegistry } from './registry';
import { installBundledModule, type ModuleProgress } from './module-installer';
import { useOSStore } from './store';

export function ContextualInstallPrompt() {
  const appId = useOSStore((state) => state.pendingInstallAppId);
  const clear = useOSStore((state) => state.clearAppInstallRequest);
  const recordInstalledApp = useOSStore((state) => state.recordInstalledApp);
  const setApps = useOSStore((state) => state.setApps);
  const launchApp = useOSStore((state) => state.launchApp);
  const addNotification = useOSStore((state) => state.addNotification);
  const [progress, setProgress] = useState<ModuleProgress | null>(null);
  const [error, setError] = useState('');
  const app = useMemo(() => appCatalogue.find((candidate) => candidate.id === appId), [appId]);

  const dismiss = () => {
    setProgress(null);
    setError('');
    clear();
  };

  if (!appId) return null;

  const install = async () => {
    if (!app) {
      setError('This module is not available in the current KobeOS build.');
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('Connect to the internet to start the 14-day trial and install this module.');
      return;
    }

    setError('');
    try {
      await installBundledModule(app, setProgress);
      const entitlement = await installMarketplaceApp(app.id);
      recordInstalledApp(entitlement);
      setApps(getInstalledAppRegistry());
      addNotification({
        title: `${app.name} installed`,
        message: 'Your 14-day trial is active. Opening the module now.',
        type: 'success',
      });
      dismiss();
      window.setTimeout(() => launchApp(app.id), 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Could not install ${app.name}.`);
    }
  };

  const busy = !!progress && !['ready', 'failed'].includes(progress.stage);

  return (
    <div
      className="fixed inset-0 z-[10050] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="context-install-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) dismiss();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-white text-slate-900 shadow-2xl">
        <div className="flex items-start gap-4 p-6">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Download className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="context-install-title" className="text-lg font-black">
              Install {app?.name ?? appId}?
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Install it here and continue where you were. Your 14-day trial starts after online activation succeeds.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            disabled={busy}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {progress && (
          <div className="mx-6 rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              {progress.stage === 'ready'
                ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                : <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />}
              <span className="flex-1">{progress.message}</span>
              <span>{progress.progress}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-indigo-600 transition-[width]"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mx-6 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {/internet|connect|online/i.test(error)
              ? <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
              : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 p-5">
          <button
            type="button"
            onClick={dismiss}
            disabled={busy}
            className="h-11 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => void install()}
            disabled={busy || !app}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {busy ? 'Installing…' : 'Install & open'}
          </button>
        </div>
      </div>
    </div>
  );
}
