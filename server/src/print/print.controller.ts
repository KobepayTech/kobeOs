import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  PrintCustomersService, PrintJobsService, PrintMaterialsService, PrintProductsService,
} from './print.service';
import {
  CreatePrintCustomerDto, CreatePrintJobDto, CreatePrintMaterialDto, CreatePrintProductDto,
  UpdatePrintCustomerDto, UpdatePrintJobDto, UpdatePrintMaterialDto, UpdatePrintProductDto,
} from './dto/print.dto';

@UseGuards(JwtAuthGuard)
@Controller('print')
export class PrintController {
  constructor(
    private readonly products: PrintProductsService,
    private readonly jobs: PrintJobsService,
    private readonly materials: PrintMaterialsService,
    private readonly customers: PrintCustomersService,
  ) {}

  @Get('products') listProducts(@CurrentUser('id') uid: string) { return this.products.list(uid); }
  @Post('products') createProduct(@CurrentUser('id') uid: string, @Body() dto: CreatePrintProductDto) { return this.products.create(uid, dto); }
  @Patch('products/:id') updateProduct(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdatePrintProductDto) { return this.products.update(uid, id, dto); }
  @Delete('products/:id') removeProduct(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.products.remove(uid, id); }

  @Get('jobs') listJobs(@CurrentUser('id') uid: string) { return this.jobs.list(uid); }
  @Post('jobs') createJob(@CurrentUser('id') uid: string, @Body() dto: CreatePrintJobDto) { return this.jobs.create(uid, dto); }
  @Patch('jobs/:id') updateJob(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdatePrintJobDto) { return this.jobs.update(uid, id, dto); }
  @Delete('jobs/:id') removeJob(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.jobs.remove(uid, id); }

  @Get('materials') listMaterials(@CurrentUser('id') uid: string) { return this.materials.list(uid); }
  @Post('materials') createMaterial(@CurrentUser('id') uid: string, @Body() dto: CreatePrintMaterialDto) { return this.materials.create(uid, dto); }
  @Patch('materials/:id') updateMaterial(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdatePrintMaterialDto) { return this.materials.update(uid, id, dto); }
  @Delete('materials/:id') removeMaterial(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.materials.remove(uid, id); }

  @Get('customers') listCustomers(@CurrentUser('id') uid: string) { return this.customers.list(uid); }
  @Post('customers') createCustomer(@CurrentUser('id') uid: string, @Body() dto: CreatePrintCustomerDto) { return this.customers.create(uid, dto); }
  @Patch('customers/:id') updateCustomer(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdatePrintCustomerDto) { return this.customers.update(uid, id, dto); }
  @Delete('customers/:id') removeCustomer(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.customers.remove(uid, id); }
}
