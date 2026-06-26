import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CustomerPortalService } from './customer-portal.service';
import { CustomerPortalController } from './customer-portal.controller';
import { CargoCustomer, Parcel } from '../cargo/cargo.entity';
import { PosOrder, PosOrderItem } from '../pos/pos.entity';
import { LoyaltyCustomer } from '../erp/erp.entity';
import { MzigoParcel } from '../mzigo/mzigo.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { BeemService } from '../notifications/beem.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Parcel, PosOrder, PosOrderItem, CargoCustomer, LoyaltyCustomer, MzigoParcel]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    NotificationsModule,
  ],
  providers: [CustomerPortalService, BeemService],
  controllers: [CustomerPortalController],
})
export class CustomerPortalModule {}
