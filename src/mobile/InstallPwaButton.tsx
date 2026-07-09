import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

/**
 * One-tap "Install App" for the mobile PWA. A QR code can only open a URL in
 * the browser — it can't install an app. This captures the browser's
 * `beforeinstallprompt` event and lets the user install the PWA (adds it to the
 * home screen so it opens like a native app, not a website tab). Hidden when the
 * app is already installed / running standalone, or when the browser doesn't
 * support programmatic install (e.g. iOS Safari — there we show a hint instead).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallPwaButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true);
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (isStandalone || installed) return null;

  // iOS Safari has no beforeinstallprompt — guide the user to Share → Add to Home Screen.
  if (isIOS && !deferred) {
    return (
      <span className="text-[10px] text-slate-400">Add to Home Screen via Share ⬆</span>
    );
  }
  if (!deferred) return null;

  return (
    <button
      onClick={async () => { await deferred.prompt(); await deferred.userChoice; setDeferred(null); }}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700"
    >
      <Download className="w-3.5 h-3.5" /> Install App
    </button>
  );
}
