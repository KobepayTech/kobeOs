import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  /** New clients send one identifier; email is retained for old clients. */
  @IsOptional()
  @IsString()
  identifier?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
