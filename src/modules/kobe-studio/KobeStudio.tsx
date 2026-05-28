import React, { useEffect, useMemo, useState } from 'react';
import {
  createStudioMediaJob,
  createStudioMediaProject,
  listStudioMediaJobs,
  listStudioMediaProjects,
  type StudioMediaJobRecord,
  type StudioMediaProjectRecord,
} from '@/services/studioMediaApi';

type StudioSectionId = 'media-studios' | 'creator-marketplace' | 'football-analytics' | 'brand-studio';
type StudioFormat = 'short-video' | 'ad-video' | 'creator-package' | 'product-video' | 'match-analysis';

const demoProjects: StudioMediaProjectRecord[] = [
  { id: 'project-1', title: 'Hotel Booking Promo', section: 'media-studios', format: 'ad-video', language: 'English', status: 'draft', engine: 'MoneyPrinterTurbo', prompt: 'Hotel booking promo' },
  { id: 'project-2', title: 'KobePay Merchant Short', section: 'media-studios', format: 'short-video', language: 'Swahili', status: 'generating', engine: 'MoneyPrinterTurbo', prompt: 'Merchant short video' },
  { id: 'project-3', title: 'Creator Brand Deal Pack', section: 'creator-marketplace', format: 'creator-package', language: 'Mixed', status: 'ready', engine: 'Kobe Manual Studio', prompt: 'Creator brand deal pack' },
  { id: 'project-4', title: 'Football Highlight Breakdown', section: 'football-analytics', format: 'match-analysis', language: 'English', status: 'draft', engine: 'Kobe Vision', prompt: 'Football highlight breakdown' },
];

const studioSections: Array<{ id: StudioSectionId; title: string; description: string; engine: string }> = [
  { id: 'media-studios', title: 'Media Studios', description: 'AI short videos, ads, scripts, voiceovers, subtitles, music, and stock-footage video generation.', engine: 'MoneyPrinterTurbo' },
  { id: 'creator-marketplace', title: 'Creator Marketplace Studio', description: 'Creator campaigns, influencer deliverables, brand deals, proposals, captions, and reports.', engine: 'Kobe Creator workflow' },
  { id: 'brand-studio', title: 'Brand Studio', description: 'Business ad packs, hotel promos, product promos, indoor TV screen ads, and campaign assets.', engine: 'Kobe Brand workflow' },
  { id: 'football-analytics', title: 'Football Analytics Studio', description: 'Future workspace for match analysis, highlights, possession clips, player clips, and tactical reports.', engine: 'Kobe Vision' },
];

function statusClasses(status: StudioMediaProjectRecord['status']) {
  switch (status) {
    case 'published': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'ready': return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    case 'generating': return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
    case 'failed': return 'bg-red-500/15 text-red-300 border-red-500/30';
    default: return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  }
}

