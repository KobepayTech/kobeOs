import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { ErpAccount, ErpTransaction } from '../erp/erp.entity';
import { ErpModule } from '../erp/erp.module';
import { MobileMoneyModule } from '../mobile-money/mobile-money.module';
import { PlatformModule } from '../platform/platform.module';
import { ACCOUNTANT_ENTITIES } from './accountant.entity';
import { AccountantController, AccountantPublicController } from './accountant.controller';
import { AccountantService } from './accountant.service';
import { AccountingCallProvider } from './call-provider.service';

@Module({
  imports: [TypeOrmModule.forFeature([...ACCOUNTANT_ENTITIES, User, ErpAccount, ErpTransaction]), ErpModule, MobileMoneyModule, PlatformModule],
  controllers: [AccountantController, AccountantPublicController], providers: [AccountantService, AccountingCallProvider], exports: [AccountantService],
})
export class AccountantModule {}
