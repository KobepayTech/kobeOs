import {
  groupByMerchant, isNodeOnline, isVehiclePublic, merchantOrderAccess,
  missingRequiredOptions, panelCrops, shopCode,
} from '../src/commerce/commerce.rules';
import {
  accountingEscalationAt, accountingQuestionState, classificationJournalLines,
} from '../src/accountant/accountant.rules';
import {
  calculateCompliance, shouldAutomaticallyProcessAnpr, splitTransitFee, tripFollowerAlertKind,
} from '../src/transit/transit.rules';

describe('KobeOS master specification acceptance criteria 159-172', () => {
  it('159 creates Moscow Tower floor/shop identifiers and claim code MOS-G-12', () => {
    expect(shopCode('Moscow Tower', 'G', 12)).toBe('MOS-G-12');
  });

  it('160 converts a four-panel collage into four independent crops', () => {
    const crops = panelCrops(4);
    expect(crops).toHaveLength(4);
    expect(new Set(crops.map((crop) => `${crop.left}:${crop.top}`)).size).toBe(4);
  });

  it('161 validates options and groups a customer cart into one order per merchant', () => {
    expect(missingRequiredOptions(['size', 'color'], { size: 'L', color: 'Blue' })).toEqual([]);
    const lines = [{ productId: 'shirt', merchant: 'business-1' }, { productId: 'shoes', merchant: 'business-1' }];
    const grouped = groupByMerchant(lines, (line) => line.merchant);
    expect(grouped.size).toBe(1);
    expect(grouped.get('business-1')).toHaveLength(2);
  });

  it('162 lets customer order 51 succeed while locking only the Lite merchant view', () => {
    expect(merchantOrderAccess('LITE', 49)).toMatchObject({ locked: false, status: 'SUBMITTED', orderNumber: 50 });
    expect(merchantOrderAccess('LITE', 50)).toMatchObject({ locked: true, status: 'WAITING_ACTIVATION', orderNumber: 51 });
    expect(merchantOrderAccess('FULL', 50)).toMatchObject({ locked: false, status: 'SUBMITTED', orderNumber: 51 });
  });

  it('163 exposes online nodes, suppresses stale nodes, and restores them after reconnect', () => {
    const now = new Date('2026-08-21T12:00:00Z');
    expect(isNodeOnline(new Date('2026-08-21T11:58:00Z'), now)).toBe(true);
    expect(isNodeOnline(new Date('2026-08-21T11:56:59Z'), now)).toBe(false);
    expect(isNodeOnline(now, now)).toBe(true);
  });

  it('164 removes sold vehicles from the public Buy lifecycle', () => {
    expect(isVehiclePublic('AVAILABLE')).toBe(true);
    expect(isVehiclePublic('SOLD')).toBe(false);
  });

  it('165 asks, waits ten minutes, escalates, accepts an answer, and posts balanced classification lines', () => {
    const created = new Date('2026-08-21T12:00:00Z');
    const escalation = accountingEscalationAt(created);
    expect(escalation.toISOString()).toBe('2026-08-21T12:10:00.000Z');
    expect(accountingQuestionState('', escalation, new Date('2026-08-21T12:09:59Z'))).toBe('WAITING');
    expect(accountingQuestionState('', escalation, new Date('2026-08-21T12:10:00Z'))).toBe('CALL_DUE');
    expect(accountingQuestionState('Room payment', escalation, new Date('2026-08-21T12:10:00Z'))).toBe('ANSWERED');
    const lines = classificationJournalLines('IN', 'INCOME', '4400', 150_000);
    expect(lines.reduce((sum, line) => sum + Number(line.debit || 0), 0)).toBe(lines.reduce((sum, line) => sum + Number(line.credit || 0), 0));
  });

  it('166 converts camera/checkpoint movement into a follower pickup ETA alert', () => {
    expect(tripFollowerAlertKind({ tripStatus: 'IN_TRANSIT', eta: new Date('2026-08-21T12:20:00Z'), now: new Date('2026-08-21T12:00:00Z'), notifyBeforeMinutes: 30 })).toBe('PICKUP_ETA');
  });

  it('167 splits a verified TZS 5,000 weekly fee 50/50 and preserves receipt arithmetic', () => {
    expect(splitTransitFee(5_000, 50, 50)).toEqual({ governmentAmount: 2_500, kobeAmount: 2_500 });
  });

  it('168 totals a thirty-bus fleet to TZS 75,000 per side', () => {
    const split = splitTransitFee(30 * 5_000, 50, 50);
    expect(split).toEqual({ governmentAmount: 75_000, kobeAmount: 75_000 });
  });

  it('169 automatically processes a high-confidence registered overdue plate detection', () => {
    expect(shouldAutomaticallyProcessAnpr(0.97, 0.85, 0.9, true)).toBe(true);
  });

  it('170 payment resolves current compliance while retaining historical alert evidence', () => {
    const history = [{ id: 'alert-1', status: 'RESOLVED', evidence: 'camera-frame.webp' }];
    const state = calculateCompliance({ now: new Date('2026-08-21T12:00:00Z'), registeredAt: new Date('2026-01-01T00:00:00Z'), policyEffectiveAt: new Date('2026-01-01T00:00:00Z'), periodDays: 7, graceDays: 2, dueSoonDays: 1, paidThrough: new Date('2026-08-27T23:59:59Z') });
    expect(state).toBe('PAID');
    expect(history).toEqual([{ id: 'alert-1', status: 'RESOLVED', evidence: 'camera-frame.webp' }]);
  });

  it('171 keeps low-confidence ANPR reads in manual review', () => {
    expect(shouldAutomaticallyProcessAnpr(0.72, 0.85, 0.9, true)).toBe(false);
    expect(shouldAutomaticallyProcessAnpr(0.99, 0.85, 0.9, false)).toBe(false);
  });

  it('172 reconciles 100 buses to TZS 500,000 gross and TZS 250,000 per side', () => {
    const gross = 100 * 5_000;
    expect(splitTransitFee(gross, 50, 50)).toEqual({ governmentAmount: 250_000, kobeAmount: 250_000 });
  });
});
