import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  KpAccount, KpMerchant, KpMerchantApproval, KpPurchaseGroup, KpSchool, KpStudent, KpSupplier, KpTransaction,
} from './kobepay-pro.entity';
import { LedgerService } from './ledger.service';

const CENTS = 1e4;
const round = (n: number) => Math.round(n * CENTS) / CENTS;
const CODE = 'ACDEFGHJKMNPQRTUVWXY34679';
const short = (n: number) => {
  const b = randomBytes(n); let s = '';
  for (let i = 0; i < n; i++) s += CODE[b[i] % CODE.length];
  return s;
};

/** School-admin service: schools, students, merchants, whitelist, dashboards, settlement. */
@Injectable()
export class SchoolService {
  constructor(
    @InjectRepository(KpSchool) private readonly schools: Repository<KpSchool>,
    @InjectRepository(KpStudent) private readonly students: Repository<KpStudent>,
    @InjectRepository(KpMerchant) private readonly merchants: Repository<KpMerchant>,
    @InjectRepository(KpMerchantApproval) private readonly approvals: Repository<KpMerchantApproval>,
    @InjectRepository(KpTransaction) private readonly txns: Repository<KpTransaction>,
    @InjectRepository(KpAccount) private readonly accounts: Repository<KpAccount>,
    @InjectRepository(KpSupplier) private readonly suppliers: Repository<KpSupplier>,
    @InjectRepository(KpPurchaseGroup) private readonly groups: Repository<KpPurchaseGroup>,
    private readonly ledger: LedgerService,
    private readonly dataSource: DataSource,
  ) {}

  /** Marketplace: merchants (with payable) and suppliers (with active orders) a school can approve. */
  async marketplace(ownerId: string, schoolId?: string) {
    const merchants = await this.merchants.find({ where: { ownerId }, order: { name: 'ASC' } });
    const approvals = schoolId ? await this.approvals.find({ where: { ownerId, schoolId } }) : [];
    const merchantRows = await Promise.all(merchants.map(async (m) => ({
      id: m.id, name: m.name, code: m.merchantCode, category: m.category, status: m.status,
      online: m.online, commissionPct: m.commissionPct,
      payable: await this.ledger.owed(ownerId, 'MERCHANT', m.id),
      approved: schoolId ? (approvals.find((a) => a.merchantId === m.id)?.allowed ?? false) : undefined,
      hasApiKey: !!m.apiKeyHash,
    })));
    const suppliers = await this.suppliers.find({ where: { ownerId }, order: { name: 'ASC' } });
    const supplierRows = await Promise.all(suppliers.map(async (s) => ({
      id: s.id, name: s.name, code: s.code, status: s.status,
      payable: await this.ledger.owed(ownerId, 'SUPPLIER', s.id),
      activeOrders: await this.groups.count({ where: { ownerId, supplierId: s.id } }),
    })));
    return { merchants: merchantRows, suppliers: supplierRows };
  }

  // ── Schools ──────────────────────────────────────────────────────────────
  async createSchool(ownerId: string, dto: { name: string; code?: string; bankModel?: string; bankAccountRef?: string; currency?: string }) {
    const code = (dto.code || short(6)).toUpperCase();
    return this.schools.save(this.schools.create({
      ownerId, name: dto.name, code,
      bankModel: (dto.bankModel as KpSchool['bankModel']) || 'KOBEPAY',
      bankAccountRef: dto.bankAccountRef || '', currency: dto.currency || 'TZS',
    }));
  }
  listSchools(ownerId: string) { return this.schools.find({ where: { ownerId }, order: { createdAt: 'DESC' } }); }
  async getSchool(ownerId: string, id: string) {
    const s = await this.schools.findOne({ where: { ownerId, id } });
    if (!s) throw new NotFoundException('School not found');
    return s;
  }

  // ── Students ─────────────────────────────────────────────────────────────
  async createStudent(ownerId: string, dto: {
    schoolId: string; name: string; studentCode?: string; className?: string;
    nfcCardId?: string; parentName?: string; parentPhone?: string;
  }) {
    await this.getSchool(ownerId, dto.schoolId);
    const studentCode = (dto.studentCode || `S${short(6)}`).toUpperCase();
    const exists = await this.students.findOne({ where: { ownerId, studentCode } });
    if (exists) throw new BadRequestException('Student code already in use');
    return this.students.save(this.students.create({
      ownerId, schoolId: dto.schoolId, name: dto.name, studentCode,
      className: dto.className || '', nfcCardId: dto.nfcCardId || '',
      qrToken: randomBytes(16).toString('base64url'),
      parentName: dto.parentName || '', parentPhone: dto.parentPhone || '',
      status: 'ACTIVE', controls: {},
    }));
  }
  listStudents(ownerId: string, schoolId?: string) {
    return this.students.find({ where: { ownerId, ...(schoolId ? { schoolId } : {}) }, order: { name: 'ASC' }, take: 1000 });
  }
  async getStudent(ownerId: string, id: string) {
    const s = await this.students.findOne({ where: { ownerId, id } });
    if (!s) throw new NotFoundException('Student not found');
    return s;
  }
  async setControls(ownerId: string, id: string, controls: Record<string, unknown>) {
    const s = await this.getStudent(ownerId, id);
    s.controls = { ...(s.controls ?? {}), ...controls };
    return this.students.save(s);
  }
  studentHistory(ownerId: string, studentId: string) {
    return this.txns.find({ where: { ownerId, studentId }, order: { createdAt: 'DESC' }, take: 200 });
  }

