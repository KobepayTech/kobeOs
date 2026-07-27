import { Module } from '@nestjs/common';
import { LanService } from './lan.service';
import { LanController } from './lan.controller';

/** LAN discovery so the web app reaches this server over WiFi with no internet. */
@Module({
  providers: [LanService],
  controllers: [LanController],
  exports: [LanService],
})
export class LanModule {}
