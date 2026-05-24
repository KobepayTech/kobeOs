import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CompaniesService, InvoicesService, RolesService, SubscriptionsService, TicketsService,
} from './admin.service';
import {
  CreateCompanyDto, CreateInvoiceDto, CreateRoleDto, CreateSubscriptionDto, CreateTicketDto,
  UpdateCompanyDto, UpdateInvoiceDto, UpdateRoleDto, UpdateSubscriptionDto, UpdateTicketDto,
} from './dto/admin.dto';

@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly companies: CompaniesService,
    private readonly subscriptions: SubscriptionsService,
    private readonly invoices: InvoicesService,
    private readonly roles: RolesService,
    private readonly tickets: TicketsService,
  ) {}

  @Get('companies') listCompanies(@CurrentUser('id') uid: string) { return this.companies.list(uid); }
  @Post('companies') createCompany(@CurrentUser('id') uid: string, @Body() dto: CreateCompanyDto) { return this.companies.create(uid, dto); }
  @Patch('companies/:id') updateCompany(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateCompanyDto) { return this.companies.update(uid, id, dto); }
  @Delete('companies/:id') removeCompany(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.companies.remove(uid, id); }

  @Get('subscriptions') listSubs(@CurrentUser('id') uid: string) { return this.subscriptions.list(uid); }
  @Post('subscriptions') createSub(@CurrentUser('id') uid: string, @Body() dto: CreateSubscriptionDto) { return this.subscriptions.create(uid, dto); }
  @Patch('subscriptions/:id') updateSub(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateSubscriptionDto) { return this.subscriptions.update(uid, id, dto); }
  @Delete('subscriptions/:id') removeSub(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.subscriptions.remove(uid, id); }

  @Get('invoices') listInvoices(@CurrentUser('id') uid: string) { return this.invoices.list(uid); }
  @Post('invoices') createInvoice(@CurrentUser('id') uid: string, @Body() dto: CreateInvoiceDto) { return this.invoices.create(uid, dto); }
  @Patch('invoices/:id') updateInvoice(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateInvoiceDto) { return this.invoices.update(uid, id, dto); }
  @Delete('invoices/:id') removeInvoice(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.invoices.remove(uid, id); }

  @Get('roles') listRoles(@CurrentUser('id') uid: string) { return this.roles.list(uid); }
  @Post('roles') createRole(@CurrentUser('id') uid: string, @Body() dto: CreateRoleDto) { return this.roles.create(uid, dto); }
  @Patch('roles/:id') updateRole(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateRoleDto) { return this.roles.update(uid, id, dto); }
  @Delete('roles/:id') removeRole(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.roles.remove(uid, id); }

  @Get('tickets') listTickets(@CurrentUser('id') uid: string) { return this.tickets.list(uid); }
  @Post('tickets') createTicket(@CurrentUser('id') uid: string, @Body() dto: CreateTicketDto) { return this.tickets.create(uid, dto); }
  @Patch('tickets/:id') updateTicket(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateTicketDto) { return this.tickets.update(uid, id, dto); }
  @Delete('tickets/:id') removeTicket(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.tickets.remove(uid, id); }
}
