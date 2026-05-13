import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TodoItem, TodoList } from './todo.entity';
import { OwnedCrudService } from '../common/owned.service';

@Injectable()
export class TodoListsService extends OwnedCrudService<TodoList> {
  constructor(@InjectRepository(TodoList) repo: Repository<TodoList>) { super(repo); }
}

@Injectable()
export class TodoItemsService extends OwnedCrudService<TodoItem> {
  constructor(@InjectRepository(TodoItem) repo: Repository<TodoItem>) { super(repo); }

  listByList(ownerId: string, listId: string) {
    return this.repo.find({ where: { ownerId, listId }, order: { createdAt: 'ASC' } });
  }
}
