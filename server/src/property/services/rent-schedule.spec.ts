import { scheduledCharge } from './rent-schedule';
const lease = { startDate: '2026-01-01', endDate: '2027-01-01', monthlyRent: '100000', billingMonths: 12, rentDueDay: 10 };
describe('rent schedules', () => {
  it('bills annual rent once, within the lease term', () => {
    expect(scheduledCharge(lease, '2026-01')).toEqual({ amount: 1200000, months: 12, dueDate: new Date('2026-01-10') });
    for (const period of ['2025-12', '2026-02', '2027-01']) expect(scheduledCharge(lease, period)).toBeNull();
  });
  it('supports six-month advance payments and shorter final terms', () => {
    expect(scheduledCharge({ ...lease, billingMonths: 6, endDate: '2026-10-01' }, '2026-07')?.amount).toBe(300000);
  });
  it('never bills before the actual start day', () => {
    expect(scheduledCharge({ ...lease, startDate: '2026-01-15' }, '2026-01')?.dueDate).toEqual(new Date('2026-01-15'));
  });
  it('rejects invalid periods and terms', () => {
    expect(() => scheduledCharge(lease, '2026-13')).toThrow();
    expect(() => scheduledCharge({ ...lease, endDate: lease.startDate }, '2026-01')).toThrow();
    expect(() => scheduledCharge({ ...lease, billingMonths: 5 }, '2026-01')).toThrow();
  });
});
