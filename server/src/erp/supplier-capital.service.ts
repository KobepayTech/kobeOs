import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { PosProduct, ProductSourceType } from '../pos/pos.entity';
import {
  ErpKobePayLink,
  ErpKobePaySupplierReceipt,
  ErpPurchaseOrder,
  ErpPurchaseOrderItem,
  ErpSupplier,
  ErpSupplierCapitalLedger,
} from './supplier-capital.entity';
import {
  CreateKobePayLinkDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  KobePaySupplierReceiptWebhookDto,
  ReceivePurchaseOrderDto,
} from './dto/supplier-capital.dto';

const UNMATCHED_KOBEPAY_OWNER_ID = '00000000-0000-0000-0000-000000000000';

function n(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePhone(phone: string) {
  return (phone || '').replace(/\s+/g, '').replace(/[()-]/g, '');
}

const isUuid = (value: string | undefined): value is string =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function normalizePoItems(value: unknown): ErpPurchaseOrderItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? '').trim();
    const qty = n(row.qty);
    if (!name || qty <= 0) return [];
    return [{
      name,
      qty,
      price: Math.max(0, n(row.price)),
      ...(n(row.sellPrice) > 0 ? { sellPrice: n(row.sellPrice) } : {}),
      ...(String(row.sku ?? '').trim() ? { sku: String(row.sku).trim() } : {}),
      ...(String(row.category ?? '').trim() ? { category: String(row.category).trim() } : {}),
      ...(String(row.currency ?? '').trim() ? { currency: String(row.currency).trim() } : {}),
      ...(n(row.receivedQty) > 0 ? { receivedQty: n(row.receivedQty) } : {}),
      ...(n(row.damagedQty) > 0 ? { damagedQty: n(row.damagedQty) } : {}),
      ...(isUuid(String(row.productId ?? '')) ? { productId: String(row.productId) } : {}),
    } satisfies ErpPurchaseOrderItem];
  });
}

function parsePoMeta(notes?: string): { items: ErpPurchaseOrderItem[]; transportCost?: number } {
  const match = (notes ?? '').match(/(?:^|\n)kobeos-po-meta:(\{[\s\S]*?\})(?:\n|$)/);
  if (!match) return { items: [] };
  try {
    const meta = JSON.parse(match[1]) as Record<string, unknown>;
    return {
      items: normalizePoItems(meta.lines),
      transportCost: n(meta.transportCost),
    };
  } catch {
    return { items: [] };
  }
}

function poItems(po: ErpPurchaseOrder): ErpPurchaseOrderItem[] {
  const stored = normalizePoItems(po.items);
  return stored.length > 0 ? stored : parsePoMeta(po.notes).items;
}

function poTransportCost(po: ErpPurchaseOrder): number {
  const stored = n(po.transportCost);
  return stored > 0 ? stored : n(parsePoMeta(po.notes).transportCost);
}

