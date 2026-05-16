import { useState, useMemo, useEffect, createContext, useContext } from 'react';
import { api } from '@/lib/api';
import { ensureSession } from '@/lib/auth';
import {
  Users, LayoutDashboard, Megaphone, Globe, Handshake, Wallet,
  BarChart3, Link2, MessageCircle, Plus, Search, CheckCircle2,
  Clock, TrendingUp, Eye, Heart, MessageSquare, Share2, MousePointerClick,
  ShoppingCart, Download, Star, Send, Instagram,
  Smartphone, Copy, AlertCircle, Lock, Unlock, DollarSign, Target, Zap,
  Youtube, Twitter, Facebook
} from 'lucide-react';
function idHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

interface ApiCreator {
  id: string;
  name: string;
  handle: string;
  niche: string;
  followers: number;
  engagement: number;
  avatarUrl?: string | null;
  contactEmail?: string | null;
  platforms: string[];
  verified: boolean;
}
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ── Types ──────────────────────────────────────────────
type ModuleId = 'overview' | 'campaigns' | 'marketplace' | 'deals' | 'escrow' | 'performance' | 'affiliate' | 'messages';

interface Campaign {
  id: number; name: string; budget: number; creators: number;
  status: 'ACTIVE' | 'DRAFT' | 'SCHEDULED' | 'COMPLETED';
  views: number; engagement: number; conversions: number;
  startDate: string; endDate: string;
}

interface CreatorProfile {
  id: string; name: string; handle: string; niche: string;
  followers: number; engagement: number; rate: number; score: number;
  platforms: string[];
}

interface Deal {
  id: number; campaign: string; brand: string; total: number;
  upfront: number; upfrontWithdrawn: boolean;
  locked: number; released: number;
  kpiPercent: number; status: 'ACTIVE' | 'COMPLETED' | 'PENDING';
}

interface EscrowTx {
  id: number; date: string; campaign: string; creator: string;
  amount: number; type: 'Upfront' | 'Locked' | 'Released';
  status: 'Completed' | 'Pending' | 'Processing';
}

interface AffiliateLink {
  id: number; code: string; creator: string; campaign: string;
  clicks: number; purchases: number; revenue: number;
  status: 'Active' | 'Paused';
  discount: number;
}

interface Message {
  id: number; sender: string; avatar: string; preview: string;
  time: string; unread: boolean; messages: { from: string; text: string; time: string }[];
}

// ── Mock Data ──────────────────────────────────────────
const campaigns: Campaign[] = [
  { id: 1, name: 'Summer Collection Launch', budget: 5000, creators: 5, status: 'ACTIVE', views: 125000, engagement: 8.5, conversions: 340, startDate: '2024-06-01', endDate: '2024-08-31' },
  { id: 2, name: 'New Phone Case Line', budget: 3000, creators: 3, status: 'ACTIVE', views: 89000, engagement: 6.2, conversions: 210, startDate: '2024-07-01', endDate: '2024-09-15' },
  { id: 3, name: 'Back to School', budget: 8000, creators: 8, status: 'DRAFT', views: 0, engagement: 0, conversions: 0, startDate: '2024-08-15', endDate: '2024-09-30' },
  { id: 4, name: 'Holiday Special', budget: 12000, creators: 12, status: 'SCHEDULED', views: 0, engagement: 0, conversions: 0, startDate: '2024-11-01', endDate: '2024-12-31' },
  { id: 5, name: 'Flash Sale Promo', budget: 2000, creators: 2, status: 'COMPLETED', views: 210000, engagement: 12.1, conversions: 580, startDate: '2024-05-01', endDate: '2024-05-15' },
  { id: 6, name: 'Brand Awareness TZ', budget: 6000, creators: 6, status: 'ACTIVE', views: 67000, engagement: 5.8, conversions: 180, startDate: '2024-06-15', endDate: '2024-10-15' },
  { id: 7, name: 'Product Review Series', budget: 4000, creators: 4, status: 'ACTIVE', views: 45000, engagement: 9.2, conversions: 120, startDate: '2024-07-01', endDate: '2024-08-15' },
  { id: 8, name: 'Influencer Challenge', budget: 10000, creators: 15, status: 'DRAFT', views: 0, engagement: 0, conversions: 0, startDate: '2024-09-01', endDate: '2024-10-31' },
  { id: 9, name: 'App Install Campaign', budget: 7500, creators: 7, status: 'COMPLETED', views: 156000, engagement: 7.4, conversions: 420, startDate: '2024-04-01', endDate: '2024-06-30' },
  { id: 10, name: 'Loyalty Program Push', budget: 3500, creators: 3, status: 'SCHEDULED', views: 0, engagement: 0, conversions: 0, startDate: '2024-10-01', endDate: '2024-11-30' },
];

// Seed data for first-load when the /api/creators table is empty.
const seedCreators: Array<Omit<CreatorProfile, 'id'> & { platforms: string[] }> = [
  { name: 'Zara Hassan', handle: '@zarafashion', niche: 'Fashion', followers: 145000, engagement: 6.2, rate: 150, score: 9, platforms: ['Instagram', 'TikTok', 'YouTube'] },
  { name: 'Mike Tech', handle: '@miketechtz', niche: 'Tech', followers: 89000, engagement: 4.8, rate: 120, score: 8, platforms: ['YouTube', 'X', 'Instagram'] },
  { name: 'Chef Juma', handle: '@chefjumatz', niche: 'Food', followers: 234000, engagement: 7.1, rate: 200, score: 9, platforms: ['Instagram', 'TikTok', 'YouTube', 'Facebook'] },
  { name: 'Fit Sarah', handle: '@fitsara', niche: 'Fitness', followers: 67000, engagement: 5.5, rate: 100, score: 7, platforms: ['Instagram', 'YouTube', 'TikTok'] },
  { name: 'Beauty Amina', handle: '@beautyaminta', niche: 'Beauty', followers: 178000, engagement: 8.3, rate: 180, score: 10, platforms: ['Instagram', 'TikTok', 'YouTube'] },
];

function apiToProfile(c: ApiCreator): CreatorProfile {
  return {
    id: c.id,
    name: c.name,
    handle: c.handle,
    niche: c.niche || 'Other',
    followers: c.followers,
    engagement: c.engagement,
    rate: 0,
    score: c.verified ? 10 : 7,
    platforms: c.platforms,
  };
}

