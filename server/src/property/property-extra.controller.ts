import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantsService, UnitsService } from './property.service';
import {
  ApplicationsService,
  ExpensesService,
  LeasesService,
  PropertyDashboardService,
  PropertySettingsService,
  RentChargesService,
  RentIncreaseSimulationsService,
  VendorsService,
  WorkOrdersService,
} from './property-extra.service';
import {
  CreateApplicationDto,
  CreateChargeDto,
  CreateExpenseDto,
  CreateLeaseDto,
  CreateRentIncreaseSimulationDto,
  CreateVendorDto,
  CreateWorkOrderDto,
  GenerateChargesDto,
  UpdateApplicationDto,
  UpdateChargeDto,
  UpdateExpenseDto,
  UpdateLeaseDto,
  UpdateSettingsDto,
  UpdateVendorDto,
  UpdateWorkOrderDto,
} from './dto/property-extra.dto';

@UseGuards(JwtAuthGuard)
@Controller('property')
export class PropertyExtraController {
  constructor(
    private readonly leases: LeasesService,
    private readonly charges: RentChargesService,
    private readonly vendors: VendorsService,
    private readonly workOrders: WorkOrdersService,
    private readonly applications: ApplicationsService,
    private readonly settings: PropertySettingsService,
    private readonly expenses: ExpensesService,
    private readonly simulations: RentIncreaseSimulationsService,
    private readonly dashboard: PropertyDashboardService,
    private readonly tenants: TenantsService,
    private readonly units: UnitsService,
  ) {}

  @Get('dashboard/summary')
  dashboardSummary(@CurrentUser('id') uid: string, @Query('period') period?: string) {
    return this.dashboard.summary(uid, period);
  }

  @Get('leases')
  listLeases(@CurrentUser('id') uid: string, @Query('tenantId') tenantId?: string, @Query('unitId') unitId?: string) {
    if (tenantId) return this.leases.byTenant(uid, tenantId);
    if (unitId) return this.leases.byUnit(uid, unitId);
    return this.leases.list(uid);
  }
  @Post('leases') createLease(@CurrentUser('id') uid: string, @Body() dto: CreateLeaseDto) { return this.leases.create(uid, dto as any); }
  @Patch('leases/:id') updateLease(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateLeaseDto) { return this.leases.update(uid, id, dto as any); }
  @Delete('leases/:id') removeLease(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.leases.remove(uid, id); }

  @Get('rent-charges')
  listCharges(@CurrentUser('id') uid: string, @Query('period') period?: string) { return this.charges.listByPeriod(uid, period); }
  @Post('rent-charges') createCharge(@CurrentUser('id') uid: string, @Body() dto: CreateChargeDto) { return this.charges.create(uid, dto as any); }
  @Post('rent-charges/generate') generateCharges(@CurrentUser('id') uid: string, @Body() dto: GenerateChargesDto) { return this.charges.generate(uid, dto.period); }
  @Patch('rent-charges/:id') updateCharge(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateChargeDto) { return this.charges.update(uid, id, dto as any); }
  @Post('rent-charges/:id/waive') waiveCharge(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.charges.waive(uid, id); }
  @Delete('rent-charges/:id') removeCharge(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.charges.remove(uid, id); }

  @Get('vendors')
  listVendors(@CurrentUser('id') uid: string, @Query('category') category?: string) {
    return category ? this.vendors.byCategory(uid, category) : this.vendors.list(uid);
  }
  @Post('vendors') createVendor(@CurrentUser('id') uid: string, @Body() dto: CreateVendorDto) { return this.vendors.create(uid, dto as any); }
  @Patch('vendors/:id') updateVendor(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateVendorDto) { return this.vendors.update(uid, id, dto as any); }
  @Delete('vendors/:id') removeVendor(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.vendors.remove(uid, id); }

