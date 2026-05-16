import { Module } from '@nestjs/common';
import { KobeModelsService } from './kobe-models.service';
import { KobeModelsController } from './kobe-models.controller';

@Module({
  providers: [KobeModelsService],
  controllers: [KobeModelsController],
  exports: [KobeModelsService],
})
export class KobeModelsModule {}
