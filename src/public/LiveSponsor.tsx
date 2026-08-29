import { useEffect, useMemo, useState } from 'react';
import { Loader2, Radio, ShieldCheck, Sparkles, Ticket } from 'lucide-react';
import { publicApi, publicApiBase } from './api';

/**
 * The permanent-link landing page (kobe.live/@handle) and the slot QR
 * (kobe.live/a/<code>). It never redirects blindly: it opens a fast Kobe page
 * showing the *current* sponsor and a VIEW OFFER button that records the click,
 * then bounces to the server-side approved destination — so a viewer who
 * responded to Coca-Cola never lands on the sponsor that took over 3s later.
 * DIRECT_REDIRECT campaigns forward immediately.
 */

type CreatorPage = { live: boolean; mode: 'CREATOR_PAGE'; creator: { handle: string; name: string; avatar: string | null } };
type SponsorPage = { live: true; mode: 'SPONSOR_PAGE'; clickVisitId: string; sponsor: { name: string; offerText: string; couponCode: string | null; expiresAt: string }; ctaUrl: string; creator: { handle: string; name: string } };
type DirectPage = { live: true; mode: 'DIRECT_REDIRECT'; clickVisitId: string; redirect: string };
type Resolved = CreatorPage | SponsorPage | DirectPage;

const goUrl = (path: string) => `${publicApiBase()}${path}`;

export default function LiveSponsor({ handle, code }: { handle?: string; code?: string }) {
  const [data, setData] = useState<Resolved | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const path = code ? `/live/a/${encodeURIComponent(code)}` : `/live/resolve/${encodeURIComponent(handle || '')}`;
        const res = await publicApi<Resolved>(path);
        if (!alive) return;
        if (res.mode === 'DIRECT_REDIRECT') { window.location.assign(goUrl(res.redirect)); return; }
        setData(res);
      } catch (e) { if (alive) setError((e as Error).message || 'This link is unavailable.'); }
    })();
    return () => { alive = false; };
  }, [handle, code]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const countdown = useMemo(() => {
    if (!data || data.mode !== 'SPONSOR_PAGE') return '';
    const left = Math.max(0, Math.floor((new Date(data.sponsor.expiresAt).getTime() - now) / 1000));
    const m = Math.floor(left / 60); const s = left % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, [data, now]);

  if (error) return <Shell><div className="text-rose-300 text-sm">{error}</div></Shell>;
  if (!data) return <Shell><Loader2 className="h-6 w-6 animate-spin text-white/60" /></Shell>;

  if (data.mode === 'CREATOR_PAGE') {
    return (
      <Shell>
        <div className="text-center space-y-4">
          {data.creator.avatar
            ? <img src={data.creator.avatar} alt={data.creator.name} className="mx-auto h-20 w-20 rounded-full object-cover" />
            : <div className="mx-auto h-20 w-20 rounded-full bg-white/10 grid place-items-center text-2xl font-black">{data.creator.name.slice(0, 1).toUpperCase()}</div>}
          <div>
            <div className="text-xl font-black">{data.creator.name}</div>
            <div className="text-sm text-white/50">@{data.creator.handle}</div>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${data.live ? 'bg-rose-500/20 text-rose-300' : 'bg-white/10 text-white/50'}`}>
            <Radio className="h-3.5 w-3.5" /> {data.live ? 'LIVE now' : 'Offline'}
          </div>
          {data.live && <p className="text-xs text-white/45">No active sponsor right now — check back in a moment.</p>}
        </div>
      </Shell>
    );
  }

  // DIRECT_REDIRECT is handled in the effect (we navigate away), so anything
  // left here is a SPONSOR_PAGE — narrow the union explicitly for the compiler.
  if (data.mode !== 'SPONSOR_PAGE') return <Shell><Loader2 className="h-6 w-6 animate-spin text-white/60" /></Shell>;

  return (
    <Shell>
      <div className="w-full space-y-5 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-black text-rose-300">
          <Radio className="h-3.5 w-3.5" /> {data.creator.name.toUpperCase()} IS LIVE
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 space-y-4">
          <div className="text-[11px] uppercase tracking-[0.25em] text-white/40">Sponsored by</div>
          <div className="text-3xl font-black">{data.sponsor.name}</div>
          {data.sponsor.offerText && <p className="text-sm text-white/70 inline-flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-amber-300" />{data.sponsor.offerText}</p>}
          {data.sponsor.couponCode && (
            <div className="mx-auto inline-flex items-center gap-2 rounded-xl border border-dashed border-amber-400/40 bg-amber-400/10 px-4 py-2 text-amber-200 font-black tracking-wider">
              <Ticket className="h-4 w-4" /> {data.sponsor.couponCode}
            </div>
          )}
          {countdown && <div className="text-xs text-white/45">Offer expires in {countdown}</div>}
          <a href={goUrl(data.ctaUrl)} className="block w-full h-12 leading-[48px] rounded-xl bg-white text-black font-black">VIEW OFFER →</a>
        </div>
        <p className="text-[11px] text-white/35 inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Sponsored during {data.creator.name}'s LIVE · verified by Kobe</p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#0b0b16] text-white grid place-items-center px-5 py-10">
      <div className="w-full max-w-sm grid place-items-center">{children}</div>
    </div>
  );
}
