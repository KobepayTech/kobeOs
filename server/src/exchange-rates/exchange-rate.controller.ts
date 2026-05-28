import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ExchangeRateService } from './exchange-rate.service';

class CreateExchangeRateDto {
  @IsString() txnReference!: string;
  @IsDateString() txnDate!: string;
  @IsEnum(['CNY','TZS','INR','KES','USD','EUR','GBP']) currency!: string;
  @IsNumber() @Min(0.01) amountUsd!: number;
  @IsNumber() @Min(0.000001) customerRate!: number;
  @IsOptional() @IsString() notes?: string;
}

class FundExchangeRateDto {
  @IsNumber() @Min(0.000001) actualRate!: number;
  @IsDateString() fundedDate!: string;
  @IsOptional() @IsString() notes?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('exchange-rates')
export class ExchangeRateController {
  constructor(private readonly svc: ExchangeRateService) {}

  @Post()
  create(@CurrentUser('id') uid: string, @Body() dto: CreateExchangeRateDto) {
    return this.svc.create(uid, dto);
  }

  @Get()
  list(@CurrentUser('id') uid: string, @Query('currency') currency?: string) {
    return this.svc.list(uid, currency);
  }

  @Get('summary')
  summary(@CurrentUser('id') uid: string, @Query('currency') currency?: string) {
    return this.svc.summary(uid, currency);
  }

  @Patch(':id/fund')
  fund(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: FundExchangeRateDto,
  ) {
    return this.svc.fund(uid, id, dto);
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.cancel(uid, id);
  }
}
