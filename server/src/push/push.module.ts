import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushSubscription } from './push.entity';
import { PushService } from './push.service';
import { PushController } from './push.controller';
import { BeemService } from '../notifications/beem.service';

@Module({
  imports: [TypeOrmModule.forFeature([PushSubscription])],
  providers: [PushService, BeemService],
  controllers: [PushController],
  exports: [PushService],
})
export class PushModule {}
