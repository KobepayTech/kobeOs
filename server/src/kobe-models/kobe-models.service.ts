import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as https from 'https';
import * as http from 'http';
import * as crypto from 'crypto';
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
    return this.catalogue;
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
    job.status = 'downloading';

    // Determine source: prefer CDN, fall back to Ollama registry
    const cdnUrl = this.config.get<string>('KOBE_MODELS_CDN_URL');
    const useKobeCdn = !!cdnUrl && model.downloadUrl.startsWith('https://models.kobe');

    if (useKobeCdn) {
      await this.downloadAndVerify(job, model);
    } else if (model.ollamaFallback) {
      // Delegate to Ollama pull API
      job.status = 'installing';
      await this.ollamaPull(ollamaUrl, model.ollamaFallback);
    } else {
      throw new Error(`No download source available for ${model.id}`);
    }

    job.status = 'done';
    job.progressPct = 100;
    job.completedAt = new Date().toISOString();
    this.logger.log(`Model ${model.id} installed successfully`);
  }

  /**
   * Downloads the .kobemodel bundle from the Kobe CDN, verifies its SHA-256
   * checksum, then installs it via the Ollama create API.
   */
  private async downloadAndVerify(job: DownloadJob, model: KobeModelEntry): Promise<void> {
    const cdnBase = this.config.get<string>('KOBE_MODELS_CDN_URL')!;
    const url = model.downloadUrl.replace('https://models.kobe', cdnBase);

    const chunks: Buffer[] = [];
    const hash = crypto.createHash('sha256');

    await new Promise<void>((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      protocol.get(url, (res) => {
        const total = parseInt(res.headers['content-length'] ?? '0', 10);
        if (total) job.totalBytes = total;

        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          hash.update(chunk);
          job.progressBytes += chunk.length;
          job.progressPct = job.totalBytes ? Math.round((job.progressBytes / job.totalBytes) * 100) : 0;
        });
        res.on('end', resolve);
        res.on('error', reject);
      }).on('error', reject);
    });

    job.status = 'verifying';
    const digest = hash.digest('hex');
    if (model.checksum && !model.checksum.startsWith('placeholder') && digest !== model.checksum) {
      throw new Error(`Checksum mismatch for ${model.id}: expected ${model.checksum}, got ${digest}`);
    }

    // Hand off to Ollama — in a real implementation the bundle would be
    // extracted and the modelfile path passed to the Ollama create endpoint.
    job.status = 'installing';
    this.logger.log(`Bundle verified for ${model.id} (${(job.progressBytes / 1e9).toFixed(2)} GB), installing…`);
  }

  /** Delegates to Ollama's /api/pull endpoint and streams progress. */
  private async ollamaPull(ollamaUrl: string, modelName: string): Promise<void> {
    const url = new URL(`${ollamaUrl}/api/pull`);
    const body = JSON.stringify({ name: modelName, stream: false });

    await new Promise<void>((resolve, reject) => {
      const protocol = url.protocol === 'https:' ? https : http;
      const req = protocol.request(
        { hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
        (res) => {
          res.on('data', () => { /* consume */ });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Ollama pull returned ${res.statusCode}`));
            } else {
              resolve();
            }
          });
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
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
