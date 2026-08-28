import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { OwnedEntity } from '../common/owned.entity';

/**
 * Kobe AI Receptionist — a customer-facing assistant per ERP business. It greets
 * customers, answers FAQs, takes restaurant orders, checks order/booking status,
 * and captures leads with human hand-off. Reachable from the website widget,
 * hotel/table QR, WhatsApp, and (via the voice worker) phone calls. All channels
 * hit the same engine.
 */

export interface FaqEntry { q: string; a: string }
export interface ReceptionCapabilities { faq: boolean; order: boolean; status: boolean; booking: boolean }
export interface CartLine { menuItemId: string; name: string; qty: number; price: number; station: string }

@Entity('receptionists')
export class Receptionist extends OwnedEntity {
  @Index({ unique: true })
  @Column()
  slug!: string;

  @Column()
  businessName!: string;

  /** Restaurant/hotel this receptionist serves (menu + orders scope). Optional
   * for non-food businesses that only do FAQ + leads. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  hotelId?: string | null;

  @Column({ default: true })
  enabled!: boolean;

  @Column({ type: 'text', default: '' })
  greeting!: string;

  @Column({ type: 'text', default: '' })
  hoursText!: string;

  @Column({ type: 'jsonb', default: '[]' })
  faq!: FaqEntry[];

  @Column({ type: 'jsonb', default: '{"faq":true,"order":true,"status":true,"booking":true}' })
  capabilities!: ReceptionCapabilities;

  /** Where to escalate when a human is needed. */
  @Column({ default: '' })
  handoffPhone!: string;

  @Column({ default: 'TZS' })
  currency!: string;

  @Column({ default: false })
  voiceEnabled!: boolean;
}

@Entity('reception_sessions')
export class ReceptionSession extends BaseEntity {
  @Index()
  @Column('uuid')
  receptionistId!: string;

  @Column({ default: 'web' })
  channel!: 'web' | 'whatsapp' | 'qr' | 'voice';

  @Column({ default: '' })
  customerName!: string;

  @Column({ default: '' })
  customerPhone!: string;

  @Index()
  @Column({ default: 'OPEN' })
  status!: 'OPEN' | 'HANDED_OFF' | 'CLOSED';

  /** Conversation state: cart + slot-filling stage. */
  @Column({ type: 'jsonb', default: '{}' })
  context!: { cart?: CartLine[]; stage?: string };
}

@Entity('reception_messages')
export class ReceptionMessage extends BaseEntity {
  @Index()
  @Column('uuid')
  sessionId!: string;

  @Column()
  role!: 'customer' | 'assistant';

  @Column({ type: 'text' })
  text!: string;
}

@Entity('reception_leads')
export class ReceptionLead extends BaseEntity {
  @Index()
  @Column('uuid')
  receptionistId!: string;

  @Column({ type: 'uuid', nullable: true })
  sessionId?: string | null;

  @Column({ default: '' })
  name!: string;

  @Column({ default: '' })
  phone!: string;

  @Column({ type: 'text', default: '' })
  summary!: string;

  @Index()
  @Column({ default: 'NEW' })
  status!: 'NEW' | 'CONTACTED' | 'CLOSED';
}

export const RECEPTION_ENTITIES = [Receptionist, ReceptionSession, ReceptionMessage, ReceptionLead];
