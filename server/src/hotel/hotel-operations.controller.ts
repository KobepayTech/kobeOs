import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { HotelOperationsService } from './hotel-operations.service';
import { CreateAssetDto, CreateHotelRequisitionDto, CreatePayrollDto, CreatePettyCashDto, ReviewHotelRequisitionDto } from './hotel-operations.dto';

@UseGuards(JwtAuthGuard)
@Controller('hotel/operations')
export class HotelOperationsController {
  constructor(private readonly ops: HotelOperationsService) {}

  @Get('requisitions') requisitions(@CurrentUser('id') uid: string) { return this.ops.listRequisitions(uid); }
  @Post('requisitions') createRequisition(@CurrentUser('id') uid: string, @Body() dto: CreateHotelRequisitionDto) { return this.ops.createRequisition(uid, dto); }
  @Patch('requisitions/:id/review') review(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: ReviewHotelRequisitionDto) { return this.ops.reviewRequisition(uid, id, dto); }
  @Post('requisitions/:id/purchase') purchase(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.ops.purchaseRequisition(uid, id); }

  @Get('payroll') payroll(@CurrentUser('id') uid: string) { return this.ops.listPayroll(uid); }
  @Post('payroll') createPayroll(@CurrentUser('id') uid: string, @Body() dto: CreatePayrollDto) { return this.ops.createPayroll(uid, dto); }
  @Post('payroll/:id/pay') payPayroll(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.ops.payPayroll(uid, id); }

  @Get('petty-cash') pettyCash(@CurrentUser('id') uid: string) { return this.ops.listPettyCash(uid); }
  @Post('petty-cash') createPettyCash(@CurrentUser('id') uid: string, @Body() dto: CreatePettyCashDto) { return this.ops.createPettyCash(uid, dto); }

  @Get('assets') assets(@CurrentUser('id') uid: string) { return this.ops.listAssets(uid); }
  @Post('assets') createAsset(@CurrentUser('id') uid: string, @Body() dto: CreateAssetDto) { return this.ops.createAsset(uid, dto); }

  @Get('ledger') ledger(@CurrentUser('id') uid: string) { return this.ops.listLedger(uid); }
  @Get('statements') statements(@CurrentUser('id') uid: string) { return this.ops.statements(uid); }
}
