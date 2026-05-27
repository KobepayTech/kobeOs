import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QrCode } from './qr.entity';
import { QrService } from './qr.service';
import { QrController } from './qr.controller';

@Module({
  imports: [TypeOrmModule.forFeature([QrCode])],
  providers: [QrService],
  controllers: [QrController],
  exports: [QrService],
})
export class QrModule {}
