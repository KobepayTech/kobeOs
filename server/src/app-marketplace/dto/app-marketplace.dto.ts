import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsString, Matches, MaxLength, MinLength,
} from 'class-validator';

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

/**
 * A bundle selection. Bounded because a request naming every bundle twice
 * would claim the whole catalogue in one call; fourteen is the entire
 * catalogue, so there is no legitimate reason to send more.
 */
export class InstallBundlesDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(14) @IsString({ each: true })
  bundleIds!: string[];
}
