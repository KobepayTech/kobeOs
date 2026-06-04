import { RentCharge } from '../property.entity';

export function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function asDate(value: unknown): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(String(value));
}

export function chargeStatus(charge: Pick<RentCharge, 'amount' | 'amountPaid' | 'dueDate' | 'status'>): RentCharge['status'] {
  if (charge.status === 'waived') return 'waived';
  const amount = money(charge.amount);
  const paid = money(charge.amountPaid);
  if (amount > 0 && paid >= amount) return 'paid';
  if (paid > 0) return 'partial';
  if (new Date(charge.dueDate).getTime() < Date.now()) return 'overdue';
  return 'open';
}

export function dueDateFor(period: string, dueDay: number): Date {
  const [year, month] = period.split('-').map(Number);
  return new Date(Date.UTC(year, Math.max(0, (month || 1) - 1), Math.max(1, dueDay || 1)));
}
