import { IsArray, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateAssetDto {
  @IsEnum(['photo', 'audio', 'video', 'image']) kind!: 'photo' | 'audio' | 'video' | 'image';
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsString() src!: string;
  @IsOptional() @IsInt() @Min(0) duration?: number;
  @IsOptional() @IsInt() @Min(0) size?: number;
  @IsOptional() metadata?: Record<string, unknown>;
}
export class UpdateAssetDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() src?: string;
  @IsOptional() metadata?: Record<string, unknown>;
}

export class CreatePlaylistDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsArray() trackIds?: string[];
}
export class UpdatePlaylistDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsArray() trackIds?: string[];
}
