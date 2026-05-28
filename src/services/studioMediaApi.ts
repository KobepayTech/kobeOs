import { api } from '@/lib/api';

export type StudioMediaProjectRecord = {
  id: string;
  title: string;
  section: 'media-studios' | 'creator-marketplace' | 'brand-studio' | 'football-analytics';
  format: 'short-video' | 'ad-video' | 'creator-package' | 'product-video' | 'match-analysis';
  language: string;
  status: 'draft' | 'generating' | 'ready' | 'published' | 'failed';
  engine: string;
  prompt: string;
  outputUrl?: string | null;
  companyId?: string | null;
};

export type StudioMediaJobRecord = {
  id: string;
  projectId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  engine: string;
  requestPayload: string;
  resultPayload: string;
  outputUrl?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

export type CreateStudioMediaJobRequest = {
  projectId: string;
  status?: StudioMediaJobRecord['status'];
  engine?: string;
  request?: Record<string, unknown>;
  result?: Record<string, unknown>;
  outputUrl?: string;
  errorMessage?: string;
};

export type StudioMediaSummary = {
  projects: number;
  jobs: number;
};

export function getStudioMediaSummary() {
  return api<StudioMediaSummary>('/studio/media/summary');
}

export function listStudioMediaProjects() {
  return api<StudioMediaProjectRecord[]>('/studio/media/projects');
}

export function createStudioMediaProject(data: Partial<StudioMediaProjectRecord> & { title: string }) {
  return api<StudioMediaProjectRecord>('/studio/media/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function listStudioMediaJobs() {
  return api<StudioMediaJobRecord[]>('/studio/media/jobs');
}

export function createStudioMediaJob(data: CreateStudioMediaJobRequest) {
  return api<StudioMediaJobRecord>('/studio/media/jobs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
