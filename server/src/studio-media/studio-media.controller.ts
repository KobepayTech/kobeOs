import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { StudioMediaDashboardService, StudioMediaJobsService, StudioMediaProjectsService } from './studio-media.service';
import { CreateStudioMediaJobDto, CreateStudioMediaProjectDto, UpdateStudioMediaJobDto, UpdateStudioMediaProjectDto } from './dto/studio-media.dto';

@UseGuards(JwtAuthGuard)
@Controller('studio/media')
export class StudioMediaController {
  constructor(
    private readonly dashboard: StudioMediaDashboardService,
    private readonly projects: StudioMediaProjectsService,
    private readonly jobs: StudioMediaJobsService,
  ) {}

  @Get('summary')
  summary(@CurrentUser('id') uid: string) {
    return this.dashboard.summary(uid);
  }

  @Get('projects')
  projectsList(@CurrentUser('id') uid: string) {
    return this.projects.list(uid);
  }

  @Post('projects')
  projectsCreate(@CurrentUser('id') uid: string, @Body() dto: CreateStudioMediaProjectDto) {
    return this.projects.createProject(uid, dto);
  }

  @Patch('projects/:id')
  projectsUpdate(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateStudioMediaProjectDto) {
    return this.projects.updateProject(uid, id, dto);
  }

  @Get('jobs')
  jobsList(@CurrentUser('id') uid: string) {
    return this.jobs.list(uid);
  }

  @Post('jobs')
  jobsCreate(@CurrentUser('id') uid: string, @Body() dto: CreateStudioMediaJobDto) {
    return this.jobs.createJob(uid, dto);
  }

  @Patch('jobs/:id')
  jobsUpdate(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateStudioMediaJobDto) {
    return this.jobs.updateJob(uid, id, dto);
  }
}
