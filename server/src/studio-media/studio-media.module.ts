import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudioMediaProject } from './media-project.entity';
import { StudioMediaJob } from './media-job.entity';
import { StudioMediaController } from './studio-media.controller';
import { StudioMediaDashboardService, StudioMediaJobsService, StudioMediaProjectsService } from './studio-media.service';
import { StudioMediaRunnerService } from './studio-media-runner.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([StudioMediaProject, StudioMediaJob])],
  controllers: [StudioMediaController],
  providers: [
    StudioMediaProjectsService,
    StudioMediaJobsService,
    StudioMediaDashboardService,
    StudioMediaRunnerService,
  ],
})
export class StudioMediaModule {}
