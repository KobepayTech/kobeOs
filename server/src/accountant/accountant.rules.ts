export const ACCOUNTING_ESCALATION_MINUTES = 10;

export function accountingEscalationAt(createdAt: Date, minutes = ACCOUNTING_ESCALATION_MINUTES): Date {
  return new Date(createdAt.getTime() + Math.max(1, minutes) * 60_000);
}

export function shouldEscalateAccountingQuestion(escalateAt: Date, now = new Date()): boolean {
  return now.getTime() >= escalateAt.getTime();
}

export function accountingQuestionState(answer: string, escalateAt: Date, now = new Date()): 'ANSWERED' | 'CALL_DUE' | 'WAITING' {
  if (answer.trim()) return 'ANSWERED';
  return shouldEscalateAccountingQuestion(escalateAt, now) ? 'CALL_DUE' : 'WAITING';
}

export function classificationJournalLines(
  direction: 'IN' | 'OUT' | 'TRANSFER',
  type: 'INCOME' | 'EXPENSE' | 'ASSET' | 'LIABILITY' | 'EQUITY' | 'TRANSFER' | 'IGNORE',
  accountCode: string,
  value: number,
) {
  if (direction === 'TRANSFER' || ['IGNORE', 'TRANSFER'].includes(type)) return [];
  return direction === 'IN'
    ? [{ code: '1000', debit: value }, { code: accountCode, credit: value }]
    : [{ code: accountCode, debit: value }, { code: '1000', credit: value }];
}
