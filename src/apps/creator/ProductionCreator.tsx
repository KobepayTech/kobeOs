import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle, BarChart3, CheckCircle2, Globe2, Handshake, LayoutDashboard,
  Loader2, Megaphone, RefreshCw, Search, Send, ShieldCheck, Star, Users, Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SocialScheduler } from './SocialScheduler';
import { CreatorOnboarding } from './CreatorOnboarding';

type View = 'overview' | 'marketplace' | 'campaigns' | 'escrow' | 'profile' | 'social';

type PlatformStats = {
  platform: string;
  handle: string;
  followers: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  engagementRate: number;
  totalPosts: number;
  bestPostViews: number;
  lastSyncedAt: string;
};

interface CreatorRow {
  id: string;
  name: string;
  handle: string;
  niche: string;
  country: string;
  followers: number;
  engagement: number;
  avgViews: number;
  avatarUrl?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  bio?: string | null;
  platforms: string[];
  platformStats?: PlatformStats[];
  verified: boolean;
  weeklyRateTzs: number | string;
  subscriptionTier: 'free' | 'basic' | 'premium' | 'elite';
  fraudSignals?: { fraudScore?: number } | null;
  lastSyncedAt?: string | null;
}

interface CampaignRequirement {
  platform: 'tiktok' | 'instagram' | 'youtube';
  contentType: 'video' | 'reel' | 'story' | 'post';
  minViews: number;
  minLikes?: number;
  deadline: string;
  description?: string;
}

interface CampaignOffer {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  amountTzs: number | string;
  status: string;
  proofUrls: string[];
  verifiedViews?: number;
  verifiedLikes?: number;
  notes?: string;
  sentAt: string;
}

interface CampaignRow {
  id: string;
  name: string;
  description: string;
  brand: string;
  niche: string;
  status: string;
  budgetTzs: number | string;
  platformFeePercent: number;
  requirements: CampaignRequirement[];
  offers: CampaignOffer[];
  endsAt?: string | null;
  escrowId?: string | null;
  createdAt: string;
}

interface EscrowRow {
  id: string;
  campaignId: string;
  offerId: string;
  amountTzs: number | string;
  feeTzs: number | string;
  netAmountTzs: number | string;
  status: 'held' | 'released' | 'refunded' | 'disputed';
  createdAt: string;
  releasedAt?: string | null;
  refundedAt?: string | null;
}

interface SocialAccountSafe {
  id: string;
  platform: string;
  status: string;
}

const money = (value: number | string) => `TZS ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmt = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1_000 ? `${(value / 1_000).toFixed(0)}K` : String(value || 0);
const statusTone = (status: string) => {
  if (['open', 'active', 'in_progress', 'published', 'released', 'completed', 'verified', 'paid'].includes(status)) return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  if (['cancelled', 'failed', 'refunded', 'disputed', 'declined'].includes(status)) return 'bg-red-500/10 text-red-300 border-red-500/20';
  return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
};

function Status({ value }: { value: string }) {
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusTone(value)}`}>{value.replace(/_/g, ' ')}</span>;
}

function Empty({ title, body }: { title: string; body: string }) {
  return <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center"><div className="text-sm font-semibold text-slate-300">{title}</div><div className="mt-1 text-xs text-slate-500">{body}</div></div>;
}

