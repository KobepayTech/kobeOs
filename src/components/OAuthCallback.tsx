import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { ensureSession, oauthConsume } from '@/lib/auth';

type OAuthProvider = 'tiktok' | 'meta';

const providerNames: Record<OAuthProvider, string> = {
  tiktok: 'TikTok',
  meta: 'Meta',
};

/** Completes a provider redirect, persists both tokens and the verified user, then opens KobeOS. */
export default function OAuthCallback({ provider }: { provider: OAuthProvider }) {
  const credentials = useRef<{ access: string; refresh: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const name = providerNames[provider];

  const complete = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const providerError = fragment.get('error');
      if (providerError) throw new Error(providerError);

      if (!credentials.current) {
        const access = fragment.get('access_token');
        const refresh = fragment.get('refresh_token');
        if (!access || !refresh) throw new Error(`${name} did not return login credentials.`);
        credentials.current = { access, refresh };
        // Remove credentials from the visible URL as soon as they are captured.
        window.history.replaceState(null, '', window.location.pathname);
      }

      oauthConsume(credentials.current.access, credentials.current.refresh);
      // This also persists kobeos_auth_user, which the app needs on reload.
      await ensureSession();
      window.location.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : `${name} sign-in failed.`);
      setBusy(false);
    }
  }, [name]);

  useEffect(() => { void complete(); }, [complete]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#071321] p-6 text-white">
      <section className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.06] p-7 text-center shadow-2xl">
        {busy ? (
          <>
            <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#ff7616]" />
            <h1 className="mt-5 text-xl font-black">Finishing {name} signup</h1>
            <p className="mt-2 text-sm text-slate-400">Saving your account securely and opening KobeOS…</p>
          </>
        ) : (
          <>
            <AlertCircle className="mx-auto h-9 w-9 text-amber-400" />
            <h1 className="mt-5 text-xl font-black">{name} signup needs attention</h1>
            <p className="mt-2 break-words text-sm leading-6 text-slate-300">{error}</p>
            <button
              type="button"
              onClick={() => void complete()}
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ff7616] text-sm font-black text-white"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
            <a href="/" className="mt-4 block text-xs font-bold text-slate-400 hover:text-white">Return to sign in</a>
          </>
        )}
      </section>
    </main>
  );
}
