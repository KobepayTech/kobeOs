import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AppIdDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,79}$/)
  appId!: string;
}

export class PalmPesaAppPaymentDto {
  @IsString()
  @MinLength(9)
  @MaxLength(20)
  msisdn!: string;
}

export class CapturePayPalDto {
  @IsString()
  @MinLength(6)
  @MaxLength(80)
  orderId!: string;
}
