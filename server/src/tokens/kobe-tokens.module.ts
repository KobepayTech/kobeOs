import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KobeToken } from './kobe-token.entity';
import { KobeTokensService } from './kobe-tokens.service';
import { KobeTokensController, KobeTokensLedgerController } from './kobe-tokens.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([KobeToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({ secret: c.getOrThrow<string>('JWT_SECRET') }),
    }),
  ],
  providers: [KobeTokensService],
  controllers: [KobeTokensController, KobeTokensLedgerController],
  exports: [KobeTokensService],
})
export class KobeTokensModule {}
