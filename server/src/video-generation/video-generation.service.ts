import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VideoJob } from './video-job.entity';
import { AuditService } from '../audit/audit.service';

/**
 * Drives video jobs against MoneyPrinterTurbo
 * (https://github.com/harry0703/MoneyPrinterTurbo, MIT).
 *
 * Vendor compose at vendor/moneyprinter/docker-compose.yml exposes the
 * upstream API on :8080. We POST a task, then poll /api/v1/tasks/{id}
 * until state hits 2 (success) or 3 (failed), translating progress into
 * the existing VideoJob status enum so the front-end behaves the same.
 */

type MoneyPrinterTaskCreate = { task_id?: string; data?: { task_id?: string } };

interface MoneyPrinterTaskStatus {
  status?: number;
  message?: string;
  data?: {
    state?: number;     // 1 = running, 2 = success, 3 = failed
    progress?: number;
    videos?: string[];
    combined_videos?: string[];
    audio_file?: string;
    subtitle_path?: string;
    script?: string;
  };
}

@Injectable()
export class VideoGenerationService {
  private readonly logger = new Logger('VideoGeneration');
  private readonly baseUrl: string;
  private readonly pollMs: number;
  private readonly timeoutMs: number;

  constructor(
    @InjectRepository(VideoJob) private readonly repo: Repository<VideoJob>,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.baseUrl = (config.get<string>('MONEY_PRINTER_BASE_URL') ?? 'http://localhost:8080').replace(/\/$/, '');
    this.pollMs = Number(config.get<string>('MONEY_PRINTER_POLL_MS') ?? 4000);
    this.timeoutMs = Number(config.get<string>('MONEY_PRINTER_TIMEOUT_MS') ?? 15 * 60 * 1000);
  }

  async createJob(ownerId: string, data: Record<string, unknown>): Promise<VideoJob> {
    const job = this.repo.create({
      ownerId,
      title: (data.title as string | undefined) ?? (data.topic as string | undefined) ?? 'Untitled video',
      topic: data.topic as string | undefined,
      script: data.script as string | undefined,
      status: 'pending' as const,
      config: data,
      progress: { step: 'queued', detail: 'Waiting for MoneyPrinterTurbo to pick up the task...' },
    });
    const saved = await this.repo.save(job);

    this.runGeneration(saved.id, ownerId, data).catch((err) => {
      this.logger.error(`Job ${saved.id} failed: ${(err as Error).message}`);
    });

    return saved;
  }

  async getJob(ownerId: string, id: string): Promise<VideoJob> {
    const job = await this.repo.findOne({ where: { id, ownerId } });
    if (!job) throw new NotFoundException('Video job not found');
    return job;
  }

