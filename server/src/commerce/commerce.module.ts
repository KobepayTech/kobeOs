import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PosProduct } from '../pos/pos.entity';
import { Property } from '../property/property.entity';
import { PlatformModule } from '../platform/platform.module';
import { AiModule } from '../ai/ai.module';
import { VideoGenerationModule } from '../video-generation/video-generation.module';
import { CAR_ENTITIES } from './cars.entity';
import { COMMERCE_ENTITIES } from './commerce.entity';
import { CommerceController, CommercePublicController } from './commerce.controller';
import { CommerceService } from './commerce.service';

@Module({
  imports: [TypeOrmModule.forFeature([...COMMERCE_ENTITIES, ...CAR_ENTITIES, PosProduct, Property]), PlatformModule, AiModule, VideoGenerationModule],
  controllers: [CommerceController, CommercePublicController],
  providers: [CommerceService],
  exports: [CommerceService],
})
export class CommerceModule {}
