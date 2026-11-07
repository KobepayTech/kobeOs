import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntakeItem, IntakeSession } from './intake.entity';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';
import { CommerceProductMedia } from '../commerce/commerce.entity';
import { CommerceModule } from '../commerce/commerce.module';
import { HotelMenuItem, HotelRoom } from '../hotel/hotel.entity';
import { PosProduct } from '../pos/pos.entity';
import { AiModule } from '../ai/ai.module';

/**
 * Guided catalogue intake. Creation is delegated to the modules that own each
 * kind of entry rather than reimplemented, so a product made here is identical
 * to one made singly.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntakeSession, IntakeItem, CommerceProductMedia, HotelRoom, HotelMenuItem,
      PosProduct,
    ]),
    CommerceModule,
    AiModule,
  ],
  controllers: [IntakeController],
  providers: [IntakeService],
  exports: [IntakeService],
})
export class IntakeModule {}
