import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';

@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly svc: CompaniesService) {}

  @Get() list(@CurrentUser('id') uid: string) { return this.svc.list(uid); }
  @Get(':id') get(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.get(uid, id); }
  @Post() create(@CurrentUser('id') uid: string, @Body() dto: CreateCompanyDto) { return this.svc.create(uid, dto); }
  @Patch(':id') update(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: UpdateCompanyDto) { return this.svc.update(uid, id, dto); }
  @Delete(':id') remove(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.svc.remove(uid, id); }
}
