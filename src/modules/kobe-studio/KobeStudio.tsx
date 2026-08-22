import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Film, Loader2, Plus, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import {
  createStudioMediaJob,
  createStudioMediaProject,
  listStudioMediaJobs,
  listStudioMediaProjects,
  type StudioMediaJobRecord,
  type StudioMediaProjectRecord,
} from '@/services/studioMediaApi';
import { api } from '@/lib/api';

interface VideoJobResponse {
  id: string;
  status: string;
  progressPercent: number;
  outputUrl?: string | null;
  errorMessage?: string | null;
}

type StudioSectionId = StudioMediaProjectRecord['section'];
type StudioFormat = StudioMediaProjectRecord['format'];

const SECTIONS: Array<{ id: StudioSectionId; title: string; description: string; formats: StudioFormat[] }> = [
  { id: 'media-studios', title: 'Media Studio', description: 'AI-generated short videos and adverts using the configured media engine.', formats: ['short-video', 'ad-video', 'product-video'] },
  { id: 'creator-marketplace', title: 'Creator Studio', description: 'Persistent creative briefs and creator deliverable packages.', formats: ['creator-package', 'short-video', 'ad-video'] },
  { id: 'brand-studio', title: 'Brand Studio', description: 'Product and business campaign assets tied to real Studio projects.', formats: ['ad-video', 'product-video', 'short-video'] },
  { id: 'football-analytics', title: 'Football Studio', description: 'Match-analysis media projects using real uploaded/processed match data.', formats: ['match-analysis'] },
];

const statusClass = (status: string) => status === 'ready' || status === 'completed' || status === 'published'
  ? 'bg-emerald-500/10 text-emerald-300'
  : status === 'failed'
    ? 'bg-rose-500/10 text-rose-300'
    : status === 'generating' || status === 'running'
      ? 'bg-amber-500/10 text-amber-300'
      : 'bg-slate-700 text-slate-300';

