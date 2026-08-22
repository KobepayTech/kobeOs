import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { getRegistry } from './sports-registry';
import { BoxingService } from './boxing.service';

/**
 * Public sports surface — no auth. Powers the sport registry (what sports the
 * platform supports + their capabilities) and the boxing broadcast overlay
 * (read-only bout state for an OBS Browser Source).
 */
@Public()
@Controller('sports')
export class SportsPublicController {
  constructor(private readonly boxing: BoxingService) {}

  @Get('registry')
  registry() { return getRegistry(); }

  @Get('boxing/public/:id')
  bout(@Param('id') id: string) { return this.boxing.publicBout(id); }
}
