import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property, PropertyUnit, RentPayment, Tenant } from './property.entity';
import { PropertiesService, RentPaymentsService, TenantsService, UnitsService } from './property.service';
import { PropertyController } from './property.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Property, PropertyUnit, Tenant, RentPayment])],
  providers: [PropertiesService, UnitsService, TenantsService, RentPaymentsService],
  controllers: [PropertyController],
})
export class PropertyModule {}
