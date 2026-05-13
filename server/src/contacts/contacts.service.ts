import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './contact.entity';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class ContactsService extends OwnedCrudService<Contact> {
  constructor(@InjectRepository(Contact) repo: Repository<Contact>) { super(repo); }
}