export default function KobeStudio() {
  const [topic, setTopic] = useState('Create a 30 second video about KobeHotel online bookings');
  const [selectedSection, setSelectedSection] = useState<StudioSectionId>('media-studios');
  const [selectedFormat, setSelectedFormat] = useState<StudioFormat>('short-video');
  const [projects, setProjects] = useState<StudioMediaProjectRecord[]>(demoProjects);
  const [jobs, setJobs] = useState<StudioMediaJobRecord[]>([]);
  const [dataSource, setDataSource] = useState<'backend' | 'demo'>('demo');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const [projectResult, jobResult] = await Promise.allSettled([listStudioMediaProjects(), listStudioMediaJobs()]);
    const backendProjects = projectResult.status === 'fulfilled' ? projectResult.value : [];
    const backendJobs = jobResult.status === 'fulfilled' ? jobResult.value : [];
    if (backendProjects.length > 0 || backendJobs.length > 0) {
      setProjects(backendProjects.length > 0 ? backendProjects : demoProjects);
      setJobs(backendJobs);
      setDataSource('backend');
    } else {
      setProjects(demoProjects);
      setJobs([]);
      setDataSource('demo');
    }
  }

  useEffect(() => { refresh(); }, []);

  const filteredProjects = useMemo(() => projects.filter((project) => project.section === selectedSection), [selectedSection, projects]);
  const readyProjects = useMemo(() => projects.filter((project) => project.status === 'ready' || project.status === 'published'), [projects]);

  const createProject = async () => {
    setSaving(true);
    try {
      const savedProject = await createStudioMediaProject({
        title: topic.slice(0, 80) || 'Untitled media project',
        section: selectedSection,
        format: selectedFormat,
        language: 'English',
        status: 'draft',
        engine: selectedSection === 'media-studios' ? 'MoneyPrinterTurbo' : 'Kobe Studio',
        prompt: topic,
      });
      setProjects((current) => [savedProject, ...current.filter((item) => item.id !== savedProject.id)]);
      await createStudioMediaJob({
        projectId: savedProject.id,
        status: 'queued',
        engine: savedProject.engine,
        requestPayload: JSON.stringify({ topic, format: selectedFormat, section: selectedSection }),
      } as Partial<StudioMediaJobRecord> & { projectId: string });
      await refresh();
    } catch {
      // Shared api() queues offline writes when possible.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-950 text-white">
      <div className="border-b border-white/10 bg-slate-900/80 px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-pink-300">KobeOS Module</p>
            <h1 className="mt-1 text-3xl font-bold">Kobe Studio</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">Studio workspace for Media Studios, creator campaigns, brand ads, football analysis, and publishing workflows.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-pink-500/30 bg-pink-500/10 px-4 py-2 text-sm text-pink-200">Media Studios engine: MoneyPrinterTurbo</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">Data: {dataSource}</span>
            <button onClick={refresh} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10">Refresh</button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-6 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-slate-400">Studio sections</p><p className="mt-2 text-3xl font-bold">{studioSections.length}</p><p className="mt-1 text-xs text-slate-500">Media, creator, brand, football</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-slate-400">Projects</p><p className="mt-2 text-3xl font-bold">{projects.length}</p><p className="mt-1 text-xs text-slate-500">Backend + fallback</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-slate-400">Ready</p><p className="mt-2 text-3xl font-bold">{readyProjects.length}</p><p className="mt-1 text-xs text-slate-500">Ready for review or publish</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-slate-400">Jobs</p><p className="mt-2 text-3xl font-bold">{jobs.length}</p><p className="mt-1 text-xs text-slate-500">Generation queue</p></div>
      </div>

      <div className="grid gap-6 px-6 pb-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"><h2 className="text-xl font-semibold">Studio sections</h2><div className="mt-4 space-y-3">{studioSections.map((section) => <button key={section.id} onClick={() => setSelectedSection(section.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedSection === section.id ? 'border-pink-400/60 bg-pink-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}><h3 className="font-semibold">{section.title}</h3><p className="mt-2 text-sm text-slate-400">{section.description}</p><p className="mt-3 rounded-xl border border-white/10 bg-slate-950 p-2 text-xs text-slate-300">Engine: {section.engine}</p></button>)}</div></section>
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"><h2 className="text-xl font-semibold">Media Studios</h2><p className="mt-1 text-sm text-slate-400">Create a persistent Studio Media project and queue a backend job record.</p><div className="mt-5 space-y-4"><div><label className="text-sm text-slate-400">Topic / prompt</label><textarea value={topic} onChange={(event) => setTopic(event.target.value)} rows={5} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 p-3 text-sm outline-none focus:border-pink-400/70" /></div><div><label className="text-sm text-slate-400">Format</label><div className="mt-2 grid gap-2 md:grid-cols-2">{(['short-video', 'ad-video', 'creator-package', 'product-video'] as const).map((format) => <button key={format} onClick={() => setSelectedFormat(format)} className={`rounded-xl border px-3 py-2 text-left text-sm capitalize ${selectedFormat === format ? 'border-pink-400/60 bg-pink-500/10 text-pink-100' : 'border-white/10 bg-white/[0.03] text-slate-300'}`}>{format.replace('-', ' ')}</button>)}</div></div><button onClick={createProject} disabled={saving} className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-medium hover:bg-pink-500 disabled:opacity-60">{saving ? 'Saving...' : 'Save project + queue job'}</button><div className="rounded-2xl border border-white/10 bg-slate-950 p-4"><h3 className="font-semibold">Engine commands</h3><pre className="mt-3 overflow-x-auto rounded-xl bg-black/40 p-3 text-xs text-slate-200">npm run studio:media:clone{`\n`}npm run studio:media:docker</pre><p className="mt-3 text-xs text-slate-500">Open Web UI at http://localhost:8501 and API docs at http://localhost:8080/docs.</p></div></div></section>
      </div>

      <div className="grid gap-6 px-6 pb-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"><h2 className="text-xl font-semibold">Projects</h2><div className="mt-4 space-y-3">{filteredProjects.map((project) => <div key={project.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{project.title}</h3><p className="mt-1 text-sm text-slate-400">{project.format} • {project.language} • {project.engine}</p></div><span className={`rounded-full border px-2 py-1 text-xs ${statusClasses(project.status)}`}>{project.status}</span></div></div>)}{filteredProjects.length === 0 && <p className="text-sm text-slate-400">No projects in this section yet.</p>}</div></section>
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"><h2 className="text-xl font-semibold">Jobs and attribution</h2><div className="mt-4 space-y-3 text-sm text-slate-300">{jobs.slice(0, 6).map((job) => <div key={job.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><p className="font-medium">{job.engine}</p><p className="text-xs text-slate-500">{job.status} • project {job.projectId}</p>{job.outputUrl && <p className="mt-1 break-all text-xs text-slate-400">{job.outputUrl}</p>}</div>)}<div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">MoneyPrinterTurbo remains the upstream open-source video generation engine.</div><div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-yellow-100">Do not remove upstream MIT license notices from the cloned engine.</div></div></section>
      </div>
    </div>
  );
}
