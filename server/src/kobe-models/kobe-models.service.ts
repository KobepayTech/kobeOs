import { QWEN_EDITION, QWEN_MODEL } from '../ai/qwen-edition';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as https from 'https';
import * as http from 'http';
import { EMBEDDED_CATALOGUE } from './kobe-models.catalogue';
import type { DownloadJob, KobeCatalogue, KobeModelEntry } from './kobe-models.types';

@Injectable()
export class KobeModelsService {
  private readonly logger = new Logger(KobeModelsService.name);
  private catalogue: KobeCatalogue = EMBEDDED_CATALOGUE;
  private readonly jobs = new Map<string, DownloadJob>();

  constructor(private readonly config: ConfigService) {}

  // ── Catalogue ──────────────────────────────────────────────────────────────

  /**
   * Returns the current catalogue, refreshing from CDN if a URL is configured.
   * Falls back to the embedded catalogue on any network error.
   */
  async getCatalogue(): Promise<KobeCatalogue> {
    if (this.config.get('KOBE_AI_EDITION') === QWEN_EDITION) return {
      version: '1', updatedAt: '2026-11-01', edition: QWEN_EDITION,
      models: [{ id: QWEN_MODEL, name: 'Qwen 3-VL 8B', category: 'vision',
        description: 'One local model for business, coding, translation and image understanding. Install once, then work offline.',
        sizeBytes: 6200000000, sizeLabel: 'about 6.2 GB', minVramGb: 0, kobeOptimised: false,
        downloadUrl: '', checksum: '', ollamaFallback: QWEN_MODEL, license: 'apache-2.0',
        upstreamUrl: 'https://ollama.com/library/qwen3-vl:8b', version: 'Q4_K_M',
        recommended: true, tags: ['text', 'vision', 'business', 'coding', 'reasoning', 'offline'] }],
    };
    const cdnUrl = this.config.get<string>('KOBE_MODELS_CDN_URL');
    if (cdnUrl) {
      try {
        const remote = await this.fetchJson<KobeCatalogue>(`${cdnUrl}/catalogue.json`);
        this.catalogue = remote;
        this.logger.log(`Catalogue refreshed from CDN: ${remote.models.length} models`);
      } catch (err) {
        this.logger.warn(`CDN catalogue fetch failed, using embedded: ${(err as Error).message}`);
      }
    }
    return {
      ...this.catalogue,
      // MVP exposes only models with a real installer. Custom .kobemodel
      // bundle installation is not production-ready yet; Ollama-backed models
      // are installed through Ollama's verified registry pull API.
      models: this.catalogue.models.filter((model) => Boolean(model.ollamaFallback)),
    };
  }

  async getModelById(id: string): Promise<KobeModelEntry> {
    const cat = await this.getCatalogue();
    const model = cat.models.find((m) => m.id === id);
    if (!model) throw new NotFoundException(`Model '${id}' not in catalogue`);
    return model;
  }

  async getByCategory(category: string): Promise<KobeModelEntry[]> {
    const cat = await this.getCatalogue();
    return cat.models.filter((m) => m.category === category);
  }

  async getRecommended(): Promise<KobeModelEntry[]> {
    const cat = await this.getCatalogue();
    return cat.models.filter((m) => m.recommended);
  }

  // ── Download jobs ──────────────────────────────────────────────────────────

  /**
   * Starts a background download of a .kobemodel bundle.
   * The bundle is streamed, checksummed, then handed to Ollama via its pull API.
   * Returns a jobId for progress polling.
   */
  async startDownload(modelId: string): Promise<DownloadJob> {
    const model = await this.getModelById(modelId);
    const existing = [...this.jobs.values()].find(job => job.modelId === modelId && !['done', 'failed'].includes(job.status));
    if (existing) return existing;

    const job: DownloadJob = {
      jobId: randomUUID(),
      modelId,
      status: 'queued',
      progressBytes: 0,
      totalBytes: model.sizeBytes,
      progressPct: 0,
      startedAt: new Date().toISOString(),
    };
    this.jobs.set(job.jobId, job);

    // Run download in background — do not await
    this.runDownload(job, model).catch((err) => {
      job.status = 'failed';
      job.error = (err as Error).message;
      this.logger.error(`Download failed for ${modelId}: ${job.error}`);
    });

    return job;
  }

