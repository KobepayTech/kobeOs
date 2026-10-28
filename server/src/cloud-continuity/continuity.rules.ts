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
export function localSellableQty(input: Pick<SnippetAllowance, 'stock' | 'remainingQty'>): number {
  return Math.max(0, whole(input.stock) - Math.max(0, whole(input.remainingQty)));
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

/**
 * Half-open date overlap, [from, to), matching how HotelBooking treats
 * checkIn/checkOut: a stay ending on the 4th does not collide with one
 * starting on the 4th.
 */
export function windowsOverlap(aFrom: Date, aTo: Date, bFrom: Date, bTo: Date): boolean {
  return aFrom.getTime() < bTo.getTime() && bFrom.getTime() < aTo.getTime();
}
