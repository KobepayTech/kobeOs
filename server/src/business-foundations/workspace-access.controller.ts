import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WorkspaceAccessService } from './workspace-access.service';

class InviteDto {
  @IsUUID() memberId!: string;
  @IsIn(['ALL_OWNER_ACCOUNT_RECORDS']) scopeConsent!: string;
}
@Controller('brain/workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspaceAccessController {
  constructor(private readonly access: WorkspaceAccessService) {}
  @Get() list(@CurrentUser('id') id: string) { return this.access.list(id); }
  @Post('invite') invite(@CurrentUser('id') id: string, @CurrentUser('role') role: string, @Body() dto: InviteDto) {
    return this.access.invite(id, role, dto.memberId);
  }
  @Post(':id/accept') accept(@CurrentUser('id') actor: string, @CurrentUser('role') role: string, @Param('id', ParseUUIDPipe) id: string) { return this.access.decide(actor, role, id, 'accept'); }
  @Post(':id/revoke') revoke(@CurrentUser('id') actor: string, @CurrentUser('role') role: string, @Param('id', ParseUUIDPipe) id: string) { return this.access.decide(actor, role, id, 'revoke'); }
}
