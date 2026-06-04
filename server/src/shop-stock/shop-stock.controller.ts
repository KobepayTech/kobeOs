import {
  Body, Controller, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ShopStockService } from './shop-stock.service';
import {
  AllocationQueryDto,
  CalculateEstimateDto,
  CreateAllocationDto,
  ReconcileDto,
  UpdateAllocationDto,
} from './dto/shop-stock.dto';

@UseGuards(JwtAuthGuard)
@Controller('shop-stock')
export class ShopStockController {
  constructor(private readonly service: ShopStockService) {}

  // ── Allocations ──────────────────────────────────────────────────────────

  @Get('allocations')
  listAllocations(
    @CurrentUser('id') uid: string,
    @Query() query: AllocationQueryDto,
  ) {
    return this.service.listAllocations(uid, query);
  }

  @Post('allocations')
  createAllocation(
    @CurrentUser('id') uid: string,
    @Body() dto: CreateAllocationDto,
  ) {
    return this.service.createAllocation(uid, dto);
  }

  @Get('allocations/:id')
  getAllocation(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
  ) {
    return this.service.getAllocation(uid, id);
  }

  @Patch('allocations/:id')
  updateAllocation(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: UpdateAllocationDto,
  ) {
    return this.service.updateAllocation(uid, id, dto);
  }

  // ── Estimates ────────────────────────────────────────────────────────────

  @Post('allocations/:id/calculate-estimate')
  calculateEstimate(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: CalculateEstimateDto,
  ) {
    return this.service.calculateEstimate(uid, id, dto);
  }

  @Get('allocations/:id/estimate')
  getLatestEstimate(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
  ) {
    return this.service.getLatestEstimate(uid, id);
  }

  @Get('allocations/:id/estimate-history')
  getEstimateHistory(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
  ) {
    return this.service.getEstimateHistory(uid, id);
  }

  // ── Reconciliation ───────────────────────────────────────────────────────

  @Post('allocations/:id/reconcile')
  reconcile(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: ReconcileDto,
  ) {
    return this.service.reconcile(uid, id, dto);
  }

  @Get('allocations/:id/reconciliations')
  getReconciliations(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
  ) {
    return this.service.getReconciliations(uid, id);
  }

  // ── Summary ──────────────────────────────────────────────────────────────

  @Get('summary')
  shopSummary(@CurrentUser('id') uid: string) {
    return this.service.shopSummary(uid);
  }
}
