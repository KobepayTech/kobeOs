import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Note } from './note.entity';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class NotesService extends OwnedCrudService<Note> {
  constructor(@InjectRepository(Note) repo: Repository<Note>) {
    super(repo);
  }
}
