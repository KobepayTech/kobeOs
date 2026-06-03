import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CreditProfile, CreditReceivable } from './credit.entity';
import { RecordPaymentDto, UpsertCreditProfileDto } from './dto/credit.dto';
import { JournalService } from '../erp/journal.service';

export interface BnplApprovalInput {
  customerPhone: string;
  customerName?: string | null;
  amount: number;
  installmentMonths?: number;
  orderId?: string | null;
  currency?: string;
}

@Injectable()
export class CreditService {
  constructor(
    @InjectRepository(CreditProfile) private readonly profiles: Repository<CreditProfile>,
    @InjectRepository(CreditReceivable) private readonly receivables: Repository<CreditReceivable>,
    private readonly journal: JournalService,
    private readonly ds: DataSource,
  ) {}

  listProfiles(uid: string) {
    return this.profiles.find({ where: { ownerId: uid }, order: { customerName: 'ASC' } });
  }

  async getByPhone(uid: string, phone: string) {
    const profile = await this.profiles.findOne({ where: { ownerId: uid, customerPhone: phone } });
    if (!profile) throw new NotFoundException('Credit profile not found');
    return { ...profile, availableCredit: this.available(profile) };
  }

  /**
   * Public-safe eligibility lookup for the storefront BNPL flow. Returns
   * a shape the storefront can show the buyer without leaking internal
   * profile details (no name, no notes, no risk grade), and never throws
   * when the buyer has no profile — just reports {eligible: false}.
   */
  async checkEligibility(uid: string, phone: string): Promise<{
    eligible: boolean;
    availableCredit: number;
    creditLimit: number;
    currency: string;
    reason?: 'no_profile' | 'inactive';
  }> {
    const profile = await this.profiles.findOne({ where: { ownerId: uid, customerPhone: phone } });
    if (!profile) {
      return { eligible: false, availableCredit: 0, creditLimit: 0, currency: 'TZS', reason: 'no_profile' };
    }
    if (!profile.active) {
      return {
        eligible: false,
        availableCredit: 0,
        creditLimit: Number(profile.creditLimit),
        currency: profile.currency,
        reason: 'inactive',
      };
    }
    return {
      eligible: this.available(profile) > 0,
      availableCredit: this.available(profile),
      creditLimit: Number(profile.creditLimit),
      currency: profile.currency,
    };
  }

  async upsert(uid: string, dto: UpsertCreditProfileDto) {
    const existing = await this.profiles.findOne({
      where: { ownerId: uid, customerPhone: dto.customerPhone },
    });
    if (existing) {
      Object.assign(existing, dto);
      return this.profiles.save(existing);
    }
    return this.profiles.save(this.profiles.create({ ...dto, ownerId: uid }));
  }

  listReceivables(uid: string) {
    return this.receivables.find({ where: { ownerId: uid }, order: { dueDate: 'ASC' } });
  }

  /**
   * BNPL credit check + receivable creation. Runs inside the POS order
   * transaction so the receivable + outstanding bump commit atomically
   * with the sale. Throws if the customer has no credit profile or
   * insufficient available credit.
   */
  async approveAndReserveInTransaction(tx: EntityManager, uid: string, input: BnplApprovalInput) {
    if (!input.customerPhone) {
      throw new BadRequestException('BNPL requires a customer phone number');
    }
    if (input.amount <= 0) throw new BadRequestException('BNPL amount must be > 0');

    const profileRepo = tx.getRepository(CreditProfile);
    const receivableRepo = tx.getRepository(CreditReceivable);

    const profile = await profileRepo.findOne({
      where: { ownerId: uid, customerPhone: input.customerPhone },
    });
    if (!profile) {
      throw new BadRequestException(
        `No credit profile for ${input.customerPhone} — create one before BNPL checkout`,
      );
    }
    if (!profile.active) throw new BadRequestException('Credit profile is inactive');

    // Atomic credit-headroom check: SET outstanding = outstanding +
    // :amount WHERE creditLimit - outstanding >= :amount. If no rows are
    // affected another concurrent BNPL just consumed the headroom — fail
    // with the same insufficient-credit error rather than overcommit.
    const ok = await profileRepo
      .createQueryBuilder()
      .update(CreditProfile)
      .set({ outstanding: () => `outstanding + ${input.amount}` })
      .where(
        'id = :id AND "ownerId" = :uid AND "creditLimit" - outstanding >= :amt',
        { id: profile.id, uid, amt: input.amount },
      )
      .execute();
    if (ok.affected === 0) {
      const refreshed = await profileRepo.findOne({ where: { id: profile.id } });
      const available = refreshed ? this.available(refreshed) : 0;
      throw new BadRequestException(
        `BNPL denied: requested ${input.amount.toFixed(2)} ${profile.currency}, available ${available.toFixed(2)}`,
      );
    }
    profile.outstanding = parseFloat((Number(profile.outstanding) + input.amount).toFixed(4));

    const months = input.installmentMonths ?? 1;
    const monthly = parseFloat((input.amount / months).toFixed(4));
    const due = new Date();
    due.setMonth(due.getMonth() + months);

    const receivable = await receivableRepo.save(
      receivableRepo.create({
        ownerId: uid,
        profileId: profile.id,
        orderId: input.orderId ?? null,
        customerPhone: input.customerPhone,
        amount: input.amount,
        paid: 0,
        currency: input.currency ?? profile.currency,
        installmentMonths: months,
        monthlyAmount: monthly,
        dueDate: due,
        status: 'OUTSTANDING',
      }),
    );

    return { profile, receivable, availableCredit: this.available(profile) };
  }

  async recordPayment(uid: string, receivableId: string, dto: RecordPaymentDto) {
    return this.ds.transaction(async (tx) => {
      const recRepo = tx.getRepository(CreditReceivable);
      const profileRepo = tx.getRepository(CreditProfile);

      const r = await recRepo.findOne({ where: { id: receivableId, ownerId: uid } });
      if (!r) throw new NotFoundException();

      const newPaid = parseFloat((Number(r.paid) + dto.amount).toFixed(4));
      const amount = Number(r.amount);
      if (newPaid > amount) {
        throw new BadRequestException(`Payment exceeds outstanding (${amount - Number(r.paid)})`);
      }
      r.paid = newPaid;
      r.status = newPaid >= amount ? 'PAID' : 'PARTIAL';
      await recRepo.save(r);

      // Atomic outstanding decrement, floored at zero. GREATEST(...) keeps
      // the column non-negative even if a stale total briefly slipped past
      // a prior write — the value never goes below zero on disk.
      await profileRepo
        .createQueryBuilder()
        .update(CreditProfile)
        .set({ outstanding: () => `GREATEST(outstanding - ${dto.amount}, 0)` })
        .where('id = :id AND "ownerId" = :uid', { id: r.profileId, uid })
        .execute();

      // Auto journal: DR Cash, CR Accounts Receivable.
      await this.journal.postReceivablePaymentInTransaction(
        tx, uid, dto.amount, dto.reference ?? `Receivable ${r.id.slice(0, 8)}`,
      );
      return r;
    });
  }

  private available(profile: CreditProfile): number {
    return parseFloat((Number(profile.creditLimit) - Number(profile.outstanding)).toFixed(4));
  }
}
