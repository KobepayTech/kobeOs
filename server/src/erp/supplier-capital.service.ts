import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
  ErpKobePayLink,
  ErpKobePaySupplierReceipt,
  ErpPurchaseOrder,
  ErpSupplier,
  ErpSupplierCapitalLedger,
} from './supplier-capital.entity';
import {
  CreateKobePayLinkDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  KobePaySupplierReceiptWebhookDto,
} from './dto/supplier-capital.dto';

const UNMATCHED_KOBEPAY_OWNER_ID = '00000000-0000-0000-0000-000000000000';

function n(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePhone(phone: string) {
  return (phone || '').replace(/\s+/g, '').replace(/[()\-]/g, '');
}

@Injectable()
export class SupplierCapitalService {
  constructor(
    @InjectRepository(ErpKobePayLink) private readonly linksRepo: Repository<ErpKobePayLink>,
    @InjectRepository(ErpSupplier) private readonly suppliersRepo: Repository<ErpSupplier>,
    @InjectRepository(ErpPurchaseOrder) private readonly poRepo: Repository<ErpPurchaseOrder>,
    @InjectRepository(ErpKobePaySupplierReceipt) private readonly receiptsRepo: Repository<ErpKobePaySupplierReceipt>,
    @InjectRepository(ErpSupplierCapitalLedger) private readonly ledgerRepo: Repository<ErpSupplierCapitalLedger>,
  ) {}

  listLinks(ownerId: string) {
    return this.linksRepo.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  createLink(ownerId: string, dto: CreateKobePayLinkDto) {
    return this.linksRepo.save(this.linksRepo.create({
      ...dto,
      ownerId,
      customerPhone: normalizePhone(dto.customerPhone),
      status: dto.status ?? 'active',
    }));
  }

  listSuppliers(ownerId: string) {
    return this.suppliersRepo.find({ where: { ownerId }, order: { name: 'ASC' } });
  }

  createSupplier(ownerId: string, dto: CreateSupplierDto) {
    return this.suppliersRepo.save(this.suppliersRepo.create({
      ...dto,
      ownerId,
      phone: normalizePhone(dto.phone ?? ''),
      country: dto.country ?? 'CN',
      currency: dto.currency ?? 'CNY',
    }));
  }

  listPurchaseOrders(ownerId: string, supplierId?: string) {
    return this.poRepo.find({
      where: supplierId ? { ownerId, supplierId } : { ownerId },
      order: { createdAt: 'DESC' },
    });
  }

  async createPurchaseOrder(ownerId: string, dto: CreatePurchaseOrderDto) {
    const po = this.poRepo.create({
      ownerId,
      poNumber: dto.poNumber,
      supplierId: dto.supplierId,
      totalCny: dto.totalCny,
      paidCny: 0,
      remainingCny: dto.totalCny,
      status: 'open',
      expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
      notes: dto.notes ?? '',
    });
    return this.poRepo.save(po);
  }

  async importKobePayReceipt(dto: KobePaySupplierReceiptWebhookDto) {
    const existing = await this.receiptsRepo.findOne({ where: { kobepayReceiptId: dto.receiptId } });
    if (existing) return { duplicate: true, receipt: existing };

    const ownerId = await this.resolveOwner(dto.kobepayBusinessId, dto.customerPhone, dto.kobepayUserId);
    if (!ownerId) {
      const receipt = await this.receiptsRepo.save(this.receiptsRepo.create({
        ownerId: UNMATCHED_KOBEPAY_OWNER_ID,
        kobepayReceiptId: dto.receiptId,
        kobepayBusinessId: dto.kobepayBusinessId,
        kobepayUserId: dto.kobepayUserId ?? '',
        customerPhone: normalizePhone(dto.customerPhone),
        supplierPhone: normalizePhone(dto.supplierPhone),
        supplierName: dto.supplierName ?? '',
        sentAmount: dto.sentAmount,
        sentCurrency: dto.sentCurrency,
        exchangeRate: dto.exchangeRate,
        supplierReceivedAmount: dto.supplierReceivedAmount,
        supplierCurrency: dto.supplierCurrency ?? 'CNY',
        feeAmount: dto.feeAmount ?? 0,
        feeCurrency: dto.feeCurrency ?? dto.sentCurrency,
        purpose: dto.purpose ?? 'supplier_payment',
        allocationStatus: 'unallocated',
        actionRequired: 'review',
        paidAt: new Date(dto.paidAt),
        notes: `ERP user link missing. ${dto.notes ?? ''}`.trim(),
      }));
      return { duplicate: false, ownerMatched: false, receipt };
    }

    const supplierPhone = normalizePhone(dto.supplierPhone);
    const suppliers = await this.suppliersRepo.find({ where: { ownerId, phone: supplierPhone } });
    let supplierId: string | null = null;
    let poId: string | null = null;
    let allocationStatus: ErpKobePaySupplierReceipt['allocationStatus'] = 'supplier_missing';
    let actionRequired: ErpKobePaySupplierReceipt['actionRequired'] = 'needs_supplier';

    if (suppliers.length === 1) {
      supplierId = suppliers[0].id;
      const openPos = await this.poRepo.find({
        where: [
          { ownerId, supplierId, status: 'open' },
          { ownerId, supplierId, status: 'partial' },
        ],
      });
      if (openPos.length === 1) {
        poId = openPos[0].id;
        allocationStatus = 'linked';
        actionRequired = 'none';
      } else if (openPos.length > 1) {
        allocationStatus = 'multiple_pos';
        actionRequired = 'choose_po';
      } else {
        allocationStatus = 'po_missing';
        actionRequired = 'needs_po';
      }
    } else if (suppliers.length > 1) {
      allocationStatus = 'multiple_suppliers';
      actionRequired = 'choose_supplier';
    }

    const receipt = await this.receiptsRepo.save(this.receiptsRepo.create({
      ownerId,
      kobepayReceiptId: dto.receiptId,
      kobepayBusinessId: dto.kobepayBusinessId,
      kobepayUserId: dto.kobepayUserId ?? '',
      customerPhone: normalizePhone(dto.customerPhone),
      supplierPhone,
      supplierName: dto.supplierName ?? '',
      supplierId,
      poId,
      sentAmount: dto.sentAmount,
      sentCurrency: dto.sentCurrency,
      exchangeRate: dto.exchangeRate,
      supplierReceivedAmount: dto.supplierReceivedAmount,
      supplierCurrency: dto.supplierCurrency ?? 'CNY',
      feeAmount: dto.feeAmount ?? 0,
      feeCurrency: dto.feeCurrency ?? dto.sentCurrency,
      purpose: dto.purpose ?? 'supplier_payment',
      allocationStatus,
      actionRequired,
      paidAt: new Date(dto.paidAt),
      notes: dto.notes ?? '',
    }));

    await this.createLedgerForReceipt(receipt);
    if (poId) await this.recalculatePo(ownerId, poId);
    return { duplicate: false, ownerMatched: true, receipt };
  }

  async attachSupplier(ownerId: string, receiptId: string, supplierId: string) {
    const receipt = await this.getReceipt(ownerId, receiptId);
    const supplier = await this.suppliersRepo.findOne({ where: { ownerId, id: supplierId } });
    if (!supplier) throw new NotFoundException('Supplier not found for this ERP user');
    const openPos = await this.poRepo.find({
      where: [
        { ownerId, supplierId, status: 'open' },
        { ownerId, supplierId, status: 'partial' },
      ],
    });
    receipt.supplierId = supplier.id;
    if (openPos.length === 1) {
      receipt.poId = openPos[0].id;
      receipt.allocationStatus = 'linked';
      receipt.actionRequired = 'none';
    } else if (openPos.length > 1) {
      receipt.allocationStatus = 'multiple_pos';
      receipt.actionRequired = 'choose_po';
    } else {
      receipt.allocationStatus = 'po_missing';
      receipt.actionRequired = 'needs_po';
    }
    const saved = await this.receiptsRepo.save(receipt);
    await this.createLedgerForReceipt(saved);
    if (saved.poId) await this.recalculatePo(ownerId, saved.poId);
    return saved;
  }

  async attachPo(ownerId: string, receiptId: string, poId: string) {
    const receipt = await this.getReceipt(ownerId, receiptId);
    const po = await this.poRepo.findOne({ where: { ownerId, id: poId } });
    if (!po) throw new NotFoundException('PO not found for this ERP user');
    if (receipt.supplierId && po.supplierId !== receipt.supplierId) {
      throw new ConflictException('PO belongs to a different supplier');
    }
    receipt.poId = po.id;
    receipt.supplierId = receipt.supplierId ?? po.supplierId;
    receipt.allocationStatus = 'linked';
    receipt.actionRequired = 'none';
    const saved = await this.receiptsRepo.save(receipt);
    await this.createLedgerForReceipt(saved);
    await this.recalculatePo(ownerId, po.id);
    return saved;
  }

  async markReceipt(ownerId: string, receiptId: string, status: 'advance' | 'expense' | 'freight' | 'ignored', notes?: string) {
    const receipt = await this.getReceipt(ownerId, receiptId);
    receipt.allocationStatus = status;
    receipt.actionRequired = 'none';
    receipt.notes = notes ?? receipt.notes;
    const saved = await this.receiptsRepo.save(receipt);
    await this.createLedgerForReceipt(saved);
    return saved;
  }

  listReceipts(ownerId: string, status?: string) {
    return this.receiptsRepo.find({
      where: status ? { ownerId, allocationStatus: status as ErpKobePaySupplierReceipt['allocationStatus'] } : { ownerId },
      order: { paidAt: 'DESC' },
    });
  }

  listNeedsAction(ownerId: string) {
    return this.receiptsRepo.find({
      where: [
        { ownerId, actionRequired: 'needs_supplier' },
        { ownerId, actionRequired: 'needs_po' },
        { ownerId, actionRequired: 'choose_supplier' },
        { ownerId, actionRequired: 'choose_po' },
        { ownerId, actionRequired: 'review' },
      ],
      order: { paidAt: 'DESC' },
    });
  }

  async summary(ownerId: string) {
    const [receipts, pos, suppliers] = await Promise.all([
      this.receiptsRepo.find({ where: { ownerId } }),
      this.poRepo.find({ where: { ownerId } }),
      this.suppliersRepo.find({ where: { ownerId } }),
    ]);
    const linked = receipts.filter((r) => r.allocationStatus === 'linked');
    const needsAction = receipts.filter((r) => r.actionRequired !== 'none');
    return {
      totalSentUsd: receipts.filter((r) => r.sentCurrency === 'USD').reduce((s, r) => s + n(r.sentAmount), 0),
      totalSentTzs: receipts.filter((r) => r.sentCurrency === 'TZS').reduce((s, r) => s + n(r.sentAmount), 0),
      totalSupplierReceivedCny: receipts.reduce((s, r) => s + n(r.supplierReceivedAmount), 0),
      linkedCny: linked.reduce((s, r) => s + n(r.supplierReceivedAmount), 0),
      unallocatedCny: receipts.filter((r) => r.allocationStatus !== 'linked').reduce((s, r) => s + n(r.supplierReceivedAmount), 0),
      remainingPoCny: pos.reduce((s, p) => s + n(p.remainingCny), 0),
      receipts: receipts.length,
      suppliers: suppliers.length,
      purchaseOrders: pos.length,
      needsAction: needsAction.length,
      redQuestionItems: needsAction.map((r) => ({
        id: r.id,
        receiptId: r.kobepayReceiptId,
        supplierPhone: r.supplierPhone,
        supplierName: r.supplierName,
        cnyAmount: n(r.supplierReceivedAmount),
        status: r.allocationStatus,
        actionRequired: r.actionRequired,
      })),
      bySupplier: suppliers.map((supplier) => {
        const supplierReceipts = receipts.filter((r) => r.supplierId === supplier.id);
        const supplierPos = pos.filter((p) => p.supplierId === supplier.id);
        return {
          supplierId: supplier.id,
          supplierName: supplier.name,
          paidCny: supplierReceipts.reduce((s, r) => s + n(r.supplierReceivedAmount), 0),
          poTotalCny: supplierPos.reduce((s, p) => s + n(p.totalCny), 0),
          remainingCny: supplierPos.reduce((s, p) => s + n(p.remainingCny), 0),
          status: supplierPos.every((p) => p.status === 'paid') && supplierPos.length ? 'paid' : 'partial',
        };
      }),
    };
  }

  private async resolveOwner(kobepayBusinessId: string, customerPhone: string, kobepayUserId?: string) {
    const phone = normalizePhone(customerPhone);
    const where: FindOptionsWhere<ErpKobePayLink>[] = kobepayUserId
      ? [
          { kobepayBusinessId, kobepayUserId, status: 'active' },
          { kobepayBusinessId, customerPhone: phone, status: 'active' },
        ]
      : [{ kobepayBusinessId, customerPhone: phone, status: 'active' }];
    const links = await this.linksRepo.find({ where });
    if (links.length !== 1) return null;
    return links[0].ownerId;
  }

  private async getReceipt(ownerId: string, id: string) {
    const receipt = await this.receiptsRepo.findOne({ where: { ownerId, id } });
    if (!receipt) throw new NotFoundException('Receipt not found for this ERP user');
    return receipt;
  }

  private async createLedgerForReceipt(receipt: ErpKobePaySupplierReceipt) {
    const existing = await this.ledgerRepo.findOne({ where: { ownerId: receipt.ownerId, receiptId: receipt.id } });
    const entryType = receipt.allocationStatus === 'linked'
      ? 'po_payment'
      : receipt.allocationStatus === 'expense'
        ? 'expense'
        : receipt.allocationStatus === 'freight'
          ? 'freight'
          : 'supplier_advance';
    const payload = {
      ownerId: receipt.ownerId,
      supplierId: receipt.supplierId ?? null,
      receiptId: receipt.id,
      poId: receipt.poId ?? null,
      source: 'kobepay_receipt' as const,
      entryType,
      sentAmount: receipt.sentAmount,
      sentCurrency: receipt.sentCurrency,
      cnyAmount: receipt.supplierReceivedAmount,
      cnyCurrency: receipt.supplierCurrency,
      description: `KobePay ${receipt.kobepayReceiptId} ${receipt.allocationStatus}`,
    };
    if (existing) return this.ledgerRepo.save({ ...existing, ...payload });
    return this.ledgerRepo.save(this.ledgerRepo.create(payload));
  }

  private async recalculatePo(ownerId: string, poId: string) {
    const po = await this.poRepo.findOne({ where: { ownerId, id: poId } });
    if (!po) return;
    const linkedReceipts = await this.receiptsRepo.find({ where: { ownerId, poId, allocationStatus: 'linked' } });
    po.paidCny = linkedReceipts.reduce((sum, receipt) => sum + n(receipt.supplierReceivedAmount), 0);
    po.remainingCny = Math.max(0, n(po.totalCny) - n(po.paidCny));
    po.status = po.remainingCny <= 0 ? 'paid' : po.paidCny > 0 ? 'partial' : 'open';
    await this.poRepo.save(po);
  }
}
