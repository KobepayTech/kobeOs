import { useState, useMemo, useCallback } from 'react';
import {
  Calendar, CalendarDays, PenLine, Link2, Image, BarChart3,
  ChevronLeft, ChevronRight, Instagram, Twitter, Facebook,
  Linkedin, Youtube, Video, Pin, AtSign, Cloud, Paperclip,
  X, Plus, Clock, Eye, Heart, MessageSquare, Share2,
  CheckCircle2, AlertCircle, Upload, Search, Filter,
  Trash2, Edit3, Copy, TrendingUp, Hash
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface ScheduledPost {
  id: string;
  content: string;
  platforms: string[];
  mediaUrls: string[];
  scheduledAt: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  engagement?: { likes: number; comments: number; shares: number; impressions: number };
}

interface ConnectedAccount {
  id: string;
  platform: string;
  accountName: string;
  handle: string;
  connected: boolean;
  lastSynced: string | null;
  avatar: string;
}

interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  name: string;
  size: string;
  uploadedAt: string;
}

type SubView = 'calendar' | 'composer' | 'accounts' | 'media' | 'analytics';

// ═══════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth();

function d(day: number, monthOffset = 0) {
  const m = currentMonth + monthOffset;
  const y = currentYear + Math.floor(m / 12);
  const mo = ((m % 12) + 12) % 12;
  return new Date(y, mo, day).toISOString();
}

const mockPosts: ScheduledPost[] = [
  { id: 'p1', content: 'Excited to launch our summer collection! ☀️ Check out the new styles. #SummerVibes #Fashion', platforms: ['instagram', 'facebook'], mediaUrls: ['/mock/summer1.jpg'], scheduledAt: d(3), status: 'published', engagement: { likes: 1240, comments: 89, shares: 45, impressions: 15000 } },
  { id: 'p2', content: 'Behind the scenes of our latest shoot 📸 What do you think?', platforms: ['instagram', 'tiktok'], mediaUrls: ['/mock/bts1.jpg', '/mock/bts2.jpg'], scheduledAt: d(5), status: 'published', engagement: { likes: 890, comments: 67, shares: 32, impressions: 12000 } },
  { id: 'p3', content: 'Quick tips for boosting engagement on your posts 🧵👇', platforms: ['twitter'], mediaUrls: [], scheduledAt: d(8), status: 'published', engagement: { likes: 2340, comments: 156, shares: 890, impressions: 45000 } },
  { id: 'p4', content: 'Join us live this Friday at 7pm EST! We are answering all your questions.', platforms: ['youtube', 'instagram'], mediaUrls: ['/mock/live-promo.jpg'], scheduledAt: d(10), status: 'scheduled' },
  { id: 'p5', content: 'Our CEO shares insights on building a brand in 2025. Read the full article.', platforms: ['linkedin', 'twitter'], mediaUrls: [], scheduledAt: d(12), status: 'scheduled' },
  { id: 'p6', content: 'New product drop alert! 🚨 Limited quantities available.', platforms: ['instagram', 'twitter', 'facebook'], mediaUrls: ['/mock/product-drop.jpg'], scheduledAt: d(15), status: 'scheduled' },
  { id: 'p7', content: 'How we increased our conversion rate by 300%. Case study thread 🧵', platforms: ['twitter', 'linkedin'], mediaUrls: [], scheduledAt: d(18), status: 'draft' },
  { id: 'p8', content: 'Tutorial: Setting up your workspace for maximum productivity', platforms: ['youtube'], mediaUrls: ['/mock/tutorial-thumb.jpg'], scheduledAt: d(20), status: 'draft' },
  { id: 'p9', content: 'Monday motivation: Start your week with purpose 💪', platforms: ['instagram', 'facebook', 'linkedin'], mediaUrls: ['/mock/monday.jpg'], scheduledAt: d(22), status: 'scheduled' },
  { id: 'p10', content: 'Pinterest boards for interior design inspiration ✨', platforms: ['pinterest'], mediaUrls: ['/mock/pin1.jpg', '/mock/pin2.jpg'], scheduledAt: d(25), status: 'scheduled' },
  { id: 'p11', content: 'Bluesky is the future of social media. Here is why we are moving.', platforms: ['bluesky', 'twitter'], mediaUrls: [], scheduledAt: d(28), status: 'draft' },
  { id: 'p12', content: 'Mastodon community update - new server rules and features.', platforms: ['mastodon'], mediaUrls: [], scheduledAt: d(28, 1), status: 'scheduled' },
  { id: 'p13', content: 'Weekly recap of our best performing content 🏆', platforms: ['threads', 'instagram'], mediaUrls: ['/mock/recap.jpg'], scheduledAt: d(1, 1), status: 'scheduled' },
  { id: 'p14', content: 'Holiday special preview! 🎄 Get 30% off sitewide.', platforms: ['instagram', 'facebook', 'twitter', 'tiktok'], mediaUrls: ['/mock/holiday.jpg'], scheduledAt: d(5, 1), status: 'draft' },
  { id: 'p15', content: 'User-generated content spotlight: @sarah_creates', platforms: ['instagram'], mediaUrls: ['/mock/ugc.jpg'], scheduledAt: d(10, 1), status: 'scheduled' },
];

