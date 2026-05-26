// Influencer Marketplace modules: Explore, CreatorProfile, HowItWorks, FAQ
import { useState, useMemo, useContext } from 'react';
import {
  Search, CheckCircle2, Instagram, Youtube, Star, Handshake,
  Lock, BarChart3, Globe, Zap, DollarSign, Award, HelpCircle,
  ChevronDown, ChevronUp, Sparkles, Mic, Twitter, BookOpen
} from 'lucide-react';

// ── Shared helpers ────────────────────────────────────────────────────────────

function idHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function fmtK(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MarketCreator {
  id: string; name: string; handle: string; niche: string; country: string;
  followers: number; engagement: number; avgViews: number;
  verified: boolean; weeklyRateTzs: number;
  subscriptionTier: 'free' | 'basic' | 'premium' | 'elite';
  platforms: string[]; bio?: string | null;
}

interface CreatorPackage {
  id: string; tier: 'Basic' | 'Standard' | 'Premium';
  platform: string; deliverables: string;
  price: number; deliveryDays: number; revisions: number;
}

interface CreatorReview {
  id: string; brandName: string; rating: number;
  comment: string; date: string; campaign: string;
}

// ── Demo data ─────────────────────────────────────────────────────────────────

export const DEMO_MARKET_CREATORS: MarketCreator[] = [
  { id:'mc1', name:'Amina Saleh', handle:'@aminasaleh', niche:'Fashion', country:'Tanzania', followers:245000, engagement:5.2, avgViews:89000, verified:true, weeklyRateTzs:850000, subscriptionTier:'elite', platforms:['instagram','tiktok'], bio:'Fashion & lifestyle creator based in Dar es Salaam. Partnered with 50+ brands.' },
  { id:'mc2', name:'John Mwita', handle:'@johnmwita', niche:'Tech', country:'Tanzania', followers:128000, engagement:4.8, avgViews:54000, verified:true, weeklyRateTzs:550000, subscriptionTier:'premium', platforms:['youtube','instagram'], bio:"Tech reviews, unboxings and tutorials. East Africa's top tech creator." },
  { id:'mc3', name:'Fatuma Hassan', handle:'@fatumahassan', niche:'Food', country:'Kenya', followers:89000, engagement:6.1, avgViews:32000, verified:false, weeklyRateTzs:320000, subscriptionTier:'basic', platforms:['tiktok','instagram'], bio:'Food blogger and recipe creator. Swahili cuisine specialist.' },
  { id:'mc4', name:'David Osei', handle:'@davidosei', niche:'Fitness', country:'Ghana', followers:312000, engagement:4.3, avgViews:120000, verified:true, weeklyRateTzs:1200000, subscriptionTier:'elite', platforms:['youtube','instagram'], bio:'Fitness coach and motivational speaker. 10+ years in the industry.' },
  { id:'mc5', name:'Zara Kimani', handle:'@zarakimani', niche:'Beauty', country:'Kenya', followers:178000, engagement:5.7, avgViews:67000, verified:true, weeklyRateTzs:720000, subscriptionTier:'premium', platforms:['instagram','tiktok'], bio:'Beauty & skincare creator. Afrocentric beauty advocate.' },
  { id:'mc6', name:'Omar Diallo', handle:'@omardiallo', niche:'Travel', country:'Senegal', followers:95000, engagement:3.9, avgViews:41000, verified:false, weeklyRateTzs:380000, subscriptionTier:'basic', platforms:['youtube','instagram'], bio:'Travel vlogger exploring Africa one country at a time.' },
];

const DEMO_PACKAGES: CreatorPackage[] = [
  { id:'p1', tier:'Basic', platform:'Instagram', deliverables:'1 Feed Post + Story', price:150000, deliveryDays:3, revisions:1 },
  { id:'p2', tier:'Standard', platform:'Instagram', deliverables:'2 Feed Posts + 3 Stories + Reel', price:350000, deliveryDays:5, revisions:2 },
  { id:'p3', tier:'Premium', platform:'Instagram', deliverables:'4 Posts + 5 Stories + 2 Reels + Analytics Report', price:750000, deliveryDays:7, revisions:3 },
  { id:'p4', tier:'Basic', platform:'YouTube', deliverables:'30s Integration in existing video', price:200000, deliveryDays:7, revisions:1 },
  { id:'p5', tier:'Standard', platform:'YouTube', deliverables:'60s Dedicated segment + end card', price:500000, deliveryDays:10, revisions:2 },
  { id:'p6', tier:'Premium', platform:'YouTube', deliverables:'Full dedicated video + shorts + community post', price:1200000, deliveryDays:14, revisions:3 },
];

const DEMO_REVIEWS: CreatorReview[] = [
  { id:'r1', brandName:'TechBrand TZ', rating:5, comment:'Exceptional work! Delivered ahead of schedule and the content quality was outstanding. Our product sold out within 48 hours.', date:'2026-04-15', campaign:'Product Launch Q1' },
  { id:'r2', brandName:'FoodCo Kenya', rating:5, comment:'Very professional and creative. She understood our brand voice perfectly and the engagement was incredible.', date:'2026-03-22', campaign:'Ramadan Campaign' },
  { id:'r3', brandName:'StyleHouse Africa', rating:4, comment:'Great collaboration overall. Minor delay on one deliverable but the final content was worth the wait.', date:'2026-02-10', campaign:'New Collection Drop' },
  { id:'r4', brandName:'BeautyBox TZ', rating:5, comment:'A true professional. Her audience is highly engaged and the ROI exceeded expectations by 3x.', date:'2026-01-28', campaign:"Valentine's Day Promo" },
];

// ── Shared UI ─────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  youtube:   'bg-red-500/20 text-red-400 border-red-500/30',
  tiktok:    'bg-slate-500/20 text-slate-300 border-slate-500/30',
  twitter:   'bg-sky-500/20 text-sky-400 border-sky-500/30',
};

