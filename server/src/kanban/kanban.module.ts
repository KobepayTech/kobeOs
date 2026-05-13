import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KanbanBoard, KanbanCard, KanbanColumn } from './kanban.entity';
import { BoardsService, CardsService, ColumnsService } from './kanban.service';
import { KanbanController } from './kanban.controller';

@Module({
  imports: [TypeOrmModule.forFeature([KanbanBoard, KanbanColumn, KanbanCard])],
  providers: [BoardsService, ColumnsService, CardsService],
  controllers: [KanbanController],
})
export class KanbanModule {}
