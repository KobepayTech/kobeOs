import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  GroupStatus, KpGroupOrder, KpPurchaseGroup, KpReservedHold, KpStudent, KpSupplier,
} from './kobepay-pro.entity';
import { LedgerService } from './ledger.service';
import { WalletService } from './wallet.service';

const CENTS = 1e4;
const round = (n: number) => Math.round(n * CENTS) / CENTS;
const ALPHA = 'ACDEFGHJKMNPQRTUVWXY34679';
const short = (n: number) => {
  const b = randomBytes(n); let s = '';
  for (let i = 0; i < n; i++) s += ALPHA[b[i] % ALPHA.length];
  return s;
};

/** Statuses the supplier may advance a group through (self-service, no login). */
const SUPPLIER_FLOW: GroupStatus[] = ['ORDERED', 'PRODUCTION', 'IN_TRANSIT', 'DELIVERED'];

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(KpPurchaseGroup) private readonly groups: Repository<KpPurchaseGroup>,
    @InjectRepository(KpGroupOrder) private readonly orders: Repository<KpGroupOrder>,
    @InjectRepository(KpSupplier) private readonly suppliers: Repository<KpSupplier>,
    @InjectRepository(KpStudent) private readonly students: Repository<KpStudent>,
    @InjectRepository(KpReservedHold) private readonly holds: Repository<KpReservedHold>,
    private readonly wallets: WalletService,
    private readonly ledger: LedgerService,
    private readonly dataSource: DataSource,
  ) {}

  // ── Suppliers ──────────────────────────────────────────────────────────────
  async createSupplier(ownerId: string, dto: {
    name: string; code?: string; contactPhone?: string; contactEmail?: string;
    settlementAccount?: string; settlementMethod?: string;
  }) {
    const code = (dto.code || `SUP${short(5)}`).toUpperCase();
    if (await this.suppliers.findOne({ where: { ownerId, code } })) throw new BadRequestException('Supplier code already in use');
    return this.suppliers.save(this.suppliers.create({
      ownerId, name: dto.name, code,
      contactPhone: dto.contactPhone || '', contactEmail: dto.contactEmail || '',
      settlementAccount: dto.settlementAccount || '', settlementMethod: dto.settlementMethod || 'mobile',
      portalToken: randomBytes(18).toString('base64url'), status: 'ACTIVE',
    }));
  }
  listSuppliers(ownerId: string) { return this.suppliers.find({ where: { ownerId }, order: { name: 'ASC' } }); }

  /** Pay a supplier's outstanding payable from the bank account. */
  async settleSupplier(ownerId: string, supplierId: string) {
    const supplier = await this.suppliers.findOne({ where: { ownerId, id: supplierId } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return this.dataSource.transaction(async (m) => {
      const payable = await this.ledger.owedLocked(m, ownerId, 'SUPPLIER', supplierId);
      if (payable <= 0) return { settled: 0, reference: null };
      const txn = await this.ledger.post(m, {
        ownerId, kind: 'SETTLEMENT', amount: payable, description: `Settlement to ${supplier.name}`,
        metadata: { supplierId, method: supplier.settlementMethod, account: supplier.settlementAccount },
      }, [
        { type: 'SUPPLIER', refId: supplierId, debit: payable },
        { type: 'BANK', credit: payable },
      ]);
      return { settled: payable, reference: txn.reference, transactionId: txn.id };
    });
  }

  // ── Groups ─────────────────────────────────────────────────────────────────
  async createGroup(ownerId: string, dto: {
    schoolId: string; title: string; productName?: string; description?: string; imageUrl?: string;
    normalPrice?: number; groupPrice: number; currency?: string; minParticipants?: number;
    deadline?: string; deliveryLocation?: string; supplierId?: string; supplierUnitCost?: number;
  }) {
    if (!dto.title?.trim()) throw new BadRequestException('Title is required');
    if (!(dto.groupPrice > 0)) throw new BadRequestException('Group price must be positive');
    return this.groups.save(this.groups.create({
      ownerId, schoolId: dto.schoolId, reference: `KG${short(6)}`,
      title: dto.title, productName: dto.productName || dto.title, description: dto.description || '',
      imageUrl: dto.imageUrl || '',
      normalPrice: dto.normalPrice ?? 0, groupPrice: dto.groupPrice, currency: dto.currency || 'TZS',
      minParticipants: Math.max(1, Math.floor(dto.minParticipants ?? 1)),
      deadline: dto.deadline ? new Date(dto.deadline) : null,
      deliveryLocation: dto.deliveryLocation || '',
      supplierId: dto.supplierId ?? null, supplierUnitCost: dto.supplierUnitCost ?? 0,
      status: 'OPEN',
    }));
  }

  listGroups(ownerId: string, schoolId?: string) {
    return this.groups.find({ where: { ownerId, ...(schoolId ? { schoolId } : {}) }, order: { createdAt: 'DESC' }, take: 500 });
  }

  async getGroup(ownerId: string, id: string) {
    const group = await this.groups.findOne({ where: { ownerId, id } });
    if (!group) throw new NotFoundException('Group not found');
    const orders = await this.orders.find({ where: { ownerId, groupId: id }, order: { createdAt: 'ASC' } });
    const studentIds = [...new Set(orders.map((o) => o.studentId))];
    const students = studentIds.length ? await this.students.find({ where: { ownerId, id: In(studentIds) } }) : [];
    const nameOf = (sid: string) => students.find((s) => s.id === sid)?.name || 'Student';
    const active = orders.filter((o) => o.status === 'RESERVED' || o.status === 'CAPTURED');
    const qty = active.reduce((s, o) => s + o.qty, 0);
    const supplier = group.supplierId ? await this.suppliers.findOne({ where: { ownerId, id: group.supplierId } }) : null;
    return {
      group,
      supplier: supplier ? { id: supplier.id, name: supplier.name, code: supplier.code } : null,
      participants: active.length,
      totalQty: qty,
      escrowTotal: round(active.reduce((s, o) => s + o.amount, 0)),
      supplierTotal: round(qty * group.supplierUnitCost),
      collected: orders.filter((o) => o.collectedAt).length,
      minReached: active.length >= group.minParticipants,
      orders: orders.map((o) => ({
        id: o.id, reference: o.reference, studentId: o.studentId, studentName: nameOf(o.studentId),
        qty: o.qty, amount: o.amount, status: o.status,
        collected: !!o.collectedAt, collectedAt: o.collectedAt,
      })),
    };
  }

  async joinGroup(ownerId: string, groupId: string, dto: { studentId: string; qty?: number }) {
    const qty = Math.max(1, Math.floor(dto.qty ?? 1));
    return this.dataSource.transaction(async (m) => {
      const group = await m.findOne(KpPurchaseGroup, { where: { ownerId, id: groupId } });
      if (!group) throw new NotFoundException('Group not found');
      if (group.status !== 'OPEN') throw new BadRequestException('This group is no longer open to join');
      if (group.deadline && group.deadline.getTime() < Date.now()) throw new BadRequestException('The join deadline has passed');
      const student = await m.findOne(KpStudent, { where: { ownerId, id: dto.studentId } });
      if (!student) throw new NotFoundException('Student not found');
      const dup = await m.findOne(KpGroupOrder, { where: { ownerId, groupId, studentId: dto.studentId, status: 'RESERVED' } });
      if (dup) throw new BadRequestException('This student already joined this group');

      const amount = round(group.groupPrice * qty);
      const hold = await this.wallets.reserveIn(m, ownerId, dto.studentId, amount, `Group: ${group.title}`, groupId);
      try {
        return await m.save(m.create(KpGroupOrder, {
          ownerId, groupId, schoolId: group.schoolId, studentId: dto.studentId,
          reference: `KO${short(6)}`, qty, unitPrice: group.groupPrice, amount,
          holdId: hold.id, status: 'RESERVED',
        }));
      } catch (e) {
        // Unique partial index (one active order per student+group) — a
        // concurrent double-join; the whole txn (incl. the reserve) rolls back.
        if ((e as { code?: string }).code === '23505') {
          throw new BadRequestException('This student already joined this group');
        }
        throw e;
      }
    });
  }

  async cancelOrder(ownerId: string, orderId: string) {
    return this.dataSource.transaction(async (m) => {
      const order = await m.findOne(KpGroupOrder, { where: { ownerId, id: orderId } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== 'RESERVED') throw new BadRequestException('Only reserved orders can be cancelled');
      const group = await m.findOne(KpPurchaseGroup, { where: { ownerId, id: order.groupId } });
      if (group && group.status !== 'OPEN') throw new BadRequestException('Group already ordered — cannot cancel');
      if (order.holdId) await this.wallets.releaseHold(m, ownerId, order.holdId);
      order.status = 'CANCELLED';
      await m.save(order);
      return { cancelled: true };
    });
  }

  async assignSupplier(ownerId: string, groupId: string, dto: { supplierId: string; supplierUnitCost: number }) {
    const group = await this.getOwnedGroup(ownerId, groupId);
    if (['COMPLETED', 'CANCELLED'].includes(group.status)) throw new BadRequestException('Group is closed');
    const supplier = await this.suppliers.findOne({ where: { ownerId, id: dto.supplierId } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    group.supplierId = dto.supplierId;
    group.supplierUnitCost = Math.max(0, dto.supplierUnitCost);
    return this.groups.save(group);
  }

  /** Close participation and generate the single consolidated supplier order. */
  async consolidate(ownerId: string, groupId: string, force = false) {
    const group = await this.getOwnedGroup(ownerId, groupId);
    if (group.status !== 'OPEN') throw new BadRequestException('Group is not open');
    if (!group.supplierId || group.supplierUnitCost <= 0) throw new BadRequestException('Assign a supplier and unit cost first');
    const active = await this.orders.find({ where: { ownerId, groupId, status: 'RESERVED' } });
    if (!active.length) throw new BadRequestException('No participants to order');
    if (!force && active.length < group.minParticipants) {
      throw new BadRequestException(`Only ${active.length}/${group.minParticipants} participants — pass force to order anyway`);
    }
    group.status = 'ORDERED';
    group.orderedAt = new Date();
    await this.groups.save(group);
    const totalQty = active.reduce((s, o) => s + o.qty, 0);
    return { ordered: true, totalQty, supplierTotal: round(totalQty * group.supplierUnitCost) };
  }

  async verifyDelivery(ownerId: string, groupId: string) {
    const group = await this.getOwnedGroup(ownerId, groupId);
    if (group.status !== 'DELIVERED') throw new BadRequestException('Group must be marked DELIVERED by the supplier first');
    group.status = 'VERIFIED';
    group.verifiedAt = new Date();
    return this.groups.save(group);
  }

  /** Student collects their item — identified by id / NFC / QR / code. Guards against double collection. */
  async collect(ownerId: string, groupId: string, dto: { studentId?: string; nfcCardId?: string; qrToken?: string; studentCode?: string }) {
    const group = await this.getOwnedGroup(ownerId, groupId);
    if (!['DELIVERED', 'VERIFIED', 'COMPLETED'].includes(group.status)) {
      throw new BadRequestException('Items are not ready for collection yet');
    }
    const student = await this.resolveStudent(ownerId, dto);
    const order = await this.orders.findOne({ where: { ownerId, groupId, studentId: student.id } });
    if (!order || order.status === 'CANCELLED' || order.status === 'RELEASED') throw new NotFoundException('No order for this student in this group');
    if (order.collectedAt) throw new BadRequestException(`Already collected on ${order.collectedAt.toISOString()}`);
    order.collectedAt = new Date();
    order.collectedBy = dto.nfcCardId ? `nfc:${dto.nfcCardId}` : dto.qrToken ? 'qr' : dto.studentCode ? `code:${dto.studentCode}` : 'admin';
    await this.orders.save(order);
    return {
      collected: true, student: { id: student.id, name: student.name },
      order: { reference: order.reference, qty: order.qty }, at: order.collectedAt,
    };
  }

  /** Complete the group: capture every escrowed order to the supplier, recognise the margin as fees. */
  async completeAndPay(ownerId: string, groupId: string) {
    return this.dataSource.transaction(async (m) => {
      const group = await m.createQueryBuilder(KpPurchaseGroup, 'g')
        .setLock('pessimistic_write')
        .where('g.ownerId = :ownerId AND g.id = :groupId', { ownerId, groupId })
        .getOne();
      if (!group) throw new NotFoundException('Group not found');
      if (group.status !== 'VERIFIED') throw new BadRequestException('Verify delivery before paying the supplier');
      if (!group.supplierId) throw new BadRequestException('No supplier assigned');
      const active = await m.find(KpGroupOrder, { where: { ownerId, groupId, status: 'RESERVED' } });
      let toSupplier = 0;
      for (const order of active) {
        const supplierShare = round(group.supplierUnitCost * order.qty);
        if (order.holdId) await this.wallets.captureHold(m, ownerId, order.holdId, group.supplierId, supplierShare);
        order.status = 'CAPTURED';
        await m.save(order);
        toSupplier = round(toSupplier + supplierShare);
      }
      group.status = 'COMPLETED';
      group.completedAt = new Date();
      await m.save(group);
      return { completed: true, captured: active.length, supplierPayable: toSupplier };
    });
  }

  /** Cancel a group and refund every reserved participant. */
  async cancelGroup(ownerId: string, groupId: string) {
    return this.dataSource.transaction(async (m) => {
      const group = await m.createQueryBuilder(KpPurchaseGroup, 'g')
        .setLock('pessimistic_write')
        .where('g.ownerId = :ownerId AND g.id = :groupId', { ownerId, groupId })
        .getOne();
      if (!group) throw new NotFoundException('Group not found');
      if (group.status === 'COMPLETED') throw new BadRequestException('Completed groups cannot be cancelled');
      if (group.status === 'CANCELLED') throw new BadRequestException('Group already cancelled');
      const active = await m.find(KpGroupOrder, { where: { ownerId, groupId, status: 'RESERVED' } });
      for (const order of active) {
        if (order.holdId) await this.wallets.releaseHold(m, ownerId, order.holdId);
        order.status = 'CANCELLED';
        await m.save(order);
      }
      group.status = 'CANCELLED';
      await m.save(group);
      return { cancelled: true, refunded: active.length };
    });
  }

  // ── Supplier portal (public, by token) ───────────────────────────────────────
  async supplierPortal(portalToken: string) {
    const supplier = await this.suppliers.findOne({ where: { portalToken } });
    if (!supplier) throw new NotFoundException('Supplier portal not found');
    const groups = await this.groups.find({
      where: { ownerId: supplier.ownerId, supplierId: supplier.id, status: In(SUPPLIER_FLOW.concat('VERIFIED', 'COMPLETED')) },
      order: { orderedAt: 'DESC' },
    });
    const rows = await Promise.all(groups.map(async (g) => {
      const active = await this.orders.find({ where: { ownerId: g.ownerId, groupId: g.id, status: In(['RESERVED', 'CAPTURED']) } });
      const qty = active.reduce((s, o) => s + o.qty, 0);
      return {
        groupId: g.id, reference: g.reference, title: g.title, productName: g.productName,
        status: g.status, quantity: qty, unitCost: g.supplierUnitCost, total: round(qty * g.supplierUnitCost),
        deliveryLocation: g.deliveryLocation, deadline: g.deadline, orderedAt: g.orderedAt,
        collected: (await this.orders.count({ where: { ownerId: g.ownerId, groupId: g.id } })),
      };
    }));
    return { supplier: { name: supplier.name, code: supplier.code }, orders: rows };
  }

  async supplierUpdateStatus(portalToken: string, groupId: string, status: GroupStatus) {
    const supplier = await this.suppliers.findOne({ where: { portalToken } });
    if (!supplier) throw new NotFoundException('Supplier portal not found');
    const group = await this.groups.findOne({ where: { ownerId: supplier.ownerId, id: groupId, supplierId: supplier.id } });
    if (!group) throw new NotFoundException('Order not found');
    if (!SUPPLIER_FLOW.includes(status)) throw new BadRequestException('Suppliers can only set PRODUCTION, IN_TRANSIT or DELIVERED');
    const order = SUPPLIER_FLOW.indexOf(group.status as GroupStatus);
    const next = SUPPLIER_FLOW.indexOf(status);
    if (order < 0) throw new BadRequestException('This order is not in a supplier-editable state');
    if (next <= order) throw new BadRequestException(`Cannot move from ${group.status} back to ${status}`);
    group.status = status;
    if (status === 'DELIVERED') group.deliveredAt = new Date();
    await this.groups.save(group);
    return { ok: true, status: group.status };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  private async getOwnedGroup(ownerId: string, id: string) {
    const group = await this.groups.findOne({ where: { ownerId, id } });
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }
  private async resolveStudent(ownerId: string, dto: { studentId?: string; nfcCardId?: string; qrToken?: string; studentCode?: string }) {
    const where = dto.studentId ? { ownerId, id: dto.studentId }
      : dto.nfcCardId ? { ownerId, nfcCardId: dto.nfcCardId }
      : dto.qrToken ? { ownerId, qrToken: dto.qrToken }
      : dto.studentCode ? { ownerId, studentCode: dto.studentCode.toUpperCase() }
      : null;
    if (!where) throw new BadRequestException('Provide a student id, NFC, QR or code');
    const student = await this.students.findOne({ where });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }
}