const mockAccounts: ConnectedAccount[] = [
  { id: 'a1', platform: 'Instagram', accountName: 'Kobe Studio', handle: '@kobestudio', connected: true, lastSynced: '2025-06-10T14:30:00Z', avatar: 'KS' },
  { id: 'a2', platform: 'Twitter / X', accountName: 'Kobe Studio', handle: '@kobestudio', connected: true, lastSynced: '2025-06-10T15:00:00Z', avatar: 'KS' },
  { id: 'a3', platform: 'Facebook', accountName: 'Kobe Studio Official', handle: 'kobestudio', connected: true, lastSynced: '2025-06-09T12:00:00Z', avatar: 'KS' },
  { id: 'a4', platform: 'LinkedIn', accountName: 'Kobe Studio', handle: 'company/kobestudio', connected: true, lastSynced: '2025-06-08T09:15:00Z', avatar: 'KS' },
  { id: 'a5', platform: 'YouTube', accountName: 'Kobe Studio', handle: '@kobestudio', connected: false, lastSynced: null, avatar: 'KS' },
  { id: 'a6', platform: 'TikTok', accountName: 'Kobe Studio', handle: '@kobestudio', connected: true, lastSynced: '2025-06-10T16:00:00Z', avatar: 'KS' },
  { id: 'a7', platform: 'Pinterest', accountName: 'Kobe Studio', handle: 'kobestudio', connected: false, lastSynced: null, avatar: 'KS' },
  { id: 'a8', platform: 'Threads', accountName: 'Kobe Studio', handle: '@kobestudio', connected: true, lastSynced: '2025-06-09T10:30:00Z', avatar: 'KS' },
  { id: 'a9', platform: 'Bluesky', accountName: 'Kobe Studio', handle: '@kobestudio.bsky.social', connected: false, lastSynced: null, avatar: 'KS' },
  { id: 'a10', platform: 'Mastodon', accountName: 'Kobe Studio', handle: '@kobestudio@mastodon.social', connected: false, lastSynced: null, avatar: 'KS' },
];

