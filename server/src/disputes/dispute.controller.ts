import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DisputeService } from './dispute.service';
import { DisputeType } from './dispute.entity';

class OpenDisputeDto {
  @IsUUID() againstUserId!: string;
  @IsOptional() @IsUUID() campaignId?: string;
  @IsOptional() @IsUUID() escrowId?: string;
  @IsOptional() @IsString() txnReference?: string;
  @IsEnum(['kpi_not_met','payment_not_received','content_rejected','fraud','other']) type!: DisputeType;
  @IsString() description!: string;
  @IsOptional() @IsArray() evidence?: string[];
}

class AddMessageDto {
  @IsString() message!: string;
  @IsOptional() @IsArray() attachments?: string[];
}

class ResolveDisputeDto {
  @IsEnum(['resolved_creator','resolved_brand','resolved_split','closed']) status!: 'resolved_creator' | 'resolved_brand' | 'resolved_split' | 'closed';
  @IsString() resolution!: string;
  @IsOptional() @IsNumber() @Min(0) refundAmountTzs?: number;
  @IsOptional() @IsNumber() @Min(0) releaseAmountTzs?: number;
}

@UseGuards(JwtAuthGuard)
@Controller('disputes')
export class DisputeController {
  constructor(private readonly svc: DisputeService) {}

  @Post()
  open(@CurrentUser('id') uid: string, @Body() dto: OpenDisputeDto) {
    return this.svc.open(uid, dto);
  }

  @Get('mine')
  mine(@CurrentUser('id') uid: string) {
    return this.svc.listMine(uid);
  }

  /** Admin: list all disputes, optionally filtered by status */
  @Get()
  listAll(@Query('status') status?: string) {
    return this.svc.listAll(status as any);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.svc.getOne(id);
  }

  @Post(':id/message')
  addMessage(
    @CurrentUser('id') uid: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
    @Body() dto: AddMessageDto,
  ) {
    return this.svc.addMessage(uid, id, role ?? 'User', dto);
  }

  /** Admin: assign dispute to self */
  @Patch(':id/assign')
  assign(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.assign(uid, id);
  }

  /** Admin: resolve dispute */
  @Patch(':id/resolve')
  resolve(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.svc.resolve(uid, id, dto);
  }
}
