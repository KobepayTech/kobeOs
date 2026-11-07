import { createHash } from 'crypto';
export const BUSINESS_EVENT_NAMES = ['inventory.stock.changed', 'inventory.stock.low', 'kobepay.ledger.posted', 'ai.approval.decided'] as const;
export type BusinessEventName = typeof BUSINESS_EVENT_NAMES[number];
export interface BusinessEventInput {
  ownerId: string; eventName: BusinessEventName; aggregateType: string; aggregateId: string;
  idempotencyKey: string; correlationId?: string; payload: Record<string, unknown>;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]));
  return value;
}
export function eventFingerprint(input: BusinessEventInput) {
  return createHash('sha256').update(JSON.stringify(canonical({ schemaVersion: 1, aggregateType: input.aggregateType, aggregateId: input.aggregateId, payload: input.payload }))).digest('hex');
}
export function businessSignal(eventName: BusinessEventName, payload: Record<string, unknown>) {
  if (!(BUSINESS_EVENT_NAMES as readonly string[]).includes(eventName)) throw new Error('Unsupported business event');
  if (eventName === 'inventory.stock.changed' || eventName === 'inventory.stock.low') {
    if (!Number.isFinite(payload.quantity) || !Number.isFinite(payload.previousQuantity)) throw new Error('Invalid inventory event');
    const low = eventName === 'inventory.stock.low';
    return { category: 'inventory' as const, severity: low ? 'attention' as const : 'info' as const, summary: low ? 'Inventory has reached its reorder level.' : 'An inventory movement was recorded.', data: { itemId: payload.itemId, movementId: payload.movementId, quantity: payload.quantity, previousQuantity: payload.previousQuantity, reorderLevel: payload.reorderLevel } };
  }
  if (eventName === 'kobepay.ledger.posted') {
    if (typeof payload.currency !== 'string' || !Number.isFinite(Number(payload.amount)) || Number(payload.amount) <= 0) throw new Error('Invalid ledger event');
    return { category: 'ledger' as const, severity: 'info' as const, summary: 'A balanced ledger posting was recorded.', data: { transactionId: payload.transactionId, reference: payload.reference, amount: payload.amount, currency: payload.currency, kind: payload.kind } };
  }
  if (!['APPROVED', 'REJECTED'].includes(String(payload.status))) throw new Error('Invalid approval event');
  return { category: 'approval' as const, severity: 'info' as const, summary: `A business action was ${payload.status === 'APPROVED' ? 'approved' : 'rejected'}.`, data: { approvalId: payload.approvalId, status: payload.status, actionType: payload.actionType } };
}
