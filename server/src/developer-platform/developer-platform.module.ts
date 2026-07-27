import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import {
  DeveloperAiController,
  DeveloperPlatformController,
} from './developer-platform.controller';
import { DeveloperProject } from './developer-project.entity';
import { DeveloperPlatformService } from './developer-platform.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeveloperProject]),
    AiModule,
  ],
  controllers: [DeveloperPlatformController, DeveloperAiController],
  providers: [DeveloperPlatformService],
  exports: [DeveloperPlatformService],
})
export class DeveloperPlatformModule {}
