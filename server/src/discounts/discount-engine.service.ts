import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Coupon, DiscountRule } from './discount.entity';

export interface DiscountInput {
  subtotal: number;
  customerScope?: string;
  couponCode?: string;
  approvedBy?: string;
}

export interface DiscountBreakdownLine {
  source: 'rule' | 'coupon';
  label: string;
  amount: number;
}

export interface DiscountResult {
  discountAmount: number;
  breakdown: DiscountBreakdownLine[];
  requiresApproval: boolean;
  appliedCouponId?: string;
}

const APPROVAL_THRESHOLD_PCT = 20;

@Injectable()
export class DiscountEngine {
  constructor(
    @InjectRepository(DiscountRule) private readonly rules: Repository<DiscountRule>,
    @InjectRepository(Coupon) private readonly coupons: Repository<Coupon>,
  ) {}

  /**
   * Compute discount for a subtotal. Reads active rules (matching the
   * customer scope) plus an optional coupon. Caller is responsible for
   * incrementing coupon usage inside the same transaction via
   * {@link consumeCoupon} once the order is committed.
   *
   * If the combined discount exceeds {@link APPROVAL_THRESHOLD_PCT}% of the
   * subtotal, `requiresApproval` is set; callers should reject the order
   * unless an `approvedBy` value was supplied.
   */
  async apply(uid: string, input: DiscountInput): Promise<DiscountResult> {
    const subtotal = Number(input.subtotal);
    if (subtotal < 0) throw new BadRequestException('Subtotal must be >= 0');

    const breakdown: DiscountBreakdownLine[] = [];
    let discount = 0;

    const activeRules = await this.rules.find({ where: { ownerId: uid, status: 'Active' } });
    const now = Date.now();
    for (const rule of activeRules) {
      if (rule.startDate && now < new Date(rule.startDate).getTime()) continue;
      if (rule.endDate && now > new Date(rule.endDate).getTime()) continue;
      if (rule.customerScope !== 'All' && rule.customerScope !== input.customerScope) continue;
      const amount = computeAmount(rule.type, Number(rule.value), subtotal);
      if (amount > 0) {
        breakdown.push({ source: 'rule', label: rule.name, amount });
        discount += amount;
      }
    }

    let appliedCouponId: string | undefined;
    if (input.couponCode) {
      const coupon = await this.coupons.findOne({
        where: { ownerId: uid, code: input.couponCode, active: true },
      });
      if (!coupon) throw new NotFoundException(`Coupon ${input.couponCode} not found`);
      if (coupon.expiresAt && now > new Date(coupon.expiresAt).getTime()) {
        throw new BadRequestException(`Coupon ${input.couponCode} has expired`);
      }
      if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
        throw new BadRequestException(`Coupon ${input.couponCode} usage limit reached`);
      }
      const amount = computeAmount(coupon.type, Number(coupon.value), subtotal);
      breakdown.push({ source: 'coupon', label: coupon.code, amount });
      discount += amount;
      appliedCouponId = coupon.id;
    }

    discount = Math.min(discount, subtotal);
    discount = parseFloat(discount.toFixed(4));

    const pct = subtotal === 0 ? 0 : (discount / subtotal) * 100;
    const requiresApproval = pct > APPROVAL_THRESHOLD_PCT && !input.approvedBy;

    return { discountAmount: discount, breakdown, requiresApproval, appliedCouponId };
  }

  /** Bump the coupon usage counter inside the order's transaction. */
  async consumeCoupon(tx: EntityManager, couponId: string) {
    const repo = tx.getRepository(Coupon);
    await repo.increment({ id: couponId }, 'usageCount', 1);
  }
}

function computeAmount(type: string, value: number, subtotal: number): number {
  if (type === 'Percentage') return parseFloat(((subtotal * value) / 100).toFixed(4));
  if (type === 'Fixed') return Math.min(value, subtotal);
  return 0;
}
