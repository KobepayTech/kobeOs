import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KobepaySupplierReceipt, ReceiptAllocationStatus } from './kobepay-receipt.entity';
import { PaymentSupplier } from './kobepay.entity';
import { PurchaseOrder } from '../erp/erp.entity';
import { AuditContext, KobePayRbacService } from './kobepay-rbac.service';

export interface ImportReceiptInput {
  kobepayReceiptId: string;
  kobepayBusinessId?: string;
  customerPhone: string;
  customerName?: string;
  supplierPhone: string;
  supplierName?: string;
  sentAmount: number;
  sentCurrency?: string;
  exchangeRate?: number;
  supplierReceivedAmount?: number;
  supplierCurrency?: string;
  supplierCity?: string;
  poNumber?: string;
}

@Injectable()
export class KobepayReceiptsService {
  constructor(
    @InjectRepository(KobepaySupplierReceipt) private readonly receipts: Repository<KobepaySupplierReceipt>,
    @InjectRepository(PaymentSupplier) private readonly suppliers: Repository<PaymentSupplier>,
    @InjectRepository(PurchaseOrder) private readonly purchaseOrders: Repository<PurchaseOrder>,
    private readonly rbac: KobePayRbacService,
  ) {}

  list(uid: string, status?: ReceiptAllocationStatus) {
    return this.receipts.find({
      where: status ? { ownerId: uid, allocationStatus: status } : { ownerId: uid },
      order: { createdAt: 'DESC' },
    });
  }

  async get(uid: string, id: string) {
    const r = await this.receipts.findOne({ where: { id, ownerId: uid } });
    if (!r) throw new NotFoundException();
    return r;
  }

  /**
   * Idempotently ingest a receipt and run the safe scoped match:
   *   1. Search suppliers WHERE ownerId = uid AND phone = supplierPhone
   *      - 0 found → supplier_missing
   *      - 1 found → linked (then check PO)
   *      - >1 found → needs_review (refuse to guess)
   *   2. If supplier linked: search POs WHERE ownerId = uid AND
   *      supplier = supplierName/Number, status Pending/In Transit.
   *      - 1 found → keep linked, attach poId
   *      - 0 found → po_missing
   *      - >1 found → needs_review with explanation
   *
   * Re-import (same kobepayReceiptId + ownerId) returns the existing
   * row unchanged.
   */
  async ingest(uid: string, ctx: AuditContext, input: ImportReceiptInput) {
    const existing = await this.receipts.findOne({
      where: { ownerId: uid, kobepayReceiptId: input.kobepayReceiptId },
    });
    if (existing) return existing;

    const matches = await this.suppliers.find({
      where: { ownerId: uid, phone: input.supplierPhone },
    });

    let supplierId: string | null = null;
    let supplierName = input.supplierName ?? '';
    let allocationStatus: ReceiptAllocationStatus = 'supplier_missing';
    let reviewReason = '';
    let poId: string | null = null;

    if (matches.length === 1) {
      supplierId = matches[0].id;
      supplierName = matches[0].name;
      allocationStatus = 'linked';
    } else if (matches.length > 1) {
      allocationStatus = 'needs_review';
      reviewReason = `${matches.length} suppliers under this account share phone ${input.supplierPhone}; pick the right one.`;
    } else {
      reviewReason = `No supplier with phone ${input.supplierPhone} exists under this account.`;
    }

    // PO match — only attempted when a supplier resolved cleanly.
    if (supplierId) {
      const poMatches = await this.findOpenPOs(uid, supplierName, input.poNumber);
      if (poMatches.length === 1) {
        poId = poMatches[0].id;
      } else if (poMatches.length > 1) {
        allocationStatus = 'needs_review';
        reviewReason = `${poMatches.length} open POs match supplier ${supplierName}; pick the right one.`;
      } else if (input.poNumber || supplierName) {
        allocationStatus = 'po_missing';
      }
    }

    const saved = await this.receipts.save(this.receipts.create({
      ownerId: uid,
      kobepayReceiptId: input.kobepayReceiptId,
      kobepayBusinessId: input.kobepayBusinessId ?? '',
      customerPhone: input.customerPhone,
      customerName: input.customerName ?? '',
      supplierPhone: input.supplierPhone,
      supplierName,
      supplierId,
      poId,
      poNumber: input.poNumber ?? '',
      sentAmount: input.sentAmount,
      sentCurrency: input.sentCurrency ?? 'TZS',
      exchangeRate: input.exchangeRate ?? 0,
      supplierReceivedAmount: input.supplierReceivedAmount ?? 0,
      supplierCurrency: input.supplierCurrency ?? 'CNY',
      supplierCity: input.supplierCity ?? '',
      allocationStatus,
      reviewReason,
    }));

    await this.rbac.record(uid, ctx, 'receipt.import', 'kobepayReceipt', saved.id, {
      kobepayReceiptId: input.kobepayReceiptId,
      allocationStatus,
      supplierMatches: matches.length,
    });
    return saved;
  }