  @Get('work-orders')
  listWorkOrders(@CurrentUser('id') uid: string, @Query('status') status?: string, @Query('propertyId') propertyId?: string, @Query('vendorId') vendorId?: string) {
    return this.workOrders.filtered(uid, { status, propertyId, vendorId });
  }
  @Post('work-orders') createWorkOrder(@CurrentUser('id') uid: string, @Body() dto: CreateWorkOrderDto) { return this.workOrders.create(uid, dto as any); }
  @Patch('work-orders/:id') updateWorkOrder(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateWorkOrderDto) { return this.workOrders.update(uid, id, dto as any); }
  @Delete('work-orders/:id') removeWorkOrder(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.workOrders.remove(uid, id); }

  @Get('applications')
  listApplications(@CurrentUser('id') uid: string, @Query('status') status?: string) { return this.applications.byStatus(uid, status); }
  @Post('applications') createApplication(@CurrentUser('id') uid: string, @Body() dto: CreateApplicationDto) { return this.applications.create(uid, dto as any); }
  @Patch('applications/:id') updateApplication(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateApplicationDto) { return this.applications.update(uid, id, dto as any); }
  @Delete('applications/:id') removeApplication(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.applications.remove(uid, id); }

  @Post('applications/:id/approve')
  async approveApplication(@CurrentUser('id') uid: string, @Param('id') id: string) {
    const app = await this.applications.get(uid, id);
    const unit = app.unitId ? await this.units.get(uid, app.unitId) : null;
    const tenant = await this.tenants.create(uid, {
      unitId: app.unitId ?? null,
      name: `${app.firstName} ${app.lastName ?? ''}`.trim(),
      firstName: app.firstName,
      lastName: app.lastName,
      phone: app.phone,
      email: app.email,
      employer: app.employer,
      monthlyIncome: app.monthlyIncome,
      shortCode: `KBE${Date.now().toString().slice(-6)}`,
      paymentCode: `PAY${Date.now().toString().slice(-8)}`,
      leaseStart: app.desiredMoveIn ?? null,
      status: 'active',
      notes: app.notes,
    } as any);
    if (unit) await this.units.update(uid, unit.id, { status: 'occupied' });
    const lease = unit ? await this.leases.create(uid, {
      unitId: unit.id,
      tenantId: tenant.id,
      startDate: app.desiredMoveIn ?? new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      monthlyRent: unit.rentAmount,
      deposit: unit.rentAmount,
      rentDueDay: 1,
      lateFee: 0,
      status: 'active',
      notes: 'Generated from approved application',
    } as any) : null;
    const updatedApplication = await this.applications.update(uid, id, { status: 'approved' } as any);
    return { application: updatedApplication, tenant, lease };
  }

  @Get('settings') getSettings(@CurrentUser('id') uid: string) { return this.settings.get(uid); }
  @Patch('settings') updateSettings(@CurrentUser('id') uid: string, @Body() dto: UpdateSettingsDto) { return this.settings.update(uid, dto); }

  @Get('expenses')
  listExpenses(@CurrentUser('id') uid: string, @Query('propertyId') propertyId?: string) {
    return propertyId ? this.expenses.byProperty(uid, propertyId) : this.expenses.list(uid);
  }
  @Post('expenses') createExpense(@CurrentUser('id') uid: string, @Body() dto: CreateExpenseDto) { return this.expenses.create(uid, dto as any); }
  @Patch('expenses/:id') updateExpense(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateExpenseDto) { return this.expenses.update(uid, id, dto as any); }
  @Delete('expenses/:id') removeExpense(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.expenses.remove(uid, id); }

  @Get('rent-increase-simulations') listSimulations(@CurrentUser('id') uid: string) { return this.simulations.list(uid); }
  @Post('rent-increase-simulations') simulateRentIncrease(@CurrentUser('id') uid: string, @Body() dto: CreateRentIncreaseSimulationDto) { return this.simulations.simulate(uid, dto); }

  @Get('tenant-portal/:tenantId')
  async tenantPortal(@CurrentUser('id') uid: string, @Param('tenantId') tenantId: string) {
    const tenant = await this.tenants.get(uid, tenantId);
    const leases = await this.leases.byTenant(uid, tenantId);
    const charges = await this.charges.list(uid, { where: { tenantId } as any });
    return {
      tenant,
      leases,
      charges,
      totalDue: charges.reduce((sum, charge) => sum + Math.max(0, Number(charge.amount) - Number(charge.amountPaid)), 0),
    };
  }
}
