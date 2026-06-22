import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseOrder, Supplier, SupplierPayment } from './erp.entity';

export interface RecordPaymentDto {
  supplierId: string;
  amount: number;
  currency?: string;
  kind: 'PO_PAYMENT' | 'NEW_GOODS' | 'GENERAL';
  purchaseOrderId?: string;
  payoutId?: string;
  itemsSnapshot?: Array<{ description: string; quantity: number; unitPrice?: number }>;
  notes?: string;
}

export interface OpenPo {
  id: string;
  poNumber: string;
  total: number;
  paidAmount: number;
  outstanding: number;
  status: string;
  date?: string | null;
  itemCount: number;
}

/**
 * Records payments made to suppliers (typically a KobePay payout that
 * the operator has just initiated). Drives the "what was this payment
 * for?" prompt:
 *
 *   - PO_PAYMENT  → bumps PurchaseOrder.paidAmount, reduces outstanding
 *   - NEW_GOODS   → records the items the operator says they bought,
 *                   no PO existed yet
 *   - GENERAL     → supplier deposit / general payment
 *
 * Phone-based supplier matching:
 *   findByPhone(phone) normalises the input the same way as KobePay /
 *   Beem, so a payout dispatched to "0712 345 678" matches an ERP
 *   Supplier row stored as "+255712345678" or "712345678".
 */
@Injectable()
export class SupplierPaymentsService {
  private readonly logger = new Logger(SupplierPaymentsService.name);

  constructor(
    @InjectRepository(SupplierPayment) private readonly payments: Repository<SupplierPayment>,
    @InjectRepository(Supplier)         private readonly suppliers: Repository<Supplier>,
    @InjectRepository(PurchaseOrder)    private readonly pos: Repository<PurchaseOrder>,
  ) {}

