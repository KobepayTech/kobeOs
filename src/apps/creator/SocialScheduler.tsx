import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Clock, ExternalLink,
  Eye, Heart, Image as ImageIcon, Instagram, Link2, Loader2, MessageSquare,
  PenLine, RefreshCw, Send, Share2, Trash2, Upload, Video,
} from 'lucide-react';
import { api, fetchObjectUrl, uploadFile } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type SubView = 'calendar' | 'composer' | 'accounts' | 'media' | 'analytics';
type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';

interface ScheduledPost {
  id: string;
  content: string;
  platforms: string[];
  mediaUrls: string[];
  scheduledAt: string | null;
  status: PostStatus;
  publishedAt?: string | null;
  engagementStats?: { likes?: number; comments?: number; shares?: number; impressions?: number };
  platformPostIds?: Record<string, string>;
  createdAt?: string;
}

interface PostList {
  items: ScheduledPost[];
  total: number;
  page: number;
  limit: number;
}

interface SocialAccount {
  id: string;
  platform: string;
  accountName: string;
  accountHandle: string;
  status: string;
  accountAvatar?: string | null;
  tokenExpiresAt?: string | null;
  scopes?: string[];
  lastSyncedAt?: string | null;
}

interface Capability {
  platform: string;
  connected: boolean;
  account: SocialAccount | null;
  capabilities: {
    profileRead: boolean;
    mediaRead: boolean;
    metricsRead: boolean;
    publishImage: boolean;
    publishVideo: boolean;
  };
  reason: string;
}

interface MediaAsset {
  id: string;
  kind: 'photo' | 'audio' | 'video' | 'image';
  name: string;
  mimeType?: string | null;
  src: string;
  size: number;
  createdAt?: string;
}

interface AnalyticsResponse {
  totalPosts: number;
  totals: { likes: number; comments: number; shares: number; impressions: number };
  platformBreakdown: Record<string, { posts: number; likes: number; comments: number; shares: number; impressions: number }>;
  statusBreakdown: Record<string, number>;
}

interface PublishResponse {
  post: ScheduledPost;
  results: Array<{ platform: string; ok: boolean; remoteId?: string; error?: string }>;
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  twitter: 'X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  threads: 'Threads',
  pinterest: 'Pinterest',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
};

