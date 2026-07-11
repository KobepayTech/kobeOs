import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { HotelWallet, HotelWalletTxn, HotelPayout, HotelPayoutStatus } from './hotel-wallet.entity';

const money = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;

export interface CreditInput {
  bookingId: string;
  amount: number;
  currency?: string;
  hotelId?: string | null;
  description?: string;
}

export interface RequestPayoutInput {
  amount: number;
  method?: HotelPayout['method'];
  destination?: string;
  notes?: string;
}

@Injectable()
export class HotelWalletService {
  private readonly logger = new Logger(HotelWalletService.name);

  constructor(
    @InjectRepository(HotelWallet) private readonly wallets: Repository<HotelWallet>,
    @InjectRepository(HotelWalletTxn) private readonly txns: Repository<HotelWalletTxn>,
    @InjectRepository(HotelPayout) private readonly payouts: Repository<HotelPayout>,
    private readonly ds: DataSource,
    private readonly config: ConfigService,
  ) {}

  /** Platform default commission percent (overridable per wallet). */
  private get defaultCommissionPct(): number {
    return Number(this.config.get('HOTEL_PLATFORM_COMMISSION_PCT', 10)) || 0;
  }

  async ensureWallet(ownerId: string, currency = 'TZS'): Promise<HotelWallet> {
    let w = await this.wallets.findOne({ where: { ownerId } });
    if (!w) w = await this.wallets.save(this.wallets.create({ ownerId, currency, balance: 0 }));
    return w;
  }

  /**
   * Credit a hotel's wallet when a booking is paid. Net of platform
   * commission. Idempotent: a second call for the same bookingId is a
   * no-op, so a duplicate PalmPesa callback can't double-credit.
   */
  async creditForBooking(ownerId: string, input: CreditInput): Promise<void> {
    const gross = money(input.amount);
    if (gross <= 0) return;

    await this.ds.transaction(async (tx) => {
      const wRepo = tx.getRepository(HotelWallet);
      const tRepo = tx.getRepository(HotelWalletTxn);

      // Idempotency guard — already credited this booking?
      const existing = await tRepo.findOne({ where: { ownerId, bookingId: input.bookingId, type: 'CREDIT' } });
      if (existing) return;

      let wallet = await wRepo.findOne({ where: { ownerId } });
      if (!wallet) wallet = await wRepo.save(wRepo.create({ ownerId, currency: input.currency ?? 'TZS', balance: 0 }));

      const pct = wallet.commissionRatePct != null ? Number(wallet.commissionRatePct) : this.defaultCommissionPct;
      const commission = money((gross * pct) / 100);
      const net = money(gross - commission);

      wallet.balance = money(Number(wallet.balance) + net);
      wallet.totalEarned = money(Number(wallet.totalEarned) + gross);
      wallet.totalCommission = money(Number(wallet.totalCommission) + commission);
      await wRepo.save(wallet);

      await tRepo.save(tRepo.create({
        ownerId, type: 'CREDIT', amount: net, direction: 'credit', currency: wallet.currency,
        balanceAfter: wallet.balance, bookingId: input.bookingId, hotelId: input.hotelId ?? null,
        description: input.description || `Room booking payment (gross ${gross}, ${pct}% commission)`,
      }));
      if (commission > 0) {
        await tRepo.save(tRepo.create({
          ownerId, type: 'COMMISSION', amount: commission, direction: 'debit', currency: wallet.currency,
          balanceAfter: wallet.balance, bookingId: input.bookingId, hotelId: input.hotelId ?? null,
          description: `Platform commission ${pct}%`,
        }));
      }
      this.logger.log(`Hotel wallet ${ownerId} credited ${net} ${wallet.currency} for booking ${input.bookingId} (commission ${commission}).`);
    });
  }

  /* ── Reads ── */

  async summary(ownerId: string) {
    const wallet = await this.ensureWallet(ownerId);
    const [recentTxns, pendingPayouts] = await Promise.all([
      this.txns.find({ where: { ownerId }, order: { createdAt: 'DESC' }, take: 50 }),
      this.payouts.find({ where: { ownerId, status: 'PENDING' }, order: { createdAt: 'DESC' } }),
    ]);
    return { wallet, recentTxns, pendingPayouts, defaultCommissionPct: this.defaultCommissionPct };
  }

