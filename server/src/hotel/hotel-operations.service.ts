import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelBooking, HotelOrder } from './hotel.entity';
import { HotelInventoryItem } from './hotel-extras.entity';
import {
  HotelAsset, HotelLedgerEntry, HotelPayrollRecord, HotelPettyCashEntry,
  HotelProcurementRequest, HotelRequisitionLine,
} from './hotel-operations.entity';
import type {
  CreateAssetDto, CreateHotelRequisitionDto, CreatePayrollDto, CreatePettyCashDto,
  ReviewHotelRequisitionDto,
} from './hotel-operations.dto';

const today = () => new Date().toISOString().slice(0, 10);
const money = (v: unknown) => Number(v ?? 0) || 0;

@Injectable()
export class HotelOperationsService {
  constructor(
    @InjectRepository(HotelProcurementRequest) private readonly requisitions: Repository<HotelProcurementRequest>,
    @InjectRepository(HotelInventoryItem) private readonly inventory: Repository<HotelInventoryItem>,
    @InjectRepository(HotelPayrollRecord) private readonly payroll: Repository<HotelPayrollRecord>,
    @InjectRepository(HotelPettyCashEntry) private readonly pettyCash: Repository<HotelPettyCashEntry>,
    @InjectRepository(HotelAsset) private readonly assets: Repository<HotelAsset>,
    @InjectRepository(HotelLedgerEntry) private readonly ledger: Repository<HotelLedgerEntry>,
    @InjectRepository(HotelBooking) private readonly bookings: Repository<HotelBooking>,
    @InjectRepository(HotelOrder) private readonly orders: Repository<HotelOrder>,
  ) {}

  private async post(ownerId: string, data: Partial<HotelLedgerEntry>) {
    return this.ledger.save(this.ledger.create({ ownerId, entryDate: today(), currency: 'TZS', ...data }));
  }

