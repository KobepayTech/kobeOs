import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PropertiesService, RentPaymentsService, TenantsService, UnitsService } from './property.service';
import {
  CreatePaymentDto, CreatePropertyDto, CreateTenantDto, CreateUnitDto,
  UpdatePropertyDto, UpdateTenantDto, UpdateUnitDto,
} from './dto/property.dto';

@UseGuards(JwtAuthGuard)
@Controller('property')
export class PropertyController {
  constructor(
    private readonly props: PropertiesService,
    private readonly units: UnitsService,
    private readonly tenants: TenantsService,
    private readonly payments: RentPaymentsService,
  ) {}

  @Get('properties') listProps(@CurrentUser('id') uid: string) { return this.props.list(uid); }
  @Post('properties') createProp(@CurrentUser('id') uid: string, @Body() dto: CreatePropertyDto) { return this.props.create(uid, dto); }
  @Patch('properties/:id') updateProp(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdatePropertyDto) { return this.props.update(uid, id, dto); }
  @Delete('properties/:id') removeProp(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.props.remove(uid, id); }

  @Get('units') listUnits(@CurrentUser('id') uid: string, @Query('propertyId') pid?: string) {
    return pid ? this.units.byProperty(uid, pid) : this.units.list(uid);
  }
  @Post('units') createUnit(@CurrentUser('id') uid: string, @Body() dto: CreateUnitDto) { return this.units.create(uid, dto); }
  @Patch('units/:id') updateUnit(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateUnitDto) { return this.units.update(uid, id, dto); }
  @Delete('units/:id') removeUnit(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.units.remove(uid, id); }

  @Get('tenants') listTenants(@CurrentUser('id') uid: string) { return this.tenants.list(uid); }
  @Post('tenants') createTenant(@CurrentUser('id') uid: string, @Body() dto: CreateTenantDto) { return this.tenants.create(uid, dto); }
  @Patch('tenants/:id') updateTenant(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateTenantDto) { return this.tenants.update(uid, id, dto); }
  @Delete('tenants/:id') removeTenant(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.tenants.remove(uid, id); }

  @Get('payments') listPayments(@CurrentUser('id') uid: string, @Query('tenantId') tid?: string) {
    return tid ? this.payments.byTenant(uid, tid) : this.payments.list(uid);
  }
  @Post('payments') createPayment(@CurrentUser('id') uid: string, @Body() dto: CreatePaymentDto) { return this.payments.create(uid, dto); }
  @Delete('payments/:id') removePayment(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.payments.remove(uid, id); }
}
