import { IsBoolean, IsDateString, IsEnum, IsHexColor, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTodoListDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsHexColor() color?: string;
}
export class UpdateTodoListDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsHexColor() color?: string;
}

export class CreateTodoItemDto {
  @IsUUID() listId!: string;
  @IsString() @MaxLength(500) text!: string;
  @IsOptional() @IsBoolean() done?: boolean;
  @IsOptional() @IsEnum(['low', 'normal', 'high']) priority?: 'low' | 'normal' | 'high';
  @IsOptional() @IsDateString() dueAt?: string;
}
export class UpdateTodoItemDto {
  @IsOptional() @IsString() @MaxLength(500) text?: string;
  @IsOptional() @IsBoolean() done?: boolean;
  @IsOptional() @IsEnum(['low', 'normal', 'high']) priority?: 'low' | 'normal' | 'high';
  @IsOptional() @IsDateString() dueAt?: string;
}
