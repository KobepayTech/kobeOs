import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser('id') id: string) {
    return this.users.getProfile(id);
  }

  @Patch('me')
  update(@CurrentUser('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Get()
  @Roles('admin')
  findAll() {
    return this.users.findAll();
  }

  @Get(':id')
  @Roles('admin')
  findOne(@Param('id') id: string) {
    return this.users.getProfile(id);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.users.remove(id);
  }
}
