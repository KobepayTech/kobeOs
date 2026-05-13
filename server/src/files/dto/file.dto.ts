import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNodeDto {
  @IsString() @MaxLength(1024) path!: string;
  @IsEnum(['file', 'directory']) type!: 'file' | 'directory';
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsString() content?: string;
  /** base64-encoded binary content for non-text files */
  @IsOptional() @IsString() contentBase64?: string;
}

export class UpdateNodeDto {
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() contentBase64?: string;
  @IsOptional() @IsString() mimeType?: string;
}

export class MoveNodeDto {
  @IsString() @MaxLength(1024) toPath!: string;
}
