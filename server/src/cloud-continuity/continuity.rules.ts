/**
 * Allotment arithmetic and the reclaim state machine.
 *
 * Pure functions, no database: the invariants here are the ones that stop the
 * cloud and the main server selling the same room or the same last unit while
 * they cannot talk to each other, so they are worth being able to test on
 * their own.
 */

/**
 * ACTIVE            the cloud owns this capacity and may commit it
 * RECLAIM_REQUESTED KobeOS wants it back; the cloud must stop selling and say so
 * RELEASED          the cloud has acknowledged; KobeOS may sell it again
 *
 * There is deliberately no transition from ACTIVE straight to RELEASED. An
 * allotment is only safe to resell once the side that could have committed it
 * confirms that it has not and will not.
 */
export type AllotmentStatus = 'ACTIVE' | 'RECLAIM_REQUESTED' | 'RELEASED';

/** Outbox record kinds the cloud can originate. */
export type OutboxKind = 'BOOKING' | 'ORDER' | 'CANCELLATION' | 'ALLOTMENT_RELEASE';

export interface SnippetAllowance {
  /** Actual stock the merchant reported. Never reduced by an online sale. */
  stock: number;
  /** Units handed to the cloud. Set by an operator, not by a heartbeat. */
  allocatedQty: number;
  /** Units of that allotment the cloud has not sold yet. */
  remainingQty: number;
  /**
   * Units the cloud has sold but whose order has not synced back yet, so the
   * deduction has not landed on `stock`.
   *
   * Without this the hold on the shelf is released the instant the cloud makes
   * a sale, and the till can sell the same unit in the window before the order
   * arrives. remainingQty + committedQty stays constant across an online sale,
   * which is what keeps the unit reserved the whole way through.
   */
  committedQty: number;
}

const whole = (value: unknown): number => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Units KobeOS may sell locally: everything except what the cloud could still
 * commit.
 *
 * It subtracts remainingQty rather than allocatedQty on purpose. Once the
 * cloud sells a unit and the order syncs back, the deduction lands on `stock`;
 * subtracting the full allotment as well would hide that unit twice and the
 * shop would stop selling stock it actually has.
 */
export function localSellableQty(input: Pick<SnippetAllowance, 'stock' | 'remainingQty' | 'committedQty'>): number {
  const reserved = Math.max(0, whole(input.remainingQty)) + Math.max(0, whole(input.committedQty));
  return Math.max(0, whole(input.stock) - reserved);
}

/**
 * Apply a node heartbeat.
 *
 * The heartbeat is the merchant's own count and owns `stock` alone. It must
 * never touch the allowance: a heartbeat arriving after the cloud sold two of
 * three allotted units would otherwise restore remainingQty to three and the
 * same two units would be sold again.
 */
export function applyHeartbeatStock(current: SnippetAllowance, reportedStock: number): SnippetAllowance {
  const reported = whole(reportedStock);
  return {
    stock: reported >= 0 ? reported : whole(current.stock),
    allocatedQty: whole(current.allocatedQty),
    remainingQty: whole(current.remainingQty),
    committedQty: whole(current.committedQty),
  };
}

/**
 * Take `qty` units out of an allotment.
 *
 * Returns the new remaining count, or null when the allotment cannot cover it —
 * which is how the last unit is refused rather than oversold. Callers must
 * apply this inside a transaction that holds the row, so two concurrent
 * attempts cannot both read the same remaining count.
 */
export function consumeAllowance(remainingQty: number, qty: number): number | null {
  const want = whole(qty);
  const have = Math.max(0, whole(remainingQty));
  if (want <= 0) return null;
  if (want > have) return null;
  return have - want;
}

/**
 * Give back allotment the cloud did not sell. Capped at the original
 * allocation so a buggy or replayed release cannot inflate it.
 */
export function returnAllowance(remainingQty: number, allocatedQty: number, qty: number): number {
  const give = Math.max(0, whole(qty));
  return Math.min(Math.max(0, whole(allocatedQty)), Math.max(0, whole(remainingQty)) + give);
}

