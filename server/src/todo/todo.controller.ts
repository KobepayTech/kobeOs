import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TodoItemsService, TodoListsService } from './todo.service';
import { CreateTodoItemDto, CreateTodoListDto, UpdateTodoItemDto, UpdateTodoListDto } from './dto/todo.dto';

@UseGuards(JwtAuthGuard)
@Controller('todo')
export class TodoController {
  constructor(
    private readonly lists: TodoListsService,
    private readonly items: TodoItemsService,
  ) {}

  @Get('lists') listLists(@CurrentUser('id') uid: string) { return this.lists.list(uid); }
  @Post('lists') createList(@CurrentUser('id') uid: string, @Body() dto: CreateTodoListDto) { return this.lists.create(uid, dto); }
  @Patch('lists/:id') updateList(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateTodoListDto) { return this.lists.update(uid, id, dto); }
  @Delete('lists/:id') removeList(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.lists.remove(uid, id); }

  @Get('items') listItems(@CurrentUser('id') uid: string, @Query('listId') listId?: string) {
    return listId ? this.items.listByList(uid, listId) : this.items.list(uid);
  }
  @Post('items') createItem(@CurrentUser('id') uid: string, @Body() dto: CreateTodoItemDto) { return this.items.create(uid, dto); }
  @Patch('items/:id') updateItem(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateTodoItemDto) { return this.items.update(uid, id, dto); }
  @Delete('items/:id') removeItem(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.items.remove(uid, id); }
}