const deals: Deal[] = [
  { id: 1, campaign: 'Summer Collection', brand: 'Kobe Shop', total: 1000, upfront: 400, upfrontWithdrawn: true, locked: 600, released: 0, kpiPercent: 85, status: 'ACTIVE' },
  { id: 2, campaign: 'Phone Case Review', brand: 'Tech TZ', total: 800, upfront: 320, upfrontWithdrawn: false, locked: 480, released: 0, kpiPercent: 60, status: 'ACTIVE' },
  { id: 3, campaign: 'Flash Sale', brand: 'Quick Mart', total: 500, upfront: 200, upfrontWithdrawn: true, locked: 300, released: 300, kpiPercent: 120, status: 'COMPLETED' },
  { id: 4, campaign: 'Brand Awareness', brand: 'Tanzania Brew', total: 1500, upfront: 600, upfrontWithdrawn: false, locked: 900, released: 0, kpiPercent: 45, status: 'ACTIVE' },
  { id: 5, campaign: 'App Install', brand: 'Fintech App', total: 750, upfront: 300, upfrontWithdrawn: true, locked: 450, released: 450, kpiPercent: 100, status: 'COMPLETED' },
  { id: 6, campaign: 'Holiday Special', brand: 'Gift Store', total: 2000, upfront: 800, upfrontWithdrawn: false, locked: 1200, released: 0, kpiPercent: 0, status: 'PENDING' },
];

const escrowTxs: EscrowTx[] = [
  { id: 1, date: '2024-07-15', campaign: 'Summer Collection', creator: 'Zara Hassan', amount: 400, type: 'Upfront', status: 'Completed' },
  { id: 2, date: '2024-07-15', campaign: 'Summer Collection', creator: 'Zara Hassan', amount: 600, type: 'Locked', status: 'Pending' },
  { id: 3, date: '2024-07-12', campaign: 'Phone Case Review', creator: 'Mike Tech', amount: 320, type: 'Upfront', status: 'Completed' },
  { id: 4, date: '2024-07-12', campaign: 'Phone Case Review', creator: 'Mike Tech', amount: 480, type: 'Locked', status: 'Pending' },
  { id: 5, date: '2024-07-10', campaign: 'Flash Sale', creator: 'Comedy Rajab', amount: 200, type: 'Upfront', status: 'Completed' },
  { id: 6, date: '2024-07-10', campaign: 'Flash Sale', creator: 'Comedy Rajab', amount: 300, type: 'Locked', status: 'Completed' },
  { id: 7, date: '2024-07-10', campaign: 'Flash Sale', creator: 'Comedy Rajab', amount: 300, type: 'Released', status: 'Completed' },
  { id: 8, date: '2024-07-08', campaign: 'Brand Awareness', creator: 'Chef Juma', amount: 600, type: 'Upfront', status: 'Completed' },
  { id: 9, date: '2024-07-08', campaign: 'Brand Awareness', creator: 'Chef Juma', amount: 900, type: 'Locked', status: 'Pending' },
  { id: 10, date: '2024-07-05', campaign: 'App Install', creator: 'Gaming Joe', amount: 300, type: 'Upfront', status: 'Completed' },
  { id: 11, date: '2024-07-05', campaign: 'App Install', creator: 'Gaming Joe', amount: 450, type: 'Locked', status: 'Completed' },
  { id: 12, date: '2024-07-05', campaign: 'App Install', creator: 'Gaming Joe', amount: 450, type: 'Released', status: 'Completed' },
  { id: 13, date: '2024-07-01', campaign: 'Holiday Special', creator: 'Beauty Amina', amount: 800, type: 'Upfront', status: 'Pending' },
  { id: 14, date: '2024-07-01', campaign: 'Holiday Special', creator: 'Beauty Amina', amount: 1200, type: 'Locked', status: 'Pending' },
  { id: 15, date: '2024-06-28', campaign: 'Product Review', creator: 'Fit Sarah', amount: 250, type: 'Upfront', status: 'Completed' },
  { id: 16, date: '2024-06-28', campaign: 'Product Review', creator: 'Fit Sarah', amount: 350, type: 'Locked', status: 'Pending' },
  { id: 17, date: '2024-06-25', campaign: 'Summer Collection', creator: 'Style Peter', amount: 300, type: 'Upfront', status: 'Completed' },
  { id: 18, date: '2024-06-25', campaign: 'Summer Collection', creator: 'Style Peter', amount: 500, type: 'Locked', status: 'Pending' },
  { id: 19, date: '2024-06-20', campaign: 'Phone Case Review', creator: 'Mike Tech', amount: 200, type: 'Released', status: 'Completed' },
  { id: 20, date: '2024-06-18', campaign: 'Flash Sale', creator: 'Comedy Rajab', amount: 150, type: 'Released', status: 'Completed' },
];

const affiliateLinks: AffiliateLink[] = [
  { id: 1, code: 'kobeshop.com/summer?ref=ZARA10', creator: 'Zara Hassan', campaign: 'Summer Collection', clicks: 1240, purchases: 48, revenue: 2400, status: 'Active', discount: 10 },
  { id: 2, code: 'kobeshop.com/tech?ref=MIKE20', creator: 'Mike Tech', campaign: 'Phone Case Review', clicks: 890, purchases: 32, revenue: 1600, status: 'Active', discount: 20 },
  { id: 3, code: 'kobeshop.com/food?ref=CHEF15', creator: 'Chef Juma', campaign: 'Brand Awareness', clicks: 1560, purchases: 67, revenue: 3350, status: 'Active', discount: 15 },
  { id: 4, code: 'kobeshop.com/fit?ref=FIT25', creator: 'Fit Sarah', campaign: 'Product Review', clicks: 420, purchases: 18, revenue: 720, status: 'Active', discount: 25 },
  { id: 5, code: 'kobeshop.com/beauty?ref=AMINA30', creator: 'Beauty Amina', campaign: 'Holiday Special', clicks: 2100, purchases: 95, revenue: 5700, status: 'Paused', discount: 30 },
  { id: 6, code: 'kobeshop.com/comedy?ref=RAJAB10', creator: 'Comedy Rajab', campaign: 'Flash Sale', clicks: 3400, purchases: 142, revenue: 5680, status: 'Active', discount: 10 },
  { id: 7, code: 'kobeshop.com/edu?ref=GRACE15', creator: 'Edu Grace', campaign: 'App Install', clicks: 180, purchases: 8, revenue: 240, status: 'Active', discount: 15 },
  { id: 8, code: 'kobeshop.com/style?ref=PETER20', creator: 'Style Peter', campaign: 'Summer Collection', clicks: 680, purchases: 29, revenue: 1450, status: 'Active', discount: 20 },
  { id: 9, code: 'kobeshop.com/game?ref=JOE10', creator: 'Gaming Joe', campaign: 'App Install', clicks: 920, purchases: 38, revenue: 950, status: 'Active', discount: 10 },
  { id: 10, code: 'kobeshop.com/health?ref=MAMA20', creator: 'Health Mama', campaign: 'Product Review', clicks: 560, purchases: 22, revenue: 880, status: 'Active', discount: 20 },
];

