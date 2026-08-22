import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  Cloud,
  CloudOff,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  User,
  Wifi,
  Zap,
} from 'lucide-react';
import {
  login,
  register,
  oauthGoogle,
  requestPasswordReset,
  resetPassword,
  desktopLogin,
  desktopRegister,
  desktopOauthGoogle,
  desktopOauthExchange,
  desktopRequestPasswordReset,
  desktopResetPassword,
  type AuthUser,
} from '@/lib/auth';
import { API_BASE, ApiError } from '@/lib/api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const IS_DESKTOP = typeof window !== 'undefined' && Boolean((window as any).kobeOS);
const KOBE_CLOUD_API = ((import.meta.env.VITE_KOBE_CLOUD_API as string | undefined) || 'https://api.kobeapptz.com/api').replace(/\/$/, '');
const DESKTOP_OAUTH_ORIGINS = new Set([
  'https://kobeapptz.com',
  'https://app.kobeapptz.com',
  'https://www.kobeapptz.com',
]);

// Load Google Identity Services once (no-op if already present).
function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as { google?: { accounts?: { id?: unknown } } }).google?.accounts?.id) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(s);
  });
}

type Mode = 'create' | 'signin';
type ConnectionState = 'checking' | 'online' | 'offline' | 'server-down';
type SocialProvider = 'tiktok' | 'meta';

type DesktopOAuthMessage = {
  type?: string;
  provider?: SocialProvider;
  accessToken?: string;
  refreshToken?: string;
};

