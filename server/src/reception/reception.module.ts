import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformModule } from '../platform/platform.module';
import { RECEPTION_ENTITIES } from './reception.entity';
import { ReceptionService } from './reception.service';
import { ReceptionController, ReceptionPublicController } from './reception.controller';

/**
 * Kobe AI Receptionist — customer-facing assistant per ERP business (FAQ,
 * restaurant ordering, order status, lead capture + human hand-off). One engine
 * behind the website widget, hotel/table QR, WhatsApp, and the voice worker.
 */
@Module({
  // Hotel menu/order repos are reached via DataSource.getRepository (autoloaded
  // entities), NOT forFeature — registering them here duplicated HotelModule's
  // repo providers and created a provider clone-cycle across test app instances.
  imports: [TypeOrmModule.forFeature([...RECEPTION_ENTITIES]), PlatformModule],
  providers: [ReceptionService],
  controllers: [ReceptionController, ReceptionPublicController],
  exports: [ReceptionService],
})
export class ReceptionModule {}
