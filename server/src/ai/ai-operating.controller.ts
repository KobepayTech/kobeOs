import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsIn, IsNumber, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AiOperatingService } from './ai-operating.service';
import type { AiWorkflowStep } from './ai-operating.entity';

class SkillConfigDto {
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}

class MemoryNodeDto {
  @IsString() @MaxLength(60) nodeType!: string;
  @IsString() @MaxLength(160) externalKey!: string;
  @IsString() @MaxLength(220) label!: string;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
  @IsOptional() @IsNumber() confidence?: number;
  @IsOptional() @IsString() source?: string;
}

class MemoryLinkDto {
  @IsString() fromNodeId!: string;
  @IsString() @MaxLength(80) relation!: string;
  @IsString() toNodeId!: string;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
  @IsOptional() @IsNumber() confidence?: number;
}

class CorrectionDto {
  @IsString() @MaxLength(220) subject!: string;
  @IsOptional() @IsString() @MaxLength(1000) previous?: string;
  @IsString() @MaxLength(2000) corrected!: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
}

class WorkflowCreateDto {
  @IsString() @MaxLength(4000) objective!: string;
  @IsOptional() @IsObject() context?: Record<string, unknown>;
}

class WorkflowPatchDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(4000) objective?: string;
  @IsOptional() @IsArray() steps?: AiWorkflowStep[];
  @IsOptional() @IsObject() context?: Record<string, unknown>;
}

class ApprovalCreateDto {
  @IsString() @MaxLength(120) actionType!: string;
  @IsString() @MaxLength(2000) summary!: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
  @IsOptional() @IsArray() chain?: Array<{ role: string; label: string; status?: 'PENDING' | 'APPROVED' | 'REJECTED' }>;
  @IsOptional() @IsString() workflowId?: string;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsString() currency?: string;
}

class ApprovalDecisionDto {
  @IsIn(['approve', 'reject']) decision!: 'approve' | 'reject';
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class DashboardDto {
  @IsString() @MaxLength(1000) prompt!: string;
}

class SimulationDto {
  @IsOptional() @IsNumber() salesChangePct?: number;
  @IsOptional() @IsNumber() expenseChangePct?: number;
  @IsOptional() @IsNumber() rentCollectionChangePct?: number;
  @IsOptional() @IsNumber() roomRateChangePct?: number;
}

class InsightStatusDto {
  @IsIn(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']) status!: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
}

@UseGuards(JwtAuthGuard)
@Controller('ai/operating')
export class AiOperatingController {
  constructor(private readonly operating: AiOperatingService) {}

  @Get('summary')
  summary(@CurrentUser('id') ownerId: string) {
    return this.operating.adminSummary(ownerId);
  }

  @Get('skills')
  skills(@CurrentUser('id') ownerId: string) {
    return this.operating.installedSkills(ownerId);
  }

  @Post('skills/:skillId/install')
  installSkill(
    @CurrentUser('id') ownerId: string,
    @Param('skillId') skillId: string,
    @Body() dto: SkillConfigDto,
  ) {
    return this.operating.installSkill(ownerId, skillId, dto.config || {});
  }

  @Post('skills/:skillId/uninstall')
  uninstallSkill(@CurrentUser('id') ownerId: string, @Param('skillId') skillId: string) {
    return this.operating.uninstallSkill(ownerId, skillId);
  }

  @Get('memory')
  memory(@CurrentUser('id') ownerId: string, @Query('q') q?: string) {
    return this.operating.memoryGraph(ownerId, q);
  }

  @Post('memory/nodes')
  memoryNode(@CurrentUser('id') ownerId: string, @Body() dto: MemoryNodeDto) {
    return this.operating.upsertMemoryNode(ownerId, dto);
  }

  @Post('memory/links')
  memoryLink(@CurrentUser('id') ownerId: string, @Body() dto: MemoryLinkDto) {
    return this.operating.linkMemory(ownerId, dto);
  }

  @Post('memory/corrections')
  correction(@CurrentUser('id') ownerId: string, @Body() dto: CorrectionDto) {
    return this.operating.learnCorrection(ownerId, dto);
  }

  @Get('workflows')
  workflows(@CurrentUser('id') ownerId: string) {
    return this.operating.listWorkflows(ownerId);
  }

  @Post('workflows')
  createWorkflow(@CurrentUser('id') ownerId: string, @Body() dto: WorkflowCreateDto) {
    return this.operating.createWorkflow(ownerId, dto.objective, dto.context || {});
  }

  @Patch('workflows/:id')
  updateWorkflow(@CurrentUser('id') ownerId: string, @Param('id') id: string, @Body() dto: WorkflowPatchDto) {
    return this.operating.updateWorkflow(ownerId, id, dto);
  }

  @Post('workflows/:id/approve')
  approveWorkflow(
    @CurrentUser('id') ownerId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
  ) {
    return this.operating.approveWorkflow(ownerId, id, ownerId, role || 'user');
  }

  @Post('workflows/:id/run')
  runWorkflow(
    @CurrentUser('id') ownerId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
  ) {
    return this.operating.executeWorkflow(ownerId, id, ownerId, role || 'user');
  }

  @Get('approvals')
  approvals(@CurrentUser('id') ownerId: string) {
    return this.operating.listApprovals(ownerId);
  }

  @Post('approvals')
  createApproval(@CurrentUser('id') ownerId: string, @Body() dto: ApprovalCreateDto) {
    return this.operating.createApproval(ownerId, dto);
  }

  @Post('approvals/:id/decide')
  decideApproval(
    @CurrentUser('id') ownerId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
    @Body() dto: ApprovalDecisionDto,
  ) {
    return this.operating.decideApproval(ownerId, id, ownerId, role || 'user', dto.decision, dto.note || '');
  }

  @Get('dashboards')
  dashboards(@CurrentUser('id') ownerId: string) {
    return this.operating.listDashboards(ownerId);
  }

  @Get('dashboards/:id/live')
  liveDashboard(@CurrentUser('id') ownerId: string, @Param('id') id: string) {
    return this.operating.renderDashboard(ownerId, id);
  }

  @Post('dashboards')
  dashboard(@CurrentUser('id') ownerId: string, @Body() dto: DashboardDto) {
    return this.operating.createDashboard(ownerId, dto.prompt);
  }

  @Post('simulate')
  simulate(@CurrentUser('id') ownerId: string, @Body() dto: SimulationDto) {
    return this.operating.simulate(ownerId, dto);
  }

  @Get('insights')
  insights(@CurrentUser('id') ownerId: string) {
    return this.operating.listInsights(ownerId);
  }

  @Post('insights/refresh')
  refreshInsights(@CurrentUser('id') ownerId: string) {
    return this.operating.refreshInsights(ownerId);
  }

  @Patch('insights/:id/status')
  insightStatus(@CurrentUser('id') ownerId: string, @Param('id') id: string, @Body() dto: InsightStatusDto) {
    return this.operating.setInsightStatus(ownerId, id, dto.status);
  }

  @Get('audit')
  audit(@CurrentUser('id') ownerId: string) {
    return this.operating.listAudit(ownerId);
  }
}
