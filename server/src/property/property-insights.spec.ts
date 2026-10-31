import { maintenanceRisk, monthBounds, periodOffset, PropertyInsightsService } from './property-insights.service';
import { Property, PropertyUnit, PropertyLease, RentCharge, RentPayment, PropertyExpense } from './property.entity';
import { DataSource } from 'typeorm';

describe('Property intelligence financial rules', () => {
  it('rejects invalid periods and rolls forecasts across years', () => {
    expect(() => monthBounds('2026-13')).toThrow();
    expect(() => monthBounds('not-a-date')).toThrow();
    expect(periodOffset('2026-12', 1)).toBe('2027-01');
  });
  it('states the evidence for maintenance signals', () => {
    const result = maintenanceRisk({lastServiced:'2026-01-01',intervalDays:30},3,new Date('2026-03-01'));
    expect(result.dueAt).toBe('2026-01-31'); expect(result.priority).toBe('high'); expect(result.overdueDays).toBe(29);
  });
  it('separates annual invoices from monthly earnings and never combines currencies', async () => {
    const records = new Map<unknown, unknown[]>([
      [Property,[{id:'p',ownerId:'o'}]],
      [PropertyUnit,[{id:'u',propertyId:'p',currency:'TZS',status:'occupied'},{id:'usd',propertyId:'p',currency:'USD',status:'occupied'}]],
      [PropertyLease,[{id:'l',unitId:'u',status:'active',startDate:'2026-01-01',endDate:'2027-01-01',monthlyRent:100000,billingMonths:12,rentDueDay:1}]],
      [RentCharge,[{id:'c',unitId:'u',tenantId:'t',period:'2026-01',dueDate:'2026-01-01',amount:1200000,amountPaid:100000,status:'partial'}]],
      [RentPayment,[{id:'p1',unitId:'u',chargeId:'c',amount:100000,currency:'TZS',paidAt:'2026-01-05',reference:'r'},{id:'p2',unitId:'usd',amount:20,currency:'USD',paidAt:'2026-01-05'}]],
      [PropertyExpense,[{id:'e',propertyId:'p',amount:10000,currency:'TZS',spentAt:'2026-01-08'}]],
    ]);
    const ds = {getRepository:(entity: unknown)=>({find:async()=>records.get(entity)||[]})} as unknown as DataSource;
    const data = await new PropertyInsightsService(ds).snapshot('o','p','2026-01');
    expect(data.financials.find(f=>f.currency==='TZS')).toMatchObject({billed:1200000,earnedRent:100000,collected:100000,expenses:10000,operatingProfit:90000});
    expect(data.financials.find(f=>f.currency==='USD')?.collected).toBe(20);
    expect(data.forecast[0].scheduledRent).toEqual({});
    expect(data.discrepancies).toEqual([expect.objectContaining({kind:'unallocated_payment',id:'p2'})]);
  });
});
