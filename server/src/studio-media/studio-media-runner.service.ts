import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudioMediaJob } from './media-job.entity';
import { StudioMediaProject } from './media-project.entity';

@Injectable()
export class StudioMediaRunnerService {
  private readonly logger = new Logger(StudioMediaRunnerService.name);
  private running = false;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(StudioMediaJob) private readonly jobs: Repository<StudioMediaJob>,
    @InjectRepository(StudioMediaProject) private readonly projects: Repository<StudioMediaProject>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processQueuedJobs() {
    const engineApiUrl = this.config.get<string>('STUDIO_MEDIA_ENGINE_API_URL');
    if (!engineApiUrl || this.running) return;

    this.running = true;
    try {
      const queued = await this.jobs.find({
        where: { status: 'queued' },
        order: { createdAt: 'ASC' },
        take: 3,
      });

      for (const job of queued) {
        await this.runJob(engineApiUrl, job);
      }
    } finally {
      this.running = false;
    }
  }

  private async runJob(engineApiUrl: string, job: StudioMediaJob) {
    job.status = 'running';
    job.startedAt = new Date();
    await this.jobs.save(job);

    try {
      const payload = job.requestPayload ? JSON.parse(job.requestPayload) : {};
      const response = await fetch(`${engineApiUrl.replace(/\/$/, '')}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Engine responded with HTTP ${response.status}`);

      const result = await response.json();
      job.status = 'completed';
      job.resultPayload = JSON.stringify(result);
      job.outputUrl = typeof result?.outputUrl === 'string' ? result.outputUrl : job.outputUrl;
      job.completedAt = new Date();
      await this.jobs.save(job);

      const project = await this.projects.findOne({ where: { id: job.projectId, ownerId: job.ownerId } });
      if (project) {
        project.status = 'ready';
        project.outputUrl = job.outputUrl ?? project.outputUrl;
        await this.projects.save(project);
      }
    } catch (error) {
      job.status = 'failed';
      job.errorMessage = (error as Error).message;
      job.completedAt = new Date();
      await this.jobs.save(job);
      this.logger.warn(`Studio media job failed: ${(error as Error).message}`);
    }
  }
}
