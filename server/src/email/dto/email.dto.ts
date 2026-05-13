import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

const FOLDERS = ['inbox', 'sent', 'drafts', 'archive', 'trash', 'spam'] as const;

export class CreateEmailDto {
  @IsOptional() @IsEnum(FOLDERS) folder?: typeof FOLDERS[number];
  @IsEmail() fromAddress!: string;
  @IsOptional() @IsString() @MaxLength(120) fromName?: string;
  @IsArray() @IsEmail({}, { each: true }) toAddresses!: string[];
  @IsOptional() @IsArray() @IsEmail({}, { each: true }) ccAddresses?: string[];
  @IsOptional() @IsString() @MaxLength(200) subject?: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsBoolean() read?: boolean;
  @IsOptional() @IsBoolean() starred?: boolean;
  @IsOptional() @IsArray() labels?: string[];
}

export class UpdateEmailDto {
  @IsOptional() @IsEnum(FOLDERS) folder?: typeof FOLDERS[number];
  @IsOptional() @IsString() @MaxLength(200) subject?: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsBoolean() read?: boolean;
  @IsOptional() @IsBoolean() starred?: boolean;
  @IsOptional() @IsArray() labels?: string[];
}
