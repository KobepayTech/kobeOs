import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { ErpKobepayInbox, ErpKobepayInboxStatus, ErpKobepayProvider } from './erp-kobepay-inbox.entity';
import { PurchaseOrder, Supplier } from './erp.entity';

export interface InboundReceipt {
  kobepayReceiptId: string;
  kobepayBusinessName?: string;
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
export class ErpKobepayInboxService {
  constructor(
    @InjectRepository(ErpKobepayProvider) private readonly providers: Repository<ErpKobepayProvider>,
    @InjectRepository(ErpKobepayInbox) private readonly inbox: Repository<ErpKobepayInbox>,
    @InjectRepository(Supplier) private readonly suppliers: Repository<Supplier>,
    @InjectRepository(PurchaseOrder) private readonly purchaseOrders: Repository<PurchaseOrder>,
  ) {}

  /* ─── Provider management (the ERP owner controls who can push) ─── */

  listProviders(uid: string) {
    return this.providers.find({ where: { ownerId: uid }, order: { name: 'ASC' } });
  }

  async createProvider(uid: string, dto: { name: string; contactEmail?: string; notes?: string }) {
    if (!dto.name?.trim()) throw new BadRequestException('Provider name required');
    const apiKey = `erp-kbp_${randomBytes(24).toString('hex')}`;
    return this.providers.save(this.providers.create({
      ownerId: uid, name: dto.name.trim(), apiKey, active: true,
      contactEmail: dto.contactEmail ?? '', notes: dto.notes ?? '',
    }));
  }

  async toggleProvider(uid: string, id: string, active: boolean) {
    const p = await this.providers.findOne({ where: { id, ownerId: uid } });
    if (!p) throw new NotFoundException();
    p.active = active;
    return this.providers.save(p);
  }

  async deleteProvider(uid: string, id: string) {
    const p = await this.providers.findOne({ where: { id, ownerId: uid } });
    if (!p) throw new NotFoundException();
    await this.providers.remove(p);
    return { id };
  }

  /* ─── Inbound webhook (called by the KobePay install) ─── */

  /**
   * Authenticate by the apiKey on the Authorization header and resolve
   * which ERP owner this receipt belongs to. Returns the provider row
   * so the caller knows ownerId + providerId for the ingest call.
   */
  async authenticate(bearer: string | undefined): Promise<ErpKobepayProvider> {
    if (!bearer?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');
    const token = bearer.slice(7).trim();
    const provider = await this.providers.findOne({ where: { apiKey: token, active: true } });
    if (!provider) throw new UnauthorizedException('Invalid or revoked provider key');
    return provider;
  }

  /**
   * Idempotently ingest a receipt under the authenticated provider's
   * ERP owner. Runs the safe scoped match:
   *   1. suppliers WHERE ownerId = provider.ownerId AND phone = supplierPhone
   *      - 0 found → allocationStatus 'supplier_missing'
   *      - 1 found → 'linked' + tries owner-scoped PO match
   *      - >1 found → 'needs_review' refuses to guess
   *   2. PO match only attempted after a clean supplier link.
   */
  async ingest(provider: ErpKobepayProvider, input: InboundReceipt) {
    const uid = provider.ownerId;
    const existing = await this.inbox.findOne({
      where: { ownerId: uid, kobepayReceiptId: input.kobepayReceiptId },
    });
    if (existing) return existing;

    const matches = await this.suppliers.find({
      where: { ownerId: uid, phone: input.supplierPhone },
    });

    let supplierId: string | null = null;
    let supplierName = input.supplierName ?? '';
    let allocationStatus: ErpKobepayInboxStatus = 'supplier_missing';
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

    return this.inbox.save(this.inbox.create({
      ownerId: uid,
      providerId: provider.id,
      kobepayReceiptId: input.kobepayReceiptId,
      kobepayBusinessName: input.kobepayBusinessName ?? provider.name,
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
  }

  /* ─── Resolution (the ERP owner manages their own inbox) ─── */

  list(uid: string, status?: ErpKobepayInboxStatus) {
    return this.inbox.find({
      where: status ? { ownerId: uid, allocationStatus: status } : { ownerId: uid },
      order: { createdAt: 'DESC' },
    });
  }

  async get(uid: string, id: string) {
    const r = await this.inbox.findOne({ where: { id, ownerId: uid } });
    if (!r) throw new NotFoundException();
    return r;
  }

  summary(uid: string) {
    return this.inbox.find({ where: { ownerId: uid } }).then((all) =>
      all.reduce<Record<string, number>>((acc, r) => {
        acc[r.allocationStatus] = (acc[r.allocationStatus] ?? 0) + 1;
        return acc;
      }, {}),
    );
  }

  async attachSupplier(uid: string, receiptId: string, supplierId: string) {
    const r = await this.get(uid, receiptId);
    const s = await this.suppliers.findOne({ where: { id: supplierId, ownerId: uid } });
    if (!s) throw new NotFoundException('Supplier not found under this account');
    r.supplierId = s.id;
    r.supplierName = s.name;
    r.allocationStatus = 'linked';
    r.reviewReason = '';
    return this.inbox.save(r);
  }

  async createSupplierAndAttach(uid: string, receiptId: string, overrides?: { name?: string; country?: string }) {
    const r = await this.get(uid, receiptId);
    const created = await this.suppliers.save(this.suppliers.create({
      ownerId: uid,
      name: overrides?.name ?? r.supplierName ?? `Supplier ${r.supplierPhone}`,
      phone: r.supplierPhone,
      country: overrides?.country ?? 'China',
      contact: '',
      rating: 0,
      status: 'Active',
    }));
    r.supplierId = created.id;
    r.supplierName = created.name;
    r.allocationStatus = 'linked';
    r.reviewReason = '';
    return this.inbox.save(r);
  }

  async markExpense(uid: string, receiptId: string, notes?: string) {
    const r = await this.get(uid, receiptId);
    r.allocationStatus = 'expense';
    if (notes !== undefined) r.notes = notes;
    return this.inbox.save(r);
  }

  async defer(uid: string, receiptId: string) {
    const r = await this.get(uid, receiptId);
    r.allocationStatus = 'unallocated';
    return this.inbox.save(r);
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