  listTxns(ownerId: string, limit = 200) {
    return this.txns.find({ where: { ownerId }, order: { createdAt: 'DESC' }, take: Math.min(1000, limit) });
  }

  listPayouts(ownerId: string) {
    return this.payouts.find({ where: { ownerId }, order: { createdAt: 'DESC' }, take: 500 });
  }

  /* ── Payouts ── */

  async requestPayout(ownerId: string, dto: RequestPayoutInput, actorName = '') {
    const amount = money(dto.amount);
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    return this.ds.transaction(async (tx) => {
      const wRepo = tx.getRepository(HotelWallet);
      const pRepo = tx.getRepository(HotelPayout);
      const tRepo = tx.getRepository(HotelWalletTxn);

      const wallet = await wRepo.findOne({ where: { ownerId } });
      if (!wallet) throw new BadRequestException('No wallet — nothing to pay out yet');
      if (amount > Number(wallet.balance)) throw new BadRequestException(`Amount exceeds balance (${wallet.balance} ${wallet.currency})`);

      const payout = await pRepo.save(pRepo.create({
        ownerId, amount, currency: wallet.currency,
        method: dto.method ?? 'MobileMoney', destination: dto.destination ?? '',
        status: 'PENDING', requestedByName: actorName, notes: dto.notes ?? '',
      }));

      // Reserve the funds immediately so a second request can't overspend.
      wallet.balance = money(Number(wallet.balance) - amount);
      await wRepo.save(wallet);
      await tRepo.save(tRepo.create({
        ownerId, type: 'PAYOUT', amount, direction: 'debit', currency: wallet.currency,
        balanceAfter: wallet.balance, payoutId: payout.id,
        description: `Payout requested (${payout.method}${payout.destination ? ` → ${payout.destination}` : ''})`,
      }));
      return payout;
    });
  }

  /** Admin transitions a payout. PAID stamps it; FAILED refunds the wallet. */
  async setPayoutStatus(ownerId: string, id: string, status: HotelPayoutStatus, actorName = '', reference = '') {
    return this.ds.transaction(async (tx) => {
      const wRepo = tx.getRepository(HotelWallet);
      const pRepo = tx.getRepository(HotelPayout);
      const tRepo = tx.getRepository(HotelWalletTxn);

      const payout = await pRepo.findOne({ where: { ownerId, id } });
      if (!payout) throw new NotFoundException('Payout not found');
      if (payout.status !== 'PENDING') throw new BadRequestException(`Payout already ${payout.status}`);

      payout.status = status;
      payout.processedByName = actorName;
      payout.processedAt = new Date();
      if (reference) payout.reference = reference;
      await pRepo.save(payout);

      const wallet = await wRepo.findOne({ where: { ownerId } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      if (status === 'PAID') {
        wallet.totalPaidOut = money(Number(wallet.totalPaidOut) + Number(payout.amount));
        await wRepo.save(wallet);
      } else if (status === 'FAILED') {
        // Return the reserved funds to the balance.
        wallet.balance = money(Number(wallet.balance) + Number(payout.amount));
        await wRepo.save(wallet);
        await tRepo.save(tRepo.create({
          ownerId, type: 'REVERSAL', amount: Number(payout.amount), direction: 'credit', currency: wallet.currency,
          balanceAfter: wallet.balance, payoutId: payout.id, description: 'Payout failed — funds returned',
        }));
      }
      return payout;
    });
  }

  /* ── Platform admin (cross-hotel) ── */

  async platformOverview() {
    const [wallets, pendingPayouts] = await Promise.all([
      this.wallets.find({ order: { balance: 'DESC' }, take: 1000 }),
      this.payouts.find({ where: { status: 'PENDING' }, order: { createdAt: 'DESC' }, take: 1000 }),
    ]);
    const totals = wallets.reduce(
      (acc, w) => {
        acc.balance += Number(w.balance);
        acc.earned += Number(w.totalEarned);
        acc.commission += Number(w.totalCommission);
        acc.paidOut += Number(w.totalPaidOut);
        return acc;
      },
      { balance: 0, earned: 0, commission: 0, paidOut: 0 },
    );
    return { wallets, pendingPayouts, totals, hotels: wallets.length };
  }
}
