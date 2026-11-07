import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushSubscription } from './push.entity';
import { PushService } from './push.service';
import { PushController } from './push.controller';
import { BeemModule } from '../notifications/beem.module';

@Module({
  imports: [TypeOrmModule.forFeature([PushSubscription]), BeemModule],
  providers: [PushService],
  controllers: [PushController],
  exports: [PushService],
})
export class PushModule {}
