import {
  Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DiscountApprovalService } from './discount-approval.service';
import {
  ApproveDiscountRequestDto,
  CompleteDiscountSaleDto,
  CounterDiscountRequestDto,
  CreateApprovalRuleDto,
  CreateDiscountRequestDto,
  ListRequestsQueryDto,
  RejectDiscountRequestDto,
  UpdateApprovalRuleDto,
} from './dto/discount-approval.dto';

@UseGuards(JwtAuthGuard)
@Controller('discounts')
export class DiscountApprovalController {
  constructor(private readonly svc: DiscountApprovalService) {}

  // ── Seller endpoints ───────────────────────────────────────────────────────

  /**
   * Seller submits a discount request.
   * POST /api/discounts/requests
   */
  @Post('requests')
  createRequest(
    @CurrentUser('id') uid: string,
    @Body() dto: CreateDiscountRequestDto,
  ) {
    // ownerId = the business owner (tenant). For multi-staff setups the
    // frontend must pass the owner's ID. For single-owner setups uid = ownerId.
    // We use uid as both ownerId and sellerId here; adjust when RBAC is wired.
    return this.svc.createRequest(uid, uid, dto);
  }

  /**
   * Seller accepts a counter offer.
   * POST /api/discounts/requests/:id/accept-counter
   */
  @Post('requests/:id/accept-counter')
  acceptCounter(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.acceptCounter(uid, uid, id);
  }

  /**
   * Seller rejects a counter offer.
   * POST /api/discounts/requests/:id/reject-counter
   */
  @Post('requests/:id/reject-counter')
  rejectCounter(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.rejectCounter(uid, uid, id);
  }

  /**
   * Seller completes an approved sale (selects payment method).
   * POST /api/discounts/requests/:id/complete
   */
  @Post('requests/:id/complete')
  completeSale(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: CompleteDiscountSaleDto,
  ) {
    return this.svc.completeSale(uid, uid, id, dto);
  }

  // ── Owner endpoints ────────────────────────────────────────────────────────

  /**
   * Owner approves a discount request.
   * POST /api/discounts/requests/:id/approve
   */
  @Post('requests/:id/approve')
  approveRequest(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: ApproveDiscountRequestDto,
  ) {
    return this.svc.approveRequest(uid, uid, id, dto);
  }

  /**
   * Owner sends a counter offer.
   * POST /api/discounts/requests/:id/counter
   */
  @Post('requests/:id/counter')
  counterRequest(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: CounterDiscountRequestDto,
  ) {
    return this.svc.counterRequest(uid, uid, id, dto);
  }

  /**
   * Owner rejects a discount request.
   * POST /api/discounts/requests/:id/reject
   */
  @Post('requests/:id/reject')
  rejectRequest(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: RejectDiscountRequestDto,
  ) {
    return this.svc.rejectRequest(uid, uid, id, dto);
  }

  /**
   * Owner views all pending/countered requests.
   * GET /api/discounts/requests/pending
   */
  @Get('requests/pending')
  listPending(@CurrentUser('id') uid: string) {
    return this.svc.listPending(uid);
  }

  // ── Shared endpoints ───────────────────────────────────────────────────────

  /**
   * List all requests with optional filters.
   * GET /api/discounts/requests?status=PENDING&sellerId=...
   */
  @Get('requests')
  listRequests(@CurrentUser('id') uid: string, @Query() query: ListRequestsQueryDto) {
    return this.svc.listRequests(uid, query);
  }

  /**
   * Get a single request by ID.
   * GET /api/discounts/requests/:id
   */
  @Get('requests/:id')
  getRequest(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.getRequest$(uid, id);
  }

  /**
   * Discount log — completed discounted sales for reporting.
   * GET /api/discounts/logs
   */
  @Get('logs')
  listLogs(@CurrentUser('id') uid: string) {
    return this.svc.listLogs(uid);
  }

  /**
   * GET /api/discounts/reports?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Aggregated report for the dashboard — totals, by-seller and by-product
   * breakdowns, plus the margin impact (potential profit vs actual profit).
   */
  @Get('reports')
  getReport(
    @CurrentUser('id') uid: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.getReport(uid, from, to);
  }

  // ── Auto-approval rules ────────────────────────────────────────────────────

  @Get('rules')
  listRules(@CurrentUser('id') uid: string) {
    return this.svc.listRules(uid);
  }

  @Post('rules')
  createRule(@CurrentUser('id') uid: string, @Body() dto: CreateApprovalRuleDto) {
    return this.svc.createRule(uid, dto);
  }

  @Put('rules/:id')
  updateRule(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: UpdateApprovalRuleDto,
  ) {
    return this.svc.updateRule(uid, id, dto);
  }

  @Delete('rules/:id')
  deleteRule(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.deleteRule(uid, id);
  }
}
