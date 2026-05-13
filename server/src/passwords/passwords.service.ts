import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasswordEntry } from './password.entity';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class PasswordsService extends OwnedCrudService<PasswordEntry> {
  constructor(@InjectRepository(PasswordEntry) repo: Repository<PasswordEntry>) { super(repo); }
}
