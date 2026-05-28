import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateStudioMediaProjectDto {
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(80) section?: 'media-studios' | 'creator-marketplace' | 'brand-studio' | 'football-analytics';
  @IsOptional() @IsString() @MaxLength(80) format?: 'short-video' | 'ad-video' | 'creator-package' | 'product-video' | 'match-analysis';
  @IsOptional() @IsString() @MaxLength(40) language?: string;
  @IsOptional() @IsString() @MaxLength(40) status?: 'draft' | 'generating' | 'ready' | 'published' | 'failed';
  @IsOptional() @IsString() @MaxLength(80) engine?: string;
  @IsOptional() @IsString() prompt?: string;
  @IsOptional() @IsString() outputUrl?: string;
  @IsOptional() @IsUUID() companyId?: string;
}
export class UpdateStudioMediaProjectDto extends CreateStudioMediaProjectDto {}

export class CreateStudioMediaJobDto {
  @IsUUID() projectId!: string;
  @IsOptional() @IsString() @MaxLength(40) status?: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  @IsOptional() @IsString() @MaxLength(80) engine?: string;
  @IsOptional() @IsObject() request?: Record<string, unknown>;
  @IsOptional() @IsObject() result?: Record<string, unknown>;
  @IsOptional() @IsString() outputUrl?: string;
  @IsOptional() @IsString() errorMessage?: string;
}
export class UpdateStudioMediaJobDto extends CreateStudioMediaJobDto {}
