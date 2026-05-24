import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AdminCompany, AdminInvoice, AdminRole, AdminSubscription, AdminTicket,
} from './admin.entity';
import {
  CompaniesService, InvoicesService, RolesService, SubscriptionsService, TicketsService,
} from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminCompany, AdminSubscription, AdminInvoice, AdminRole, AdminTicket]),
  ],
  providers: [CompaniesService, SubscriptionsService, InvoicesService, RolesService, TicketsService],
  controllers: [AdminController],
})
export class AdminModule {}
