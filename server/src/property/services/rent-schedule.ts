import { BadRequestException } from '@nestjs/common';

/** End dates are exclusive; amounts use the agreed monthly rate, without daily proration. */
export function scheduledCharge(lease: { startDate: Date | string; endDate: Date | string; monthlyRent: number | string; billingMonths?: number; rentDueDay: number }, period: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new BadRequestException('Period must be YYYY-MM.');
  const start = new Date(lease.startDate); const end = new Date(lease.endDate);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new BadRequestException('Invalid lease dates.');
  const cadence = lease.billingMonths ?? 1;
  if (![1, 6, 12].includes(cadence)) throw new BadRequestException('Invalid rent billing interval.');
  const firstMonth = start.getUTCFullYear() * 12 + start.getUTCMonth();
  const [year, month] = period.split('-').map(Number);
  const requested = year * 12 + month - 1;
  const lastDate = new Date(end.getTime() - 1);
  const lastMonth = lastDate.getUTCFullYear() * 12 + lastDate.getUTCMonth();
  if (requested < firstMonth || requested > lastMonth || (requested - firstMonth) % cadence !== 0) return null;
  const months = Math.min(cadence, lastMonth - requested + 1);
  const due = new Date(Date.UTC(year, month - 1, Math.min(28, Math.max(1, lease.rentDueDay))));
  const amount = Math.round(Number(lease.monthlyRent) * months * 10000) / 10000;
  if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Monthly rent must be positive.');
  return { amount, dueDate: due < start ? start : due, months };
}
