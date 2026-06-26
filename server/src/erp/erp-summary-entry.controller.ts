import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ErpSummaryEntryService, SummaryEntryBulkInput, SummaryEntryInput } from './erp-summary-entry.service';

@UseGuards(JwtAuthGuard)
@Controller('erp/summary-entries')
export class ErpSummaryEntryController {
  constructor(private readonly svc: ErpSummaryEntryService) {}

  @Get()
  list(@CurrentUser('id') uid: string) { return this.svc.list(uid); }

  @Post()
  create(@CurrentUser('id') uid: string, @Body() dto: SummaryEntryInput) {
    return this.svc.create(uid, dto);
  }

  @Post('bulk-import')
  bulkImport(@CurrentUser('id') uid: string, @Body() dto: SummaryEntryBulkInput) {
    return this.svc.bulkImport(uid, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.remove(uid, id);
  }
}
