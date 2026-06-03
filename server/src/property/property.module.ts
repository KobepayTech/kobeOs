import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Property,
  PropertyApplication,
  PropertyExpense,
  PropertyLease,
  PropertySetting,
  PropertyUnit,
  PropertyVendor,
  PropertyWorkOrder,
  RentCharge,
  RentIncreaseSimulation,
  RentPayment,
  Tenant,
} from './property.entity';
import { PropertiesService, RentPaymentsService, TenantsService, UnitsService } from './property.service';
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
import { PropertyController } from './property.controller';
import { PropertyExtraController } from './property-extra.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Property,
      PropertyUnit,
      Tenant,
      PropertyLease,
      RentCharge,
      RentPayment,
      PropertyVendor,
      PropertyWorkOrder,
      PropertyApplication,
      PropertySetting,
      PropertyExpense,
      RentIncreaseSimulation,
    ]),
  ],
  providers: [
    PropertiesService,
    UnitsService,
    TenantsService,
    RentPaymentsService,
    LeasesService,
    RentChargesService,
    VendorsService,
    WorkOrdersService,
    ApplicationsService,
    PropertySettingsService,
    ExpensesService,
    RentIncreaseSimulationsService,
    PropertyDashboardService,
  ],
  controllers: [PropertyController, PropertyExtraController],
})
export class PropertyModule {}