  /** Manually attach a receipt to one of the owner's suppliers. */
  async attachSupplier(uid: string, ctx: AuditContext, receiptId: string, supplierId: string) {
    this.rbac.ensure(ctx.user ?? null, 'receipt.match');
    const r = await this.get(uid, receiptId);
    const s = await this.suppliers.findOne({ where: { id: supplierId, ownerId: uid } });
    if (!s) throw new NotFoundException('Supplier not found under this account');
    r.supplierId = s.id;
    r.supplierName = s.name;
    r.allocationStatus = 'linked';
    r.reviewReason = '';
    const saved = await this.receipts.save(r);
    await this.rbac.record(uid, ctx, 'receipt.attachSupplier', 'kobepayReceipt', r.id, {
      supplierId, supplierName: s.name,
    });
    return saved;
  }

  /** Create a new supplier from the receipt data and attach it. */
  async createSupplierAndAttach(
    uid: string,
    ctx: AuditContext,
    receiptId: string,
    overrides?: { name?: string; country?: string },
  ) {
    this.rbac.ensure(ctx.user ?? null, 'supplier.create');
    const r = await this.get(uid, receiptId);
    const created = await this.suppliers.save(this.suppliers.create({
      ownerId: uid,
      name: overrides?.name ?? r.supplierName ?? `Supplier ${r.supplierPhone}`,
      phone: r.supplierPhone,
      country: overrides?.country ?? 'China',
      contact: '',
      balance: 0,
      orders: 0,
      status: 'Active',
    }));
    r.supplierId = created.id;
    r.supplierName = created.name;
    r.allocationStatus = 'linked';
    r.reviewReason = '';
    const saved = await this.receipts.save(r);
    await this.rbac.record(uid, ctx, 'receipt.createSupplierAndAttach', 'kobepayReceipt', r.id, {
      newSupplierId: created.id, name: created.name,
    });
    return saved;
  }

  /** Mark as expense — no supplier attribution needed. */
  async markExpense(uid: string, ctx: AuditContext, receiptId: string, notes?: string) {
    const r = await this.get(uid, receiptId);
    r.allocationStatus = 'expense';
    if (notes !== undefined) r.notes = notes;
    const saved = await this.receipts.save(r);
    await this.rbac.record(uid, ctx, 'receipt.markExpense', 'kobepayReceipt', r.id, { notes });
    return saved;
  }

  /** Park for later. */
  async defer(uid: string, ctx: AuditContext, receiptId: string) {
    const r = await this.get(uid, receiptId);
    r.allocationStatus = 'unallocated';
    const saved = await this.receipts.save(r);
    await this.rbac.record(uid, ctx, 'receipt.defer', 'kobepayReceipt', r.id, null);
    return saved;
  }

  /** Counts per status for the inbox header. */
  async summary(uid: string) {
    const all = await this.receipts.find({ where: { ownerId: uid } });
    return all.reduce<Record<string, number>>((acc, r) => {
      acc[r.allocationStatus] = (acc[r.allocationStatus] ?? 0) + 1;
      return acc;
    }, {});
  }

  private async findOpenPOs(uid: string, supplierName: string, poNumber?: string) {
    const rows = await this.purchaseOrders.find({ where: { ownerId: uid } });
    return rows.filter((p) => {
      if (p.status !== 'Pending' && p.status !== 'In Transit') return false;
      if (poNumber && p.poNumber === poNumber) return true;
      if (supplierName && p.supplier?.toLowerCase().includes(supplierName.toLowerCase())) return true;
      return false;
    });
  }
}
