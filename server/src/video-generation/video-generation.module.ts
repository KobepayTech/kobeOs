import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoJob } from './video-job.entity';
import { VideoGenerationService } from './video-generation.service';
import { VideoGenerationController } from './video-generation.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([VideoJob]), AuditModule],
  controllers: [VideoGenerationController],
  providers: [VideoGenerationService],
  exports: [VideoGenerationService],
})
export class VideoGenerationModule {}
