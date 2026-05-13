import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PasswordsService } from './passwords.service';
import { CreatePasswordDto, UpdatePasswordDto } from './dto/password.dto';

@UseGuards(JwtAuthGuard)
@Controller('passwords')
export class PasswordsController {
  constructor(private readonly svc: PasswordsService) {}
  @Get() list(@CurrentUser('id') uid: string) { return this.svc.list(uid); }
  @Get(':id') get(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.get(uid, id); }
  @Post() create(@CurrentUser('id') uid: string, @Body() dto: CreatePasswordDto) { return this.svc.create(uid, dto); }
  @Patch(':id') update(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdatePasswordDto) { return this.svc.update(uid, id, dto); }
  @Delete(':id') remove(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.remove(uid, id); }
}
