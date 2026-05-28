import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudioMediaProject } from './media-project.entity';
import { StudioMediaJob } from './media-job.entity';
import { StudioMediaController } from './studio-media.controller';
import { StudioMediaDashboardService, StudioMediaJobsService, StudioMediaProjectsService } from './studio-media.service';

@Module({
  imports: [TypeOrmModule.forFeature([StudioMediaProject, StudioMediaJob])],
  controllers: [StudioMediaController],
  providers: [StudioMediaProjectsService, StudioMediaJobsService, StudioMediaDashboardService],
})
export class StudioMediaModule {}
