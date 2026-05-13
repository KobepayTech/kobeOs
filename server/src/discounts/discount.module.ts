import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign, Coupon, DiscountRule } from './discount.entity';
import { CampaignsService, CouponsService, RulesService } from './discount.service';
import { DiscountsController } from './discount.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DiscountRule, Coupon, Campaign])],
  providers: [RulesService, CouponsService, CampaignsService],
  controllers: [DiscountsController],
})
export class DiscountsModule {}
