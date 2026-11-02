import { WorkspaceMember } from './workspace-member.entity';
import { workspaceScope } from './workspace-access.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PosOrder, PosProduct } from '../pos/pos.entity';
import { ShopExpense } from '../eod/eod.entity';
import { RentCharge } from '../property/property.entity';
import { HotelRoom } from '../hotel/hotel.entity';
import { WarehouseItem } from '../warehouse/warehouse.entity';
import { Parcel } from '../cargo/cargo.entity';
import { CommerceBusiness } from '../commerce/commerce.entity';
import { KpTransaction } from '../kobepay-pro/kobepay-pro.entity';
import { AiApprovalRequest } from '../ai/ai-operating.entity';
import { PlatformBusinessSignal, PlatformDomainEvent } from '../platform/platform.entity';
import { BUSINESS_EVENT_NAMES } from '../platform/business-events';
import { ownerScope } from './business-scope';

export const BRIEFING_ENTITIES = [WorkspaceMember, PosOrder, PosProduct, ShopExpense, RentCharge, HotelRoom, WarehouseItem, Parcel, CommerceBusiness, KpTransaction, AiApprovalRequest, PlatformBusinessSignal, PlatformDomainEvent];
export function checkedTimezone(timezone: string) {
  if (timezone.length > 80) throw new BadRequestException('Invalid business timezone.');
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); }
  catch { throw new BadRequestException('Use a valid IANA timezone.'); }
  return timezone;
}

