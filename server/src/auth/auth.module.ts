import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { RefreshToken } from './refresh-token.entity';
import { PasswordReset } from './password-reset.entity';
import { PasswordResetService } from './password-reset.service';
import { UsersModule } from '../users/users.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'change-me'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '15m') },
      }),
    }),
    TypeOrmModule.forFeature([RefreshToken, PasswordReset]),
    UsersModule,
    MailerModule,
  ],
  providers: [AuthService, JwtStrategy, PasswordResetService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
