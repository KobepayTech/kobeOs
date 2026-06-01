import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscountRequest, DiscountLog, DiscountApprovalRule } from './discount-approval.entity';
import { DiscountApprovalService } from './discount-approval.service';
import { DiscountApprovalController } from './discount-approval.controller';
import { BeemSmsService } from './beem-sms.service';
import { PosProduct } from '../pos/pos.entity';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DiscountRequest,
      DiscountLog,
      DiscountApprovalRule,
      PosProduct,   // needed for stock validation and updates
    ]),
    AuditModule,
    NotificationsModule,
  ],
  providers: [DiscountApprovalService, BeemSmsService],
  controllers: [DiscountApprovalController],
  exports: [DiscountApprovalService],
})
export class DiscountApprovalModule {}
