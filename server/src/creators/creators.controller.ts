import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreatorsService } from './creators.service';
import { CreateCreatorDto, UpdateCreatorDto } from './dto/creator.dto';

@UseGuards(JwtAuthGuard)
@Controller('creators')
export class CreatorsController {
  constructor(private readonly svc: CreatorsService) {}
  @Get() list(@CurrentUser('id') uid: string) { return this.svc.list(uid); }
  @Get(':id') get(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.get(uid, id); }
  @Post() create(@CurrentUser('id') uid: string, @Body() dto: CreateCreatorDto) { return this.svc.create(uid, dto); }
  @Patch(':id') update(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateCreatorDto) { return this.svc.update(uid, id, dto); }
  @Delete(':id') remove(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.remove(uid, id); }
}
