import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpModule } from '../erp/erp.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformModule } from '../platform/platform.module';
import { TRANSIT_ENTITIES } from './transit.entity';
import { TransitCameraController, TransitController, TransitPublicController } from './transit.controller';
import { TransitService } from './transit.service';

@Module({
  imports: [TypeOrmModule.forFeature(TRANSIT_ENTITIES), ErpModule, NotificationsModule, PlatformModule],
  controllers: [TransitController, TransitPublicController, TransitCameraController],
  providers: [TransitService],
  exports: [TransitService],
})
export class TransitModule {}
