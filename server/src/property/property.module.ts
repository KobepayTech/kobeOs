import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
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
  TenantScreeningReport,
} from './property.entity';
import { PropertyUnitLayout } from './property-layout.entity';
import { PropertyPaymentToken } from './posys.entity';
import { PropertyDocument } from './property-document.entity';
import { PosysService } from './posys.service';
import { PosysController, PosysTokensController } from './posys.controller';
import { PropertiesService, RentPaymentsService, TenantsService, UnitsService, PropertyDocumentsService } from './property.service';
import { PropertyOnboardingService } from './property-onboarding.service';
import {
  ApplicationsService,
  ExpensesService,
  LeasesService,
  PropertyDashboardService,
  PropertySettingsService,
  RentChargesService,
  RentIncreaseSimulationsService,
  TenantScreeningService,
  VendorsService,
  WorkOrdersService,
} from './property-extra.service';
import { PropertyController } from './property.controller';
import { PropertyExtraController } from './property-extra.controller';

@Module({
  imports: [
    AiModule,
    TypeOrmModule.forFeature([
      Property,
      PropertyUnit,
      PropertyUnitLayout,
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
      TenantScreeningReport,
      PropertyPaymentToken,
      PropertyDocument,
    ]),
  ],
  providers: [
    PropertiesService,
    UnitsService,
    PropertyOnboardingService,
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
    TenantScreeningService,
    PosysService,
    PropertyDocumentsService,
  ],
  controllers: [
    PropertyController,
    PropertyExtraController,
    PosysController,
    PosysTokensController,
  ],
  exports: [RentChargesService],
})
export class PropertyModule {}
