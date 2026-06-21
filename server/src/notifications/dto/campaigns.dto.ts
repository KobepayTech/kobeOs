import { IsArray, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RecipientDto {
  @IsString() @MaxLength(40) phone!: string;
  @IsOptional() @IsString() @MaxLength(200) customerName?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) variables?: string[];
}

export class CreateCampaignDto {
  @IsEnum(['sms', 'whatsapp']) channel!: 'sms' | 'whatsapp';
  @IsString() @MaxLength(2000) body!: string;
  @IsOptional() @IsString() @MaxLength(120) templateName?: string;
  @IsOptional() @IsString() @MaxLength(16) templateLanguage?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => RecipientDto)
  recipients!: RecipientDto[];
}
