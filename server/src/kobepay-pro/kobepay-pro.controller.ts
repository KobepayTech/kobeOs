import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SchoolService } from './school.service';
import { WalletService } from './wallet.service';
import { PaymentService } from './payment.service';
import { DepositEngineService } from './deposit-engine.service';
import { LedgerService } from './ledger.service';
import type { SpendCategory } from './kobepay-pro.entity';

const CATEGORIES = ['AVAILABLE', 'FOOD', 'TRANSPORT', 'BOOKS', 'SUPPLIES', 'ONLINE', 'GROUP', 'SAVINGS'];

class CreateSchoolDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(24) code?: string;
  @IsOptional() @IsIn(['KOBEPAY', 'SCHOOL']) bankModel?: string;
  @IsOptional() @IsString() @MaxLength(120) bankAccountRef?: string;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
}
class CreateStudentDto {
  @IsString() schoolId!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(32) studentCode?: string;
  @IsOptional() @IsString() @MaxLength(40) className?: string;
  @IsOptional() @IsString() @MaxLength(64) nfcCardId?: string;
  @IsOptional() @IsString() @MaxLength(120) parentName?: string;
  @IsOptional() @IsString() @MaxLength(40) parentPhone?: string;
}
class ControlsDto { @IsObject() controls!: Record<string, unknown>; }
class CreateMerchantDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(32) merchantCode?: string;
  @IsOptional() @IsIn(CATEGORIES) category?: string;
  @IsOptional() @IsString() @MaxLength(120) settlementAccount?: string;
  @IsOptional() @IsString() @MaxLength(24) settlementMethod?: string;
  @IsOptional() @IsNumber() @Min(0) commissionPct?: number;
  @IsOptional() @IsBoolean() online?: boolean;
}
class ApproveDto { @IsBoolean() allowed!: boolean; }
class DepositDto {
  @IsNumber() @Min(1) amount!: number;
  @IsOptional() @IsString() @MaxLength(64) bankTransactionId?: string;
  @IsOptional() @IsString() @MaxLength(120) description?: string;
}
class AllocateDto {
  @IsIn(CATEGORIES) from!: string;
  @IsIn(CATEGORIES) to!: string;
  @IsNumber() @Min(1) amount!: number;
}
class ReserveDto {
  @IsNumber() @Min(1) amount!: number;
  @IsString() @MaxLength(120) purpose!: string;
  @IsOptional() @IsString() groupId?: string;
}
class PayDto {
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() nfcCardId?: string;
  @IsOptional() @IsString() qrToken?: string;
  @IsOptional() @IsString() studentCode?: string;
  @IsString() merchantId!: string;
  @IsNumber() @Min(1) amount!: number;
  @IsOptional() @IsString() @MaxLength(64) device?: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
}
class MatchDepositDto { @IsString() studentId!: string; }

@UseGuards(JwtAuthGuard)
@Controller('kobepay-pro')
export class KobepayProController {
  constructor(
    private readonly schoolSvc: SchoolService,
    private readonly wallets: WalletService,
    private readonly payments: PaymentService,
    private readonly deposits: DepositEngineService,
    private readonly ledger: LedgerService,
  ) {}

  // Schools
  @Get('schools') listSchools(@CurrentUser('id') uid: string) { return this.schoolSvc.listSchools(uid); }
  @Post('schools') createSchool(@CurrentUser('id') uid: string, @Body() dto: CreateSchoolDto) { return this.schoolSvc.createSchool(uid, dto); }
  @Get('schools/:id') getSchool(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.schoolSvc.getSchool(uid, id); }
  @Get('schools/:id/dashboard') dashboard(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.schoolSvc.schoolDashboard(uid, id); }
  @Get('schools/:id/merchants') schoolMerchants(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.schoolSvc.schoolMerchants(uid, id); }
  @Post('schools/:id/merchants/:merchantId/approve')
  approve(@CurrentUser('id') uid: string, @Param('id') id: string, @Param('merchantId') mId: string, @Body() dto: ApproveDto) {
    return this.schoolSvc.approveMerchant(uid, id, mId, dto.allowed);
  }

  // Students
  @Get('students') listStudents(@CurrentUser('id') uid: string, @Query('schoolId') schoolId?: string) { return this.schoolSvc.listStudents(uid, schoolId); }
  @Post('students') createStudent(@CurrentUser('id') uid: string, @Body() dto: CreateStudentDto) { return this.schoolSvc.createStudent(uid, dto); }
  @Get('students/:id') getStudent(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.schoolSvc.getStudent(uid, id); }
  @Patch('students/:id/controls') setControls(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: ControlsDto) { return this.schoolSvc.setControls(uid, id, dto.controls); }
  @Get('students/:id/wallet') wallet(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.wallets.view(uid, id); }
  @Get('students/:id/history') history(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.schoolSvc.studentHistory(uid, id); }
  @Post('students/:id/deposit')
  deposit(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: DepositDto) {
    return this.wallets.applyDeposit(uid, id, dto.amount, { bankTransactionId: dto.bankTransactionId, description: dto.description, source: 'MANUAL' });
  }
  @Post('students/:id/allocate')
  allocate(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: AllocateDto) {
    return this.wallets.allocate(uid, id, dto.from as SpendCategory, dto.to as SpendCategory, dto.amount);
  }
  @Post('students/:id/reserve')
  reserve(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: ReserveDto) {
    return this.wallets.reserve(uid, id, dto.amount, dto.purpose, dto.groupId);
  }
  @Post('holds/:holdId/release')
  release(@CurrentUser('id') uid: string, @Param('holdId') holdId: string) { return this.wallets.release(uid, holdId); }

  // Merchants
  @Get('merchants') listMerchants(@CurrentUser('id') uid: string) { return this.schoolSvc.listMerchants(uid); }
  @Post('merchants') createMerchant(@CurrentUser('id') uid: string, @Body() dto: CreateMerchantDto) { return this.schoolSvc.createMerchant(uid, dto); }
  @Post('merchants/:id/settle') settle(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.schoolSvc.settleMerchant(uid, id); }

  // Payments
  @Post('pay') pay(@CurrentUser('id') uid: string, @Body() dto: PayDto) { return this.payments.pay(uid, dto); }

  // Deposits / reconciliation
  @Get('deposits/unmatched') unmatched(@CurrentUser('id') uid: string) { return this.deposits.listUnmatched(uid); }
  @Post('deposits/:id/match') matchDeposit(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: MatchDepositDto) { return this.deposits.matchToStudent(uid, id, dto.studentId); }
  @Get('reconcile') reconcile(@CurrentUser('id') uid: string) { return this.ledger.reconcile(uid); }
}