@Injectable()
export class SupplierCapitalService {
  constructor(
    @InjectRepository(ErpKobePayLink) private readonly linksRepo: Repository<ErpKobePayLink>,
    @InjectRepository(ErpSupplier) private readonly suppliersRepo: Repository<ErpSupplier>,
    @InjectRepository(ErpPurchaseOrder) private readonly poRepo: Repository<ErpPurchaseOrder>,
    @InjectRepository(ErpKobePaySupplierReceipt) private readonly receiptsRepo: Repository<ErpKobePaySupplierReceipt>,
    @InjectRepository(ErpSupplierCapitalLedger) private readonly ledgerRepo: Repository<ErpSupplierCapitalLedger>,
    @InjectRepository(PosProduct) private readonly productsRepo: Repository<PosProduct>,
    private readonly dataSource: DataSource,
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

  async listPurchaseOrders(ownerId: string, supplierId?: string) {
    const pos = await this.poRepo.find({
      where: supplierId ? { ownerId, supplierId } : { ownerId },
      order: { createdAt: 'DESC' },
    });
    const supplierIds = Array.from(new Set(pos.map((po) => po.supplierId).filter((id): id is string => !!id)));
    const suppliers = supplierIds.length
      ? await this.suppliersRepo.find({ where: supplierIds.map((id) => ({ ownerId, id })) })
      : [];
    const supplierNames = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
    return pos.map((po) => ({
      ...po,
      items: poItems(po),
      transportCost: poTransportCost(po),
      supplierName: po.supplierId ? supplierNames.get(po.supplierId) ?? '' : '',
      inventoryStatus: po.inventoryStatus ?? 'PENDING',
    }));
  }

  async createPurchaseOrder(ownerId: string, dto: CreatePurchaseOrderDto) {
    const legacyMeta = parsePoMeta(dto.notes);
    const items = normalizePoItems(dto.items?.length ? dto.items : legacyMeta.items);
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
      items,
      transportCost: dto.transportCost ?? legacyMeta.transportCost ?? 0,
      inventoryStatus: 'PENDING',
      receivedAt: null,
    });
    return this.poRepo.save(po);
  }

  /**
   * Receive a PO into the POS catalogue. New SKUs are created with source
   * PO; an existing SKU is replenished without changing its original source.
   * The PO row is locked in a transaction, so repeated taps or two receiving
   * screens cannot add the same quantity twice.
   */
  async receivePurchaseOrder(ownerId: string, poId: string, dto: ReceivePurchaseOrderDto) {
    if (!isUuid(poId)) throw new NotFoundException('Purchase order not found for this ERP user');
    return this.dataSource.transaction(async (manager) => {
      const poRepository = manager.getRepository(ErpPurchaseOrder);
      const productRepository = manager.getRepository(PosProduct);
      const supplierRepository = manager.getRepository(ErpSupplier);
      const po = await poRepository
        .createQueryBuilder('po')
        .setLock('pessimistic_write')
        .where('po.id = :poId AND po.ownerId = :ownerId', { poId, ownerId })
        .getOne();
      if (!po) throw new NotFoundException('Purchase order not found for this ERP user');
      if (po.status === 'cancelled') throw new ConflictException('Cancelled purchase orders cannot be received');

      const items = poItems(po);
      if (items.length === 0) {
        throw new BadRequestException('This PO has no structured line items. Edit the PO and add products before receiving it.');
      }

      const supplier = po.supplierId
        ? await supplierRepository.findOne({ where: { ownerId, id: po.supplierId } })
        : null;
      const transportCost = dto.transportCost !== undefined ? n(dto.transportCost) : poTransportCost(po);
      const totalOrderedQty = items.reduce((sum, item) => sum + n(item.qty), 0);
      const freightPerUnit = totalOrderedQty > 0 ? transportCost / totalOrderedQty : 0;
      const requested = new Map<number, { quantityReceived: number; damagedQuantity: number }>();
      for (const line of dto.lines ?? []) {
        if (!Number.isInteger(line.lineIndex) || line.lineIndex < 0 || line.lineIndex >= items.length) {
          throw new BadRequestException(`Invalid PO line index: ${line.lineIndex}`);
        }
        const prior = requested.get(line.lineIndex) ?? { quantityReceived: 0, damagedQuantity: 0 };
        requested.set(line.lineIndex, {
          quantityReceived: prior.quantityReceived + n(line.quantityReceived),
          damagedQuantity: prior.damagedQuantity + n(line.damagedQuantity),
        });
      }

      const received: Array<{
        lineIndex: number;
        productId: string;
        stockAdded: number;
        damagedQuantity: number;
        unitCost: number;
      }> = [];
      const epsilon = 0.0001;

      for (let lineIndex = 0; lineIndex < items.length; lineIndex += 1) {
        const item = items[lineIndex];
        const alreadyReceived = n(item.receivedQty);
        const alreadyDamaged = n(item.damagedQty);
        const remaining = Math.max(0, n(item.qty) - alreadyReceived - alreadyDamaged);
        if (remaining <= epsilon) continue;

        const lineRequest = requested.get(lineIndex);
        const quantityReceived = dto.lines ? n(lineRequest?.quantityReceived) : remaining;
        const damagedQuantity = dto.lines ? n(lineRequest?.damagedQuantity) : 0;
        if (quantityReceived + damagedQuantity > remaining + epsilon) {
          throw new BadRequestException(
            `${item.name}: receiving ${quantityReceived + damagedQuantity} but only ${remaining} remains on the PO`,
          );
        }
        if (quantityReceived <= epsilon && damagedQuantity <= epsilon) continue;

        const unitCost = n(item.price) + freightPerUnit;
        const sku = String(item.sku ?? '').trim() || `PO-${po.poNumber}-${lineIndex + 1}`;
        let product: PosProduct | null = null;
        if (isUuid(item.productId)) {
          product = await productRepository.findOne({ where: { ownerId, id: item.productId } });
        }
        if (!product) {
          product = await productRepository.findOne({ where: { ownerId, sku } });
        }
        // When the operator did not provide a SKU, an exact name match is a
        // useful replenishment path for a product that entered through Quick
        // Add. A supplied SKU remains authoritative, so distinct SKUs with
        // the same display name are never merged accidentally.
        if (!product && !String(item.sku ?? '').trim()) {
          product = await productRepository.findOne({ where: { ownerId, name: item.name } });
        }

        const salesCurrency = item.currency || 'TZS';
        const purchaseCurrency = supplier?.currency || salesCurrency;
        if (product) {
          const customData = product.customData && typeof product.customData === 'object' ? product.customData : {};
          const previousPoIds = Array.isArray(customData.purchaseOrderIds)
            ? customData.purchaseOrderIds.filter((id): id is string => typeof id === 'string')
            : [];
          product.stock = n(product.stock) + quantityReceived;
          product.cost = unitCost;
          if (!product.supplier && supplier) product.supplier = supplier.name;
          if (n(product.price) <= 0 && n(item.sellPrice) > 0) product.price = n(item.sellPrice);
          product.customData = {
            ...customData,
            purchaseOrderId: po.id,
            purchaseOrderNumber: po.poNumber,
            purchaseOrderIds: Array.from(new Set([...previousPoIds, po.id])),
            lastReceivedAt: new Date().toISOString(),
            purchaseCurrency,
          };
        } else {
          product = productRepository.create({
            ownerId,
            sku,
            name: item.name,
            description: `Received from PO ${po.poNumber}${supplier ? ` · ${supplier.name}` : ''}`,
            category: item.category || '',
            supplier: supplier?.name ?? null,
            price: n(item.sellPrice) > 0 ? n(item.sellPrice) : unitCost,
            cost: unitCost,
            currency: salesCurrency,
            unit: 'piece',
            decimalQuantity: false,
            stock: quantityReceived,
            reservedStock: 0,
            estimatedStock: 0,
            sourceType: 'PO' satisfies ProductSourceType,
            imageUrls: [],
            variants: [],
            tags: [],
            customData: {
              purchaseOrderId: po.id,
              purchaseOrderNumber: po.poNumber,
              purchaseOrderLine: lineIndex,
              purchaseCurrency,
              lastReceivedAt: new Date().toISOString(),
            },
            active: true,
            featured: false,
            publishedAt: new Date(),
            unitsSold: 0,
          });
        }

        const savedProduct = await productRepository.save(product);
        item.receivedQty = alreadyReceived + quantityReceived;
        item.damagedQty = alreadyDamaged + damagedQuantity;
        item.productId = savedProduct.id;
        item.sku = savedProduct.sku;
        received.push({
          lineIndex,
          productId: savedProduct.id,
          stockAdded: quantityReceived,
          damagedQuantity,
          unitCost,
        });
      }

      const fullyProcessed = items.every((item) => n(item.receivedQty) + n(item.damagedQty) >= n(item.qty) - epsilon);
      po.items = items;
      po.transportCost = transportCost;
      po.inventoryStatus = fullyProcessed ? 'RECEIVED' : 'PENDING';
      po.receivedAt = fullyProcessed ? (po.receivedAt ?? new Date()) : null;
      const savedPo = await poRepository.save(po);
      return {
        po: savedPo,
        received,
        alreadyReceived: received.length === 0 && fullyProcessed,
      };
    });
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
    const ownerIds = Array.from(new Set(links.map((link) => link.ownerId)));
    if (ownerIds.length !== 1) return null;
    return ownerIds[0];
  }

  private async getReceipt(ownerId: string, id: string) {
    const receipt = await this.receiptsRepo.findOne({ where: { ownerId, id } });
    if (!receipt) throw new NotFoundException('Receipt not found for this ERP user');
    return receipt;
  }

  private async createLedgerForReceipt(receipt: ErpKobePaySupplierReceipt) {
    const existing = await this.ledgerRepo.findOne({ where: { ownerId: receipt.ownerId, receiptId: receipt.id } });
    const entryType: 'expense' | 'freight' | 'supplier_advance' | 'po_payment' | 'reversal' =
      receipt.allocationStatus === 'linked'
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
