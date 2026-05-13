import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FilesService } from './files.service';
import { CreateNodeDto, MoveNodeDto, UpdateNodeDto } from './dto/file.dto';

@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly svc: FilesService) {}

  @Get()
  list(@CurrentUser('id') uid: string, @Query('parent') parent?: string) {
    return this.svc.list(uid, parent ?? '/');
  }

  @Get('node')
  get(@CurrentUser('id') uid: string, @Query('path') path: string) {
    return this.svc.get(uid, path);
  }

  @Post()
  create(@CurrentUser('id') uid: string, @Body() dto: CreateNodeDto) {
    return this.svc.create(uid, dto);
  }

  @Patch('node')
  update(@CurrentUser('id') uid: string, @Query('path') path: string, @Body() dto: UpdateNodeDto) {
    return this.svc.update(uid, path, dto);
  }

  @Put('move')
  move(@CurrentUser('id') uid: string, @Query('path') path: string, @Body() dto: MoveNodeDto) {
    return this.svc.move(uid, path, dto);
  }

  @Delete('node')
  remove(@CurrentUser('id') uid: string, @Query('path') path: string) {
    return this.svc.remove(uid, path);
  }
}
