import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { CollectionChannel, CollectionPartnerType } from '../property-payment-order.entity';

const CHANNELS: CollectionChannel[] = ['CASH', 'BANK', 'MOBILE_MONEY', 'CARD'];
const PARTNER_TYPES: CollectionPartnerType[] = ['BANK', 'AGENT'];

export class CreateCollectionPartnerDto {
  @IsString() @MaxLength(120) name!: string;
  @IsEnum(PARTNER_TYPES) type!: CollectionPartnerType;
  @IsString() @MaxLength(30) partnerCode!: string;
  @IsString() @MaxLength(12) pin!: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) commissionPct?: number;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) branch?: string;
}

export class PartnerLoginDto {
  @IsString() @MaxLength(30) partnerCode!: string;
  @IsString() @MaxLength(12) pin!: string;
}

export class CreatePropertyPaymentOrderDto {
  @IsUUID() tenantId!: string;
  @IsUUID() unitId!: string;
  @IsOptional() @IsUUID() chargeId?: string;
  @IsOptional() @IsString() @MaxLength(100) invoiceReference?: string;
  @IsNumber() @Min(0.01) expectedAmount!: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsNumber() @Min(0) allowedVariance?: number;
  @IsOptional() @IsBoolean() partialAllowed?: boolean;
  @IsArray() @ArrayNotEmpty() @IsEnum(CHANNELS, { each: true })
  allowedChannels!: CollectionChannel[];
  @IsOptional() @IsUUID() assignedPartnerId?: string;
  @IsDateString() expiresAt!: string;
}

export class RedeemPropertyPaymentOrderDto {
  @IsNumber() @Min(0.01) amountReceived!: number;
  @IsEnum(CHANNELS) channel!: CollectionChannel;
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @IsString() @MaxLength(120) idempotencyKey!: string;
}

export class CancelPropertyPaymentOrderDto {
  @IsString() @MaxLength(500) reason!: string;
}