const messages: Message[] = [
  { id: 1, sender: 'Zara Hassan', avatar: 'ZH', preview: 'Summer Collection brief attached', time: '3 min ago', unread: true,
    messages: [
      { from: 'Zara Hassan', text: 'Hi! I have reviewed the brief for the Summer Collection campaign.', time: '10:00 AM' },
      { from: 'You', text: 'Great! Do you have any questions about the deliverables?', time: '10:05 AM' },
      { from: 'Zara Hassan', text: 'Summer Collection brief attached. Let me know if the mood board works!', time: '10:30 AM' },
    ] },
  { id: 2, sender: 'Mike Tech', avatar: 'MT', preview: 'Can we negotiate the rate?', time: '1 hour ago', unread: true,
    messages: [
      { from: 'Mike Tech', text: 'Hey, I got your campaign offer. Can we negotiate the rate?', time: '9:00 AM' },
      { from: 'You', text: 'What did you have in mind? Our budget is flexible.', time: '9:30 AM' },
      { from: 'Mike Tech', text: 'I was thinking $140 per post given my engagement rates.', time: '10:00 AM' },
    ] },
  { id: 3, sender: 'Chef Juma', avatar: 'CJ', preview: 'Content submitted for review', time: '2 hours ago', unread: false,
    messages: [
      { from: 'Chef Juma', text: 'Content submitted for review. Please check the drive link!', time: '8:00 AM' },
      { from: 'You', text: 'Thanks Juma! I will review it within 2 hours.', time: '8:30 AM' },
    ] },
  { id: 4, sender: 'Brand X Admin', avatar: 'BX', preview: 'Campaign approved, funds in escrow', time: 'Yesterday', unread: false,
    messages: [
      { from: 'Brand X Admin', text: 'Your Holiday Special campaign has been approved.', time: 'Yesterday' },
      { from: 'Brand X Admin', text: 'Funds ($12,000) are now in escrow.', time: 'Yesterday' },
      { from: 'You', text: 'Excellent! I will start onboarding creators.', time: 'Yesterday' },
    ] },
  { id: 5, sender: 'Support', avatar: 'SP', preview: 'Welcome to Creator Platform', time: '2 days ago', unread: false,
    messages: [
      { from: 'Support', text: 'Welcome to Creator Platform! We are excited to have you.', time: '2 days ago' },
      { from: 'Support', text: 'Check out our getting started guide.', time: '2 days ago' },
    ] },
];

const chartColors = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#f97316', '#14b8a6'];

const performanceData = [
  { day: 'Mon', views: 12500, engagement: 890, conversions: 42 },
  { day: 'Tue', views: 18200, engagement: 1200, conversions: 58 },
  { day: 'Wed', views: 15800, engagement: 1050, conversions: 51 },
  { day: 'Thu', views: 22100, engagement: 1560, conversions: 72 },
  { day: 'Fri', views: 19400, engagement: 1320, conversions: 65 },
  { day: 'Sat', views: 26700, engagement: 1890, conversions: 89 },
  { day: 'Sun', views: 24300, engagement: 1650, conversions: 78 },
];

const escrowFlowData = [
  { week: 'W1', deposits: 12000, releases: 4500 },
  { week: 'W2', deposits: 8500, releases: 6200 },
  { week: 'W3', deposits: 15000, releases: 3800 },
  { week: 'W4', deposits: 9500, releases: 14000 },
];

const creatorPerfData = [
  { creator: 'Zara H.', posts: 4, views: 45000, engagement: '6.2%', conversions: 89, earned: 840, kpiMet: 92 },
  { creator: 'Mike T.', posts: 3, views: 28000, engagement: '4.8%', conversions: 52, earned: 620, kpiMet: 78 },
  { creator: 'Chef J.', posts: 5, views: 62000, engagement: '7.1%', conversions: 120, earned: 1120, kpiMet: 98 },
  { creator: 'Fit S.', posts: 3, views: 18000, engagement: '5.5%', conversions: 34, earned: 480, kpiMet: 85 },
  { creator: 'Beauty A.', posts: 4, views: 51000, engagement: '8.3%', conversions: 95, earned: 960, kpiMet: 105 },
  { creator: 'Comedy R.', posts: 6, views: 78000, engagement: '9.1%', conversions: 156, earned: 1350, kpiMet: 120 },
  { creator: 'Gaming J.', posts: 4, views: 34000, engagement: '6.8%', conversions: 62, earned: 720, kpiMet: 88 },
  { creator: 'Style P.', posts: 3, views: 22000, engagement: '5.9%', conversions: 41, earned: 540, kpiMet: 82 },
];

const kpiTargets = [
  { name: 'Views', icon: Eye, current: 125000, target: 100000, color: '#06b6d4' },
  { name: 'Likes', icon: Heart, current: 8500, target: 10000, color: '#ec4899' },
  { name: 'Comments', icon: MessageSquare, current: 1200, target: 500, color: '#8b5cf6' },
  { name: 'Shares', icon: Share2, current: 450, target: 1000, color: '#10b981' },
  { name: 'Link Clicks', icon: MousePointerClick, current: 320, target: 500, color: '#f59e0b' },
  { name: 'Purchases', icon: ShoppingCart, current: 42, target: 50, color: '#3b82f6' },
  { name: 'Engagement Rate', icon: Target, current: 7.2, target: 5, color: '#f97316', isPercent: true },
];

const recentActivity = [
  { text: 'Kobe Shop hired Zara Hassan for Summer Collection', time: '3 min ago', icon: Handshake, color: '#8b5cf6' },
  { text: 'Flash Sale campaign reached 200K views milestone', time: '25 min ago', icon: Eye, color: '#06b6d4' },
  { text: 'Escrow released: $1,200 to Comedy Rajab', time: '1 hour ago', icon: Unlock, color: '#10b981' },
  { text: 'New affiliate link created: ZARA10', time: '2 hours ago', icon: Link2, color: '#f59e0b' },
  { text: 'Phone Case Review KPI at 60% completion', time: '3 hours ago', icon: Target, color: '#ec4899' },
  { text: 'Chef Juma submitted content for review', time: '5 hours ago', icon: CheckCircle2, color: '#10b981' },
  { text: '$8,000 deposited to escrow for Back to School', time: '8 hours ago', icon: Lock, color: '#f59e0b' },
  { text: 'Beauty Amina completed Holiday Special onboarding', time: '1 day ago', icon: Star, color: '#8b5cf6' },
];

