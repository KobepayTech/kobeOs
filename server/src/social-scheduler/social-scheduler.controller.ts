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

  /* ─────────────── Posts ─────────────── */

  /** Create a new social media post (draft or scheduled). */
  @Post('posts')
  createPost(
    @CurrentUser('id') uid: string,
    @Body() dto: CreateSocialPostDto,
  ) {
    return this.service.createPost(uid, dto);
  }

  /** List posts with optional status, platform, and date range filters. */
  @Get('posts')
  listPosts(
    @CurrentUser('id') uid: string,
    @Query() filters: PostFiltersDto,
  ) {
    return this.service.getPosts(uid, filters);
  }

  /** Get a single post by ID. */
  @Get('posts/:id')
  getPost(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
  ) {
    return this.service.getPostById(id, uid);
  }

  /** Update an existing post. */
  @Patch('posts/:id')
  updatePost(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: UpdateSocialPostDto,
  ) {
    return this.service.updatePost(id, uid, dto);
  }

  /** Delete a post. */
  @Delete('posts/:id')
  deletePost(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
  ) {
    return this.service.deletePost(id, uid);
  }

  /** Publish a post immediately. */
  @Post('posts/:id/publish')
  publishPost(@Param('id') id: string) {
    return this.service.publishPost(id);
  }

  /* ─────────────── Accounts ─────────────── */

  /** Connect a new social media account. */
  @Post('accounts')
  connectAccount(
    @CurrentUser('id') uid: string,
    @Body() dto: CreateSocialAccountDto,
  ) {
    return this.service.createAccount(uid, dto);
  }

  /** List all connected social media accounts. */
  @Get('accounts')
  listAccounts(@CurrentUser('id') uid: string) {
    return this.service.getAccounts(uid);
  }

  /** Disconnect a social media account. */
  @Delete('accounts/:id')
  disconnectAccount(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
  ) {
    return this.service.disconnectAccount(id, uid);
  }

  /* ─────────────── Analytics ─────────────── */

  /** Get aggregated analytics for published posts. */
  @Get('analytics')
  getAnalytics(
    @CurrentUser('id') uid: string,
    @Query() filters: AnalyticsFiltersDto,
  ) {
    return this.service.getAnalytics(uid, filters);
  }
}
