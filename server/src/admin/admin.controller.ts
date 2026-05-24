import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { AdminService } from './admin.service';
import { CreateCompanyAdminDto, UpdateCompanyStatusDto, UpdateUserRoleDto } from './dto/admin.dto';

@UseGuards(JwtAuthGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly svc: AdminService) {}

  // ── Stats ──────────────────────────────────────────────────────────────────
  @Get('stats') stats() { return this.svc.getStats(); }

  // ── Users ──────────────────────────────────────────────────────────────────
  @Get('users')           listUsers(@Query('page') page?: string) { return this.svc.listUsers(page ? +page : 1); }
  @Get('users/:id')       getUser(@Param('id') id: string) { return this.svc.getUser(id); }
  @Patch('users/:id/role') updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) { return this.svc.updateUserRole(id, dto.role); }
  @Delete('users/:id')    deleteUser(@Param('id') id: string) { return this.svc.deleteUser(id); }

  // ── Companies ──────────────────────────────────────────────────────────────
  @Get('companies')              listCompanies(@Query('page') page?: string) { return this.svc.listCompanies(page ? +page : 1); }
  @Get('companies/:id')          getCompany(@Param('id') id: string) { return this.svc.getCompany(id); }
  @Post('companies')             createCompany(@Body() dto: CreateCompanyAdminDto) { return this.svc.createCompany(dto); }
  @Patch('companies/:id/status') updateStatus(@Param('id') id: string, @Body() dto: UpdateCompanyStatusDto) { return this.svc.updateCompanyStatus(id, dto.status); }
  @Delete('companies/:id')       deleteCompany(@Param('id') id: string) { return this.svc.deleteCompany(id); }

  // ── Subscriptions ──────────────────────────────────────────────────────────
  @Get('subscriptions')          listSubscriptions(@Query('page') page?: string) { return this.svc.listSubscriptions(page ? +page : 1); }
  @Patch('subscriptions/:id')    updateSubscription(@Param('id') id: string, @Body() dto: { status?: string; endDate?: string; autoRenew?: boolean }) { return this.svc.updateSubscription(id, dto); }
  @Delete('subscriptions/:id')   cancelSubscription(@Param('id') id: string) { return this.svc.cancelSubscription(id); }
}
