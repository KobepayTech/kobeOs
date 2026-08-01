import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RemittanceService } from './remittance.service';
import { RemittanceController } from './remittance.controller';
import { RemittanceClaim, RemittanceSupplierQr, RemittancePayout } from './remittance.entity';

/** KobePay cross-border remittance with fixed-amount supplier child-QRs. */
@Module({
  imports: [TypeOrmModule.forFeature([RemittanceClaim, RemittanceSupplierQr, RemittancePayout])],
  providers: [RemittanceService],
  controllers: [RemittanceController],
  exports: [RemittanceService],
})
export class RemittanceModule {}
