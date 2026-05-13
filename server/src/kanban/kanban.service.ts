import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KanbanBoard, KanbanCard, KanbanColumn } from './kanban.entity';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class BoardsService extends OwnedCrudService<KanbanBoard> {
  constructor(@InjectRepository(KanbanBoard) repo: Repository<KanbanBoard>) { super(repo); }
}

@Injectable()
export class ColumnsService extends OwnedCrudService<KanbanColumn> {
  constructor(@InjectRepository(KanbanColumn) repo: Repository<KanbanColumn>) { super(repo); }
  listByBoard(uid: string, boardId: string) {
    return this.repo.find({ where: { ownerId: uid, boardId }, order: { position: 'ASC' } });
  }
}

@Injectable()
export class CardsService extends OwnedCrudService<KanbanCard> {
  constructor(@InjectRepository(KanbanCard) repo: Repository<KanbanCard>) { super(repo); }
  listByColumn(uid: string, columnId: string) {
    return this.repo.find({ where: { ownerId: uid, columnId }, order: { position: 'ASC' } });
  }
}
