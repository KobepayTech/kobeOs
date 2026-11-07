import { Module } from '@nestjs/common';
import { PalmPesaService } from './palmpesa.service';

/**
 * One PalmPesaService for the whole app. It was provided separately by
 * creators, hotel-public and live-sales; importing CreatorsModule into the
 * other two just to share it would drag in the creator cron and its entities,
 * so the shared provider gets a leaf module instead.
 */
@Module({
  providers: [PalmPesaService],
  exports: [PalmPesaService],
})
export class PalmPesaModule {}
