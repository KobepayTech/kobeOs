import { Column, Entity, Index } from 'typeorm';
import { OwnedEntity } from '../common/owned.entity';
import { socialTokenTransformer } from '../social-scheduler/social-token.transformer';

@Entity('live_broadcast_settings')
@Index(['ownerId'], { unique: true })
export class LiveBroadcastSettings extends OwnedEntity {
  @Column({ type: 'text', select: false, transformer: socialTokenTransformer })
  publishUrl!: string;

  @Column({ type: 'text' })
  playbackUrl!: string;
}