  async listJobs(ownerId: string, page = 1, limit = 20): Promise<VideoJob[]> {
    return this.repo.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async deleteJob(ownerId: string, id: string): Promise<void> {
    const job = await this.getJob(ownerId, id);
    await this.repo.remove(job);
  }

  private async runGeneration(jobId: string, ownerId: string, data: Record<string, unknown>): Promise<void> {
    const job = await this.repo.findOne({ where: { id: jobId } });
    if (!job) return;

    try {
      job.status = 'scripting';
      job.progressPercent = 5;
      job.progress = { step: 'submitting', detail: 'Sending task to MoneyPrinterTurbo' };
      await this.repo.save(job);

      const payload = this.buildPayload(data);
      const createRes = await fetch(`${this.baseUrl}/api/v1/videos`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!createRes.ok) {
        const text = await createRes.text().catch(() => '');
        throw new Error(`MoneyPrinterTurbo POST /api/v1/videos returned ${createRes.status}: ${text.slice(0, 200)}`);
      }
      const createBody = (await createRes.json()) as MoneyPrinterTaskCreate;
      const taskId = createBody.task_id ?? createBody.data?.task_id;
      if (!taskId) throw new Error('MoneyPrinterTurbo did not return a task_id');

      job.progress = { step: 'submitted', taskId, detail: 'Task queued upstream' };
      await this.repo.save(job);

      const finalStatus = await this.pollUntilDone(jobId, taskId);

      const videos = finalStatus.data?.videos ?? finalStatus.data?.combined_videos ?? [];
      const outputPath = videos[0] ?? null;
      job.status = 'completed';
      job.progressPercent = 100;
      job.outputPath = outputPath;
      job.outputUrl = outputPath ? `${this.baseUrl}/${outputPath.replace(/^\/+/, '')}` : null;
      job.completedAt = new Date();
      job.progress = { step: 'completed', taskId, videos };
      await this.repo.save(job);

      await this.audit.log({
        action: 'CREATE',
        entityType: 'video_job',
        entityId: jobId,
        userId: ownerId,
        newValue: { title: job.title, status: 'completed', taskId },
      });
    } catch (err) {
      const message = (err as Error).message;
      const reloaded = await this.repo.findOne({ where: { id: jobId } });
      if (reloaded) {
        reloaded.status = 'failed';
        reloaded.errorMessage = message;
        await this.repo.save(reloaded);
      }
      this.logger.warn(`Video job ${jobId} failed: ${message}`);
    }
  }

  /**
   * Maps the front-end's loose request body onto MoneyPrinterTurbo's
   * /api/v1/videos schema. Anything not provided falls back to the
   * defaults the upstream README documents (9:16 short, English voice,
   * Pexels stock footage, subtitles on).
   */
  private buildPayload(data: Record<string, unknown>): Record<string, unknown> {
    const str = (k: string, fallback: string) => (typeof data[k] === 'string' && data[k] ? (data[k] as string) : fallback);
    const num = (k: string, fallback: number) => (typeof data[k] === 'number' ? (data[k] as number) : fallback);
    const bool = (k: string, fallback: boolean) => (typeof data[k] === 'boolean' ? (data[k] as boolean) : fallback);

    return {
      video_subject: str('topic', str('subject', 'KobeOS demo video')),
      video_script: str('script', ''),
      video_terms: str('terms', ''),
      video_aspect: str('aspect', '9:16'),
      video_concat_mode: str('concat', 'random'),
      video_clip_duration: num('clipDuration', 5),
      video_count: num('count', 1),
      video_language: str('language', ''),
      video_source: str('source', 'pexels'),
      voice_name: str('voice', 'en-US-AvaNeural-Female'),
      voice_volume: num('voiceVolume', 1.0),
      voice_rate: num('voiceRate', 1.0),
      bgm_type: str('bgmType', 'random'),
      bgm_file: str('bgmFile', ''),
      bgm_volume: num('bgmVolume', 0.2),
      subtitle_enabled: bool('subtitlesEnabled', true),
      subtitle_position: str('subtitlePosition', 'bottom'),
      font_name: str('font', 'STHeitiMedium.ttc'),
      text_fore_color: str('textColor', '#FFFFFF'),
      text_background_color: str('textBackgroundColor', 'transparent'),
      font_size: num('fontSize', 60),
      stroke_color: str('strokeColor', '#000000'),
      stroke_width: num('strokeWidth', 1.5),
      n_threads: num('threads', 2),
      paragraph_number: num('paragraphs', 1),
    };
  }

  private async pollUntilDone(jobId: string, taskId: string): Promise<MoneyPrinterTaskStatus> {
    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, this.pollMs));
      const res = await fetch(`${this.baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}`);
      if (!res.ok) continue;
      const body = (await res.json()) as MoneyPrinterTaskStatus;
      const state = body.data?.state ?? 1;
      const progress = body.data?.progress ?? 0;
      await this.applyProgress(jobId, state, progress, taskId);
      if (state === 2) return body;
      if (state === 3) throw new Error(body.message ?? 'MoneyPrinterTurbo task failed');
    }
    throw new Error(`MoneyPrinterTurbo task ${taskId} timed out after ${this.timeoutMs}ms`);
  }

  /**
   * MoneyPrinterTurbo reports a single 0..100 progress number. We map
   * loose bands back onto the existing VideoJob status enum so the
   * front-end's status pill stays informative.
   */
  private async applyProgress(jobId: string, state: number, progress: number, taskId: string): Promise<void> {
    const job = await this.repo.findOne({ where: { id: jobId } });
    if (!job) return;
    if (state === 2) {
      job.progressPercent = 100;
      job.status = 'completed';
    } else if (state === 3) {
      job.status = 'failed';
    } else {
      job.progressPercent = Math.max(job.progressPercent, Math.min(99, progress));
      if (progress < 20) job.status = 'scripting';
      else if (progress < 50) job.status = 'generating_images';
      else if (progress < 75) job.status = 'synthesizing_voice';
      else job.status = 'compositing';
    }
    job.progress = { step: job.status, taskId, progress };
    await this.repo.save(job);
  }
}
