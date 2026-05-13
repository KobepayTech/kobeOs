import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmailService } from './email.service';
import { CreateEmailDto, UpdateEmailDto } from './dto/email.dto';

@UseGuards(JwtAuthGuard)
@Controller('email')
export class EmailController {
  constructor(private readonly svc: EmailService) {}

  @Get() list(@CurrentUser('id') uid: string, @Query('folder') folder?: string) {
    return folder ? this.svc.listFolder(uid, folder) : this.svc.list(uid);
  }
  @Get(':id') get(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.get(uid, id); }
  @Post() create(@CurrentUser('id') uid: string, @Body() dto: CreateEmailDto) { return this.svc.create(uid, dto); }
  @Patch(':id') update(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateEmailDto) { return this.svc.update(uid, id, dto); }
  @Delete(':id') remove(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.remove(uid, id); }
}
