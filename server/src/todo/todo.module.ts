import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TodoItem, TodoList } from './todo.entity';
import { TodoItemsService, TodoListsService } from './todo.service';
import { TodoController } from './todo.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TodoList, TodoItem])],
  providers: [TodoListsService, TodoItemsService],
  controllers: [TodoController],
})
export class TodoModule {}
