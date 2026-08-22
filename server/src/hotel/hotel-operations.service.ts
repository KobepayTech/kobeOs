import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HotelBooking, HotelOrder, HotelRoom } from './hotel.entity';
import { HotelFinancialRecord } from './hotel-financials.entity';
import { HotelInventoryItem } from './hotel-extras.entity';
import {
  HotelAsset, HotelLedgerEntry, HotelPayrollRecord, HotelPettyCashEntry,
  HotelProcurementRequest, HotelRequisitionLine,
} from './hotel-operations.entity';
import type {
  CreateAssetDto, CreateHotelRequisitionDto, CreatePayrollDto, CreatePettyCashDto,
  HotelStatementQueryDto, ReviewHotelRequisitionDto,
} from './hotel-operations.dto';
import { PlatformEventsService } from '../platform/platform.service';

const today = () => new Date().toISOString().slice(0, 10);
const money = (v: unknown) => Number(v ?? 0) || 0;
const dateOnly = (value: unknown) => {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};
const shiftDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const daysInPeriod = (from: string, to: string) => Math.max(1, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1);
const monthsInPeriod = (from: string, to: string) => Math.max(1, (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1);
const variancePct = (current: number, prior: number) => prior ? ((current - prior) / Math.abs(prior)) * 100 : null;
const isExpenseAccount = (account: string) => {
  const value = account.toLowerCase();
  if (/payable|cash|bank|inventory|fixed asset|asset|equity|revenue|receivable|loan|tax payable/.test(value)) return false;
  return /expense|petty cash ·|salary|salaries|utilities|maintenance|supplies|commission|cost of sales|food cost|housekeeping|cleaning|laundry|amenities/.test(value);
};

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
    @InjectRepository(HotelRoom) private readonly rooms: Repository<HotelRoom>,
    @InjectRepository(HotelFinancialRecord) private readonly financials: Repository<HotelFinancialRecord>,
    private readonly events: PlatformEventsService,
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

  async statements(ownerId: string, query: HotelStatementQueryDto = {}) {
    const now = dateOnly(new Date());
    const from = dateOnly(query.from) || `${now.slice(0, 7)}-01`;
    const to = dateOnly(query.to) || now;
    if (!from || !to || from > to) throw new BadRequestException('Statement from date must be on or before the to date');
    const period = { from, to };
    const comparisonTo = shiftDays(from, -1);
    const comparisonFrom = shiftDays(comparisonTo, -(daysInPeriod(from, to) - 1));
    const comparison = { from: comparisonFrom, to: comparisonTo };

    const [ledgerRows, bookingRows, orderRows, assetRows, roomRows, financialRows, payrollRows, pettyRows, requisitionRows, inventoryRows] = await Promise.all([
      this.ledger.find({ where: { ownerId } }),
      this.bookings.find({ where: { ownerId } }),
      this.orders.find({ where: { ownerId } }),
      this.assets.find({ where: { ownerId, status: 'active' } }),
      this.rooms.find({ where: { ownerId } }),
      this.financials.find({ where: { ownerId } }),
      this.payroll.find({ where: { ownerId } }),
      this.pettyCash.find({ where: { ownerId } }),
      this.requisitions.find({ where: { ownerId } }),
      this.inventory.find({ where: { ownerId } }),
    ]);
    const inHotel = <T extends { hotelId?: string | null }>(rows: T[]) => query.hotelId ? rows.filter((row) => row.hotelId === query.hotelId) : rows;
    const ledger = inHotel(ledgerRows);
    const bookings = inHotel(bookingRows);
    const orders = inHotel(orderRows);
    const assets = inHotel(assetRows);
    const rooms = inHotel(roomRows);
    const financials = inHotel(financialRows);
    const payroll = inHotel(payrollRows);
    const pettyCash = inHotel(pettyRows);
    const requisitions = inHotel(requisitionRows);
    const inventory = inHotel(inventoryRows);
    const inRange = (value: unknown, range: { from: string; to: string }) => {
      const date = dateOnly(value);
      return Boolean(date && date >= range.from && date <= range.to);
    };
    const overlaps = (checkIn: unknown, checkOut: unknown, range: { from: string; to: string }) => {
      const start = dateOnly(checkIn); const end = dateOnly(checkOut);
      return Boolean(start && end && start <= range.to && end > range.from);
    };
    const overlapNights = (checkIn: unknown, checkOut: unknown, range: { from: string; to: string }) => {
      if (!overlaps(checkIn, checkOut, range)) return 0;
      const start = startOfMax(dateOnly(checkIn), range.from);
      const end = startOfMin(dateOnly(checkOut), shiftDays(range.to, 1));
      return Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000));
    };
    const startOfMax = (a: string, b: string) => a > b ? a : b;
    const startOfMin = (a: string, b: string) => a < b ? a : b;
    const inPeriod = (range: { from: string; to: string }) => ({
      ledger: ledger.filter((row) => inRange(row.entryDate, range)),
      financials: financials.filter((row) => inRange(row.recordDate, range)),
      bookings: bookings.filter((row) => row.status !== 'CANCELLED' && overlaps(row.checkIn, row.checkOut, range)),
      orders: orders.filter((row) => row.status !== 'CANCELLED' && inRange(row.createdAt, range)),
      payroll: payroll.filter((row) => row.period >= range.from.slice(0, 7) && row.period <= range.to.slice(0, 7) && row.status !== 'VOID'),
      pettyCash: pettyCash.filter((row) => inRange(row.entryDate, range)),
    });
    const depreciationFor = (range: { from: string; to: string }) => assets.reduce((total, asset) => {
      const acquisition = dateOnly(asset.acquisitionDate);
      if (!acquisition || acquisition > range.to) return total;
      const assetFrom = startOfMax(acquisition, range.from);
      const months = Math.min(money(asset.usefulLifeMonths), monthsInPeriod(assetFrom, range.to));
      return total + Math.max(0, (money(asset.acquisitionCost) - money(asset.residualValue)) / Math.max(1, money(asset.usefulLifeMonths))) * months;
    }, 0);
    const assetNetBookValue = (range: { from: string; to: string }) => assets.reduce((total, asset) => {
      const acquisition = dateOnly(asset.acquisitionDate);
      if (!acquisition || acquisition > range.to) return total;
      const months = Math.min(money(asset.usefulLifeMonths), monthsInPeriod(acquisition, range.to));
      const monthly = Math.max(0, (money(asset.acquisitionCost) - money(asset.residualValue)) / Math.max(1, money(asset.usefulLifeMonths)));
      return total + Math.max(money(asset.residualValue), money(asset.acquisitionCost) - monthly * months);
    }, 0);
    const ledgerExpenseRows = (rows: HotelLedgerEntry[]) => {
      const byAccount = new Map<string, { debit: number; credit: number }>();
      for (const entry of rows) {
        if (!isExpenseAccount(entry.account)) continue;
        const values = byAccount.get(entry.account) ?? { debit: 0, credit: 0 };
        values[entry.side] += money(entry.amount);
        byAccount.set(entry.account, values);
      }
      return [...byAccount.entries()].map(([account, values]) => ({ account, amount: Math.max(0, values.debit - values.credit) })).filter((row) => row.amount > 0);
    };
    const financialExpenseRows = (rows: HotelFinancialRecord[]) => {
      const values = new Map<string, number>();
      for (const row of rows) {
        if (!/expense|staff_expense|maintenance_expense|supply_expense/.test(row.category)) continue;
        const label = row.category.replace(/_/g, ' ');
        values.set(label, (values.get(label) ?? 0) + money(row.amount));
      }
      return [...values.entries()].map(([account, amount]) => ({ account, amount })).filter((row) => row.amount > 0);
    };
    const buildPeriod = (range: { from: string; to: string }) => {
      const data = inPeriod(range);
      const recorded = (category: string) => data.financials.filter((row) => row.category === category).reduce((sum, row) => sum + money(row.amount), 0);
      const hasRecorded = (category: string) => data.financials.some((row) => row.category === category);
      const roomFallback = data.bookings.reduce((sum, booking) => {
        const nights = overlapNights(booking.checkIn, booking.checkOut, range);
        const totalNights = Math.max(1, Math.round((Date.parse(`${dateOnly(booking.checkOut)}T00:00:00Z`) - Date.parse(`${dateOnly(booking.checkIn)}T00:00:00Z`)) / 86400000));
        return sum + money(booking.totalAmount) * Math.min(1, nights / totalNights);
      }, 0);
      const restaurantFallback = data.orders.reduce((sum, order) => sum + money(order.total), 0);
      const roomRevenue = hasRecorded('room_revenue') ? recorded('room_revenue') : roomFallback;
      const restaurantRevenue = hasRecorded('restaurant_revenue') ? recorded('restaurant_revenue') : restaurantFallback;
      const serviceRevenue = hasRecorded('service_revenue') ? recorded('service_revenue') : 0;
      const otherRevenue = data.financials.filter((row) => /revenue/.test(row.category) && !['room_revenue', 'restaurant_revenue', 'service_revenue'].includes(row.category)).reduce((sum, row) => sum + money(row.amount), 0);
      const revenue = roomRevenue + restaurantRevenue + serviceRevenue + otherRevenue;
      const ledgerExpenses = ledgerExpenseRows(data.ledger);
      const expenses = ledgerExpenses.length ? ledgerExpenses : financialExpenseRows(data.financials);
      const depreciation = depreciationFor(range);
      const operatingExpenses = expenses.reduce((sum, row) => sum + row.amount, 0);
      const directCost = (pattern: RegExp) => expenses.filter((row) => pattern.test(`${row.account}`)).reduce((sum, row) => sum + row.amount, 0);
      const roomDirectCost = directCost(/room|housekeeping|cleaning|amenit/i);
      const foodDirectCost = directCost(/food|beverage|restaurant|bar|kitchen/i);
      const serviceDirectCost = directCost(/service|laundry|spa|transport/i);
      const ebitda = revenue - operatingExpenses;
      const netProfit = ebitda - depreciation;
      const roomsSold = data.bookings.reduce((sum, booking) => sum + overlapNights(booking.checkIn, booking.checkOut, range), 0);
      const availableRooms = rooms.filter((room) => room.status !== 'maintenance').length;
      const availableRoomNights = availableRooms * daysInPeriod(range.from, range.to);
      const covers = data.orders.reduce((sum, order) => sum + (order.items ?? []).reduce((items, item) => items + money(item.qty), 0), 0);
      return {
        revenueRows: [
          { account: 'Rooms revenue', amount: roomRevenue },
          { account: 'Food & beverage revenue', amount: restaurantRevenue },
          { account: 'Other operating revenue', amount: serviceRevenue + otherRevenue },
        ],
        expenses: [...expenses, { account: 'Depreciation', amount: depreciation }],
        roomRevenue, restaurantRevenue, serviceRevenue, otherRevenue, revenue, operatingExpenses, depreciation, ebitda, netProfit,
        roomsSold, availableRooms, availableRoomNights, occupancy: availableRoomNights ? (roomsSold / availableRoomNights) * 100 : 0,
        adr: roomsSold ? roomRevenue / roomsSold : 0, revpar: availableRoomNights ? roomRevenue / availableRoomNights : 0,
        orderCount: data.orders.length, covers, averageLengthOfStay: data.bookings.length ? roomsSold / data.bookings.length : 0,
        departmental: [
          { department: 'Rooms', revenue: roomRevenue, directCosts: roomDirectCost, profit: roomRevenue - roomDirectCost },
          { department: 'Food & beverage', revenue: restaurantRevenue, directCosts: foodDirectCost, profit: restaurantRevenue - foodDirectCost },
          { department: 'Services', revenue: serviceRevenue, directCosts: serviceDirectCost, profit: serviceRevenue - serviceDirectCost },
        ],
        data,
      };
    };
    const current = buildPeriod(period);
    const prior = buildPeriod(comparison);
    const row = (label: string, currentValue: number, priorValue: number, section: string) => ({ label, section, current: currentValue, prior: priorValue, variance: currentValue - priorValue, variancePct: variancePct(currentValue, priorValue) });
    const incomeStatement = [
      row('Rooms revenue', current.roomRevenue, prior.roomRevenue, 'Revenue'),
      row('Food & beverage revenue', current.restaurantRevenue, prior.restaurantRevenue, 'Revenue'),
      row('Other operating revenue', current.serviceRevenue + current.otherRevenue, prior.serviceRevenue + prior.otherRevenue, 'Revenue'),
      row('Total operating revenue', current.revenue, prior.revenue, 'Total'),
      row('Departmental and operating expenses', current.operatingExpenses, prior.operatingExpenses, 'Expenses'),
      row('Gross operating profit (EBITDA)', current.ebitda, prior.ebitda, 'Profit'),
      row('Depreciation', current.depreciation, prior.depreciation, 'Expenses'),
      row('Net operating profit', current.netProfit, prior.netProfit, 'Profit'),
    ];
    const ledgerAsOf = ledger.filter((entry) => dateOnly(entry.entryDate) <= period.to);
    const accountBalance = (pattern: RegExp) => ledgerAsOf.filter((entry) => pattern.test(entry.account.toLowerCase())).reduce((sum, entry) => sum + (entry.side === 'debit' ? money(entry.amount) : -money(entry.amount)), 0);
    const cash = Math.max(0, accountBalance(/cash|bank/));
    const petty = Math.max(0, accountBalance(/petty cash/));
    const receivables = Math.max(0, accountBalance(/receivable|guest ledger/));
    const inventoryValue = inventory.reduce((sum, item) => sum + money(item.quantity) * money(item.costPerUnit), 0);
    const fixedAssetsNet = assetNetBookValue(period);
    const accountsPayable = Math.max(0, -accountBalance(/accounts payable|supplier payable/));
    const payrollPayable = Math.max(0, -accountBalance(/salaries payable|payroll payable/));
    const taxesPayable = Math.max(0, -accountBalance(/tax payable|taxes payable/));
    const guestDeposits = Math.max(0, -accountBalance(/guest deposit/));
    const loans = Math.max(0, -accountBalance(/loan|borrowing/));
    const totalAssets = cash + petty + receivables + inventoryValue + fixedAssetsNet;
    const totalLiabilities = accountsPayable + payrollPayable + taxesPayable + guestDeposits + loans;
    const totalEquity = totalAssets - totalLiabilities;
    const cashMovement = (range: { from: string; to: string }) => ledger.filter((entry) => inRange(entry.entryDate, range) && /cash|bank|petty cash/i.test(entry.account)).reduce((sum, entry) => sum + (entry.side === 'debit' ? money(entry.amount) : -money(entry.amount)), 0);
    const netCashChange = cashMovement(period);
    const investingCashFlow = -current.data.ledger.filter((entry) => entry.sourceType === 'asset').reduce((sum, entry) => sum + (entry.side === 'credit' && /cash|bank/i.test(entry.account) ? money(entry.amount) : 0), 0);
    const financingCashFlow = current.data.ledger.filter((entry) => /loan|equity|capital/i.test(entry.account)).reduce((sum, entry) => sum + (entry.side === 'debit' ? money(entry.amount) : -money(entry.amount)), 0);
    const operatingCashFlow = netCashChange - investingCashFlow - financingCashFlow;
    const capexRows = assets.filter((asset) => inRange(asset.acquisitionDate, period)).map((asset) => ({ assetCode: asset.assetCode, name: asset.name, category: asset.category, amount: money(asset.acquisitionCost), currency: asset.currency }));
    const assetSchedule = assets.filter((asset) => dateOnly(asset.acquisitionDate) <= period.to).map((asset) => {
      const acquisition = dateOnly(asset.acquisitionDate);
      const months = Math.min(money(asset.usefulLifeMonths), monthsInPeriod(acquisition, period.to));
      const monthly = Math.max(0, (money(asset.acquisitionCost) - money(asset.residualValue)) / Math.max(1, money(asset.usefulLifeMonths)));
      return { assetCode: asset.assetCode, name: asset.name, category: asset.category, acquisitionDate: acquisition, cost: money(asset.acquisitionCost), accumulatedDepreciation: monthly * months, netBookValue: Math.max(money(asset.residualValue), money(asset.acquisitionCost) - monthly * months), currency: asset.currency };
    });
    const currency = ledger[0]?.currency ?? financials[0]?.currency ?? bookings[0]?.currency ?? 'TZS';
    const revenue = current.revenueRows.map((item) => ({ account: item.account, amount: item.amount }));
    const expenses = current.expenses;
    return {
      generatedAt: new Date().toISOString(),
      meta: { period, comparisonPeriod: comparison, currency, hotelId: query.hotelId ?? null, basis: 'accrual management statement' },
      incomeStatement,
      departmental: current.departmental.map((item, index) => ({ ...item, prior: prior.departmental[index] })),
      operatingStats: {
        current: { roomCount: rooms.length, availableRooms: current.availableRooms, availableRoomNights: current.availableRoomNights, roomsSold: current.roomsSold, occupancyPct: current.occupancy, adr: current.adr, revpar: current.revpar, orders: current.orderCount, covers: current.covers, averageLengthOfStay: current.averageLengthOfStay, foodCostPct: current.restaurantRevenue ? (current.departmental[1].directCosts / current.restaurantRevenue) * 100 : 0, payrollPct: current.revenue ? ((current.expenses.find((item) => /salary|salaries/i.test(item.account))?.amount ?? 0) / current.revenue) * 100 : 0 },
        prior: { roomCount: rooms.length, availableRooms: prior.availableRooms, availableRoomNights: prior.availableRoomNights, roomsSold: prior.roomsSold, occupancyPct: prior.occupancy, adr: prior.adr, revpar: prior.revpar, orders: prior.orderCount, covers: prior.covers, averageLengthOfStay: prior.averageLengthOfStay, foodCostPct: prior.restaurantRevenue ? (prior.departmental[1].directCosts / prior.restaurantRevenue) * 100 : 0, payrollPct: prior.revenue ? ((prior.expenses.find((item) => /salary|salaries/i.test(item.account))?.amount ?? 0) / prior.revenue) * 100 : 0 },
      },
      financialPosition: { asOf: period.to, assets: [{ label: 'Cash / bank', amount: cash }, { label: 'Petty cash', amount: petty }, { label: 'Receivables', amount: receivables }, { label: 'Inventory', amount: inventoryValue }, { label: 'Fixed assets, net', amount: fixedAssetsNet }], liabilities: [{ label: 'Accounts payable', amount: accountsPayable }, { label: 'Payroll payable', amount: payrollPayable }, { label: 'Taxes payable', amount: taxesPayable }, { label: 'Guest deposits', amount: guestDeposits }, { label: 'Loans / borrowings', amount: loans }], totalAssets, totalLiabilities, totalEquity, balanceCheck: totalAssets - totalLiabilities - totalEquity },
      cashFlow: { period, operating: operatingCashFlow, investing: investingCashFlow, financing: financingCashFlow, netChange: netCashChange },
      capex: { acquisitions: capexRows, totalAcquisitions: capexRows.reduce((sum, item) => sum + item.amount, 0), depreciation: current.depreciation, netBookValue: fixedAssetsNet, assetSchedule },
      controlSummary: { ledgerEntries: ledger.length, periodLedgerEntries: current.data.ledger.length, pendingRequisitions: requisitions.filter((item) => item.status === 'PENDING').length, approvedRequisitions: requisitions.filter((item) => item.status === 'APPROVED').length, payrollPostedUnpaid: payroll.filter((item) => item.status === 'POSTED').length, pettyCashExpenses: current.data.pettyCash.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + money(item.amount), 0), inventoryValue },
      definitions: ['Rooms revenue uses hotel financial records when posted; otherwise it allocates overlapping booking value by nights.', 'Food & beverage revenue uses hotel financial records when posted; otherwise it uses completed/non-cancelled restaurant orders.', 'Occupancy = rooms sold nights ÷ available room nights; ADR = rooms revenue ÷ rooms sold nights; RevPAR = rooms revenue ÷ available room nights.', 'Financial position is ledger-derived. Equity is the balancing figure until opening balances and all liability/equity accounts are posted.'],
      revenue, expenses, totalRevenue: current.revenue, totalExpenses: current.operatingExpenses + current.depreciation, netProfit: current.netProfit, fixedAssetsNet, ledgerCount: ledger.length,
    };
  }

  async dailyClose(ownerId: string, query: HotelStatementQueryDto = {}) {
    const closeDate = dateOnly(query.to) || today();
    const statement = await this.statements(ownerId, { ...query, from: closeDate, to: closeDate });
    await this.events.emit({ ownerId, eventName: 'hotel.daily_close', aggregateType: 'HotelDailyClose', payload: { hotelId: query.hotelId ?? null, closeDate, closeKey: `${query.hotelId ?? 'all'}:${closeDate}`, totalRevenue: statement.totalRevenue, totalExpenses: statement.totalExpenses, netProfit: statement.netProfit, ledgerCount: statement.ledgerCount } });
    return { status: 'CLOSED', closeDate, hotelId: query.hotelId ?? null, statement };
  }
}