  listRequisitions(ownerId: string) {
    return this.requisitions.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  async createRequisition(ownerId: string, dto: CreateHotelRequisitionDto) {
    if (!dto.lines?.length) throw new BadRequestException('Add at least one item to the request');
    const lines: HotelRequisitionLine[] = dto.lines.map((line) => ({
      inventoryId: line.inventoryId,
      name: line.name.trim(),
      quantity: Number(line.quantity),
      unit: line.unit.trim() || 'unit',
    }));
    return this.requisitions.save(this.requisitions.create({
      ownerId, department: dto.department, lines, status: 'PENDING',
      currency: dto.currency ?? 'TZS', note: dto.note ?? '', hotelId: dto.hotelId ?? null,
    }));
  }

  async reviewRequisition(ownerId: string, id: string, dto: ReviewHotelRequisitionDto) {
    const request = await this.requisitions.findOne({ where: { ownerId, id } });
    if (!request) throw new NotFoundException('Requisition not found');
    if (request.status !== 'PENDING' && request.status !== 'APPROVED') throw new BadRequestException('Only open requisitions can be reviewed');
    request.lines = dto.lines.map((line) => {
      const quantity = Math.max(0, Number(line.approvedQuantity ?? line.quantity));
      const unitCost = Math.max(0, money(line.unitCost));
      return {
        inventoryId: line.inventoryId,
        name: line.name.trim(),
        quantity: Math.max(0, Number(line.quantity)),
        approvedQuantity: quantity,
        unit: line.unit.trim() || 'unit',
        unitCost,
        totalCost: quantity * unitCost,
      };
    }).filter((line) => line.approvedQuantity && line.approvedQuantity > 0);
    request.status = request.lines.length ? 'APPROVED' : 'CANCELLED';
    request.reviewedBy = dto.reviewedBy ?? null;
    return this.requisitions.save(request);
  }

  async purchaseRequisition(ownerId: string, id: string) {
    const request = await this.requisitions.findOne({ where: { ownerId, id } });
    if (!request) throw new NotFoundException('Requisition not found');
    if (request.status !== 'APPROVED') throw new BadRequestException('Review and approve the requisition before purchasing');
    let total = 0;
    for (const line of request.lines) {
      const quantity = Number(line.approvedQuantity ?? line.quantity);
      if (!quantity) continue;
      let item = line.inventoryId ? await this.inventory.findOne({ where: { ownerId, id: line.inventoryId } }) : null;
      if (!item) item = await this.inventory.findOne({ where: { ownerId, name: line.name } });
      if (!item) {
        item = this.inventory.create({ ownerId, name: line.name, category: request.department, quantity: 0, unit: line.unit, reorderLevel: 0, costPerUnit: money(line.unitCost), currency: request.currency, hotelId: request.hotelId ?? null });
      }
      item.quantity = money(item.quantity) + quantity;
      item.costPerUnit = money(line.unitCost) || money(item.costPerUnit);
      item.updatedAt = new Date();
      await this.inventory.save(item);
      total += quantity * money(line.unitCost);
    }
    request.status = 'PURCHASED';
    request.purchasedAt = new Date();
    await this.requisitions.save(request);
    if (total > 0) {
      await this.post(ownerId, { account: 'Inventory', department: request.department, side: 'debit', amount: total, currency: request.currency, description: `Inventory purchase for ${request.department}`, sourceType: 'requisition', sourceId: request.id, hotelId: request.hotelId ?? null });
      await this.post(ownerId, { account: 'Accounts Payable', department: request.department, side: 'credit', amount: total, currency: request.currency, description: `Supplier payable for requisition ${request.id}`, sourceType: 'requisition', sourceId: request.id, hotelId: request.hotelId ?? null });
    }
    return request;
  }

  listPayroll(ownerId: string) { return this.payroll.find({ where: { ownerId }, order: { period: 'DESC', createdAt: 'DESC' } }); }

  async createPayroll(ownerId: string, dto: CreatePayrollDto) {
    const base = money(dto.baseSalary); const overtime = money(dto.overtime); const allowances = money(dto.allowances); const deductions = money(dto.deductions);
    const row = await this.payroll.save(this.payroll.create({ ownerId, employeeName: dto.employeeName.trim(), staffId: dto.staffId ?? null, period: dto.period, baseSalary: base, overtime, allowances, deductions, netPay: Math.max(0, base + overtime + allowances - deductions), status: 'POSTED', currency: dto.currency ?? 'TZS', hotelId: dto.hotelId ?? null, note: dto.note ?? '' }));
    await this.post(ownerId, { account: 'Salaries Expense', department: 'HR', side: 'debit', amount: row.netPay, currency: row.currency, description: `Payroll ${row.period} · ${row.employeeName}`, sourceType: 'payroll', sourceId: row.id, hotelId: row.hotelId });
    await this.post(ownerId, { account: 'Salaries Payable', department: 'HR', side: 'credit', amount: row.netPay, currency: row.currency, description: `Payroll payable ${row.period} · ${row.employeeName}`, sourceType: 'payroll', sourceId: row.id, hotelId: row.hotelId });
    return row;
  }

  async payPayroll(ownerId: string, id: string) {
    const row = await this.payroll.findOne({ where: { ownerId, id } });
    if (!row) throw new NotFoundException('Payroll record not found');
    if (row.status !== 'POSTED') throw new BadRequestException('Only posted payroll can be paid');
    row.status = 'PAID'; row.paidAt = new Date(); await this.payroll.save(row);
    await this.post(ownerId, { account: 'Salaries Payable', department: 'HR', side: 'debit', amount: row.netPay, currency: row.currency, description: `Paid payroll ${row.period} · ${row.employeeName}`, sourceType: 'payroll-payment', sourceId: row.id, hotelId: row.hotelId });
    await this.post(ownerId, { account: 'Cash / Bank', department: 'HR', side: 'credit', amount: row.netPay, currency: row.currency, description: `Payroll payment ${row.period} · ${row.employeeName}`, sourceType: 'payroll-payment', sourceId: row.id, hotelId: row.hotelId });
    return row;
  }

  listPettyCash(ownerId: string) { return this.pettyCash.find({ where: { ownerId }, order: { entryDate: 'DESC', createdAt: 'DESC' } }); }

  async createPettyCash(ownerId: string, dto: CreatePettyCashDto) {
    const row = await this.pettyCash.save(this.pettyCash.create({ ownerId, kind: dto.kind, category: dto.category, amount: dto.amount, description: dto.description, paidTo: dto.paidTo ?? '', reference: dto.reference ?? '', entryDate: dto.entryDate.slice(0, 10), currency: dto.currency ?? 'TZS', hotelId: dto.hotelId ?? null }));
    if (dto.kind === 'expense') {
      await this.post(ownerId, { account: `Petty Cash · ${dto.category}`, department: 'Administration', side: 'debit', amount: dto.amount, currency: row.currency, description: dto.description, sourceType: 'petty-cash', sourceId: row.id, hotelId: row.hotelId });
      await this.post(ownerId, { account: 'Petty Cash', department: 'Administration', side: 'credit', amount: dto.amount, currency: row.currency, description: dto.description, sourceType: 'petty-cash', sourceId: row.id, hotelId: row.hotelId });
    } else {
      await this.post(ownerId, { account: 'Petty Cash', department: 'Administration', side: 'debit', amount: dto.amount, currency: row.currency, description: 'Petty cash top-up', sourceType: 'petty-cash', sourceId: row.id, hotelId: row.hotelId });
      await this.post(ownerId, { account: 'Cash / Bank', department: 'Administration', side: 'credit', amount: dto.amount, currency: row.currency, description: 'Petty cash top-up', sourceType: 'petty-cash', sourceId: row.id, hotelId: row.hotelId });
    }
    return row;
  }

  listAssets(ownerId: string) { return this.assets.find({ where: { ownerId }, order: { acquisitionDate: 'DESC' } }); }

  async createAsset(ownerId: string, dto: CreateAssetDto) {
    const code = dto.assetCode?.trim() || `AST-${dto.acquisitionDate.slice(0, 4)}-${String(Date.now()).slice(-6)}`;
    const row = await this.assets.save(this.assets.create({ ownerId, assetCode: code, name: dto.name.trim(), category: dto.category ?? 'hotel equipment', acquisitionDate: dto.acquisitionDate.slice(0, 10), acquisitionCost: dto.acquisitionCost, residualValue: dto.residualValue ?? 0, usefulLifeMonths: dto.usefulLifeMonths, depreciationMethod: 'straight_line', currency: dto.currency ?? 'TZS', hotelId: dto.hotelId ?? null, note: dto.note ?? '' }));
    await this.post(ownerId, { account: `Fixed Asset · ${row.category}`, department: 'Capital', side: 'debit', amount: row.acquisitionCost, currency: row.currency, description: `Asset ${row.assetCode} · ${row.name}`, sourceType: 'asset', sourceId: row.id, hotelId: row.hotelId });
    await this.post(ownerId, { account: 'Cash / Bank', department: 'Capital', side: 'credit', amount: row.acquisitionCost, currency: row.currency, description: `Asset purchase ${row.assetCode}`, sourceType: 'asset', sourceId: row.id, hotelId: row.hotelId });
    return row;
  }

  listLedger(ownerId: string) { return this.ledger.find({ where: { ownerId }, order: { entryDate: 'DESC', createdAt: 'DESC' }, take: 500 }); }

  async statements(ownerId: string) {
    const [ledger, bookings, orders, assets] = await Promise.all([
      this.ledger.find({ where: { ownerId } }),
      this.bookings.find({ where: { ownerId } }),
      this.orders.find({ where: { ownerId } }),
      this.assets.find({ where: { ownerId, status: 'active' } }),
    ]);
    const roomRevenue = bookings.filter((b) => b.status !== 'CANCELLED').reduce((s, b) => s + money(b.totalAmount), 0);
    const restaurantRevenue = orders.filter((o) => o.status !== 'CANCELLED').reduce((s, o) => s + money(o.total), 0);
    const byAccount = new Map<string, { debit: number; credit: number }>();
    for (const entry of ledger) { const current = byAccount.get(entry.account) ?? { debit: 0, credit: 0 }; current[entry.side] += money(entry.amount); byAccount.set(entry.account, current); }
    const expenses = [...byAccount.entries()].filter(([account]) => /expense|petty cash ·|salar/i.test(account)).map(([account, values]) => ({ account, amount: values.debit - values.credit }));
    const totalRevenue = roomRevenue + restaurantRevenue;
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const monthlyDepreciation = assets.reduce((s, a) => s + Math.max(0, (money(a.acquisitionCost) - money(a.residualValue)) / Math.max(1, a.usefulLifeMonths)), 0);
    return { generatedAt: new Date().toISOString(), revenue: [{ account: 'Room Revenue', amount: roomRevenue }, { account: 'Restaurant & Bar Revenue', amount: restaurantRevenue }], expenses: [...expenses, { account: 'Depreciation', amount: monthlyDepreciation }], totalRevenue, totalExpenses: totalExpenses + monthlyDepreciation, netProfit: totalRevenue - totalExpenses - monthlyDepreciation, fixedAssetsNet: assets.reduce((s, a) => s + money(a.acquisitionCost) - money(a.residualValue), 0), ledgerCount: ledger.length };
  }
}
