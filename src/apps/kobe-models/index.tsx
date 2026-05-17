import { useCallback, useEffect, useRef, useState } from 'react';
import {
  catalogueApi, downloadApi, installedApi,
  type CatalogueModel, type DownloadJob, type InstalledModel, type ModelCategory,
} from './api';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: { id: ModelCategory | 'all'; label: string; icon: string }[] = [
  { id: 'all',       label: 'All',       icon: '🗂️' },
  { id: 'chat',      label: 'Chat',      icon: '💬' },
  { id: 'coding',    label: 'Coding',    icon: '💻' },
  { id: 'vision',    label: 'Vision',    icon: '👁️' },
  { id: 'sports',    label: 'Sports',    icon: '⚽' },
  { id: 'embedding', label: 'Embedding', icon: '🔗' },
  { id: 'speech',    label: 'Speech',    icon: '🎙️' },
];

const LICENSE_COLORS: Record<string, string> = {
  'apache-2.0': 'text-green-400 bg-green-900/30',
  'mit':        'text-blue-400 bg-blue-900/30',
  'llama':      'text-purple-400 bg-purple-900/30',
  'gemma':      'text-cyan-400 bg-cyan-900/30',
  'mistral':    'text-orange-400 bg-orange-900/30',
  'other':      'text-gray-400 bg-gray-800',
};

// ── Demo data (shown when backend unavailable) ────────────────────────────────

