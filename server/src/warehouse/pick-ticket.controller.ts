import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PickTicketService } from './pick-ticket.service';
import { UpdatePickTicketStatusDto } from './dto/pick-ticket.dto';
import { PickTicketStatus } from './pick-ticket.entity';

@UseGuards(JwtAuthGuard)
@Controller('warehouse/pick-tickets')
export class PickTicketController {
  constructor(private readonly svc: PickTicketService) {}

  @Get()
  list(@CurrentUser('id') uid: string, @Query('status') status?: PickTicketStatus) {
    return this.svc.list(uid, status);
  }

  @Get(':id')
  get(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.get(uid, id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: UpdatePickTicketStatusDto,
  ) {
    return this.svc.updateStatus(uid, id, dto);
  }
}