/**
 * Whether KobeOS may count an allotment's capacity as its own again.
 *
 * Expiry is not enough. A window that ended yesterday may still have a
 * reservation the cloud took and has not handed over, so the capacity only
 * comes back on an acknowledged release.
 */
export function isCapacityReclaimed(status: AllotmentStatus, acknowledgedAt: Date | null | undefined): boolean {
  return status === 'RELEASED' && Boolean(acknowledgedAt);
}

/**
 * Whether KobeOS must keep treating this allotment as the cloud's, which is
 * every state except an acknowledged release.
 */
export function blocksLocalSale(status: AllotmentStatus, acknowledgedAt: Date | null | undefined): boolean {
  return !isCapacityReclaimed(status, acknowledgedAt);
}

/** The allowed transitions, so an out-of-order sync cannot move backwards. */
export function nextStatus(current: AllotmentStatus, event: 'RECLAIM' | 'ACKNOWLEDGE'): AllotmentStatus | null {
  if (event === 'RECLAIM') {
    return current === 'ACTIVE' ? 'RECLAIM_REQUESTED' : null;
  }
  // A release may be acknowledged whether or not a reclaim was requested: the
  // cloud can hand capacity back on its own once it is done with it.
  return current === 'RELEASED' ? null : 'RELEASED';
}

export type SyncSeverity = 'ok' | 'warn' | 'critical' | 'unknown';

/**
 * Thresholds for unsynced online transactions, in milliseconds.
 *
 * Tied to the cloud database's recovery window rather than picked for
 * roundness. While a booking sits unsynced the cloud is the only copy of it,
 * so if sync stalls past that window and something goes wrong the reservation
 * is unrecoverable. Neon's current window is six hours, so critical fires at
 * four and a warning at one — enough margin for someone to act.
 */
export const SYNC_LAG_WARN_MS = 60 * 60 * 1000;
export const SYNC_LAG_CRITICAL_MS = 4 * 60 * 60 * 1000;

/**
 * How bad the sync backlog is.
 *
 * Age, not count: a hundred transactions synced promptly are healthy, and one
 * stuck for five hours is not. Counting alone would have reported the second
 * case as nearly fine.
 */
export function syncLagSeverity(
  input: { pending: number; oldestAgeMs: number | null },
  warnMs = SYNC_LAG_WARN_MS,
  criticalMs = SYNC_LAG_CRITICAL_MS,
): SyncSeverity {
  const pending = Math.max(0, Math.floor(Number(input.pending) || 0));
  if (pending === 0) return 'ok';
  const age = input.oldestAgeMs;
  if (age === null || !Number.isFinite(age)) return 'unknown';
  if (age >= criticalMs) return 'critical';
  if (age >= warnMs) return 'warn';
  return 'ok';
}

/**
 * SQL for the units the cloud could still commit for one POS product.
 *
 * Written as a fragment rather than a prior read so a till sale can enforce it
 * inside its own atomic UPDATE: reading the allowance first and deciding
 * afterwards leaves a window where the cloud commits the same unit. Takes the
 * `:id` parameter the caller has already bound to the product, which avoids a
 * correlated reference to the UPDATE target.
 *
 * SUM, not MAX: a product published under more than one business has an
 * allowance outstanding against each, and the total is what must stay on the
 * shelf.
 */
export const CLOUD_COMMITTED_FOR_PRODUCT_SQL =
  'COALESCE((SELECT SUM(s."remainingQty" + s."committedQty") FROM commerce_product_snippets s WHERE s."productId" = :id), 0)';

/**
 * Half-open date overlap, [from, to), matching how HotelBooking treats
 * checkIn/checkOut: a stay ending on the 4th does not collide with one
 * starting on the 4th.
 */
export function windowsOverlap(aFrom: Date, aTo: Date, bFrom: Date, bTo: Date): boolean {
  return aFrom.getTime() < bTo.getTime() && bFrom.getTime() < aTo.getTime();
}
