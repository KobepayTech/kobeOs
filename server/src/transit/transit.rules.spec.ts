import { calculateCompliance, nextFeeWindow, normalizeTransitPlate, shouldAutomaticallyProcessAnpr, splitTransitFee } from './transit.rules';

describe('Kobe Transit fee and ANPR rules', () => {
  const policy = {
    registeredAt: new Date('2026-08-01T00:00:00Z'),
    policyEffectiveAt: new Date('2026-08-01T00:00:00Z'),
    periodDays: 7,
    graceDays: 2,
    dueSoonDays: 2,
  };

  it('normalizes Tanzanian plates for one compliance identity', () => {
    expect(normalizeTransitPlate(' t 123 abc ')).toBe('T123ABC');
    expect(normalizeTransitPlate('T-123-ABC')).toBe('T123ABC');
  });

  it('splits 5,000 TZS exactly 50/50', () => {
    expect(splitTransitFee(5000, 50, 50)).toEqual({ governmentAmount: 2500, kobeAmount: 2500 });
  });

  it('allocates a 30-bus fleet payment to 75,000 each side', () => {
    const one = splitTransitFee(5000, 50, 50);
    expect(one.governmentAmount * 30).toBe(75000);
    expect(one.kobeAmount * 30).toBe(75000);
  });

  it('allocates 100 weekly fees to a 250,000 government settlement payable', () => {
    expect(splitTransitFee(5000, 50, 50).governmentAmount * 100).toBe(250000);
  });

  it('never auto-enforces a low-confidence or unregistered plate', () => {
    expect(shouldAutomaticallyProcessAnpr(0.72, 0.85, 0.8, true)).toBe(false);
    expect(shouldAutomaticallyProcessAnpr(0.99, 0.85, 0.8, false)).toBe(false);
    expect(shouldAutomaticallyProcessAnpr(0.96, 0.85, 0.8, true)).toBe(true);
  });

  it('moves from paid to due-soon, grace and overdue without manual status updates', () => {
    const paidThrough = new Date('2026-08-20T23:59:59.999Z');
    expect(calculateCompliance({ ...policy, paidThrough, now: new Date('2026-08-17T12:00:00Z') })).toBe('PAID');
    expect(calculateCompliance({ ...policy, paidThrough, now: new Date('2026-08-19T12:00:00Z') })).toBe('DUE_SOON');
    expect(calculateCompliance({ ...policy, paidThrough, now: new Date('2026-08-21T12:00:00Z') })).toBe('GRACE_PERIOD');
    expect(calculateCompliance({ ...policy, paidThrough, now: new Date('2026-08-24T12:00:00Z') })).toBe('OVERDUE');
  });

  it('starts the next period after the current paid-through date', () => {
    const next = nextFeeWindow(new Date('2026-08-01T00:00:00Z'), 7, new Date('2026-08-20T00:00:00Z'), new Date('2026-08-21T23:59:59.999Z'));
    expect(next.start.toISOString()).toBe('2026-08-22T00:00:00.000Z');
    expect(next.end.toISOString()).toBe('2026-08-28T23:59:59.999Z');
  });

  it('gives suspension and approved exemption precedence', () => {
    expect(calculateCompliance({ ...policy, now: new Date('2026-09-01T00:00:00Z'), suspended: true })).toBe('SUSPENDED');
    expect(calculateCompliance({ ...policy, now: new Date('2026-09-01T00:00:00Z'), exempt: true })).toBe('EXEMPT');
  });
});
