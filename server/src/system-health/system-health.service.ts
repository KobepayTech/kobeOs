import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

export type SubsystemState = 'ok' | 'down';
export type SystemMode = 'healthy' | 'degraded' | 'critical';

export interface SubsystemHealth {
  state: SubsystemState;
  detail: string;
  failures: number;          // consecutive failed checks
  lastOkAt: string | null;
  lastRecoveredAt: string | null;
}

export interface SystemReport {
  mode: SystemMode;          // healthy = all up; degraded = AI offline; critical = DB down
  message: string;           // plain-language banner text for the UI
  checkedAt: string;
  subsystems: { database: SubsystemHealth; ai: SubsystemHealth };
}

/**
 * Runtime self-healing. Periodically checks the subsystems the app depends on
 * (database, local AI), attempts recovery when one is down, and publishes a
 * plain-language status the UI shows as a safe-mode banner — so a failed
 * dependency degrades gracefully instead of breaking silently.
 *
 * The database is critical (the app can't serve without it); the AI is
 * optional (features already fall back to offline/keyword mode), so losing it
 * is only "degraded".
 */
@Injectable()
export class SystemHealthService {
  private readonly logger = new Logger(SystemHealthService.name);

  private db: SubsystemHealth = { state: 'ok', detail: 'connected', failures: 0, lastOkAt: null, lastRecoveredAt: null };
  private ai: SubsystemHealth = { state: 'ok', detail: 'reachable', failures: 0, lastOkAt: null, lastRecoveredAt: null };
  private checkedAt = new Date(0).toISOString();

  constructor(
    private readonly ds: DataSource,
    private readonly config: ConfigService,
  ) {}

  /** Check every 30s and try to recover anything that's down. */
  @Cron('*/30 * * * * *')
  async tick(): Promise<void> {
    await this.checkDatabase();
    await this.checkAi();
    this.checkedAt = new Date().toISOString();
  }

  private mark(sub: SubsystemHealth, ok: boolean, detail: string): void {
    const now = new Date().toISOString();
    if (ok) {
      if (sub.state === 'down') { sub.lastRecoveredAt = now; this.logger.log(`recovered: ${detail}`); }
      sub.state = 'ok'; sub.failures = 0; sub.lastOkAt = now;
    } else {
      sub.state = 'down'; sub.failures += 1;
    }
    sub.detail = detail;
  }

  private async checkDatabase(): Promise<void> {
    try {
      if (!this.ds.isInitialized) {
        // Attempt to bring the connection back up before giving up.
        await this.ds.initialize();
      }
      await this.ds.query('SELECT 1');
      this.mark(this.db, true, 'connected');
    } catch (e) {
      this.mark(this.db, false, `unreachable: ${(e as Error).message}`);
      this.logger.warn(`database check failed (attempt ${this.db.failures}): ${(e as Error).message}`);
    }
  }

  private async checkAi(): Promise<void> {
    const url = this.config.get<string>('OLLAMA_URL', 'http://127.0.0.1:11434');
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(`${url}/api/tags`, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.mark(this.ai, true, 'reachable');
    } catch (e) {
      // AI is optional: features fall back to offline mode, so this is not fatal.
      this.mark(this.ai, false, `offline: ${(e as Error).message}`);
    }
  }

  getReport(): SystemReport {
    const mode: SystemMode = this.db.state === 'down' ? 'critical' : this.ai.state === 'down' ? 'degraded' : 'healthy';
    const message =
      mode === 'critical'
        ? 'Database is unreachable — retrying automatically. Some data may be temporarily unavailable.'
        : mode === 'degraded'
          ? 'Local AI is offline — Kobe is running in offline mode (keyword search and deterministic reports still work).'
          : 'All systems normal.';
    return { mode, message, checkedAt: this.checkedAt, subsystems: { database: this.db, ai: this.ai } };
  }
}
