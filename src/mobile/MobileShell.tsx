import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Outlet, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ShoppingCart, ClipboardList, Calculator, NotebookPen, Boxes, Receipt, LogOut, User, Loader2, Sparkles, Truck, BedDouble, Landmark,
  Clock, CreditCard, ShieldCheck, X,
} from 'lucide-react';
import { api, clearTokens, setRefreshToken, setToken } from '@/lib/api';
import { ensureSession } from '@/lib/auth';
import { MobileAssistant } from './MobileAssistant';
import { InstallPwaButton } from './InstallPwaButton';

/**
 * Mobile webapp shell. Renders at `/m/*` (typically reached via QR on a
 * store's subdomain, e.g. https://{slug}.kobeapptz.com/m). One sign-in
 * unlocks the whole feature set; persistent bottom-tab nav between them.
 *
 * Designed phone-first: 56px header, 64px bottom nav, single column
 * everywhere, big tap targets, no hover states. Works just as well on
 * an iPad or in a desktop browser.
 */

const TABS: Array<{ to: string; label: string; Icon: typeof ShoppingCart }> = [
  { to: 'pos',       label: 'POS',       Icon: ShoppingCart },
  { to: 'po',        label: 'Purchase',  Icon: ClipboardList },
  { to: 'dispatch',  label: 'Dispatch',  Icon: Truck },
  { to: 'hotel',     label: 'Hotel',     Icon: BedDouble },
  { to: 'lipa',      label: 'Lipa',      Icon: Landmark },
  { to: 'eod',       label: 'Till',      Icon: Calculator },
  { to: 'summary',   label: 'Summary',   Icon: NotebookPen },
  { to: 'inventory', label: 'Stock',     Icon: Boxes },
  { to: 'orders',    label: 'Orders',    Icon: Receipt },
];

