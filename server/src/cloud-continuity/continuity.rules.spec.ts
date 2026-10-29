import {
  SYNC_LAG_CRITICAL_MS,
  SYNC_LAG_WARN_MS,
  applyHeartbeatStock,
  blocksLocalSale,
  consumeAllowance,
  isCapacityReclaimed,
  localSellableQty,
  nextStatus,
  returnAllowance,
  syncLagSeverity,
  windowsOverlap,
} from './continuity.rules';

describe('online allotment arithmetic', () => {
  describe('what KobeOS may still sell', () => {
    it('withholds only what the cloud could still commit', () => {
      expect(localSellableQty({ stock: 10, remainingQty: 3, committedQty: 0 })).toBe(7);
    });

    it('does not withhold a unit twice once the online sale has synced back', () => {
      // 10 in stock, 3 allotted, cloud sold 1. The order synced and took stock
      // to 9; 2 of the allotment are still live. Subtracting the original
      // allotment as well would answer 6 and strand a unit the shop has.
      expect(localSellableQty({ stock: 9, remainingQty: 2, committedQty: 0 })).toBe(7);
    });

    it('never goes negative when the allowance exceeds reported stock', () => {
      expect(localSellableQty({ stock: 1, remainingQty: 5, committedQty: 0 })).toBe(0);
    });

    it('keeps holding a unit sold online until its order has synced back', () => {
      // The gap that allowed an oversell: the cloud sells one of three
      // allotted units, so remainingQty falls to 2 — but the deduction has not
      // reached `stock` yet, so the shelf must still hold three back.
      expect(localSellableQty({ stock: 10, remainingQty: 2, committedQty: 1 })).toBe(7);
      // Once the order syncs, stock carries it and the hold is released.
      expect(localSellableQty({ stock: 9, remainingQty: 2, committedQty: 0 })).toBe(7);
    });

    it('treats rubbish as zero rather than NaN', () => {
      expect(localSellableQty({ stock: Number.NaN, remainingQty: 2, committedQty: 0 })).toBe(0);
      expect(localSellableQty({ stock: 5, remainingQty: Number.NaN, committedQty: 0 })).toBe(5);
    });
  });

  describe('a heartbeat must never replenish a consumed allowance', () => {
    it('updates reported stock and leaves the allotment untouched', () => {
      const after = applyHeartbeatStock({ stock: 9, allocatedQty: 3, remainingQty: 1, committedQty: 2 }, 12);
      expect(after).toEqual({ stock: 12, allocatedQty: 3, remainingQty: 1, committedQty: 2 });
    });

    it('does not restore remaining units the cloud has already sold', () => {
      // This is the defect the separation exists to prevent: the merchant
      // recounts, the heartbeat arrives, and the two units the cloud already
      // sold become sellable online a second time.
      const consumed = { stock: 10, allocatedQty: 3, remainingQty: 1, committedQty: 2 };
      expect(applyHeartbeatStock(consumed, 10).remainingQty).toBe(1);
      expect(applyHeartbeatStock(consumed, 99).remainingQty).toBe(1);
      expect(applyHeartbeatStock(consumed, 0).remainingQty).toBe(1);
    });

    it('keeps the previous stock when the report is nonsense', () => {
      expect(applyHeartbeatStock({ stock: 7, allocatedQty: 2, remainingQty: 2, committedQty: 0 }, -4).stock).toBe(7);
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

describe('sync lag severity', () => {
  const HOUR = 60 * 60 * 1000;

  it('is ok with nothing pending', () => {
    expect(syncLagSeverity({ pending: 0, oldestAgeMs: null })).toBe('ok');
    // Even a stale timestamp is irrelevant when the backlog is empty.
    expect(syncLagSeverity({ pending: 0, oldestAgeMs: 99 * HOUR })).toBe('ok');
  });

  it('is ok while the backlog is fresh', () => {
    expect(syncLagSeverity({ pending: 5, oldestAgeMs: 5 * 60 * 1000 })).toBe('ok');
  });

  it('judges on age, not count', () => {
    // A hundred transactions synced promptly are healthy.
    expect(syncLagSeverity({ pending: 100, oldestAgeMs: 60 * 1000 })).toBe('ok');
    // One stuck for five hours is not, and counting alone would have called
    // this nearly fine.
    expect(syncLagSeverity({ pending: 1, oldestAgeMs: 5 * HOUR })).toBe('critical');
  });

  it('warns at an hour and goes critical at four', () => {
    expect(syncLagSeverity({ pending: 1, oldestAgeMs: HOUR })).toBe('warn');
    expect(syncLagSeverity({ pending: 1, oldestAgeMs: 3 * HOUR })).toBe('warn');
    expect(syncLagSeverity({ pending: 1, oldestAgeMs: 4 * HOUR })).toBe('critical');
  });

  it('stays inside the cloud recovery window', () => {
    // Critical has to fire with enough margin to act before the window
    // closes, because past it an unsynced booking is unrecoverable.
    expect(SYNC_LAG_CRITICAL_MS).toBeLessThan(6 * HOUR);
    expect(SYNC_LAG_WARN_MS).toBeLessThan(SYNC_LAG_CRITICAL_MS);
  });

  it('reports unknown rather than ok when the age cannot be determined', () => {
    expect(syncLagSeverity({ pending: 3, oldestAgeMs: null })).toBe('unknown');
    expect(syncLagSeverity({ pending: 3, oldestAgeMs: Number.NaN })).toBe('unknown');
  });

  it('honours custom thresholds', () => {
    expect(syncLagSeverity({ pending: 1, oldestAgeMs: 90 * 1000 }, 60_000, 120_000)).toBe('warn');
    expect(syncLagSeverity({ pending: 1, oldestAgeMs: 150 * 1000 }, 60_000, 120_000)).toBe('critical');
  });
});
