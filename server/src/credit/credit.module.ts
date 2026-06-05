import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditInstalment, CreditProfile, CreditReceivable } from './credit.entity';
import { CreditService } from './credit.service';
import { CreditController } from './credit.controller';
import { ErpModule } from '../erp/erp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CreditProfile, CreditReceivable, CreditInstalment]),
    ErpModule,
  ],
  providers: [CreditService],
  controllers: [CreditController],
  exports: [CreditService],
})
export class CreditModule {}
