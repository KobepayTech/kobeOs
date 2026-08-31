import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

export type ErpCrmStage =
  | 'NEW'
  | 'CONTACTED'
  | 'APPOINTMENT'
  | 'NEGOTIATING'
  | 'DEPOSIT'
  | 'WON'
  | 'LOST';

@Entity('erp_crm_leads')
@Index(['ownerId', 'stage'])
@Index(['ownerId', 'businessId', 'customerPhone'])
@Index(['ownerId', 'source', 'sourceRefId'])
export class ErpCrmLead extends OwnedEntity {
  @Column('uuid', { nullable: true })
  businessId?: string | null;

  @Column({ default: 'MANUAL' })
  source!: 'MANUAL' | 'VEHICLE' | 'STORE' | 'HOTEL' | 'PROPERTY' | 'RECRUITMENT' | 'RECEPTION';

  @Column({ default: '' })
  sourceRefId!: string;

  @Column()
  customerName!: string;

  @Column({ default: '' })
  customerPhone!: string;

  @Column({ default: '' })
  customerWhatsapp!: string;

  @Column({ default: '' })
  customerEmail!: string;

  @Column({ default: '' })
  subject!: string;

  @Column({ default: 'NEW' })
  stage!: ErpCrmStage;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  value!: number;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: '' })
  assignedTo!: string;

  @Column({ type: 'timestamptz', nullable: true })
  nextActionAt?: Date | null;

  @Column({ type: 'text', default: '' })
  notes!: string;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;
}

@Entity('erp_crm_activities')
@Index(['ownerId', 'leadId', 'createdAt'])
export class ErpCrmActivity extends OwnedEntity {
  @Column('uuid')
  leadId!: string;

  @Column({ default: 'NOTE' })
  type!: 'NOTE' | 'CALL' | 'WHATSAPP' | 'SMS' | 'EMAIL' | 'APPOINTMENT' | 'STATUS_CHANGE';

  @Column({ type: 'text', default: '' })
  body!: string;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledFor?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;
}

export const ERP_CRM_ENTITIES = [ErpCrmLead, ErpCrmActivity] as const;
