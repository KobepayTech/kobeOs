import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { verifyOAuthSession } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { clearPendingOAuth, rememberOAuth, providerNames, providerSignInUrl, oauthErrorMessage, type OAuthProvider } from '@/lib/oauth-flow';

/** Completes a provider redirect, persists both tokens and the verified user,
 * then either opens the normal web KobeOS shell or hands the cloud credentials
 * back to a desktop OAuth popup's opener for local-session exchange. */
export default function OAuthCallback({ provider }: { provider: OAuthProvider }) {
  const credentials = useRef<{ access: string; refresh: string } | null>(null);
  const cancelled = useRef(false);
  const inFlight = useRef(false);
  const request = useRef<AbortController | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [completed, setCompleted] = useState(false);
  const name = providerNames[provider];

  const complete = useCallback(async () => {
    if (cancelled.current || inFlight.current) return;
    inFlight.current = true;
    request.current = new AbortController();
    setBusy(true);
    setCompleted(false);
    setError('');
    try {
      const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      // Strip errors as well as credentials; recovery must never replay a
      // stale provider result from the address bar.
      window.history.replaceState(null, '', window.location.pathname);
      const providerError = fragment.get('error');
      if (providerError) throw new Error(providerError);

      if (!credentials.current) {
        const access = fragment.get('access_token');
        const refresh = fragment.get('refresh_token');
        if (!access || !refresh) throw new Error(`${name} did not return login credentials.`);
        credentials.current = { access, refresh };
      }

      // On the hosted callback this verifies the cloud token against Kobe Cloud
      // and persists the profile. The desktop opener will exchange the same
      // cloud identity for its own local embedded-backend session.
      const user = await verifyOAuthSession(credentials.current.access, credentials.current.refresh, request.current.signal);
      if (cancelled.current) return;
      clearPendingOAuth();

      if (window.opener && !window.opener.closed) {
        // SECURITY: only the desktop (Electron) opener is file:// (opaque
        // origin) and needs a wildcard targetOrigin — and that receiver
        // additionally validates the sender origin + IS_DESKTOP. On a normal
        // web browser we MUST target our own exact origin, otherwise a
        // malicious page that opened this popup would receive the tokens.
        const isElectron = typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent);
        const targetOrigin = isElectron ? '*' : window.location.origin;
        window.opener.postMessage({
          type: 'kobeos-oauth-complete',
          provider,
          accessToken: credentials.current.access,
          refreshToken: credentials.current.refresh,
          user,
        }, targetOrigin);
        setBusy(false);
        setCompleted(true);
        window.close();
        return;
      }

      window.location.replace('/');
    } catch (err) {
      if (cancelled.current) return;
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        credentials.current = null;
      }
      const timedOut = !!err && typeof err === 'object' && 'name' in err && ['TimeoutError', 'AbortError'].includes(String(err.name));
      setError(timedOut
        ? 'KobeOS took too long to verify your account. Retry verification or use another sign-in method.'
        : oauthErrorMessage(err instanceof Error ? err.message : `${name} sign-in failed.`, provider));
      setBusy(false);
    } finally {
      inFlight.current = false;
    }
  }, [name, provider]);

  useEffect(() => { void complete(); }, [complete]);

  const backToSignup = () => {
    cancelled.current = true;
    request.current?.abort();
    credentials.current = null;
    clearPendingOAuth();
    if (window.opener && !window.opener.closed) {
      window.close();
      return;
    }
    window.location.replace('/?signin=1');
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#071321] p-6 text-white">
      <section className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.06] p-7 text-center shadow-2xl">
        {busy ? (
          <>
            <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#ff7616]" />
            <h1 className="mt-5 text-xl font-black">Finishing {name} sign-in</h1>
            <p className="mt-2 text-sm text-slate-400">Saving your account securely and opening KobeOS…</p>
            <button
              type="button"
              onClick={backToSignup}
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] text-sm font-black text-slate-200 hover:bg-white/[0.12]"
            >
              <ArrowLeft className="h-4 w-4" /> Use another sign-in method
            </button>
          </>
        ) : completed ? (
          <>
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-400" />
            <h1 className="mt-5 text-xl font-black">{name} sign-in complete</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">Return to the KobeOS window. You can close this window if it did not close automatically.</p>
          </>
        ) : (
          <>
            <AlertCircle className="mx-auto h-9 w-9 text-amber-400" />
            <h1 className="mt-5 text-xl font-black">{name} sign-in needs attention</h1>
            <p className="mt-2 break-words text-sm leading-6 text-slate-300">{error}</p>
            {credentials.current ? <button
              type="button"
              onClick={() => void complete()}
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ff7616] text-sm font-black text-white"
            >
              <RefreshCw className="h-4 w-4" /> Retry verification
            </button> : <a
              href={providerSignInUrl(provider)}
              onClick={() => rememberOAuth(provider)}
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ff7616] text-sm font-black text-white"
            >
              <RefreshCw className="h-4 w-4" /> Try {name} again
            </a>}
            <p className="mt-4 text-xs leading-5 text-slate-400">{name} may ask you to verify your identity. Complete that check with {name}, then return here. Connecting a selling account is a separate step inside Creator or Live Sales.</p>
            <button
              type="button"
              onClick={backToSignup}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] text-sm font-black text-slate-200 hover:bg-white/[0.12]"
            >
              <ArrowLeft className="h-4 w-4" /> Use another sign-in method
            </button>
          </>
        )}
      </section>
    </main>
  );
}
