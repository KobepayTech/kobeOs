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

  // pg returns decimal as string; transform back to a JS number on read
  // so list() and create() agree on the shape (and the frontend doesn't
  // have to defend with Number() everywhere).
  @Column({
    type: 'decimal', precision: 18, scale: 4, default: 0,
    transformer: { to: (v: number) => v, from: (v: string | number) => Number(v) },
  })
  amount!: number;

  @Column({ type: 'text', default: '' })
  reason!: string;
}
