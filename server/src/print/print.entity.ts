import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

// ── Print Job ─────────────────────────────────────────────────────────────────

@Entity('print_jobs')
export class PrintJob extends OwnedEntity {
  @Index()
  @Column()
  jobNumber!: string;

  @Column()
  product!: string;

  @Column({ default: '' })
  customer!: string;

  @Column({ nullable: true, type: 'varchar' })
  customerPhone?: string | null;

  @Column({ nullable: true, type: 'varchar' })
  customerEmail?: string | null;

  @Column({ type: 'date', nullable: true })
  dueDate?: string | null;

  @Column({ default: 'Medium' })
  priority!: string; // High | Medium | Low

  @Column({ default: 'Pending' })
  status!: string; // Pending | Printing | Finishing | Completed | Cancelled

  @Column({ default: 1 })
  qty!: number;

  @Column({ default: '' })
  method!: string; // DTG | Sublimation | Screen | Vinyl | Embroidery

  @Column({ nullable: true, type: 'varchar' })
  notes?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  price!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ nullable: true, type: 'varchar' })
  templateId?: string | null;
}

// ── Print Template ────────────────────────────────────────────────────────────

@Entity('print_templates')
export class PrintTemplate extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: '' })
  category!: string; // T-Shirt | Jersey | Mug | Banner | Sticker | Custom

  @Column({ default: '' })
  method!: string;

  // JSON blob: array of CanvasShape objects from the UI designer
  @Column({ type: 'text', default: '[]' })
  canvasData!: string;

  @Column({ nullable: true, type: 'varchar' })
  thumbnailUrl?: string | null;

  @Column({ default: true })
  active!: boolean;
}

// ── Material / Inventory ──────────────────────────────────────────────────────

@Entity('print_materials')
export class PrintMaterial extends OwnedEntity {
  @Column()
  name!: string;

  @Column({ default: '' })
  type!: string; // Vinyl | Ink | Fabric | Thread | Transfer | Other

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  stock!: number;

  @Column({ default: 'units' })
  unit!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  minThreshold!: number;

  @Column({ default: '' })
  color!: string;

  @Column({ nullable: true, type: 'varchar' })
  supplier?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  costPerUnit!: number;

  @Column({ default: 'TZS' })
  currency!: string;
}
