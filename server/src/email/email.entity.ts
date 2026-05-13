import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';

@Entity('emails')
export class EmailMessage extends OwnedEntity {
  @Index()
  @Column({ default: 'inbox' })
  folder!: 'inbox' | 'sent' | 'drafts' | 'archive' | 'trash' | 'spam';

  @Column()
  fromAddress!: string;

  @Column({ default: '' })
  fromName!: string;

  @Column({ type: 'simple-array' })
  toAddresses!: string[];

  @Column({ type: 'simple-array', default: '' })
  ccAddresses!: string[];

  @Column({ default: '' })
  subject!: string;

  @Column({ type: 'text', default: '' })
  body!: string;

  @Column({ default: false })
  read!: boolean;

  @Column({ default: false })
  starred!: boolean;

  @Column({ type: 'simple-array', default: '' })
  labels!: string[];
}
