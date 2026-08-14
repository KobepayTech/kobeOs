import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { SchoolService } from './school.service';
import { WalletService } from './wallet.service';
import { PaymentService } from './payment.service';
import { DepositEngineService } from './deposit-engine.service';
import { LedgerService } from './ledger.service';
import { GroupsService } from './groups.service';
import { StarterPackService } from './starter-pack.service';
import { PortalService } from './portal.service';
import { ConnectService } from './connect.service';
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
class CreateSupplierDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(32) code?: string;
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(120) contactEmail?: string;
  @IsOptional() @IsString() @MaxLength(120) settlementAccount?: string;
  @IsOptional() @IsString() @MaxLength(24) settlementMethod?: string;
}
class CreateGroupDto {
  @IsString() schoolId!: string;
  @IsString() @MaxLength(120) title!: string;
  @IsOptional() @IsString() @MaxLength(120) productName?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @IsOptional() @IsNumber() @Min(0) normalPrice?: number;
  @IsNumber() @Min(1) groupPrice!: number;
  @IsOptional() @IsNumber() @Min(1) minParticipants?: number;
  @IsOptional() @IsString() deadline?: string;
  @IsOptional() @IsString() @MaxLength(200) deliveryLocation?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsNumber() @Min(0) supplierUnitCost?: number;
}
class JoinGroupDto {
  @IsString() studentId!: string;
  @IsOptional() @IsNumber() @Min(1) qty?: number;
}
class AssignSupplierDto {
  @IsString() supplierId!: string;
  @IsNumber() @Min(0) supplierUnitCost!: number;
}
class ConsolidateDto { @IsOptional() @IsBoolean() force?: boolean; }
class CollectDto {
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() nfcCardId?: string;
  @IsOptional() @IsString() qrToken?: string;
  @IsOptional() @IsString() studentCode?: string;
}
class PackItemDto { @IsString() groupId!: string; @IsOptional() @IsNumber() @Min(1) qty?: number; }
class CreatePackDto {
  @IsString() schoolId!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(60) className?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => PackItemDto) items!: PackItemDto[];
}
class BuyPackDto { @IsString() studentId!: string; }

@UseGuards(JwtAuthGuard)
@Controller('kobepay-pro')
export class KobepayProController {
  constructor(
    private readonly schoolSvc: SchoolService,
    private readonly wallets: WalletService,
    private readonly payments: PaymentService,
    private readonly deposits: DepositEngineService,
    private readonly ledger: LedgerService,
    private readonly groupsSvc: GroupsService,
    private readonly packsSvc: StarterPackService,
    private readonly connect: ConnectService,
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

  // Suppliers
  @Get('suppliers') suppliers(@CurrentUser('id') uid: string) { return this.groupsSvc.listSuppliers(uid); }
  @Post('suppliers') createSupplier(@CurrentUser('id') uid: string, @Body() dto: CreateSupplierDto) { return this.groupsSvc.createSupplier(uid, dto); }
  @Post('suppliers/:id/settle') settleSupplier(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.groupsSvc.settleSupplier(uid, id); }

  // Purchase groups
  @Get('groups') groups(@CurrentUser('id') uid: string, @Query('schoolId') schoolId?: string) { return this.groupsSvc.listGroups(uid, schoolId); }
  @Post('groups') createGroup(@CurrentUser('id') uid: string, @Body() dto: CreateGroupDto) { return this.groupsSvc.createGroup(uid, dto); }
  @Get('groups/:id') group(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.groupsSvc.getGroup(uid, id); }
  @Post('groups/:id/join') join(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: JoinGroupDto) { return this.groupsSvc.joinGroup(uid, id, dto); }
  @Post('group-orders/:orderId/cancel') cancelOrder(@CurrentUser('id') uid: string, @Param('orderId') orderId: string) { return this.groupsSvc.cancelOrder(uid, orderId); }
  @Post('groups/:id/supplier') assignSupplier(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: AssignSupplierDto) { return this.groupsSvc.assignSupplier(uid, id, dto); }
  @Post('groups/:id/consolidate') consolidate(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: ConsolidateDto) { return this.groupsSvc.consolidate(uid, id, !!dto?.force); }
  @Post('groups/:id/verify') verify(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.groupsSvc.verifyDelivery(uid, id); }
  @Post('groups/:id/collect') collect(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: CollectDto) { return this.groupsSvc.collect(uid, id, dto); }
  @Post('groups/:id/complete') complete(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.groupsSvc.completeAndPay(uid, id); }
  @Post('groups/:id/cancel') cancelGroup(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.groupsSvc.cancelGroup(uid, id); }

  // Starter packs
  @Get('packs') packs(@CurrentUser('id') uid: string, @Query('schoolId') schoolId?: string) { return this.packsSvc.listPacks(uid, schoolId); }
  @Post('packs') createPack(@CurrentUser('id') uid: string, @Body() dto: CreatePackDto) { return this.packsSvc.createPack(uid, dto); }
  @Get('packs/:id') pack(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.packsSvc.getPack(uid, id); }
  @Post('packs/:id/buy') buyPack(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: BuyPackDto) { return this.packsSvc.buyPack(uid, id, dto); }

  // Marketplace & Connect
  @Get('marketplace') marketplace(@CurrentUser('id') uid: string, @Query('schoolId') schoolId?: string) { return this.schoolSvc.marketplace(uid, schoolId); }
  @Post('merchants/:id/api-key') issueApiKey(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.connect.issueApiKey(uid, id); }
}

/** Public parent/student portal — accessed by the student's QR token (no login). */
@Public()
@Controller('kobepay-pro/me')
export class StudentPortalController {
  constructor(private readonly portal: PortalService) {}

  @Get(':token') me(@Param('token') token: string) { return this.portal.portal(token); }
  @Post(':token/groups/:groupId/join') join(@Param('token') token: string, @Param('groupId') groupId: string, @Body() dto: { qty?: number }) { return this.portal.join(token, groupId, dto?.qty); }
  @Post(':token/packs/:packId/buy') buyPack(@Param('token') token: string, @Param('packId') packId: string) { return this.portal.buyPack(token, packId); }
}

/** Kobepay Connect — external sellers charge a student by API key (header X-Api-Key). */
@Public()
@Controller('kobepay-pro/connect')
export class ConnectController {
  constructor(private readonly connect: ConnectService) {}

  @Post('charge')
  charge(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { studentCode?: string; nfcCardId?: string; qrToken?: string; amount: number; description?: string; reference?: string },
  ) {
    return this.connect.charge(apiKey, body);
  }
}

/** Public supplier portal — a supplier manages fulfilment with a token, no login. */
@Public()
@Controller('kobepay-pro/supplier')
export class SupplierPortalController {
  constructor(private readonly groupsSvc: GroupsService) {}

  @Get('portal/:token')
  portal(@Param('token') token: string) { return this.groupsSvc.supplierPortal(token); }

  @Post('portal/:token/orders/:groupId/status')
  updateStatus(@Param('token') token: string, @Param('groupId') groupId: string, @Body() dto: { status: string }) {
    return this.groupsSvc.supplierUpdateStatus(token, groupId, dto.status as any);
  }
}
