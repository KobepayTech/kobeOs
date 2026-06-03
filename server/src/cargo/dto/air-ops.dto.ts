import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCustomsFlowDto {
  @IsOptional() @IsString() shipmentId?: string;
  @IsOptional() @IsString() parcelId?: string;
  @IsString() stage!: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsNumber() taxAmount?: number;
  @IsOptional() @IsString() taxCurrency?: string;
  @IsOptional() @IsNumber() delayHours?: number;
  @IsOptional() @IsString() officerName?: string;
  @IsOptional() @IsString() holdReason?: string;
  @IsOptional() @IsDateString() clearedAt?: string;
}

export class CreateTrackingEventDto {
  @IsOptional() @IsString() shipmentId?: string;
  @IsOptional() @IsString() parcelId?: string;
  @IsString() eventType!: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() flightNumber?: string;
  @IsOptional() @IsDateString() eventAt?: string;
  @IsOptional() @IsString() notes?: string;
}

export class CreateLastMileDto {
  @IsOptional() @IsString() shipmentId?: string;
  @IsOptional() @IsString() parcelId?: string;
  @IsOptional() @IsString() driverId?: string;
  @IsOptional() @IsString() regionalHub?: string;
  @IsString() deliveryAddress!: string;
  @IsOptional() @IsString() customerPhone?: string;
  @IsOptional() @IsString() otpCode?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateDeliveryProofDto {
  @IsOptional() @IsString() otpCode?: string;
  @IsOptional() @IsString() proofPhotoUrl?: string;
  @IsOptional() @IsString() signatureUrl?: string;
  @IsOptional() @IsString() failureReason?: string;
  @IsOptional() @IsString() status?: string;
}
