import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SubscribeMobileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug!: string;

  /** Payer's phone number for the PalmPesa USSD push (TZ mobile-money). */
  @IsString()
  @Matches(/^[+0-9\s-]{9,15}$/, { message: 'Enter a valid phone number' })
  msisdn!: string;
}

export class SubscribeMobileModuleDto extends SubscribeMobileDto {
  @IsString()
  @IsIn(['dispatch', 'hotel', 'lipa', 'eod', 'summary'])
  moduleId!: string;
}

export class InstallMobileModuleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug!: string;

  @IsString()
  @IsIn(['dispatch', 'hotel', 'lipa', 'eod', 'summary'])
  moduleId!: string;
}
