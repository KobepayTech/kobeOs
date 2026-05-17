import { IsEnum, IsString, Matches } from 'class-validator';
import type { OsLicensePlan } from '../os-license.entity';

export class InitiateLicenseDto {
  @IsEnum(['trial', 'pro'])
  plan!: OsLicensePlan;

  /** Tanzanian mobile number, e.g. 0712345678 or 255712345678 */
  @IsString()
  @Matches(/^(0|255)\d{9}$/, { message: 'msisdn must be a valid Tanzanian mobile number' })
  msisdn!: string;
}
