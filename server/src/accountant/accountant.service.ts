import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { InboundPayment } from '../mobile-money/mobile-money.entity';
import { MobileMoneyService } from '../mobile-money/mobile-money.service';
import { PosOrder } from '../pos/pos.entity';
import { RentPayment } from '../property/property.entity';
import { HotelFinancialRecord } from '../hotel/hotel-financials.entity';
import { HotelLedgerEntry } from '../hotel/hotel-operations.entity';
import { ErpAccount, ErpTransaction } from '../erp/erp.entity';
import { JournalService } from '../erp/journal.service';
import { PlatformEventsService, PlatformNotificationService } from '../platform/platform.service';
import {
  AccountingCall, AccountingClassification, AccountingConversation, AccountingQuestion,
  DailyClose, FinancialTransaction, SmsTransaction,
} from './accountant.entity';
import { AccountingCallProvider } from './call-provider.service';
import { accountingEscalationAt, classificationJournalLines } from './accountant.rules';

type ClassificationType = AccountingClassification['classificationType'];
const day = (value = new Date()) => value.toISOString().slice(0, 10);
const amount = (value: unknown) => Number(value) || 0;

@Injectable()
export class AccountantService implements OnModuleInit {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(FinancialTransaction) private readonly financial: Repository<FinancialTransaction>,
    @InjectRepository(AccountingQuestion) private readonly questions: Repository<AccountingQuestion>,
    @InjectRepository(AccountingCall) private readonly calls: Repository<AccountingCall>,
    @InjectRepository(AccountingClassification) private readonly classifications: Repository<AccountingClassification>,
    @InjectRepository(DailyClose) private readonly closes: Repository<DailyClose>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ErpAccount) private readonly accounts: Repository<ErpAccount>,
    @InjectRepository(ErpTransaction) private readonly journalRows: Repository<ErpTransaction>,
    private readonly mobileMoney: MobileMoneyService,
    private readonly journal: JournalService,
    private readonly callProvider: AccountingCallProvider,
    private readonly events: PlatformEventsService,
    private readonly notifications: PlatformNotificationService,
  ) {}

  private repo<T extends object>(entity: new () => T): Repository<T> { return this.ds.getRepository(entity); }

  onModuleInit() {
    this.mobileMoney.registerObserver('accountant', async (ownerId, payment) => {
      await this.captureSms(ownerId, payment);
    });
  }

  private async saveSource(ownerId: string, input: Omit<FinancialTransaction, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) {
    const existing = await this.financial.findOne({ where: { ownerId, sourceType: input.sourceType, sourceId: input.sourceId } });
    if (existing) return { row: existing, created: false };
    try { return { row: await this.financial.save(this.financial.create({ ownerId, ...input })), created: true }; }
    catch {
      const again = await this.financial.findOne({ where: { ownerId, sourceType: input.sourceType, sourceId: input.sourceId } });
      if (!again) throw new BadRequestException('Could not capture financial transaction');
      return { row: again, created: false };
    }
  }

  async captureSms(ownerId: string, payment: InboundPayment) {
    const result = await this.saveSource(ownerId, {
      sourceType: 'SMS_PAYMENT', sourceId: payment.id, direction: payment.direction === 'RECEIVED' ? 'IN' : 'OUT',
      amount: payment.amount, currency: payment.currency, counterparty: payment.senderName || payment.senderPhone,
      reference: payment.reference || payment.transactionId, description: `${payment.provider} ${payment.direction.toLowerCase()} payment`,
      detectedAt: payment.createdAt ?? new Date(), status: 'NEEDS_INFO',
      raw: { provider: payment.provider, transactionId: payment.transactionId, senderPhone: payment.senderPhone, account: payment.account, consumedBy: payment.consumedBy },
    });
    if (result.created) {
      await this.repo(SmsTransaction).save(this.repo(SmsTransaction).create({ ownerId, inboundPaymentId: payment.id, financialTransactionId: result.row.id, transactionId: payment.transactionId, provider: payment.provider, rawMessage: payment.rawMessage }));
      await this.events.emit({ ownerId, eventName: 'sms.transaction_detected', aggregateType: 'FinancialTransaction', aggregateId: result.row.id, payload: { amount: payment.amount, provider: payment.provider } });
      await this.ask(ownerId, result.row);
    }
    return result.row;
  }

  private async ask(ownerId: string, transaction: FinancialTransaction) {
    const existing = await this.questions.findOne({ where: { ownerId, financialTransactionId: transaction.id, status: 'OPEN' } });
    if (existing) return existing;
    const direction = transaction.direction === 'IN' ? 'received' : 'paid';
    const prompt = `Kobe Accountant found TZS ${Number(transaction.amount).toLocaleString()} ${direction}${transaction.counterparty ? ` involving ${transaction.counterparty}` : ''} (${transaction.reference}). What was this transaction for?`;
    const question = await this.questions.save(this.questions.create({ ownerId, financialTransactionId: transaction.id, question: prompt, status: 'OPEN', escalateAt: accountingEscalationAt(new Date()), answer: '', answeredVia: 'CHAT' }));
    await this.repo(AccountingConversation).save(this.repo(AccountingConversation).create({ ownerId, questionId: question.id, channel: 'CHAT', direction: 'OUTBOUND', content: prompt, evidence: { financialTransactionId: transaction.id } }));
    const owner = await this.users.findOne({ where: { id: ownerId } });
    await this.notifications.send({ ownerId, recipientKey: ownerId, phone: owner?.phone ?? '', email: owner?.email ?? '', title: 'Kobe Accountant needs one detail', body: prompt, actionUrl: '/accountant', channels: ['IN_APP', 'PUSH', 'SMS', 'WHATSAPP'] });
    await this.events.emit({ ownerId, eventName: 'accounting.question_created', aggregateType: 'AccountingQuestion', aggregateId: question.id, payload: { financialTransactionId: transaction.id, escalateAt: question.escalateAt.toISOString() } });
    return question;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async aggregateOperations() {
    const sources: Array<{ entity: new () => object; sourceType: string }> = [
      { entity: PosOrder, sourceType: 'POS_ORDER' }, { entity: RentPayment, sourceType: 'RENT_PAYMENT' },
      { entity: HotelFinancialRecord, sourceType: 'HOTEL_FINANCIAL' }, { entity: HotelLedgerEntry, sourceType: 'HOTEL_LEDGER' },
    ];
    let captured = 0;
    for (const source of sources) {
      const rows = await this.ds.getRepository(source.entity).find({ order: { createdAt: 'DESC' }, take: 2_000 } as never);
      for (const raw of rows as Array<Record<string, unknown>>) {
        const ownerId = String(raw.ownerId ?? ''); const sourceId = String(raw.id ?? '');
        if (!ownerId || !sourceId) continue;
        const value = amount(raw.total ?? raw.amount);
        if (source.sourceType === 'POS_ORDER' && !['COMPLETED', 'PENDING'].includes(String(raw.status))) continue;
        const expense = source.sourceType === 'HOTEL_LEDGER' ? raw.side === 'debit' : String(raw.category ?? '').toLowerCase().includes('expense');
        const result = await this.saveSource(ownerId, {
          sourceType: source.sourceType, sourceId, direction: expense ? 'OUT' : 'IN', amount: value,
          currency: String(raw.currency ?? 'TZS'), counterparty: '', reference: String(raw.orderNumber ?? raw.reference ?? sourceId.slice(0, 8)),
          description: String(raw.description ?? `${source.sourceType.replace(/_/g, ' ')} captured automatically`),
          detectedAt: new Date(String(raw.paidAt ?? raw.createdAt ?? new Date())), status: 'CLASSIFIED', raw,
        });
        if (result.created) captured += 1;
      }
    }
    return { captured };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async escalateIgnoredQuestions(now = new Date()) {
    const due = await this.questions.createQueryBuilder('q').where("q.status = 'OPEN'").andWhere('q.escalateAt <= :now', { now }).getMany();
    const created: AccountingCall[] = [];
    for (const question of due) {
      if (await this.calls.findOne({ where: { questionId: question.id } })) continue;
      const owner = await this.users.findOne({ where: { id: question.ownerId } });
      const callbackToken = randomBytes(24).toString('base64url');
      const callbackUrl = `${(process.env.APP_PUBLIC_URL || '').replace(/\/$/, '')}/api/accountant-public/calls/${callbackToken}/answer`;
      const result = await this.callProvider.call({ to: owner?.phone ?? '', prompt: question.question, callbackToken, callbackUrl });
      const call = await this.calls.save(this.calls.create({ ownerId: question.ownerId, questionId: question.id, provider: result.provider, providerCallId: result.providerCallId, callbackToken, phone: owner?.phone ?? '', status: result.status, transcript: '', startedAt: new Date(), providerPayload: result.payload }));
      created.push(call);
      await this.repo(AccountingConversation).save(this.repo(AccountingConversation).create({ ownerId: question.ownerId, questionId: question.id, channel: 'CALL', direction: 'OUTBOUND', content: question.question, evidence: { callId: call.id, provider: call.provider } }));
      await this.events.emit({ ownerId: question.ownerId, eventName: 'accounting.call_triggered', aggregateType: 'AccountingCall', aggregateId: call.id, payload: { questionId: question.id, provider: call.provider } });
    }
    return created;
  }

  list(ownerId: string) {
    return Promise.all([
      this.financial.find({ where: { ownerId }, order: { detectedAt: 'DESC' }, take: 500 }),
      this.questions.find({ where: { ownerId }, order: { createdAt: 'DESC' }, take: 200 }),
      this.calls.find({ where: { ownerId }, order: { createdAt: 'DESC' }, take: 100 }),
      this.closes.find({ where: { ownerId }, order: { closeDate: 'DESC' }, take: 90 }),
      this.classifications.find({ where: { ownerId }, order: { createdAt: 'DESC' }, take: 500 }),
    ]).then(([transactions, questions, calls, closes, classifications]) => ({ transactions, questions, calls, closes, classifications }));
  }

  private infer(answer: string, direction: FinancialTransaction['direction']): { type: ClassificationType; category: string; accountCode: string; confidence: number } {
    const text = answer.toLowerCase();
    if (/ignore|not business|personal/.test(text)) return { type: 'IGNORE', category: 'Non-business', accountCode: '', confidence: 0.98 };
    if (/transfer|moved money/.test(text)) return { type: 'TRANSFER', category: 'Internal transfer', accountCode: '', confidence: 0.92 };
    if (/salary|payroll|wage/.test(text)) return { type: 'EXPENSE', category: 'Payroll', accountCode: '5600', confidence: 0.95 };
    if (/petty cash/.test(text)) return { type: 'EXPENSE', category: 'Petty cash', accountCode: '5700', confidence: 0.95 };
    if (/asset|equipment|furniture|computer|vehicle/.test(text)) return { type: 'ASSET', category: 'Fixed assets', accountCode: '1500', confidence: 0.9 };
    if (/loan|borrow/.test(text)) return { type: 'LIABILITY', category: 'Loan', accountCode: '2300', confidence: 0.9 };
    if (/capital|owner contribution|investment/.test(text)) return { type: 'EQUITY', category: 'Owner capital', accountCode: '3000', confidence: 0.9 };
    if (direction === 'IN') return { type: 'INCOME', category: /room|hotel/.test(text) ? 'Hotel revenue' : 'Sales revenue', accountCode: /room|hotel/.test(text) ? '4400' : '4000', confidence: 0.78 };
    return { type: 'EXPENSE', category: 'Operating expense', accountCode: '5500', confidence: 0.72 };
  }

  async answerQuestion(ownerId: string, id: string, input: { answer: string; via?: 'CHAT' | 'CALL' | 'MANUAL'; classificationType?: ClassificationType; category?: string; accountCode?: string; confidence?: number; evidence?: Record<string, unknown> }) {
    const question = await this.questions.findOne({ where: { ownerId, id } });
    if (!question || question.status !== 'OPEN') throw new NotFoundException('Open accounting question not found');
    const transaction = await this.financial.findOne({ where: { ownerId, id: question.financialTransactionId } });
    if (!transaction) throw new NotFoundException('Financial transaction not found');
    if (!input.answer?.trim()) throw new BadRequestException('Answer is required');
    const inferred = this.infer(input.answer, transaction.direction);
    const type = input.classificationType ?? inferred.type;
    const accountCode = input.accountCode ?? inferred.accountCode;
    let journalTransactionIds: string[] = [];
    const lines = classificationJournalLines(transaction.direction, type, accountCode, Number(transaction.amount));
    if (lines.length) {
      const posted = await this.journal.postManual(ownerId, { date: day(transaction.detectedAt), description: `Kobe Accountant: ${input.answer.trim()} [${transaction.reference}]`, lines });
      journalTransactionIds = posted.map((r) => r.id);
    }
    const classification = await this.classifications.save(this.classifications.create({ ownerId, financialTransactionId: transaction.id, classificationType: type, category: input.category ?? inferred.category, accountCode, confidence: input.confidence ?? inferred.confidence, rationale: 'Classified from owner answer', ownerAnswer: input.answer.trim(), evidence: { ...(input.evidence ?? {}), questionId: question.id, answeredVia: input.via ?? 'CHAT' }, journalTransactionIds }));
    transaction.status = type === 'IGNORE' ? 'IGNORED' : 'CLASSIFIED'; await this.financial.save(transaction);
    question.status = 'ANSWERED'; question.answer = input.answer.trim(); question.answeredAt = new Date(); question.answeredVia = input.via ?? 'CHAT'; await this.questions.save(question);
    await this.repo(AccountingConversation).save(this.repo(AccountingConversation).create({ ownerId, questionId: question.id, channel: question.answeredVia === 'CALL' ? 'CALL' : 'CHAT', direction: 'INBOUND', content: question.answer, evidence: input.evidence ?? {} }));
    await this.events.emit({ ownerId, eventName: 'accounting.question_answered', aggregateType: 'AccountingQuestion', aggregateId: question.id, payload: { via: question.answeredVia } });
    await this.events.emit({ ownerId, eventName: 'accounting.transaction_classified', aggregateType: 'AccountingClassification', aggregateId: classification.id, payload: { financialTransactionId: transaction.id, accountCode, confidence: classification.confidence } });
    return { question, transaction, classification };
  }

  /** Reverse the prior journal and append a corrected classification; history is never overwritten. */
  async correctClassification(ownerId: string, id: string, input: { answer: string; classificationType?: ClassificationType; category?: string; accountCode?: string; confidence?: number; evidence?: Record<string, unknown> }) {
    const prior = await this.classifications.findOne({ where: { ownerId, id } });
    if (!prior) throw new NotFoundException('Classification not found');
    if (!input.answer?.trim()) throw new BadRequestException('Correction reason is required');
    const transaction = await this.financial.findOne({ where: { ownerId, id: prior.financialTransactionId } });
    if (!transaction) throw new NotFoundException('Financial transaction not found');
    const priorLines = prior.journalTransactionIds.length
      ? await this.journalRows.find({ where: { ownerId, id: In(prior.journalTransactionIds) } })
      : [];
    let reversalTransactionIds: string[] = [];
    if (priorLines.length) {
      const reversed = await this.journal.postManual(ownerId, {
        date: day(), description: `Kobe Accountant correction: reverse classification ${prior.id.slice(0, 8)} [${transaction.reference}]`,
        lines: priorLines.map((line) => ({ code: line.account.split(' ')[0], debit: Number(line.credit), credit: Number(line.debit) })),
      });
      reversalTransactionIds = reversed.map((row) => row.id);
    }
    const inferred = this.infer(input.answer, transaction.direction);
    const type = input.classificationType ?? inferred.type;
    const accountCode = input.accountCode ?? inferred.accountCode;
    let journalTransactionIds: string[] = [];
    const lines = classificationJournalLines(transaction.direction, type, accountCode, Number(transaction.amount));
    if (lines.length) {
      journalTransactionIds = (await this.journal.postManual(ownerId, { date: day(), description: `Kobe Accountant corrected: ${input.answer.trim()} [${transaction.reference}]`, lines })).map((row) => row.id);
    }
    const classification = await this.classifications.save(this.classifications.create({
      ownerId, financialTransactionId: transaction.id, classificationType: type,
      category: input.category ?? inferred.category, accountCode, confidence: input.confidence ?? inferred.confidence,
      rationale: 'Owner correction with automatic journal reversal', ownerAnswer: input.answer.trim(),
      evidence: { ...(input.evidence ?? {}), reversalTransactionIds, correctedAt: new Date().toISOString() },
      journalTransactionIds, correctsClassificationId: prior.id,
    }));
    transaction.status = type === 'IGNORE' ? 'IGNORED' : 'CLASSIFIED'; await this.financial.save(transaction);
    await this.events.emit({ ownerId, eventName: 'accounting.transaction_classified', aggregateType: 'AccountingClassification', aggregateId: classification.id, payload: { financialTransactionId: transaction.id, accountCode, confidence: classification.confidence, correctionOf: prior.id, reversalTransactionIds } });
    return { transaction, priorClassification: prior, classification, reversalTransactionIds };
  }

  async answerCall(callbackToken: string, input: { answer: string; transcript?: string; providerPayload?: Record<string, unknown> }) {
    const call = await this.calls.findOne({ where: { callbackToken } });
    if (!call) throw new NotFoundException('Call not found');
    call.status = 'COMPLETED'; call.transcript = input.transcript || input.answer; call.completedAt = new Date(); call.providerPayload = { ...call.providerPayload, ...(input.providerPayload ?? {}) };
    await this.calls.save(call);
    return this.answerQuestion(call.ownerId, call.questionId, { answer: input.answer, via: 'CALL', evidence: { callId: call.id, transcript: call.transcript } });
  }

  async statements(ownerId: string, from?: string, to?: string) {
    const end = to || day(); const start = from || `${end.slice(0, 7)}-01`;
    const rows = await this.journalRows.createQueryBuilder('t').where('t.ownerId = :ownerId', { ownerId }).andWhere('t.date >= :start', { start }).andWhere('t.date <= :end', { end }).orderBy('t.date', 'ASC').getMany();
    const accounts = await this.accounts.find({ where: { ownerId }, order: { code: 'ASC' } });
    const accountMap = new Map(accounts.map((a) => [a.code, a]));
    const grouped = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>();
    for (const row of rows) {
      const code = row.account.split(' ')[0]; const account = accountMap.get(code);
      const g = grouped.get(code) ?? { code, name: account?.name ?? row.account, type: account?.type ?? 'Unknown', debit: 0, credit: 0 };
      g.debit += Number(row.debit); g.credit += Number(row.credit); grouped.set(code, g);
    }
    const period = [...grouped.values()];
    const revenues = period.filter((x) => x.type === 'Revenue').map((x) => ({ ...x, amount: x.credit - x.debit }));
    const expenses = period.filter((x) => x.type === 'Expense').map((x) => ({ ...x, amount: x.debit - x.credit }));
    const totalRevenue = revenues.reduce((s, x) => s + x.amount, 0); const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0);
    const assets = accounts.filter((x) => x.type === 'Asset').map((x) => ({ code: x.code, name: x.name, amount: Number(x.balance) }));
    const liabilities = accounts.filter((x) => x.type === 'Liability').map((x) => ({ code: x.code, name: x.name, amount: Number(x.balance) }));
    const equity = accounts.filter((x) => x.type === 'Equity').map((x) => ({ code: x.code, name: x.name, amount: Number(x.balance) }));
    const cashRows = period.filter((x) => ['1000', '1010'].includes(x.code));
    return {
      period: { from: start, to: end },
      profitAndLoss: { revenues, expenses, totalRevenue, totalExpenses, netIncome: totalRevenue - totalExpenses },
      balanceSheet: { assets, liabilities, equity, totalAssets: assets.reduce((s, x) => s + x.amount, 0), totalLiabilities: liabilities.reduce((s, x) => s + x.amount, 0), totalEquity: equity.reduce((s, x) => s + x.amount, 0) + totalRevenue - totalExpenses },
      cashFlow: { operatingCashMovement: cashRows.reduce((s, x) => s + x.debit - x.credit, 0), cashAccounts: assets.filter((x) => ['1000', '1010'].includes(x.code)) },
      trialBalance: period,
    };
  }

  async closeDay(ownerId: string, closeDate = day()) {
    await this.aggregateOperations();
    const start = new Date(`${closeDate}T00:00:00.000Z`); const end = new Date(`${closeDate}T23:59:59.999Z`);
    const transactions = await this.financial.createQueryBuilder('f').where('f.ownerId = :ownerId', { ownerId }).andWhere('f.detectedAt BETWEEN :start AND :end', { start, end }).getMany();
    const unresolved = transactions.filter((t) => t.status === 'NEEDS_INFO').length;
    const statements = await this.statements(ownerId, closeDate, closeDate);
    let row = await this.closes.findOne({ where: { ownerId, closeDate } });
    row ??= this.closes.create({ ownerId, closeDate, status: 'PRELIMINARY', transactionCount: 0, unresolvedCount: 0, moneyIn: 0, moneyOut: 0, statements: {} });
    row.transactionCount = transactions.length; row.unresolvedCount = unresolved;
    row.moneyIn = transactions.filter((t) => t.direction === 'IN').reduce((s, t) => s + Number(t.amount), 0);
    row.moneyOut = transactions.filter((t) => t.direction === 'OUT').reduce((s, t) => s + Number(t.amount), 0);
    row.statements = statements; row.status = unresolved ? 'PRELIMINARY' : 'CLOSED'; row.completedAt = unresolved ? null : new Date();
    row = await this.closes.save(row);
    if (!unresolved) await this.events.emit({ ownerId, eventName: 'accounting.daily_close_completed', aggregateType: 'DailyClose', aggregateId: row.id, payload: { closeDate, transactionCount: row.transactionCount } });
    return row;
  }

  @Cron('55 23 * * *')
  async scheduledClose() {
    const owners = await this.financial.createQueryBuilder('f').select('DISTINCT f.ownerId', 'ownerId').getRawMany<{ ownerId: string }>();
    for (const { ownerId } of owners) await this.closeDay(ownerId).catch(() => undefined);
  }
}