export default function ProductionCreator() {
  const [view, setView] = useState<View>('overview');
  const [marketplace, setMarketplace] = useState<CreatorRow[]>([]);
  const [mine, setMine] = useState<CreatorRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [brandEscrow, setBrandEscrow] = useState<EscrowRow[]>([]);
  const [creatorEscrow, setCreatorEscrow] = useState<EscrowRow[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountSafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((x) => x + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true); setError(null);
      const requests = await Promise.allSettled([
        api<CreatorRow[]>('/creators/marketplace'),
        api<CreatorRow[]>('/creators'),
        api<CampaignRow[]>('/creators/campaigns/mine'),
        api<EscrowRow[]>('/creators/escrow/mine'),
        api<EscrowRow[]>('/creators/escrow/creator'),
        api<SocialAccountSafe[]>('/social-scheduler/accounts'),
      ]);
      if (cancelled) return;
      const [market, own, camp, brandFunds, creatorFunds, accounts] = requests;
      if (market.status === 'fulfilled') setMarketplace(Array.isArray(market.value) ? market.value : []);
      if (own.status === 'fulfilled') setMine(Array.isArray(own.value) ? own.value : []);
      if (camp.status === 'fulfilled') setCampaigns(Array.isArray(camp.value) ? camp.value : []);
      if (brandFunds.status === 'fulfilled') setBrandEscrow(Array.isArray(brandFunds.value) ? brandFunds.value : []);
      if (creatorFunds.status === 'fulfilled') setCreatorEscrow(Array.isArray(creatorFunds.value) ? creatorFunds.value : []);
      if (accounts.status === 'fulfilled') setSocialAccounts(Array.isArray(accounts.value) ? accounts.value : []);
      const failed = requests.filter((result) => result.status === 'rejected');
      if (failed.length === requests.length) setError('Creator services are unavailable. No demo data has been substituted.');
      else if (failed.length) setError(`${failed.length} Creator data source${failed.length === 1 ? '' : 's'} could not be loaded. The available sections still show live data only.`);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tick]);

  const nav: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'marketplace', label: 'Marketplace', icon: Globe2 },
    { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { id: 'escrow', label: 'Deals & Escrow', icon: Wallet },
    { id: 'profile', label: 'Creator Profile', icon: Star },
    { id: 'social', label: 'Social Publishing', icon: Send },
  ];

  return (
    <div className="flex h-full min-h-0 bg-[#0a0a16] text-white">
      <aside className="w-60 shrink-0 overflow-y-auto border-r border-white/[0.06] bg-[#0c0c18] p-3">
        <div className="mb-4 flex items-center gap-2 px-2 py-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/15"><Users className="h-4 w-4 text-violet-300" /></div><div><div className="text-sm font-black tracking-wide">KOBE CREATORS</div><div className="text-[10px] text-slate-500">Production workspace</div></div></div>
        <div className="space-y-1">{nav.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setView(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${view === id ? 'bg-violet-500/15 text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
        <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-[11px] text-slate-500">No seeded creators, fake campaigns, fake messages, fake affiliate revenue, or simulated publishing is used in this workspace.</div>
      </aside>
      <main className="min-w-0 flex-1 overflow-hidden">
        {view === 'overview' && <Overview creators={marketplace} mine={mine} campaigns={campaigns} brandEscrow={brandEscrow} creatorEscrow={creatorEscrow} socialAccounts={socialAccounts} loading={loading} error={error} onRefresh={reload} onGo={setView} />}
        {view === 'marketplace' && <Marketplace creators={marketplace} campaigns={campaigns} loading={loading} onRefresh={reload} />}
        {view === 'campaigns' && <Campaigns rows={campaigns} creators={marketplace} loading={loading} onRefresh={reload} />}
        {view === 'escrow' && <Escrow brandRows={brandEscrow} creatorRows={creatorEscrow} loading={loading} onRefresh={reload} />}
        {view === 'profile' && <Profiles rows={mine} loading={loading} onRefresh={reload} />}
        {view === 'social' && <SocialScheduler />}
      </main>
    </div>
  );
}

function Overview(props: {
  creators: CreatorRow[]; mine: CreatorRow[]; campaigns: CampaignRow[]; brandEscrow: EscrowRow[]; creatorEscrow: EscrowRow[];
  socialAccounts: SocialAccountSafe[]; loading: boolean; error: string | null; onRefresh: () => void; onGo: (view: View) => void;
}) {
  const activeCampaigns = props.campaigns.filter((c) => ['open', 'in_progress', 'verifying'].includes(c.status));
  const held = props.brandEscrow.filter((row) => row.status === 'held').reduce((sum, row) => sum + Number(row.amountTzs || 0), 0);
  const creatorReleased = props.creatorEscrow.filter((row) => row.status === 'released').reduce((sum, row) => sum + Number(row.netAmountTzs || 0), 0);
  return <div className="h-full overflow-y-auto p-6"><div className="mx-auto max-w-7xl space-y-5">
    <div className="flex items-center justify-between"><div><h1 className="text-xl font-black">Creator commerce overview</h1><p className="mt-1 text-sm text-slate-500">Every number below is calculated from current KobeOS records.</p></div><Button size="sm" variant="outline" onClick={props.onRefresh} className="border-white/10 bg-white/5 text-slate-200"><RefreshCw className="mr-1 h-3.5 w-3.5" />Refresh</Button></div>
    {props.error && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200"><AlertTriangle className="mr-1 inline h-4 w-4" />{props.error}</div>}
    {props.loading ? <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-violet-300" /></div> : <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{[
        { label: 'Marketplace creators', value: props.creators.length.toLocaleString(), icon: Users },
        { label: 'Active campaigns', value: activeCampaigns.length.toLocaleString(), icon: Megaphone },
        { label: 'Brand escrow held', value: money(held), icon: ShieldCheck },
        { label: 'Creator released', value: money(creatorReleased), icon: Handshake },
        { label: 'Social accounts', value: props.socialAccounts.filter((a) => a.status === 'connected').length.toLocaleString(), icon: Send },
      ].map(({ label, value, icon: Icon }) => <Card key={label} className="border-white/[0.07] bg-[#13131f]"><CardContent className="p-4"><Icon className="mb-3 h-4 w-4 text-violet-300" /><div className="text-xl font-black">{value}</div><div className="mt-1 text-[11px] text-slate-500">{label}</div></CardContent></Card>)}</div>
      <div className="grid gap-4 lg:grid-cols-2"><Card className="border-white/[0.07] bg-[#13131f]"><CardContent className="p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">Recent campaigns</h3><button onClick={() => props.onGo('campaigns')} className="text-xs text-violet-300">Open campaigns</button></div>{props.campaigns.length ? <div className="space-y-2">{props.campaigns.slice(0, 6).map((c) => <div key={c.id} className="flex items-center gap-3 rounded-lg bg-white/[0.025] p-3"><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{c.name}</div><div className="text-[10px] text-slate-500">{c.brand || 'Brand not set'} · {money(c.budgetTzs)}</div></div><Status value={c.status} /></div>)}</div> : <Empty title="No campaigns" body="Create the first real campaign from Campaigns." />}</CardContent></Card><Card className="border-white/[0.07] bg-[#13131f]"><CardContent className="p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">My creator profile</h3><button onClick={() => props.onGo('profile')} className="text-xs text-violet-300">Manage profile</button></div>{props.mine.length ? <div className="space-y-3">{props.mine.map((c) => <div key={c.id} className="rounded-xl border border-white/[0.06] p-3"><div className="flex items-center justify-between"><div><div className="font-bold">{c.name}</div><div className="text-xs text-slate-500">{c.handle} · {c.niche || 'No niche'}</div></div>{c.verified && <CheckCircle2 className="h-4 w-4 text-blue-400" />}</div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><div><div className="font-bold">{fmt(c.followers)}</div><div className="text-[10px] text-slate-500">Followers</div></div><div><div className="font-bold text-emerald-300">{Number(c.engagement || 0).toFixed(1)}%</div><div className="text-[10px] text-slate-500">Engagement</div></div><div><div className="font-bold">{fmt(c.avgViews || 0)}</div><div className="text-[10px] text-slate-500">Avg views</div></div></div></div>)}</div> : <Empty title="No creator profile" body="Complete Creator Profile setup to join the marketplace." />}</CardContent></Card></div>
    </>}
  </div></div>;
}

function Marketplace({ creators, campaigns, loading, onRefresh }: { creators: CreatorRow[]; campaigns: CampaignRow[]; loading: boolean; onRefresh: () => void }) {
  const [q, setQ] = useState('');
  const [niche, setNiche] = useState('all');
  const [selected, setSelected] = useState<CreatorRow | null>(null);
  const [campaignId, setCampaignId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const niches = useMemo(() => ['all', ...new Set(creators.map((c) => c.niche).filter(Boolean))], [creators]);
  const filtered = useMemo(() => creators.filter((c) => (niche === 'all' || c.niche === niche) && (!q || `${c.name} ${c.handle} ${c.niche} ${c.country}`.toLowerCase().includes(q.toLowerCase()))), [creators, niche, q]);
  const activeCampaigns = campaigns.filter((c) => ['draft', 'open'].includes(c.status));

  const sendOffer = async (event: FormEvent) => {
    event.preventDefault(); if (!selected || !campaignId) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      await api(`/creators/campaigns/${campaignId}/offers`, { method: 'POST', body: JSON.stringify({ creatorId: selected.id, amountTzs: Number(amount), notes: notes.trim() || undefined }) });
      setMessage(`Offer sent to ${selected.name}.`); setSelected(null); setAmount(''); setNotes(''); onRefresh();
    } catch (e) { setError((e as Error).message || 'Could not send offer.'); }
    finally { setBusy(false); }
  };

  return <div className="h-full overflow-y-auto p-6"><div className="mx-auto max-w-7xl space-y-5">
    <div className="flex items-center justify-between"><div><h1 className="text-xl font-black">Creator marketplace</h1><p className="text-sm text-slate-500">Only creators persisted in the live marketplace are shown.</p></div><Button size="sm" variant="outline" onClick={onRefresh} className="border-white/10 bg-white/5 text-slate-200"><RefreshCw className="h-3.5 w-3.5" /></Button></div>
    <div className="flex gap-3"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-600" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search creators…" className="border-white/10 bg-[#13131f] pl-9" /></div><select value={niche} onChange={(e) => setNiche(e.target.value)} className="rounded-lg border border-white/10 bg-[#13131f] px-3 text-sm">{niches.map((n) => <option key={n} value={n}>{n === 'all' ? 'All niches' : n}</option>)}</select></div>
    {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}{message && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">{message}</div>}
    {loading ? <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-violet-300" /></div> : filtered.length === 0 ? <Empty title="No creators match" body="No demo profiles are substituted when the marketplace is empty." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((c) => <Card key={c.id} className="border-white/[0.07] bg-[#13131f]"><CardContent className="p-4"><div className="flex items-start justify-between"><div><div className="flex items-center gap-1.5 font-bold">{c.name}{c.verified && <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />}</div><div className="text-xs text-slate-500">{c.handle} · {c.country || 'Country not set'}</div></div><span className="rounded-full bg-violet-500/10 px-2 py-1 text-[10px] text-violet-300">{c.niche || 'Other'}</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><div className="font-black">{fmt(c.followers)}</div><div className="text-[10px] text-slate-500">Followers</div></div><div><div className="font-black text-emerald-300">{Number(c.engagement || 0).toFixed(1)}%</div><div className="text-[10px] text-slate-500">Engagement</div></div><div><div className="font-black">{fmt(c.avgViews || 0)}</div><div className="text-[10px] text-slate-500">Avg views</div></div></div><div className="mt-4 flex flex-wrap gap-1">{c.platforms.map((p) => <span key={p} className="rounded bg-white/5 px-2 py-1 text-[10px] text-slate-400">{p}</span>)}</div><div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3"><div><div className="text-[10px] text-slate-500">Listed rate</div><div className="font-bold">{money(c.weeklyRateTzs)}<span className="text-[10px] font-normal text-slate-500"> / week</span></div></div><Button size="sm" disabled={!activeCampaigns.length} onClick={() => { setSelected(c); setAmount(String(Number(c.weeklyRateTzs || 0))); setCampaignId(activeCampaigns[0]?.id || ''); }} className="bg-violet-600 hover:bg-violet-500">Send offer</Button></div></CardContent></Card>)}</div>}
    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}><form onSubmit={sendOffer} className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-[#151522] p-5"><div><div className="text-lg font-black">Offer to {selected.name}</div><div className="text-xs text-slate-500">This creates a real campaign offer record.</div></div><label className="block"><span className="mb-1 block text-xs text-slate-400">Campaign</span><select required value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm"><option value="">Select campaign</option>{activeCampaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="block"><span className="mb-1 block text-xs text-slate-400">Offer amount (TZS)</span><Input required min="1" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="border-white/10 bg-black/20" /></label><label className="block"><span className="mb-1 block text-xs text-slate-400">Notes</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-24 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-sm" /></label><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setSelected(null)} className="flex-1 border-white/10 bg-transparent">Cancel</Button><Button disabled={busy || !campaignId || Number(amount) <= 0} className="flex-1 bg-violet-600 hover:bg-violet-500">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send offer'}</Button></div></form></div>}
  </div></div>;
}

function Campaigns({ rows, creators, loading, onRefresh }: { rows: CampaignRow[]; creators: CreatorRow[]; loading: boolean; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', brand: '', niche: '', description: '', budget: '', endsAt: '' });

  const create = async (event: FormEvent) => {
    event.preventDefault(); setBusy('create'); setError(null);
    try {
      await api('/creators/campaigns', { method: 'POST', body: JSON.stringify({ name: form.name.trim(), brand: form.brand.trim(), niche: form.niche.trim(), description: form.description.trim(), budgetTzs: Number(form.budget), endsAt: form.endsAt ? new Date(`${form.endsAt}T23:59:59`).toISOString() : undefined, requirements: [] }) });
      setOpen(false); setForm({ name: '', brand: '', niche: '', description: '', budget: '', endsAt: '' }); onRefresh();
    } catch (e) { setError((e as Error).message || 'Could not create campaign.'); }
    finally { setBusy(null); }
  };

  const action = async (campaign: CampaignRow, kind: 'publish' | 'cancel') => {
    setBusy(campaign.id); setError(null);
    try { await api(`/creators/campaigns/${campaign.id}/${kind}`, { method: 'POST' }); onRefresh(); }
    catch (e) { setError((e as Error).message || `Could not ${kind} campaign.`); }
    finally { setBusy(null); }
  };

  return <div className="h-full overflow-y-auto p-6"><div className="mx-auto max-w-7xl space-y-5">
    <div className="flex items-center justify-between"><div><h1 className="text-xl font-black">Campaigns</h1><p className="text-sm text-slate-500">Create, publish and track persisted campaigns and creator offers.</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={onRefresh} className="border-white/10 bg-white/5 text-slate-200"><RefreshCw className="h-3.5 w-3.5" /></Button><Button size="sm" onClick={() => setOpen(true)} className="bg-violet-600 hover:bg-violet-500">New campaign</Button></div></div>
    {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}
    {loading ? <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-violet-300" /></div> : rows.length === 0 ? <Empty title="No campaigns" body="Create a real campaign; no sample campaigns are shown." /> : <div className="space-y-3">{rows.map((campaign) => <Card key={campaign.id} className="border-white/[0.07] bg-[#13131f]"><CardContent className="p-4"><div className="flex items-start gap-4"><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><div className="font-bold">{campaign.name}</div><Status value={campaign.status} /></div><div className="text-xs text-slate-500">{campaign.brand || 'Brand not set'} · {campaign.niche || 'No niche'} · {money(campaign.budgetTzs)}</div>{campaign.description && <p className="mt-2 text-sm text-slate-300">{campaign.description}</p>}<div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500"><span>{campaign.offers?.length || 0} offers</span><span>{campaign.requirements?.length || 0} requirements</span><span>{creators.length} marketplace creators available</span>{campaign.endsAt && <span>Ends {new Date(campaign.endsAt).toLocaleDateString()}</span>}</div>{campaign.offers?.length > 0 && <div className="mt-3 space-y-1.5">{campaign.offers.map((offer) => <div key={offer.id} className="flex items-center gap-2 rounded-lg bg-white/[0.025] px-3 py-2"><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{offer.creatorName} {offer.creatorHandle}</div><div className="text-[10px] text-slate-500">{money(offer.amountTzs)}{offer.verifiedViews != null ? ` · ${Number(offer.verifiedViews).toLocaleString()} verified views` : ''}</div></div><Status value={offer.status} /></div>)}</div>}</div><div className="flex shrink-0 gap-2">{campaign.status === 'draft' && <Button size="sm" disabled={busy === campaign.id} onClick={() => void action(campaign, 'publish')} className="bg-emerald-600 hover:bg-emerald-500">Publish</Button>}{['draft', 'open'].includes(campaign.status) && <Button size="sm" variant="outline" disabled={busy === campaign.id} onClick={() => void action(campaign, 'cancel')} className="border-red-500/20 bg-transparent text-red-300">Cancel</Button>}</div></div></CardContent></Card>)}</div>}
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}><form onSubmit={create} className="w-full max-w-lg space-y-3 rounded-2xl border border-white/10 bg-[#151522] p-5"><div className="text-lg font-black">New campaign</div><div className="grid grid-cols-2 gap-3"><Input required placeholder="Campaign name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="border-white/10 bg-black/20" /><Input placeholder="Brand" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} className="border-white/10 bg-black/20" /><Input placeholder="Niche" value={form.niche} onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))} className="border-white/10 bg-black/20" /><Input required min="0" type="number" placeholder="Budget TZS" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} className="border-white/10 bg-black/20" /></div><Input type="date" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} className="border-white/10 bg-black/20" /><textarea placeholder="Campaign brief" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="min-h-28 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-sm" /><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 border-white/10 bg-transparent">Cancel</Button><Button disabled={busy === 'create' || !form.name.trim() || !form.budget} className="flex-1 bg-violet-600 hover:bg-violet-500">{busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create campaign'}</Button></div></form></div>}
  </div></div>;
}

function Escrow({ brandRows, creatorRows, loading, onRefresh }: { brandRows: EscrowRow[]; creatorRows: EscrowRow[]; loading: boolean; onRefresh: () => void }) {
  const [mode, setMode] = useState<'brand' | 'creator'>('brand');
  const rows = mode === 'brand' ? brandRows : creatorRows;
  const totals = useMemo(() => rows.reduce((acc, row) => { acc.amount += Number(row.amountTzs || 0); acc.net += Number(row.netAmountTzs || 0); return acc; }, { amount: 0, net: 0 }), [rows]);
  return <div className="h-full overflow-y-auto p-6"><div className="mx-auto max-w-6xl space-y-5"><div className="flex items-center justify-between"><div><h1 className="text-xl font-black">Deals & escrow</h1><p className="text-sm text-slate-500">Real escrow records only.</p></div><Button size="sm" variant="outline" onClick={onRefresh} className="border-white/10 bg-white/5 text-slate-200"><RefreshCw className="h-3.5 w-3.5" /></Button></div><div className="flex gap-2"><button onClick={() => setMode('brand')} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === 'brand' ? 'bg-violet-600' : 'bg-white/5 text-slate-400'}`}>As brand ({brandRows.length})</button><button onClick={() => setMode('creator')} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === 'creator' ? 'bg-violet-600' : 'bg-white/5 text-slate-400'}`}>As creator ({creatorRows.length})</button></div>{loading ? <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-violet-300" /></div> : <><div className="grid grid-cols-2 gap-3"><Card className="border-white/[0.07] bg-[#13131f]"><CardContent className="p-4"><div className="text-xl font-black">{money(totals.amount)}</div><div className="text-xs text-slate-500">Gross escrow represented</div></CardContent></Card><Card className="border-white/[0.07] bg-[#13131f]"><CardContent className="p-4"><div className="text-xl font-black">{money(totals.net)}</div><div className="text-xs text-slate-500">Net creator amount</div></CardContent></Card></div>{rows.length === 0 ? <Empty title="No escrow records" body="Escrow appears after a real campaign offer is accepted and funded." /> : <div className="space-y-2">{rows.map((row) => <div key={row.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-[#13131f] p-4"><Wallet className="h-4 w-4 text-violet-300" /><div className="min-w-0 flex-1"><div className="text-sm font-bold">{money(row.amountTzs)}</div><div className="truncate text-[10px] text-slate-500">Campaign {row.campaignId} · Offer {row.offerId} · Fee {money(row.feeTzs)}</div></div><Status value={row.status} /></div>)}</div>}</>}</div></div>;
}

function Profiles({ rows, loading, onRefresh }: { rows: CreatorRow[]; loading: boolean; onRefresh: () => void }) {
  const [syncing, setSyncing] = useState<string | null>(null);
  const [platform, setPlatform] = useState<'instagram' | 'tiktok' | 'youtube'>('instagram');
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sync = async (creator: CreatorRow) => {
    if (!handle.trim()) return; setSyncing(creator.id); setError(null);
    try { await api(`/creators/${creator.id}/sync`, { method: 'POST', body: JSON.stringify({ platform, handle: handle.trim() }) }); setHandle(''); onRefresh(); }
    catch (e) { setError((e as Error).message || 'Metrics sync failed.'); }
    finally { setSyncing(null); }
  };
  if (loading) return <div className="grid h-full place-items-center"><Loader2 className="h-6 w-6 animate-spin text-violet-300" /></div>;
  if (!rows.length) return <div className="h-full overflow-y-auto p-6"><div className="mx-auto max-w-4xl"><CreatorOnboarding /></div></div>;
  return <div className="h-full overflow-y-auto p-6"><div className="mx-auto max-w-5xl space-y-5"><div className="flex items-center justify-between"><div><h1 className="text-xl font-black">Creator profile</h1><p className="text-sm text-slate-500">Metrics are persisted from connected/approved data sources.</p></div><Button size="sm" variant="outline" onClick={onRefresh} className="border-white/10 bg-white/5 text-slate-200"><RefreshCw className="h-3.5 w-3.5" /></Button></div>{error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}{rows.map((creator) => <Card key={creator.id} className="border-white/[0.07] bg-[#13131f]"><CardContent className="space-y-4 p-5"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-lg font-black">{creator.name}{creator.verified && <CheckCircle2 className="h-4 w-4 text-blue-400" />}</div><div className="text-sm text-slate-500">{creator.handle} · {creator.niche || 'No niche'} · {creator.country || 'Country not set'}</div></div><Status value={creator.subscriptionTier} /></div>{creator.bio && <p className="text-sm text-slate-300">{creator.bio}</p>}<div className="grid grid-cols-4 gap-3">{[{ label: 'Followers', value: fmt(creator.followers) }, { label: 'Engagement', value: `${Number(creator.engagement || 0).toFixed(1)}%` }, { label: 'Avg views', value: fmt(creator.avgViews || 0) }, { label: 'Fraud score', value: String(Number(creator.fraudSignals?.fraudScore || 0)) }].map((x) => <div key={x.label} className="rounded-xl bg-white/[0.025] p-3 text-center"><div className="font-black">{x.value}</div><div className="text-[10px] text-slate-500">{x.label}</div></div>)}</div>{creator.platformStats?.length ? <div className="space-y-2"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Platform metrics</div>{creator.platformStats.map((stat) => <div key={`${stat.platform}:${stat.handle}`} className="grid grid-cols-5 gap-2 rounded-lg bg-white/[0.025] p-3 text-xs"><div><div className="font-bold">{stat.platform}</div><div className="text-[10px] text-slate-500">{stat.handle}</div></div><div><div className="font-bold">{fmt(stat.followers)}</div><div className="text-[10px] text-slate-500">followers</div></div><div><div className="font-bold">{fmt(stat.avgViews)}</div><div className="text-[10px] text-slate-500">avg views</div></div><div><div className="font-bold">{Number(stat.engagementRate || 0).toFixed(1)}%</div><div className="text-[10px] text-slate-500">engagement</div></div><div><div className="font-bold">{formatSync(stat.lastSyncedAt)}</div><div className="text-[10px] text-slate-500">synced</div></div></div>)}</div> : null}<div className="rounded-xl border border-white/[0.06] p-4"><div className="mb-2 text-sm font-bold">Refresh one platform from the configured live data source</div><div className="flex gap-2"><select value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)} className="rounded-lg border border-white/10 bg-black/20 px-3 text-sm"><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option></select><Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle or channel" className="flex-1 border-white/10 bg-black/20" /><Button disabled={syncing === creator.id || !handle.trim()} onClick={() => void sync(creator)} className="bg-violet-600 hover:bg-violet-500">{syncing === creator.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sync'}</Button></div></div></CardContent></Card>)}</div></div>;
}

const formatSync = (value?: string | null) => value ? new Date(value).toLocaleDateString() : 'Never';
