import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';

class AuthDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly svc: AuthService) {}

  @Post('register')
  register(@Body() dto: AuthDto) {
    return this.svc.register(dto.email, dto.password);
  }

  @Post('login')
  login(@Body() dto: AuthDto) {
    return this.svc.login(dto.email, dto.password);
  }
}
