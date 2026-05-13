import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { CalendarEvent } from './event.entity';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class CalendarService extends OwnedCrudService<CalendarEvent> {
  constructor(@InjectRepository(CalendarEvent) repo: Repository<CalendarEvent>) { super(repo); }

  range(uid: string, start: Date, end: Date) {
    return this.repo.find({
      where: { ownerId: uid, startAt: Between(start, end) },
      order: { startAt: 'ASC' },
    });
  }
}