const TIER_COLORS: Record<string, string> = {
  Basic:    'border-white/10 bg-white/[0.02]',
  Standard: 'border-violet-500/30 bg-violet-500/[0.05]',
  Premium:  'border-yellow-500/30 bg-yellow-500/[0.04]',
};

const TIER_BADGE: Record<string, string> = {
  Basic:    'bg-white/10 text-white/60',
  Standard: 'bg-violet-500/20 text-violet-300',
  Premium:  'bg-yellow-500/20 text-yellow-300',
};

function PlatformIcon({ p }: { p: string }) {
  if (p === 'instagram') return <Instagram className="w-3.5 h-3.5" />;
  if (p === 'youtube')   return <Youtube className="w-3.5 h-3.5" />;
  if (p === 'twitter')   return <Twitter className="w-3.5 h-3.5" />;
  return <Mic className="w-3.5 h-3.5" />;
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const sz = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5';
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`${sz} ${i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'}`} />
      ))}
    </div>
  );
}

function CreatorCard({ c, onView }: { c: MarketCreator; onView: () => void }) {
  const bgs = ['from-violet-600','from-pink-600','from-cyan-600','from-emerald-600','from-orange-600','from-blue-600'];
  const bg = bgs[idHash(c.id) % bgs.length];
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.12] transition-all">
      <div className={`h-20 bg-gradient-to-r ${bg} to-transparent opacity-60`} />
      <div className="px-4 -mt-8 pb-4">
        <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${bg} to-violet-800 flex items-center justify-center text-white font-bold text-lg border-2 border-[#0a0a1a] mb-2`}>
          {c.name[0]}
        </div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm text-white">{c.name}</span>
              {c.verified && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
            </div>
            <div className="text-xs text-white/40">{c.handle}</div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 shrink-0">{c.niche}</span>
        </div>
        <div className="flex gap-3 mt-3 text-[11px]">
          <div className="text-center"><div className="font-semibold text-white">{fmtK(c.followers)}</div><div className="text-white/40">Followers</div></div>
          <div className="text-center"><div className="font-semibold text-emerald-400">{c.engagement}%</div><div className="text-white/40">Engagement</div></div>
          <div className="text-center"><div className="font-semibold text-white">{fmtK(c.avgViews)}</div><div className="text-white/40">Avg Views</div></div>
        </div>
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {c.platforms.map(p => (
            <span key={p} className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${PLATFORM_COLORS[p] ?? 'bg-white/10 text-white/60 border-white/20'}`}>
              <PlatformIcon p={p} />{p}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
          <div>
            <div className="text-[10px] text-white/40">From</div>
            <div className="text-sm font-bold text-white">TZS {(c.weeklyRateTzs/1000).toFixed(0)}K<span className="text-white/40 font-normal text-[10px]">/week</span></div>
          </div>
          <button onClick={onView} className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors">
            View Profile
          </button>
        </div>
      </div>
    </div>
  );
}


// ── ExploreModule ─────────────────────────────────────────────────────────────

export function ExploreModule({ creators = DEMO_MARKET_CREATORS }: { creators?: MarketCreator[] }) {
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('all');
  const [niche, setNiche] = useState('all');
  const [sort, setSort] = useState<'followers'|'engagement'|'price'>('followers');
  const [selected, setSelected] = useState<MarketCreator | null>(null);
  const niches = ['all', ...Array.from(new Set(creators.map(c => c.niche)))];
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return creators
      .filter(c => {
        const ms = !q || c.name.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q) || c.niche.toLowerCase().includes(q);
        return ms && (platform === 'all' || c.platforms.includes(platform)) && (niche === 'all' || c.niche === niche);
      })
      .sort((a, b) => sort === 'followers' ? b.followers - a.followers : sort === 'engagement' ? b.engagement - a.engagement : a.weeklyRateTzs - b.weeklyRateTzs);
  }, [creators, search, platform, niche, sort]);
  const featured  = filtered.filter(c => c.verified && c.subscriptionTier === 'elite').slice(0, 3);
  const instagram = filtered.filter(c => c.platforms.includes('instagram'));
  const youtube   = filtered.filter(c => c.platforms.includes('youtube'));
  if (selected) return <CreatorProfileModule creator={selected} onBack={() => setSelected(null)} />;
  return (
    <div className="h-full overflow-y-auto p-5 space-y-6">
      <div><h2 className="text-lg font-bold text-white">Explore Creators</h2><p className="text-sm text-white/40 mt-0.5">Find the right creator for your campaign</p></div>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search creators…" className="w-full pl-8 pr-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50" />
        </div>
        <select value={platform} onChange={e => setPlatform(e.target.value)} className="text-xs px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white/70 focus:outline-none">
          <option value="all">All Platforms</option><option value="instagram">Instagram</option><option value="youtube">YouTube</option><option value="tiktok">TikTok</option>
        </select>
        <select value={niche} onChange={e => setNiche(e.target.value)} className="text-xs px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white/70 focus:outline-none">
          {niches.map(n => <option key={n} value={n}>{n === 'all' ? 'All Niches' : n}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="text-xs px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white/70 focus:outline-none">
          <option value="followers">Most Followers</option><option value="engagement">Best Engagement</option><option value="price">Lowest Price</option>
        </select>
      </div>
      {featured.length > 0 && (<section><div className="flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-yellow-400" /><h3 className="text-sm font-semibold text-white">Featured</h3></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{featured.map(c => <CreatorCard key={c.id} c={c} onView={() => setSelected(c)} />)}</div></section>)}
      {instagram.length > 0 && (<section><div className="flex items-center gap-2 mb-3"><Instagram className="w-4 h-4 text-pink-400" /><h3 className="text-sm font-semibold text-white">Instagram</h3><span className="text-xs text-white/30">{instagram.length}</span></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{instagram.slice(0,6).map(c => <CreatorCard key={c.id} c={c} onView={() => setSelected(c)} />)}</div></section>)}
      {youtube.length > 0 && (<section><div className="flex items-center gap-2 mb-3"><Youtube className="w-4 h-4 text-red-400" /><h3 className="text-sm font-semibold text-white">YouTube</h3><span className="text-xs text-white/30">{youtube.length}</span></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{youtube.slice(0,6).map(c => <CreatorCard key={c.id} c={c} onView={() => setSelected(c)} />)}</div></section>)}
      {filtered.length === 0 && (<div className="text-center py-16 text-white/30"><Search className="w-8 h-8 mx-auto mb-2 opacity-40" /><p className="text-sm">No creators match your filters</p></div>)}
    </div>
  );
}

// ── CreatorProfileModule ──────────────────────────────────────────────────────

export function CreatorProfileModule({ creator, onBack }: { creator?: MarketCreator; onBack?: () => void }) {
  const c = creator ?? DEMO_MARKET_CREATORS[0];
  const [tab, setTab] = useState<'packages'|'platforms'|'reviews'>('packages');
  const [selPkg, setSelPkg] = useState<CreatorPackage | null>(null);
  const [dealOpen, setDealOpen] = useState(false);
  const bgs = ['from-violet-600','from-pink-600','from-cyan-600','from-emerald-600','from-orange-600','from-blue-600'];
  const bg = bgs[idHash(c.id) % bgs.length];
  const avgRating = DEMO_REVIEWS.reduce((s, r) => s + r.rating, 0) / DEMO_REVIEWS.length;
  return (
    <div className="h-full overflow-y-auto">
      {onBack && (<div className="px-5 pt-4"><button onClick={onBack} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"><ChevronDown className="w-3.5 h-3.5 rotate-90" />Back to Explore</button></div>)}
      <div className={`h-32 bg-gradient-to-r ${bg} to-transparent mx-5 mt-3 rounded-xl opacity-70`} />
      <div className="px-5 -mt-10 pb-4">
        <div className="flex items-end justify-between gap-4">
          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${bg} to-violet-900 flex items-center justify-center text-white font-bold text-2xl border-4 border-[#0a0a1a] shrink-0`}>{c.name[0]}</div>
          <div className="flex gap-2 pb-1">
            <button className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.1] text-white/60 hover:text-white transition-colors">Message</button>
            <button onClick={() => setDealOpen(true)} className="text-xs px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors font-medium">Start Deal</button>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">{c.name}</h2>
            {c.verified && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300">{c.subscriptionTier.toUpperCase()}</span>
          </div>
          <div className="text-sm text-white/40">{c.handle} · {c.niche} · {c.country}</div>
          {c.bio && <p className="text-sm text-white/60 mt-2 leading-relaxed">{c.bio}</p>}
        </div>
        <div className="grid grid-cols-4 gap-3 mt-4 p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]">
          {[{l:'Followers',v:fmtK(c.followers)},{l:'Engagement',v:`${c.engagement}%`},{l:'Avg Views',v:fmtK(c.avgViews)},{l:'Rating',v:`${avgRating.toFixed(1)} ★`}].map(s => (
            <div key={s.l} className="text-center"><div className="text-sm font-bold text-white">{s.v}</div><div className="text-[10px] text-white/40">{s.l}</div></div>
          ))}
        </div>
        <div className="flex gap-1 mt-5 bg-white/[0.03] rounded-lg p-1">
          {(['packages','platforms','reviews'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 text-xs py-1.5 rounded-md capitalize transition-colors ${tab === t ? 'bg-violet-600 text-white' : 'text-white/40 hover:text-white/70'}`}>
              {t}{t === 'reviews' ? ` (${DEMO_REVIEWS.length})` : ''}
            </button>
          ))}
        </div>
        {tab === 'packages' && (
          <div className="mt-4 space-y-3">
            {['Instagram','YouTube'].map(plat => {
              const pkgs = DEMO_PACKAGES.filter(p => p.platform === plat);
              if (!pkgs.length) return null;
              return (
                <div key={plat}>
                  <div className="flex items-center gap-2 mb-2">
                    {plat === 'Instagram' ? <Instagram className="w-4 h-4 text-pink-400" /> : <Youtube className="w-4 h-4 text-red-400" />}
                    <span className="text-sm font-medium text-white">{plat} Packages</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {pkgs.map(pkg => (
                      <div key={pkg.id} onClick={() => setSelPkg(pkg)} className={`rounded-xl border p-4 cursor-pointer hover:border-white/20 transition-all ${TIER_COLORS[pkg.tier]} ${selPkg?.id === pkg.id ? 'ring-1 ring-violet-500' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TIER_BADGE[pkg.tier]}`}>{pkg.tier}</span>
                          {pkg.tier === 'Premium' && <Award className="w-3.5 h-3.5 text-yellow-400" />}
                        </div>
                        <div className="text-base font-bold text-white">TZS {(pkg.price/1000).toFixed(0)}K</div>
                        <p className="text-[11px] text-white/50 mt-1 leading-relaxed">{pkg.deliverables}</p>
                        <div className="flex gap-3 mt-3 text-[10px] text-white/40"><span>⏱ {pkg.deliveryDays}d</span><span>↩ {pkg.revisions} rev</span></div>
                        <button className={`w-full mt-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selPkg?.id === pkg.id ? 'bg-violet-600 text-white' : 'bg-white/[0.06] text-white/60 hover:bg-white/10'}`}>
                          {selPkg?.id === pkg.id ? 'Selected' : 'Select'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {selPkg && (
              <div className="mt-2 p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-between">
                <div className="text-sm text-white"><span className="font-medium">{selPkg.tier}</span> {selPkg.platform} — TZS {(selPkg.price/1000).toFixed(0)}K</div>
                <button onClick={() => setDealOpen(true)} className="text-xs px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors">Start Deal</button>
              </div>
            )}
          </div>
        )}
        {tab === 'platforms' && (
          <div className="mt-4 space-y-3">
            {c.platforms.map(plat => (
              <div key={plat} className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border w-fit mb-3 ${PLATFORM_COLORS[plat] ?? 'bg-white/10 text-white/60 border-white/20'}`}>
                  <PlatformIcon p={plat} />{plat.charAt(0).toUpperCase() + plat.slice(1)}
                </span>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div><div className="text-sm font-bold text-white">{fmtK(c.followers)}</div><div className="text-[10px] text-white/40">Followers</div></div>
                  <div><div className="text-sm font-bold text-emerald-400">{c.engagement}%</div><div className="text-[10px] text-white/40">Engagement</div></div>
                  <div><div className="text-sm font-bold text-white">{fmtK(c.avgViews)}</div><div className="text-[10px] text-white/40">Avg Views</div></div>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'reviews' && (
          <div className="mt-4 space-y-3">
            <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl flex items-center gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{avgRating.toFixed(1)}</div>
                <StarRating rating={Math.round(avgRating)} size="lg" />
                <div className="text-[10px] text-white/40 mt-1">{DEMO_REVIEWS.length} reviews</div>
              </div>
              <div className="flex-1 space-y-1">
                {[5,4,3,2,1].map(star => {
                  const count = DEMO_REVIEWS.filter(r => r.rating === star).length;
                  return (
                    <div key={star} className="flex items-center gap-2 text-[10px]">
                      <span className="text-white/40 w-3">{star}</span>
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${(count/DEMO_REVIEWS.length)*100}%` }} />
                      </div>
                      <span className="text-white/30 w-4">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {DEMO_REVIEWS.map(r => (
              <div key={r.id} className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div><div className="text-sm font-medium text-white">{r.brandName}</div><div className="text-[10px] text-white/30">{r.campaign} · {r.date}</div></div>
                  <StarRating rating={r.rating} />
                </div>
                <p className="text-xs text-white/60 leading-relaxed">{r.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {dealOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDealOpen(false)}>
          <div className="bg-[#13131f] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-1">Start a Deal</h3>
            <p className="text-xs text-white/40 mb-4">with {c.name}</p>
            {selPkg && (<div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg mb-4 text-xs text-white/70"><span className="font-medium text-white">{selPkg.tier} {selPkg.platform}</span> — TZS {(selPkg.price/1000).toFixed(0)}K · {selPkg.deliveryDays} days</div>)}
            <textarea placeholder="Describe your campaign requirements…" rows={3} className="w-full text-xs p-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 resize-none mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setDealOpen(false)} className="flex-1 py-2 text-xs rounded-lg border border-white/[0.1] text-white/50 hover:text-white/70 transition-colors">Cancel</button>
              <button onClick={() => setDealOpen(false)} className="flex-1 py-2 text-xs rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors font-medium">Send Proposal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── HowItWorksModule ──────────────────────────────────────────────────────────

export function HowItWorksModule() {
  const steps = [
    { num:'01', color:'text-violet-400 bg-violet-500/10 border-violet-500/20', title:'Find the Right Creator', desc:'Browse our vetted network across Instagram, YouTube, and TikTok. Filter by niche, engagement rate, location, and budget.', details:['Advanced search & filters','Verified engagement metrics','Fraud score detection','Portfolio & past campaigns'] },
    { num:'02', color:'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', title:'Agree & Lock Funds in Escrow', desc:'Send a deal proposal. Once both parties agree on deliverables, timeline, and price, funds are locked in secure escrow.', details:['Direct messaging','Milestone-based contracts','Secure escrow hold','Dispute resolution support'] },
    { num:'03', color:'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', title:'Review Content & Release Payment', desc:'The creator delivers content for your review. Once approved, funds are automatically released. Track performance in real time.', details:['Content review & approval','Revision requests','Automatic payment release','Post-campaign analytics'] },
  ];
  const features = [
    { icon:<Award className="w-5 h-5 text-yellow-400" />, title:'Verified Creators', desc:'Every creator is vetted for authentic engagement. Fraud scores and platform stats are synced directly from APIs.' },
    { icon:<Lock className="w-5 h-5 text-emerald-400" />, title:'Escrow Protection', desc:'Funds are held securely until you approve the content. No risk of paying for work that does not meet your brief.' },
    { icon:<BarChart3 className="w-5 h-5 text-violet-400" />, title:'Real-Time Analytics', desc:'Track views, engagement, conversions, and ROI for every campaign from a single dashboard.' },
    { icon:<Globe className="w-5 h-5 text-cyan-400" />, title:'Pan-African Network', desc:'Creators across Tanzania, Kenya, Ghana, Nigeria, and beyond. Reach audiences in their native language and culture.' },
    { icon:<Zap className="w-5 h-5 text-orange-400" />, title:'Fast Turnaround', desc:'Most campaigns go live within 3-7 days. Our streamlined workflow removes the back-and-forth of traditional outreach.' },
    { icon:<DollarSign className="w-5 h-5 text-pink-400" />, title:'Transparent Pricing', desc:'No hidden fees. Creators set their rates, you see exactly what you are paying. Platform fee is a flat 10% on completed deals.' },
  ];
  return (
    <div className="h-full overflow-y-auto p-5 space-y-8">
      <div className="text-center max-w-lg mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs mb-3"><Sparkles className="w-3.5 h-3.5" />How It Works</div>
        <h2 className="text-xl font-bold text-white">Launch a campaign in 3 steps</h2>
        <p className="text-sm text-white/40 mt-2">From discovery to payment — everything in one place</p>
      </div>
      <div className="space-y-4 max-w-2xl mx-auto">
        {steps.map((step, i) => (
          <div key={step.num} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${step.color}`}>
                {i === 0 ? <Search className="w-6 h-6" /> : i === 1 ? <Handshake className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
              </div>
              {i < steps.length - 1 && <div className="w-px flex-1 bg-white/[0.06] my-2" />}
            </div>
            <div className="pb-6 flex-1">
              <div className="flex items-center gap-2 mb-1"><span className="text-[10px] font-mono text-white/30">{step.num}</span><h3 className="text-sm font-semibold text-white">{step.title}</h3></div>
              <p className="text-xs text-white/50 leading-relaxed mb-3">{step.desc}</p>
              <div className="flex flex-wrap gap-2">
                {step.details.map(d => (<span key={d} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/50"><CheckCircle2 className="w-3 h-3 text-emerald-400" />{d}</span>))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white mb-4 text-center">Why brands choose KobeOS Creator</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map(f => (<div key={f.title} className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:border-white/[0.1] transition-colors"><div className="mb-2">{f.icon}</div><div className="text-sm font-medium text-white mb-1">{f.title}</div><p className="text-xs text-white/40 leading-relaxed">{f.desc}</p></div>))}
        </div>
      </div>
      <div className="text-center p-6 bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-white/[0.06] rounded-2xl">
        <h3 className="text-base font-bold text-white mb-1">Ready to launch your first campaign?</h3>
        <p className="text-xs text-white/40 mb-4">Join 500+ brands already growing with KobeOS Creator</p>
        <div className="flex gap-2 justify-center">
          <button className="text-xs px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors">Browse Creators</button>
          <button className="text-xs px-4 py-2 rounded-lg border border-white/[0.1] text-white/60 hover:text-white hover:border-white/20 transition-colors">Post a Campaign</button>
        </div>
      </div>
    </div>
  );
}

// ── FAQModule ─────────────────────────────────────────────────────────────────

const FAQ_DATA = [
  { category:'Getting Started', items:[
    { q:'What is KobeOS Creator?', a:'KobeOS Creator is an influencer marketplace built into KobeOS. It connects brands with verified content creators across East and West Africa, handling everything from discovery to payment via escrow.' },
    { q:'How do I post my first campaign?', a:'Go to Campaigns then New Campaign. Fill in your brief, budget, target platforms, and content requirements. Creators will apply and you can review their profiles before accepting.' },
    { q:'Is there a minimum budget?', a:'There is no platform-enforced minimum, but most creators start from TZS 150,000 per deliverable. We recommend a minimum campaign budget of TZS 500,000 for meaningful reach.' },
  ]},
  { category:'Creators', items:[
    { q:'How are creators verified?', a:'Creators connect their social accounts via official APIs. We pull real follower counts, engagement rates, and average views directly from the platforms. A fraud score is calculated to flag suspicious activity.' },
    { q:'Can I work with creators outside Tanzania?', a:'Yes. Our network includes creators from Kenya, Ghana, Nigeria, Uganda, Rwanda, and Senegal. You can filter by country when browsing.' },
    { q:'What if a creator does not deliver?', a:'Funds are held in escrow until you approve the content. If a creator misses the deadline or delivers substandard work, you can raise a dispute and our team will mediate. Unresolved disputes result in a full refund.' },
  ]},
  { category:'Payments & Escrow', items:[
    { q:'How does escrow work?', a:'When you accept a proposal, you fund the escrow. The creator can see the funds are locked but cannot access them until you approve their content. This protects both parties.' },
    { q:'What payment methods are accepted?', a:'We accept M-Pesa, Airtel Money, bank transfer (CRDB, NMB, Equity), and KobePay wallet. Card payments via Stripe are available for international brands.' },
    { q:'What is the platform fee?', a:'KobeOS Creator charges a flat 10% platform fee on completed deals, deducted from the creator payout. There are no fees for brands beyond the agreed campaign budget.' },
    { q:'How quickly are creators paid?', a:'Once you approve the content, payment is released instantly to the creator KobePay wallet. They can withdraw to mobile money or bank within 24 hours.' },
  ]},
  { category:'Analytics & Reporting', items:[
    { q:'Can I track campaign performance?', a:'Yes. The Performance module shows real-time views, likes, comments, shares, and estimated reach for every campaign. Data is synced from creator platforms every 24 hours.' },
    { q:'Do I get a report after the campaign?', a:'Premium package creators include a post-campaign analytics report in their deliverables. For other tiers, you can export data from the Performance module at any time.' },
  ]},
];

export function FAQModule() {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const toggle = (k: string) => setOpen(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const filtered = useMemo(() => {
    if (!search.trim()) return FAQ_DATA;
    const q = search.toLowerCase();
    return FAQ_DATA.map(cat => ({ ...cat, items: cat.items.filter(i => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q)) })).filter(cat => cat.items.length > 0);
  }, [search]);
  return (
    <div className="h-full overflow-y-auto p-5 space-y-6">
      <div className="text-center max-w-lg mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs mb-3"><HelpCircle className="w-3.5 h-3.5" />FAQ</div>
        <h2 className="text-xl font-bold text-white">Frequently Asked Questions</h2>
        <p className="text-sm text-white/40 mt-2">Everything you need to know about influencer marketing on KobeOS</p>
      </div>
      <div className="relative max-w-md mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions…" className="w-full pl-8 pr-3 py-2.5 text-sm bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50" />
      </div>
      <div className="max-w-2xl mx-auto space-y-6">
        {filtered.map(cat => (
          <div key={cat.category}>
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">{cat.category}</h3>
            <div className="space-y-2">
              {cat.items.map((item, i) => {
                const k = `${cat.category}-${i}`;
                const isOpen = open.has(k);
                return (
                  <div key={k} className={`border rounded-xl overflow-hidden transition-colors ${isOpen ? 'border-violet-500/30 bg-violet-500/[0.04]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]'}`}>
                    <button className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => toggle(k)}>
                      <span className="text-sm font-medium text-white">{item.q}</span>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-violet-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />}
                    </button>
                    {isOpen && <div className="px-4 pb-4"><p className="text-sm text-white/50 leading-relaxed">{item.a}</p></div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (<div className="text-center py-12 text-white/30"><HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-40" /><p className="text-sm">No questions match "{search}"</p></div>)}
      </div>
      <div className="max-w-2xl mx-auto p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl flex items-center justify-between gap-4">
        <div><div className="text-sm font-medium text-white">Still have questions?</div><div className="text-xs text-white/40">Our support team responds within 2 hours</div></div>
        <button className="text-xs px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors shrink-0">Contact Support</button>
      </div>
    </div>
  );
}
