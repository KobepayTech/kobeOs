import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityMetadata } from 'typeorm';

export interface ExportFile {
  version: number;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

/**
 * Per-user backup: export/import all of the caller's owned data as JSON.
 * Generic over every OwnedEntity (any table with an `ownerId` column), so new
 * modules are covered automatically. Row ids are preserved on import so
 * cross-row references (e.g. todo_items.listId, pos_order_items.orderId) stay
 * intact; ownership is reassigned to the importing user.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(private readonly ds: DataSource) {}

  private ownedEntities(): EntityMetadata[] {
    return this.ds.entityMetadatas.filter((m) =>
      m.columns.some((c) => c.propertyName === 'ownerId'),
    );
  }

  async exportData(ownerId: string): Promise<ExportFile> {
    const data: Record<string, unknown[]> = {};
    for (const meta of this.ownedEntities()) {
      // A backup must not abort wholesale because one table is unreadable
      // (e.g. an entity whose schema has drifted from the live DB). Skip it
      // and keep going so the rest of the user's data is still captured.
      try {
        data[meta.tableName] = await this.ds
          .getRepository(meta.target)
          .find({ where: { ownerId } } as object);
      } catch (err) {
        this.logger.warn(`export: skipping ${meta.tableName}: ${(err as Error).message}`);
      }
    }
    return { version: 1, exportedAt: new Date().toISOString(), data };
  }

  async importData(ownerId: string, payload: Partial<ExportFile>): Promise<{ ok: true; imported: number }> {
    const data = payload?.data ?? {};
    let imported = 0;
    for (const meta of this.ownedEntities()) {
      const rows = data[meta.tableName];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      // Restore each table independently so one bad table can't roll back the
      // whole import. Keep ids (preserve references) but reassign ownership.
      try {
        const repo = this.ds.getRepository(meta.target);
        const owned = rows.map((r) => ({ ...(r as object), ownerId }));
        await repo.save(owned as object[]);
        imported += owned.length;
      } catch (err) {
        this.logger.warn(`import: skipping ${meta.tableName}: ${(err as Error).message}`);
      }
    }
    return { ok: true, imported };
  }
}
