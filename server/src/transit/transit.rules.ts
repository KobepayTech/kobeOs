export type TransitComplianceState =
  | 'PAID'
  | 'DUE_SOON'
  | 'GRACE_PERIOD'
  | 'OVERDUE'
  | 'EXEMPT'
  | 'SUSPENDED';

export interface ComplianceInput {
  now: Date;
  registeredAt: Date;
  policyEffectiveAt: Date;
  periodDays: number;
  graceDays: number;
  dueSoonDays: number;
  paidThrough?: Date | null;
  exempt?: boolean;
  suspended?: boolean;
}

const DAY = 86_400_000;

export function normalizeTransitPlate(value: string): string {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function displayTransitPlate(value: string): string {
  const normalized = normalizeTransitPlate(value);
  const match = normalized.match(/^([A-Z]{1,3})(\d{1,4})([A-Z]{1,3})$/);
  return match ? `${match[1]} ${match[2]} ${match[3]}` : normalized;
}

export function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY);
}

export function policyWindow(
  policyEffectiveAt: Date,
  periodDays: number,
  at: Date,
): { start: Date; end: Date; dueAt: Date } {
  const anchor = startOfUtcDay(policyEffectiveAt);
  const point = startOfUtcDay(at);
  const safePeriod = Math.max(1, Math.floor(periodDays || 7));
  const elapsedDays = Math.max(0, Math.floor((point.getTime() - anchor.getTime()) / DAY));
  const periodIndex = Math.floor(elapsedDays / safePeriod);
  const start = addDays(anchor, periodIndex * safePeriod);
  const nextStart = addDays(start, safePeriod);
  const end = new Date(nextStart.getTime() - 1);
  return { start, end, dueAt: end };
}

export function nextFeeWindow(
  policyEffectiveAt: Date,
  periodDays: number,
  now: Date,
  paidThrough?: Date | null,
): { start: Date; end: Date; dueAt: Date } {
  const current = policyWindow(policyEffectiveAt, periodDays, now);
  if (!paidThrough || paidThrough.getTime() < current.end.getTime()) return current;
  const start = new Date(paidThrough.getTime() + 1);
  const safePeriod = Math.max(1, Math.floor(periodDays || 7));
  const end = new Date(addDays(startOfUtcDay(start), safePeriod).getTime() - 1);
  return { start: startOfUtcDay(start), end, dueAt: end };
}

export function calculateCompliance(input: ComplianceInput): TransitComplianceState {
  if (input.suspended) return 'SUSPENDED';
  if (input.exempt) return 'EXEMPT';

  const now = input.now.getTime();
  const graceMs = Math.max(0, input.graceDays) * DAY;
  const dueSoonMs = Math.max(0, input.dueSoonDays) * DAY;
  if (input.paidThrough) {
    const paidThrough = input.paidThrough.getTime();
    if (now <= paidThrough) {
      return paidThrough - now <= dueSoonMs ? 'DUE_SOON' : 'PAID';
    }
    return now <= paidThrough + graceMs ? 'GRACE_PERIOD' : 'OVERDUE';
  }

  const firstEligible = new Date(Math.max(
    startOfUtcDay(input.registeredAt).getTime(),
    startOfUtcDay(input.policyEffectiveAt).getTime(),
  ));
  const initialDue = addDays(firstEligible, Math.max(1, input.periodDays));
  if (now <= initialDue.getTime()) return 'DUE_SOON';
  if (now <= initialDue.getTime() + graceMs) return 'GRACE_PERIOD';
  return 'OVERDUE';
}

export function splitTransitFee(
  grossAmount: number,
  governmentPercent: number,
  kobePercent: number,
): { governmentAmount: number; kobeAmount: number } {
  const gross = Math.round(Number(grossAmount) * 100) / 100;
  const government = Math.round((gross * Number(governmentPercent)) / 100 * 100) / 100;
  const configuredKobe = Math.round((gross * Number(kobePercent)) / 100 * 100) / 100;
  const kobe = Math.abs(government + configuredKobe - gross) <= 0.01
    ? Math.round((gross - government) * 100) / 100
    : configuredKobe;
  return { governmentAmount: government, kobeAmount: kobe };
}

export function shouldAutomaticallyProcessAnpr(
  confidence: number,
  cameraThreshold: number,
  policyThreshold: number,
  registeredPlate: boolean,
): boolean {
  return registeredPlate && Number(confidence) >= Math.max(Number(cameraThreshold), Number(policyThreshold));
}
