import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { spawn } from 'child_process';
import { join } from 'path';
import * as fs from 'fs';
import { VideoJob } from './video-job.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class VideoGenerationService {
  private readonly logger = new Logger('VideoGeneration');
  private readonly pixellePath: string;

  constructor(
    @InjectRepository(VideoJob) private readonly repo: Repository<VideoJob>,
    private readonly audit: AuditService,
  ) {
    this.pixellePath = join(process.cwd(), '..', 'pixelle-video');
  }

  async createJob(ownerId: string, data: Record<string, unknown>): Promise<VideoJob> {
    const job = this.repo.create({
      ownerId,
      title: data.title as string | undefined,
      topic: data.topic as string | undefined,
      script: data.script as string | undefined,
      status: 'pending' as const,
      config: data,
      progress: { step: 'queued', detail: 'Waiting to start...' },
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
      job.progressPercent = 10;
      await this.repo.save(job);

      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const scriptPath = join(this.pixellePath, 'main.py');

      let cmd = pythonCmd;
      let cmdArgs: string[] = [];

      if (fs.existsSync(scriptPath)) {
        cmdArgs = [
          scriptPath,
          '--topic', (data.topic as string) || '',
          '--template', (data.template as string) || 'default',
          '--voice', (data.voice as string) || 'edge-tts',
          '--output-id', jobId,
        ];
      } else {
        cmd = 'uv';
        cmdArgs = ['run', 'python', '-c', `print("Pixelle placeholder for job ${jobId}")`];
      }

      const process_ = spawn(cmd, cmdArgs, {
        cwd: this.pixellePath,
        env: { ...process.env, PIXELLE_JOB_ID: jobId },
      });

      let errorOutput = '';

      process_.stdout?.on('data', (d) => this.parseProgress(jobId, d.toString()));
      process_.stderr?.on('data', (d) => { errorOutput += d.toString(); });

      await new Promise<void>((resolve, reject) => {
        process_.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Exit code ${code}: ${errorOutput}`));
        });
        process_.on('error', reject);
      });

      const outputDir = join(this.pixellePath, 'output');
      let latest: string | null = null;
      if (fs.existsSync(outputDir)) {
        const files = fs.readdirSync(outputDir).filter((f) => f.endsWith('.mp4'));
        const sorted = files.sort((a, b) =>
          fs.statSync(join(outputDir, b)).mtime.getTime() - fs.statSync(join(outputDir, a)).mtime.getTime(),
        );
        latest = sorted[0] ?? null;
      }

      job.status = 'completed';
      job.progressPercent = 100;
      job.outputPath = latest ? join(outputDir, latest) : null;
      job.completedAt = new Date();
      await this.repo.save(job);

      await this.audit.log({
        action: 'CREATE',
        entityType: 'video_job',
        entityId: jobId,
        userId: ownerId,
        newValue: { title: job.title, status: 'completed' },
      });

    } catch (err) {
      job.status = 'failed';
      job.errorMessage = (err as Error).message;
      await this.repo.save(job);
    }
  }

  private async parseProgress(jobId: string, output: string): Promise<void> {
    const job = await this.repo.findOne({ where: { id: jobId } });
    if (!job) return;

    if (output.includes('Generating script')) job.progressPercent = 15;
    else if (output.includes('Generating images')) {
      job.status = 'generating_images';
      job.progressPercent = 40;
    } else if (output.includes('Synthesizing voice')) {
      job.status = 'synthesizing_voice';
      job.progressPercent = 60;
    } else if (output.includes('Compositing')) {
      job.status = 'compositing';
      job.progressPercent = 80;
    }

    await this.repo.save(job);
  }
}
