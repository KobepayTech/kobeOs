import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemController } from './system.controller';
import { ProviderConfig } from './provider-config.entity';
import { ProviderSetupSession } from './provider-setup-session.entity';
import { ProviderConfigService } from './provider-config.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ProviderConfig, ProviderSetupSession]),
  ],
  controllers: [SystemController],
  providers: [ProviderConfigService],
  exports: [ProviderConfigService],
})
export class SystemModule {}
