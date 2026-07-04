import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { KobeAgentService } from './agent.service';
import { PosOrder, PosProduct } from '../pos/pos.entity';
import { ProductReview } from '../store/product-review.entity';
import { RentCharge, Tenant } from '../property/property.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PosOrder, PosProduct, ProductReview, RentCharge, Tenant])],
  providers: [AiService, KobeAgentService],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
