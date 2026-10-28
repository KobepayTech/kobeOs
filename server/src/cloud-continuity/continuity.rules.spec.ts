import {
  applyHeartbeatStock,
  blocksLocalSale,
  consumeAllowance,
  isCapacityReclaimed,
  localSellableQty,
  nextStatus,
  returnAllowance,
  windowsOverlap,
} from './continuity.rules';

describe('online allotment arithmetic', () => {
  describe('what KobeOS may still sell', () => {
    it('withholds only what the cloud could still commit', () => {
      expect(localSellableQty({ stock: 10, remainingQty: 3 })).toBe(7);
    });

    it('does not withhold a unit twice once the online sale has synced back', () => {
      // 10 in stock, 3 allotted, cloud sold 1. The order synced and took stock
      // to 9; 2 of the allotment are still live. Subtracting the original
      // allotment as well would answer 6 and strand a unit the shop has.
      expect(localSellableQty({ stock: 9, remainingQty: 2 })).toBe(7);
    });

    it('never goes negative when the allowance exceeds reported stock', () => {
      expect(localSellableQty({ stock: 1, remainingQty: 5 })).toBe(0);
    });

    it('treats rubbish as zero rather than NaN', () => {
      expect(localSellableQty({ stock: Number.NaN, remainingQty: 2 })).toBe(0);
      expect(localSellableQty({ stock: 5, remainingQty: Number.NaN })).toBe(5);
    });
  });

  describe('a heartbeat must never replenish a consumed allowance', () => {
    it('updates reported stock and leaves the allotment untouched', () => {
      const after = applyHeartbeatStock({ stock: 9, allocatedQty: 3, remainingQty: 1 }, 12);
      expect(after).toEqual({ stock: 12, allocatedQty: 3, remainingQty: 1 });
    });

    it('does not restore remaining units the cloud has already sold', () => {
      // This is the defect the separation exists to prevent: the merchant
      // recounts, the heartbeat arrives, and the two units the cloud already
      // sold become sellable online a second time.
      const consumed = { stock: 10, allocatedQty: 3, remainingQty: 1 };
      expect(applyHeartbeatStock(consumed, 10).remainingQty).toBe(1);
      expect(applyHeartbeatStock(consumed, 99).remainingQty).toBe(1);
      expect(applyHeartbeatStock(consumed, 0).remainingQty).toBe(1);
    });

    it('keeps the previous stock when the report is nonsense', () => {
      expect(applyHeartbeatStock({ stock: 7, allocatedQty: 2, remainingQty: 2 }, -4).stock).toBe(7);
    });
  });

  describe('consuming an allotment', () => {
    it('decrements when it fits', () => {
      expect(consumeAllowance(3, 1)).toBe(2);
      expect(consumeAllowance(3, 3)).toBe(0);
    });

    it('refuses more than the allotment holds, which is how the last unit is protected', () => {
      expect(consumeAllowance(1, 2)).toBeNull();
      expect(consumeAllowance(0, 1)).toBeNull();
    });

    it('refuses a zero or negative quantity', () => {
      expect(consumeAllowance(5, 0)).toBeNull();
      expect(consumeAllowance(5, -1)).toBeNull();
    });
  });

  describe('returning an allotment', () => {
    it('gives units back', () => {
      expect(returnAllowance(1, 3, 2)).toBe(3);
    });

    it('cannot inflate past the original allocation, so a replayed release is harmless', () => {
      expect(returnAllowance(3, 3, 5)).toBe(3);
      expect(returnAllowance(2, 3, 2)).toBe(3);
    });
  });

  describe('reclaim requires acknowledgement', () => {
    const ack = new Date('2026-10-28T12:00:00Z');

    it('does not reclaim capacity while the allotment is active', () => {
      expect(isCapacityReclaimed('ACTIVE', null)).toBe(false);
      expect(blocksLocalSale('ACTIVE', null)).toBe(true);
    });

    it('does not reclaim capacity merely because a reclaim was requested', () => {
      // The cloud may be mid-reservation. Asking is not the same as being told.
      expect(isCapacityReclaimed('RECLAIM_REQUESTED', null)).toBe(false);
      expect(blocksLocalSale('RECLAIM_REQUESTED', null)).toBe(true);
    });

    it('does not reclaim on a release with no acknowledgement recorded', () => {
      expect(isCapacityReclaimed('RELEASED', null)).toBe(false);
      expect(blocksLocalSale('RELEASED', null)).toBe(true);
    });

    it('reclaims only on an acknowledged release', () => {
      expect(isCapacityReclaimed('RELEASED', ack)).toBe(true);
      expect(blocksLocalSale('RELEASED', ack)).toBe(false);
    });
  });

  describe('status transitions', () => {
    it('moves active to reclaim requested', () => {
      expect(nextStatus('ACTIVE', 'RECLAIM')).toBe('RECLAIM_REQUESTED');
    });

    it('ignores a second reclaim', () => {
      expect(nextStatus('RECLAIM_REQUESTED', 'RECLAIM')).toBeNull();
      expect(nextStatus('RELEASED', 'RECLAIM')).toBeNull();
    });

    it('accepts an acknowledgement from either state', () => {
      expect(nextStatus('ACTIVE', 'ACKNOWLEDGE')).toBe('RELEASED');
      expect(nextStatus('RECLAIM_REQUESTED', 'ACKNOWLEDGE')).toBe('RELEASED');
    });

    it('ignores a replayed acknowledgement', () => {
      expect(nextStatus('RELEASED', 'ACKNOWLEDGE')).toBeNull();
    });
  });

  describe('date windows are half-open, like checkIn/checkOut', () => {
    const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

    it('overlaps when the ranges intersect', () => {
      expect(windowsOverlap(d('2026-11-01'), d('2026-11-05'), d('2026-11-04'), d('2026-11-08'))).toBe(true);
    });

    it('does not overlap when one ends where the other starts', () => {
      expect(windowsOverlap(d('2026-11-01'), d('2026-11-04'), d('2026-11-04'), d('2026-11-08'))).toBe(false);
    });

    it('overlaps a window fully inside another', () => {
      expect(windowsOverlap(d('2026-11-01'), d('2026-11-30'), d('2026-11-10'), d('2026-11-12'))).toBe(true);
    });
  });
});
