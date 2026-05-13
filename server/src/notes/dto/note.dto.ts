import { IsArray, IsBoolean, IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNoteDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsBoolean() pinned?: boolean;
  @IsOptional() @IsHexColor() color?: string;
}

export class UpdateNoteDto extends CreateNoteDto {}
