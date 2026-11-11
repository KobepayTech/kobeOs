import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PalmPesaService } from '../creators/palmpesa.service';
import { User } from '../users/user.entity';
import { PosOrder } from './pos.entity';
import { OrdersService } from './pos.service';

const TX_PREFIX = 'SOCIAL-';
const CALLBACK_PATH = '/api/pos/social-checkout/palmpesa';
const MIN_CHECK_INTERVAL = 15_000;
const EXPIRED_RECHECK_WINDOW = 3 * 24 * 60 * 60_000;
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

@Injectable()
export class SocialCheckoutPaymentsService {
  private readonly logger = new Logger(SocialCheckoutPaymentsService.name);

  constructor(
    @InjectRepository(PosOrder) private readonly orders: Repository<PosOrder>,
    private readonly sales: OrdersService,
    private readonly provider: PalmPesaService,
    private readonly config: ConfigService,
  ) {}

  async prepare(ownerId: string, phone: string) {
    if (!this.provider.isConfigured()) throw new ServiceUnavailableException('Mobile money is unavailable for this shop.');
    if (!/^(?:\+?255|0)?[67]\d{8}$/.test(phone.replace(/[\s-]/g, ''))) {
      throw new BadRequestException('Enter a valid Tanzanian mobile-money number.');
    }
    const merchant = await this.orders.manager.getRepository(User).findOne({ where: { id: ownerId }, select: { email: true } });
    const email = this.config.get<string>('PALMPESA_CHECKOUT_EMAIL')?.trim() || merchant?.email || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ServiceUnavailableException('The shop needs a payment contact email.');
    const callbackUrl = this.provider.callbackBase.replace(/\/+$/, '') + CALLBACK_PATH;
    if (!callbackUrl.startsWith('https://')) throw new ServiceUnavailableException('Mobile money requires a public HTTPS callback.');
    return { email, callbackUrl };
  }

  publicState(order: PosOrder) {
    return { orderNumber: order.orderNumber, paymentState: order.checkoutPaymentState, amount: Number(order.total), currency: order.currency };
  }

  async reconcile(order: PosOrder) {
    if (!order.checkoutPaymentDetails || !this.provider.isConfigured()) return order;
    const claimed = await this.orders.createQueryBuilder().update()
      .set({ checkoutPaymentCheckedAt: new Date() })
      .where('id = :id AND "checkoutPaymentState" IN (\'PENDING\', \'EXPIRED\')', { id: order.id })
      .andWhere('("checkoutPaymentCheckedAt" IS NULL OR "checkoutPaymentCheckedAt" <= :cutoff)', {
        cutoff: new Date(Date.now() - MIN_CHECK_INTERVAL),
      }).execute();
    if (!claimed.affected) return (await this.orders.findOneBy({ id: order.id })) || order;

    try {
      const details = order.checkoutPaymentDetails;
      let providerOrderId = details.providerOrderId;
      if (!providerOrderId) {
        const accepted = await this.provider.requestCheckoutPayment({
          transactionId: TX_PREFIX + order.id, amount: Number(order.total), phone: order.customerPhone || '',
          name: (order.customerName || 'KobeOS buyer').slice(0, 255), email: details.email, callbackUrl: details.callbackUrl,
        });
        await this.sales.applyCheckoutPayment(order.id, { ...accepted, status: 'PENDING' });
        providerOrderId = accepted.order_id;
      }
      const status = await this.provider.checkoutPaymentStatus(providerOrderId);
      // The status lookup is always anchored to the provider ID assigned to this order.
      if (status.order_id !== providerOrderId) throw new Error('PalmPesa returned a different order reference.');
      await this.sales.applyCheckoutPayment(order.id, status);
    } catch {
      // A timeout or an inconsistent provider reply cannot prove failure.
      // Reconcile again with the same transaction ID. Never send a fresh charge here.
      this.logger.warn(`PalmPesa settlement could not be verified for order ${order.id}`);
    }
    return (await this.orders.findOneBy({ id: order.id })) || order;
  }

  async notify(payload: Record<string, unknown>) {
    const transactionId = typeof payload?.transaction_id === 'string' ? payload.transaction_id : '';
    const id = transactionId.slice(TX_PREFIX.length);
    if (!transactionId.startsWith(TX_PREFIX) || !UUID.test(id)) return;
    const order = await this.orders.findOneBy({ id });
    // The callback is just a wake-up signal. No callback field can mark an
    // order paid, even when a provider account does not have signing enabled.
    if (!order?.checkoutPaymentDetails?.providerOrderId ||
        order.checkoutPaymentDetails.providerOrderId !== payload.order_id) return;
    await this.reconcile(order);
  }

  @Cron('20 * * * * *', { waitForCompletion: true })
  async reconcileOpenPayments() {
    if (!this.provider.isConfigured()) return;
    const batch = await this.orders.createQueryBuilder('checkout')
      .where(`(checkout."checkoutPaymentState" = 'PENDING' OR
        (checkout."checkoutPaymentState" = 'EXPIRED' AND checkout."createdAt" >= :expiredSince))`, {
        expiredSince: new Date(Date.now() - EXPIRED_RECHECK_WINDOW),
      })
      .andWhere('(checkout."checkoutPaymentCheckedAt" IS NULL OR checkout."checkoutPaymentCheckedAt" <= :cutoff)', {
        cutoff: new Date(Date.now() - 60_000),
      }).orderBy('checkout."checkoutPaymentCheckedAt"', 'ASC', 'NULLS FIRST')
      .addOrderBy('checkout."createdAt"', 'ASC').take(24).getMany();
    for (const order of batch) await this.reconcile(order);
  }
}
