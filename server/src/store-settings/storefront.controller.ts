import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/public.decorator';
import { StorefrontService } from './storefront.service';
import {
  CollectionType,
  HomepageSectionType,
  StoreCollection,
  StoreHomepageSection,
} from './storefront.entity';

class CreateSectionDto {
  sectionType!: HomepageSectionType;
  config?: Record<string, unknown>;
}

class UpdateSectionDto {
  sectionType?: HomepageSectionType;
  visible?: boolean;
  config?: Record<string, unknown>;
}

class ReorderSectionsDto {
  orderedIds!: string[];
}

class CreateCollectionDto implements Partial<StoreCollection> {
  name!: string;
  slug?: string;
  description?: string;
  type?: CollectionType;
  productIds?: string[];
  rules?: Record<string, unknown>;
  visible?: boolean;
  imageUrl?: string | null;
  order?: number;
}

class UpdateCollectionDto implements Partial<StoreCollection> {
  name?: string;
  slug?: string;
  description?: string;
  type?: CollectionType;
  productIds?: string[];
  rules?: Record<string, unknown>;
  visible?: boolean;
  imageUrl?: string | null;
  order?: number;
}

/**
 * Owner-scoped storefront management — templates, homepage sections,
 * collections. All routes require a logged-in owner.
 */
@UseGuards(JwtAuthGuard)
@Controller('storefront')
export class StorefrontController {
  constructor(private readonly svc: StorefrontService) {}

  // industry templates
  @Get('templates') templates() {
    return this.svc.listTemplates();
  }
  @Post('templates/:code/apply') apply(@CurrentUser('id') uid: string, @Param('code') code: string) {
    return this.svc.applyTemplate(uid, code);
  }

  // homepage sections
  @Get('sections') sections(@CurrentUser('id') uid: string) {
    return this.svc.listSections(uid);
  }
  @Post('sections') createSection(@CurrentUser('id') uid: string, @Body() dto: CreateSectionDto) {
    return this.svc.addSection(uid, dto.sectionType, dto.config ?? {});
  }
  @Patch('sections/:id') updateSection(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.svc.updateSection(uid, id, dto as Partial<StoreHomepageSection>);
  }
  @Delete('sections/:id') removeSection(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.removeSection(uid, id);
  }
  @Post('sections/reorder') reorder(@CurrentUser('id') uid: string, @Body() dto: ReorderSectionsDto) {
    return this.svc.reorderSections(uid, dto.orderedIds ?? []);
  }

  // collections
  @Get('collections') collections(@CurrentUser('id') uid: string) {
    return this.svc.listCollections(uid);
  }
  @Post('collections') createCollection(@CurrentUser('id') uid: string, @Body() dto: CreateCollectionDto) {
    return this.svc.createCollection(uid, dto);
  }
  @Patch('collections/:id') updateCollection(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.svc.updateCollection(uid, id, dto);
  }
  @Delete('collections/:id') removeCollection(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.removeCollection(uid, id);
  }

  // brands (derived)
  @Get('brands') brands(@CurrentUser('id') uid: string) {
    return this.svc.listBrands(uid);
  }
}

/**
 * Public storefront-facing routes — same shape as /api/store/:slug/* used by
 * erp-shop, no JWT. Hit by the customer storefront to render the homepage,
 * collection pages, brand grid, etc. The slug is resolved to an ownerId via
 * StoreSettings.
 */
@Public()
@Controller('store')
export class StorefrontPublicController {
  constructor(private readonly svc: StorefrontService) {}

  @Get(':slug/sections') publicSections(@Param('slug') slug: string) {
    return this.resolve(slug).then((uid) => this.svc.listSections(uid));
  }

  @Get(':slug/collections') publicCollections(@Param('slug') slug: string) {
    return this.resolve(slug).then((uid) => this.svc.listCollections(uid));
  }

  @Get(':slug/collections/:collectionSlug') publicCollection(
    @Param('slug') slug: string,
    @Param('collectionSlug') collectionSlug: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.resolve(slug).then((uid) =>
      this.svc.resolveProducts(uid, collectionSlug, Number(page ?? 1), Number(limit ?? 24)),
    );
  }

  @Get(':slug/brands') publicBrands(@Param('slug') slug: string) {
    return this.resolve(slug).then((uid) => this.svc.listBrands(uid));
  }

  private resolve(slug: string): Promise<string> {
    return this.svc.resolveOwnerBySlug(slug);
  }
}