export default function KobeStudio() {
  const [section, setSection] = useState<StudioSectionId>('media-studios');
  const [format, setFormat] = useState<StudioFormat>('short-video');
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('English');
  const [projects, setProjects] = useState<StudioMediaProjectRecord[]>([]);
  const [jobs, setJobs] = useState<StudioMediaJobRecord[]>([]);
  const [videoJob, setVideoJob] = useState<VideoJobResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true); setError('');
    try {
      const [p, j] = await Promise.all([listStudioMediaProjects(), listStudioMediaJobs()]);
      setProjects(Array.isArray(p) ? p : []);
      setJobs(Array.isArray(j) ? j : []);
    } catch (e) {
      setProjects([]); setJobs([]);
      setError((e as Error).message || 'Could not load Studio projects.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    const allowed = SECTIONS.find((s) => s.id === section)?.formats ?? ['short-video'];
    if (!allowed.includes(format)) setFormat(allowed[0]);
  }, [section, format]);

  useEffect(() => {
    if (!videoJob?.id || ['completed', 'failed', 'cancelled'].includes(videoJob.status)) return;
    const timer = window.setInterval(async () => {
      try { setVideoJob(await api<VideoJobResponse>(`/videos/jobs/${videoJob.id}`, { offlineFallback: false })); }
      catch { /* keep last known state; refresh remains available */ }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [videoJob?.id, videoJob?.status]);

  const filtered = useMemo(() => projects.filter((p) => p.section === section), [projects, section]);
  const jobByProject = useMemo(() => {
    const map = new Map<string, StudioMediaJobRecord>();
    jobs.forEach((job) => { if (!map.has(job.projectId)) map.set(job.projectId, job); });
    return map;
  }, [jobs]);

  const create = async () => {
    if (!topic.trim()) return;
    setSaving(true); setError(''); setVideoJob(null);
    try {
      const project = await createStudioMediaProject({
        title: topic.trim().slice(0, 80), section, format, language,
        status: 'draft', engine: section === 'media-studios' || section === 'brand-studio' ? 'MoneyPrinterTurbo' : 'Kobe Studio', prompt: topic.trim(),
      });
      await createStudioMediaJob({ projectId: project.id, status: 'queued', engine: project.engine, request: { topic: topic.trim(), format, section, language } });

      if (['short-video', 'ad-video', 'product-video'].includes(format)) {
        try {
          const job = await api<VideoJobResponse>('/videos/generate', {
            method: 'POST', offlineFallback: false,
            body: JSON.stringify({ title: project.title, topic: topic.trim(), aspect: format === 'short-video' ? '9:16' : '16:9', count: 1, subtitlesEnabled: true }),
          });
          setVideoJob(job);
        } catch (e) {
          setVideoJob({ id: '', status: 'failed', progressPercent: 0, errorMessage: (e as Error).message || 'Media rendering engine is unavailable.' });
        }
      }
      setTopic('');
      await refresh();
    } catch (e) { setError((e as Error).message || 'Could not create Studio project.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-slate-950 text-white overflow-hidden">
      <header className="shrink-0 border-b border-white/10 bg-slate-900/80 px-5 py-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-pink-500/15 text-pink-300 grid place-items-center"><Film className="h-5 w-5" /></div>
        <div><h1 className="font-black">Kobe Studio</h1><p className="text-[11px] text-slate-500">Persistent media projects and real render jobs</p></div>
        <button onClick={() => void refresh()} disabled={loading} className="ml-auto h-9 w-9 rounded-lg border border-white/10 grid place-items-center text-slate-400 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 px-3 py-2 text-sm">{error}</div>}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Projects" value={projects.length} /><Stat label="Jobs" value={jobs.length} /><Stat label="Ready" value={projects.filter((p) => p.status === 'ready' || p.status === 'published').length} /><Stat label="Running" value={jobs.filter((j) => j.status === 'running' || j.status === 'queued').length} />
        </div>

        <div className="grid xl:grid-cols-[320px_1fr] gap-5">
          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-2">{SECTIONS.map((s) => <button key={s.id} onClick={() => setSection(s.id)} className={`w-full text-left rounded-xl border p-3 ${section === s.id ? 'border-pink-400/50 bg-pink-500/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'}`}><b className="text-sm">{s.title}</b><p className="text-xs text-slate-500 mt-1">{s.description}</p></button>)}</section>
          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-pink-300" /><h2 className="font-black">Create project</h2></div>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-xs text-slate-400">Brief / prompt<textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={5} className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm outline-none focus:border-pink-400/50" placeholder="Describe the real asset you want Studio to create…" /></label>
              <div className="grid sm:grid-cols-2 gap-3"><label className="grid gap-1 text-xs text-slate-400">Format<select value={format} onChange={(e) => setFormat(e.target.value as StudioFormat)} className="h-10 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm">{(SECTIONS.find((s) => s.id === section)?.formats ?? []).map((f) => <option key={f} value={f}>{f.replace(/-/g, ' ')}</option>)}</select></label><label className="grid gap-1 text-xs text-slate-400">Language<input value={language} onChange={(e) => setLanguage(e.target.value)} className="h-10 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm" /></label></div>
              <button onClick={() => void create()} disabled={saving || !topic.trim()} className="h-11 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-black disabled:opacity-50 inline-flex items-center justify-center gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create and queue</button>
            </div>
            {videoJob && <div className="mt-4 rounded-xl border border-white/10 bg-slate-950 p-3"><div className="flex items-center gap-2"><span className={`text-[10px] font-black rounded-full px-2 py-1 ${statusClass(videoJob.status)}`}>{videoJob.status.toUpperCase()}</span><span className="ml-auto text-xs text-slate-500">{videoJob.progressPercent ?? 0}%</span></div><div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden"><div className="h-full bg-pink-500" style={{ width: `${Math.max(0, Math.min(100, videoJob.progressPercent ?? 0))}%` }} /></div>{videoJob.errorMessage && <p className="text-xs text-rose-300 mt-2">{videoJob.errorMessage}</p>}{videoJob.outputUrl && <a href={videoJob.outputUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-pink-300 underline">Open output <ExternalLink className="h-3 w-3" /></a>}</div>}
          </section>
        </div>

        <section className="rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center"><h2 className="font-black">{SECTIONS.find((s) => s.id === section)?.title} projects</h2><span className="ml-auto text-xs text-slate-500">{filtered.length}</span></div>
          {loading && !projects.length ? <div className="py-16 grid place-items-center text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div> : !filtered.length ? <div className="py-14 text-center text-slate-500"><CheckCircle2 className="h-9 w-9 mx-auto mb-2 text-slate-700" />No projects in this section yet.</div> : <div className="divide-y divide-white/10">{filtered.map((p) => { const job = jobByProject.get(p.id); return <div key={p.id} className="px-4 py-3 flex items-start gap-3"><div className={`h-9 w-9 rounded-xl grid place-items-center ${p.status === 'failed' ? 'bg-rose-500/10 text-rose-300' : 'bg-pink-500/10 text-pink-300'}`}>{p.status === 'failed' ? <XCircle className="h-4 w-4" /> : <Film className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><b className="block truncate">{p.title}</b><span className="text-xs text-slate-500">{p.format} · {p.language} · {p.engine}</span>{job?.errorMessage && <span className="block text-[10px] text-rose-300 mt-1">{job.errorMessage}</span>}</div><div className="text-right"><span className={`text-[10px] font-black px-2 py-1 rounded-full ${statusClass(job?.status ?? p.status)}`}>{(job?.status ?? p.status).toUpperCase()}</span>{(job?.outputUrl || p.outputUrl) && <a href={job?.outputUrl || p.outputUrl || '#'} target="_blank" rel="noreferrer" className="block mt-2 text-[10px] text-pink-300 underline">Output</a>}</div></div>; })}</div>}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><span className="text-xs text-slate-500">{label}</span><b className="block text-2xl mt-1">{value}</b></div>; }
