import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchDoc } from './search.entity';
import { PosProduct } from '../pos/pos.entity';
import { Tenant } from '../property/property.entity';
import { ProductReview } from '../store/product-review.entity';
import { AiModule } from '../ai/ai.module';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SearchDoc, PosProduct, Tenant, ProductReview]),
    AiModule,
  ],
  providers: [SearchService],
  controllers: [SearchController],
  exports: [SearchService],
})
export class SearchModule {}
