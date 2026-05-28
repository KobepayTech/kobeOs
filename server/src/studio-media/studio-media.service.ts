import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OwnedCrudService } from '../common/owned.service';
import { StudioMediaProject } from './media-project.entity';
import { StudioMediaJob } from './media-job.entity';
import { CreateStudioMediaJobDto, CreateStudioMediaProjectDto, UpdateStudioMediaJobDto, UpdateStudioMediaProjectDto } from './dto/studio-media.dto';

@Injectable()
export class StudioMediaProjectsService extends OwnedCrudService<StudioMediaProject> {
  constructor(@InjectRepository(StudioMediaProject) repo: Repository<StudioMediaProject>) { super(repo); }

  createProject(ownerId: string, dto: CreateStudioMediaProjectDto) {
    return this.create(ownerId, dto);
  }

  updateProject(ownerId: string, id: string, dto: UpdateStudioMediaProjectDto) {
    return this.update(ownerId, id, dto);
  }
}

@Injectable()
export class StudioMediaJobsService extends OwnedCrudService<StudioMediaJob> {
  constructor(@InjectRepository(StudioMediaJob) repo: Repository<StudioMediaJob>) { super(repo); }

  createJob(ownerId: string, dto: CreateStudioMediaJobDto) {
    return this.create(ownerId, {
      projectId: dto.projectId,
      status: dto.status ?? 'queued',
      engine: dto.engine ?? 'MoneyPrinterTurbo',
      requestPayload: dto.request ? JSON.stringify(dto.request) : '',
      resultPayload: dto.result ? JSON.stringify(dto.result) : '',
      outputUrl: dto.outputUrl,
      errorMessage: dto.errorMessage,
      startedAt: dto.status === 'running' ? new Date() : undefined,
      completedAt: dto.status === 'completed' || dto.status === 'failed' || dto.status === 'cancelled' ? new Date() : undefined,
    });
  }

  updateJob(ownerId: string, id: string, dto: UpdateStudioMediaJobDto) {
    return this.update(ownerId, id, {
      projectId: dto.projectId,
      status: dto.status,
      engine: dto.engine,
      requestPayload: dto.request ? JSON.stringify(dto.request) : undefined,
      resultPayload: dto.result ? JSON.stringify(dto.result) : undefined,
      outputUrl: dto.outputUrl,
      errorMessage: dto.errorMessage,
      startedAt: dto.status === 'running' ? new Date() : undefined,
      completedAt: dto.status === 'completed' || dto.status === 'failed' || dto.status === 'cancelled' ? new Date() : undefined,
    });
  }
}

@Injectable()
export class StudioMediaDashboardService {
  constructor(
    private readonly projects: StudioMediaProjectsService,
    private readonly jobs: StudioMediaJobsService,
  ) {}

  async summary(ownerId: string) {
    const [projects, jobs] = await Promise.all([
      this.projects.count(ownerId),
      this.jobs.count(ownerId),
    ]);
    return { projects, jobs };
  }
}
