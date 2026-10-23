import { Body, Controller, Delete, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../common/public.decorator';
import { PROPERTY_ACTIONS, PropertyIntelligenceService } from './property-intelligence.service';
class ActionDto {
  @IsIn(PROPERTY_ACTIONS) kind!: string;
  @IsObject() payload!: Record<string, unknown>;
  @IsUUID() requestKey!: string;
  @IsBoolean() approved!: boolean;
}
class ScopeDto { @IsOptional() @IsUUID() propertyId?: string; @IsOptional() @IsString() @MaxLength(7) period?: string; }
class QueryDto extends ScopeDto { @IsString() @MinLength(1) @MaxLength(2000) question!: string; }
class DocumentDto { @IsUUID() documentId!: string; @IsString() @MinLength(20) @MaxLength(50000) text!: string; }
class PeriodDto { @IsString() @MaxLength(7) period!: string; }
class ApprovedDto { @IsBoolean() approved!: boolean; }
class TenantRequestDto { @IsString() @MinLength(1) @MaxLength(150) title!: string; @IsString() @MinLength(1) @MaxLength(2000) description!: string; @IsUUID() requestKey!: string; }
class EnquiryDto { @IsString() @MinLength(1) @MaxLength(100) name!: string; @IsString() @MinLength(6) @MaxLength(30) phone!: string; }
@UseGuards(JwtAuthGuard)
@Controller('property/intelligence')
export class PropertyIntelligenceController {
  constructor(private readonly svc: PropertyIntelligenceService) {}
  @Get('overview') overview(@CurrentUser('id') uid: string, @Query() scope: ScopeDto) { return this.svc.overview(uid, scope.propertyId, scope.period); }
  @Post('actions') execute(@CurrentUser('id') uid: string, @Body() dto: ActionDto) { return this.svc.execute(uid, dto.kind, dto.payload, dto.requestKey, dto.approved); }
  @Post('invoices') invoices(@CurrentUser('id') uid: string, @Body() dto: PeriodDto) { return this.svc.generate(uid, dto.period); }
  @Post('query') query(@CurrentUser('id') uid: string, @Body() dto: QueryDto) { return this.svc.query(uid, dto.question, dto.propertyId, dto.period); }
  @Post('reports') report(@CurrentUser('id') uid: string, @Body() dto: ScopeDto) { return this.svc.report(uid, dto.propertyId, dto.period); }
  @Post('documents/analyze') analyze(@CurrentUser('id') uid: string, @Body() dto: DocumentDto) { return this.svc.analyzeDocument(uid, dto.documentId, dto.text); }
  @Post('reminders') reminders(@CurrentUser('id') uid: string, @Body() dto: ApprovedDto) { return this.svc.reminders(uid, dto.approved); }
  @Post('tenants/:id/access') invite(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.invite(uid, id); }
  @Delete('tenants/:id/access') revoke(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.revoke(uid, id); }
}
@Public()
@Controller('property-self-service')
export class PropertySelfServiceController {
  constructor(private readonly svc: PropertyIntelligenceService) {}
  @Get('portal') portal(@Headers('x-property-access') token: string) { return this.svc.portal(token); }
  @Post('maintenance') @Throttle({ default: { limit: 10, ttl: 60000 } })
  request(@Headers('x-property-access') token: string, @Body() dto: TenantRequestDto) { return this.svc.tenantRequest(token, dto.title, dto.description, dto.requestKey); }
  @Get('vacancies') vacancies(@Query('q') q?: string) { return this.svc.vacancies(q); }
  @Post('vacancies/:id/enquire') @Throttle({ default: { limit: 5, ttl: 60000 } })
  enquire(@Param('id') id: string, @Body() dto: EnquiryDto) { return this.svc.applyForVacancy(id, dto.name, dto.phone); }
}
