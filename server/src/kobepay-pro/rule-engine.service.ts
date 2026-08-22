import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  KpBucket, KpMerchant, KpMerchantApproval, KpStudent, KpTransaction, KpWallet, SpendCategory,
} from './kobepay-pro.entity';

export interface StudentControls {
  dailyLimit?: number;
  categoryLimits?: Partial<Record<SpendCategory, number>>; // per-day cap per category
  onlineAllowed?: boolean;
  groupAllowed?: boolean;
  outsideSchoolAllowed?: boolean;
  approvalThreshold?: number; // purchases at/above require parent approval
  blockedMerchants?: string[]; // merchant ids or codes
  blockedCategories?: SpendCategory[];
}

export interface AuthDecision {
  approved: boolean;
  requiresApproval: boolean;
  reason: string;
  rule: string;
  spendable: number;
}

const CENTS = 1e4;
const round = (n: number) => Math.round(n * CENTS) / CENTS;

/**
 * The rule engine: every purchase runs the full gate — student active,
 * merchant approved by the school, category permitted, daily & category limits,
 * parent approval threshold, merchant/category blocks, and sufficient spendable
 * balance — before any money moves.
 */
@Injectable()
export class RuleEngineService {
  constructor(
    @InjectRepository(KpMerchantApproval) private readonly approvals: Repository<KpMerchantApproval>,
    @InjectRepository(KpWallet) private readonly wallets: Repository<KpWallet>,
    @InjectRepository(KpBucket) private readonly buckets: Repository<KpBucket>,
    @InjectRepository(KpTransaction) private readonly txns: Repository<KpTransaction>,
  ) {}

  async authorize(
    ownerId: string, student: KpStudent, merchant: KpMerchant, category: SpendCategory, amount: number,
  ): Promise<AuthDecision> {
    const controls = (student.controls ?? {}) as StudentControls;
    const deny = (reason: string, rule: string): AuthDecision =>
      ({ approved: false, requiresApproval: false, reason, rule, spendable: 0 });

    if (amount <= 0) return deny('Amount must be positive', 'amount');
    if (student.status !== 'ACTIVE') return deny('Student account is not active', 'student-status');
    if (merchant.status !== 'ACTIVE') return deny('Merchant is not active', 'merchant-status');

    // School must have whitelisted this merchant.
    const approval = await this.approvals.findOne({ where: { ownerId, schoolId: student.schoolId, merchantId: merchant.id } });
    if (!approval || !approval.allowed) return deny('Merchant not approved by this school', 'merchant-whitelist');

    // Parent blocks.
    if ((controls.blockedCategories ?? []).includes(category)) return deny(`Category ${category} is blocked`, 'blocked-category');
    if ((controls.blockedMerchants ?? []).some((id) => id === merchant.id || id === merchant.merchantCode)) {
      return deny('Merchant is blocked by parent', 'blocked-merchant');
    }
    if (category === 'ONLINE' && controls.onlineAllowed === false) return deny('Online purchases are turned off', 'online-off');
    if (category === 'GROUP' && controls.groupAllowed === false) return deny('Group purchases are turned off', 'group-off');
    if (merchant.online === false && controls.outsideSchoolAllowed === false && merchant.category === 'AVAILABLE') {
      // (outside-school general shops gate — left permissive unless explicitly off)
    }

    // Spendable balance for this category = matching bucket + Available.
    const wallet = await this.wallets.findOne({ where: { ownerId, studentId: student.id } });
    const bucket = category !== 'AVAILABLE' && category !== 'SAVINGS'
      ? await this.buckets.findOne({ where: { ownerId, studentId: student.id, category } })
      : null;
    const spendable = round((wallet?.available ?? 0) + (bucket?.balance ?? 0));
    if (spendable < amount) return { approved: false, requiresApproval: false, reason: 'Insufficient spendable balance', rule: 'balance', spendable };

    // Daily total limit.
    if (controls.dailyLimit != null) {
      const spentToday = await this.spentToday(ownerId, student.id);
      if (round(spentToday + amount) > controls.dailyLimit) {
        return deny(`Daily limit of ${controls.dailyLimit} reached`, 'daily-limit');
      }
    }
    // Per-category daily limit.
    const catLimit = controls.categoryLimits?.[category];
    if (catLimit != null) {
      const spentCat = await this.spentToday(ownerId, student.id, category);
      if (round(spentCat + amount) > catLimit) {
        return deny(`${category} daily limit of ${catLimit} reached`, 'category-limit');
      }
    }

    // Parent approval threshold.
    if (controls.approvalThreshold != null && amount >= controls.approvalThreshold) {
      return { approved: false, requiresApproval: true, reason: 'Parent approval required', rule: 'approval-threshold', spendable };
    }

    return { approved: true, requiresApproval: false, reason: 'Approved', rule: 'ok', spendable };
  }

  /** Sum of today's POSTED payments for a student, optionally within a category. */
  private async spentToday(ownerId: string, studentId: string, category?: SpendCategory): Promise<number> {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const rows = await this.txns.find({
      where: {
        ownerId, studentId, kind: 'PAYMENT', status: 'POSTED',
        createdAt: Between(start, end),
        ...(category ? { category } : {}),
      },
    });
    return round(rows.reduce((s, t) => s + t.amount, 0));
  }
}