  /** Normalize a phone the same way the rest of the system does so a
   *  KobePay payout phone matches an ERP Supplier row regardless of
   *  how the original was typed in. Returns null when the input has
   *  fewer than 7 digits (too short to be a real phone). */
  static normalizePhone(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length < 7) return null;
    if (digits.startsWith('255')) return digits;
    if (digits.startsWith('0')) return `255${digits.slice(1)}`;
    return digits;
  }

  async findByPhone(uid: string, phone: string): Promise<Supplier | null> {
    const target = SupplierPaymentsService.normalizePhone(phone);
    if (!target) return null;
    const all = await this.suppliers.find({ where: { ownerId: uid } });
    return all.find((s) => SupplierPaymentsService.normalizePhone(s.phone) === target) ?? null;
  }

  /** Open POs for a supplier — anything where paidAmount < total and
   *  status is not Cancelled. The reconciliation modal uses this list
   *  to show the operator which existing PO this payment might cover. */
  async listOpenPos(uid: string, supplierId: string): Promise<OpenPo[]> {
    const supplier = await this.suppliers.findOne({ where: { id: supplierId, ownerId: uid } });
    if (!supplier) return [];
    // PurchaseOrder.supplier is the name string (legacy schema), not an
    // FK to Supplier.id. Match by name for now.
    const candidates = await this.pos.find({
      where: { ownerId: uid, supplier: supplier.name },
      order: { date: 'DESC' },
    });
    return candidates
      .filter((p) => p.status !== 'Cancelled' && Number(p.paidAmount) < Number(p.total))
      .map((p) => ({
        id: p.id,
        poNumber: p.poNumber,
        total: Number(p.total),
        paidAmount: Number(p.paidAmount),
        outstanding: Number(p.total) - Number(p.paidAmount),
        status: p.status,
        date: p.date ?? null,
        itemCount: p.items?.length ?? 0,
      }));
  }

  /** List recent payments to a supplier — for the supplier detail
   *  drawer ("here's everything you've paid them"). */
  async listForSupplier(uid: string, supplierId: string): Promise<SupplierPayment[]> {
    return this.payments.find({
      where: { ownerId: uid, supplierId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async record(uid: string, dto: RecordPaymentDto): Promise<SupplierPayment> {
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('amount must be a positive number');
    }
    const supplier = await this.suppliers.findOne({ where: { id: dto.supplierId, ownerId: uid } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    if (dto.kind === 'PO_PAYMENT' && !dto.purchaseOrderId) {
      throw new BadRequestException('purchaseOrderId is required when kind=PO_PAYMENT');
    }
    let po: PurchaseOrder | null = null;
    if (dto.purchaseOrderId) {
      po = await this.pos.findOne({ where: { id: dto.purchaseOrderId, ownerId: uid } });
      if (!po) throw new NotFoundException('Purchase order not found');
      if (po.status === 'Cancelled') throw new BadRequestException('PO is cancelled');
      const outstanding = Number(po.total) - Number(po.paidAmount);
      if (dto.amount > outstanding + 0.0001) {
        throw new BadRequestException(
          `Amount ${dto.amount} exceeds PO outstanding ${outstanding.toFixed(2)} — record as a separate GENERAL payment if intentional`,
        );
      }
    }

    const saved = await this.payments.save(this.payments.create({
      ownerId: uid,
      supplierId: supplier.id,
      supplierName: supplier.name,
      amount: dto.amount,
      currency: dto.currency ?? 'TZS',
      kind: dto.kind,
      purchaseOrderId: po?.id ?? null,
      payoutId: dto.payoutId ?? null,
      itemsSnapshot: dto.itemsSnapshot ?? null,
      notes: dto.notes ?? '',
      paidAt: new Date(),
    }));

    if (po) {
      po.paidAmount = parseFloat((Number(po.paidAmount) + Number(dto.amount)).toFixed(4));
      await this.pos.save(po);
      this.logger.log(
        `SupplierPayment ${saved.id}: PO ${po.poNumber} paidAmount → ${po.paidAmount} of ${po.total}`,
      );
    }
    return saved;
  }

  /** Promote a NEW_GOODS SupplierPayment into a formal PurchaseOrder.
   *  Convenient when an operator records a quick payment for goods
   *  bought ad-hoc and later wants to back-fill a proper PO (e.g.
   *  for the warehouse picklist or supplier-side audit). The
   *  resulting PO inherits the payment's items + amount and is
   *  immediately marked fully paid by linking the original payment
   *  to it. Idempotent: a payment that's already PO-linked just
   *  returns the existing PO. */
  async promoteToPo(
    uid: string,
    paymentId: string,
    overrides?: { poNumber?: string; status?: PurchaseOrder['status']; date?: string; deliveryDate?: string },
  ): Promise<{ payment: SupplierPayment; po: PurchaseOrder; created: boolean }> {
    const payment = await this.payments.findOne({ where: { id: paymentId, ownerId: uid } });
    if (!payment) throw new NotFoundException('Supplier payment not found');

    if (payment.purchaseOrderId) {
      const existing = await this.pos.findOne({ where: { id: payment.purchaseOrderId, ownerId: uid } });
      if (existing) return { payment, po: existing, created: false };
    }

    if (payment.kind !== 'NEW_GOODS') {
      throw new BadRequestException(
        `Only NEW_GOODS payments can be promoted to a PO (this one is ${payment.kind})`,
      );
    }
    const items = payment.itemsSnapshot ?? [];
    if (items.length === 0) {
      throw new BadRequestException('Payment has no item snapshot — nothing to promote');
    }
    const supplier = await this.suppliers.findOne({ where: { id: payment.supplierId, ownerId: uid } });
    if (!supplier) throw new NotFoundException('Supplier no longer exists');

    const poNumber = overrides?.poNumber?.trim()
      || `PO-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${paymentId.slice(0, 6).toUpperCase()}`;
    const total = items.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice || 0), 0);
    const po = await this.pos.save(this.pos.create({
      ownerId: uid,
      poNumber,
      supplier: supplier.name,
      total: parseFloat(total.toFixed(4)),
      paidAmount: Number(payment.amount),
      status: overrides?.status ?? 'Delivered',
      date: overrides?.date ?? new Date().toISOString().slice(0, 10),
      deliveryDate: overrides?.deliveryDate ?? null,
      items: items.map((l) => ({
        name: l.description,
        qty: Number(l.quantity),
        price: Number(l.unitPrice || 0),
      })),
    }));

    payment.kind = 'PO_PAYMENT';
    payment.purchaseOrderId = po.id;
    await this.payments.save(payment);

    this.logger.log(
      `Promoted SupplierPayment ${payment.id} → ${po.poNumber} (${items.length} item${items.length === 1 ? '' : 's'}, total ${po.total})`,
    );
    return { payment, po, created: true };
  }

  /** Bulk-promote multiple NEW_GOODS payments in a single call. Skips
   *  rows that aren't eligible (already linked, wrong kind, no
   *  snapshot) and reports a per-row result so the UI can show a
   *  "created X, skipped Y" summary. Doesn't bail on the first
   *  error — each row is independent. */
  async promoteManyToPos(
    uid: string,
    paymentIds: string[],
    overrides?: { status?: PurchaseOrder['status']; date?: string },
  ): Promise<Array<{ paymentId: string; ok: boolean; po?: PurchaseOrder; created?: boolean; error?: string }>> {
    const results: Array<{ paymentId: string; ok: boolean; po?: PurchaseOrder; created?: boolean; error?: string }> = [];
    for (const id of paymentIds) {
      try {
        const { po, created } = await this.promoteToPo(uid, id, overrides);
        results.push({ paymentId: id, ok: true, po, created });
      } catch (err) {
        results.push({ paymentId: id, ok: false, error: (err as Error).message });
      }
    }
    return results;
  }
}
