import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('chat_channels')
export class ChatChannel extends BaseEntity {
  @Index({ unique: true })
  @Column()
  slug!: string;

  @Column()
  name!: string;

  @Column({ default: '' })
  description!: string;

  @Column({ default: 'channel' })
  type!: 'channel' | 'dm';
}

@Entity('chat_messages')
export class ChatMessage extends BaseEntity {
  @Index()
  @Column('uuid')
  channelId!: string;

  @Index()
  @Column('uuid')
  senderId!: string;

  @Column()
  senderName!: string;

  @Column({ default: 'message' })
  type!: 'message' | 'system';

  @Column({ type: 'text' })
  text!: string;
}
