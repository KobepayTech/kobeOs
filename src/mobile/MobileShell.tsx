import { useEffect, useState, type ReactNode } from 'react';
import { Outlet, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ShoppingCart, ClipboardList, Calculator, NotebookPen, Boxes, Receipt, LogOut, User, Loader2, Sparkles, Truck, BedDouble,
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
  { to: 'eod',       label: 'Till',      Icon: Calculator },
  { to: 'summary',   label: 'Summary',   Icon: NotebookPen },
  { to: 'inventory', label: 'Stock',     Icon: Boxes },
  { to: 'orders',    label: 'Orders',    Icon: Receipt },
];

export default function MobileShell() {
  const { slug = '' } = useParams<{ slug?: string }>();
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
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
            onClick={() => {
              try {
                clearTokens();
                localStorage.removeItem('access_token');
                localStorage.removeItem('kobe_session_email');
              } catch { /* private mode */ }
              setSignedIn(false);
              navigate(`/m/${slug}`);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold text-slate-500 hover:bg-slate-100"
            aria-label="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />Sign out
          </button>
        </div>
      </header>

      {/* Active feature */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom tab nav */}
      <nav className="h-16 border-t border-slate-200 bg-white grid grid-cols-8">
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