const formatBytes = (size: number) => {
  if (!size) return '0 B';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDateTime = (value?: string | null) => value
  ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not scheduled';

const statusClass: Record<PostStatus, string> = {
  draft: 'bg-slate-500/15 text-slate-300 border-slate-500/20',
  scheduled: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  publishing: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
  published: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  failed: 'bg-red-500/15 text-red-300 border-red-500/20',
};

function StatusBadge({ status }: { status: PostStatus }) {
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusClass[status]}`}>{status}</span>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 px-5 py-12 text-center">
      <div className="text-sm font-semibold text-slate-300">{title}</div>
      <div className="mt-1 text-xs text-slate-500">{body}</div>
    </div>
  );
}

export function SocialScheduler() {
  const [activeView, setActiveView] = useState<SubView>('calendar');
  const nav = [
    { id: 'calendar' as const, icon: CalendarDays, label: 'Post Calendar' },
    { id: 'composer' as const, icon: PenLine, label: 'Composer' },
    { id: 'accounts' as const, icon: Link2, label: 'Accounts' },
    { id: 'media' as const, icon: ImageIcon, label: 'Media Library' },
    { id: 'analytics' as const, icon: BarChart3, label: 'Analytics' },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0c0c15] text-white">
      <div className="shrink-0 border-b border-white/[0.06] px-6 pt-5">
        <div className="mb-4">
          <h1 className="text-xl font-extrabold">Social Publishing</h1>
          <p className="mt-1 text-sm text-slate-400">Real connected accounts, real uploads, real scheduling, and provider-confirmed publishing.</p>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {nav.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${activeView === id ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeView === 'calendar' && <CalendarView onCompose={() => setActiveView('composer')} />}
        {activeView === 'composer' && <ComposerView />}
        {activeView === 'accounts' && <AccountsView />}
        {activeView === 'media' && <MediaLibraryView />}
        {activeView === 'analytics' && <AnalyticsView />}
      </div>
    </div>
  );
}

function CalendarView({ onCompose }: { onCompose: () => void }) {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await api<PostList>('/social-scheduler/posts?limit=100');
      setPosts(Array.isArray(result?.items) ? result.items : []);
    } catch (e) {
      setError((e as Error).message || 'Could not load scheduled posts.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const publish = async (post: ScheduledPost) => {
    setBusyId(post.id); setError(null);
    try {
      const result = await api<PublishResponse>(`/social-scheduler/posts/${post.id}/publish`, { method: 'POST' });
      setPosts((rows) => rows.map((row) => row.id === post.id ? result.post : row));
      const failures = result.results.filter((row) => !row.ok);
      if (failures.length) setError(failures.map((row) => `${PLATFORM_LABELS[row.platform] || row.platform}: ${row.error}`).join(' · '));
    } catch (e) { setError((e as Error).message || 'Publishing failed.'); }
    finally { setBusyId(null); }
  };

  const remove = async (id: string) => {
    setBusyId(id); setError(null);
    try {
      await api(`/social-scheduler/posts/${id}`, { method: 'DELETE' });
      setPosts((rows) => rows.filter((row) => row.id !== id));
    } catch (e) { setError((e as Error).message || 'Could not delete post.'); }
    finally { setBusyId(null); }
  };

  const sections = useMemo(() => {
    const buckets = new Map<string, ScheduledPost[]>();
    for (const post of posts) {
      const key = post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 10) : 'drafts';
      const rows = buckets.get(key) ?? [];
      rows.push(post); buckets.set(key, rows);
    }
    return [...buckets.entries()].sort(([a], [b]) => a === 'drafts' ? 1 : b === 'drafts' ? -1 : a.localeCompare(b));
  }, [posts]);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Publishing queue</h2>
            <p className="text-xs text-slate-500">Only database records appear here. Nothing is pre-seeded.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} className="border-white/10 bg-white/5 text-slate-200"><RefreshCw className="mr-1 h-3.5 w-3.5" />Refresh</Button>
            <Button size="sm" onClick={onCompose} className="bg-cyan-600 hover:bg-cyan-500"><PenLine className="mr-1 h-3.5 w-3.5" />Compose</Button>
          </div>
        </div>
        {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300"><AlertTriangle className="mr-1 inline h-4 w-4" />{error}</div>}
        {loading ? <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-cyan-400" /></div> : posts.length === 0 ? (
          <EmptyState title="No posts yet" body="Create a post and it will appear here after the backend saves it." />
        ) : sections.map(([key, rows]) => (
          <section key={key} className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{key === 'drafts' ? 'Drafts / unscheduled' : new Date(`${key}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
            {rows.map((post) => (
              <Card key={post.id} className="border-white/[0.07] bg-[#13131f]">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2"><StatusBadge status={post.status} />{post.platforms.map((p) => <span key={p} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{PLATFORM_LABELS[p] || p}</span>)}</div>
                      <p className="whitespace-pre-wrap text-sm text-slate-200">{post.content}</p>
                      <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-slate-500"><span><Clock className="mr-1 inline h-3 w-3" />{formatDateTime(post.scheduledAt)}</span><span>{post.mediaUrls.length} media item{post.mediaUrls.length === 1 ? '' : 's'}</span>{post.publishedAt && <span>Published {formatDateTime(post.publishedAt)}</span>}</div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {(post.status === 'draft' || post.status === 'failed') && <Button size="sm" disabled={busyId === post.id} onClick={() => void publish(post)} className="h-8 bg-emerald-600 text-xs hover:bg-emerald-500">{busyId === post.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}Publish</Button>}
                      {post.status !== 'publishing' && post.status !== 'published' && <Button size="sm" variant="outline" disabled={busyId === post.id} onClick={() => void remove(post.id)} className="h-8 border-red-500/20 bg-transparent text-red-300 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></Button>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function ComposerView() {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [content, setContent] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [loadingCaps, setLoadingCaps] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCaps = useCallback(async () => {
    setLoadingCaps(true);
    try {
      const rows = await api<Capability[]>('/social-scheduler/capabilities');
      setCapabilities(Array.isArray(rows) ? rows : []);
    } catch (e) { setError((e as Error).message || 'Could not load publishing capabilities.'); }
    finally { setLoadingCaps(false); }
  }, []);
  useEffect(() => { void loadCaps(); }, [loadCaps]);

  const enabled = useMemo(() => capabilities.filter((row) => row.capabilities.publishImage || row.capabilities.publishVideo), [capabilities]);

  const choosePlatform = (platform: string) => setPlatforms((rows) => rows.includes(platform) ? rows.filter((p) => p !== platform) : [...rows, platform]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    if (!files.length) return;
    setUploading(true); setError(null); setMessage(null);
    try {
      const uploaded: MediaAsset[] = [];
      for (const file of files) {
        const kind = file.type.startsWith('video/') ? 'video' : 'image';
        uploaded.push(await uploadFile<MediaAsset>(`/media/upload?kind=${kind}`, file));
      }
      setMedia((rows) => [...rows, ...uploaded]);
    } catch (e) { setError((e as Error).message || 'Media upload failed.'); }
    finally { setUploading(false); event.target.value = ''; }
  };

  const save = async (publishNow: boolean) => {
    setSaving(true); setError(null); setMessage(null);
    try {
      if (!content.trim()) throw new Error('Write a caption first.');
      if (!platforms.length) throw new Error('Select at least one publishing-capable connected account.');
      let scheduledAt: string | undefined;
      if (!publishNow) {
        if (!scheduleDate || !scheduleTime) throw new Error('Choose a date and time to schedule this post.');
        const parsed = new Date(`${scheduleDate}T${scheduleTime}`);
        if (Number.isNaN(parsed.getTime())) throw new Error('Invalid schedule date or time.');
        scheduledAt = parsed.toISOString();
      }
      const post = await api<ScheduledPost>('/social-scheduler/posts', {
        method: 'POST',
        body: JSON.stringify({
          content: content.trim(),
          platforms,
          mediaUrls: media.map((item) => item.src),
          ...(scheduledAt ? { scheduledAt, status: 'scheduled' } : { status: 'draft' }),
        }),
      });
      if (publishNow) {
        const result = await api<PublishResponse>(`/social-scheduler/posts/${post.id}/publish`, { method: 'POST' });
        const failures = result.results.filter((row) => !row.ok);
        if (failures.length) throw new Error(failures.map((row) => `${PLATFORM_LABELS[row.platform] || row.platform}: ${row.error}`).join(' · '));
        setMessage(`Published successfully${result.results[0]?.remoteId ? ` · provider ID ${result.results[0].remoteId}` : ''}.`);
      } else {
        setMessage(`Scheduled for ${formatDateTime(scheduledAt)}.`);
      }
      setContent(''); setPlatforms([]); setMedia([]); setScheduleDate('');
    } catch (e) { setError((e as Error).message || 'Could not save post.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Card className="border-white/[0.07] bg-[#13131f]"><CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between"><h2 className="font-bold">Compose</h2><span className="text-[11px] text-slate-500">{content.length}/2000</span></div>
            <textarea value={content} maxLength={2000} onChange={(e) => setContent(e.target.value)} placeholder="Write the content that will actually be sent to the provider…" className="min-h-44 w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-cyan-500/50" />
            <input ref={fileInput} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => void upload(e)} />
            <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={uploading} className="border-white/10 bg-white/5 text-slate-200">{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Upload real media</Button>
            {media.length > 0 && <div className="space-y-2">{media.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.025] p-2"><div className="grid h-9 w-9 place-items-center rounded bg-white/5">{item.kind === 'video' ? <Video className="h-4 w-4 text-fuchsia-300" /> : <ImageIcon className="h-4 w-4 text-cyan-300" />}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{item.name}</div><div className="text-[10px] text-slate-500">{formatBytes(item.size)}</div></div><button onClick={() => setMedia((rows) => rows.filter((row) => row.id !== item.id))} className="p-2 text-slate-500 hover:text-red-300"><Trash2 className="h-4 w-4" /></button></div>)}</div>}
          </CardContent></Card>
          <Card className="border-white/[0.07] bg-[#13131f]"><CardContent className="p-4"><div className="mb-3 flex items-center gap-2 text-sm font-bold"><Clock className="h-4 w-4 text-amber-300" />Schedule</div><div className="grid grid-cols-2 gap-3"><Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="border-white/10 bg-black/20" /><Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="border-white/10 bg-black/20" /></div></CardContent></Card>
        </div>
        <div className="space-y-4">
          <Card className="border-white/[0.07] bg-[#13131f]"><CardContent className="space-y-3 p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Authorized publishers</h3><Button size="sm" variant="ghost" onClick={() => void loadCaps()} className="h-7 text-slate-400"><RefreshCw className="h-3.5 w-3.5" /></Button></div>{loadingCaps ? <Loader2 className="h-5 w-5 animate-spin text-cyan-400" /> : capabilities.map((row) => { const canPublish = row.capabilities.publishImage || row.capabilities.publishVideo; const selected = platforms.includes(row.platform); return <button key={row.platform} disabled={!canPublish} onClick={() => choosePlatform(row.platform)} className={`w-full rounded-xl border p-3 text-left transition ${selected ? 'border-cyan-500/50 bg-cyan-500/10' : canPublish ? 'border-white/10 bg-white/[0.025] hover:bg-white/5' : 'cursor-not-allowed border-white/5 bg-black/10 opacity-60'}`}><div className="flex items-center justify-between gap-2"><div className="text-sm font-semibold">{PLATFORM_LABELS[row.platform] || row.platform}</div>{canPublish ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}</div><div className="mt-1 text-[11px] text-slate-500">{canPublish ? `Authorized as ${row.account?.accountHandle || row.account?.accountName || 'connected account'}` : row.reason}</div></button>; })}{!loadingCaps && enabled.length === 0 && <div className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-200">No account currently has a live publishing capability. Connect and authorize a supported provider first.</div>}</CardContent></Card>
          {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}
          {message && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">{message}</div>}
          <Button disabled={saving || !content.trim() || !platforms.length} onClick={() => void save(true)} className="w-full bg-emerald-600 hover:bg-emerald-500">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Publish now</Button>
          <Button disabled={saving || !content.trim() || !platforms.length || !scheduleDate} onClick={() => void save(false)} variant="outline" className="w-full border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"><CalendarDays className="mr-2 h-4 w-4" />Schedule on server</Button>
        </div>
      </div>
    </div>
  );
}

function AccountsView() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [a, c] = await Promise.all([
        api<SocialAccount[]>('/social-scheduler/accounts'),
        api<Capability[]>('/social-scheduler/capabilities'),
      ]);
      setAccounts(Array.isArray(a) ? a : []); setCapabilities(Array.isArray(c) ? c : []);
    } catch (e) { setError((e as Error).message || 'Could not load connected accounts.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const handler = () => { void load(); };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [load]);

  const connectInstagram = async () => {
    setBusy(true); setError(null);
    try {
      const result = await api<{ url: string }>('/live-sales/instagram/oauth/url');
      if (!result.url) throw new Error('Instagram OAuth URL was not returned by the server.');
      const popup = window.open(result.url, '_blank', 'noopener,noreferrer');
      if (!popup) window.location.assign(result.url);
    } catch (e) { setError((e as Error).message || 'Instagram connection could not start.'); }
    finally { setBusy(false); }
  };

  const disconnect = async (account: SocialAccount) => {
    setBusy(true); setError(null);
    try {
      await api(`/social-scheduler/accounts/${account.id}`, { method: 'DELETE' });
      await load();
    } catch (e) { setError((e as Error).message || 'Could not disconnect account.'); }
    finally { setBusy(false); }
  };

  const instagramCapability = capabilities.find((row) => row.platform === 'instagram');
  const tiktokCapability = capabilities.find((row) => row.platform === 'tiktok');

  return (
    <div className="h-full overflow-y-auto p-6"><div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Connected accounts</h2><p className="text-xs text-slate-500">OAuth tokens are kept server-side; the UI never receives them.</p></div><Button size="sm" variant="outline" onClick={() => void load()} className="border-white/10 bg-white/5 text-slate-200"><RefreshCw className="mr-1 h-3.5 w-3.5" />Refresh</Button></div>
      {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-white/[0.07] bg-[#13131f]"><CardContent className="p-4"><div className="flex items-start gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-pink-500/15"><Instagram className="h-5 w-5 text-pink-300" /></div><div className="min-w-0 flex-1"><div className="font-bold">Instagram Professional</div><div className="mt-1 text-xs text-slate-500">{instagramCapability?.connected ? `Connected: ${instagramCapability.account?.accountHandle || instagramCapability.account?.accountName}` : 'Not connected'}</div></div>{instagramCapability?.connected && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}</div><div className="mt-4 rounded-lg bg-black/20 p-3 text-xs text-slate-400">{instagramCapability?.capabilities.publishImage ? 'Content publishing permission is active.' : instagramCapability?.reason || 'Connect an Instagram Professional account using official OAuth.'}</div><div className="mt-4 flex gap-2"><Button disabled={busy} onClick={() => void connectInstagram()} className="flex-1 bg-pink-600 hover:bg-pink-500">{instagramCapability?.connected ? 'Reconnect permissions' : 'Connect Instagram'}<ExternalLink className="ml-2 h-3.5 w-3.5" /></Button>{instagramCapability?.account && <Button disabled={busy} variant="outline" onClick={() => void disconnect(instagramCapability.account!)} className="border-red-500/20 bg-transparent text-red-300"><Trash2 className="h-4 w-4" /></Button>}</div></CardContent></Card>
        <Card className="border-white/[0.07] bg-[#13131f]"><CardContent className="p-4"><div className="flex items-start gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10"><Video className="h-5 w-5 text-white" /></div><div className="flex-1"><div className="font-bold">TikTok</div><div className="mt-1 text-xs text-slate-500">{tiktokCapability?.connected ? `Connected: ${tiktokCapability.account?.accountHandle || tiktokCapability.account?.accountName}` : 'No Content Posting connection'}</div></div></div><div className="mt-4 rounded-lg border border-amber-500/15 bg-amber-500/10 p-3 text-xs text-amber-100">{tiktokCapability?.reason || 'KobeOS will expose TikTok Direct Post only when the app has the required provider approval and the user authorizes the publishing scope.'}</div></CardContent></Card>
      </div>
      {loading ? <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-cyan-400" /></div> : accounts.length > 0 && <Card className="border-white/[0.07] bg-[#13131f]"><CardContent className="p-0"><div className="divide-y divide-white/[0.05]">{accounts.map((account) => <div key={account.id} className="flex items-center gap-3 p-4"><div className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-xs font-black">{(account.accountName || account.platform).slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{PLATFORM_LABELS[account.platform] || account.platform}</div><div className="truncate text-[11px] text-slate-500">{account.accountHandle} · {account.status} · last sync {formatDateTime(account.lastSyncedAt)}</div></div><button disabled={busy} onClick={() => void disconnect(account)} className="p-2 text-slate-500 hover:text-red-300"><Trash2 className="h-4 w-4" /></button></div>)}</div></CardContent></Card>}
    </div></div>
  );
}

function AssetPreview({ asset }: { asset: MediaAsset }) {
  const [src, setSrc] = useState<string>('');
  useEffect(() => {
    let alive = true; let objectUrl = '';
    void (async () => {
      try {
        if (asset.src.startsWith('/api/')) objectUrl = await fetchObjectUrl(asset.src.replace(/^\/api/, ''));
        else objectUrl = asset.src;
        if (alive) setSrc(objectUrl);
      } catch { if (alive) setSrc(''); }
    })();
    return () => { alive = false; if (objectUrl.startsWith('blob:')) URL.revokeObjectURL(objectUrl); };
  }, [asset.src]);
  if (!src) return <div className="grid h-full place-items-center"><ImageIcon className="h-7 w-7 text-slate-600" /></div>;
  return asset.kind === 'video' ? <video src={src} muted className="h-full w-full object-cover" /> : <img src={src} alt={asset.name} className="h-full w-full object-cover" />;
}

function MediaLibraryView() {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [images, videos] = await Promise.all([api<MediaAsset[]>('/media/assets?kind=image'), api<MediaAsset[]>('/media/assets?kind=video')]);
      setAssets([...(Array.isArray(images) ? images : []), ...(Array.isArray(videos) ? videos : [])].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))));
    } catch (e) { setError((e as Error).message || 'Could not load media.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])]; if (!files.length) return;
    setUploading(true); setError(null);
    try {
      for (const file of files) await uploadFile(`/media/upload?kind=${file.type.startsWith('video/') ? 'video' : 'image'}`, file);
      await load();
    } catch (e) { setError((e as Error).message || 'Upload failed.'); }
    finally { setUploading(false); event.target.value = ''; }
  };

  const remove = async (id: string) => {
    try { await api(`/media/assets/${id}`, { method: 'DELETE' }); setAssets((rows) => rows.filter((row) => row.id !== id)); }
    catch (e) { setError((e as Error).message || 'Could not delete media.'); }
  };

  return (
    <div className="h-full overflow-y-auto p-6"><div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Media library</h2><p className="text-xs text-slate-500">Files shown here were actually uploaded to KobeOS.</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void load()} className="border-white/10 bg-white/5 text-slate-200"><RefreshCw className="h-3.5 w-3.5" /></Button><input ref={fileInput} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => void upload(e)} /><Button size="sm" disabled={uploading} onClick={() => fileInput.current?.click()} className="bg-cyan-600 hover:bg-cyan-500">{uploading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}Upload</Button></div></div>
      {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}
      {loading ? <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-cyan-400" /></div> : assets.length === 0 ? <EmptyState title="No uploaded media" body="Upload an image or video; KobeOS will store the real file and make it available to the composer." /> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{assets.map((asset) => <div key={asset.id} className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#13131f]"><div className="aspect-square bg-black/30"><AssetPreview asset={asset} /></div><div className="flex items-center gap-2 p-2.5"><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{asset.name}</div><div className="text-[10px] text-slate-500">{formatBytes(asset.size)} · {asset.kind}</div></div><button onClick={() => void remove(asset.id)} className="p-1.5 text-slate-500 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button></div></div>)}</div>}
    </div></div>
  );
}

function AnalyticsView() {
  const [range, setRange] = useState('30');
  const [platform, setPlatform] = useState('');
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const from = new Date(Date.now() - Number(range) * 86_400_000).toISOString();
    const params = new URLSearchParams({ from, to: new Date().toISOString() });
    if (platform) params.set('platform', platform);
    try {
      const [summary, list] = await Promise.all([
        api<AnalyticsResponse>(`/social-scheduler/analytics?${params}`),
        api<PostList>(`/social-scheduler/posts?status=published&limit=100${platform ? `&platform=${encodeURIComponent(platform)}` : ''}`),
      ]);
      setAnalytics(summary); setPosts(Array.isArray(list.items) ? list.items : []);
    } catch (e) { setError((e as Error).message || 'Could not load analytics.'); }
    finally { setLoading(false); }
  }, [platform, range]);
  useEffect(() => { void load(); }, [load]);

  const totals = analytics?.totals ?? { likes: 0, comments: 0, shares: 0, impressions: 0 };
  const topPosts = useMemo(() => [...posts].sort((a, b) => Number(b.engagementStats?.impressions || 0) - Number(a.engagementStats?.impressions || 0)).slice(0, 10), [posts]);

  return (
    <div className="h-full overflow-y-auto p-6"><div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Verified publishing analytics</h2><p className="text-xs text-slate-500">Values come from stored provider/first-party metrics only; no generated sample numbers.</p></div><div className="flex gap-2"><select value={platform} onChange={(e) => setPlatform(e.target.value)} className="rounded-lg border border-white/10 bg-[#13131f] px-3 text-xs"><option value="">All platforms</option>{Object.entries(PLATFORM_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><select value={range} onChange={(e) => setRange(e.target.value)} className="rounded-lg border border-white/10 bg-[#13131f] px-3 text-xs"><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></div></div>
      {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}
      {loading ? <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-cyan-400" /></div> : <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
          { label: 'Impressions', value: totals.impressions, icon: Eye },
          { label: 'Likes', value: totals.likes, icon: Heart },
          { label: 'Comments', value: totals.comments, icon: MessageSquare },
          { label: 'Shares', value: totals.shares, icon: Share2 },
        ].map(({ label, value, icon: Icon }) => <Card key={label} className="border-white/[0.07] bg-[#13131f]"><CardContent className="p-4"><Icon className="mb-3 h-4 w-4 text-cyan-300" /><div className="text-2xl font-black">{Number(value || 0).toLocaleString()}</div><div className="text-xs text-slate-500">{label}</div></CardContent></Card>)}</div>
        <div className="grid gap-4 lg:grid-cols-2"><Card className="border-white/[0.07] bg-[#13131f]"><CardContent className="p-4"><h3 className="mb-4 text-sm font-bold">By platform</h3><div className="space-y-3">{Object.entries(analytics?.platformBreakdown ?? {}).map(([id, row]) => <div key={id} className="rounded-lg bg-white/[0.025] p-3"><div className="flex items-center justify-between"><div className="text-sm font-semibold">{PLATFORM_LABELS[id] || id}</div><div className="text-xs text-slate-400">{row.posts} post{row.posts === 1 ? '' : 's'}</div></div><div className="mt-2 grid grid-cols-4 gap-2 text-[10px] text-slate-500"><span>{row.impressions.toLocaleString()} views</span><span>{row.likes.toLocaleString()} likes</span><span>{row.comments.toLocaleString()} comments</span><span>{row.shares.toLocaleString()} shares</span></div></div>)}{Object.keys(analytics?.platformBreakdown ?? {}).length === 0 && <div className="text-xs text-slate-500">No published metrics in this period.</div>}</div></CardContent></Card><Card className="border-white/[0.07] bg-[#13131f]"><CardContent className="p-4"><h3 className="mb-4 text-sm font-bold">Published posts</h3><div className="space-y-2">{topPosts.map((post) => <div key={post.id} className="rounded-lg border border-white/[0.05] p-3"><div className="truncate text-xs font-semibold">{post.content}</div><div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>{post.platforms.map((p) => PLATFORM_LABELS[p] || p).join(', ')}</span><span>{Number(post.engagementStats?.impressions || 0).toLocaleString()} impressions</span></div></div>)}{topPosts.length === 0 && <div className="text-xs text-slate-500">No published posts in this view.</div>}</div></CardContent></Card></div>
      </>}
    </div></div>
  );
}
