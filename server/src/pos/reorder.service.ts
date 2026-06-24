import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { PosOrderItem, PosProduct } from './pos.entity';

/**
 * Reorder intelligence — looks at the last `windowDays` of POS sales
 * to compute per-SKU velocity, compares against current stock + a
 * standard 14-day lead time, and returns suggestions ordered by
 * urgency.
 *
 * Two simple signals:
 *   daysOfCover = stock / (sales/day in window)
 *   reorderBy   = today + max(0, daysOfCover - leadTimeDays)
 *
 * urgency:
 *   CRITICAL — already out of stock with non-zero velocity
 *   URGENT   — reorderBy is in the past (will stock-out before goods arrive)
 *   SOON     — reorderBy is within 7 days
 *   OK       — cover > leadTime + 7
 *   NO_SALES — no sales in the window; we don't suggest a reorder
 */
export type ReorderUrgency = 'CRITICAL' | 'URGENT' | 'SOON' | 'OK' | 'NO_SALES';

export interface ReorderSuggestion {
  productId: string;
  sku: string;
  name: string;
  stock: number;
  unit: string;
  /** Average units sold per day in the lookback window. */
  velocity: number;
  unitsSoldInWindow: number;
  daysOfCover: number | null;     // null when velocity is 0
  reorderByIso: string | null;    // null when no suggestion needed
  suggestedReorderQty: number;    // 0 when no suggestion
  urgency: ReorderUrgency;
}

@Injectable()
export class ReorderService {
  constructor(
    @InjectRepository(PosProduct)   private readonly products: Repository<PosProduct>,
    @InjectRepository(PosOrderItem) private readonly items:    Repository<PosOrderItem>,
  ) {}

  async suggestions(
    uid: string,
    opts: { windowDays?: number; leadTimeDays?: number; targetCoverDays?: number } = {},
  ): Promise<ReorderSuggestion[]> {
    const windowDays    = opts.windowDays    ?? 30;
    const leadTimeDays  = opts.leadTimeDays  ?? 14;
    const targetCover   = opts.targetCoverDays ?? leadTimeDays + 30;  // cover 1mo past lead time

    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const until = new Date();

    const [products, items] = await Promise.all([
      this.products.find({ where: { ownerId: uid, active: true } }),
      this.items.find({
        where: { ownerId: uid, createdAt: Between(since, until) },
      }),
    ]);

    // Aggregate per-product units sold in the window. PosOrderItem
    // already snapshotted productId / unit so we don't need a JOIN.
    const soldByProduct = new Map<string, number>();
    for (const it of items) {
      soldByProduct.set(it.productId, (soldByProduct.get(it.productId) ?? 0) + Number(it.quantity));
    }

    const today = new Date();
    return products
      .map((p): ReorderSuggestion => {
        const sold = soldByProduct.get(p.id) ?? 0;
        const velocity = sold / windowDays;
        const stock = Number(p.stock) || 0;

        let urgency: ReorderUrgency = 'OK';
        let daysOfCover: number | null = velocity > 0 ? stock / velocity : null;
        let reorderByIso: string | null = null;
        let suggestedReorderQty = 0;

        if (velocity === 0) {
          urgency = 'NO_SALES';
        } else {
          if (stock <= 0) {
            urgency = 'CRITICAL';
          } else if (daysOfCover != null && daysOfCover <= leadTimeDays) {
            urgency = 'URGENT';
          } else if (daysOfCover != null && daysOfCover <= leadTimeDays + 7) {
            urgency = 'SOON';
          }
          if (urgency !== 'OK') {
            // Refill to cover targetCover days from arrival, minus
            // whatever we still have on the shelf when goods land.
            const stockAtArrival = Math.max(0, stock - velocity * leadTimeDays);
            const targetUnits = velocity * targetCover;
            suggestedReorderQty = Math.max(0, Math.ceil(targetUnits - stockAtArrival));
            // reorderBy: when current stock runs out minus lead time.
            const daysUntilOrder = Math.max(0, (daysOfCover ?? 0) - leadTimeDays);
            const date = new Date(today.getTime() + daysUntilOrder * 86_400_000);
            reorderByIso = date.toISOString().slice(0, 10);
          }
        }

        return {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          stock,
          unit: p.unit || 'piece',
          velocity: parseFloat(velocity.toFixed(3)),
          unitsSoldInWindow: parseFloat(sold.toFixed(2)),
          daysOfCover: daysOfCover != null ? parseFloat(daysOfCover.toFixed(1)) : null,
          reorderByIso,
          suggestedReorderQty,
          urgency,
        };
      })
      // Surface actionable rows first — sort by urgency then by speed
      // (fastest movers within the same urgency bucket get attention
      // first because mis-ordering them costs the most).
      .sort((a, b) => {
        const order: Record<ReorderUrgency, number> = { CRITICAL: 0, URGENT: 1, SOON: 2, OK: 3, NO_SALES: 4 };
        if (order[a.urgency] !== order[b.urgency]) return order[a.urgency] - order[b.urgency];
        return b.velocity - a.velocity;
      });
  }
}
