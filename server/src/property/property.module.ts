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
  TenantScreeningReport,
} from './property.entity';
import { PropertyPaymentToken } from './posys.entity';
import {
  PropertyCollectionPartner,
  PropertyPaymentOrder,
  PropertyPaymentRedemption,
} from './property-payment-order.entity';
import { PropertyDocument } from './property-document.entity';
import { PosysService } from './posys.service';
import { PropertyPaymentOrderService } from './property-payment-order.service';
import { PosysController, PosysTokensController } from './posys.controller';
import {
  PropertyCollectionPortalController,
  PropertyPaymentOrderController,
} from './property-payment-order.controller';
import { PropertiesService, RentPaymentsService, TenantsService, UnitsService, PropertyDocumentsService } from './property.service';
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
      TenantScreeningReport,
      PropertyPaymentToken,
      PropertyCollectionPartner,
      PropertyPaymentOrder,
      PropertyPaymentRedemption,
      PropertyDocument,
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
    TenantScreeningService,
    PosysService,
    PropertyPaymentOrderService,
    PropertyDocumentsService,
  ],
  controllers: [
    PropertyController,
    PropertyExtraController,
    PosysController,
    PosysTokensController,
    PropertyPaymentOrderController,
    PropertyCollectionPortalController,
  ],
  exports: [RentChargesService, PropertyPaymentOrderService],
})
export class PropertyModule {}