  // ── Merchants & whitelist ────────────────────────────────────────────────
  async createMerchant(ownerId: string, dto: {
    name: string; merchantCode?: string; category?: string; settlementAccount?: string;
    settlementMethod?: string; commissionPct?: number; online?: boolean; status?: string;
  }) {
    const merchantCode = (dto.merchantCode || `M${short(6)}`).toUpperCase();
    const exists = await this.merchants.findOne({ where: { ownerId, merchantCode } });
    if (exists) throw new BadRequestException('Merchant code already in use');
    return this.merchants.save(this.merchants.create({
      ownerId, name: dto.name, merchantCode,
      category: (dto.category as KpMerchant['category']) || 'AVAILABLE',
      settlementAccount: dto.settlementAccount || '', settlementMethod: dto.settlementMethod || 'mobile',
      commissionPct: dto.commissionPct ?? 0, online: !!dto.online,
      status: (dto.status as KpMerchant['status']) || 'ACTIVE',
    }));
  }
  listMerchants(ownerId: string) { return this.merchants.find({ where: { ownerId }, order: { name: 'ASC' } }); }
  async approveMerchant(ownerId: string, schoolId: string, merchantId: string, allowed: boolean) {
    await this.getSchool(ownerId, schoolId);
    let a = await this.approvals.findOne({ where: { ownerId, schoolId, merchantId } });
    if (!a) a = this.approvals.create({ ownerId, schoolId, merchantId, allowed });
    a.allowed = allowed;
    return this.approvals.save(a);
  }
  async schoolMerchants(ownerId: string, schoolId: string) {
    const approvals = await this.approvals.find({ where: { ownerId, schoolId } });
    const merchants = await this.merchants.find({ where: { ownerId } });
    return merchants.map((m) => ({
      ...m, allowed: approvals.find((a) => a.merchantId === m.id)?.allowed ?? false,
    }));
  }

  // ── Dashboard ────────────────────────────────────────────────────────────
  async schoolDashboard(ownerId: string, schoolId: string) {
    const school = await this.getSchool(ownerId, schoolId);
    const students = await this.students.find({ where: { ownerId, schoolId } });
    const ids = students.map((s) => s.id);
    const studentAccounts = ids.length
      ? await this.accounts.find({ where: { ownerId, type: 'STUDENT', refId: In(ids) } })
      : [];
    const walletTotal = round(studentAccounts.reduce((s, a) => s + -a.balance, 0));

    const start = new Date(); start.setHours(0, 0, 0, 0);
    const todays = await this.txns
      .createQueryBuilder('t')
      .where('t.ownerId = :ownerId AND t.schoolId = :schoolId AND t.createdAt >= :start', { ownerId, schoolId, start })
      .getMany();
    const studentSpendToday = round(todays.filter((t) => t.kind === 'PAYMENT').reduce((s, t) => s + t.amount, 0));
    const depositsToday = round(todays.filter((t) => t.kind === 'DEPOSIT').reduce((s, t) => s + t.amount, 0));

    const reconcile = await this.ledger.reconcile(ownerId);
    return {
      school: { id: school.id, name: school.name, code: school.code, bankModel: school.bankModel },
      students: students.length,
      walletTotal,
      studentSpendToday,
      depositsToday,
      reconcile,
    };
  }

  // ── Settlement ───────────────────────────────────────────────────────────
  /** Settle a merchant's outstanding payable from the bank account. */
  async settleMerchant(ownerId: string, merchantId: string) {
    const merchant = await this.merchants.findOne({ where: { ownerId, id: merchantId } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    const payable = await this.ledger.owed(ownerId, 'MERCHANT', merchantId);
    if (payable <= 0) return { settled: 0, reference: null };
    const txn = await this.dataSource.transaction((m) => this.ledger.post(m, {
      ownerId, kind: 'SETTLEMENT', amount: payable, merchantId,
      description: `Settlement to ${merchant.name}`,
      metadata: { method: merchant.settlementMethod, account: merchant.settlementAccount },
    }, [
      { type: 'MERCHANT', refId: merchantId, debit: payable },
      { type: 'BANK', credit: payable },
    ]));
    return { settled: payable, reference: txn.reference, transactionId: txn.id };
  }
}