  getJob(jobId: string): DownloadJob {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundException(`Job '${jobId}' not found`);
    return job;
  }

  listJobs(): DownloadJob[] {
    return [...this.jobs.values()];
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async runDownload(job: DownloadJob, model: KobeModelEntry): Promise<void> {
    const ollamaUrl = this.config.get<string>('OLLAMA_URL') ?? 'http://localhost:11434';
    if (!model.ollamaFallback) {
      throw new Error(`No verified production installer is available for ${model.id}`);
    }

    job.status = 'installing';
    await this.ollamaPull(ollamaUrl, model.ollamaFallback, job);

    job.status = 'done';
    job.progressPct = 100;
    job.completedAt = new Date().toISOString();
    this.logger.log(`Model ${model.id} installed through Ollama registry`);
  }

  /** Delegates to Ollama's /api/pull endpoint and streams progress. */
  private async ollamaPull(ollamaUrl: string, modelName: string, job: DownloadJob): Promise<void> {
    const url = new URL(`${ollamaUrl}/api/pull`);
    const body = JSON.stringify({ name: modelName, stream: true });
    await new Promise<void>((resolve, reject) => {
      let pending = ''; let succeeded = false;
      const layers = new Map<string, { total: number; completed: number }>();
      const protocol = url.protocol === 'https:' ? https : http;
      const consume = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as { status?: string; error?: string; digest?: string; total?: number; completed?: number };
        if (event.error) throw new Error(event.error);
        if (event.total && event.digest) {
          layers.set(event.digest, { total: event.total, completed: Math.max(0, Math.min(event.completed || 0, event.total)) });
          const values = [...layers.values()];
          job.totalBytes = Math.max(1, values.reduce((sum, layer) => sum + layer.total, 0));
          job.progressBytes = values.reduce((sum, layer) => sum + layer.completed, 0);
          job.progressPct = Math.min(99, Math.round(job.progressBytes / job.totalBytes * 100));
        }
        if (event.status?.includes('verifying')) job.status = 'verifying';
        else if (event.status?.includes('pulling')) job.status = 'downloading';
        if (event.status === 'success') succeeded = true;
      };
      const req = protocol.request({ hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
        res.setEncoding('utf8');
        if (!res.statusCode || res.statusCode >= 400) { res.resume(); finish(new Error(`Ollama pull returned ${res.statusCode}`)); return; }
        res.on('data', (chunk: string) => {
          try {
            pending += chunk;
            if (pending.length > 1024 * 1024) throw new Error('Invalid model download response');
            const lines = pending.split('\n'); pending = lines.pop() || '';
            for (const line of lines) consume(line);
          } catch (error) { req.destroy(); finish(error as Error); }
        });
        res.on('error', finish);
        res.on('end', () => {
          try { consume(pending); finish(succeeded ? undefined : new Error('Model download ended without successful verification')); }
          catch (error) { finish(error as Error); }
        });
      });
      const deadline = setTimeout(() => { req.destroy(); finish(new Error('Model download timed out; retry to resume.')); }, 2 * 60 * 60 * 1000);
      const finish = (error?: Error) => { clearTimeout(deadline); if (error) reject(error); else resolve(); };
      req.setTimeout(120_000, () => { req.destroy(); finish(new Error('Model download stalled; retry to resume.')); });
      req.on('error', finish); req.end(body);
    });
  }

  private fetchJson<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      protocol.get(url, (res) => {
        let data = '';
        res.on('data', (c: string) => (data += c));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(e); }
        });
      }).on('error', reject);
    });
  }
}
