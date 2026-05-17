const BASE = '/api';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export type ModelCategory = 'chat' | 'coding' | 'vision' | 'speech' | 'video' | 'image' | 'sports' | 'embedding';

export interface CatalogueModel {
  id: string;
  name: string;
  description: string;
  category: ModelCategory;
  sizeBytes: number;
  sizeLabel: string;
  minVramGb: number;
  kobeOptimised: boolean;
  downloadUrl: string;
  checksum: string;
  ollamaFallback?: string;
  license: string;
  upstreamUrl: string;
  version: string;
  recommended: boolean;
  tags: string[];
}

export interface KobeCatalogue {
  version: string;
  updatedAt: string;
  models: CatalogueModel[];
}

export interface InstalledModel {
  name: string;
  size: number;
  digest: string;
  modifiedAt: string;
}

export interface DownloadJob {
  jobId: string;
  modelId: string;
  status: 'queued' | 'downloading' | 'verifying' | 'installing' | 'done' | 'failed';
  progressBytes: number;
  totalBytes: number;
  progressPct: number;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export const catalogueApi = {
  all: () => req<KobeCatalogue>('/kobe-models/catalogue'),
  recommended: () => req<CatalogueModel[]>('/kobe-models/catalogue/recommended'),
  byCategory: (cat: string) => req<CatalogueModel[]>(`/kobe-models/catalogue/category/${cat}`),
  byId: (id: string) => req<CatalogueModel>(`/kobe-models/catalogue/${encodeURIComponent(id)}`),
};

export const installedApi = {
  list: () => req<{ models: InstalledModel[] }>('/ai/models/installed'),
  active: () => req<{ model: string }>('/ai/models/active'),
  setActive: (model: string) => req<{ model: string }>('/ai/models/active', { method: 'PUT', body: JSON.stringify({ model }) }),
  delete: (name: string) => req<void>(`/ai/models/${encodeURIComponent(name)}`, { method: 'DELETE' }),
};

export const downloadApi = {
  start: (modelId: string) => req<DownloadJob>('/kobe-models/download', { method: 'POST', body: JSON.stringify({ modelId }) }),
  jobs: () => req<DownloadJob[]>('/kobe-models/jobs'),
  job: (jobId: string) => req<DownloadJob>(`/kobe-models/jobs/${jobId}`),
};
