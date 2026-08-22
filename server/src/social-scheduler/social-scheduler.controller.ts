import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SocialSchedulerService } from './social-scheduler.service';
import {
  CreateSocialPostDto,
  UpdateSocialPostDto,
  PostFiltersDto,
  CreateSocialAccountDto,
  AnalyticsFiltersDto,
} from './dto/social-post.dto';

@UseGuards(JwtAuthGuard)
@Controller('social-scheduler')
export class SocialSchedulerController {
  constructor(private readonly service: SocialSchedulerService) {}

  @Post('posts')
  createPost(@CurrentUser('id') uid: string, @Body() dto: CreateSocialPostDto) {
    return this.service.createPost(uid, dto);
  }

  @Get('posts')
  listPosts(@CurrentUser('id') uid: string, @Query() filters: PostFiltersDto) {
    return this.service.getPosts(uid, filters);
  }

  @Get('posts/:id')
  getPost(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.service.getPostById(id, uid);
  }

  @Patch('posts/:id')
  updatePost(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: UpdateSocialPostDto,
  ) {
    return this.service.updatePost(id, uid, dto);
  }

  @Delete('posts/:id')
  deletePost(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.service.deletePost(id, uid);
  }

  /** Publish against the user's authorized provider account(s). */
  @Post('posts/:id/publish')
  publishPost(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.service.publishPost(id, uid);
  }

  /** Capability registry derived from real account, scope, and adapter state. */
  @Get('capabilities')
  capabilities(@CurrentUser('id') uid: string) {
    return this.service.getCapabilities(uid);
  }

  /** Legacy token-based API connector; the production UI uses official OAuth. */
  @Post('accounts')
  connectAccount(@CurrentUser('id') uid: string, @Body() dto: CreateSocialAccountDto) {
    return this.service.createAccount(uid, dto);
  }

  @Get('accounts')
  listAccounts(@CurrentUser('id') uid: string) {
    return this.service.getAccounts(uid);
  }

  @Delete('accounts/:id')
  disconnectAccount(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.service.disconnectAccount(id, uid);
  }

  @Get('analytics')
  getAnalytics(@CurrentUser('id') uid: string, @Query() filters: AnalyticsFiltersDto) {
    return this.service.getAnalytics(uid, filters);
  }
}
