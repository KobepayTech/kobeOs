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
}
