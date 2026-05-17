import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreatorEscrow } from './escrow.entity';
import { Campaign } from './campaign.entity';
import { Wallet, PaymentTransaction } from '../payments/payments.entity';

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    @InjectRepository(CreatorEscrow)
    private readonly escrows: Repository<CreatorEscrow>,
    @InjectRepository(Campaign)
    private readonly campaigns: Repository<Campaign>,
    @InjectRepository(Wallet)
    private readonly wallets: Repository<Wallet>,
    @InjectRepository(PaymentTransaction)
    private readonly txns: Repository<PaymentTransaction>,
    private readonly ds: DataSource,
  ) {}

  // ── Hold ────────────────────────────────────────────────────────────────────

  /**
   * Lock funds from the advertiser's wallet into escrow for a specific offer.
   * Called when an advertiser confirms a campaign budget.
   */
  async hold(params: {
    advertiserId: string;
    creatorId: string;
    campaignId: string;
    offerId: string;
    amountTzs: number;
    platformFeePercent: number;
    advertiserWalletId: string;
  }): Promise<CreatorEscrow> {
    const { advertiserId, creatorId, campaignId, offerId, amountTzs, platformFeePercent, advertiserWalletId } = params;

    // Idempotency: return existing escrow if already held for this offer
    const existing = await this.escrows.findOne({ where: { campaignId, offerId } });
    if (existing) return existing;

    const feeTzs = parseFloat((amountTzs * platformFeePercent / 100).toFixed(2));
    const netAmountTzs = parseFloat((amountTzs - feeTzs).toFixed(2));

    return this.ds.transaction(async (tx) => {
      const wRepo = tx.getRepository(Wallet);
      const tRepo = tx.getRepository(PaymentTransaction);
      const eRepo = tx.getRepository(CreatorEscrow);

      const wallet = await wRepo.findOne({ where: { id: advertiserWalletId, ownerId: advertiserId } });
      if (!wallet) throw new NotFoundException('Advertiser wallet not found');
      if (Number(wallet.balance) < amountTzs) {
        throw new BadRequestException(`Insufficient funds. Need ${amountTzs} TZS, have ${wallet.balance} TZS`);
      }

      // Debit advertiser wallet
      wallet.balance = parseFloat((Number(wallet.balance) - amountTzs).toFixed(4));
      await wRepo.save(wallet);

      const holdTx = await tRepo.save(tRepo.create({
        ownerId: advertiserId,
        walletId: advertiserWalletId,
        type: 'DEBIT',
        amount: amountTzs,
        currency: wallet.currency,
        status: 'COMPLETED',
        description: `Escrow hold for campaign offer ${offerId}`,
        reference: `escrow:${offerId}`,
      }));

      const escrow = await eRepo.save(eRepo.create({
        advertiserId,
        creatorId,
        campaignId,
        offerId,
        amountTzs,
        feeTzs,
        netAmountTzs,
        status: 'held',
        advertiserWalletId,
        holdTxId: holdTx.id,
      }));

      // Link escrow ID back to campaign
      await tx.getRepository(Campaign).update(campaignId, { escrowId: escrow.id });

      this.logger.log(`Escrow held: ${amountTzs} TZS for offer ${offerId}`);
      return escrow;
    });
  }

  // ── Release ─────────────────────────────────────────────────────────────────

  /**
   * Release escrowed funds to the creator after KPI verification.
   * Requires the creator to have a Kobepay wallet.
   */
  async release(escrowId: string, creatorWalletId: string): Promise<CreatorEscrow> {
    const escrow = await this.escrows.findOne({ where: { id: escrowId } });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (escrow.status !== 'held') {
      throw new BadRequestException(`Escrow is already ${escrow.status}`);
    }

    return this.ds.transaction(async (tx) => {
      const wRepo = tx.getRepository(Wallet);
      const tRepo = tx.getRepository(PaymentTransaction);
      const eRepo = tx.getRepository(CreatorEscrow);

      const creatorWallet = await wRepo.findOne({
        where: { id: creatorWalletId, ownerId: escrow.creatorId },
      });
      if (!creatorWallet) throw new NotFoundException('Creator wallet not found');

      // Credit net amount to creator
      creatorWallet.balance = parseFloat((Number(creatorWallet.balance) + escrow.netAmountTzs).toFixed(4));
      await wRepo.save(creatorWallet);

      const releaseTx = await tRepo.save(tRepo.create({
        ownerId: escrow.creatorId,
        walletId: creatorWalletId,
        type: 'CREDIT',
        amount: escrow.netAmountTzs,
        currency: creatorWallet.currency,
        status: 'COMPLETED',
        description: `Escrow release for campaign offer ${escrow.offerId}`,
        reference: `escrow:${escrow.offerId}`,
      }));

      const updated = await eRepo.save({
        ...escrow,
        status: 'released' as const,
        creatorWalletId,
        releaseTxId: releaseTx.id,
        releasedAt: new Date(),
      });

      this.logger.log(`Escrow released: ${escrow.netAmountTzs} TZS to creator ${escrow.creatorId}`);
      return updated;
    });
  }

  // ── Refund ──────────────────────────────────────────────────────────────────

  /**
   * Return escrowed funds to the advertiser (campaign cancelled / KPIs not met).
   */
  async refund(escrowId: string, reason?: string): Promise<CreatorEscrow> {
    const escrow = await this.escrows.findOne({ where: { id: escrowId } });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (escrow.status !== 'held') {
      throw new BadRequestException(`Escrow is already ${escrow.status}`);
    }

    return this.ds.transaction(async (tx) => {
      const wRepo = tx.getRepository(Wallet);
      const tRepo = tx.getRepository(PaymentTransaction);
      const eRepo = tx.getRepository(CreatorEscrow);

      const advertiserWallet = await wRepo.findOne({
        where: { id: escrow.advertiserWalletId ?? undefined, ownerId: escrow.advertiserId },
      });
      if (!advertiserWallet) throw new NotFoundException('Advertiser wallet not found');

      advertiserWallet.balance = parseFloat((Number(advertiserWallet.balance) + escrow.amountTzs).toFixed(4));
      await wRepo.save(advertiserWallet);

      await tRepo.save(tRepo.create({
        ownerId: escrow.advertiserId,
        walletId: advertiserWallet.id,
        type: 'CREDIT',
        amount: escrow.amountTzs,
        currency: advertiserWallet.currency,
        status: 'COMPLETED',
        description: `Escrow refund for campaign offer ${escrow.offerId}`,
        reference: `escrow-refund:${escrow.offerId}`,
      }));

      const updated = await eRepo.save({
        ...escrow,
        status: 'refunded' as const,
        refundedAt: new Date(),
        notes: reason ?? null,
      });

      this.logger.log(`Escrow refunded: ${escrow.amountTzs} TZS to advertiser ${escrow.advertiserId}`);
      return updated;
    });
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  findByCampaign(campaignId: string) {
    return this.escrows.find({ where: { campaignId }, order: { createdAt: 'DESC' } });
  }

  findByAdvertiser(advertiserId: string) {
    return this.escrows.find({ where: { advertiserId }, order: { createdAt: 'DESC' } });
  }

  findByCreator(creatorId: string) {
    return this.escrows.find({ where: { creatorId }, order: { createdAt: 'DESC' } });
  }
}
