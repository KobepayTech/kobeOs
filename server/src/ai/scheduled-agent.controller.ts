import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateScheduledAgentDto, TestScheduledAgentDto, UpdateScheduledAgentDto } from './dto/scheduled-agent.dto';
import { ScheduledAgentService } from './scheduled-agent.service';

@UseGuards(JwtAuthGuard)
@Controller('ai/agents')
export class ScheduledAgentController {
  constructor(private readonly service: ScheduledAgentService) {}

  @Get('metadata')
  metadata() { return this.service.metadata(); }

  @Get()
  list(@CurrentUser('id') ownerId: string) { return this.service.list(ownerId); }

  @Get('runs')
  runs(@CurrentUser('id') ownerId: string) { return this.service.listRuns(ownerId); }

  @Get(':id/runs')
  agentRuns(@CurrentUser('id') ownerId: string, @Param('id') id: string) {
    return this.service.listRuns(ownerId, id);
  }

  @Post()
  create(@CurrentUser('id') ownerId: string, @Body() dto: CreateScheduledAgentDto) {
    return this.service.create(ownerId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') ownerId: string,
    @Param('id') id: string,
    @Body() dto: UpdateScheduledAgentDto,
  ) {
    return this.service.update(ownerId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') ownerId: string, @Param('id') id: string) {
    return this.service.remove(ownerId, id);
  }

  @Post(':id/pause')
  pause(@CurrentUser('id') ownerId: string, @Param('id') id: string) {
    return this.service.pause(ownerId, id);
  }

  @Post(':id/resume')
  resume(@CurrentUser('id') ownerId: string, @Param('id') id: string) {
    return this.service.resume(ownerId, id);
  }

  @Post(':id/test')
  test(
    @CurrentUser('id') ownerId: string,
    @Param('id') id: string,
    @Body() dto: TestScheduledAgentDto,
  ) {
    return this.service.test(ownerId, id, Boolean(dto.executeAutomaticAction));
  }

  @Post('runs/:runId/approve')
  approve(@CurrentUser('id') ownerId: string, @Param('runId') runId: string) {
    return this.service.approve(ownerId, runId);
  }

  @Post('runs/:runId/reject')
  reject(@CurrentUser('id') ownerId: string, @Param('runId') runId: string) {
    return this.service.reject(ownerId, runId);
  }
}
