import { useCallback, useEffect, useState } from 'react';
import { Copy, Radio, ShieldCheck, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Kobe Live Ads control panel (creator + advertiser + admin). Web-first — the
 * creator gets their permanent link + OBS overlay URL, goes live, and sees their
 * scorecard; advertisers build server-side destinations + campaigns; admins
 * approve or emergency-stop.
 */

interface CreatorLite { id: string; name: string; handle: string }
interface Identity { creatorId: string; handle: string; permanentUrl: string; overlayUrl: string; overlayToken: string }
interface Destination { id: string; url: string; domain: string; status: string }
interface Campaign { id: string; title: string; sponsorName: string; status: string; destinationId: string; routingMode: string }
interface Stats { handle: string; slots: number; impressions: number; profileVisits: number; sponsorViews: number; ctaClicks: number; advertiserVisits: number; conversions: number; attributedRevenue: number; grossAdSpend: number; creatorEarnings: number; currency: string }

const liveOrigin = window.location.hostname === 'kobe.live' ? 'https://kobe.live' : `${window.location.origin}/kobelive`;
const copy = (t: string) => { try { void navigator.clipboard.writeText(t); } catch { /* ignore */ } };

export default function LiveAdsPanel({ creators }: { creators: CreatorLite[] }) {
  const [creatorId, setCreatorId] = useState(creators[0]?.id ?? '');
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [dests, setDests] = useState<Destination[]>([]);
  const [camps, setCamps] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(''); setMsg(''); try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };

  const loadAdvertiser = useCallback(async () => {
    const [d, c] = await Promise.all([
      api<Destination[]>('/live-ads/destinations').catch(() => []),
      api<Campaign[]>('/live-ads/campaigns/mine').catch(() => [] as Campaign[]),
    ]);
    setDests(Array.isArray(d) ? d : []); setCamps(Array.isArray(c) ? c : []);
  }, []);
  useEffect(() => { void loadAdvertiser(); }, [loadAdvertiser]);
  useEffect(() => { setIdentity(null); setStats(null); }, [creatorId]);

  const [pairCode, setPairCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const ensure = () => run(async () => { setIdentity(await api<Identity>('/live-ads/identity', { method: 'POST', body: JSON.stringify({ creatorId }) })); setMsg('Kobe Live link ready.'); });
  const makePairCode = () => run(async () => { setPairCode(await api<{ code: string; expiresAt: string }>(`/live-ads/creators/${creatorId}/pair-code`, { method: 'POST', body: JSON.stringify({}) })); });
  const goLive = () => run(async () => { await api('/live-ads/sessions/start', { method: 'POST', body: JSON.stringify({ creatorId }) }); setMsg('You are LIVE on Kobe.'); });
  const endLive = () => run(async () => { await api('/live-ads/sessions/end', { method: 'POST', body: JSON.stringify({ creatorId }) }); setMsg('Session ended.'); });
  const refreshStats = () => run(async () => { setStats(await api<Stats>(`/live-ads/creators/${creatorId}/stats`)); });

  const [dUrl, setDUrl] = useState('');
  const addDest = () => run(async () => { await api('/live-ads/destinations', { method: 'POST', body: JSON.stringify({ url: dUrl.trim() }) }); setDUrl(''); await loadAdvertiser(); });

  const [form, setForm] = useState({ title: '', sponsorName: '', destinationId: '', offerText: '', couponCode: '', pricePerSlot: '50000', costPerClick: '200', creativeFormat: 'CARD', creativeVideoUrl: '' });
  const createCampaign = () => run(async () => {
    await api('/live-ads/campaigns', { method: 'POST', body: JSON.stringify({ ...form, pricePerSlot: Number(form.pricePerSlot) || 0, costPerClick: Number(form.costPerClick) || 0 }) });
    setForm({ ...form, title: '', sponsorName: '', offerText: '', couponCode: '', creativeVideoUrl: '' }); await loadAdvertiser(); setMsg('Campaign created (Draft).');
  });

  // Auto-delivery rotation: while live, Kobe rotates these approved sponsors.
  const [rot, setRot] = useState({ campaignIds: [] as string[], everySeconds: '300', playbackSeconds: '10', active: true });
  const toggleRotCampaign = (id: string) => setRot((r) => ({ ...r, campaignIds: r.campaignIds.includes(id) ? r.campaignIds.filter((x) => x !== id) : [...r.campaignIds, id] }));
  const saveRotation = () => run(async () => {
    await api(`/live-ads/creators/${creatorId}/rotation`, { method: 'POST', body: JSON.stringify({ campaignIds: rot.campaignIds, everySeconds: Number(rot.everySeconds) || 300, playbackSeconds: Number(rot.playbackSeconds) || 10, active: rot.active }) });
    setMsg('Auto-delivery saved — ads will rotate while you are live.');
  });
  const act = (id: string, path: string, label: string) => run(async () => { await api(`/live-ads/campaigns/${id}/${path}`, { method: 'POST', body: JSON.stringify({}) }); await loadAdvertiser(); setMsg(label); });
  const startSlot = (campaignId: string) => run(async () => { const r = await api<{ qr: string }>('/live-ads/slots', { method: 'POST', body: JSON.stringify({ creatorId, campaignId, playbackSeconds: 10, ctaSeconds: 900 }) }); setMsg(`Sponsor live · QR ${liveOrigin}${r.qr}`); });

  const box = 'rounded-2xl border border-white/10 bg-white/[0.03] p-4';
  const input = 'w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white';
  const btn = 'rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-40';

  return (
    <div className="space-y-4 p-1 text-white">
      <div className="flex items-center gap-2"><Radio className="h-5 w-5 text-rose-400" /><h2 className="text-lg font-black">Kobe Live Ads</h2></div>
      {(msg || err) && <div className={`rounded-lg px-3 py-2 text-xs ${err ? 'bg-rose-500/15 text-rose-200' : 'bg-emerald-500/15 text-emerald-200'}`}>{err || msg}</div>}

      <div className={box}>
        <div className="text-xs font-bold text-slate-300 mb-2">Creator</div>
        <select value={creatorId} onChange={(e) => setCreatorId(e.target.value)} className={input}>
          {creators.map((c) => <option key={c.id} value={c.id}>{c.name} (@{c.handle})</option>)}
        </select>
        {!identity ? (
          <button disabled={busy || !creatorId} onClick={ensure} className={`${btn} mt-3 bg-white text-black`}>Create my Kobe Live link</button>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            <Field label="Permanent link (put in TikTok bio ONCE)" value={`${liveOrigin}${identity.permanentUrl}`} />
            <Field label="OBS overlay browser source (add once)" value={`${liveOrigin}${identity.overlayUrl}`} />
            <div className="flex flex-wrap gap-2 pt-1">
              <button disabled={busy} onClick={goLive} className={`${btn} bg-rose-500 text-white`}>Go LIVE</button>
              <button disabled={busy} onClick={endLive} className={`${btn} bg-white/10 text-white`}>End</button>
              <button disabled={busy} onClick={refreshStats} className={`${btn} bg-white/10 text-white`}>Refresh stats</button>
              <button disabled={busy} onClick={makePairCode} className={`${btn} bg-white/10 text-white`}>Pair Android app</button>
            </div>
            {pairCode && <div className="mt-2 rounded-lg bg-black/30 px-3 py-2 text-center"><div className="text-[10px] text-slate-400">Enter this code in the Kobe Live Ads Android app</div><div className="text-2xl font-black tracking-[0.3em]">{pairCode.code}</div><div className="text-[10px] text-slate-500">expires {new Date(pairCode.expiresAt).toLocaleTimeString()}</div></div>}
          </div>
        )}
      </div>

      {stats && (
        <div className={box}>
          <div className="text-xs font-bold text-slate-300 mb-2">Scorecard · @{stats.handle}</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {([['Impressions', stats.impressions], ['Profile visits', stats.profileVisits], ['Sponsor views', stats.sponsorViews], ['CTA clicks', stats.ctaClicks], ['Advertiser visits', stats.advertiserVisits], ['Conversions', stats.conversions]] as const).map(([l, v]) => (
              <div key={l} className="rounded-lg bg-black/20 p-2"><div className="text-lg font-black">{v}</div><div className="text-[10px] text-slate-400">{l}</div></div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-black/20 p-2"><div className="text-lg font-black">{stats.conversions}</div><div className="text-[10px] text-slate-400">Sales</div></div>
            <div className="rounded-lg bg-black/20 p-2"><div className="text-lg font-black">{stats.currency} {Number(stats.attributedRevenue).toLocaleString()}</div><div className="text-[10px] text-slate-400">Sponsor sales value</div></div>
          </div>
          <div className="mt-2 text-sm font-bold text-emerald-300">Your earnings: {stats.currency} {Number(stats.creatorEarnings).toLocaleString()} <span className="text-slate-400 font-normal">(of {stats.currency} {Number(stats.grossAdSpend).toLocaleString()} ad spend)</span></div>
        </div>
      )}

      <div className={box}>
        <div className="text-xs font-bold text-slate-300 mb-2">Advertiser · approved destinations (server-side, HTTPS)</div>
        <div className="flex gap-2"><input value={dUrl} onChange={(e) => setDUrl(e.target.value)} placeholder="https://sponsor.co.tz/offer" className={input} /><button disabled={busy || !dUrl.trim()} onClick={addDest} className={`${btn} bg-white text-black whitespace-nowrap`}>Add</button></div>
        <div className="mt-2 space-y-1">{dests.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-1.5 text-xs">
            <span className="truncate">{d.domain} · <span className={d.status === 'ACTIVE' ? 'text-emerald-300' : 'text-rose-300'}>{d.status}</span></span>
            <button disabled={busy} onClick={() => run(async () => { await api(`/live-ads/destinations/${d.id}/${d.status === 'ACTIVE' ? 'disable' : 'enable'}`, { method: 'POST', body: JSON.stringify({}) }); await loadAdvertiser(); })} className="rounded bg-white/10 px-2 py-0.5 font-bold">{d.status === 'ACTIVE' ? 'Disable' : 'Enable'}</button>
          </div>
        ))}</div>
      </div>

      <div className={box}>
        <div className="text-xs font-bold text-slate-300 mb-2">Advertiser · campaign</div>
        <div className="grid grid-cols-2 gap-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Campaign title" className={input} />
          <input value={form.sponsorName} onChange={(e) => setForm({ ...form, sponsorName: e.target.value })} placeholder="Sponsor name" className={input} />
          <select value={form.destinationId} onChange={(e) => setForm({ ...form, destinationId: e.target.value })} className={input}><option value="">Destination…</option>{dests.map((d) => <option key={d.id} value={d.id}>{d.domain}</option>)}</select>
          <input value={form.couponCode} onChange={(e) => setForm({ ...form, couponCode: e.target.value })} placeholder="Coupon (e.g. MARIAM20)" className={input} />
          <input value={form.offerText} onChange={(e) => setForm({ ...form, offerText: e.target.value })} placeholder="Offer text" className={`${input} col-span-2`} />
          <select value={form.creativeFormat} onChange={(e) => setForm({ ...form, creativeFormat: e.target.value })} className={input}>
            <option value="CARD">Format: Card</option><option value="BANNER">Format: Banner</option><option value="FULLSCREEN">Format: Full-screen</option><option value="VIDEO">Format: Video</option>
          </select>
          {form.creativeFormat === 'VIDEO'
            ? <input value={form.creativeVideoUrl} onChange={(e) => setForm({ ...form, creativeVideoUrl: e.target.value })} placeholder="https://…/ad.mp4" className={input} />
            : <div />}
          <input value={form.pricePerSlot} onChange={(e) => setForm({ ...form, pricePerSlot: e.target.value })} placeholder="Price/slot" className={input} />
          <input value={form.costPerClick} onChange={(e) => setForm({ ...form, costPerClick: e.target.value })} placeholder="Cost/click" className={input} />
        </div>
        <button disabled={busy || !form.title || !form.sponsorName || !form.destinationId} onClick={createCampaign} className={`${btn} mt-2 bg-white text-black`}>Create campaign</button>

        <div className="mt-3 space-y-1.5">
          {camps.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-xs">
              <span className="font-bold">{c.sponsorName}</span>
              <span className="rounded bg-white/10 px-1.5 py-0.5">{c.status}</span>
              {c.status === 'DRAFT' && <button disabled={busy} onClick={() => act(c.id, 'submit', 'Submitted for approval.')} className={`${btn} bg-amber-500/80 text-black`}>Submit</button>}
              {c.status === 'PENDING_APPROVAL' && <button disabled={busy} onClick={() => act(c.id, 'approve', 'Approved.')} className={`${btn} bg-emerald-500/80 text-black`} title="Admin only">Approve (admin)</button>}
              {c.status === 'APPROVED' && <button disabled={busy || !identity} onClick={() => startSlot(c.id)} className={`${btn} bg-rose-500 text-white`}>Start sponsor slot</button>}
              {c.status === 'APPROVED' && <button disabled={busy} onClick={() => act(c.id, 'emergency-stop', 'Emergency stopped.')} className={`${btn} bg-white/10 text-white`} title="Admin only">Emergency stop</button>}
            </div>
          ))}
          {!camps.length && <div className="text-xs text-slate-500">No campaigns yet.</div>}
        </div>
      </div>

      <div className={box}>
        <div className="text-xs font-bold text-slate-300 mb-2">Auto-delivery · rotate sponsors while you're live</div>
        <div className="space-y-1">
          {camps.filter((c) => c.status === 'APPROVED').map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={rot.campaignIds.includes(c.id)} onChange={() => toggleRotCampaign(c.id)} />
              {c.sponsorName} <span className="text-slate-500">({c.routingMode})</span>
            </label>
          ))}
          {!camps.some((c) => c.status === 'APPROVED') && <div className="text-xs text-slate-500">Approve a campaign to add it to the rotation.</div>}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="text-slate-400">Every</span>
          <input value={rot.everySeconds} onChange={(e) => setRot({ ...rot, everySeconds: e.target.value })} className={`${input} w-20`} /> <span className="text-slate-400">sec · play</span>
          <input value={rot.playbackSeconds} onChange={(e) => setRot({ ...rot, playbackSeconds: e.target.value })} className={`${input} w-16`} /> <span className="text-slate-400">sec</span>
          <label className="ml-auto flex items-center gap-1"><input type="checkbox" checked={rot.active} onChange={(e) => setRot({ ...rot, active: e.target.checked })} /> Active</label>
          <button disabled={busy} onClick={saveRotation} className={`${btn} bg-white text-black`}>Save</button>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><ShieldCheck className="h-3.5 w-3.5" /> Destinations are stored server-side and admin-approved. Ads are clearly badged "Sponsored" — never a spoof of a real app. The bio link never changes; the sponsor behind it does.</p>
      {busy && <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> working…</div>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg bg-black/30 px-2 py-1.5 text-xs">{value}</code>
        <button onClick={() => copy(value)} className="rounded-lg bg-white/10 p-1.5"><Copy className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}
