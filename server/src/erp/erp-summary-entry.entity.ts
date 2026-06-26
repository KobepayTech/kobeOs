import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

/**
 * Per-tenant Sales & Expenses quick-entry book. Replaces the
 * localStorage-only store in src/apps/erp-summary so books survive
 * a browser cache clear and roam across till + manager devices.
 */
@Entity('erp_summary_entries')
@Index(['ownerId', 'kind', 'date'])
export class ErpSummaryEntry extends OwnedEntity {
  @Column({ length: 16 })
  kind!: 'expenses' | 'sales';

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  amount!: number;

  @Column({ type: 'text', default: '' })
  reason!: string;
}
