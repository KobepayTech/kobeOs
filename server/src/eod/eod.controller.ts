import { Body, Controller, Delete, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EodService } from './eod.service';
import type { ExpenseCategory, ShopExpense } from './eod.entity';

// Fields need class-validator decorators or the global whitelist:true
// ValidationPipe strips them (breaking expense creation / day close).
class CreateExpenseDto {
  @IsOptional() @IsString() shopId?: string;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() category?: ExpenseCategory;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() receiptUrl?: string | null;
  @IsOptional() @IsString() paidVia?: ShopExpense['paidVia'];
}

class CloseDayDto {
  @IsOptional() @IsString() shopId?: string;
  @IsOptional() @IsString() tradingDate?: string;
  @IsNumber() @Min(0) countedCash!: number;
  @IsOptional() @IsString() notes?: string;
}

/**
 * End-of-day cashier endpoints. Every shop-scoped action accepts the
 * X-Active-Shop-Id header (forwarded by the frontend's api.ts) so the
 * cashier doesn't have to repeat the shopId in every payload.
 */
@UseGuards(JwtAuthGuard)
@Controller('eod')
export class EodController {
  constructor(private readonly svc: EodService) {}

  // ── Expenses ──────────────────────────────────────────────────────────

  @Get('expenses')
  listExpenses(
    @CurrentUser('id') uid: string,
    @Headers('x-active-shop-id') headerShop?: string,
    @Query('shopId') queryShop?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.listExpenses(uid, queryShop ?? headerShop ?? '', from, to);
  }

  @Get('expenses/categories')
  listCategories() {
    return this.svc.listCategories();
  }

  @Post('expenses')
  createExpense(
    @CurrentUser('id') uid: string,
    @Body() dto: CreateExpenseDto,
    @Headers('x-active-shop-id') headerShop?: string,
  ) {
    return this.svc.createExpense(
      uid,
      { ...dto, shopId: dto.shopId ?? headerShop ?? '' },
      uid,
    );
  }

  @Delete('expenses/:id')
  removeExpense(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.removeExpense(uid, id);
  }

  // ── Day summary + close ───────────────────────────────────────────────

  @Get('day-summary')
  daySummary(
    @CurrentUser('id') uid: string,
    @Headers('x-active-shop-id') headerShop?: string,
    @Query('shopId') queryShop?: string,
    @Query('date') tradingDate?: string,
  ) {
    return this.svc.daySummary(uid, queryShop ?? headerShop ?? '', tradingDate);
  }

  @Post('close-day')
  closeDay(
    @CurrentUser('id') uid: string,
    @Body() dto: CloseDayDto,
    @Headers('x-active-shop-id') headerShop?: string,
  ) {
    return this.svc.closeDay(
      uid,
      { ...dto, shopId: dto.shopId ?? headerShop ?? '' },
      uid,
    );
  }

  @Get('cash-counts')
  listCashCounts(
    @CurrentUser('id') uid: string,
    @Headers('x-active-shop-id') headerShop?: string,
    @Query('shopId') queryShop?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.listCashCounts(uid, queryShop ?? headerShop ?? '', from, to);
  }
}
