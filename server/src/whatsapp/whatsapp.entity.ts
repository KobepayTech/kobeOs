import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type WhatsAppDirection = 'in' | 'out';

/**
 * A customer who has messaged the shop on WhatsApp.
 *
 * KobeOS could already SEND WhatsApp (Beem templates) and link out to wa.me,
 * but nothing came back: there was no inbound side, so a customer's reply
 * landed nowhere. These are the records that make a conversation two-way.
 */
@Entity('whatsapp_contacts')
@Index('IDX_whatsapp_contacts_owner_phone', ['ownerId', 'phone'], { unique: true })
export class WhatsAppContact extends BaseEntity {
  @Index('IDX_whatsapp_contacts_owner')
  @Column('uuid')
  ownerId!: string;

  /** Normalised to digits with country code, so one person is one contact. */
  @Column()
  phone!: string;

  @Column({ default: '' })
  displayName!: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt?: Date | null;

  /** Set when the customer asks to stop; suppresses automatic replies. */
  @Column({ default: false })
  optedOut!: boolean;
}

@Entity('whatsapp_messages')
export class WhatsAppMessage extends BaseEntity {
  @Index('IDX_whatsapp_messages_owner')
  @Column('uuid')
  ownerId!: string;

  @Index('IDX_whatsapp_messages_contact')
  @Column('uuid')
  contactId!: string;

  @Column({ type: 'varchar', length: 8 })
  direction!: WhatsAppDirection;

  @Column('text')
  body!: string;

  /** The provider's id, used to drop duplicate webhook deliveries. */
  @Index('IDX_whatsapp_messages_external')
  @Column({ default: '' })
  externalId!: string;

  /** Set when an automatic reply was suppressed, with the reason. */
  @Column({ type: 'text', default: '' })
  note!: string;
}

/** Per-shop WhatsApp settings, including the webhook token. */
@Entity('whatsapp_settings')
export class WhatsAppSettings extends BaseEntity {
  @Index('IDX_whatsapp_settings_owner', { unique: true })
  @Column('uuid')
  ownerId!: string;

  /**
   * Unguessable path segment identifying the shop on the public webhook.
   * The provider has no per-shop credential to present, so this token is what
   * separates one shop's inbox from another's.
   */
  @Index('IDX_whatsapp_settings_token', { unique: true })
  @Column()
  webhookToken!: string;

  /**
   * Off by default, deliberately. This replies to real customers in the
   * shop's name; turning it on is a decision the owner makes, not a default
   * they discover after the fact.
   */
  @Column({ default: false })
  autoReply!: boolean;
}