export default function MobileShell() {
  const { slug = '' } = useParams<{ slug?: string }>();
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [access, setAccess] = useState<MobileAccessResult | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // One-shot session check on mount — if a JWT is already in
  // localStorage from a previous sign-in (or the desktop OS), pass
  // straight through to the feature shell.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSession();
        if (cancelled) return;
        // ensureSession returns silently when there's no token; verify
        // by calling a cheap protected endpoint.
        await api('/users/me');
        if (!cancelled) setSignedIn(true);
      } catch {
        if (!cancelled) setSignedIn(false);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Make the INSTALLED PWA open the mobile workspace, not the storefront.
  // The static manifest has start_url '/', so installing from here would launch
  // at '/' (the e-commerce store on a tenant subdomain). Swap in a manifest
  // scoped to /m/{slug} while this page is open, so the installed app opens the
  // mobile app.
  useEffect(() => {
    if (!slug) return;
    const startUrl = `/m/${slug}`;
    const manifest = {
      name: `KobeOS Mobile — ${slug}`,
      short_name: 'KobeOS Mobile',
      start_url: startUrl,
      scope: startUrl,
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#0a0a1a',
      theme_color: '#1a1a2e',
      icons: [
        { src: '/icon.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    };
    const href = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`;
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    const prev = link?.getAttribute('href') ?? null;
    if (!link) { link = document.createElement('link'); link.rel = 'manifest'; document.head.appendChild(link); }
    link.setAttribute('href', href);
    return () => { if (prev) link!.setAttribute('href', prev); };
  }, [slug]);

  // Subscription gate — a shop's /m workspace is free for 48h, then requires a
  // monthly PalmPesa subscription. Checked after sign-in. Fails OPEN: a billing
  // hiccup or an older backend without this endpoint must never lock staff out —
  // the paywall only appears when the server explicitly returns access:'expired'.
  const refreshAccess = useCallback(async () => {
    if (!slug) { setAccess(null); setAccessChecked(true); return; }
    try {
      const r = await api<MobileAccessResult>(`/mobile-access?slug=${encodeURIComponent(slug)}`);
      setAccess(r);
    } catch {
      setAccess(null); // fail-open
    } finally {
      setAccessChecked(true);
    }
  }, [slug]);

  useEffect(() => {
    if (!signedIn) return;
    setAccessChecked(false);
    void refreshAccess();
  }, [signedIn, refreshAccess]);

  const signOut = useCallback(() => {
    try {
      clearTokens();
      localStorage.removeItem('access_token');
      localStorage.removeItem('kobe_session_email');
    } catch { /* private mode */ }
    setSignedIn(false);
    setAccess(null);
    setAccessChecked(false);
    navigate(`/m/${slug}`);
  }, [navigate, slug]);

  if (!authChecked) {
    return (
      <div className="h-[100dvh] grid place-items-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!signedIn) {
    return <MobileSignIn slug={slug} onSignedIn={() => setSignedIn(true)} />;
  }

  // Wait for the subscription check before revealing the workspace.
  if (!accessChecked) {
    return (
      <div className="h-[100dvh] grid place-items-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // Trial over + unpaid → hard paywall (blocks the workspace).
  if (access?.access === 'expired') {
    return (
      <MobilePaywall
        slug={slug}
        priceTzs={access.priceTzs}
        onPaid={() => { setShowPaywall(false); void refreshAccess(); }}
        onSignOut={signOut}
      />
    );
  }

  // Still in trial but the user tapped "Subscribe" early → dismissible paywall.
  if (showPaywall && access) {
    return (
      <MobilePaywall
        slug={slug}
        priceTzs={access.priceTzs}
        onPaid={() => { setShowPaywall(false); void refreshAccess(); }}
        dismissible
        onClose={() => setShowPaywall(false)}
      />
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-50 text-slate-900 overflow-hidden" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header className="h-14 px-4 flex items-center justify-between border-b border-slate-200 bg-white">
        <Link to={`/m/${slug}`} className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-extrabold">K</div>
          <div>
            <div className="text-xs font-extrabold text-slate-900 leading-none">KobeOS Mobile</div>
            <div className="text-[10px] text-slate-400 leading-none mt-0.5">{slug || 'store'}.kobeapptz.com</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <InstallPwaButton />
          <button
            onClick={signOut}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold text-slate-500 hover:bg-slate-100"
            aria-label="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />Sign out
          </button>
        </div>
      </header>

      {/* Trial countdown — free for 48h, then the paywall kicks in. Tapping it
          lets the shop subscribe early via PalmPesa. */}
      {access?.access === 'trial' && (
        <button
          onClick={() => setShowPaywall(true)}
          className="w-full bg-amber-50 border-b border-amber-200 text-amber-800 text-[11px] font-bold py-1.5 px-3 flex items-center justify-center gap-1.5 active:bg-amber-100"
        >
          <Clock className="w-3 h-3" />
          Free trial — {access.hoursRemaining}h left · Subscribe for TZS {access.priceTzs.toLocaleString()}/mo
        </button>
      )}

      {/* Active feature */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom tab nav */}
      <nav className="h-16 border-t border-slate-200 bg-white grid grid-cols-9">
        {TABS.map(({ to, label, Icon }) => {
          const path = `/m/${slug}/${to}`;
          const active = location.pathname.startsWith(path);
          return (
            <Link
              key={to}
              to={path}
              className={`flex flex-col items-center justify-center gap-0.5 ${
                active ? 'text-indigo-600' : 'text-slate-500'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? '' : 'opacity-80'}`} />
              <span className="text-[10px] font-bold">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Ask Kobe AI co-pilot — floating, available across the mobile modules */}
      <MobileAssistant />
    </div>
  );
}

/* ─── Sign-in (email + password) ──────────────────────────────────────── */

function MobileSignIn({ slug, onSignedIn }: { slug: string; onSignedIn: () => void }) {
  const [email, setEmail] = useState(() => localStorage.getItem('kobe_session_email') || '');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: { preventDefault?: () => void }) => {
    e.preventDefault?.();
    setErr(null);
    if (!email.trim() || !password) return;
    setSubmitting(true);
    try {
      const res = await api<{
        access_token?: string;
        accessToken?: string;
        refresh_token?: string;
        refreshToken?: string;
      }>('/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const token = res?.accessToken ?? res?.access_token;
      const refresh = res?.refreshToken ?? res?.refresh_token;
      if (!token) throw new Error('No token returned');
      setToken(token);
      if (refresh) setRefreshToken(refresh);
      localStorage.setItem('kobe_session_email', email.trim());
      onSignedIn();
    } catch (e2) {
      setErr((e2 as Error).message || 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-[100dvh] grid place-items-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-6" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-lg p-6 space-y-4">
        <div className="text-center mb-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-base font-extrabold mb-3">K</div>
          <h1 className="text-lg font-extrabold text-slate-900">Sign in to KobeOS</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">{slug ? `${slug}.kobeapptz.com` : 'mobile workspace'}</p>
        </div>

        <label className="block">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Email</span>
          <input
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            className="mt-1 w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-base text-slate-900 focus:outline-none focus:border-indigo-400"
          />
        </label>

        <label className="block">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-base text-slate-900 focus:outline-none focus:border-indigo-400"
          />
        </label>

        {err && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</div>
        )}

        <button
          type="submit"
          disabled={submitting || !email.trim() || !password}
          className="w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-[10px] text-slate-400 text-center pt-2">
          <User className="w-3 h-3 inline -mt-0.5 mr-0.5" />
          Same KobeOS account you use on the desktop
        </p>
      </form>
    </div>
  );
}

/* ─── Landing — shown at /m/:slug (index) ─────────────────────────── */

export function MobileHome() {
  const { slug = '' } = useParams<{ slug?: string }>();
  return (
    <div className="p-5 space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Welcome back</h2>
        <p className="text-xs text-slate-500 mt-0.5">Pick a tool to get started.</p>
      </div>

      {/* Highlighted "from image" tile — a customer just forwarded a
       *  marked WhatsApp photo? Tap here, the seller doesn't have to
       *  type the order by hand. */}
      <Link
        to={`/m/${slug}/image-order`}
        className="block rounded-2xl p-4 bg-gradient-to-br from-violet-600 to-indigo-600 text-white active:opacity-90 shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 grid place-items-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-extrabold">Order from image</div>
            <div className="text-[11px] opacity-80">Forward an annotated WhatsApp photo → POS order</div>
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        {TABS.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={`/m/${slug}/${to}`}
            className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center gap-2 active:bg-slate-50"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center">
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-700">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function MobileFeatureFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="px-4 py-4 space-y-4">
      <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

/* ─── Subscription paywall ────────────────────────────────────────────── */

interface MobileAccessResult {
  slug: string;
  access: 'active' | 'trial' | 'expired';
  priceTzs: number;
  trialEndsAt: number | null;
  periodEndsAt: number | null;
  hoursRemaining: number;
}

/**
 * Blocks (or, in `dismissible` mode, overlays) the mobile workspace once the
 * 48h trial is over. Collects a mobile-money number, fires a PalmPesa USSD
 * push via /mobile-access/subscribe, then polls /status until the payment
 * settles and unlocks the shop for 30 days.
 */
function MobilePaywall({
  slug,
  priceTzs,
  onPaid,
  onSignOut,
  dismissible,
  onClose,
}: {
  slug: string;
  priceTzs: number;
  onPaid: () => void;
  onSignOut?: () => void;
  dismissible?: boolean;
  onClose?: () => void;
}) {
  const [phone, setPhone] = useState(() => localStorage.getItem('kobe_msub_phone') || '');
  const [phase, setPhase] = useState<'idle' | 'pushing' | 'waiting' | 'failed'>('idle');
  const [err, setErr] = useState<string | null>(null);

  const pay = async () => {
    setErr(null);
    if (!/^[+0-9\s-]{9,15}$/.test(phone.trim())) { setErr('Enter a valid phone number.'); return; }
    setPhase('pushing');
    try {
      localStorage.setItem('kobe_msub_phone', phone.trim());
      const res = await api<{ transactionId: string }>('/mobile-access/subscribe', {
        method: 'POST',
        body: JSON.stringify({ slug, msisdn: phone.trim() }),
      });
      setPhase('waiting');
      const tx = res.transactionId;
      let tries = 0;
      const poll = async () => {
        tries += 1;
        try {
          const st = await api<{ status: string }>(`/mobile-access/status/${encodeURIComponent(tx)}`);
          if (st.status === 'active') { onPaid(); return; }
          if (st.status === 'failed') { setPhase('failed'); setErr('Payment failed or was cancelled. Try again.'); return; }
        } catch { /* transient — keep polling */ }
        if (tries >= 30) {
          setPhase('failed');
          setErr('Timed out waiting for payment. If you approved it, tap Retry to refresh.');
          return;
        }
        setTimeout(() => void poll(), 4000);
      };
      setTimeout(() => void poll(), 4000);
    } catch (e) {
      setPhase('failed');
      setErr((e as Error).message || 'Could not start the payment.');
    }
  };

  return (
    <div className="h-[100dvh] grid place-items-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-6" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-lg p-6 space-y-4 relative">
        {dismissible && (
          <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center text-white mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-extrabold text-slate-900">
            {dismissible ? 'Subscribe early' : 'Your free access has ended'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {dismissible
              ? `Lock in the ${slug} mobile workspace before your trial runs out.`
              : `The ${slug} mobile workspace was free for 48 hours. Subscribe to keep using it.`}
          </p>
        </div>

        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-center">
          <div className="text-2xl font-black text-indigo-700">TZS {priceTzs.toLocaleString()}</div>
          <div className="text-[11px] text-indigo-500 font-bold">per month · paid with PalmPesa</div>
        </div>

        {phase === 'waiting' ? (
          <div className="text-center space-y-2 py-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto" />
            <p className="text-xs text-slate-600 font-medium">Check your phone — approve the PalmPesa prompt to pay.</p>
            <p className="text-[10px] text-slate-400">Unlocking automatically once payment is confirmed…</p>
          </div>
        ) : (
          <>
            <label className="block">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Mobile-money number</span>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XX XXX XXX"
                className="mt-1 w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-base text-slate-900 focus:outline-none focus:border-indigo-400"
              />
            </label>
            {err && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</div>}
            <button
              onClick={pay}
              disabled={phase === 'pushing'}
              className="w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2"
            >
              {phase === 'pushing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              {phase === 'pushing' ? 'Starting…' : phase === 'failed' ? 'Retry payment' : `Pay TZS ${priceTzs.toLocaleString()}`}
            </button>
          </>
        )}

        {onSignOut && (
          <button onClick={onSignOut} className="w-full text-[11px] text-slate-400 hover:text-slate-600 font-bold pt-1">
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
