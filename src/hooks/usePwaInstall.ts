import { useCallback, useEffect, useState } from 'react';

/**
 * Captures the browser's `beforeinstallprompt` event so the UI can offer an
 * "Install" button at the right moment instead of nagging the user with the
 * native mini-infobar (which Chromium auto-dismisses anyway). Also reports
 * whether the app is already installed (via `appinstalled` and the iOS-style
 * `display-mode: standalone` check).
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PwaInstallState {
  /** True once the browser has fired beforeinstallprompt and we have a usable prompt. */
  canInstall: boolean;
  /** True if the app is already running as an installed PWA / TWA / standalone. */
  installed: boolean;
  /** Call to show the native install dialog. Resolves to 'accepted' | 'dismissed' | 'unavailable'. */
  prompt: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export function usePwaInstall(): PwaInstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => detectStandalone());

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstalled(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt as EventListener);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt as EventListener);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const prompt = useCallback(async () => {
    if (!deferred) return 'unavailable' as const;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null); // single-use per browser spec
    return choice.outcome;
  }, [deferred]);

  return { canInstall: !!deferred, installed, prompt };
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  // iOS Safari
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}
