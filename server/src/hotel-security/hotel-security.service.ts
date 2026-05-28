import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OwnedCrudService } from '../common/owned.service';
import { HotelRoomSignalLink } from './hotel-room-link.entity';
import { HotelRoomReview } from './hotel-room-review.entity';

@Injectable()
export class HotelRoomSignalLinksService extends OwnedCrudService<HotelRoomSignalLink> {
  constructor(@InjectRepository(HotelRoomSignalLink) repo: Repository<HotelRoomSignalLink>) { super(repo); }
}

@Injectable()
export class HotelRoomReviewsService extends OwnedCrudService<HotelRoomReview> {
  constructor(@InjectRepository(HotelRoomReview) repo: Repository<HotelRoomReview>) { super(repo); }
}

@Injectable()
export class HotelSecurityDashboardService {
  constructor(
    private readonly links: HotelRoomSignalLinksService,
    private readonly reviews: HotelRoomReviewsService,
  ) {}

  async summary(ownerId: string) {
    const [links, reviews] = await Promise.all([
      this.links.count(ownerId),
      this.reviews.count(ownerId),
    ]);
    return { links, reviews };
  }
}
