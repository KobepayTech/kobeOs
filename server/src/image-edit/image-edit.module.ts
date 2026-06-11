import { Module } from '@nestjs/common';
import { ImageEditController } from './image-edit.controller';
import { ImageEditService } from './image-edit.service';

@Module({
  controllers: [ImageEditController],
  providers: [ImageEditService],
  exports: [ImageEditService],
})
export class ImageEditModule {}