export default function LoginScreen({
  onLogin,
}: {
  onLogin: (user: AuthUser, created: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>('create');
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const checkConnection = useCallback(async () => {
    if (!navigator.onLine) {
      setConnection('offline');
      return;
    }
    setConnection('checking');
    try {
      // In desktop mode, go through the embedded backend. That endpoint checks
      // Kobe Cloud server-side, so file:// never needs cross-origin access to
      // the public API and we verify both halves of account setup at once.
      const endpoint = IS_DESKTOP
        ? `${API_BASE}/auth/desktop/cloud-status`
        : `${API_BASE}/system/version`;
      const response = await fetch(endpoint, {
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
      });
      const contentType = response.headers.get('content-type') ?? '';
      const body = contentType.includes('application/json')
        ? await response.json() as Record<string, unknown>
        : null;
      const isKobeCloud = response.ok &&
        !!body &&
        typeof body.version === 'string' &&
        typeof body.buildHash === 'string' &&
        typeof body.startedAt === 'string';
      setConnection(isKobeCloud ? 'online' : 'server-down');
    } catch {
      setConnection('server-down');
    }
  }, []);

  useEffect(() => {
    checkConnection();
    const online = () => checkConnection();
    const offline = () => setConnection('offline');
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [checkConnection]);

  // Desktop social OAuth runs in a popup hosted by Kobe Cloud. The hosted
  // callback verifies the provider login, then posts the cloud credentials
  // back here. We accept messages only from Kobe-owned HTTPS origins and then
  // exchange the cloud identity for a local embedded-backend session.
  useEffect(() => {
    if (!IS_DESKTOP) return;

    const receiveOAuth = async (event: MessageEvent) => {
      if (!DESKTOP_OAUTH_ORIGINS.has(event.origin)) return;
      const data = event.data as DesktopOAuthMessage;
      if (!data || data.type !== 'kobeos-oauth-complete') return;
      if ((data.provider !== 'tiktok' && data.provider !== 'meta') || !data.accessToken) return;

      setLoading(true);
      setError('');
      try {
        const user = await desktopOauthExchange(data.accessToken, data.refreshToken ?? '');
        onLogin(user, false);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message || `${data.provider} sign-in could not be linked to this KobeOS installation.`);
        } else {
          setError(`${data.provider} sign-in finished online, but KobeOS could not create the local session. Try again.`);
        }
        checkConnection();
      } finally {
        setLoading(false);
      }
    };

    window.addEventListener('message', receiveOAuth);
    return () => window.removeEventListener('message', receiveOAuth);
  }, [checkConnection, onLogin]);

  const submit = async () => {
    if (connection !== 'online') {
      setError('Connect this computer to the internet before creating or signing into an account.');
      return;
    }
    if (!email.trim()) {
      setError('Enter your email address or phone number.');
      return;
    }
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    const isPhone = /^\+?[\d\s().-]{7,20}$/.test(email.trim());
    if (!isEmail && !isPhone) {
      setError('Enter a valid email address or phone number.');
      return;
    }
    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }
    if (mode === 'create' && !displayName.trim()) {
      setError('Enter your name or business name.');
      return;
    }
    if (mode === 'create' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const user = mode === 'create'
        ? IS_DESKTOP
          ? await desktopRegister(email.trim(), password, displayName.trim())
          : await register(email.trim(), password, displayName.trim())
        : IS_DESKTOP
          ? await desktopLogin(email.trim(), password)
          : await login(email.trim(), password);
      onLogin(user, mode === 'create');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('An account already exists for this email or phone number. Choose Sign in.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('The email/phone or password is incorrect.');
      } else if (err instanceof ApiError) {
        setError(err.message || 'The account service rejected this request.');
      } else {
        setError('KobeOS could not reach the account service. Check the connection and try again.');
        checkConnection();
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!GOOGLE_CLIENT_ID) { setError('Google sign-in is not configured on this build.'); return; }
    setError('');
    try {
      await loadGis();
      const google = (window as unknown as { google: any }).google;
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp: { credential?: string }) => {
          if (!resp?.credential) { setError('Google sign-in was cancelled.'); return; }
          setLoading(true);
          try {
            const user = IS_DESKTOP
              ? await desktopOauthGoogle(resp.credential)
              : await oauthGoogle(resp.credential);
            onLogin(user, false);
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Google sign-in failed.');
          } finally { setLoading(false); }
        },
      });
      google.accounts.id.prompt();
    } catch (e) { setError((e as Error).message); }
  };

  const openDesktopOAuth = (provider: SocialProvider) => {
    setError('');
    const popup = window.open(
      `${KOBE_CLOUD_API}/auth/oauth/${provider}`,
      `kobe-${provider}-oauth`,
      'popup=yes,width=560,height=760,resizable=yes,scrollbars=yes',
    );
    if (!popup) {
      setError(`KobeOS could not open the ${provider === 'meta' ? 'Meta' : 'TikTok'} sign-in window. Allow popups and try again.`);
      return;
    }
    popup.focus();
  };

  const signInWithTikTok = () => {
    if (IS_DESKTOP) openDesktopOAuth('tiktok');
    else window.location.href = `${API_BASE}/auth/oauth/tiktok`;
  };
  const signInWithMeta = () => {
    if (IS_DESKTOP) openDesktopOAuth('meta');
    else window.location.href = `${API_BASE}/auth/oauth/meta`;
  };

  // Forgot password
  const [fpOpen, setFpOpen] = useState(false);
  const [fpStage, setFpStage] = useState<'request' | 'reset'>('request');
  const [fpToken, setFpToken] = useState('');
  const [fpNewPass, setFpNewPass] = useState('');
  const [fpMsg, setFpMsg] = useState('');
  const sendResetCode = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFpMsg('Password reset currently requires the account email address.');
      return;
    }
    setLoading(true); setFpMsg('');
    try {
      const res = IS_DESKTOP
        ? await desktopRequestPasswordReset(email.trim())
        : await requestPasswordReset(email.trim());
      if (res.resetToken) { setFpToken(res.resetToken); setFpMsg('Reset code ready — set a new password below.'); }
      else setFpMsg('If that email exists, a reset code has been sent. Enter it below.');
      setFpStage('reset');
    } catch { setFpMsg('Could not start password reset.'); }
    finally { setLoading(false); }
  };
  const submitReset = async () => {
    if (!fpToken || fpNewPass.length < 8) { setFpMsg('Enter the code and a new password (8+ chars).'); return; }
    setLoading(true); setFpMsg('');
    try {
      if (IS_DESKTOP) await desktopResetPassword(fpToken.trim(), fpNewPass);
      else await resetPassword(fpToken.trim(), fpNewPass);
      setFpMsg('Password changed — sign in with your new password.');
      setFpOpen(false); setFpStage('request'); setFpToken(''); setFpNewPass(''); setMode('signin');
    } catch { setFpMsg('Invalid or expired reset code.'); }
    finally { setLoading(false); }
  };

  const connectionMeta = {
    checking: {
      label: 'Checking Kobe Cloud',
      detail: 'Confirming a secure setup connection…',
      classes: 'border-slate-200 bg-slate-50 text-slate-600',
      icon: Loader2,
    },
    online: {
      label: 'Online and secure',
      detail: 'Kobe Cloud is ready to create your account.',
      classes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      icon: Wifi,
    },
    offline: {
      label: 'No internet connection',
      detail: 'Connect Wi-Fi or Ethernet to continue setup.',
      classes: 'border-red-200 bg-red-50 text-red-800',
      icon: CloudOff,
    },
    'server-down': {
      label: 'Kobe Cloud unavailable',
      detail: 'KobeOS could not reach the secure account service.',
      classes: 'border-amber-200 bg-amber-50 text-amber-800',
      icon: Cloud,
    },
  }[connection];
  const ConnectionIcon = connectionMeta.icon;

  return (
    <div
      className="h-screen min-h-0 overflow-hidden bg-[#071321] text-[#0a1728]"
      data-surface="startup"
      style={{
        '--bg-input': '#ffffff',
        '--border-secondary': '#cbd5e1',
        '--border-focus': '#ff7616',
        '--text-primary': '#0a1728',
        '--text-placeholder': '#94a3b8',
      } as React.CSSProperties}
    >
      <div className="relative grid h-full min-h-0 lg:grid-cols-[.9fr_1.1fr]">
        <section className="relative hidden h-full overflow-hidden bg-[#071321] p-10 text-white lg:flex lg:flex-col">
          <div className="absolute -left-40 top-1/3 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-[#ff7616]/20 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff7616] shadow-[0_12px_30px_rgba(255,118,22,.25)]">
              <Zap className="h-5 w-5" />
            </span>
            <div>
              <p className="font-black tracking-[0.18em]">KOBE</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Operating system</p>
            </div>
          </div>

          <div className="relative my-auto max-w-xl">
            <p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-[#ff8a3a]">First-time setup</p>
            <h1 className="text-4xl font-black leading-tight tracking-[-0.04em] xl:text-5xl">
              Your business OS starts with your account.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-400">
              Sign in once, choose only the apps your business needs, and receive an independent 14-day trial for every app you install.
            </p>
            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {[
                [ShieldCheck, 'Verified account', 'Your apps follow you'],
                [Store, 'Choose apps', 'Install only what fits'],
                [Sparkles, 'Kobe AI ready', 'Build and automate'],
              ].map(([Icon, title, description]) => {
                const FeatureIcon = Icon as typeof ShieldCheck;
                return (
                  <div key={String(title)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <FeatureIcon className="h-5 w-5 text-[#ff8a3a]" />
                    <p className="mt-3 text-xs font-black">{String(title)}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{String(description)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative flex items-center gap-2 text-[10px] font-semibold text-slate-500">
            <LockKeyhole className="h-3.5 w-3.5" />
            Account setup is encrypted in transit and requires Kobe Cloud.
          </div>
        </section>

        <section className="flex h-full min-h-0 items-start justify-center overflow-y-auto overscroll-contain bg-[#f4f6fa] px-4 py-6 sm:px-8 sm:py-8">
          <div className="w-full max-w-lg pb-6">
            <div className="mb-7 lg:hidden">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff7616] text-white"><Zap className="h-4 w-4" /></span>
                <span className="text-sm font-black tracking-[0.15em]">KOBE OS</span>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_25px_70px_rgba(10,23,40,.09)] sm:p-8">
              <div className="mb-6">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff7616]">Account setup</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#0a1728]">
                  {mode === 'create' ? 'Create your Kobe account' : 'Welcome back'}
                </h2>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {mode === 'create'
                    ? 'After signup, the App Store opens automatically.'
                    : 'Sign in to restore your apps, trials and subscriptions.'}
                </p>
              </div>

              <div className={`mb-5 flex items-center gap-3 rounded-2xl border p-3 ${connectionMeta.classes}`}>
                <span className="rounded-xl bg-white/70 p-2">
                  <ConnectionIcon className={`h-4 w-4 ${connection === 'checking' ? 'animate-spin' : ''}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black">{connectionMeta.label}</p>
                  <p className="mt-0.5 text-[10px] opacity-70">{connectionMeta.detail}</p>
                </div>
                {connection !== 'online' && (
                  <button onClick={checkConnection} className="rounded-lg p-2 hover:bg-white/60" title="Retry connection">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                {(['create', 'signin'] as const).map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setMode(item);
                      setError('');
                    }}
                    className={`rounded-lg px-3 py-2.5 text-xs font-black transition ${
                      mode === item ? 'bg-white text-[#0a1728] shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {item === 'create' ? 'Create account' : 'Sign in'}
                  </button>
                ))}
              </div>

              <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button type="button" onClick={signInWithGoogle} disabled={loading || connection !== 'online'} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-slate-400 disabled:opacity-50">
                  <span style={{ color: '#4285F4' }} className="text-base font-black">G</span>
                  {mode === 'create' ? 'Create with Google' : 'Sign in with Google'}
                </button>
                <button type="button" onClick={signInWithTikTok} disabled={loading || connection !== 'online'} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-black text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">
                  <span aria-hidden className="text-base">♪</span>
                  {mode === 'create' ? 'Create with TikTok' : 'Sign in with TikTok'}
                </button>
                <button type="button" onClick={signInWithMeta} disabled={loading || connection !== 'online'} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0866ff] text-xs font-bold text-white hover:bg-[#075bd8] disabled:opacity-50">
                  <span aria-hidden className="text-base font-black">f</span>
                  {mode === 'create' ? 'Create with Meta' : 'Sign in with Meta'}
                </button>
              </div>

              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[10px] text-slate-400">or use email / phone</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* A real <form> with named + identified fields so the browser's
                  password manager reliably offers to save the email/password
                  and autofills them on the next sign-in. */}
              <form onSubmit={(event) => { event.preventDefault(); if (!loading && connection === 'online') submit(); }} className="space-y-3">
                {mode === 'create' && (
                  <label htmlFor="login-name" className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    Your name or business
                    <div className="relative mt-2">
                      <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                      <input
                        id="login-name"
                        name="name"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder="Amina Joseph"
                        autoComplete="name"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#ff7616]"
                      />
                    </div>
                  </label>
                )}
                <label htmlFor="login-email" className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Email or phone number
                  <div className="relative mt-2">
                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      id="login-email"
                      name="email"
                      type="text"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@business.com or +255712345678"
                      autoComplete="username"
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#ff7616]"
                    />
                  </div>
                </label>
                <label htmlFor="login-password" className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Password
                  <div className="relative mt-2">
                    <LockKeyhole className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-11 text-sm font-semibold outline-none focus:border-[#ff7616]"
                    />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
                {mode === 'create' && (
                  <label htmlFor="login-confirm" className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
                    Confirm password
                    <div className="relative mt-2">
                      <Check className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                      <input
                        id="login-confirm"
                        name="confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Repeat your password"
                        autoComplete="new-password"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#ff7616]"
                      />
                    </div>
                  </label>
                )}

                {error && (
                  <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-semibold leading-5 text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || connection !== 'online'}
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0a1728] text-sm font-black text-white transition hover:bg-[#14253b] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'create' ? 'Create account and choose apps' : 'Sign in and open App Store'}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>

              {mode === 'signin' && (
                <div className="mt-2 text-center">
                  <button type="button" onClick={() => { setFpOpen((v) => !v); setFpMsg(''); }} className="text-[11px] text-slate-500 hover:text-slate-800">
                    Forgot password?
                  </button>
                </div>
              )}
              {fpOpen && (
                <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {fpStage === 'request' ? (
                    <button onClick={sendResetCode} disabled={loading || !email.trim()} className="h-9 w-full rounded-lg bg-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-300 disabled:opacity-50">Send reset code to {email.trim() || 'your email'}</button>
                  ) : (
                    <>
                      <input value={fpToken} onChange={(e) => setFpToken(e.target.value)} placeholder="Reset code" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" />
                      <input type="password" value={fpNewPass} onChange={(e) => setFpNewPass(e.target.value)} placeholder="New password (8+ chars)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none" />
                      <button onClick={submitReset} disabled={loading} className="h-9 w-full rounded-lg bg-[#0a1728] text-xs font-bold text-white disabled:opacity-50">Set new password</button>
                    </>
                  )}
                  {fpMsg && <p className="text-[10px] text-slate-500">{fpMsg}</p>}
                </div>
              )}

              <p className="mt-4 text-center text-[9px] leading-4 text-slate-400">
                By continuing, you agree to the KobeOS terms. Trials begin only when you install an app.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
