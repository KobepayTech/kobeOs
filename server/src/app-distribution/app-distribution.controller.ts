import { Body, Controller, Delete, Get, Injectable, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { AppDistributionService } from './app-distribution.service';
import { InstallDeveloperAppDto, ReviewDeveloperAppDto } from './app-distribution.dto';

// Publisher/reviewer identity must never fall back to the desktop's synthetic
// local administrator. Require an actual signed account token for this store.
@Injectable()
export class DeveloperStoreJwtGuard extends AuthGuard('jwt') {}

@Controller('app-distribution')
@UseGuards(JwtAuthGuard, DeveloperStoreJwtGuard, RolesGuard)
export class AppDistributionController {
  constructor(private readonly apps: AppDistributionService) {}
  @Get('me') me(@CurrentUser('id') id: string, @CurrentUser('role') role: string) { return { publisherId: id, canReview: role === 'admin' }; }
  @Get('trust-key') trust() { return this.apps.trust(); }
  @Get('catalogue') catalogue() { return this.apps.catalogue(); }
  @Get('releases') mine(@CurrentUser('id') id: string) { return this.apps.mine(id); }
  @Get('releases/:id/package') publisherPackage(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string) { return this.apps.publisherPackage(uid, id); }
  @Post('releases') submit(@CurrentUser('id') id: string, @Body() body: unknown) { return this.apps.submit(id, body); }
  @Get('reviews') @Roles('admin') reviews() { return this.apps.reviews(); }
  @Get('reviews/:id/package') @Roles('admin') reviewPackage(@Param('id', ParseUUIDPipe) id: string) { return this.apps.reviewPackage(id); }
  @Post('reviews/:id') @Roles('admin') review(@CurrentUser('id') uid: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDeveloperAppDto) { return this.apps.review(uid, id, dto); }
  @Get('installed') installed(@CurrentUser('id') uid: string) { return this.apps.installs(uid); }
  @Post('installed') install(@CurrentUser('id') uid: string, @Body() dto: InstallDeveloperAppDto) { return this.apps.install(uid, dto); }
  @Delete('installed/:appId') uninstall(@CurrentUser('id') uid: string, @Param('appId') id: string) { return this.apps.uninstall(uid, id); }
  @Get('installed/:appId/package') package(@CurrentUser('id') uid: string, @Param('appId') id: string) { return this.apps.installedPackage(uid, id); }
  @Get('installed/:appId/inventory') inventory(@CurrentUser('id') uid: string, @Param('appId') id: string, @Query('version') version: string) { return this.apps.inventory(uid, id, version); }
}
