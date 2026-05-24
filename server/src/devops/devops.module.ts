import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevCommit, DevDeployment, DevFeatureFlag, DevIssue } from './devops.entity';
import {
  CommitsService, DeploymentsService, FeatureFlagsService, IssuesService,
} from './devops.service';
import { DevopsController } from './devops.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DevCommit, DevFeatureFlag, DevDeployment, DevIssue])],
  providers: [CommitsService, FeatureFlagsService, DeploymentsService, IssuesService],
  controllers: [DevopsController],
})
export class DevopsModule {}
