import { Module } from '@nestjs/common';
import { TranslationController } from './translation.controller';
import { TranslationService } from './translation.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [TranslationController],
  providers: [TranslationService],
  exports: [TranslationService],
})
export class TranslationModule {}
