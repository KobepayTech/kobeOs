import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CommitsService, DeploymentsService, FeatureFlagsService, IssuesService,
} from './devops.service';
import {
  CreateCommitDto, CreateDeploymentDto, CreateFeatureFlagDto, CreateIssueDto,
  UpdateCommitDto, UpdateDeploymentDto, UpdateFeatureFlagDto, UpdateIssueDto,
} from './dto/devops.dto';

@UseGuards(JwtAuthGuard)
@Controller('devops')
export class DevopsController {
  constructor(
    private readonly commits: CommitsService,
    private readonly flags: FeatureFlagsService,
    private readonly deployments: DeploymentsService,
    private readonly issues: IssuesService,
  ) {}

  @Get('commits') listCommits(@CurrentUser('id') uid: string) { return this.commits.list(uid); }
  @Post('commits') createCommit(@CurrentUser('id') uid: string, @Body() dto: CreateCommitDto) { return this.commits.create(uid, dto); }
  @Patch('commits/:id') updateCommit(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateCommitDto) { return this.commits.update(uid, id, dto); }
  @Delete('commits/:id') removeCommit(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.commits.remove(uid, id); }

  @Get('flags') listFlags(@CurrentUser('id') uid: string) { return this.flags.list(uid); }
  @Post('flags') createFlag(@CurrentUser('id') uid: string, @Body() dto: CreateFeatureFlagDto) { return this.flags.create(uid, dto); }
  @Patch('flags/:id') updateFlag(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateFeatureFlagDto) { return this.flags.update(uid, id, dto); }
  @Delete('flags/:id') removeFlag(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.flags.remove(uid, id); }

  @Get('deployments') listDeployments(@CurrentUser('id') uid: string) { return this.deployments.list(uid); }
  @Post('deployments') createDeployment(@CurrentUser('id') uid: string, @Body() dto: CreateDeploymentDto) { return this.deployments.create(uid, dto); }
  @Patch('deployments/:id') updateDeployment(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateDeploymentDto) { return this.deployments.update(uid, id, dto); }
  @Delete('deployments/:id') removeDeployment(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.deployments.remove(uid, id); }

  @Get('issues') listIssues(@CurrentUser('id') uid: string) { return this.issues.list(uid); }
  @Post('issues') createIssue(@CurrentUser('id') uid: string, @Body() dto: CreateIssueDto) { return this.issues.create(uid, dto); }
  @Patch('issues/:id') updateIssue(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateIssueDto) { return this.issues.update(uid, id, dto); }
  @Delete('issues/:id') removeIssue(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.issues.remove(uid, id); }
}
