import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HotelWallet, HotelWalletTxn, HotelPayout } from './hotel-wallet.entity';
import { HotelWalletService } from './hotel-wallet.service';
import { HotelWalletController } from './hotel-wallet.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HotelWallet, HotelWalletTxn, HotelPayout]), ConfigModule],
  providers: [HotelWalletService],
  controllers: [HotelWalletController],
  exports: [HotelWalletService],
})
export class HotelWalletModule {}
