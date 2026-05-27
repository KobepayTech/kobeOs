// Shared data and helpers for marketplace modules — no React imports here

export interface MarketCreator {
  id: string; name: string; handle: string; niche: string; country: string;
  followers: number; engagement: number; avgViews: number;
  verified: boolean; weeklyRateTzs: number;
  subscriptionTier: 'free' | 'basic' | 'premium' | 'elite';
  platforms: string[]; bio?: string | null;
}

export function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function idHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export const DEMO_MARKET_CREATORS: MarketCreator[] = [
  { id:'mc1', name:'Amina Saleh', handle:'@aminasaleh', niche:'Fashion', country:'Tanzania', followers:245000, engagement:5.2, avgViews:89000, verified:true, weeklyRateTzs:850000, subscriptionTier:'elite', platforms:['instagram','tiktok'], bio:'Fashion & lifestyle creator based in Dar es Salaam. Partnered with 50+ brands.' },
  { id:'mc2', name:'John Mwita', handle:'@johnmwita', niche:'Tech', country:'Tanzania', followers:128000, engagement:4.8, avgViews:54000, verified:true, weeklyRateTzs:550000, subscriptionTier:'premium', platforms:['youtube','instagram'], bio:"Tech reviews, unboxings and tutorials. East Africa's top tech creator." },
  { id:'mc3', name:'Fatuma Hassan', handle:'@fatumahassan', niche:'Food', country:'Kenya', followers:89000, engagement:6.1, avgViews:32000, verified:false, weeklyRateTzs:320000, subscriptionTier:'basic', platforms:['tiktok','instagram'], bio:'Food blogger and recipe creator. Swahili cuisine specialist.' },
  { id:'mc4', name:'David Osei', handle:'@davidosei', niche:'Fitness', country:'Ghana', followers:312000, engagement:4.3, avgViews:120000, verified:true, weeklyRateTzs:1200000, subscriptionTier:'elite', platforms:['youtube','instagram'], bio:'Fitness coach and motivational speaker. 10+ years in the industry.' },
  { id:'mc5', name:'Zara Kimani', handle:'@zarakimani', niche:'Beauty', country:'Kenya', followers:178000, engagement:5.7, avgViews:67000, verified:true, weeklyRateTzs:720000, subscriptionTier:'premium', platforms:['instagram','tiktok'], bio:'Beauty & skincare creator. Afrocentric beauty advocate.' },
  { id:'mc6', name:'Omar Diallo', handle:'@omardiallo', niche:'Travel', country:'Senegal', followers:95000, engagement:3.9, avgViews:41000, verified:false, weeklyRateTzs:380000, subscriptionTier:'basic', platforms:['youtube','instagram'], bio:'Travel vlogger exploring Africa one country at a time.' },
];

export const DEMO_PACKAGES = [
  { id:'p1', tier:'Basic' as const, platform:'Instagram', deliverables:'1 Feed Post + Story', price:150000, deliveryDays:3, revisions:1 },
  { id:'p2', tier:'Standard' as const, platform:'Instagram', deliverables:'2 Feed Posts + 3 Stories + Reel', price:350000, deliveryDays:5, revisions:2 },
  { id:'p3', tier:'Premium' as const, platform:'Instagram', deliverables:'4 Posts + 5 Stories + 2 Reels + Analytics Report', price:750000, deliveryDays:7, revisions:3 },
  { id:'p4', tier:'Basic' as const, platform:'YouTube', deliverables:'30s Integration in existing video', price:200000, deliveryDays:7, revisions:1 },
  { id:'p5', tier:'Standard' as const, platform:'YouTube', deliverables:'60s Dedicated segment + end card', price:500000, deliveryDays:10, revisions:2 },
  { id:'p6', tier:'Premium' as const, platform:'YouTube', deliverables:'Full dedicated video + shorts + community post', price:1200000, deliveryDays:14, revisions:3 },
];

export const DEMO_REVIEWS = [
  { id:'r1', brandName:'TechBrand TZ', rating:5, comment:'Exceptional work! Delivered ahead of schedule and the content quality was outstanding. Our product sold out within 48 hours.', date:'2026-04-15', campaign:'Product Launch Q1' },
  { id:'r2', brandName:'FoodCo Kenya', rating:5, comment:'Very professional and creative. She understood our brand voice perfectly and the engagement was incredible.', date:'2026-03-22', campaign:'Ramadan Campaign' },
  { id:'r3', brandName:'StyleHouse Africa', rating:4, comment:'Great collaboration overall. Minor delay on one deliverable but the final content was worth the wait.', date:'2026-02-10', campaign:'New Collection Drop' },
  { id:'r4', brandName:'BeautyBox TZ', rating:5, comment:'A true professional. Her audience is highly engaged and the ROI exceeded expectations by 3x.', date:'2026-01-28', campaign:"Valentine's Day Promo" },
];

export const FAQ_DATA = [
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

export const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  youtube:   'bg-red-500/20 text-red-400 border-red-500/30',
  tiktok:    'bg-slate-500/20 text-slate-300 border-slate-500/30',
  twitter:   'bg-sky-500/20 text-sky-400 border-sky-500/30',
};

export const TIER_COLORS: Record<string, string> = {
  Basic:    'border-white/10 bg-white/[0.02]',
  Standard: 'border-violet-500/30 bg-violet-500/[0.05]',
  Premium:  'border-yellow-500/30 bg-yellow-500/[0.04]',
};

export const TIER_BADGE: Record<string, string> = {
  Basic:    'bg-white/10 text-white/60',
  Standard: 'bg-violet-500/20 text-violet-300',
  Premium:  'bg-yellow-500/20 text-yellow-300',
};
