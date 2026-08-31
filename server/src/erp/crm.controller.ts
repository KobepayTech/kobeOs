import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErpCrmStage } from './crm.entity';
import { ErpCrmService } from './crm.service';

@UseGuards(JwtAuthGuard)
@Controller('erp/crm')
export class ErpCrmController {
  constructor(private readonly crm: ErpCrmService) {}

  @Get('summary')
  summary(@CurrentUser('id') uid: string) {
    return this.crm.summary(uid);
  }

  @Get('leads')
  leads(
    @CurrentUser('id') uid: string,
    @Query() query: { stage?: string; source?: string; businessId?: string; q?: string },
  ) {
    return this.crm.list(uid, query);
  }

  @Post('leads')
  create(
    @CurrentUser('id') uid: string,
    @Body() body: {
      businessId?: string;
      source?: 'MANUAL' | 'VEHICLE' | 'STORE' | 'HOTEL' | 'PROPERTY' | 'RECRUITMENT' | 'RECEPTION';
      sourceRefId?: string;
      customerName: string;
      customerPhone?: string;
      customerWhatsapp?: string;
      customerEmail?: string;
      subject: string;
      stage?: ErpCrmStage;
      value?: number;
      currency?: string;
      notes?: string;
      assignedTo?: string;
      nextActionAt?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.crm.upsertLead(uid, body);
  }

  @Patch('leads/:id')
  update(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() body: {
      stage?: ErpCrmStage;
      assignedTo?: string;
      nextActionAt?: string | null;
      notes?: string;
      value?: number;
      currency?: string;
    },
  ) {
    return this.crm.updateLead(uid, id, body);
  }

  @Get('leads/:id/activities')
  activities(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.crm.listActivities(uid, id);
  }

  @Post('leads/:id/activities')
  addActivity(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() body: {
      type?: 'NOTE' | 'CALL' | 'WHATSAPP' | 'SMS' | 'EMAIL' | 'APPOINTMENT' | 'STATUS_CHANGE';
      body?: string;
      scheduledFor?: string | null;
      completedAt?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.crm.addActivity(uid, id, body);
  }
}
