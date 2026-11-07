import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/public.decorator';
import { checkedListing, PropertyListingDto } from './dto/property-listing.dto';
import { PropertyListing } from './property-listing.entity';

function publicListing({ ownerId: _owner, published: _published, ...listing }: PropertyListing) {
  return listing;
}

@UseGuards(JwtAuthGuard)
@Controller('property/listings')
export class PropertyListingController {
  constructor(@InjectRepository(PropertyListing) private readonly listings: Repository<PropertyListing>) {}

  @Get()
  list(@CurrentUser('id') ownerId: string) {
    return this.listings.find({ where: { ownerId }, order: { createdAt: 'DESC' }, take: 100 });
  }

  @Patch(':id')
  async update(@CurrentUser('id') ownerId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PropertyListingDto) {
    const result = await this.listings.update({ id, ownerId }, checkedListing(dto));
    if (!result.affected) throw new NotFoundException('Listing not found');
    return this.listings.findOneByOrFail({ id, ownerId });
  }
}

@Public()
@Controller('property-public/listings')
export class PublicPropertyListingController {
  constructor(@InjectRepository(PropertyListing) private readonly listings: Repository<PropertyListing>) {}

  @Get()
  async list(@Query('q') q = '', @Query('offer') offer = '') {
    const query = this.listings.createQueryBuilder('listing').where('listing.published = true');
    if (typeof q === 'string' && q.trim()) {
      query.andWhere('(listing.title ILIKE :q OR listing.location ILIKE :q OR listing.kind ILIKE :q)', { q: `%${q.trim().slice(0, 120)}%` });
    }
    if (offer === 'SALE' || offer === 'RENT') query.andWhere('listing.offer = :offer', { offer });
    return (await query.orderBy('listing.createdAt', 'DESC').take(100).getMany()).map(publicListing);
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const listing = await this.listings.findOneBy({ id, published: true });
    if (!listing) throw new NotFoundException('Listing not found');
    return publicListing(listing);
  }
}
