import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { OcrModule } from '../ocr/ocr.module';
import { PosProduct } from '../pos/pos.entity';
import { OrderFromImageService } from './order-from-image.service';
import { OrderFromImageController } from './order-from-image.controller';

@Module({
  imports: [AiModule, OcrModule, TypeOrmModule.forFeature([PosProduct])],
  providers: [OrderFromImageService],
  controllers: [OrderFromImageController],
})
export class OrderFromImageModule {}
