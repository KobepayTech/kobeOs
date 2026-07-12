import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { LiveSession, LivePin, LiveComment } from './live-sale.entity';
import { PosProduct } from '../pos/pos.entity';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { LiveSaleService } from './live-sale.service';
import { LiveSaleController, LiveSaleIngestController, LiveSalePublicController } from './live-sale.controller';
import { PalmPesaService } from '../creators/palmpesa.service';
import { PosModule } from '../pos/pos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LiveSession, LivePin, LiveComment, PosProduct, StoreSettings]),
    ConfigModule,
    PosModule, // provides OrdersService (atomic stock decrement)
  ],
  providers: [LiveSaleService, PalmPesaService],
  controllers: [LiveSaleController, LiveSaleIngestController, LiveSalePublicController],
  exports: [LiveSaleService],
})
export class LiveSaleModule {}
