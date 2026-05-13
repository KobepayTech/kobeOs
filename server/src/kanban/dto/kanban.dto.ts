import { IsArray, IsDateString, IsHexColor, IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBoardDto { @IsString() @MaxLength(120) name!: string; }
export class UpdateBoardDto { @IsOptional() @IsString() @MaxLength(120) name?: string; }

export class CreateColumnDto {
  @IsUUID() boardId!: string;
  @IsString() @MaxLength(120) title!: string;
  @IsOptional() @IsInt() position?: number;
  @IsOptional() @IsHexColor() color?: string;
}
export class UpdateColumnDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsInt() position?: number;
  @IsOptional() @IsHexColor() color?: string;
}

export class CreateCardDto {
  @IsUUID() columnId!: string;
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() position?: number;
  @IsOptional() @IsArray() labels?: string[];
  @IsOptional() @IsDateString() dueAt?: string;
}
export class UpdateCardDto {
  @IsOptional() @IsUUID() columnId?: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() position?: number;
  @IsOptional() @IsArray() labels?: string[];
  @IsOptional() @IsDateString() dueAt?: string;
}
