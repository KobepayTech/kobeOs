import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { DeveloperAiController, DeveloperPlatformController } from './developer-platform.controller';
import { DeveloperGitController } from './developer-git.controller';
import { DeveloperProject } from './developer-project.entity';
import { DeveloperPlatformService } from './developer-platform.service';
import { DeveloperGitService } from './developer-git.service';

@Module({
  imports: [TypeOrmModule.forFeature([DeveloperProject]), AiModule],
  controllers: [DeveloperPlatformController, DeveloperAiController, DeveloperGitController],
  providers: [DeveloperPlatformService, DeveloperGitService],
  exports: [DeveloperPlatformService, DeveloperGitService],
})
export class DeveloperPlatformModule {}
