import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Globe2, LayoutDashboard, Loader2, Megaphone, RefreshCw, Search, Send, Star, Users, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CreatorOnboarding } from './CreatorOnboarding';
import { SocialScheduler } from './SocialScheduler';

type View = 'overview' | 'marketplace' | 'campaigns' | 'escrow' | 'profile' | 'social';
type Creator = { id: string; name: string; handle: string; niche: string; country: string; followers: number; engagement: number; avgViews: number; verified: boolean; weeklyRateTzs: number | string; platforms: string[]; bio?: string | null; subscriptionTier: string; platformStats?: Array<{ platform: string; handle: string; followers: number; avgViews: number; engagementRate: number; lastSyncedAt: string }> };
type Offer = { id: string; creatorId: string; creatorName: string; creatorHandle: string; amountTzs: number | string; status: string; verifiedViews?: number; sentAt: string };
type Campaign = { id: string; name: string; brand: string; niche: string; description: string; status: string; budgetTzs: number | string; offers: Offer[]; endsAt?: string | null };
type Escrow = { id: string; campaignId: string; offerId: string; amountTzs: number | string; feeTzs: number | string; netAmountTzs: number | string; status: string };
type Account = { id: string; platform: string; status: string };

const money = (v: number | string) => `TZS ${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const short = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${Math.round(v / 1_000)}K` : String(v || 0);
const tone = (s: string) => ['open', 'active', 'in_progress', 'completed', 'verified', 'paid', 'released'].includes(s) ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : ['failed', 'cancelled', 'declined', 'refunded', 'disputed'].includes(s) ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300';
const Status = ({ value }: { value: string }) => <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${tone(value)}`}>{value.replace(/_/g, ' ')}</span>;
const Empty = ({ title, body }: { title: string; body: string }) => <div className="rounded-xl border border-dashed border-white/10 px-5 py-10 text-center"><div className="text-sm font-semibold text-slate-300">{title}</div><div className="mt-1 text-xs text-slate-500">{body}</div></div>;

export default function ProductionCreator() {
  const [view, setView] = useState<View>('overview');
  const [creators, setCreators] = useState<Creator[]>([]);
  const [mine, setMine] = useState<Creator[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [brandEscrow, setBrandEscrow] = useState<Escrow[]>([]);
  const [creatorEscrow, setCreatorEscrow] = useState<Escrow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((x) => x + 1), []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true); setError(null);
      const rows = await Promise.allSettled([
        api<Creator[]>('/creators/marketplace'), api<Creator[]>('/creators'), api<Campaign[]>('/creators/campaigns/mine'),
        api<Escrow[]>('/creators/escrow/mine'), api<Escrow[]>('/creators/escrow/creator'), api<Account[]>('/social-scheduler/accounts'),
      ]);
      if (!alive) return;
      const setIf = <T,>(result: PromiseSettledResult<T[]>, setter: (value: T[]) => void) => { if (result.status === 'fulfilled') setter(Array.isArray(result.value) ? result.value : []); };
      setIf(rows[0] as PromiseSettledResult<Creator[]>, setCreators); setIf(rows[1] as PromiseSettledResult<Creator[]>, setMine);
      setIf(rows[2] as PromiseSettledResult<Campaign[]>, setCampaigns); setIf(rows[3] as PromiseSettledResult<Escrow[]>, setBrandEscrow);
      setIf(rows[4] as PromiseSettledResult<Escrow[]>, setCreatorEscrow); setIf(rows[5] as PromiseSettledResult<Account[]>, setAccounts);
      const failures = rows.filter((r) => r.status === 'rejected').length;
      if (failures) setError(failures === rows.length ? 'Creator services are unavailable. No demo data was substituted.' : `${failures} live Creator data source${failures === 1 ? '' : 's'} could not be loaded.`);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [version]);

  const nav: Array<[View, string, typeof LayoutDashboard]> = [
    ['overview', 'Overview', LayoutDashboard], ['marketplace', 'Marketplace', Globe2], ['campaigns', 'Campaigns', Megaphone],
    ['escrow', 'Deals & Escrow', Wallet], ['profile', 'Creator Profile', Star], ['social', 'Social Publishing', Send],
  ];

  return <div className="flex h-full min-h-0 bg-[#0a0a16] text-white">
    <aside className="w-60 shrink-0 overflow-y-auto border-r border-white/[0.06] bg-[#0c0c18] p-3">
      <div className="mb-4 flex items-center gap-2 px-2 py-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/15"><Users className="h-4 w-4 text-violet-300" /></div><div><div className="text-sm font-black">KOBE CREATORS</div><div className="text-[10px] text-slate-500">Production workspace</div></div></div>
      <div className="space-y-1">{nav.map(([id, label, Icon]) => <button key={id} onClick={() => setView(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${view === id ? 'bg-violet-500/15 text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
      <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-[11px] text-slate-500">Empty means empty. KobeOS does not substitute fake creators, campaigns, earnings, messages, media, or publishing success.</div>
    </aside>
    <main className="min-w-0 flex-1 overflow-hidden">
      {view === 'overview' && <Overview creators={creators} campaigns={campaigns} escrows={[...brandEscrow, ...creatorEscrow]} accounts={accounts} loading={loading} error={error} refresh={refresh} />}
      {view === 'marketplace' && <Marketplace creators={creators} campaigns={campaigns} loading={loading} refresh={refresh} />}
      {view === 'campaigns' && <Campaigns rows={campaigns} loading={loading} refresh={refresh} />}
      {view === 'escrow' && <Escrows brand={brandEscrow} creator={creatorEscrow} loading={loading} refresh={refresh} />}
      {view === 'profile' && <Profiles rows={mine} loading={loading} refresh={refresh} />}
      {view === 'social' && <SocialScheduler />}
    </main>
  </div>;
}

function Header({ title, subtitle, refresh }: { title: string; subtitle: string; refresh: () => void }) {
  return <div className="flex items-center justify-between gap-3"><div><h1 className="text-xl font-black">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div><Button size="sm" variant="outline" onClick={refresh} className="border-white/10 bg-white/5 text-slate-200"><RefreshCw className="mr-1 h-3.5 w-3.5" />Refresh</Button></div>;
}

function Overview({ creators, campaigns, escrows, accounts, loading, error, refresh }: { creators: Creator[]; campaigns: Campaign[]; escrows: Escrow[]; accounts: Account[]; loading: boolean; error: string | null; refresh: () => void }) {
  const held = escrows.filter((x) => x.status === 'held').reduce((s, x) => s + Number(x.amountTzs || 0), 0);
  const active = campaigns.filter((x) => ['open', 'in_progress', 'verifying'].includes(x.status)).length;
  return <Page><Header title="Creator commerce overview" subtitle="Calculated from current KobeOS records only." refresh={refresh} />{error && <Notice text={error} />}{loading ? <Spinner /> : <><div className="grid gap-3 md:grid-cols-4">{[['Marketplace creators', creators.length.toLocaleString()], ['Active campaigns', active.toLocaleString()], ['Escrow held', money(held)], ['Connected social accounts', accounts.filter((x) => x.status === 'connected').length.toLocaleString()]].map(([label, value]) => <Card key={label} className="border-white/[0.07] bg-[#13131f]"><CardContent className="p-4"><div className="text-xl font-black">{value}</div><div className="mt-1 text-[11px] text-slate-500">{label}</div></CardContent></Card>)}</div>{campaigns.length ? <Card className="border-white/[0.07] bg-[#13131f]"><CardContent className="space-y-2 p-4"><h3 className="text-sm font-bold">Recent campaigns</h3>{campaigns.slice(0, 6).map((c) => <div key={c.id} className="flex items-center gap-3 rounded-lg bg-white/[0.025] p-3"><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{c.name}</div><div className="text-[10px] text-slate-500">{c.brand || 'Brand not set'} · {money(c.budgetTzs)}</div></div><Status value={c.status} /></div>)}</CardContent></Card> : <Empty title="No campaigns" body="Create the first real campaign from Campaigns." />}</>}</Page>;
}

function Marketplace({ creators, campaigns, loading, refresh }: { creators: Creator[]; campaigns: Campaign[]; loading: boolean; refresh: () => void }) {
  const [q, setQ] = useState(''); const [selected, setSelected] = useState<Creator | null>(null); const [campaignId, setCampaignId] = useState(''); const [amount, setAmount] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const filtered = useMemo(() => creators.filter((c) => !q || `${c.name} ${c.handle} ${c.niche} ${c.country}`.toLowerCase().includes(q.toLowerCase())), [creators, q]);
  const eligible = campaigns.filter((c) => ['draft', 'open'].includes(c.status));
  const sendOffer = async (e: FormEvent) => { e.preventDefault(); if (!selected || !campaignId) return; setBusy(true); setError(null); try { await api(`/creators/campaigns/${campaignId}/offers`, { method: 'POST', body: JSON.stringify({ creatorId: selected.id, amountTzs: Number(amount) }) }); setSelected(null); refresh(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } };
  return <Page><Header title="Creator marketplace" subtitle="Only persisted marketplace creators are shown." refresh={refresh} /><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-600" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search creator, niche or country…" className="border-white/10 bg-[#13131f] pl-9" /></div>{error && <Notice text={error} danger />}{loading ? <Spinner /> : filtered.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((c) => <Card key={c.id} className="border-white/[0.07] bg-[#13131f]"><CardContent className="p-4"><div className="flex justify-between"><div><div className="flex items-center gap-1 font-bold">{c.name}{c.verified && <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />}</div><div className="text-xs text-slate-500">{c.handle} · {c.niche || 'Other'}</div></div><div className="text-xs font-bold">{money(c.weeklyRateTzs)}</div></div><div className="mt-4 grid grid-cols-3 text-center"><Metric label="Followers" value={short(c.followers)} /><Metric label="Engagement" value={`${Number(c.engagement || 0).toFixed(1)}%`} /><Metric label="Avg views" value={short(c.avgViews)} /></div><Button size="sm" disabled={!eligible.length} onClick={() => { setSelected(c); setCampaignId(eligible[0]?.id || ''); setAmount(String(Number(c.weeklyRateTzs || 0))); }} className="mt-4 w-full bg-violet-600 hover:bg-violet-500">Send real offer</Button></CardContent></Card>)}</div> : <Empty title="No creators found" body="No sample creator cards are added when the database is empty." />}{selected && <Modal><form onSubmit={sendOffer} className="space-y-3"><h3 className="text-lg font-black">Offer to {selected.name}</h3><select required value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3"><option value="">Campaign</option>{eligible.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><Input required min="1" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="border-white/10 bg-black/20" /><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setSelected(null)} className="flex-1 border-white/10 bg-transparent">Cancel</Button><Button disabled={busy} className="flex-1 bg-violet-600">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send offer'}</Button></div></form></Modal>}</Page>;
}

function Campaigns({ rows, loading, refresh }: { rows: Campaign[]; loading: boolean; refresh: () => void }) {
  const [form, setForm] = useState({ name: '', brand: '', niche: '', budget: '', description: '' }); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const create = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setError(null); try { await api('/creators/campaigns', { method: 'POST', body: JSON.stringify({ name: form.name.trim(), brand: form.brand.trim(), niche: form.niche.trim(), description: form.description.trim(), budgetTzs: Number(form.budget), requirements: [] }) }); setForm({ name: '', brand: '', niche: '', budget: '', description: '' }); refresh(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } };
  const act = async (id: string, action: 'publish' | 'cancel') => { setBusy(true); setError(null); try { await api(`/creators/campaigns/${id}/${action}`, { method: 'POST' }); refresh(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } };
  return <Page><Header title="Campaigns" subtitle="Create and manage live campaign records." refresh={refresh} /><Card className="border-white/[0.07] bg-[#13131f]"><CardContent className="p-4"><form onSubmit={create} className="grid gap-2 md:grid-cols-5"><Input required placeholder="Campaign" value={form.name} onChange={(e) => setForm((x) => ({ ...x, name: e.target.value }))} className="border-white/10 bg-black/20" /><Input placeholder="Brand" value={form.brand} onChange={(e) => setForm((x) => ({ ...x, brand: e.target.value }))} className="border-white/10 bg-black/20" /><Input placeholder="Niche" value={form.niche} onChange={(e) => setForm((x) => ({ ...x, niche: e.target.value }))} className="border-white/10 bg-black/20" /><Input required min="0" type="number" placeholder="Budget TZS" value={form.budget} onChange={(e) => setForm((x) => ({ ...x, budget: e.target.value }))} className="border-white/10 bg-black/20" /><Button disabled={busy || !form.name.trim()} className="bg-violet-600">Create</Button></form><textarea value={form.description} onChange={(e) => setForm((x) => ({ ...x, description: e.target.value }))} placeholder="Campaign brief" className="mt-2 min-h-20 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-sm" /></CardContent></Card>{error && <Notice text={error} danger />}{loading ? <Spinner /> : rows.length ? <div className="space-y-2">{rows.map((c) => <Card key={c.id} className="border-white/[0.07] bg-[#13131f]"><CardContent className="flex items-start gap-3 p-4"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><div className="font-bold">{c.name}</div><Status value={c.status} /></div><div className="mt-1 text-xs text-slate-500">{c.brand || 'Brand not set'} · {money(c.budgetTzs)} · {c.offers?.length || 0} offers</div>{c.description && <p className="mt-2 text-sm text-slate-300">{c.description}</p>}</div>{c.status === 'draft' && <Button size="sm" disabled={busy} onClick={() => void act(c.id, 'publish')} className="bg-emerald-600">Publish</Button>}{['draft', 'open'].includes(c.status) && <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(c.id, 'cancel')} className="border-red-500/20 bg-transparent text-red-300">Cancel</Button>}</CardContent></Card>)}</div> : <Empty title="No campaigns" body="No sample campaigns are inserted." />}</Page>;
}

function Escrows({ brand, creator, loading, refresh }: { brand: Escrow[]; creator: Escrow[]; loading: boolean; refresh: () => void }) {
  const [mode, setMode] = useState<'brand' | 'creator'>('brand'); const rows = mode === 'brand' ? brand : creator;
  return <Page><Header title="Deals & escrow" subtitle="Funding and payout state from real escrow records." refresh={refresh} /><div className="flex gap-2"><Button size="sm" onClick={() => setMode('brand')} variant={mode === 'brand' ? 'default' : 'outline'}>As brand</Button><Button size="sm" onClick={() => setMode('creator')} variant={mode === 'creator' ? 'default' : 'outline'}>As creator</Button></div>{loading ? <Spinner /> : rows.length ? <div className="space-y-2">{rows.map((x) => <div key={x.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-[#13131f] p-4"><Wallet className="h-4 w-4 text-violet-300" /><div className="min-w-0 flex-1"><div className="font-bold">{money(x.amountTzs)}</div><div className="truncate text-[10px] text-slate-500">Campaign {x.campaignId} · Net {money(x.netAmountTzs)} · Fee {money(x.feeTzs)}</div></div><Status value={x.status} /></div>)}</div> : <Empty title="No escrow records" body="Escrow appears only after a real offer is accepted and funded." />}</Page>;
}

function Profiles({ rows, loading, refresh }: { rows: Creator[]; loading: boolean; refresh: () => void }) {
  const [platform, setPlatform] = useState('instagram'); const [handle, setHandle] = useState(''); const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const sync = async (creator: Creator) => { if (!handle.trim()) return; setBusy(creator.id); setError(null); try { await api(`/creators/${creator.id}/sync`, { method: 'POST', body: JSON.stringify({ platform, handle: handle.trim() }) }); setHandle(''); refresh(); } catch (err) { setError((err as Error).message); } finally { setBusy(null); } };
  if (loading) return <Spinner />; if (!rows.length) return <div className="h-full overflow-y-auto p-6"><div className="mx-auto max-w-4xl"><CreatorOnboarding /></div></div>;
  return <Page><Header title="Creator profile" subtitle="Current profile and verified/synced platform metrics." refresh={refresh} />{error && <Notice text={error} danger />}{rows.map((c) => <Card key={c.id} className="border-white/[0.07] bg-[#13131f]"><CardContent className="space-y-4 p-5"><div><div className="flex items-center gap-2 text-lg font-black">{c.name}{c.verified && <CheckCircle2 className="h-4 w-4 text-blue-400" />}</div><div className="text-xs text-slate-500">{c.handle} · {c.niche || 'Other'} · {c.subscriptionTier}</div></div><div className="grid grid-cols-3"><Metric label="Followers" value={short(c.followers)} /><Metric label="Engagement" value={`${Number(c.engagement || 0).toFixed(1)}%`} /><Metric label="Avg views" value={short(c.avgViews)} /></div>{c.platformStats?.map((s) => <div key={`${s.platform}:${s.handle}`} className="grid grid-cols-4 rounded-lg bg-white/[0.025] p-3 text-xs"><span>{s.platform} {s.handle}</span><span>{short(s.followers)} followers</span><span>{short(s.avgViews)} avg views</span><span>{Number(s.engagementRate || 0).toFixed(1)}% engagement</span></div>)}<div className="flex gap-2"><select value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded-lg border border-white/10 bg-black/20 px-3 text-sm"><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option></select><Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" className="flex-1 border-white/10 bg-black/20" /><Button disabled={busy === c.id || !handle.trim()} onClick={() => void sync(c)} className="bg-violet-600">{busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sync live metrics'}</Button></div></CardContent></Card>)}</Page>;
}

const Page = ({ children }: { children: React.ReactNode }) => <div className="h-full overflow-y-auto p-6"><div className="mx-auto max-w-7xl space-y-5">{children}</div></div>;
const Spinner = () => <div className="grid min-h-60 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-violet-300" /></div>;
const Notice = ({ text, danger = false }: { text: string; danger?: boolean }) => <div className={`rounded-lg border p-3 text-xs ${danger ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-200'}`}><AlertTriangle className="mr-1 inline h-4 w-4" />{text}</div>;
const Metric = ({ label, value }: { label: string; value: string }) => <div className="text-center"><div className="font-black">{value}</div><div className="text-[10px] text-slate-500">{label}</div></div>;
const Modal = ({ children }: { children: React.ReactNode }) => <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#151522] p-5">{children}</div></div>;