@Injectable()
export class BusinessBriefingService {
  constructor(private readonly db: DataSource) {}
  async snapshot(actorId: string, role = 'user', timezone = 'UTC', requestedOwnerId?: string) {
    ownerScope(actorId, role);
    checkedTimezone(timezone);
    return this.db.transaction('REPEATABLE READ', async tx => {
      await tx.query('SET TRANSACTION READ ONLY');
      const scope = await workspaceScope(tx, actorId, role, requestedOwnerId);
      // Use the database clock, preserving microseconds and avoiding app/server clock skew.
      const [{ asOf }] = await tx.query('SELECT clock_timestamp()::text AS "asOf"') as Array<{ asOf: string }>;
      const parameters = { ownerId: scope.ownerId, asOf, timezone };
      const since = (alias: string, period: 'day' | 'month') => `${alias}."createdAt" >= (date_trunc('${period}', CAST(:asOf AS timestamptz) AT TIME ZONE :timezone) AT TIME ZONE :timezone) AND ${alias}."createdAt" <= CAST(:asOf AS timestamptz)`;
      const orders = await tx.getRepository(PosOrder).createQueryBuilder('o').select('o.currency', 'currency')
        .addSelect('COALESCE(SUM(o.total),0)::text', 'total').addSelect('COUNT(*)::text', 'entries')
        .where('o.ownerId = :ownerId').andWhere('o.status = :status', { status: 'COMPLETED' }).andWhere(since('o', 'day')).setParameters(parameters).groupBy('o.currency').getRawMany<{ currency: string; total: string; entries: string }>();
      const expenses = await tx.getRepository(ShopExpense).createQueryBuilder('e').select('e.currency', 'currency')
        .addSelect('COALESCE(SUM(e.amount),0)::text', 'total').addSelect('COUNT(*)::text', 'entries')
        .where('e.ownerId = :ownerId').andWhere(since('e', 'month')).setParameters(parameters).groupBy('e.currency').getRawMany<{ currency: string; total: string; entries: string }>();
      const rent = await tx.getRepository(RentCharge).createQueryBuilder('r').select('COALESCE(SUM(GREATEST(r.amount-r."amountPaid",0)),0)::text', 'outstanding')
        .addSelect('COUNT(DISTINCT r."tenantId")::text', 'accounts').where('r.ownerId = :ownerId').andWhere('r.status IN (:...states)', { states: ['open', 'partial', 'overdue'] })
        .andWhere('r.amount > r."amountPaid"').setParameters(parameters).getRawOne<{ outstanding: string; accounts: string }>();
      const rooms = await tx.getRepository(HotelRoom).createQueryBuilder('h').select('h.status', 'status').addSelect('COUNT(*)::text', 'count').where('h.ownerId = :ownerId').setParameters(parameters).groupBy('h.status').getRawMany<{ status: string; count: string }>();
      const warehouseItems = await tx.getRepository(WarehouseItem).countBy({ ownerId: scope.ownerId });
      const warehouseLow = await tx.getRepository(WarehouseItem).createQueryBuilder('w').where('w.ownerId = :ownerId').andWhere('w.quantity <= w.reorderLevel').setParameters(parameters).getCount();
      const posLow = await tx.getRepository(PosProduct).createQueryBuilder('p').where('p.ownerId = :ownerId').andWhere('p.stock <= 5').setParameters(parameters).getCount();
      const parcels = await tx.getRepository(Parcel).createQueryBuilder('p').select('COALESCE(NULLIF(p."lifecycleStatus",\'\'),p.status,\'UNKNOWN\')', 'status').addSelect('COUNT(*)::text', 'count')
        .where('p.ownerId = :ownerId').setParameters(parameters).groupBy('COALESCE(NULLIF(p."lifecycleStatus",\'\'),p.status,\'UNKNOWN\')').getRawMany<{ status: string; count: string }>();
      const pendingApprovals = await tx.getRepository(AiApprovalRequest).countBy({ ownerId: scope.ownerId, status: 'PENDING' });
      const ledgerPostings = await tx.getRepository(KpTransaction).createQueryBuilder('l').where('l.ownerId = :ownerId').andWhere('l.status = :posted', { posted: 'POSTED' }).andWhere(since('l', 'day')).setParameters(parameters).getCount();
      const businesses = await tx.getRepository(CommerceBusiness).find({ where: { ownerUserId: scope.ownerId }, select: { id: true, businessId: true, name: true, status: true }, take: 100 });
      const signals = await tx.getRepository(PlatformBusinessSignal).find({ where: { ownerId: scope.ownerId }, order: { createdAt: 'DESC' }, take: 20 });
      const eventQueue = await tx.getRepository(PlatformDomainEvent).createQueryBuilder('q').select('q.status', 'status').addSelect('COUNT(*)::text', 'count')
        .where('q.ownerId = :ownerId').andWhere('q.eventName IN (:...names)', { names: [...BUSINESS_EVENT_NAMES] }).setParameters(parameters).groupBy('q.status').getRawMany<{ status: string; count: string }>();
      return {
        generatedAt: new Date(asOf).toISOString(), timezone, scope, businesses,
        completedOrdersToday: { totals: orders, definition: 'Completed POS order totals, separated by currency. Not cash received, profit or bank reconciliation.' },
        expensesThisMonth: { totals: expenses },
        rent: { outstandingAmount: rent?.outstanding || '0', accounts: Number(rent?.accounts || 0), currency: null, note: 'Legacy rent charges do not store a currency; do not combine this amount with other money totals.' },
        hotel: { totalRooms: rooms.reduce((sum, r) => sum + Number(r.count), 0), byStatus: Object.fromEntries(rooms.map(r => [r.status, Number(r.count)])) },
        inventory: { warehouseItems, warehouseLow, posLow, posThreshold: 5, note: 'Warehouse and POS counts are separate; they may represent the same goods.' },
        cargo: { total: parcels.reduce((sum, p) => sum + Number(p.count), 0), byStatus: Object.fromEntries(parcels.map(p => [p.status, Number(p.count)])) },
        pendingApprovals, ledger: { postingsToday: ledgerPostings, definition: 'Recorded journal postings, not new bank transfers.' },
        activity: signals, eventDelivery: Object.fromEntries(eventQueue.map(q => [q.status, Number(q.count)])),
        automationPolicy: 'Read and explain authorized records. Business changes require explicit approval; events never execute transfers.',
      };
    });
  }
  async briefing(actorId: string, role = 'user', timezone = 'UTC', requestedOwnerId?: string) {
    const data = await this.snapshot(actorId, role, timezone, requestedOwnerId);
    const parts = [`Your business briefing (${timezone}).`];
    for (const group of data.completedOrdersToday.totals) parts.push(`${group.entries} completed order(s): ${group.currency} ${group.total}.`);
    if (!data.completedOrdersToday.totals.length) parts.push('No completed orders recorded today.');
    if (data.hotel.totalRooms) parts.push(`${data.hotel.byStatus.occupied || 0} of ${data.hotel.totalRooms} hotel rooms occupied.`);
    if (data.pendingApprovals) parts.push(`${data.pendingApprovals} decision(s) await your approval.`);
    const alerts: Array<{ severity: 'info' | 'warning'; text: string; action?: { tool: string; label: string; args: Record<string, unknown> } }> = [];
    if (data.inventory.warehouseLow) alerts.push({ severity: 'warning', text: `${data.inventory.warehouseLow} warehouse item(s) are at their reorder level.` });
    if (data.inventory.posLow) alerts.push({ severity: 'warning', text: `${data.inventory.posLow} POS product(s) have five or fewer units.` });
    if (data.rent.accounts && data.scope.capabilities.approveOwnActions) alerts.push({ severity: 'warning', text: `${data.rent.accounts} rental account(s) have outstanding charges. Review the rent records before sending reminders.`, action: { label: 'Prepare rent reminders', tool: 'send_tenant_notification', args: { audience: 'unpaid', message: 'Reminder: please review your outstanding rent balance. Asante.' } } });
    if (data.eventDelivery.FAILED) alerts.push({ severity: 'warning', text: 'Some business activity signals need delivery retry; the original business records are retained.' });
    return { summary: parts.join(' '), alerts, data };
  }
}
