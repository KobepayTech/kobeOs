import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeveloperGitService } from './developer-git.service';

class InitRepoDto { @IsString() @MaxLength(80) name!: string; }
class CommitDto { @IsString() @MaxLength(300) message!: string; }
class CheckoutDto { @IsString() @MaxLength(120) branch!: string; @IsOptional() @IsBoolean() create?: boolean; }
class SyncDto { @IsIn(['pull', 'push']) direction!: 'pull' | 'push'; }

@UseGuards(JwtAuthGuard)
@Controller('developer/git')
export class DeveloperGitController {
  constructor(private readonly git: DeveloperGitService) {}

  @Get('repos') list() { return this.git.listRepos(); }
  @Post('repos') init(@Body() dto: InitRepoDto) { return this.git.init(dto.name); }
  @Get('status') status(@Query('repo') repo: string) { return this.git.status(repo); }
  @Get('log') log(@Query('repo') repo: string, @Query('limit') limit?: string) { return this.git.log(repo, Number(limit) || 50); }
  @Get('branches') branches(@Query('repo') repo: string) { return this.git.branches(repo); }
  @Post('commit') commit(@Query('repo') repo: string, @Body() dto: CommitDto) { return this.git.commit(repo, dto.message); }
  @Post('checkout') checkout(@Query('repo') repo: string, @Body() dto: CheckoutDto) { return this.git.checkout(repo, dto.branch, dto.create === true); }
  @Post('sync') sync(@Query('repo') repo: string, @Body() dto: SyncDto) { return this.git.sync(repo, dto.direction); }
}
