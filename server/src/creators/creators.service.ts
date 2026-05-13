import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Creator } from './creator.entity';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class CreatorsService extends OwnedCrudService<Creator> {
  constructor(@InjectRepository(Creator) repo: Repository<Creator>) { super(repo); }
}
