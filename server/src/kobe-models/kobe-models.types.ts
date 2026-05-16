/**
 * Kobe Model Distribution System
 *
 * Models are distributed as .kobemodel bundles from models.kobe (or any
 * configured KOBE_MODELS_CDN_URL). The local Ollama runtime handles inference;
 * this layer controls where models are sourced from.
 */

export type ModelCategory =
  | 'chat'
  | 'coding'
  | 'vision'
  | 'speech'
  | 'video'
  | 'image'
  | 'sports'
  | 'embedding';

export type ModelLicense = 'apache-2.0' | 'mit' | 'llama' | 'gemma' | 'mistral' | 'proprietary' | 'other';

export interface KobeModelEntry {
  /** Unique slug used as the Ollama model name, e.g. "mistral:7b" */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  category: ModelCategory;
  /** Size in bytes */
  sizeBytes: number;
  /** Human-readable size, e.g. "4.1 GB" */
  sizeLabel: string;
  /** Minimum VRAM in GB (0 = CPU-only capable) */
  minVramGb: number;
  /** Whether this is a Kobe-optimised build (quantized/fine-tuned) */
  kobeOptimised: boolean;
  /** Kobe CDN download URL for the .kobemodel bundle */
  downloadUrl: string;
  /** SHA-256 checksum of the .kobemodel bundle */
  checksum: string;
  /** Ollama registry fallback (used when CDN is unavailable) */
  ollamaFallback?: string;
  license: ModelLicense;
  /** Original upstream source for license compliance */
  upstreamUrl: string;
  version: string;
  /** Whether to show in the recommended list */
  recommended: boolean;
  tags: string[];
}

export interface KobeCatalogue {
  version: string;
  updatedAt: string;
  models: KobeModelEntry[];
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
