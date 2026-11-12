import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscountApprovalModule } from '../discount-approval/discount-approval.module';
import { PosModule } from '../pos/pos.module';
import { RetailMember } from './retail-member.entity';
import { RetailWorkspaceController } from './retail-workspace.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RetailMember]), PosModule, DiscountApprovalModule],
  controllers: [RetailWorkspaceController],
})
export class RetailWorkspaceModule {}
