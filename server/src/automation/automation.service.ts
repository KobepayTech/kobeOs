import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { AppState } from '../app-state/app-state.entity';
import { RentCharge, Tenant } from '../property/property.entity';
import { Shop } from '../shops/shop.entity';
import { BeemService } from '../notifications/beem.service';
import { KobeAgentService } from '../ai/agent.service';

const AUTOMATION_KEY = 'automation';

export interface AutomationConfig {
  /** SMS the owner a daily business briefing. */
  dailyReport: boolean;
  /** Phone that receives the daily report (falls back to the shop phone). */
  ownerPhone: string;
  /** Auto-remind tenants whose rent is due soon or overdue. */
  tenantReminders: boolean;
  /** Remind this many days before the due date (and while overdue). */
  reminderDaysBefore: number;
  /** Reminder SMS template ({name} and {amount} are substituted). */
  reminderMessage: string;
}

const DEFAULTS: AutomationConfig = {
  dailyReport: false,
  ownerPhone: '',
  tenantReminders: false,
  reminderDaysBefore: 3,
  reminderMessage: 'Hello {name}, a friendly reminder that your rent of TZS {amount} is due. Kindly pay at your earliest convenience. Asante.',
};

/**
 * Runs AI/data-powered jobs on a schedule per owner (config in AppState), so
 * KobeOS works FOR the owner without anyone opening the app:
 *   • daily business briefing SMS to the owner
 *   • automatic rent reminders to tenants who are due soon / overdue
 * Each shop's own backend runs these for its own owner (self-hosted model).
 */
@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    @InjectRepository(AppState) private readonly appState: Repository<AppState>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(RentCharge) private readonly charges: Repository<RentCharge>,
    @InjectRepository(Shop) private readonly shops: Repository<Shop>,
    private readonly beem: BeemService,
    private readonly agent: KobeAgentService,
  ) {}

  // ── Config ────────────────────────────────────────────────────────────────

  async getConfig(ownerId: string): Promise<AutomationConfig> {
    const row = await this.appState.findOne({ where: { ownerId, key: AUTOMATION_KEY } });
    return { ...DEFAULTS, ...((row?.value as Partial<AutomationConfig>) ?? {}) };
  }

  async setConfig(ownerId: string, patch: Partial<AutomationConfig>): Promise<AutomationConfig> {
    const merged = { ...(await this.getConfig(ownerId)), ...patch };
    const row = await this.appState.findOne({ where: { ownerId, key: AUTOMATION_KEY } });
    if (row) { row.value = merged; await this.appState.save(row); }
    else await this.appState.save(this.appState.create({ ownerId, key: AUTOMATION_KEY, value: merged }));
    return merged;
  }

  /** Every owner who has any automation enabled. */
  private async enabledOwners(): Promise<Array<{ ownerId: string; cfg: AutomationConfig }>> {
    const rows = await this.appState.find({ where: { key: AUTOMATION_KEY } });
    return rows
      .map((r) => ({ ownerId: r.ownerId, cfg: { ...DEFAULTS, ...((r.value as Partial<AutomationConfig>) ?? {}) } }))
      .filter(({ cfg }) => cfg.dailyReport || cfg.tenantReminders);
  }

  private async ownerPhone(ownerId: string, cfg: AutomationConfig): Promise<string> {
    if (cfg.ownerPhone) return cfg.ownerPhone;
    const shop = await this.shops.findOne({ where: { ownerId } });
    return shop?.phone || '';
  }

  // ── Jobs ──────────────────────────────────────────────────────────────────

  /** Daily owner briefing SMS — 07:00 server time. */
  @Cron('0 7 * * *')
  async sendDailyOwnerReports(): Promise<void> {
    for (const { ownerId, cfg } of await this.enabledOwners()) {
      if (!cfg.dailyReport) continue;
      try { await this.sendDailyReport(ownerId, cfg); }
      catch (e) { this.logger.warn(`daily report failed for ${ownerId}: ${(e as Error).message}`); }
    }
  }

  /** Rent reminders to tenants due soon / overdue — 08:00 server time. */
  @Cron('0 8 * * *')
  async sendTenantReminders(): Promise<void> {
    for (const { ownerId, cfg } of await this.enabledOwners()) {
      if (!cfg.tenantReminders) continue;
      try { await this.remindTenants(ownerId, cfg); }
      catch (e) { this.logger.warn(`tenant reminders failed for ${ownerId}: ${(e as Error).message}`); }
    }
  }

  // ── Implementations (also callable on demand from the controller) ───────────

  async sendDailyReport(ownerId: string, cfg?: AutomationConfig): Promise<{ ok: boolean; message: string }> {
    const c = cfg ?? (await this.getConfig(ownerId));
    const phone = await this.ownerPhone(ownerId, c);
    if (!phone) return { ok: false, message: 'No owner phone set for the daily report.' };
    const brief = await this.agent.briefing(ownerId);
    const alertLines = brief.alerts.map((a) => `- ${a.text}`).join('\n');
    const body = `KobeOS daily report\n${brief.summary}${alertLines ? `\n${alertLines}` : ''}`;
    const res = await this.beem.sendSms(phone, body.slice(0, 800));
    this.logger.log(`daily report → ${phone} (${res.ok ? 'sent' : res.error})`);
    return res.ok ? { ok: true, message: `Report sent to ${phone}.` } : { ok: false, message: res.error || 'SMS gateway not configured.' };
  }

  async remindTenants(ownerId: string, cfg?: AutomationConfig): Promise<{ ok: boolean; message: string; count: number }> {
    const c = cfg ?? (await this.getConfig(ownerId));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + Math.max(0, c.reminderDaysBefore));
    const rows = await this.charges.find({
      where: { ownerId, status: In(['open', 'partial', 'overdue']), dueDate: LessThanOrEqual(cutoff) },
      take: 5000,
    });
    // One reminder per tenant, using the largest outstanding balance.
    const balByTenant = new Map<string, number>();
    for (const r of rows) {
      const bal = Number(r.amount || 0) - Number(r.amountPaid || 0);
      if (bal > 0) balByTenant.set(r.tenantId, (balByTenant.get(r.tenantId) ?? 0) + bal);
    }
    const ids = [...balByTenant.keys()];
    if (!ids.length) return { ok: true, message: 'No tenants due for a reminder.', count: 0 };
    const tenants = await this.tenants.find({ where: { id: In(ids) } });
    const batch = tenants
      .filter((t) => t.phone)
      .map((t) => ({
        phone: t.phone,
        message: c.reminderMessage
          .replace('{name}', t.name || 'tenant')
          .replace('{amount}', Math.round(balByTenant.get(t.id) ?? 0).toLocaleString()),
      }));
    if (!batch.length) return { ok: true, message: 'No tenant phone numbers on file.', count: 0 };
    // Personalised messages → send individually.
    let sent = 0;
    for (const m of batch) { const r = await this.beem.sendSms(m.phone, m.message); if (r.ok) sent += 1; }
    this.logger.log(`tenant reminders for ${ownerId}: ${sent}/${batch.length} sent`);
    return { ok: sent > 0, message: `Reminders sent to ${sent} tenant(s).`, count: sent };
  }
}
