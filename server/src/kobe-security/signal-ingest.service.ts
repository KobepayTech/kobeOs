import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SiteSignalsService } from './kobe-security.service';

type RuViewZonePayload = {
  id?: string;
  name?: string;
  zone_name?: string;
  occupied?: boolean;
  peopleCount?: number;
  people_count?: number;
  occupancy_count?: number;
  confidence?: number;
  motionLevel?: number;
  motion_level?: number;
  motion?: number;
};

@Injectable()
export class RuViewSignalIngestService {
  private readonly logger = new Logger(RuViewSignalIngestService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly signals: SiteSignalsService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async ingestZones() {
    const ownerId = this.config.get<string>('KOBE_SYSTEM_OWNER_ID');
    const baseUrl = this.config.get<string>('RUVIEW_BASE_URL');

    if (!ownerId || !baseUrl) return;

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/zones`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return;

      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload)) return;

      for (const item of payload) {
        const zone = item as RuViewZonePayload;
        const zoneId = String(zone.id ?? 'unknown-zone');
        const zoneName = String(zone.name ?? zone.zone_name ?? zoneId);
        const peopleCount = Number(zone.peopleCount ?? zone.people_count ?? zone.occupancy_count ?? 0);
        const confidence = Number(zone.confidence ?? 0);
        const motion = Number(zone.motionLevel ?? zone.motion_level ?? zone.motion ?? 0);
        const occupied = Boolean(zone.occupied ?? peopleCount > 0);

        await this.signals.create(ownerId, {
          zoneId,
          zoneName,
          eventType: occupied ? 'occupancy' : motion > 0 ? 'motion' : 'signal',
          severity: occupied || motion > 0.6 ? 'warning' : 'info',
          occupied,
          peopleCount: Number.isFinite(peopleCount) ? peopleCount : 0,
          confidence: Number.isFinite(confidence) ? confidence : 0,
          raw: zone as Record<string, unknown>,
        });
      }
    } catch (error) {
      this.logger.warn(`RuView ingest skipped: ${(error as Error).message}`);
    }
  }
}