const mockMedia: MediaItem[] = [
  { id: 'm1', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop', type: 'image', name: 'summer-hero.jpg', size: '2.4 MB', uploadedAt: '2025-06-01T10:00:00Z' },
  { id: 'm2', url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop', type: 'image', name: 'bts-shoot.jpg', size: '3.1 MB', uploadedAt: '2025-06-02T14:00:00Z' },
  { id: 'm3', url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&h=400&fit=crop', type: 'image', name: 'live-promo.jpg', size: '1.8 MB', uploadedAt: '2025-06-03T09:00:00Z' },
  { id: 'm4', url: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=400&fit=crop', type: 'image', name: 'product-drop.jpg', size: '4.2 MB', uploadedAt: '2025-06-04T16:00:00Z' },
  { id: 'm5', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=400&fit=crop', type: 'image', name: 'workspace-setup.jpg', size: '2.9 MB', uploadedAt: '2025-06-05T11:00:00Z' },
  { id: 'm6', url: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=400&h=400&fit=crop', type: 'image', name: 'monday-motivation.jpg', size: '1.5 MB', uploadedAt: '2025-06-06T08:00:00Z' },
  { id: 'm7', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop', type: 'image', name: 'design-pin.jpg', size: '3.6 MB', uploadedAt: '2025-06-07T13:00:00Z' },
  { id: 'm8', url: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=400&h=400&fit=crop', type: 'video', name: 'tutorial-preview.mp4', size: '18.5 MB', uploadedAt: '2025-06-08T15:00:00Z' },
  { id: 'm9', url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=400&fit=crop', type: 'image', name: 'holiday-special.jpg', size: '2.7 MB', uploadedAt: '2025-06-09T10:00:00Z' },
  { id: 'm10', url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=400&fit=crop', type: 'image', name: 'ugc-spotlight.jpg', size: '3.3 MB', uploadedAt: '2025-06-10T09:00:00Z' },
];

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

const PLATFORM_META: Record<string, { color: string; icon: React.ElementType; charLimit: number }> = {
  instagram: { color: '#E4405F', icon: Instagram, charLimit: 2200 },
  twitter: { color: '#1DA1F2', icon: Twitter, charLimit: 280 },
  facebook: { color: '#1877F2', icon: Facebook, charLimit: 63206 },
  linkedin: { color: '#0A66C2', icon: Linkedin, charLimit: 3000 },
  youtube: { color: '#FF0000', icon: Youtube, charLimit: 5000 },
  tiktok: { color: '#000000', icon: Video, charLimit: 2200 },
  pinterest: { color: '#BD081C', icon: Pin, charLimit: 500 },
  threads: { color: '#000000', icon: AtSign, charLimit: 500 },
  bluesky: { color: '#0085ff', icon: Cloud, charLimit: 300 },
  mastodon: { color: '#6364FF', icon: Hash, charLimit: 500 },
};

function getPlatformMeta(platform: string) {
  return PLATFORM_META[platform] || { color: '#94a3b8', icon: Hash, charLimit: 1000 };
}

function PlatformBadge({ platform, size = 'sm' }: { platform: string; size?: 'sm' | 'md' }) {
  const meta = getPlatformMeta(platform);
  const Icon = meta.icon;
  const isSmall = size === 'sm';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${isSmall ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'}`}
      style={{ backgroundColor: meta.color + '18', color: meta.color, borderColor: meta.color + '30' }}
    >
      <Icon className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {platform.charAt(0).toUpperCase() + platform.slice(1)}
    </span>
  );
}

function PostStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
    scheduled: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    published: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    failed: 'bg-red-500/15 text-red-400 border-red-500/25',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.draft}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function monthLabel(year: number, month: number) {
  return new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function sameDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function isTodayDate(year: number, month: number, day: number) {
  const t = new Date();
  return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day;
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

export function SocialScheduler() {
  const [activeView, setActiveView] = useState<SubView>('calendar');

  const navItems: { id: SubView; icon: React.ElementType; label: string }[] = [
    { id: 'calendar', icon: CalendarDays, label: 'Post Calendar' },
    { id: 'composer', icon: PenLine, label: 'Composer' },
    { id: 'accounts', icon: Link2, label: 'Accounts' },
    { id: 'media', icon: Image, label: 'Media Library' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics' },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sub-navigation tabs */}
      <div className="shrink-0 px-6 pt-5 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Social Scheduler</h1>
            <p className="text-sm text-slate-400 mt-0.5">Plan, compose, and schedule posts across all platforms</p>
          </div>
        </div>
        <div className="flex gap-1 border-b border-white/[0.06]">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all border-b-2 -mb-[1px] ${
                activeView === item.id
                  ? 'text-cyan-400 border-cyan-400 bg-cyan-500/10'
                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/[0.03]'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'calendar' && <CalendarView />}
        {activeView === 'composer' && <ComposerView />}
        {activeView === 'accounts' && <AccountsView />}
        {activeView === 'media' && <MediaLibraryView />}
        {activeView === 'analytics' && <AnalyticsView />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// A. POST CALENDAR VIEW
// ═══════════════════════════════════════════════════

function CalendarView() {
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [viewYear, setViewYear] = useState(currentYear);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [posts, setPosts] = useState<ScheduledPost[]>(mockPosts);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const totalDays = daysInMonth(viewYear, viewMonth);
  const firstDay = firstDayOfMonth(viewYear, viewMonth);

  const postsForDay = useCallback((day: number) => {
    const dateStr = new Date(viewYear, viewMonth, day).toISOString();
    return posts.filter(p => {
      const pd = new Date(p.scheduledAt);
      return pd.getFullYear() === viewYear && pd.getMonth() === viewMonth && pd.getDate() === day;
    });
  }, [posts, viewYear, viewMonth]);

  const selectedDayPosts = useMemo(() => {
    if (!selectedDate) return [];
    return posts.filter(p => sameDay(p.scheduledAt, selectedDate));
  }, [selectedDate, posts]);

  const handleDrop = (day: number, postId: string) => {
    const newDate = new Date(viewYear, viewMonth, day);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, scheduledAt: newDate.toISOString() } : p));
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5">
        {/* Calendar header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="bg-white/5 border-white/10 text-white hover:bg-white/10" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-lg font-semibold text-white min-w-[200px] text-center">{monthLabel(viewYear, viewMonth)}</h2>
            <Button variant="outline" size="sm" className="bg-white/5 border-white/10 text-white hover:bg-white/10" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" /> Published</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" /> Scheduled</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-500/60" /> Draft</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500/60" /> Failed</div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-white/[0.06] rounded-xl overflow-hidden border border-white/[0.06]">
          {/* Weekday headers */}
          {weekDays.map(d => (
            <div key={d} className="bg-[#0f0f1a] px-3 py-2 text-xs font-medium text-slate-400 text-center">{d}</div>
          ))}
          {/* Empty cells */}
          {Array.from({ length: firstDay }, (_, i) => (
            <div key={`empty-${i}`} className="bg-[#0f0f1a] min-h-[100px]" />
          ))}
          {/* Day cells */}
          {Array.from({ length: totalDays }, (_, i) => {
            const day = i + 1;
            const dayPosts = postsForDay(day);
            const today = isTodayDate(viewYear, viewMonth, day);
            const isSelected = selectedDate && new Date(selectedDate).getDate() === day && new Date(selectedDate).getMonth() === viewMonth;

            return (
              <DayCell
                key={day}
                day={day}
                posts={dayPosts}
                today={today}
                selected={!!isSelected}
                onClick={() => setSelectedDate(new Date(viewYear, viewMonth, day).toISOString())}
                onDropPost={handleDrop}
              />
            );
          })}
        </div>

        {/* Selected day detail panel */}
        {selectedDate && (
          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">
                  {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                <button onClick={() => setSelectedDate(null)} className="text-slate-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {selectedDayPosts.length === 0 ? (
                <p className="text-sm text-slate-500">No posts scheduled for this date.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayPosts.map(post => (
                    <div key={post.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate">{post.content}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <PostStatusBadge status={post.status} />
                          <span className="text-xs text-slate-500">{new Date(post.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {post.platforms.map(p => (
                          <div key={p} className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: getPlatformMeta(p).color + '20' }}>
                            {(() => { const Icon = getPlatformMeta(p).icon; return <Icon className="w-3 h-3" style={{ color: getPlatformMeta(p).color }} />; })()}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function DayCell({ day, posts, today, selected, onClick, onDropPost }: {
  day: number; posts: ScheduledPost[]; today: boolean; selected: boolean;
  onClick: () => void; onDropPost: (day: number, postId: string) => void;
}) {
  const [isOver, setIsOver] = useState(false);
  const [draggedPost, setDraggedPost] = useState<string | null>(null);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return counts;
  }, [posts]);

  const statusColors: Record<string, string> = {
    published: '#10b981', scheduled: '#f59e0b', draft: '#64748b', failed: '#ef4444',
  };

  return (
    <div
      className={`bg-[#0f0f1a] min-h-[100px] p-2 cursor-pointer transition-all ${isOver ? 'bg-cyan-500/10 ring-2 ring-cyan-500/30' : ''} ${selected ? 'ring-2 ring-cyan-500/40' : 'hover:bg-[#13131f]'}`}
      onClick={onClick}
      onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        const postId = e.dataTransfer.getData('postId');
        if (postId) onDropPost(day, postId);
      }}
    >
      <div className={`text-xs font-medium mb-1 w-6 h-6 rounded-full flex items-center justify-center ${today ? 'bg-cyan-500 text-white' : 'text-slate-400'}`}>
        {day}
      </div>
      <div className="space-y-1">
        {Object.entries(statusCounts).slice(0, 3).map(([status, count]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusColors[status] || '#64748b' }} />
            <span className="text-[10px] text-slate-400">{count} {status}</span>
          </div>
        ))}
        {posts.length > 0 && (
          <div className="flex gap-0.5 mt-1 flex-wrap">
            {Array.from(new Set(posts.flatMap(p => p.platforms))).slice(0, 4).map(p => {
              const meta = getPlatformMeta(p);
              const Icon = meta.icon;
              return (
                <div key={p} className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: meta.color + '25' }}>
                  <Icon className="w-2.5 h-2.5" style={{ color: meta.color }} />
                </div>
              );
            })}
            {Array.from(new Set(posts.flatMap(p => p.platforms))).length > 4 && (
              <span className="text-[9px] text-slate-500">+{Array.from(new Set(posts.flatMap(p => p.platforms))).length - 4}</span>
            )}
          </div>
        )}
      </div>
      {/* Draggable post items */}
      {posts.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {posts.slice(0, 2).map(post => (
            <div
              key={post.id}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData('postId', post.id); setDraggedPost(post.id); }}
              onDragEnd={() => setDraggedPost(null)}
              className="text-[9px] text-slate-300 truncate bg-white/[0.04] rounded px-1 py-0.5 cursor-grab active:cursor-grabbing hover:bg-white/[0.08]"
            >
              {post.content.slice(0, 30)}...
            </div>
          ))}
          {posts.length > 2 && <div className="text-[9px] text-slate-500">+{posts.length - 2} more</div>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// B. POST COMPOSER VIEW
// ═══════════════════════════════════════════════════

function ComposerView() {
  const [content, setContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram', 'twitter']);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [mediaFiles, setMediaFiles] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>(mockPosts);

  const platformList = Object.entries(PLATFORM_META).map(([key, meta]) => ({ key, ...meta }));

  const togglePlatform = (key: string) => {
    setSelectedPlatforms(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
  };

  const handleSchedule = () => {
    if (!content.trim() || selectedPlatforms.length === 0) return;
    const scheduledAt = scheduleDate
      ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
      : new Date(Date.now() + 86400000).toISOString();

    const newPost: ScheduledPost = {
      id: `new-${Date.now()}`,
      content,
      platforms: [...selectedPlatforms],
      mediaUrls: [...mediaFiles],
      scheduledAt,
      status: 'scheduled',
    };
    setScheduledPosts(prev => [...prev, newPost]);
    setContent('');
    setMediaFiles([]);
    setShowPreview(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    // Simulate file upload
    setMediaFiles(prev => [...prev, `/mock/uploaded-${Date.now()}.jpg`]);
  };

  const removeMedia = (idx: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-5 gap-5">
          {/* Left: Editor */}
          <div className="col-span-3 space-y-4">
            {/* Content Editor */}
            <Card className="bg-[#13131f] border-white/[0.06]">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <PenLine className="w-4 h-4 text-cyan-400" /> Content
                  </h3>
                  <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white h-7 text-xs" onClick={() => setShowPreview(!showPreview)}>
                    <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                  </Button>
                </div>
                <textarea
                  className="w-full min-h-[160px] bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all"
                  placeholder="What's on your mind? Write your post content here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
                {/* Media upload zone */}
                <div
                  className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all cursor-pointer"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  onClick={() => setMediaFiles(prev => [...prev, `/mock/uploaded-${Date.now()}.jpg`])}
                >
                  <Upload className="w-6 h-6 text-slate-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Drag & drop images/videos here or click to browse</p>
                </div>
                {/* Attached media */}
                {mediaFiles.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {mediaFiles.map((f, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                        <Image className="w-5 h-5 text-slate-500" />
                        <button onClick={(e) => { e.stopPropagation(); removeMedia(i); }} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Schedule settings */}
            <Card className="bg-[#13131f] border-white/[0.06]">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" /> Schedule
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Date</label>
                    <Input type="date" className="bg-white/5 border-white/10 text-white" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Time</label>
                    <Input type="time" className="bg-white/5 border-white/10 text-white" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Platform selector + preview */}
          <div className="col-span-2 space-y-4">
            {/* Platform Selector */}
            <Card className="bg-[#13131f] border-white/[0.06]">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-violet-400" /> Platforms
                </h3>
                <div className="space-y-2">
                  {platformList.map(({ key, color, icon: Icon, charLimit }) => {
                    const selected = selectedPlatforms.includes(key);
                    const charCount = content.length;
                    const nearLimit = charCount > charLimit * 0.8;
                    return (
                      <button
                        key={key}
                        onClick={() => togglePlatform(key)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                          selected ? 'border-white/15 bg-white/[0.05]' : 'border-transparent bg-white/[0.02] hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${
                          selected ? 'border-cyan-500 bg-cyan-500/20' : 'border-white/20'
                        }`}>
                          {selected && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                        </div>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color + '20' }}>
                          <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-200 capitalize">{key}</div>
                          {selected && (
                            <div className="text-[10px] mt-0.5">
                              <span className={nearLimit ? 'text-red-400' : 'text-slate-500'}>
                                {charCount}/{charLimit} chars
                              </span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Live Preview */}
            {showPreview && content && (
              <Card className="bg-[#13131f] border-white/[0.06]">
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-white">Preview</h3>
                  {selectedPlatforms.length === 0 ? (
                    <p className="text-xs text-slate-500">Select a platform to see preview</p>
                  ) : (
                    selectedPlatforms.slice(0, 2).map(p => {
                      const meta = getPlatformMeta(p);
                      const Icon = meta.icon;
                      return (
                        <div key={p} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className="w-4 h-4" style={{ color: meta.color }} />
                            <span className="text-xs text-slate-400 capitalize">{p}</span>
                          </div>
                          <p className="text-sm text-slate-200 whitespace-pre-wrap">{content}</p>
                          {mediaFiles.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {mediaFiles.map((_, i) => (
                                <div key={i} className="w-12 h-12 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                                  <Image className="w-4 h-4 text-slate-500" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            )}

            {/* Schedule button */}
            <Button
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white h-11 text-sm font-medium"
              onClick={handleSchedule}
              disabled={!content.trim() || selectedPlatforms.length === 0}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Post
            </Button>

            {scheduledPosts.length > mockPosts.length && (
              <div className="text-xs text-emerald-400 text-center bg-emerald-500/10 rounded-lg p-2 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                Post scheduled successfully!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// C. CONNECTED ACCOUNTS VIEW
// ═══════════════════════════════════════════════════

function AccountsView() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>(mockAccounts);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const handleConnect = (id: string) => {
    setConnectingId(id);
    setTimeout(() => {
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, connected: true, lastSynced: new Date().toISOString() } : a));
      setConnectingId(null);
    }, 1500);
  };

  const handleDisconnect = (id: string) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, connected: false, lastSynced: null } : a));
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Connected Accounts</h2>
            <p className="text-sm text-slate-400 mt-0.5">Manage your social media platform connections</p>
          </div>
          <div className="text-xs text-slate-500">
            {accounts.filter(a => a.connected).length} of {accounts.length} connected
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {accounts.map((account) => {
            const meta = getPlatformMeta(account.platform.toLowerCase().split(' ')[0]);
            const Icon = meta.icon;

            return (
              <Card key={account.id} className={`bg-[#13131f] border-white/[0.06] overflow-hidden transition-all ${account.connected ? 'border-l-2' : ''}`}
                style={account.connected ? { borderLeftColor: meta.color } : {}}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: meta.color + '20' }}>
                      <Icon className="w-6 h-6" style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{account.platform}</div>
                      <div className="text-xs text-slate-400">{account.connected ? account.handle : 'Not connected'}</div>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${account.connected ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                  </div>

                  {account.connected && (
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Account</span>
                        <span className="text-slate-300">{account.accountName}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Last synced</span>
                        <span className="text-slate-300">
                          {account.lastSynced ? new Date(account.lastSynced).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {account.connected ? (
                      <>
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                          onClick={() => handleConnect(account.id)}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Sync
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs bg-transparent border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => handleDisconnect(account.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full h-8 text-xs bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 border border-cyan-500/20"
                        onClick={() => handleConnect(account.id)}
                        disabled={connectingId === account.id}
                      >
                        {connectingId === account.id ? 'Connecting...' : (
                          <><Link2 className="w-3.5 h-3.5 mr-1" /> Connect</>
                        )}
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

// ═══════════════════════════════════════════════════
// D. MEDIA LIBRARY VIEW
// ═══════════════════════════════════════════════════

function MediaLibraryView() {
  const [media, setMedia] = useState<MediaItem[]>(mockMedia);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const filtered = useMemo(() => {
    return media.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || m.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [media, searchQuery, typeFilter]);

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleUpload = () => {
    setUploading(true);
    setTimeout(() => {
      const newMedia: MediaItem = {
        id: `m${Date.now()}`,
        url: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 500000)}?w=400&h=400&fit=crop`,
        type: Math.random() > 0.3 ? 'image' : 'video',
        name: `upload-${Date.now()}.${Math.random() > 0.3 ? 'jpg' : 'mp4'}`,
        size: `${(Math.random() * 10 + 1).toFixed(1)} MB`,
        uploadedAt: new Date().toISOString(),
      };
      setMedia(prev => [newMedia, ...prev]);
      setUploading(false);
    }, 1500);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5">
        {/* Header controls */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              className="pl-9 bg-white/5 border-white/10 text-white"
              placeholder="Search media..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
            {(['all', 'image', 'video'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${typeFilter === t ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <Button className="bg-cyan-500 hover:bg-cyan-600 text-white gap-2" size="sm" onClick={handleUpload} disabled={uploading}>
            {uploading ? 'Uploading...' : <><Upload className="w-4 h-4" /> Upload</>}
          </Button>
        </div>

        {/* Selection bar */}
        {selectedItems.length > 0 && (
          <div className="flex items-center gap-3 bg-cyan-500/10 rounded-lg p-3 border border-cyan-500/20">
            <span className="text-sm text-cyan-400">{selectedItems.length} selected</span>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400 hover:text-white" onClick={() => setSelectedItems([])}>
              Clear
            </Button>
            <Button size="sm" className="h-7 text-xs bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 ml-auto">
              Use in Post
            </Button>
          </div>
        )}

        {/* Media Grid */}
        <div className="grid grid-cols-5 gap-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => toggleSelect(item.id)}
              className={`relative group rounded-xl overflow-hidden border cursor-pointer transition-all ${
                selectedItems.includes(item.id)
                  ? 'ring-2 ring-cyan-500 border-cyan-500/50'
                  : 'border-white/[0.06] hover:border-white/15'
              }`}
            >
              <div className="aspect-square bg-[#1a1a2e] relative">
                <img src={item.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                {/* Overlay */}
                <div className={`absolute inset-0 transition-all ${selectedItems.includes(item.id) ? 'bg-cyan-500/20' : 'bg-transparent group-hover:bg-black/30'}`} />
                {/* Checkbox */}
                <div className={`absolute top-2 left-2 w-5 h-5 rounded border flex items-center justify-center transition-all ${
                  selectedItems.includes(item.id) ? 'bg-cyan-500 border-cyan-500' : 'border-white/40 bg-black/40'
                }`}>
                  {selectedItems.includes(item.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </div>
                {/* Type badge */}
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/60 text-white backdrop-blur-sm">
                  {item.type === 'video' ? 'VIDEO' : 'IMG'}
                </div>
              </div>
              <div className="p-2.5 bg-[#13131f]">
                <p className="text-xs text-slate-300 truncate">{item.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-slate-500">{item.size}</span>
                  <span className="text-[10px] text-slate-500">{new Date(item.uploadedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Image className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No media found matching your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// E. ANALYTICS VIEW
// ═══════════════════════════════════════════════════

function AnalyticsView() {
  const [platformFilter, setPlatformFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30');

  const publishedPosts = mockPosts.filter(p => p.status === 'published' && p.engagement);

  const filteredPosts = useMemo(() => {
    return publishedPosts.filter(p => {
      if (platformFilter === 'all') return true;
      return p.platforms.includes(platformFilter);
    });
  }, [platformFilter]);

  const totalEngagement = useMemo(() => {
    return filteredPosts.reduce((acc, p) => ({
      likes: acc.likes + (p.engagement?.likes || 0),
      comments: acc.comments + (p.engagement?.comments || 0),
      shares: acc.shares + (p.engagement?.shares || 0),
      impressions: acc.impressions + (p.engagement?.impressions || 0),
    }), { likes: 0, comments: 0, shares: 0, impressions: 0 });
  }, [filteredPosts]);

  const chartData = useMemo(() => {
    const byPlatform: Record<string, { platform: string; likes: number; comments: number; shares: number; impressions: number }> = {};
    filteredPosts.forEach(p => {
      p.platforms.forEach(pl => {
        if (!byPlatform[pl]) byPlatform[pl] = { platform: pl, likes: 0, comments: 0, shares: 0, impressions: 0 };
        byPlatform[pl].likes += p.engagement?.likes || 0;
        byPlatform[pl].comments += p.engagement?.comments || 0;
        byPlatform[pl].shares += p.engagement?.shares || 0;
        byPlatform[pl].impressions += p.engagement?.impressions || 0;
      });
    });
    return Object.values(byPlatform);
  }, [filteredPosts]);

  const topPosts = [...filteredPosts].sort((a, b) => (b.engagement?.likes || 0) - (a.engagement?.likes || 0)).slice(0, 5);

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5">
        {/* Filters */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              value={platformFilter}
              onChange={e => setPlatformFilter(e.target.value)}
            >
              <option value="all">All Platforms</option>
              {Object.keys(PLATFORM_META).map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
            <select
              className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Likes', value: totalEngagement.likes.toLocaleString(), icon: Heart, color: '#ec4899' },
            { label: 'Comments', value: totalEngagement.comments.toLocaleString(), icon: MessageSquare, color: '#8b5cf6' },
            { label: 'Shares', value: totalEngagement.shares.toLocaleString(), icon: Share2, color: '#10b981' },
            { label: 'Impressions', value: totalEngagement.impressions.toLocaleString(), icon: Eye, color: '#06b6d4' },
          ].map((kpi, i) => (
            <Card key={i} className="bg-[#13131f] border-white/[0.06]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${kpi.color}20`, color: kpi.color }}>
                    <kpi.icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white">{kpi.value}</div>
                <div className="text-xs text-slate-400">{kpi.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Engagement Bar Chart */}
          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" /> Engagement by Platform
              </h3>
              {chartData.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No data available for selected filters.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="platform" stroke="#64748b" fontSize={12} tickFormatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                    <Bar dataKey="likes" fill="#ec4899" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="comments" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="shares" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top Performing Posts */}
          <Card className="bg-[#13131f] border-white/[0.06]">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" /> Top Performing Posts
              </h3>
              <div className="space-y-3">
                {topPosts.map((post, i) => (
                  <div key={post.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03]">
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 truncate">{post.content}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {post.platforms.slice(0, 3).map(p => (
                          <PlatformBadge key={p} platform={p} size="sm" />
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-white">{(post.engagement?.likes || 0).toLocaleString()}</div>
                      <div className="text-[10px] text-slate-500">likes</div>
                    </div>
                  </div>
                ))}
                {topPosts.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">No published posts match the selected filters.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Table */}
        <Card className="bg-[#13131f] border-white/[0.06]">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Post Performance Details</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-white/[0.06]">
                    <th className="text-left py-2 px-3">Content</th>
                    <th className="text-left py-2 px-3">Platforms</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-right py-2 px-3">Likes</th>
                    <th className="text-right py-2 px-3">Comments</th>
                    <th className="text-right py-2 px-3">Shares</th>
                    <th className="text-right py-2 px-3">Impressions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPosts.map(post => (
                    <tr key={post.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 max-w-[300px]">
                        <p className="text-slate-200 truncate text-xs">{post.content}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex gap-1 flex-wrap">
                          {post.platforms.map(p => (
                            <span key={p} className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: getPlatformMeta(p).color + '20' }}>
                              {(() => { const Icon = getPlatformMeta(p).icon; return <Icon className="w-3 h-3" style={{ color: getPlatformMeta(p).color }} />; })()}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3"><PostStatusBadge status={post.status} /></td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{(post.engagement?.likes || 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{(post.engagement?.comments || 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{(post.engagement?.shares || 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{(post.engagement?.impressions || 0).toLocaleString()}</td>
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

// Star icon for analytics top posts
function Star({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
