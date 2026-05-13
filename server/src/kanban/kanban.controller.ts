import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BoardsService, CardsService, ColumnsService } from './kanban.service';
import { CreateBoardDto, CreateCardDto, CreateColumnDto, UpdateBoardDto, UpdateCardDto, UpdateColumnDto } from './dto/kanban.dto';

@UseGuards(JwtAuthGuard)
@Controller('kanban')
export class KanbanController {
  constructor(
    private readonly boards: BoardsService,
    private readonly columns: ColumnsService,
    private readonly cards: CardsService,
  ) {}

  @Get('boards') listBoards(@CurrentUser('id') uid: string) { return this.boards.list(uid); }
  @Post('boards') createBoard(@CurrentUser('id') uid: string, @Body() dto: CreateBoardDto) { return this.boards.create(uid, dto); }
  @Patch('boards/:id') updateBoard(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateBoardDto) { return this.boards.update(uid, id, dto); }
  @Delete('boards/:id') removeBoard(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.boards.remove(uid, id); }

  @Get('columns') listColumns(@CurrentUser('id') uid: string, @Query('boardId') boardId?: string) {
    return boardId ? this.columns.listByBoard(uid, boardId) : this.columns.list(uid);
  }
  @Post('columns') createColumn(@CurrentUser('id') uid: string, @Body() dto: CreateColumnDto) { return this.columns.create(uid, dto); }
  @Patch('columns/:id') updateColumn(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateColumnDto) { return this.columns.update(uid, id, dto); }
  @Delete('columns/:id') removeColumn(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.columns.remove(uid, id); }

  @Get('cards') listCards(@CurrentUser('id') uid: string, @Query('columnId') columnId?: string) {
    return columnId ? this.cards.listByColumn(uid, columnId) : this.cards.list(uid);
  }
  @Post('cards') createCard(@CurrentUser('id') uid: string, @Body() dto: CreateCardDto) { return this.cards.create(uid, dto); }
  @Patch('cards/:id') updateCard(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateCardDto) { return this.cards.update(uid, id, dto); }
  @Delete('cards/:id') removeCard(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.cards.remove(uid, id); }
}
