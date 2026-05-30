import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CreditProfile, CreditReceivable } from './credit.entity';
import { RecordPaymentDto, UpsertCreditProfileDto } from './dto/credit.dto';

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
  ) {}

  listProfiles(uid: string) {
    return this.profiles.find({ where: { ownerId: uid }, order: { customerName: 'ASC' } });
  }

  async getByPhone(uid: string, phone: string) {
    const profile = await this.profiles.findOne({ where: { ownerId: uid, customerPhone: phone } });
    if (!profile) throw new NotFoundException('Credit profile not found');
    return { ...profile, availableCredit: this.available(profile) };
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

    const available = this.available(profile);
    if (input.amount > available) {
      throw new BadRequestException(
        `BNPL denied: requested ${input.amount.toFixed(2)} ${profile.currency}, available ${available.toFixed(2)}`,
      );
    }

    profile.outstanding = parseFloat((Number(profile.outstanding) + input.amount).toFixed(4));
    await profileRepo.save(profile);

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
    const r = await this.receivables.findOne({ where: { id: receivableId, ownerId: uid } });
    if (!r) throw new NotFoundException();

    const newPaid = parseFloat((Number(r.paid) + dto.amount).toFixed(4));
    const amount = Number(r.amount);
    if (newPaid > amount) {
      throw new BadRequestException(`Payment exceeds outstanding (${amount - Number(r.paid)})`);
    }
    r.paid = newPaid;
    r.status = newPaid >= amount ? 'PAID' : 'PARTIAL';
    await this.receivables.save(r);

    const profile = await this.profiles.findOne({ where: { id: r.profileId, ownerId: uid } });
    if (profile) {
      profile.outstanding = parseFloat((Number(profile.outstanding) - dto.amount).toFixed(4));
      if (profile.outstanding < 0) profile.outstanding = 0;
      await this.profiles.save(profile);
    }
    return r;
  }

  private available(profile: CreditProfile): number {
    return parseFloat((Number(profile.creditLimit) - Number(profile.outstanding)).toFixed(4));
  }
}
