import { useEffect, useRef, useState } from 'react';
import { api, apiBase, accountApiBase, cloudApi, hasCloudSession } from '@/lib/api';

type Platform = 'instagram' | 'tiktok';
type Connection = { platform: string; connected: boolean; accountHandle: string; webhookSubscribed?: boolean; connectedAt?: string | null };
const accountCall = <T,>(path: string) => accountApiBase() !== apiBase() && hasCloudSession()
  ? cloudApi<T>(path) : api<T>(path, { offlineFallback: false });

/** Keep the shop open while the provider handles its own sign-in and consent. */
export function SocialConnectDialog({ platform, onClose, onConnected }: {
  platform: Platform; onClose: () => void; onConnected: () => void;
}) {
  const name = platform === 'instagram' ? 'Instagram' : 'TikTok';
  const popup = useRef<Window | null>(null);
  const running = useRef(false);
  const baseline = useRef<Connection[]>([]);
  const [phase, setPhase] = useState<'ready' | 'waiting' | 'connected'>('ready');
  const [account, setAccount] = useState<Connection | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [opening, setOpening] = useState(false);
  const [elapsed, setElapsed] = useState(false);
  const notified = useRef(false);
  const active = useRef(true);
  const check = async () => {
    if (running.current) return;
    running.current = true; setChecking(true);
    try {
      const accounts = await accountCall<Connection[]>('/live-sales/connections');
      if (!active.current) return;
      const connected = accounts.find(item => item.platform === platform && item.connected && !baseline.current.some(old =>
        old.platform === platform && old.connected && old.accountHandle === item.accountHandle && old.connectedAt === item.connectedAt));
      if (connected) {
        setAccount(connected); setPhase('connected'); setError('');
        popup.current?.close(); popup.current = null;
        if (!notified.current) { notified.current = true; onConnected(); }
      }
    } catch { if (active.current) setError('We could not check your connection. Try checking again.'); }
    finally { running.current = false; if (active.current) setChecking(false); }
  };
  useEffect(() => {
    active.current = true;
    const previousFocus = document.activeElement;
    return () => {
      active.current = false; popup.current?.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);
  useEffect(() => {
    if (phase !== 'waiting') return;
    // Server confirmation is authoritative; a closed popup is not a successful connection.
    const timer = window.setInterval(() => { void check(); }, 3000);
    const deadline = window.setTimeout(() => { clearInterval(timer); setElapsed(true); }, 120000);
    const focus = () => { void check(); };
    window.addEventListener('focus', focus);
    return () => { clearInterval(timer); clearTimeout(deadline); window.removeEventListener('focus', focus); };
    // Restart only when the connection phase changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  const connect = async () => {
    setError(''); setElapsed(false);
    // Open during the click so popup blockers do not discard the authorization window.
    const windowRef = window.open('about:blank', '_blank', 'popup,width=520,height=760');
    if (!windowRef) { setError('Allow the connection window in your browser, then try again. Your shop will stay open.'); return; }
    popup.current?.close(); popup.current = windowRef;
    windowRef.opener = null;
    setOpening(true);
    try {
      baseline.current = await accountCall<Connection[]>('/live-sales/connections');
      const { url } = await accountCall<{ url: string }>(platform === 'instagram' ? '/live-sales/instagram/oauth/url' : '/social-scheduler/tiktok/oauth/url');
      const target = new URL(url);
      const hosts = platform === 'instagram' ? ['www.instagram.com', 'instagram.com'] : ['www.tiktok.com', 'tiktok.com'];
      if (target.protocol !== 'https:' || !hosts.includes(target.hostname)) throw new Error('The connection service returned an unexpected address.');
      if (!active.current) { windowRef.close(); return; }
      windowRef.location.href = target.href;
      setPhase('waiting');
    } catch {
      windowRef.close(); popup.current = null;
      if (active.current) { setPhase('ready'); setError(`${name} connection is temporarily unavailable. Your shop is saved. Please try again later.`); }
    } finally { if (active.current) setOpening(false); }
  };
  return <div className="fixed inset-0 z-[120] grid place-items-center overflow-auto bg-black/70 p-4" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="social-connect-title" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled)')];
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} className="w-full max-w-lg space-y-5 rounded-2xl border border-slate-700 bg-slate-950 p-6 text-white shadow-2xl">
      <header className="flex items-center justify-between gap-4"><h2 id="social-connect-title" className="text-xl font-bold">Connect {name}</h2><button autoFocus onClick={onClose} aria-label="Close connection setup" className="rounded border border-slate-600 px-3 py-1">×</button></header>
      <ol aria-label="Connection progress" className="flex justify-between gap-3 text-sm text-slate-300"><li>1. Choose account</li><li>2. Approve access</li><li className={phase === 'connected' ? 'text-emerald-300' : ''}>3. Ready</li></ol>
      {phase === 'connected' ? <><p role="status" className="rounded-xl bg-emerald-950 p-4 text-emerald-200">Connected to {account?.accountHandle || name}</p><p className="text-sm text-slate-300">{platform === 'instagram' && !account?.webhookSubscribed ? 'Your account is connected. Live comments are still awaiting Instagram approval; your store video can be used separately.' : 'Your account is saved. You can continue setting up your live shop.'}</p><button onClick={onClose} className="w-full rounded-xl bg-violet-600 p-3 font-semibold">Continue to my shop</button></>
        : <><p className="text-sm text-slate-300">Your shop stays open. {name} opens a secure permission window, then we check the connection automatically.</p>
          {platform === 'instagram' && <p className="rounded-xl bg-slate-900 p-3 text-sm text-slate-300">Use a professional Instagram account. Instagram can help you switch during connection.</p>}
          {phase === 'waiting' && <p role="status" className="rounded-xl bg-violet-950 p-4 text-sm text-violet-200">{elapsed ? `Still waiting for ${name}. Finish approval in its window, or try again if you cancelled.` : `Waiting for ${name} approval… Your setup is saved here.`}</p>}
          {error && <p role="alert" className="rounded-xl bg-amber-950 p-3 text-sm text-amber-200">{error}</p>}
          <button disabled={opening} onClick={() => void connect()} className="w-full rounded-xl bg-violet-600 p-3 font-semibold disabled:opacity-50">{opening ? 'Opening secure connection…' : phase === 'waiting' ? 'Open connection again' : `Continue with ${name}`}</button>
          {phase === 'waiting' && <button disabled={checking} onClick={() => void check()} className="w-full rounded-xl border border-slate-600 p-3 disabled:opacity-50">{checking ? 'Checking…' : 'I approved — check connection'}</button>}
          <p className="text-xs text-slate-400">Connecting an account does not start a broadcast. Going LIVE on {name} requires access from {name}.</p></>}
    </section>
  </div>;
}