const DEMO_MODELS: CatalogueModel[] = [
  { id: 'mistral:7b', name: 'Kobe-Mistral 7B', description: 'Fast, capable chat model. Best balance of speed and quality.', category: 'chat', sizeBytes: 4_100_000_000, sizeLabel: '4.1 GB', minVramGb: 6, kobeOptimised: true, downloadUrl: '', checksum: '', ollamaFallback: 'mistral:7b', license: 'apache-2.0', upstreamUrl: '', version: '0.1', recommended: true, tags: ['chat', 'fast'] },
  { id: 'llama3.2:3b', name: 'Llama 3.2 3B', description: 'Lightweight. Runs on CPU, ideal for low-resource devices.', category: 'chat', sizeBytes: 2_000_000_000, sizeLabel: '2.0 GB', minVramGb: 0, kobeOptimised: false, downloadUrl: '', checksum: '', ollamaFallback: 'llama3.2:3b', license: 'llama', upstreamUrl: '', version: '3.2', recommended: true, tags: ['chat', 'cpu'] },
  { id: 'deepseek-coder-v2:16b', name: 'Kobe-DeepSeek Coder V2', description: 'Best-in-class open coding model. Supports 338 languages.', category: 'coding', sizeBytes: 9_000_000_000, sizeLabel: '9.0 GB', minVramGb: 12, kobeOptimised: true, downloadUrl: '', checksum: '', ollamaFallback: 'deepseek-coder-v2:16b', license: 'other', upstreamUrl: '', version: '2.0', recommended: true, tags: ['coding'] },
  { id: 'llava:7b', name: 'LLaVA 7B', description: 'Vision-language model. Analyse images and screenshots.', category: 'vision', sizeBytes: 4_500_000_000, sizeLabel: '4.5 GB', minVramGb: 6, kobeOptimised: false, downloadUrl: '', checksum: '', ollamaFallback: 'llava:7b', license: 'apache-2.0', upstreamUrl: '', version: '1.5', recommended: true, tags: ['vision'] },
  { id: 'kobe-football-vision:1b', name: 'Kobe Football Vision', description: 'YOLOv8n for player tracking, ball detection, event classification.', category: 'sports', sizeBytes: 12_000_000, sizeLabel: '~12 MB', minVramGb: 0, kobeOptimised: true, downloadUrl: '', checksum: '', license: 'apache-2.0', upstreamUrl: '', version: '1.0', recommended: true, tags: ['sports', 'yolo'] },
  { id: 'nomic-embed-text:latest', name: 'Nomic Embed Text', description: 'High-quality text embeddings for RAG and semantic search.', category: 'embedding', sizeBytes: 274_000_000, sizeLabel: '274 MB', minVramGb: 0, kobeOptimised: false, downloadUrl: '', checksum: '', ollamaFallback: 'nomic-embed-text:latest', license: 'apache-2.0', upstreamUrl: '', version: '1.0', recommended: true, tags: ['embedding', 'rag'] },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: DownloadJob['status'] }) {
  const colors: Record<string, string> = {
    queued: 'bg-yellow-400', downloading: 'bg-blue-400 animate-pulse',
    verifying: 'bg-purple-400 animate-pulse', installing: 'bg-orange-400 animate-pulse',
    done: 'bg-green-400', failed: 'bg-red-400',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] ?? 'bg-gray-400'}`} />;
}

function ProgressBar({ pct, status }: { pct: number; status: DownloadJob['status'] }) {
  const color = status === 'failed' ? 'bg-red-500' : status === 'done' ? 'bg-green-500' : 'bg-blue-500';
  return (
    <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ModelCard({
  model, installed, activeModel, job,
  onDownload, onSetActive, onDelete,
}: {
  model: CatalogueModel;
  installed: boolean;
  activeModel: string;
  job?: DownloadJob;
  onDownload: (id: string) => void;
  onSetActive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isActive = activeModel === model.id || activeModel === model.ollamaFallback;
  const isDownloading = job && job.status !== 'done' && job.status !== 'failed';

  return (
    <div className={`rounded-xl border p-4 transition-colors ${
      isActive ? 'border-blue-500 bg-blue-950/30' : 'border-gray-800 bg-gray-900 hover:border-gray-700'
    }`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white truncate">{model.name}</h3>
            {model.kobeOptimised && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 font-medium shrink-0">Kobe</span>
            )}
            {model.recommended && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/60 text-yellow-300 font-medium shrink-0">★ Recommended</span>
            )}
            {isActive && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/60 text-green-300 font-medium shrink-0">Active</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{model.description}</p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <span className="text-xs text-gray-400">{model.sizeLabel}</span>
        {model.minVramGb === 0
          ? <span className="text-xs text-green-400">CPU ✓</span>
          : <span className="text-xs text-gray-500">{model.minVramGb}GB VRAM</span>
        }
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${LICENSE_COLORS[model.license] ?? LICENSE_COLORS.other}`}>
          {model.license}
        </span>
        <span className="text-xs text-gray-600">v{model.version}</span>
      </div>

      {/* Tags */}
      {model.tags.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {model.tags.map((t) => (
            <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">{t}</span>
          ))}
        </div>
      )}

      {/* Download progress */}
      {job && (
        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <StatusDot status={job.status} />
            <span className="capitalize">{job.status}</span>
            {isDownloading && <span className="ml-auto">{job.progressPct}%</span>}
          </div>
          <ProgressBar pct={job.progressPct} status={job.status} />
          {job.error && <p className="text-xs text-red-400">{job.error}</p>}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        {installed ? (
          <>
            {!isActive && (
              <button
                onClick={() => onSetActive(model.ollamaFallback ?? model.id)}
                className="flex-1 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
              >
                Set Active
              </button>
            )}
            <button
              onClick={() => onDelete(model.ollamaFallback ?? model.id)}
              className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 text-xs transition-colors"
            >
              Remove
            </button>
          </>
        ) : isDownloading ? (
          <div className="flex-1 py-1.5 rounded-lg bg-gray-800 text-gray-500 text-xs text-center">
            Downloading…
          </div>
        ) : (
          <button
            onClick={() => onDownload(model.id)}
            className="flex-1 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white text-xs font-semibold transition-colors"
          >
            ↓ Download
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function KobeModelManager() {
  const [catalogue, setCatalogue] = useState<CatalogueModel[]>([]);
  const [installed, setInstalled] = useState<InstalledModel[]>([]);
  const [activeModel, setActiveModel] = useState('');
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [category, setCategory] = useState<ModelCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'catalogue' | 'installed'>('catalogue');
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load data ───────────────────────────────────────────────────────────────

  const loadCatalogue = useCallback(async () => {
    try {
      const cat = await catalogueApi.all();
      setCatalogue(cat.models);
    } catch {
      setCatalogue(DEMO_MODELS);
    }
  }, []);

  const loadInstalled = useCallback(async () => {
    try {
      const [inst, active] = await Promise.all([installedApi.list(), installedApi.active()]);
      setInstalled(inst.models);
      setActiveModel(active.model);
    } catch {
      setInstalled([]);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      const j = await downloadApi.jobs();
      setJobs(j);
    } catch {
      setJobs([]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await Promise.all([loadCatalogue(), loadInstalled(), loadJobs()]);
      setLoading(false);
    })();
  }, [loadCatalogue, loadInstalled, loadJobs]);

  // Poll active jobs every 2s
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status !== 'done' && j.status !== 'failed');
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(() => {
        void loadJobs();
        void loadInstalled();
      }, 2000);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [jobs, loadJobs, loadInstalled]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleDownload = async (modelId: string) => {
    try {
      const job = await downloadApi.start(modelId);
      setJobs((prev) => [...prev.filter((j) => j.modelId !== modelId), job]);
    } catch {
      // backend unavailable in demo
    }
  };

  const handleSetActive = async (modelId: string) => {
    try {
      await installedApi.setActive(modelId);
      setActiveModel(modelId);
    } catch { /* demo */ }
  };

  const handleDelete = async (modelId: string) => {
    try {
      await installedApi.delete(modelId);
      await loadInstalled();
    } catch { /* demo */ }
  };

  // ── Derived state ────────────────────────────────────────────────────────────

  const installedIds = new Set(installed.map((m) => m.name));

  const filtered = catalogue.filter((m) => {
    const matchCat = category === 'all' || m.category === category;
    const matchSearch = !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase()) ||
      m.tags.some((t) => t.includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  const activeJobs = jobs.filter((j) => j.status !== 'done' && j.status !== 'failed');
  const totalInstalledGb = installed.reduce((s, m) => s + m.size, 0) / 1e9;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <span className="text-2xl">🧠</span>
        <div>
          <h1 className="text-lg font-bold leading-none">Model Manager</h1>
          <p className="text-xs text-gray-400">Kobe AI Model Distribution</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {activeJobs.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              {activeJobs.length} downloading
            </span>
          )}
          {activeModel && (
            <span className="text-xs text-gray-500">
              Active: <span className="text-green-400 font-medium">{activeModel}</span>
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-2 bg-gray-900 border-b border-gray-800 shrink-0">
        {(['catalogue', 'installed'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors capitalize ${
              tab === t
                ? 'bg-gray-950 text-white border-t border-x border-gray-700'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            {t === 'installed'
              ? `Installed (${installed.length})`
              : `Catalogue (${catalogue.length})`}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — category filter */}
        {tab === 'catalogue' && (
          <div className="w-40 shrink-0 border-r border-gray-800 bg-gray-900 py-3 flex flex-col gap-0.5 overflow-y-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id as ModelCategory | 'all')}
                className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left ${
                  category === cat.id
                    ? 'bg-blue-900/40 text-blue-300 font-medium'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                <span>{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search + stats bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
            <input
              placeholder="Search models…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-56"
            />
            {tab === 'installed' && (
              <span className="text-xs text-gray-500 ml-auto">
                {totalInstalledGb.toFixed(1)} GB used
              </span>
            )}
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-48 rounded-xl bg-gray-900 animate-pulse" />
                ))}
              </div>
            ) : tab === 'catalogue' ? (
              filtered.length === 0 ? (
                <div className="text-center text-gray-500 py-16">No models match your search.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filtered.map((m) => (
                    <ModelCard
                      key={m.id}
                      model={m}
                      installed={installedIds.has(m.id) || installedIds.has(m.ollamaFallback ?? '')}
                      activeModel={activeModel}
                      job={jobs.find((j) => j.modelId === m.id)}
                      onDownload={handleDownload}
                      onSetActive={handleSetActive}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )
            ) : (
              /* Installed tab */
              installed.length === 0 ? (
                <div className="text-center text-gray-500 py-16">
                  <p className="text-4xl mb-3">📭</p>
                  <p>No models installed yet.</p>
                  <button
                    onClick={() => setTab('catalogue')}
                    className="mt-3 text-blue-400 hover:text-blue-300 text-sm underline"
                  >
                    Browse catalogue
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {installed.map((m) => {
                    return (
                      <div key={m.name} className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
                        activeModel === m.name ? 'border-blue-500 bg-blue-950/20' : 'border-gray-800 bg-gray-900'
                      }`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white truncate">{m.name}</p>
                            {activeModel === m.name && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/60 text-green-300 font-medium shrink-0">Active</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {(m.size / 1e9).toFixed(2)} GB · {new Date(m.modifiedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {activeModel !== m.name && (
                            <button
                              onClick={() => handleSetActive(m.name)}
                              className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
                            >
                              Set Active
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(m.name)}
                            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 text-xs transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {/* Active downloads footer */}
          {activeJobs.length > 0 && (
            <div className="border-t border-gray-800 bg-gray-900 px-4 py-3 shrink-0 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Downloads</p>
              {activeJobs.map((job) => {
                const model = catalogue.find((m) => m.id === job.modelId);
                return (
                  <div key={job.jobId} className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <StatusDot status={job.status} />
                      <span className="text-gray-300">{model?.name ?? job.modelId}</span>
                      <span className="text-gray-500 capitalize ml-1">{job.status}</span>
                      <span className="ml-auto text-gray-400">{job.progressPct}%</span>
                    </div>
                    <ProgressBar pct={job.progressPct} status={job.status} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