// ── Helper Components ──────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
    DRAFT: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
    SCHEDULED: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    COMPLETED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    PENDING: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    Paused: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.DRAFT}`}>
      {status}
    </span>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  switch (platform) {
    case 'Instagram': return <Instagram className="w-3.5 h-3.5" />;
    case 'TikTok': return <Smartphone className="w-3.5 h-3.5" />;
    case 'YouTube': return <Youtube className="w-3.5 h-3.5" />;
    case 'X': return <Twitter className="w-3.5 h-3.5" />;
    case 'Facebook': return <Facebook className="w-3.5 h-3.5" />;
    default: return null;
  }
}

// ── Creators Context (API-backed) ──────────────────────
const CreatorsContext = createContext<CreatorProfile[]>([]);
const useCreators = () => useContext(CreatorsContext);

// ── Sidebar Tile Component ─────────────────────────────
function SidebarTile({ icon: Icon, label, desc, active, onClick, color }: {
  icon: React.ElementType; label: string; desc: string; active: boolean; onClick: () => void; color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 text-left
        ${active ? `bg-[${color}]/10 border-[${color}]/30` : 'bg-white/[0.02] border-transparent hover:bg-white/[0.05]'}`}
      style={active ? { backgroundColor: `${color}15`, borderColor: `${color}40` } : {}}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0`}
        style={{ backgroundColor: active ? `${color}25` : 'rgba(255,255,255,0.05)', color: active ? color : '#94a3b8' }}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="min-w-0">
        <div className={`text-sm font-medium ${active ? 'text-white' : 'text-slate-300'}`}>{label}</div>
        <div className="text-xs text-slate-500 truncate">{desc}</div>
      </div>
    </button>
  );
}

// ── Main Export ────────────────────────────────────────
export default function Creator() {
  const [activeModule, setActiveModule] = useState<ModuleId>('overview');
  const [creators, setCreators] = useState<CreatorProfile[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSession();
        let list = await api<ApiCreator[]>('/creators');
        if (list.length === 0) {
          await Promise.all(seedCreators.map((s) =>
            api<ApiCreator>('/creators', {
              method: 'POST',
              body: JSON.stringify({
                name: s.name, handle: s.handle, niche: s.niche,
                followers: s.followers, engagement: s.engagement,
                platforms: s.platforms,
              }),
            }),
          ));
          list = await api<ApiCreator[]>('/creators');
        }
        if (!cancelled) setCreators(list.map(apiToProfile));
      } catch {
        // soft-fail: app remains usable with empty creators
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sidebarItems: { id: ModuleId; icon: React.ElementType; label: string; desc: string; color: string }[] = [
    { id: 'overview', icon: LayoutDashboard, label: 'Overview', desc: 'Dashboard & analytics', color: '#06b6d4' },
    { id: 'campaigns', icon: Megaphone, label: 'Campaigns', desc: 'Manage campaigns', color: '#8b5cf6' },
    { id: 'marketplace', icon: Globe, label: 'Marketplace', desc: 'Find creators', color: '#10b981' },
    { id: 'deals', icon: Handshake, label: 'My Deals', desc: 'Active agreements', color: '#f59e0b' },
    { id: 'escrow', icon: Wallet, label: 'Escrow', desc: 'Payments & wallet', color: '#ec4899' },
    { id: 'performance', icon: BarChart3, label: 'Performance', desc: 'KPI tracking', color: '#f97316' },
    { id: 'affiliate', icon: Link2, label: 'Affiliate', desc: 'Links & codes', color: '#06b6d4' },
    { id: 'messages', icon: MessageCircle, label: 'Messages', desc: 'Chat & notifications', color: '#8b5cf6' },
  ];

  return (
    <CreatorsContext.Provider value={creators}>
    <div className="flex h-full w-full bg-[#0a0a1a] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-[#0c0c1a] border-r border-white/[0.06] flex flex-col shrink-0">
        <div className="px-4 pt-5 pb-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400">
            <Users className="w-4.5 h-4.5" />
          </div>
          <span className="text-sm font-bold tracking-wide text-white">CREATOR</span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="space-y-1.5">
            {sidebarItems.map((item) => (
              <SidebarTile
                key={item.id}
                icon={item.icon}
                label={item.label}
                desc={item.desc}
                active={activeModule === item.id}
                onClick={() => setActiveModule(item.id)}
                color={item.color}
              />
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {activeModule === 'overview' && <OverviewModule setActiveModule={setActiveModule} />}
        {activeModule === 'campaigns' && <CampaignsModule />}
        {activeModule === 'marketplace' && <MarketplaceModule />}
        {activeModule === 'deals' && <DealsModule />}
        {activeModule === 'escrow' && <EscrowModule />}
        {activeModule === 'performance' && <PerformanceModule />}
        {activeModule === 'affiliate' && <AffiliateModule />}
        {activeModule === 'messages' && <MessagesModule />}
      </main>
    </div>
    </CreatorsContext.Provider>
  );
}

// ── Module 1: Overview ─────────────────────────────────
function OverviewModule({ setActiveModule }: { setActiveModule: (m: ModuleId) => void }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Dashboard Overview</h1>
            <p className="text-sm text-slate-400 mt-0.5">Track your campaigns, escrow, and performance</p>
          </div>
          <div className="text-xs text-slate-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Active Campaigns', value: '8', icon: Megaphone, color: '#06b6d4', sub: '2 scheduled' },
            { label: 'Total Creators', value: '24', icon: Users, color: '#8b5cf6', sub: '6 new this month' },
            { label: 'Escrow Locked', value: '$45,000', icon: Lock, color: '#f59e0b', sub: 'Across 12 deals' },
            { label: 'Released This Month', value: '$28,500', icon: Unlock, color: '#10b981', sub: '+12% from last month' },
          ].map((kpi, i) => (
            <Card key={i} className="bg-[#13131f] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${kpi.color}20`, color: kpi.color }}>
                    <kpi.icon className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white">{kpi.value}</div>
                <div className="text-xs text-slate-400 mt-0.5">{kpi.label}</div>
                <div className="text-xs mt-2" style={{ color: kpi.color }}>{kpi.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-white mb-4">Campaign Performance</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} /><stop offset="95%" stopColor="#06b6d4" stopOpacity={0} /></linearGradient>
                    <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                  <Area type="monotone" dataKey="views" stroke="#06b6d4" fill="url(#viewsGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="engagement" stroke="#8b5cf6" fill="url(#engGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-white mb-4">Escrow Flow</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={escrowFlowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="week" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                  <Bar dataKey="deposits" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="releases" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Recent Activity */}
          <Card className="bg-[#13131f] border-white/[0.06] col-span-2">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Recent Activity</h3>
              <div className="space-y-3">
                {recentActivity.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.color}15`, color: item.color }}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 truncate">{item.text}</div>
                      <div className="text-xs text-slate-500">{item.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Button className="w-full justify-start gap-2 bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 border border-cyan-500/20" onClick={() => setActiveModule('campaigns')}>
                  <Plus className="w-4 h-4" /> New Campaign
                </Button>
                <Button className="w-full justify-start gap-2 bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 border border-violet-500/20" onClick={() => setActiveModule('marketplace')}>
                  <Search className="w-4 h-4" /> Find Creators
                </Button>
                <Button className="w-full justify-start gap-2 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20" onClick={() => setActiveModule('escrow')}>
                  <Wallet className="w-4 h-4" /> View Escrow
                </Button>
                <Button className="w-full justify-start gap-2 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20" onClick={() => setActiveModule('performance')}>
                  <BarChart3 className="w-4 h-4" /> Performance
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Module 2: Campaigns ────────────────────────────────
function CampaignsModule() {
  const creators = useCreators();
  const [filter, setFilter] = useState('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: '', description: '', budget: '', creators: [] as string[], upfrontPercent: 40, perfPercent: 60 });

  const filtered = filter === 'ALL' ? campaigns : campaigns.filter(c => c.status === filter);

  const statusGradients: Record<string, string> = {
    ACTIVE: 'from-cyan-500/20 to-cyan-900/10',
    DRAFT: 'from-slate-500/20 to-slate-900/10',
    SCHEDULED: 'from-amber-500/20 to-amber-900/10',
    COMPLETED: 'from-emerald-500/20 to-emerald-900/10',
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Campaigns</h1>
            <p className="text-sm text-slate-400 mt-0.5">Manage and track all your campaigns</p>
          </div>
          <Button className="bg-cyan-500 hover:bg-cyan-600 text-white gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" /> Create Campaign
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {['ALL', 'ACTIVE', 'DRAFT', 'SCHEDULED', 'COMPLETED'].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${filter === f ? 'bg-white/10 text-white border-white/20' : 'text-slate-400 border-transparent hover:bg-white/5'}`}>
              {f}
            </button>
          ))}
        </div>

        {/* Campaign Grid */}
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((camp) => (
            <Card key={camp.id} className="bg-[#13131f] border-white/[0.06] overflow-hidden">
              <div className={`h-2 bg-gradient-to-r ${statusGradients[camp.status]}`} />
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{camp.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{camp.startDate} to {camp.endDate}</p>
                  </div>
                  <StatusBadge status={camp.status} />
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                    <div className="text-xs text-slate-400">Budget</div>
                    <div className="text-sm font-semibold text-white">${camp.budget.toLocaleString()}</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                    <div className="text-xs text-slate-400">Creators</div>
                    <div className="text-sm font-semibold text-white">{camp.creators}</div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                    <div className="text-xs text-slate-400">Views</div>
                    <div className="text-sm font-semibold text-white">{camp.views > 0 ? `${(camp.views / 1000).toFixed(0)}K` : '-'}</div>
                  </div>
                </div>
                {camp.status === 'ACTIVE' || camp.status === 'COMPLETED' ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Engagement</span>
                      <span className="text-cyan-400">{camp.engagement}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full" style={{ width: `${Math.min(camp.engagement * 10, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Conversions</span>
                      <span className="text-emerald-400">{camp.conversions}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    {camp.status === 'DRAFT' ? 'Draft - not yet published' : `Starts ${camp.startDate}`}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Create Campaign Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-[#13131f] border-white/[0.06] text-white max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Create New Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Campaign Name</label>
              <Input className="bg-white/5 border-white/10 text-white" placeholder="e.g. Summer Collection Launch" value={newCampaign.name} onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Description</label>
              <Input className="bg-white/5 border-white/10 text-white" placeholder="Brief campaign description" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Budget ($)</label>
              <Input type="number" className="bg-white/5 border-white/10 text-white" placeholder="5000" value={newCampaign.budget} onChange={(e) => setNewCampaign({ ...newCampaign, budget: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Target KPIs</label>
              <div className="grid grid-cols-2 gap-2">
                {['Views', 'Likes', 'Comments', 'Shares', 'Link Clicks', 'Purchases', 'Installs', 'Engagement Rate'].map((kpi) => (
                  <label key={kpi} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" className="rounded border-white/20 bg-white/5" />
                    {kpi}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Select Creators</label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {creators.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer p-1.5 rounded hover:bg-white/5">
                    <input type="checkbox" className="rounded border-white/20 bg-white/5"
                      checked={newCampaign.creators.includes(c.id)}
                      onChange={() => setNewCampaign({ ...newCampaign, creators: newCampaign.creators.includes(c.id) ? newCampaign.creators.filter(x => x !== c.id) : [...newCampaign.creators, c.id] })} />
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: chartColors[idHash(c.id) % chartColors.length] + '30', color: chartColors[idHash(c.id) % chartColors.length] }}>
                      {c.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    {c.name} <span className="text-slate-500">{c.handle}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Upfront %</label>
                <Input type="number" className="bg-white/5 border-white/10 text-white" value={newCampaign.upfrontPercent} onChange={(e) => setNewCampaign({ ...newCampaign, upfrontPercent: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Performance %</label>
                <Input type="number" className="bg-white/5 border-white/10 text-white" value={newCampaign.perfPercent} onChange={(e) => setNewCampaign({ ...newCampaign, perfPercent: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <Button className="w-full bg-cyan-500 hover:bg-cyan-600 text-white mt-2" onClick={() => setCreateOpen(false)}>
              Create Campaign
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Module 3: Marketplace ──────────────────────────────
function MarketplaceModule() {
  const creators = useCreators();
  const [search, setSearch] = useState('');
  const [nicheFilter, setNicheFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('engagement');
  const [hireDialogOpen, setHireDialogOpen] = useState(false);
  const [selectedCreator, setSelectedCreator] = useState<CreatorProfile | null>(null);

  const niches = ['ALL', ...Array.from(new Set(creators.map(c => c.niche)))];

  const filtered = useMemo(() => {
    const list = creators.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.handle.toLowerCase().includes(search.toLowerCase());
      const matchNiche = nicheFilter === 'ALL' || c.niche === nicheFilter;
      return matchSearch && matchNiche;
    });
    return list.sort((a, b) => {
      if (sortBy === 'engagement') return b.engagement - a.engagement;
      if (sortBy === 'followers') return b.followers - a.followers;
      if (sortBy === 'price') return a.rate - b.rate;
      return 0;
    });
  }, [creators, search, nicheFilter, sortBy]);

  const engagementColor = (e: number) => e > 5 ? '#10b981' : e >= 3 ? '#f59e0b' : '#ef4444';

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Creator Marketplace</h1>
            <p className="text-sm text-slate-400 mt-0.5">Discover and hire top creators</p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input className="pl-9 bg-white/5 border-white/10 text-white" placeholder="Search creators..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={nicheFilter} onValueChange={setNicheFilter}>
            <SelectTrigger className="w-36 bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#1e1e2e] border-white/10 text-white">
              {niches.map(n => <SelectItem key={n} value={n} className="text-white hover:bg-white/10">{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-36 bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#1e1e2e] border-white/10 text-white">
              <SelectItem value="engagement" className="text-white hover:bg-white/10">Engagement</SelectItem>
              <SelectItem value="followers" className="text-white hover:bg-white/10">Followers</SelectItem>
              <SelectItem value="price" className="text-white hover:bg-white/10">Lowest Price</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Creator Grid */}
        <div className="grid grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Card key={c.id} className="bg-[#13131f] border-white/[0.06] hover:border-white/[0.12] transition-all">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: chartColors[idHash(c.id) % chartColors.length] + '30', color: chartColors[idHash(c.id) % chartColors.length] }}>
                    {c.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white truncate">{c.name}</div>
                    <div className="text-xs text-slate-400">{c.handle}</div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-xs text-amber-400 font-medium">{c.score}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 text-slate-300 border border-white/10">{c.niche}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium border" style={{ backgroundColor: engagementColor(c.engagement) + '15', color: engagementColor(c.engagement), borderColor: engagementColor(c.engagement) + '30' }}>
                    {c.engagement}% eng.
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                  <span>{(c.followers / 1000).toFixed(0)}K followers</span>
                  <span className="text-white font-medium">${c.rate}/post</span>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  {c.platforms.map(p => (
                    <div key={p} className="w-7 h-7 rounded-md bg-white/5 flex items-center justify-center text-slate-400">
                      <PlatformIcon platform={p} />
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 text-xs h-8" onClick={() => { setSelectedCreator(c); setHireDialogOpen(true); }}>
                    View Profile
                  </Button>
                  <Button className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white text-xs h-8" onClick={() => { setSelectedCreator(c); setHireDialogOpen(true); }}>
                    Hire
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Hire Dialog */}
      <Dialog open={hireDialogOpen} onOpenChange={setHireDialogOpen}>
        <DialogContent className="bg-[#13131f] border-white/[0.06] text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Hire Creator</DialogTitle>
          </DialogHeader>
          {selectedCreator && (
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold" style={{ backgroundColor: chartColors[idHash(selectedCreator.id) % chartColors.length] + '30', color: chartColors[idHash(selectedCreator.id) % chartColors.length] }}>
                  {selectedCreator.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="font-semibold text-white">{selectedCreator.name}</div>
                  <div className="text-sm text-slate-400">{selectedCreator.handle} · {selectedCreator.niche}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white/5 rounded-lg p-2.5">
                  <div className="text-sm font-semibold text-white">{(selectedCreator.followers / 1000).toFixed(0)}K</div>
                  <div className="text-xs text-slate-400">Followers</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2.5">
                  <div className="text-sm font-semibold text-white">{selectedCreator.engagement}%</div>
                  <div className="text-xs text-slate-400">Engagement</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2.5">
                  <div className="text-sm font-semibold text-white">${selectedCreator.rate}</div>
                  <div className="text-xs text-slate-400">Per Post</div>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Select Campaign</label>
                <Select>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Choose campaign" /></SelectTrigger>
                  <SelectContent className="bg-[#1e1e2e] border-white/10 text-white">
                    {campaigns.filter(c => c.status === 'ACTIVE' || c.status === 'DRAFT').map(c => (
                      <SelectItem key={c.id} value={String(c.id)} className="text-white hover:bg-white/10">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full bg-cyan-500 hover:bg-cyan-600 text-white">Send Hire Request</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Module 4: My Deals ─────────────────────────────────
function DealsModule() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-white">My Deals</h1>
          <p className="text-sm text-slate-400 mt-0.5">Track your active and completed deals</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {deals.map((deal) => {
            const kpiColor = deal.kpiPercent >= 100 ? '#10b981' : deal.kpiPercent >= 70 ? '#f59e0b' : deal.kpiPercent >= 50 ? '#f97316' : '#ef4444';
            return (
              <Card key={deal.id} className="bg-[#13131f] border-white/[0.06]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{deal.campaign}</h3>
                      <p className="text-xs text-slate-400">{deal.brand}</p>
                    </div>
                    <StatusBadge status={deal.status} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-white/[0.03] rounded-lg p-2.5">
                      <div className="text-xs text-slate-400">Total</div>
                      <div className="text-sm font-semibold text-white">${deal.total}</div>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-2.5">
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        Upfront {deal.upfrontWithdrawn && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                      </div>
                      <div className="text-sm font-semibold text-white">${deal.upfront}</div>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg p-2.5">
                      <div className="text-xs text-slate-400">Locked</div>
                      <div className="text-sm font-semibold text-white">${deal.locked}</div>
                    </div>
                  </div>

                  {deal.status !== 'PENDING' && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">KPI Progress</span>
                        <span style={{ color: kpiColor }}>{deal.kpiPercent}%</span>
                      </div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(deal.kpiPercent, 100)}%`, backgroundColor: kpiColor }} />
                      </div>
                    </div>
                  )}

                  {deal.released > 0 && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400 mb-3">
                      <Unlock className="w-3.5 h-3.5" /> ${deal.released} released
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 text-xs h-8">View Details</Button>
                    {deal.upfront > 0 && !deal.upfrontWithdrawn && deal.status !== 'PENDING' && (
                      <Button className="flex-1 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 text-xs h-8">
                        <Download className="w-3.5 h-3.5 mr-1" /> Withdraw
                      </Button>
                    )}
                    {deal.status === 'ACTIVE' && (
                      <Button className="flex-1 bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 border border-cyan-500/20 text-xs h-8">
                        Submit Work
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Module 5: Escrow ───────────────────────────────────
function EscrowModule() {
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('mpesa');

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-white">Escrow Wallet</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage funds, withdrawals, and releases</p>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Balance', value: '$45,000', icon: Wallet, color: '#06b6d4' },
            { label: 'Available', value: '$12,800', icon: Unlock, color: '#10b981' },
            { label: 'Locked (Perf.)', value: '$32,200', icon: Lock, color: '#f59e0b' },
            { label: 'Released (Mo.)', value: '$18,500', icon: DollarSign, color: '#8b5cf6' },
          ].map((b, i) => (
            <Card key={i} className="bg-[#13131f] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${b.color}20`, color: b.color }}>
                    <b.icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl font-bold text-white">{b.value}</div>
                <div className="text-xs text-slate-400">{b.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Withdrawal Form */}
          <Card className="bg-[#13131f] border-white/[0.06] col-span-1">
            <CardContent className="p-4 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-400" /> Withdraw Funds
              </h3>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Amount ($)</label>
                <Input type="number" className="bg-white/5 border-white/10 text-white" placeholder="Enter amount" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Method</label>
                <Select value={withdrawMethod} onValueChange={setWithdrawMethod}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1e1e2e] border-white/10 text-white">
                    {['M-Pesa', 'Bank Transfer', 'Airtel Money', 'Tigo Pesa', 'HaloPesa', 'KOBE Pay Wallet'].map(m => (
                      <SelectItem key={m} value={m.toLowerCase().replace(/\s/g, '')} className="text-white hover:bg-white/10">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Phone / Account</label>
                <Input className="bg-white/5 border-white/10 text-white" placeholder="e.g. 0712 345 678" />
              </div>
              <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
                <Download className="w-4 h-4 mr-1" /> Withdraw
              </Button>
            </CardContent>
          </Card>

          {/* Release Logic */}
          <Card className="bg-[#13131f] border-white/[0.06] col-span-1">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" /> Release Rules
              </h3>
              <div className="space-y-2.5">
                {[
                  { range: '0-49%', release: 'No release', color: '#ef4444' },
                  { range: '50-69%', release: '25% of locked', color: '#f97316' },
                  { range: '70-89%', release: '50% of locked', color: '#f59e0b' },
                  { range: '90-99%', release: '75% of locked', color: '#84cc16' },
                  { range: '100%+', release: '100% + bonus', color: '#10b981' },
                ].map((rule, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03]">
                    <span className="text-xs text-slate-300 font-medium">{rule.range}</span>
                    <span className="text-xs font-medium" style={{ color: rule.color }}>{rule.release}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Escrow Stats */}
          <Card className="bg-[#13131f] border-white/[0.06] col-span-1">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-white mb-3">This Month</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Deposits</span>
                  <span className="text-amber-400 font-medium">$35,200</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Releases</span>
                  <span className="text-emerald-400 font-medium">$18,500</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Pending</span>
                  <span className="text-blue-400 font-medium">$12,800</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Creators Paid</span>
                  <span className="text-violet-400 font-medium">14</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full" style={{ width: '52%' }} />
                </div>
                <div className="text-xs text-slate-500 text-center">52% release ratio</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Escrow Transactions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-white/[0.06]">
                    <th className="text-left py-2 px-3">Date</th>
                    <th className="text-left py-2 px-3">Campaign</th>
                    <th className="text-left py-2 px-3">Creator</th>
                    <th className="text-left py-2 px-3">Amount</th>
                    <th className="text-left py-2 px-3">Type</th>
                    <th className="text-left py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {escrowTxs.map((tx) => (
                    <tr key={tx.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="py-2 px-3 text-slate-300">{tx.date}</td>
                      <td className="py-2 px-3 text-white">{tx.campaign}</td>
                      <td className="py-2 px-3 text-slate-300">{tx.creator}</td>
                      <td className="py-2 px-3 font-medium text-white">${tx.amount.toLocaleString()}</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          tx.type === 'Upfront' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          tx.type === 'Locked' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>{tx.type}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`text-xs ${tx.status === 'Completed' ? 'text-emerald-400' : tx.status === 'Processing' ? 'text-amber-400' : 'text-blue-400'}`}>{tx.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Module 6: Performance ──────────────────────────────
function PerformanceModule() {
  const [roiBudget, setRoiBudget] = useState('5000');
  const [roiViews, setRoiViews] = useState('100000');
  const [roiConv, setRoiConv] = useState('2.5');
  const [roiPrice, setRoiPrice] = useState('50');

  const roi = useMemo(() => {
    const budget = parseFloat(roiBudget) || 0;
    const views = parseFloat(roiViews) || 0;
    const convRate = parseFloat(roiConv) || 0;
    const price = parseFloat(roiPrice) || 0;
    const conversions = views * (convRate / 100);
    const revenue = conversions * price;
    const roiValue = budget > 0 ? ((revenue - budget) / budget * 100) : 0;
    return { conversions: Math.round(conversions), revenue, roi: roiValue.toFixed(1), cpv: views > 0 ? (budget / views).toFixed(3) : '0', cpc: conversions > 0 ? (budget / conversions).toFixed(2) : '0' };
  }, [roiBudget, roiViews, roiConv, roiPrice]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-white">Performance</h1>
          <p className="text-sm text-slate-400 mt-0.5">Track KPIs and creator performance</p>
        </div>

        {/* KPI Dashboard */}
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white mb-4">KPI Dashboard — Summer Collection Launch</h3>
            <div className="grid grid-cols-4 gap-4">
              {kpiTargets.map((kpi) => {
                const pct = kpi.isPercent ? (kpi.current / kpi.target * 100) : (kpi.current / kpi.target * 100);
                const met = pct >= 100;
                return (
                  <div key={kpi.name} className="bg-white/[0.03] rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: kpi.color + '20', color: kpi.color }}>
                        <kpi.icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs text-slate-400">{kpi.name}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span className="text-lg font-bold text-white">{kpi.isPercent ? `${kpi.current}%` : kpi.current.toLocaleString()}</span>
                      <span className="text-xs text-slate-500">/ {kpi.isPercent ? `${kpi.target}%` : kpi.target.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-1">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: met ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444' }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: met ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444' }}>{pct.toFixed(0)}%</span>
                      {met ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          {/* Creator Performance Table */}
          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Creator Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-white/[0.06]">
                      <th className="text-left py-2 px-2">Creator</th>
                      <th className="text-left py-2 px-2">Posts</th>
                      <th className="text-left py-2 px-2">Views</th>
                      <th className="text-left py-2 px-2">Eng.</th>
                      <th className="text-left py-2 px-2">Conv.</th>
                      <th className="text-left py-2 px-2">Earned</th>
                      <th className="text-left py-2 px-2">KPI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creatorPerfData.map((c, i) => (
                      <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="py-2 px-2 text-white font-medium">{c.creator}</td>
                        <td className="py-2 px-2 text-slate-300">{c.posts}</td>
                        <td className="py-2 px-2 text-slate-300">{(c.views / 1000).toFixed(0)}K</td>
                        <td className="py-2 px-2 text-slate-300">{c.engagement}</td>
                        <td className="py-2 px-2 text-slate-300">{c.conversions}</td>
                        <td className="py-2 px-2 text-emerald-400">${c.earned}</td>
                        <td className="py-2 px-2">
                          <span className={`text-xs ${c.kpiMet >= 100 ? 'text-emerald-400' : c.kpiMet >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{c.kpiMet}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ROI Calculator */}
          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-400" /> ROI Calculator
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Budget ($)</label>
                  <Input type="number" className="bg-white/5 border-white/10 text-white h-8" value={roiBudget} onChange={(e) => setRoiBudget(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Expected Views</label>
                  <Input type="number" className="bg-white/5 border-white/10 text-white h-8" value={roiViews} onChange={(e) => setRoiViews(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Conv. Rate (%)</label>
                  <Input type="number" className="bg-white/5 border-white/10 text-white h-8" value={roiConv} onChange={(e) => setRoiConv(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Product Price ($)</label>
                  <Input type="number" className="bg-white/5 border-white/10 text-white h-8" value={roiPrice} onChange={(e) => setRoiPrice(e.target.value)} />
                </div>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Est. Conversions</span>
                  <span className="text-white font-medium">{roi.conversions}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Est. Revenue</span>
                  <span className="text-emerald-400 font-medium">${roi.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">ROI</span>
                  <span className={`font-medium ${parseFloat(roi.roi) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{roi.roi}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Cost per View</span>
                  <span className="text-white font-medium">${roi.cpv}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Cost per Conversion</span>
                  <span className="text-white font-medium">${roi.cpc}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Module 7: Affiliate ────────────────────────────────
function AffiliateModule() {
  const creators = useCreators();
  const [createLinkOpen, setCreateLinkOpen] = useState(false);

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Affiliate Links</h1>
            <p className="text-sm text-slate-400 mt-0.5">Manage promo codes and tracking links</p>
          </div>
          <Button className="bg-cyan-500 hover:bg-cyan-600 text-white gap-2" onClick={() => setCreateLinkOpen(true)}>
            <Plus className="w-4 h-4" /> Create Link
          </Button>
        </div>

        {/* Links Table */}
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Tracking Links</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-white/[0.06]">
                    <th className="text-left py-2 px-3">Code</th>
                    <th className="text-left py-2 px-3">Creator</th>
                    <th className="text-left py-2 px-3">Campaign</th>
                    <th className="text-left py-2 px-3">Clicks</th>
                    <th className="text-left py-2 px-3">Purchases</th>
                    <th className="text-left py-2 px-3">Revenue</th>
                    <th className="text-left py-2 px-3">Discount</th>
                    <th className="text-left py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {affiliateLinks.map((link) => (
                    <tr key={link.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-cyan-400 font-mono text-xs truncate max-w-[180px]">{link.code}</span>
                          <button className="text-slate-500 hover:text-white" onClick={() => navigator.clipboard?.writeText(link.code)}>
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-white">{link.creator}</td>
                      <td className="py-2 px-3 text-slate-300">{link.campaign}</td>
                      <td className="py-2 px-3 text-slate-300">{link.clicks.toLocaleString()}</td>
                      <td className="py-2 px-3 text-slate-300">{link.purchases}</td>
                      <td className="py-2 px-3 text-emerald-400">${link.revenue.toLocaleString()}</td>
                      <td className="py-2 px-3 text-violet-400">{link.discount}%</td>
                      <td className="py-2 px-3"><StatusBadge status={link.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Promo Codes Summary */}
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Promo Codes Performance</h3>
            <div className="grid grid-cols-5 gap-3">
              {affiliateLinks.map((link) => (
                <div key={link.id} className="bg-white/[0.03] rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-violet-400">{link.code.split('=')[1] || link.code}</div>
                  <div className="text-xs text-slate-400 mt-1">{link.discount}% OFF</div>
                  <div className="text-xs text-slate-500 mt-1">{link.purchases} uses · ${link.revenue.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Link Dialog */}
      <Dialog open={createLinkOpen} onOpenChange={setCreateLinkOpen}>
        <DialogContent className="bg-[#13131f] border-white/[0.06] text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Create Affiliate Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Campaign</label>
              <Select>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select campaign" /></SelectTrigger>
                <SelectContent className="bg-[#1e1e2e] border-white/10 text-white">
                  {campaigns.filter(c => c.status === 'ACTIVE').map(c => (
                    <SelectItem key={c.id} value={String(c.id)} className="text-white hover:bg-white/10">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Creator</label>
              <Select>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select creator" /></SelectTrigger>
                <SelectContent className="bg-[#1e1e2e] border-white/10 text-white">
                  {creators.map(c => (
                    <SelectItem key={c.id} value={String(c.id)} className="text-white hover:bg-white/10">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Custom Code</label>
              <Input className="bg-white/5 border-white/10 text-white" placeholder="e.g. SUMMER20" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Discount %</label>
              <Input type="number" className="bg-white/5 border-white/10 text-white" placeholder="10" />
            </div>
            <Button className="w-full bg-cyan-500 hover:bg-cyan-600 text-white">Create Link</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Module 8: Messages ─────────────────────────────────
function MessagesModule() {
  const [activeChat, setActiveChat] = useState(messages[0]);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState(activeChat.messages);

  const handleSend = () => {
    if (!chatInput.trim()) return;
    setChatMessages([...chatMessages, { from: 'You', text: chatInput, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setChatInput('');
  };

  const switchChat = (msg: Message) => {
    setActiveChat(msg);
    setChatMessages(msg.messages);
  };

  return (
    <div className="h-full flex">
      {/* Conversation List */}
      <div className="w-72 bg-[#0c0c1a] border-r border-white/[0.06] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-bold text-white">Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {messages.map((msg) => (
            <button
              key={msg.id}
              onClick={() => switchChat(msg)}
              className={`w-full flex items-center gap-3 p-3 text-left transition-all hover:bg-white/[0.03] ${activeChat.id === msg.id ? 'bg-white/[0.05] border-l-2 border-violet-500' : 'border-l-2 border-transparent'}`}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: chartColors[msg.id % chartColors.length] + '30', color: chartColors[msg.id % chartColors.length] }}>
                {msg.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white truncate">{msg.sender}</span>
                  <span className="text-xs text-slate-500 shrink-0">{msg.time}</span>
                </div>
                <div className="text-xs text-slate-400 truncate">{msg.preview}</div>
              </div>
              {msg.unread && <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-[#0a0a1a]">
        {/* Header */}
        <div className="h-14 border-b border-white/[0.06] flex items-center px-4 gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: chartColors[activeChat.id % chartColors.length] + '30', color: chartColors[activeChat.id % chartColors.length] }}>
            {activeChat.avatar}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{activeChat.sender}</div>
            <div className="text-xs text-emerald-400">Online</div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {chatMessages.map((m, i) => {
              const isMe = m.from === 'You';
              return (
                <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm ${
                    isMe ? 'bg-cyan-500/20 text-cyan-100 rounded-br-md' : 'bg-white/[0.06] text-slate-200 rounded-bl-md'
                  }`}>
                    <div>{m.text}</div>
                    <div className={`text-xs mt-1 ${isMe ? 'text-cyan-400/60' : 'text-slate-500'}`}>{m.time}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Input */}
        <div className="h-16 border-t border-white/[0.06] flex items-center px-4 gap-3">
          <Input
            className="flex-1 bg-white/5 border-white/10 text-white"
            placeholder="Type a message..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <Button className="bg-cyan-500 hover:bg-cyan-600 text-white w-10 h-10 p-0" onClick={handleSend}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
